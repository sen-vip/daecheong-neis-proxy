# 대청중 NEIS Vercel 프록시 v1.1.0

Apps Script 대신 Vercel이 나이스 학사일정을 조회합니다.

## Vercel 환경변수

| 이름 | 값 |
|---|---|
| `NEIS_API_KEY` | 나이스 교육정보 개방포털 인증키 |
| `PROXY_TOKEN` | 직접 정한 긴 임의 문자열 |

`PROXY_TOKEN`은 Apps Script의 `NEIS_PROXY_TOKEN`에도 같은 값으로 입력합니다.

## 배포

1. 이 폴더를 새 GitHub 저장소에 올립니다.
2. Vercel에서 `Add New → Project`로 가져옵니다.
3. Framework Preset은 `Other`로 둡니다.
4. 환경변수 두 개를 등록합니다.
5. 배포합니다.
6. 배포 주소 뒤에 `/api/health`를 붙여 확인합니다.

정상이라면 `hasNeisKey`, `hasProxyToken`이 모두 `true`입니다.

## 대관달력 호출 형태

```text
/api/schedules?officeCode=B10&schoolCode=7091426&year=2026&month=7
```

실제 API 키는 Vercel 환경변수에만 저장하고 GitHub에는 올리지 않습니다.
