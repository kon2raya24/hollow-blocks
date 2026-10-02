// The one serverless function: /api/hb?r=<route>. The routes live in _hb.mjs.
import { createApi, redis } from './_hb.mjs';

const api = createApi(redis(process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN), process.env.VERCEL_ENV === 'production' ? 'hb:' : 'hbdev:');

export default async function handler(req, res) {
  // the GitHub Pages copy calls across origins; a bearer token, never a cookie, so any origin is safe
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const auth = String(req.headers.authorization || '');
  try {
    const r = await api({
      route: String(req.query.r || ''), method: req.method, query: req.query,
      body: typeof req.body === 'string' ? JSON.parse(req.body || 'null') : req.body,
      token: auth.startsWith('Bearer ') ? auth.slice(7) : null,
      ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
    });
    res.status(r.status).json(r.json);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'May sira sa server. Subukan ulit.' });
  }
}
