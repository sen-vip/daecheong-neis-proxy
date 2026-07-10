import {
  badRequest,
  fetchNeis,
  parseNeisError,
  requireNeisKey,
  requireProxyToken,
  safeText,
  setCors
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
  const schoolName = safeText(req.query.schoolName, 60);

  if (!officeCode) return badRequest(res, 'officeCode가 필요합니다.');
  if (!schoolName) return badRequest(res, 'schoolName이 필요합니다.');

  try {
    const json = await fetchNeis('schoolInfo', {
      KEY: key,
      Type: 'json',
      pIndex: 1,
      pSize: 20,
      ATPT_OFCDC_SC_CODE: officeCode,
      SCHUL_NM: schoolName
    });

    const neisError = parseNeisError(json, 'schoolInfo');
    if (neisError && !/자료가 존재하지 않습니다/.test(neisError)) {
      return res.status(502).json({ error: neisError });
    }

    const rows = json?.schoolInfo?.[1]?.row || [];
    const schools = rows.map((row) => ({
      officeCode: row.ATPT_OFCDC_SC_CODE || '',
      officeName: row.ATPT_OFCDC_SC_NM || '',
      schoolCode: row.SD_SCHUL_CODE || '',
      schoolName: row.SCHUL_NM || '',
      schoolKind: row.SCHUL_KND_SC_NM || '',
      address: row.ORG_RDNMA || row.ORG_RDNDA || ''
    }));

    return res.status(200).json({ ok: true, schools });
  } catch (error) {
    return res.status(502).json({
      error: '학교 검색에 실패했습니다.',
      detail: String(error?.message || '').slice(0, 220)
    });
  }
}
