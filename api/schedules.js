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

function isNoDataMessage(message) {
  return /자료가 존재하지 않습니다|해당하는 데이터가 없습니다/i.test(
    String(message || '')
  );
}

function makeBaseParams(neisKey, officeCode, schoolCode) {
  return {
    KEY: neisKey,
    Type: 'json',
    pIndex: 1,
    pSize: 1000,
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
  };
}

async function fetchScheduleWithFallback({
  neisKey,
  officeCode,
  schoolCode,
  academicYear,
  from,
  to,
}) {
  const base = makeBaseParams(neisKey, officeCode, schoolCode);

  // NEIS 상태에 따라 특정 조합에서 HTTP 500이 발생할 수 있어
  // 가장 정확한 월 범위 조회부터 연간 학년도 조회까지 순차적으로 시도합니다.
  const strategies = [
    {
      mode: 'month-range-with-AY',
      params: {
        ...base,
        AY: academicYear,
        AA_FROM_YMD: from,
        AA_TO_YMD: to,
      },
    },
    {
      mode: 'academic-year-only',
      params: {
        ...base,
        AY: academicYear,
      },
    },
    {
      mode: 'month-range-no-AY',
      params: {
        ...base,
        AA_FROM_YMD: from,
        AA_TO_YMD: to,
      },
    },
  ];

  const attempts = [];

  for (const strategy of strategies) {
    try {
      const payload = await fetchNeis('SchoolSchedule', strategy.params);
      const neisError = parseNeisError(payload, 'SchoolSchedule');

      if (neisError && !isNoDataMessage(neisError)) {
        attempts.push({
          mode: strategy.mode,
          ok: false,
          error: String(neisError).slice(0, 160),
        });
        continue;
      }

      const rows = payload?.SchoolSchedule?.[1]?.row || [];
      attempts.push({
        mode: strategy.mode,
        ok: true,
        sourceCount: rows.length,
        noData: Boolean(neisError),
      });

      return {
        rows,
        requestMode: strategy.mode,
        attempts,
      };
    } catch (error) {
      attempts.push({
        mode: strategy.mode,
        ok: false,
        error: String(error?.message || error).slice(0, 160),
      });
    }
  }

  const finalError = new Error('모든 나이스 학사일정 조회 방식이 실패했습니다.');
  finalError.attempts = attempts;
  throw finalError;
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
    const result = await fetchScheduleWithFallback({
      neisKey,
      officeCode,
      schoolCode,
      academicYear,
      from,
      to,
    });

    const targetMonth = String(month).padStart(2, '0');

    const schedules = result.rows
      .map((row) => {
        const date = isoDate(row.AA_YMD);
        const eventName = String(row.EVENT_NM || '').trim();
        const compactName = eventName.replace(/\s+/g, '');

        if (
          !date ||
          date.slice(0, 4) !== String(year) ||
          date.slice(5, 7) !== targetMonth
        ) {
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
      version: '1.3.0',
      officeCode,
      schoolCode,
      year,
      month,
      requestMode: result.requestMode,
      requestAY: academicYear,
      requestFrom: from,
      requestTo: to,
      sourceCount: result.rows.length,
      count: schedules.length,
      schedules,
      attempts: result.attempts,
    });
  } catch (error) {
    console.error(error);

    return json({
      error: error?.name === 'AbortError'
        ? '나이스 API 응답 시간이 초과되었습니다.'
        : '나이스 학사일정 조회에 실패했습니다.',
      detail: String(error?.message || '').slice(0, 220),
      version: '1.3.0',
      requestMode: 'fallback-all-failed',
      requestAY: academicYear,
      requestFrom: from,
      requestTo: to,
      attempts: Array.isArray(error?.attempts) ? error.attempts : [],
    }, 502);
  }
}
