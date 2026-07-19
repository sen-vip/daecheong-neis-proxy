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
    version: '1.2.0',
    hasNeisKey: Boolean(process.env.NEIS_API_KEY),
    hasProxyToken: Boolean(process.env.PROXY_TOKEN),
  });
}
