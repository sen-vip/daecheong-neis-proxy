import {
  json,
  optionsResponse,
} from './_utils.js';

export function OPTIONS() {
  return optionsResponse();
}

export function GET() {
  return json({
    ok: true,
    service: 'daecheong-neis-proxy',
    version: '1.3.0',
    hasNeisKey: Boolean(process.env.NEIS_API_KEY),
    hasProxyToken: Boolean(process.env.PROXY_TOKEN),
    cachePolicy: 'errors-no-store; success-10m',
  }, 200, {
    'Cache-Control': 'no-store, max-age=0',
    'Vercel-CDN-Cache-Control': 'no-store, max-age=0',
  });
}
