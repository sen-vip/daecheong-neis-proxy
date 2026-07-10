# 대청중 NEIS Vercel 프록시 v1.1.1

현재 Vercel Functions 형식에 맞춰 `GET` 메서드 export 방식으로 작성한 버전입니다.

## 교체

GitHub 저장소에서 기존 파일을 이 버전의 파일로 교체합니다.

- `api/_utils.js`
- `api/health.js`
- `api/schedules.js`
- `api/schools.js`
- `package.json`
- `index.html` 추가

커밋하면 Vercel이 자동 배포합니다.

## 확인

기본 주소:

```text
https://프로젝트명.vercel.app/
```

상태 확인:

```text
https://프로젝트명.vercel.app/api/health
```

정상 결과:

```json
{
  "ok": true,
  "service": "daecheong-neis-proxy",
  "version": "1.1.1",
  "hasNeisKey": true,
  "hasProxyToken": true
}
```
