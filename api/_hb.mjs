// The server: accounts, the cloud save and the leaderboards, kept in Upstash Redis (its REST API, no
// packages), so nothing is lost when a browser's storage is cleared. A score is never taken on trust:
// the client sends the game's replay and the server plays it through the same pure rules to get the
// score, the time and the board it belongs on.
//
// Against bots and abuse:
// - a new account costs a proof of work (src/pow.mjs) on a signed, single-use puzzle, and has a hidden
//   honeypot field; sign-ups are capped per address and in all;
// - logins are slowed per name, per address and per both, and an unknown name costs the same time as
//   a wrong password;
// - a replay is size-checked before it is unpacked, and must be the player's own: inputs with a
//   machine's even timing, or faster than a person can place pieces, or a copy of a game already on
//   the board under another name, are turned away;
// - every address has a request budget, and the boards are cheap and cached at the edge.
import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { fromBytes, startPlayback, playTick } from '../src/replay.mjs';
import { DIFFICULTY, hashState } from '../src/game.mjs';
import { dateKey, dailySeed, weeklyEvent } from '../src/progress.mjs';

const MAX_TICKS = 3 * 3600 * 60, MAX_CODE = 600_000, MAX_BYTES = 4_000_000; // three hours of play
const NAME = /^[A-Za-z0-9_.-]{3,16}$/, SAVE_MAX = 200_000, TOP = 50, SESSION_DAYS = 400;
export const POW_BITS = 19, POW_AGE = 10 * 60e3;
const COMMON = new Set(['12345678', '123456789', '1234567890', 'password', 'password1', 'qwertyui', 'qwerty123', '11111111', '00000000', 'iloveyou', 'abcdefgh', 'abcd1234', 'hollowblocks', 'tetris123', 'baseball', 'sunshine', 'princess', 'football', 'pilipinas', 'philippines', 'mahalkita', 'iloveyou1', 'asdfghjk', '87654321', '12341234', '88888888']);

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
export const BOARD = /^(?:(?:bahay|klasiko|karera|bagyo|deadline)\.(?:madali|katamtaman|mahirap)|daily\.\d{4}-\d\d-\d\d|lingguhan\.\d{4}-W\d\d)$/;
export const lowWins = (board) => board.startsWith('deadline.');
// The board a replay's game belongs on, or why it has none.
export function boardFor(head, now) {
  if (!head || head.vs || head.job || head.lesson || head.bonus) return { err: 'Walang talaan ang larong ito.' };
  if (!DIFFICULTY[head.diff]) return { err: 'Hindi kilalang hirap.' };
  if (['bahay', 'klasiko', 'karera', 'bagyo', 'deadline'].includes(head.mode)) return head.ev ? { err: 'Hindi tugma ang laro.' } : { board: `${head.mode}.${head.diff}` };
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

// A share code to a recording, never unpacking more than MAX_BYTES (a tiny code can't inflate into a
// huge one).
export function unpack(code) {
  const text = String(code ?? '');
  if (text.length < 2 || text.length > MAX_CODE || !/^[zb][A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const raw = Buffer.from(text.slice(1), 'base64url');
    const bytes = text[0] === 'z' ? inflateRawSync(raw, { maxOutputLength: MAX_BYTES }) : raw;
    return fromBytes(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length));
  } catch { return null; }
}

// How a person plays, from the inputs: the bot (and anything like it) presses on an even beat and
// starts each piece after the same wait; people don't. pieces: placed; pps: pieces a second;
// gapShare: how many of the gaps between presses are the most common one; latShare: the same for the
// wait between a piece locking and the next press.
export function profile(spawns, rec, ticks) {
  const press = [];
  for (let k = 0; k < rec.ev.length; k += 2) if (rec.ev[k + 1] < 8) press.push(rec.ev[k]);
  const lat = [];
  for (let s = 0, j = 0; s < spawns.length; s++) {
    while (j < press.length && press[j] <= spawns[s]) j++;
    if (j < press.length && (s + 1 >= spawns.length || press[j] <= spawns[s + 1])) lat.push(press[j] - spawns[s]);
  }
  const gaps = [];
  for (let k = 1; k < press.length; k++) if (press[k] > press[k - 1]) gaps.push(press[k] - press[k - 1]);
  const share = (a) => { const m = new Map(); let top = 0; for (const x of a) { const c = (m.get(x) || 0) + 1; m.set(x, c); top = Math.max(top, c); } return a.length ? top / a.length : 0; };
  return { pieces: spawns.length, pps: spawns.length / Math.max(1, ticks / 60), gapShare: share(gaps), latShare: share(lat), gaps: gaps.length, seconds: ticks / 60 };
}
export const MAX_PPS = 6;
export function robotic(p) {
  if (p.seconds >= 30 && p.pps > MAX_PPS) return 'Lampas sa bilis ng tao ang larong ito.';
  if (p.pieces >= 30 && p.gaps >= 60 && p.gapShare > 0.7 && p.latShare > 0.4) return 'Mukhang bot ang naglaro nito: masyadong pantay ang pindot.';
  return null;
}

// Play a replay through and read off its board and value.
export function verify(code, now) {
  const rec = unpack(code);
  if (!rec) return { err: 'Sira ang replay.' };
  if (!(rec.t > 0 && rec.t <= MAX_TICKS)) return { err: 'Masyadong mahaba ang replay.' };
  const b = boardFor(rec.head, now);
  if (b.err) return b;
  let g;
  const spawns = [];
  try {
    const pb = startPlayback(rec);
    g = pb.g;
    for (let last = 0; playTick(pb);) {
      if (g.pieces !== last) { spawns.push(pb.i - 1); last = g.pieces; }
      if (g.phase === 'over' || g.phase === 'done') break;
    }
  } catch { return { err: 'Hindi mapatakbo ang replay.' }; }
  if (g.phase !== 'over' && g.phase !== 'done') return { err: 'Hindi pa tapos ang laro.' };
  const bot = rec.head.auto ? null : robotic(profile(spawns, rec, g.elapsed)); // auto: handed to the bot with the Konami code, by the owner's choice
  if (bot) return { err: bot };
  const sig = createHash('sha256').update(`${rec.head.seed}|${hashState(g)}`).digest('hex').slice(0, 32);
  if (lowWins(b.board)) return g.phase === 'done' ? { board: b.board, value: g.elapsed, lines: g.lines, sig } : { err: 'Hindi natapos ang 40 hanay.' };
  return g.score > 0 ? { board: b.board, value: g.score, lines: g.lines, sig } : { err: 'Walang kita.' };
}

// ---------- accounts ----------
const hashPass = (pass, salt) => scryptSync(pass, salt, 32).toString('hex');
const sha = (s) => createHash('sha256').update(s).digest('hex');
function checkPass(pass, salt, hash) {
  const a = Buffer.from(hashPass(pass, salt), 'hex'), b = Buffer.from(hash || '', 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
const DUMMY_SALT = randomBytes(16).toString('hex');
export function passProblem(name, pass) {
  if (pass.length < 8 || pass.length > 72) return 'Password: 8 hanggang 72 na karakter.';
  const low = pass.toLowerCase();
  if (COMMON.has(low) || low.includes(name.toLowerCase()) || /^(.)\1+$/.test(pass)) return 'Masyadong madaling hulaan ang password na iyan.';
  return null;
}
// leading zero bits of a hex digest
function zeroBits(hex) { let n = 0; for (const c of hex) { const v = parseInt(c, 16); if (v === 0) { n += 4; continue; } return n + Math.clz32(v) - 28; } return n; }

// ---------- the API ----------
// One handler for every route: { route, method, body, query, token, ip } in, { status, json, cache }
// out. prefix: the keys' (production and previews keep apart); secret signs the sign-up puzzles.
const PLAY_MODES = ['bahay', 'klasiko', 'deadline', 'bagyo', 'karera', 'daily', 'lingguhan', 'proyekto', 'versus', 'tapatan', 'training'];
export function createApi(db, { prefix: P = 'hb:', secret = 'dev-only-secret', now = () => Date.now(), powBits = POW_BITS } = {}) {
  const k = (s) => `${P}${s}`;
  const out = (status, json, cache) => ({ status, json, cache });
  const busy = (msg = 'Masyadong marami. Subukan mamaya.') => out(429, { error: msg });
  const sign = (s) => createHmac('sha256', secret).update(s).digest('base64url').slice(0, 22);
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
    if (!token || token.length > 64) return null;
    const id = await db.cmd('GET', k(`sess:${sha(token)}`));
    if (!id) return null;
    const name = await db.cmd('HGET', k(`user:${id}`), 'name');
    return name ? { id, name } : null;
  }
  // a sign-up puzzle: "<time>.<nonce>.<signature>"
  async function powOk(pow) {
    const c = String(pow?.c || ''), n = String(pow?.n ?? '');
    const [t, nonce, s] = c.split('.');
    if (!t || !nonce || !s || !/^\d{1,12}$/.test(n) || sign(`${t}.${nonce}`) !== s) return false;
    if (!(now() - Number(t) < POW_AGE && Number(t) <= now() + 60e3)) return false;
    if (zeroBits(sha(`${c}:${n}`)) < powBits) return false;
    return !!(await db.cmd('SET', k(`pow:${nonce}`), 1, 'NX', 'EX', Math.ceil(POW_AGE / 1000) + 60)); // once only
  }
  const routes = {
    challenge() {
      const t = String(now()), nonce = randomBytes(9).toString('base64url');
      return out(200, { c: `${t}.${nonce}.${sign(`${t}.${nonce}`)}`, bits: powBits });
    },
    async register({ body, ip }) {
      const name = String(body?.name || '').trim(), pass = String(body?.pass || '');
      if (body?.website) return out(400, { error: 'Hindi nakapasok.' }); // the honeypot: only a bot fills it
      if (!NAME.test(name)) return out(400, { error: 'Pangalan: 3 hanggang 16 na letra, numero, _ . o -' });
      const bad = passProblem(name, pass);
      if (bad) return out(400, { error: bad });
      if (!(await powOk(body?.pow))) return out(400, { error: 'Hindi pumasa ang pagsusuri. I-refresh at subukan ulit.', pow: true });
      if (await limited(`reg:${ip}`, 5, 3600) || await limited('reg:all', 300, 3600)) return busy();
      const id = randomBytes(6).toString('hex');
      if (!(await db.cmd('SET', k(`name:${name.toLowerCase()}`), id, 'NX'))) return out(409, { error: 'May gumagamit na ng pangalang iyan.' });
      const salt = randomBytes(16).toString('hex');
      await db.pipe([['HSET', k(`user:${id}`), 'name', name, 'salt', salt, 'hash', hashPass(pass, salt), 't', now()], ['HSET', k('names'), id, name]]);
      return out(200, { token: await session(id), name });
    },
    async login({ body, ip }) {
      const name = String(body?.name || '').trim().slice(0, 32), pass = String(body?.pass || '').slice(0, 200), low = name.toLowerCase();
      if (await limited(`login:${ip}:${low}`, 10, 600) || await limited(`login:${ip}`, 40, 600) || await limited(`login:n:${low}`, 60, 3600)) return busy('Masyadong maraming subok. Maghintay muna.');
      const id = NAME.test(name) ? await db.cmd('GET', k(`name:${low}`)) : null;
      const [real, salt, hash] = id ? await db.cmd('HMGET', k(`user:${id}`), 'name', 'salt', 'hash') : [];
      const ok = checkPass(pass, salt || DUMMY_SALT, salt ? hash : ''); // the same work whether the name exists or not
      if (!id || !salt || !ok) return out(401, { error: 'Mali ang pangalan o password.' });
      return out(200, { token: await session(id), name: real });
    },
    async me({ token }) {
      const u = await who(token);
      return u ? out(200, { name: u.name }) : out(401, { error: 'Hindi naka-login.' });
    },
    async logout({ token }) {
      if (token && token.length <= 64) await db.cmd('DEL', k(`sess:${sha(token)}`));
      return out(200, { ok: true });
    },
    // the cloud save: the progress record; the one with more XP wins, since XP only grows
    async save({ method, body, token }) {
      const u = await who(token);
      if (!u) return out(401, { error: 'Hindi naka-login.' });
      if (method === 'POST' && await limited(`save:${u.id}`, 60, 600)) return busy();
      const raw = await db.cmd('GET', k(`save:${u.id}`)), have = raw ? JSON.parse(raw) : null;
      if (method === 'GET') return out(200, { data: have });
      const data = body?.data, text = JSON.stringify(data ?? null);
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isFinite(data.xp)) return out(400, { error: 'Walang laman ang save.' });
      if (text.length > SAVE_MAX) return out(413, { error: 'Masyadong malaki ang save.' });
      if (have && have.xp > data.xp) return out(409, { data: have });
      await db.cmd('SET', k(`save:${u.id}`), text);
      return out(200, { ok: true });
    },
    // a finished game's replay: checked, then ranked if it beats the player's best
    async score({ body, token }) {
      const u = await who(token);
      if (!u) return out(401, { error: 'Hindi naka-login.' });
      if (await limited(`score:${u.id}`, 30, 600)) return busy();
      const v = verify(body?.code, now());
      if (v.err) return out(422, { error: v.err });
      const low = lowWins(v.board), zk = k(`lb:${v.board}`), rk = k(`rp:${v.board}`), sk = k(`seen:${v.board}`);
      // one game, one player: a copied replay is someone else's game
      const [fresh, owner] = await db.pipe([['HSETNX', sk, v.sig, u.id], ['HGET', sk, v.sig]]);
      if (!fresh && owner !== u.id) return out(422, { error: 'Kopya ito ng laro ng iba.' });
      const prev = await db.cmd('ZSCORE', zk, u.id);
      const better = prev === null || (low ? v.value < Number(prev) : v.value > Number(prev));
      const cmds = better ? [['ZADD', zk, v.value, u.id], ['HSET', rk, u.id, String(body.code)]] : [];
      if (!/^(bahay|klasiko|karera|bagyo|deadline)\./.test(v.board)) cmds.push(['EXPIRE', zk, 60 * 86400], ['EXPIRE', rk, 60 * 86400], ['EXPIRE', sk, 60 * 86400]);
      await db.pipe(cmds);
      const [rank, n] = await db.pipe([[low ? 'ZRANK' : 'ZREVRANK', zk, u.id], ['ZCARD', zk]]);
      return out(200, { board: v.board, value: v.value, best: better ? v.value : Number(prev), improved: better, rank: rank + 1, of: n });
    },
    // the top of a board, with names: the same for everyone, so the edge caches it
    async board({ query }) {
      const b = String(query.b), low = lowWins(b), zk = k(`lb:${b}`);
      const [flat, n] = await db.pipe([['ZRANGE', zk, 0, TOP - 1, ...(low ? [] : ['REV']), 'WITHSCORES'], ['ZCARD', zk]]);
      const ids = []; for (let i = 0; i < flat.length; i += 2) ids.push([flat[i], Number(flat[i + 1])]);
      const names = ids.length ? await db.cmd('HMGET', k('names'), ...ids.map(([id]) => id)) : [];
      return out(200, { board: b, low, top: ids.map(([id, value], i) => ({ id, name: names[i] || '?', value })), n }, 'public, max-age=0, s-maxage=15, stale-while-revalidate=60');
    },
    // the asking player's place on a board
    async rank({ query, token }) {
      const u = await who(token);
      if (!u) return out(401, { error: 'Hindi naka-login.' });
      const b = String(query.b), zk = k(`lb:${b}`);
      const [rank, val] = await db.pipe([[lowWins(b) ? 'ZRANK' : 'ZREVRANK', zk, u.id], ['ZSCORE', zk, u.id]]);
      return out(200, { name: u.name, rank: rank === null ? null : rank + 1, value: val === null ? null : Number(val) });
    },
    // how the game is played: one count a game, by Manila day, mode and language; nothing about the player
    async play({ body, ip }) {
      const mode = String(body?.mode || ''), lang = String(body?.lang || '');
      if (!PLAY_MODES.includes(mode) || !['en', 'fil'].includes(lang)) return out(400, { error: 'Hindi tugma ang laro.' });
      if (await limited(`play:${ip}`, 60, 3600)) return busy();
      const key = k(`stat:${dateKey(now())}:${mode}:${lang}`);
      if (await db.cmd('INCR', key) === 1) await db.cmd('EXPIRE', key, 400 * 86400);
      return out(200, { ok: true });
    },
    // a ranked player's best game, to watch
    async replay({ query }) {
      const code = await db.cmd('HGET', k(`rp:${query.b}`), String(query.u));
      return code ? out(200, { code }, 'public, max-age=0, s-maxage=300') : out(404, { error: 'Walang replay.' });
    },
  };
  // each route: its method, and the query it may carry (nothing else, so the edge cache can't be dodged)
  const ROUTES = {
    challenge: ['GET', []], register: ['POST', []], login: ['POST', []], logout: ['POST', []], me: ['GET', []],
    save: ['GET POST', []], score: ['POST', []], play: ['POST', []], board: ['GET', ['b']], rank: ['GET', ['b']], replay: ['GET', ['b', 'u']],
  };
  return async function api(req) {
    const spec = ROUTES[req.route], q = req.query || {};
    if (!spec || !spec[0].split(' ').includes(req.method)) return out(404, { error: 'Walang ganyan.' });
    if (Object.keys(q).some((x) => x !== 'r' && !spec[1].includes(x))) return out(400, { error: 'Hindi kilalang tanong.' });
    if (spec[1].includes('b') && !BOARD.test(String(q.b || ''))) return out(400, { error: 'Walang ganyang talaan.' });
    if (spec[1].includes('u') && !/^[0-9a-f]{12}$/.test(String(q.u || ''))) return out(400, { error: 'Walang ganyang replay.' });
    if (await limited(`ip:${req.ip}`, 240, 60)) return busy();
    return routes[req.route](req);
  };
}
