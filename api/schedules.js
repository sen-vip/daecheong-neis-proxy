import {
  badRequest,
  fetchNeis,
  gradeText,
  onlyDigits,
  pad2,
  parseNeisError,
  requireNeisKey,
  requireProxyToken,
  safeText,
  setCors,
  toIsoDate
} from './_utils.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET만 지원합니다.' });
  }

  if (!requireProxyToken(req, res)) return;

  const key = requireNeisKey(res);
  if (!key) return;

  const officeCode = safeText(req.query.officeCode, 10);
  const schoolCode = safeText(req.query.schoolCode, 20);
  const year = Number(onlyDigits(req.query.year));
  const rawMonth = onlyDigits(req.query.month);
  const month = rawMonth ? Number(rawMonth) : 0;

  if (!officeCode) return badRequest(res, 'officeCode가 필요합니다.');
  if (!schoolCode) return badRequest(res, 'schoolCode가 필요합니다.');
  if (!year || year < 2000 || year > 2100) {
    return badRequest(res, 'year가 올바르지 않습니다.');
  }
  if (month && (month < 1 || month > 12)) {
    return badRequest(res, 'month가 올바르지 않습니다.');
  }

  let from;
  let to;

  if (month) {
    const monthText = pad2(month);
    const lastDay = new Date(year, month, 0).getDate();
    from = `${year}${monthText}01`;
    to = `${year}${monthText}${pad2(lastDay)}`;
  } else {
    from = `${year}0101`;
    to = `${year}1231`;
  }

  try {
    const json = await fetchNeis('SchoolSchedule', {
      KEY: key,
      Type: 'json',
      pIndex: 1,
      pSize: month ? 100 : 1000,
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      AY: String(year),
      AA_FROM_YMD: from,
      AA_TO_YMD: to
    });

    const neisError = parseNeisError(json, 'SchoolSchedule');
    if (neisError && !/자료가 존재하지 않습니다/.test(neisError)) {
      return res.status(502).json({ error: neisError });
    }

    const rows = json?.SchoolSchedule?.[1]?.row || [];

    const schedules = rows
      .map((row) => {
        const eventName = String(row.EVENT_NM || '').trim();
        const compactName = eventName.replace(/\s+/g, '');

        if (!eventName || compactName.includes('토요휴업일')) return null;

        return {
          date: toIsoDate(row.AA_YMD),
          ymd: String(row.AA_YMD || ''),
          eventName,
          eventContent: String(row.EVENT_CNTNT || '').trim(),
          gradeText: gradeText(row)
        };
      })
      .filter((item) => item && item.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      ok: true,
      officeCode,
      schoolCode,
      year,
      month: month || null,
      from,
      to,
      count: schedules.length,
      schedules
    });
  } catch (error) {
    console.error('SchoolSchedule proxy error', error);

    return res.status(502).json({
      error: error?.name === 'AbortError'
        ? '나이스 API 응답 시간이 초과되었습니다.'
        : '나이스 학사일정 조회에 실패했습니다.',
      detail: String(error?.message || '').slice(0, 220)
    });
  }
}
