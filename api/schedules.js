import {
  digits,
  fetchNeis,
  gradeText,
  isoDate,
  json,
  optionsResponse,
  parseNeisError,
  validateProxyToken,
} from './_utils.js';

export function OPTIONS() {
  return optionsResponse();
}

function getAcademicYear(year, month) {
  // 한국 학교 학년도는 3월에 시작하므로 1~2월은 전년도 학년도에 속합니다.
  return month <= 2 ? year - 1 : year;
}

function getMonthRange(year, month) {
  const monthText = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${year}${monthText}01`,
    to: `${year}${monthText}${String(lastDay).padStart(2, '0')}`,
  };
}

export async function GET(request) {
  const auth = validateProxyToken(request);
  if (!auth.ok) {
    return json({ error: auth.message }, auth.status);
  }

  const neisKey = String(process.env.NEIS_API_KEY || '').trim();
  if (!neisKey) {
    return json(
      { error: 'NEIS_API_KEY 환경변수가 설정되지 않았습니다.' },
      500
    );
  }

  const url = new URL(request.url);
  const officeCode = String(
    url.searchParams.get('officeCode') || ''
  ).trim();
  const schoolCode = String(
    url.searchParams.get('schoolCode') || ''
  ).trim();
  const year = Number(digits(url.searchParams.get('year')));
  const month = Number(digits(url.searchParams.get('month')));

  if (!officeCode) {
    return json({ error: 'officeCode가 필요합니다.' }, 400);
  }
  if (!schoolCode) {
    return json({ error: 'schoolCode가 필요합니다.' }, 400);
  }
  if (!year || year < 2000 || year > 2100) {
    return json({ error: 'year가 올바르지 않습니다.' }, 400);
  }
  if (!month || month < 1 || month > 12) {
    return json({ error: 'month가 올바르지 않습니다.' }, 400);
  }

  const academicYear = getAcademicYear(year, month);
  const { from, to } = getMonthRange(year, month);

  try {
    // 연간 전체 조회 대신 요청한 한 달만 조회합니다.
    // AY를 함께 전달해 NEIS의 연간 범위 조회 HTTP 500 오류를 피합니다.
    const payload = await fetchNeis('SchoolSchedule', {
      KEY: neisKey,
      Type: 'json',
      pIndex: 1,
      pSize: 1000,
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      AY: academicYear,
      AA_FROM_YMD: from,
      AA_TO_YMD: to,
    });

    const neisError = parseNeisError(payload, 'SchoolSchedule');

    if (
      neisError &&
      !/자료가 존재하지 않습니다/.test(neisError)
    ) {
      return json({
        error: neisError,
        requestMode: 'month-range-with-AY',
        requestAY: academicYear,
      }, 502);
    }

    const rows = payload?.SchoolSchedule?.[1]?.row || [];
    const targetMonth = String(month).padStart(2, '0');

    const schedules = rows
      .map((row) => {
        const date = isoDate(row.AA_YMD);
        const eventName = String(row.EVENT_NM || '').trim();
        const compactName = eventName.replace(/\s+/g, '');

        // NEIS가 범위 밖 자료를 섞어 반환하는 경우를 대비해 한 번 더 월을 확인합니다.
        if (!date || date.slice(0, 4) !== String(year) || date.slice(5, 7) !== targetMonth) {
          return null;
        }

        if (!eventName || compactName.includes('토요휴업일')) {
          return null;
        }

        return {
          date,
          eventName,
          eventContent: String(row.EVENT_CNTNT || '').trim(),
          gradeText: gradeText(row),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));

    return json({
      ok: true,
      officeCode,
      schoolCode,
      year,
      month,
      requestMode: 'month-range-with-AY',
      requestAY: academicYear,
      requestFrom: from,
      requestTo: to,
      sourceCount: rows.length,
      count: schedules.length,
      schedules,
    });
  } catch (error) {
    console.error(error);

    return json({
      error: error?.name === 'AbortError'
        ? '나이스 API 응답 시간이 초과되었습니다.'
        : '나이스 학사일정 조회에 실패했습니다.',
      detail: String(error?.message || '').slice(0, 220),
      requestMode: 'month-range-with-AY',
      requestAY: academicYear,
      requestFrom: from,
      requestTo: to,
    }, 502);
  }
}
