#!/usr/bin/env python3
"""ReportMe 산출 HTML 정합성 점검 스크립트.

섹션·탭을 옮기거나 편집한 뒤 짝(pair)이 깨지는 문제를 잡는다 — AI 편집 후 필수 실행.
표준 라이브러리만 사용(의존성 없음).

검사 항목
  E1  상단 탭 data-p ↔ 패널 id 짝 (누락·고아·중복)
  E2  .tab.active / .panel.active 정확히 1개씩 + 서로 같은 짝
  E3  .ref[data-ref] 키가 REFS 객체에 존재 (W: REFS에만 있고 본문에 없는 키)
  E4  .sidewrap마다 .subtab data-sp ↔ .subpanel data-sp 짝 + active 1쌍
  E5  중복 id
  E6  플레이스홀더 잔존 ({{…}}, [설명: …])
  E7  외부 리소스 (script/link/img/iframe의 http(s) src·href — 단일 파일 원칙 위반)
  W1  스크립트 내 fetch(/XMLHttpRequest (file://에서 실패)
  W2  <html lang> 미설정
  W3  외부 <a href> 링크 0개 — 출처가 평문 텍스트뿐일 가능성 (§5 출처 하이퍼링크 규칙)

사용:  python3 validate_report.py <report.html>
종료코드: 0 = 통과(경고만 허용), 1 = 오류 존재, 2 = 사용법/파일 오류
"""
import re
import sys
from collections import Counter
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tabs = []        # (data-p, active여부)
        self.panels = []      # (id, active여부)
        self.refs = []        # 본문 .ref[data-ref] 키
        self.ids = []
        self.sidewraps = []   # {'subtabs':[(sp,active)], 'subpanels':[(sp,active)]}
        self.externals = []   # (태그, URL)
        self.ext_links = 0    # 외부로 나가는 <a href="http…"> 개수 (출처 링크)
        self.html_lang = None
        self.script_text = []
        self._wrap_stack = [] # (sidewraps 인덱스, 열린 깊이)
        self._depth = 0
        self._in_script = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag not in VOID:
            self._depth += 1
        if tag == 'html':
            self.html_lang = a.get('lang')
        if tag == 'script':
            self._in_script = True
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'button' and 'tab' in cls:
            self.tabs.append((a.get('data-p'), 'active' in cls))
        if 'panel' in cls:
            self.panels.append((a.get('id'), 'active' in cls))
        if 'ref' in cls and a.get('data-ref'):
            self.refs.append(a['data-ref'])
        if 'sidewrap' in cls:
            self.sidewraps.append({'subtabs': [], 'subpanels': []})
            self._wrap_stack.append((len(self.sidewraps) - 1, self._depth))
        if self._wrap_stack:
            wi = self._wrap_stack[-1][0]
            if 'subtab' in cls:
                self.sidewraps[wi]['subtabs'].append((a.get('data-sp'), 'active' in cls))
            if 'subpanel' in cls:
                self.sidewraps[wi]['subpanels'].append((a.get('data-sp'), 'active' in cls))
        src = a.get('src', '') or ''
        href = a.get('href', '') or ''
        if tag in ('script', 'img', 'iframe') and src.startswith(('http://', 'https://', '//')):
            self.externals.append((tag, src))
        if tag == 'link' and href.startswith(('http://', 'https://', '//')):
            self.externals.append((tag, href))
        if tag == 'a' and href.startswith(('http://', 'https://')):
            self.ext_links += 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self._depth -= 1

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == 'script':
            self._in_script = False
        if self._wrap_stack and self._depth == self._wrap_stack[-1][1]:
            self._wrap_stack.pop()
        self._depth -= 1

    def handle_data(self, data):
        if self._in_script:
            self.script_text.append(data)


def refs_keys(js):
    """const REFS = { … } 의 최상위 키만 추출. 문자열(html 값) 내부의 중괄호·따옴표는 건너뜀."""
    m = re.search(r'\bREFS\s*=\s*\{', js)
    if m is None:
        return None
    i = m.end() - 1
    depth = 0
    in_str = None
    esc = False
    keys = []
    pend = None  # 방금 닫힌 depth==1 문자열 (다음 비공백이 ':'면 키)
    j = i
    while j < len(js):
        c = js[j]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == in_str[0]:
                if depth == 1:
                    pend = js[in_str[1] + 1:j]
                in_str = None
            j += 1
            continue
        if c == '/' and js[j:j + 2] == '/*':          # JS 블록 주석 건너뜀 (주석 속 예시 키 오탐 방지)
            e = js.find('*/', j + 2)
            j = len(js) if e < 0 else e + 2
            continue
        if c == '/' and js[j:j + 2] == '//':          # 줄 주석 건너뜀
            e = js.find('\n', j + 2)
            j = len(js) if e < 0 else e + 1
            continue
        if pend is not None and not c.isspace():
            if c == ':':
                keys.append(pend)
            pend = None
        if c in ('"', "'", '`'):
            in_str = (c, j)
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return keys
        j += 1
    return keys  # 닫는 중괄호를 못 찾아도 수집분 반환


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    try:
        html = open(path, encoding='utf-8').read()
    except OSError as e:
        print(f'⛔ 파일을 읽을 수 없음: {e}')
        return 2

    s = Scan()
    s.feed(html)
    errors, warns = [], []

    # E1/E2 — 탭 ↔ 패널
    tab_ps = [p for p, _ in s.tabs]
    panel_ids = [i for i, _ in s.panels]
    for p in tab_ps:
        if not p:
            errors.append('탭 버튼에 data-p 누락')
        elif p not in panel_ids:
            errors.append(f'탭 data-p="{p}" 에 대응하는 <section class="panel" id="{p}"> 없음')
    for i in panel_ids:
        if i not in tab_ps:
            errors.append(f'패널 id="{i}" 를 여는 탭(data-p) 없음')
    for name, items in (('탭(data-p)', tab_ps), ('패널(id)', panel_ids)):
        for k, n in Counter(items).items():
            if k and n > 1:
                errors.append(f'{name} "{k}" 중복 {n}회')
    act_tabs = [p for p, a in s.tabs if a]
    act_panels = [i for i, a in s.panels if a]
    if len(act_tabs) != 1:
        errors.append(f'.tab.active 가 {len(act_tabs)}개 (정확히 1개여야 함)')
    if len(act_panels) != 1:
        errors.append(f'.panel.active 가 {len(act_panels)}개 (정확히 1개여야 함)')
    if len(act_tabs) == 1 and len(act_panels) == 1 and act_tabs[0] != act_panels[0]:
        errors.append(f'active 탭("{act_tabs[0]}")과 active 패널("{act_panels[0]}")이 다름')

    # E3 — .ref ↔ REFS
    js = ''.join(s.script_text)
    keys = refs_keys(js)
    if s.refs and keys is None:
        errors.append('.ref 칩이 있는데 REFS 객체를 찾지 못함')
    elif keys is not None:
        for r in sorted(set(s.refs)):
            if r not in keys:
                errors.append(f'.ref data-ref="{r}" 가 REFS 에 없음 (드로어 안 열림)')
        for k in keys:
            if k not in s.refs:
                warns.append(f'REFS 키 "{k}" 를 여는 .ref 칩이 본문에 없음 (죽은 데이터)')

    # E4 — 서브탭
    for n, w in enumerate(s.sidewraps, 1):
        st = [k for k, _ in w['subtabs']]
        sp = [k for k, _ in w['subpanels']]
        for k in st:
            if k not in sp:
                errors.append(f'sidewrap#{n}: subtab data-sp="{k}" 에 대응 subpanel 없음')
        for k in sp:
            if k not in st:
                errors.append(f'sidewrap#{n}: subpanel data-sp="{k}" 를 여는 subtab 없음')
        a_st = [k for k, a in w['subtabs'] if a]
        a_sp = [k for k, a in w['subpanels'] if a]
        if len(a_st) != 1 or len(a_sp) != 1:
            errors.append(f'sidewrap#{n}: active subtab {len(a_st)}개 / active subpanel {len(a_sp)}개 (각 1개여야 함)')
        elif a_st[0] != a_sp[0]:
            errors.append(f'sidewrap#{n}: active subtab("{a_st[0]}")과 active subpanel("{a_sp[0]}")이 다름')

    # E5 — 중복 id
    for k, n in Counter(s.ids).items():
        if n > 1:
            errors.append(f'id "{k}" 중복 {n}회')

    # E6 — 플레이스홀더 잔존
    ph = sorted(set(re.findall(r'\{\{[A-Z0-9_]+\}\}', html)))
    if ph:
        errors.append(f'플레이스홀더 잔존 {len(ph)}종: ' + ', '.join(ph[:8]) + (' …' if len(ph) > 8 else ''))
    n_desc = html.count('[설명:')
    if n_desc:
        errors.append(f'"[설명: …]" 잔존 {n_desc}곳')

    # E7 — 외부 리소스
    for tag, url in s.externals:
        errors.append(f'외부 리소스 <{tag}> → {url} (단일 파일 원칙 위반 — 인라인으로)')

    # W1/W2
    if re.search(r'\bfetch\s*\(|XMLHttpRequest', js):
        warns.append('스크립트에 fetch()/XHR 사용 — file:// 에서 실패함(데이터는 인라인으로)')
    if not s.html_lang or s.html_lang.startswith('{{'):
        warns.append('<html lang> 미설정 — LANG 코드(ko/en/ja …)로 지정')
    if s.ext_links == 0:
        warns.append('외부 <a href> 링크 0개 — 출처가 평문 텍스트일 가능성. 출처 표·드로어 근거를 하이퍼링크로(§5)')

    for msg in errors:
        print(f'  ✗ {msg}')
    for msg in warns:
        print(f'  ⚠ {msg}')
    print(f'— 검사 완료: 오류 {len(errors)} · 경고 {len(warns)} '
          f'(탭 {len(s.tabs)} · 패널 {len(s.panels)} · ref {len(set(s.refs))} · sidewrap {len(s.sidewraps)})')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
