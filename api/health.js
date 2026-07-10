import { setCors } from './_utils.js';

export default function handler(req, res) {
  if (setCors(req, res)) return;

  return res.status(200).json({
    ok: true,
    service: 'daecheong-neis-proxy',
    version: '1.1.0',
    hasNeisKey: Boolean(process.env.NEIS_API_KEY),
    hasProxyToken: Boolean(process.env.PROXY_TOKEN)
  });
}
