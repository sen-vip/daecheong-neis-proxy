import {
  digits,
  fetchNeis,
  gradeText,
  isoDate,
  json,
  optionsResponse,
  pad2,
  parseNeisError,
  validateProxyToken,
} from './_utils.js';

export function OPTIONS() {
  return optionsResponse();
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

  const monthText = pad2(month);
  const lastDay = new Date(year, month, 0).getDate();
  const from = `${year}${monthText}01`;
  const to = `${year}${monthText}${pad2(lastDay)}`;

  try {
    const payload = await fetchNeis('SchoolSchedule', {
      KEY: neisKey,
      Type: 'json',
      pIndex: 1,
      pSize: 100,
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      AY: String(year),
      AA_FROM_YMD: from,
      AA_TO_YMD: to,
    });

    const neisError = parseNeisError(payload, 'SchoolSchedule');

    if (
      neisError &&
      !/자료가 존재하지 않습니다/.test(neisError)
    ) {
      return json({ error: neisError }, 502);
    }

    const rows = payload?.SchoolSchedule?.[1]?.row || [];

    const schedules = rows
      .map((row) => {
        const eventName = String(row.EVENT_NM || '').trim();
        const compactName = eventName.replace(/\s+/g, '');

        if (!eventName || compactName.includes('토요휴업일')) {
          return null;
        }

        return {
          date: isoDate(row.AA_YMD),
          eventName,
          eventContent: String(row.EVENT_CNTNT || '').trim(),
          gradeText: gradeText(row),
        };
      })
      .filter((item) => item && item.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    return json({
      ok: true,
      officeCode,
      schoolCode,
      year,
      month,
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
    }, 502);
  }
}
