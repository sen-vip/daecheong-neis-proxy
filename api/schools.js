import {
  fetchNeis,
  json,
  optionsResponse,
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
  const schoolName = String(
    url.searchParams.get('schoolName') || ''
  ).trim();

  if (!officeCode) {
    return json({ error: 'officeCode가 필요합니다.' }, 400);
  }
  if (!schoolName) {
    return json({ error: 'schoolName이 필요합니다.' }, 400);
  }

  try {
    const payload = await fetchNeis('schoolInfo', {
      KEY: neisKey,
      Type: 'json',
      pIndex: 1,
      pSize: 20,
      ATPT_OFCDC_SC_CODE: officeCode,
      SCHUL_NM: schoolName,
    });

    const neisError = parseNeisError(payload, 'schoolInfo');

    if (
      neisError &&
      !/자료가 존재하지 않습니다/.test(neisError)
    ) {
      return json({ error: neisError }, 502);
    }

    const rows = payload?.schoolInfo?.[1]?.row || [];

    const schools = rows.map((row) => ({
      officeCode: row.ATPT_OFCDC_SC_CODE || '',
      officeName: row.ATPT_OFCDC_SC_NM || '',
      schoolCode: row.SD_SCHUL_CODE || '',
      schoolName: row.SCHUL_NM || '',
      schoolKind: row.SCHUL_KND_SC_NM || '',
      address: row.ORG_RDNMA || row.ORG_RDNDA || '',
    }));

    return json({ ok: true, schools });
  } catch (error) {
    return json({
      error: '학교 검색에 실패했습니다.',
      detail: String(error?.message || '').slice(0, 220),
    }, 502);
  }
}
