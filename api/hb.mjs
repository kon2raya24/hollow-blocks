// The one serverless function: /api/hb?r=<route>. The routes live in _hb.mjs.
import { createHash } from 'node:crypto';
import { createApi, redis } from './_hb.mjs';

const { KV_REST_API_URL, KV_REST_API_TOKEN, HB_SECRET, VERCEL_ENV } = process.env;
const secret = HB_SECRET || createHash('sha256').update(`hb-pow:${KV_REST_API_TOKEN}`).digest('hex'); // HB_SECRET is set on Vercel
const api = createApi(redis(KV_REST_API_URL, KV_REST_API_TOKEN), { prefix: VERCEL_ENV === 'production' ? 'hb:' : 'hbdev:', secret });

export default async function handler(req, res) {
  // the GitHub Pages copy calls across origins; a bearer token, never a cookie, so any origin is safe
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const auth = String(req.headers.authorization || '');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || 'null'); } catch { return res.status(400).json({ error: 'Sirang kahilingan.' }); } }
  try {
    const r = await api({
      route: String(req.query.r || ''), method: req.method, query: req.query, body,
      token: auth.startsWith('Bearer ') ? auth.slice(7) : null,
      ip: String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
    });
    res.setHeader('Cache-Control', r.status === 200 && r.cache ? r.cache : 'no-store');
    res.status(r.status).json(r.json);
  } catch (e) {
    console.error(e);
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ error: 'May sira sa server. Subukan ulit.' });
  }
}
