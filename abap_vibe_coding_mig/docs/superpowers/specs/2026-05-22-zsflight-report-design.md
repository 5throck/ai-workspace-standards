# ZSFLIGHT_REPORT — Design Spec

**Date**: 2026-05-22  
**Status**: Approved  
**Author**: Mark Park (via Claude Code)

---

## Overview

SAP ABAP 클래식 리포트 프로그램으로, `SFLIGHT` 테이블을 조회하여 ALV Grid로 표시한다.  
항공사·항공편번호·이용일 조건으로 필터링하며, 핵심 9개 컬럼을 `CL_SALV_TABLE` OO API로 표현한다.

---

## Program Info

| 항목 | 값 |
|------|----|
| 프로그램명 | `ZSFLIGHT_REPORT` |
| 타입 | REPORT |
| 패키지 | `$TMP` |
| 대상 테이블 | `SFLIGHT` |

---

## Selection Screen

| 파라미터 | 타입 | 대상 필드 | 설명 |
|----------|------|-----------|------|
| `SO_CARR` | SELECT-OPTIONS | `SFLIGHT-CARRID` | 항공사 코드 |
| `SO_CONN` | SELECT-OPTIONS | `SFLIGHT-CONNID` | 항공편 번호 |
| `SO_DATE` | SELECT-OPTIONS | `SFLIGHT-FLDATE` | 출발일 범위 |

---

## Data Flow

```
[Selection Screen 입력]
        ↓
[SELECT FROM SFLIGHT WHERE 조건 적용]
        ↓
[Internal Table (ty_sflight) 적재]
        ↓
[CL_SALV_TABLE->factory()]
        ↓
[컬럼 헤더 설정 (get_columns)]
        ↓
[ALV->display()]
```

---

## Type Definition

```abap
TYPES: BEGIN OF ty_sflight,
         carrid    TYPE sflight-carrid,
         connid    TYPE sflight-connid,
         fldate    TYPE sflight-fldate,
         planetype TYPE sflight-planetype,
         price     TYPE sflight-price,
         currency  TYPE sflight-currency,
         seatsmax  TYPE sflight-seatsmax,
         seatsocc  TYPE sflight-seatsocc,
         paymentsum TYPE sflight-paymentsum,
       END OF ty_sflight.
```

---

## ALV Columns (9개)

| 필드 | 컬럼 헤더 |
|------|-----------|
| CARRID | 항공사 |
| CONNID | 항공편번호 |
| FLDATE | 출발일 |
| PLANETYPE | 기종 |
| PRICE | 운임 |
| CURRENCY | 통화 |
| SEATSMAX | 최대좌석 |
| SEATSOCC | 예약좌석 |
| PAYMENTSUM | 총매출 |

---

## Error Handling

1. **빈 결과 처리** — SELECT 후 내부 테이블이 비어있으면 즉시 `MESSAGE i001(00) WITH '조회된 데이터가 없습니다.'` 출력 후 `RETURN`. `CL_SALV_TABLE->factory()` 호출 전에 수행해야 함.

2. **ALV 예외 처리** — `TRY...CATCH cx_salv_msg` 블록이 `factory()` 호출과 `display()` 호출을 모두 감싸야 함. 두 메서드 모두 `cx_salv_msg`를 raise할 수 있음.

---

## Implementation Approach

- **방식**: 클래식 REPORT (방식 A)
- **ALV API**: `CL_SALV_TABLE` (OO 방식, 현대 ABAP 표준)
- Selection Screen 변수는 `LIKE` 레퍼런스 타입 사용
- 데이터 조회는 단일 `SELECT` 구문으로 처리

---

## Out of Scope

- Transport 요청 (로컬 오브젝트 $TMP)
- 합계/소계 행
- 드릴다운 네비게이션
- 엑셀 다운로드 커스터마이징 (ALV 기본 기능으로 충분)
