# ZSFLIGHT_REPORT Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SFLIGHT 테이블을 Selection Screen 조건(항공사·항공편번호·출발일)으로 필터링하여 ALV Grid로 표시하는 ABAP 리포트 프로그램 `ZSFLIGHT_REPORT`를 생성한다.

**Architecture:** 단일 REPORT 프로그램. Selection Screen → SELECT → 빈 결과 guard → CL_SALV_TABLE factory/display 순서로 실행. TRY/CATCH가 factory와 display를 모두 감싼다.

**Tech Stack:** ABAP (Classic Report), CL_SALV_TABLE OO API, SAP NetWeaver AS ABAP (vhcalnplci:50000), vsp MCP (WriteSource / SyntaxCheck / Activate)

**Spec:** `docs/superpowers/specs/2026-05-22-zsflight-report-design.md`

---

### Task 1: 프로그램 소스 작성 및 저장

**Object:**
- Create: ABAP Program `ZSFLIGHT_REPORT` (package `$TMP`)

- [ ] **Step 1: WriteSource로 프로그램 소스 작성**

`mcp__abap__WriteSource` 호출:
- object_type: `PROG`
- object_name: `ZSFLIGHT_REPORT`
- package: `$TMP`

소스 내용:

```abap
REPORT zsflight_report.

*----------------------------------------------------------------------*
* Types
*----------------------------------------------------------------------*
TYPES: BEGIN OF ty_sflight,
         carrid     TYPE sflight-carrid,
         connid     TYPE sflight-connid,
         fldate     TYPE sflight-fldate,
         planetype  TYPE sflight-planetype,
         price      TYPE sflight-price,
         currency   TYPE sflight-currency,
         seatsmax   TYPE sflight-seatsmax,
         seatsocc   TYPE sflight-seatsocc,
         paymentsum TYPE sflight-paymentsum,
       END OF ty_sflight.

*----------------------------------------------------------------------*
* Data
*----------------------------------------------------------------------*
DATA: gt_sflight TYPE TABLE OF ty_sflight,
      go_alv     TYPE REF TO cl_salv_table,
      lo_cols    TYPE REF TO cl_salv_columns_table,
      lx_msg     TYPE REF TO cx_salv_msg.

*----------------------------------------------------------------------*
* Selection Screen
*----------------------------------------------------------------------*
SELECT-OPTIONS: so_carr FOR sflight-carrid,
                so_conn FOR sflight-connid,
                so_date FOR sflight-fldate.

*----------------------------------------------------------------------*
* Main
*----------------------------------------------------------------------*
START-OF-SELECTION.

  SELECT carrid connid fldate planetype price currency
         seatsmax seatsocc paymentsum
    FROM sflight
    INTO TABLE gt_sflight
    WHERE carrid IN so_carr
      AND connid IN so_conn
      AND fldate IN so_date.

  IF gt_sflight IS INITIAL.
    MESSAGE i001(00) WITH '조회된 데이터가 없습니다.'.
    RETURN.
  ENDIF.

  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = go_alv
        CHANGING  t_table      = gt_sflight ).

      " Column header settings
      lo_cols = go_alv->get_columns( ).
      lo_cols->get_column( 'CARRID'     )->set_short_text( '항공사'    ).
      lo_cols->get_column( 'CONNID'     )->set_short_text( '편번호'    ).
      lo_cols->get_column( 'FLDATE'     )->set_short_text( '출발일'    ).
      lo_cols->get_column( 'PLANETYPE'  )->set_short_text( '기종'      ).
      lo_cols->get_column( 'PRICE'      )->set_short_text( '운임'      ).
      lo_cols->get_column( 'CURRENCY'   )->set_short_text( '통화'      ).
      lo_cols->get_column( 'SEATSMAX'   )->set_short_text( '최대좌석'  ).
      lo_cols->get_column( 'SEATSOCC'   )->set_short_text( '예약좌석'  ).
      lo_cols->get_column( 'PAYMENTSUM' )->set_short_text( '총매출'    ).

      go_alv->display( ).

    CATCH cx_salv_msg INTO lx_msg.
      MESSAGE lx_msg->get_text( ) TYPE 'E'.
  ENDTRY.
```

- [ ] **Step 2: SyntaxCheck 실행**

`mcp__abap__SyntaxCheck` 호출:
- object_type: `PROG`
- object_name: `ZSFLIGHT_REPORT`

기대 결과: 오류 0건. 경고가 있으면 내용 확인 후 무시 가능 여부 판단.

- [ ] **Step 3: Activate 실행**

`mcp__abap__Activate` 호출:
- object_type: `PROG`
- object_name: `ZSFLIGHT_REPORT`

기대 결과: 활성화 성공.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: add ZSFLIGHT_REPORT ALV report program

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 동작 검증

- [ ] **Step 1: 전체 조회 테스트**

`mcp__abap__RunReport` 호출:
- program_name: `ZSFLIGHT_REPORT`
- 파라미터 없음 (전체 조회)

기대 결과: SFLIGHT 전체 데이터 반환 (50건 이상).

- [ ] **Step 2: 항공사 필터 테스트**

`mcp__abap__RunReport` 호출:
- SO_CARR: `LH`

기대 결과: CARRID = 'LH' 인 행만 반환.

- [ ] **Step 3: 날짜 범위 필터 테스트**

`mcp__abap__RunReport` 호출:
- SO_DATE: `20180101` ~ `20181231`

기대 결과: 2018년 출발 편만 반환.

- [ ] **Step 4: 빈 결과 테스트**

`mcp__abap__RunReport` 호출:
- SO_CARR: `XX` (존재하지 않는 항공사)

기대 결과: `'조회된 데이터가 없습니다.'` 메시지 출력, 오류 없음.

- [ ] **Step 5: ATCCheck 실행**

`mcp__abap__RunATCCheck` 호출:
- object_type: `PROG`
- object_name: `ZSFLIGHT_REPORT`

기대 결과: Critical/Error 0건. (Priority 2 이하 경고는 허용)

---

## 완료 기준

- [ ] SyntaxCheck 오류 0건
- [ ] Activate 성공
- [ ] 전체 조회 시 데이터 표시 확인
- [ ] 조건 필터 정상 동작 확인
- [ ] 빈 결과 메시지 정상 출력 확인
- [ ] ATCCheck Critical 0건
