# 대청중 NEIS Vercel 프록시 v1.2.0

## 이번 수정 내용

기존 v1.1.2는 `SchoolSchedule`을 다음 방식으로 조회했습니다.

- 한 해 전체 날짜 범위 조회
- `AY`(학년도) 미전달
- 응답 모드: `year-range-no-AY`

이 방식에서 NEIS 서버가 HTTP 500을 반환하고 프록시가 502로 응답하는 문제가 확인되어 다음과 같이 변경했습니다.

- 요청한 **한 달 범위만 조회**
- `AY`(학년도)를 반드시 전달
- 3~12월: `AY = 요청 연도`
- 1~2월: `AY = 요청 연도 - 1`
- 응답 모드: `month-range-with-AY`
- 기존 응답 구조와 `토요휴업일` 제외 기능 유지

예시:

- 2026년 7월 요청 → `AY=2026`, `20260701~20260731`
- 2026년 2월 요청 → `AY=2025`, `20260201~20260228`

## GitHub에 올리는 방법

이 ZIP의 압축을 푼 뒤 저장소 파일 전체를 기존 GitHub 저장소에 덮어쓰고 커밋합니다.

Vercel과 GitHub가 연결되어 있으면 커밋 후 자동 배포됩니다.

## 배포 확인

배포가 `Ready`가 되면 아래 주소를 엽니다.

```text
https://daecheong-neis-proxy.vercel.app/api/health
```

정상 응답 예시:

```json
{
  "ok": true,
  "service": "daecheong-neis-proxy",
  "version": "1.2.0",
  "hasNeisKey": true,
  "hasProxyToken": true
}
```

그다음 Apps Script의 학사일정 연동 또는 `debugProxySchedule()`을 다시 실행합니다.
Apps Script 코드는 변경할 필요가 없습니다.

정상이라면 프록시 응답 코드가 `200`이고 응답에 아래 값이 표시됩니다.

```text
requestMode: month-range-with-AY
```
