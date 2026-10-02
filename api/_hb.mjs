// The server: accounts, the cloud save and the leaderboards, kept in Upstash Redis (its REST API, no
// packages), so nothing is lost when a browser's storage is cleared. A score is never taken on trust:
// the client sends the game's replay and the server plays it through the same pure rules to get the
// score, the time and the board it belongs on.
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { decode, runToEnd } from '../src/replay.mjs';
import { DIFFICULTY } from '../src/game.mjs';
import { dateKey, dailySeed, weeklyEvent } from '../src/progress.mjs';

const MAX_TICKS = 3 * 3600 * 60; // a replay longer than three hours isn't checked
const NAME = /^[A-Za-z0-9_.-]{3,16}$/, SAVE_MAX = 200_000, TOP = 50, SESSION_DAYS = 400;

// ---------- the database: a command, or a pipeline of them ----------
export function redis(url, token) {
  const call = async (path, body) => {
    const r = await fetch(url + path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || `redis ${r.status}`);
    return j;
  };
  return {
    cmd: async (...a) => (await call('', a)).result,
    pipe: async (cmds) => (cmds.length ? (await call('/pipeline', cmds)).map((x) => { if (x.error) throw new Error(x.error); return x.result; }) : []),
  };
}

// ---------- the boards ----------
// bahay, karera and bagyo rank kita, deadline ranks the time to 40 lines (less is better); each by
// difficulty. The Daily ranks by date and the weekly event by week, both always Katamtaman.
export const BOARD = /^(?:(?:bahay|karera|bagyo|deadline)\.(?:madali|katamtaman|mahirap)|daily\.\d{4}-\d\d-\d\d|lingguhan\.\d{4}-W\d\d)$/;
export const lowWins = (board) => board.startsWith('deadline.');
// The board a replay's game belongs on, or why it has none.
export function boardFor(head, now) {
  if (!head || head.vs || head.job || head.lesson) return { err: 'Walang talaan ang larong ito.' };
  if (!DIFFICULTY[head.diff]) return { err: 'Hindi kilalang hirap.' };
  if (['bahay', 'karera', 'bagyo', 'deadline'].includes(head.mode)) return head.ev ? { err: 'Hindi tugma ang laro.' } : { board: `${head.mode}.${head.diff}` };
  if (head.diff !== 'katamtaman' || head.ts) return { err: 'Hindi tugma ang laro.' };
  if (head.mode === 'daily') {
    // today's Daily, or yesterday's if it ended just after midnight
    const day = [now, now - 2 * 3600e3].map((t) => dateKey(t)).find((d) => dailySeed(d) === head.seed);
    return day ? { board: `daily.${day}` } : { err: 'Lumang Daily na ito.' };
  }
  if (head.mode === 'lingguhan') {
    const w = [now, now - 2 * 3600e3].map((t) => weeklyEvent(t)).find((e) => e.id === head.ev && dailySeed(e.week) === head.seed);
    return w ? { board: `lingguhan.${w.week}` } : { err: 'Lumang lingguhan na ito.' };
  }
  return { err: 'Walang talaan ang larong ito.' };
}
// Play a replay through and read off its board and value.
export async function verify(code, now) {
  let rec;
  try { rec = await decode(String(code)); } catch { return { err: 'Sira ang replay.' }; }
  if (!(rec.t > 0 && rec.t <= MAX_TICKS)) return { err: 'Masyadong mahaba ang replay.' };
  const b = boardFor(rec.head, now);
  if (b.err) return b;
  let g;
  try { g = runToEnd(rec); } catch { return { err: 'Hindi mapatakbo ang replay.' }; }
  if (g.phase !== 'over' && g.phase !== 'done') return { err: 'Hindi pa tapos ang laro.' };
  if (lowWins(b.board)) return g.phase === 'done' ? { board: b.board, value: g.elapsed, lines: g.lines } : { err: 'Hindi natapos ang 40 hanay.' };
  return g.score > 0 ? { board: b.board, value: g.score, lines: g.lines } : { err: 'Walang kita.' };
}

// ---------- accounts ----------
const hashPass = (pass, salt) => scryptSync(pass, salt, 32).toString('hex');
const sha = (s) => createHash('sha256').update(s).digest('hex');
function checkPass(pass, salt, hash) {
  const a = Buffer.from(hashPass(pass, salt), 'hex'), b = Buffer.from(hash || '', 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- the API ----------
// One handler for every route: { route, method, body, query, token, ip } in, { status, json } out.
// P is the key prefix (production and previews keep apart).
export function createApi(db, P = 'hb:') {
  const k = (s) => `${P}${s}`;
  const out = (status, json) => ({ status, json });
  // at most n calls a window (seconds) for a key
  async function limited(key, n, window) {
    const c = await db.cmd('INCR', k(`rl:${key}`));
    if (c === 1) await db.cmd('EXPIRE', k(`rl:${key}`), window);
    return c > n;
  }
  async function session(id) {
    const token = randomBytes(24).toString('base64url');
    await db.cmd('SET', k(`sess:${sha(token)}`), id, 'EX', SESSION_DAYS * 86400);
    return token;
  }
  async function who(token) {
    if (!token) return null;
    const id = await db.cmd('GET', k(`sess:${sha(token)}`));
    if (!id) return null;
    const name = await db.cmd('HGET', k(`user:${id}`), 'name');
    return name ? { id, name } : null;
  }
  const routes = {
    async register({ body, ip }) {
      const name = String(body?.name || '').trim(), pass = String(body?.pass || '');
      if (!NAME.test(name)) return out(400, { error: 'Pangalan: 3 hanggang 16 na letra, numero, _ . o -' });
      if (pass.length < 6 || pass.length > 72) return out(400, { error: 'Password: 6 hanggang 72 na karakter.' });
      if (await limited(`reg:${ip}`, 10, 3600)) return out(429, { error: 'Masyadong marami. Subukan mamaya.' });
      const id = randomBytes(6).toString('hex');
      if (!(await db.cmd('SET', k(`name:${name.toLowerCase()}`), id, 'NX'))) return out(409, { error: 'May gumagamit na ng pangalang iyan.' });
      const salt = randomBytes(16).toString('hex');
      await db.cmd('HSET', k(`user:${id}`), 'name', name, 'salt', salt, 'hash', hashPass(pass, salt), 't', Date.now());
      return out(200, { token: await session(id), name });
    },
    async login({ body, ip }) {
      const name = String(body?.name || '').trim(), pass = String(body?.pass || '');
      if (await limited(`login:${ip}:${name.toLowerCase()}`, 10, 600)) return out(429, { error: 'Masyadong maraming subok. Maghintay nang sampung minuto.' });
      const id = NAME.test(name) ? await db.cmd('GET', k(`name:${name.toLowerCase()}`)) : null;
      const [real, salt, hash] = id ? await db.cmd('HMGET', k(`user:${id}`), 'name', 'salt', 'hash') : [];
      if (!id || !salt || !checkPass(pass, salt, hash)) return out(401, { error: 'Mali ang pangalan o password.' });
      return out(200, { token: await session(id), name: real });
    },
    async me({ token }) {
      const u = await who(token);
      return u ? out(200, { name: u.name }) : out(401, { error: 'Hindi naka-login.' });
    },
    async logout({ token }) {
      if (token) await db.cmd('DEL', k(`sess:${sha(token)}`));
      return out(200, { ok: true });
    },
    // the cloud save: the progress record; the one with more XP wins, since XP only grows
    async save({ method, body, token }) {
      const u = await who(token);
      if (!u) return out(401, { error: 'Hindi naka-login.' });
      const raw = await db.cmd('GET', k(`save:${u.id}`)), have = raw ? JSON.parse(raw) : null;
      if (method === 'GET') return out(200, { data: have });
      const data = body?.data, text = JSON.stringify(data ?? null);
      if (!data || typeof data !== 'object' || !Number.isFinite(data.xp)) return out(400, { error: 'Walang laman ang save.' });
      if (text.length > SAVE_MAX) return out(413, { error: 'Masyadong malaki ang save.' });
      if (have && have.xp > data.xp) return out(409, { data: have });
      await db.cmd('SET', k(`save:${u.id}`), text);
      return out(200, { ok: true });
    },
    // a finished game's replay: checked, then ranked if it beats the player's best
    async score({ body, token }) {
      const u = await who(token);
      if (!u) return out(401, { error: 'Hindi naka-login.' });
      if (await limited(`score:${u.id}`, 30, 600)) return out(429, { error: 'Masyadong marami. Subukan mamaya.' });
      const v = await verify(body?.code, Date.now());
      if (v.err) return out(422, { error: v.err });
      const low = lowWins(v.board), zk = k(`lb:${v.board}`), rk = k(`rp:${v.board}`);
      const prev = await db.cmd('ZSCORE', zk, u.id);
      const better = prev === null || (low ? v.value < Number(prev) : v.value > Number(prev));
      if (better) {
        const cmds = [['ZADD', zk, v.value, u.id], ['HSET', rk, u.id, String(body.code)]];
        if (!/^(bahay|karera|bagyo|deadline)\./.test(v.board)) cmds.push(['EXPIRE', zk, 60 * 86400], ['EXPIRE', rk, 60 * 86400]);
        await db.pipe(cmds);
      }
      const [rank, n] = await db.pipe([[low ? 'ZRANK' : 'ZREVRANK', zk, u.id], ['ZCARD', zk]]);
      return out(200, { board: v.board, value: v.value, best: better ? v.value : Number(prev), improved: better, rank: rank + 1, of: n });
    },
    // the top of a board, with names, and the asking player's place
    async board({ query, token }) {
      const b = String(query.b || '');
      if (!BOARD.test(b)) return out(400, { error: 'Walang ganyang talaan.' });
      const low = lowWins(b), zk = k(`lb:${b}`);
      const flat = await db.cmd('ZRANGE', zk, 0, TOP - 1, ...(low ? [] : ['REV']), 'WITHSCORES');
      const ids = []; for (let i = 0; i < flat.length; i += 2) ids.push([flat[i], Number(flat[i + 1])]);
      const names = await db.pipe(ids.map(([id]) => ['HGET', k(`user:${id}`), 'name']));
      const u = await who(token);
      let me = null;
      if (u) {
        const [rank, val] = await db.pipe([[low ? 'ZRANK' : 'ZREVRANK', zk, u.id], ['ZSCORE', zk, u.id]]);
        me = { name: u.name, rank: rank === null ? null : rank + 1, value: val === null ? null : Number(val) };
      }
      return out(200, { board: b, low, top: ids.map(([id, value], i) => ({ id, name: names[i] || '?', value })), me, n: await db.cmd('ZCARD', zk) });
    },
    // a ranked player's best game, to watch
    async replay({ query }) {
      const b = String(query.b || ''), id = String(query.u || '');
      if (!BOARD.test(b) || !/^[0-9a-f]{12}$/.test(id)) return out(400, { error: 'Walang ganyang replay.' });
      const code = await db.cmd('HGET', k(`rp:${b}`), id);
      return code ? out(200, { code }) : out(404, { error: 'Walang replay.' });
    },
  };
  const METHODS = { register: 'POST', login: 'POST', logout: 'POST', score: 'POST', me: 'GET', board: 'GET', replay: 'GET', save: 'GET POST' };
  return async function api(req) {
    const r = routes[req.route];
    if (!r || !METHODS[req.route].includes(req.method)) return out(404, { error: 'Walang ganyan.' });
    return r(req);
  };
}
