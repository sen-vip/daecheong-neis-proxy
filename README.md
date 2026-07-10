# 대청중 NEIS Vercel 프록시 v1.1.2

## 변경 사항

- `SchoolSchedule` 요청에서 `AY` 제거
- 기존 학돌 NEIS 백엔드와 동일하게 연간 날짜 범위로 조회
- 받은 연간 자료에서 요청한 월만 필터링
- `토요휴업일` 제외
- 응답에 `requestMode: year-range-no-AY` 표시

## GitHub 교체

아래 파일만 교체해도 됩니다.

```text
api/_utils.js
api/health.js
api/schedules.js
package.json
README.md
```

커밋 후 Vercel 배포가 `Ready`가 되면:

```text
https://daecheong-neis-proxy.vercel.app/api/health
```

에서 버전이 `1.1.2`인지 확인합니다.

그다음 Apps Script의 `debugProxySchedule()`을 다시 실행합니다.
Apps Script 코드는 변경할 필요가 없습니다.
