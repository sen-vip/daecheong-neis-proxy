# 대청중 NEIS Vercel 프록시 v1.3.0

## 이번 수정 내용

`학사 건너뜀`이 반복되는 두 가지 원인을 함께 보완했습니다.

1. **오류 응답 캐시 제거**
   - 기존에는 4xx/5xx 오류도 최대 6시간 CDN에 저장될 수 있었습니다.
   - 이제 오류 응답과 상태 확인 응답은 `no-store`로 처리합니다.
   - 성공 응답만 10분간 짧게 캐시합니다.

2. **NEIS 조회 방식 자동 대체**
   - 1차: 학년도 + 요청 월 날짜 범위
   - 2차: 학년도 전체 조회 후 요청 월 필터링
   - 3차: 요청 월 날짜 범위만 조회
   - 한 방식에서 NEIS HTTP 500이 발생해도 다음 방식으로 자동 재시도합니다.

3. **기존 Apps Script 호환 유지**
   - 기존 요청값 `officeCode`, `schoolCode`, `year`, `month`, `token`을 그대로 사용합니다.
   - 응답의 `schedules` 구조도 유지합니다.

## GitHub 교체

압축을 푼 뒤 저장소의 기존 파일을 모두 덮어쓰고 커밋합니다.

Vercel 배포가 완료되면 다음 주소를 새로 엽니다.

```text
https://daecheong-neis-proxy.vercel.app/api/health?check=130
```

정상 예시:

```json
{
  "ok": true,
  "version": "1.3.0",
  "hasNeisKey": true,
  "hasProxyToken": true,
  "cachePolicy": "errors-no-store; success-10m"
}
```

`version`이 1.3.0이 아니면 운영 도메인이 새 배포를 바라보지 않는 상태입니다.

그다음 Apps Script에서 `debugProxySchedule()`을 실행하고 시트의 `프록시점검` 탭을 확인합니다.
정상 응답은 코드 200이며 `requestMode`는 아래 셋 중 하나입니다.

```text
month-range-with-AY
academic-year-only
month-range-no-AY
```
