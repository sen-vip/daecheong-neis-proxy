import crypto from 'node:crypto';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
    'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  };
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export function getNeisKey() {
  return String(process.env.NEIS_API_KEY || '').trim();
}

export function validateProxyToken(request) {
  const configured = String(process.env.PROXY_TOKEN || '').trim();
  if (!configured) {
    return {
      ok: false,
      status: 500,
      message: 'PROXY_TOKEN 환경변수가 설정되지 않았습니다.',
    };
  }

  const url = new URL(request.url);
  const received = String(
    request.headers.get('x-proxy-token') ||
    url.searchParams.get('token') ||
    ''
  ).trim();

  const left = Buffer.from(configured);
  const right = Buffer.from(received);

  const valid =
    left.length === right.length &&
    crypto.timingSafeEqual(left, right);

  return valid
    ? { ok: true }
    : {
        ok: false,
        status: 401,
        message: '프록시 인증에 실패했습니다.',
      };
}

export function parseNeisError(payload, rootName) {
  const head = payload?.[rootName]?.[0]?.head;
  const result = Array.isArray(head)
    ? head.find((item) => item.RESULT)?.RESULT
    : null;

  if (result?.CODE && result.CODE !== 'INFO-000') {
    return result.MESSAGE || result.CODE;
  }

  if (payload?.RESULT?.CODE && payload.RESULT.CODE !== 'INFO-000') {
    return payload.RESULT.MESSAGE || payload.RESULT.CODE;
  }

  return '';
}

export async function fetchNeis(path, params) {
  const url = new URL(`https://open.neis.go.kr/hub/${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'daecheong-neis-proxy/1.1.1',
        },
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `NEIS HTTP ${response.status}: ${text.slice(0, 180)}`
        );
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error('나이스 응답이 JSON 형식이 아닙니다.');
      }
    } catch (error) {
      lastError = error;

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('나이스 API 호출에 실패했습니다.');
}

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function isoDate(value) {
  const raw = digits(value);
  if (raw.length !== 8) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function gradeText(row) {
  const grades = [
    ['ONE_GRADE_EVENT_YN', '1학년'],
    ['TW_GRADE_EVENT_YN', '2학년'],
    ['THREE_GRADE_EVENT_YN', '3학년'],
    ['FR_GRADE_EVENT_YN', '4학년'],
    ['FIV_GRADE_EVENT_YN', '5학년'],
    ['SIX_GRADE_EVENT_YN', '6학년'],
  ];

  return grades
    .filter(([key]) => String(row?.[key] || '').toUpperCase() === 'Y')
    .map(([, label]) => label)
    .join(', ');
}
