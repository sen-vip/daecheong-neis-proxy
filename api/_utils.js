import crypto from 'node:crypto';

export function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Token');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function requireNeisKey(res) {
  const key = String(process.env.NEIS_API_KEY || '').trim();
  if (!key) {
    res.status(500).json({ error: 'NEIS_API_KEY 환경변수가 설정되지 않았습니다.' });
    return '';
  }
  return key;
}

export function requireProxyToken(req, res) {
  const configured = String(process.env.PROXY_TOKEN || '').trim();
  if (!configured) {
    res.status(500).json({ error: 'PROXY_TOKEN 환경변수가 설정되지 않았습니다.' });
    return false;
  }

  const received = String(
    req.headers['x-proxy-token'] || req.query.token || ''
  ).trim();

  const left = Buffer.from(configured);
  const right = Buffer.from(received);
  const valid = left.length === right.length && crypto.timingSafeEqual(left, right);

  if (!valid) {
    res.status(401).json({ error: '프록시 인증에 실패했습니다.' });
    return false;
  }
  return true;
}

export function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

export function parseNeisError(json, rootName) {
  const head = json?.[rootName]?.[0]?.head;
  const result = Array.isArray(head)
    ? head.find((item) => item.RESULT)?.RESULT
    : null;

  if (result?.CODE && result.CODE !== 'INFO-000') {
    return result.MESSAGE || result.CODE;
  }

  if (json?.RESULT?.CODE && json.RESULT.CODE !== 'INFO-000') {
    return json.RESULT.MESSAGE || json.RESULT.CODE;
  }

  return '';
}

export async function fetchNeis(path, params, options = {}) {
  const url = new URL(`https://open.neis.go.kr/hub/${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const maxAttempts = Math.max(1, Math.min(2, Number(options.maxAttempts) || 2));
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'daecheong-neis-proxy/1.1'
        }
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`NEIS HTTP ${response.status}: ${text.slice(0, 180)}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error('나이스 응답이 JSON 형식이 아닙니다.');
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('나이스 API 호출에 실패했습니다.');
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function safeText(value, max = 80) {
  return String(value || '').trim().slice(0, max);
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function toIsoDate(yyyymmdd) {
  const raw = onlyDigits(yyyymmdd);
  if (raw.length !== 8) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function gradeText(row) {
  const checks = [
    ['ONE_GRADE_EVENT_YN', '1학년'],
    ['TW_GRADE_EVENT_YN', '2학년'],
    ['THREE_GRADE_EVENT_YN', '3학년'],
    ['FR_GRADE_EVENT_YN', '4학년'],
    ['FIV_GRADE_EVENT_YN', '5학년'],
    ['SIX_GRADE_EVENT_YN', '6학년']
  ];

  return checks
    .filter(([key]) => String(row?.[key] || '').toUpperCase() === 'Y')
    .map(([, label]) => label)
    .join(', ');
}
