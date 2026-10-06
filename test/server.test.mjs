// The server: accounts, the cloud save, and leaderboards that rank only what a replay proves, with the
// guards against bots and abuse. Redis is played by a small in-memory stand-in that answers the way
// Upstash's REST API does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { step } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, encode, gameFor, runToEnd } from '../src/replay.mjs';
import { dateKey, dailySeed, weeklyEvent, toolsetFor } from '../src/progress.mjs';
import { sha256, meets, solve } from '../src/pow.mjs';
import { createApi, boardFor, verify, unpack, profile, robotic, passProblem } from '../api/_hb.mjs';

function fakeRedis() {
  const kv = new Map();
  const m = (key) => { if (!kv.has(key)) kv.set(key, new Map()); return kv.get(key); };
  const sorted = (key) => [...(kv.get(key) || new Map())].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const C = {
    GET: (key) => kv.get(key) ?? null,
    SET: (key, v, ...o) => { if (o.includes('NX') && kv.has(key)) return null; kv.set(key, String(v)); return 'OK'; },
    DEL: (...keys) => keys.filter((key) => kv.delete(key)).length,
    INCR: (key) => { const n = Number(kv.get(key) || 0) + 1; kv.set(key, String(n)); return n; },
    EXPIRE: () => 1,
    HSET: (key, ...fv) => { const h = m(key); for (let i = 0; i < fv.length; i += 2) h.set(fv[i], String(fv[i + 1])); return fv.length / 2; },
    HSETNX: (key, f, v) => { const h = m(key); if (h.has(f)) return 0; h.set(f, String(v)); return 1; },
    HGET: (key, f) => kv.get(key)?.get(f) ?? null,
    HMGET: (key, ...fs) => fs.map((f) => kv.get(key)?.get(f) ?? null),
    ZADD: (key, s, mem) => { m(key).set(mem, Number(s)); return 1; },
    ZSCORE: (key, mem) => (kv.get(key)?.has(mem) ? String(kv.get(key).get(mem)) : null),
    ZRANK: (key, mem) => { const i = sorted(key).findIndex(([x]) => x === mem); return i < 0 ? null : i; },
    ZREVRANK: (key, mem) => { const i = sorted(key).reverse().findIndex(([x]) => x === mem); return i < 0 ? null : i; },
    ZCARD: (key) => kv.get(key)?.size || 0,
    ZRANGE: (key, a, b, ...o) => { let s = sorted(key); if (o.includes('REV')) s = s.reverse(); return s.slice(a, b + 1).flatMap(([x, v]) => [x, String(v)]); },
  };
  const run = ([c, ...a]) => C[c](...a);
  return { kv, cmd: async (...a) => run(a), pipe: async (cmds) => cmds.map(run) };
}

const BITS = 8; // an easy puzzle keeps the tests quick; the live one is POW_BITS
const newApi = (more = {}) => createApi(fakeRedis(), { powBits: BITS, ...more });
let ipN = 0;
const ask = (api, route, more = {}) => api({ route, method: 'GET', query: {}, ip: '1.2.3.4', token: null, ...more });
const post = (api, route, body, token = null, ip = '1.2.3.4') => ask(api, route, { method: 'POST', body, token, ip });
async function pow(api) { const c = (await ask(api, 'challenge')).json; return { c: c.c, n: await solve(c.c, c.bits) }; }
// a new account (each from its own address, as different people are)
async function join(api, name, pass = 'bayanihan-24') {
  const r = await post(api, 'register', { name, pass, pow: await pow(api) }, null, `10.0.0.${++ipN}`);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.token;
}

// a person at the keys: a think time for each piece, uneven taps
const rnd = (s) => () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
function person(seed, think = 10) {
  const r = rnd(seed); let wait = 0, last = -1;
  return (g) => {
    if (g.phase !== 'play' || !g.cur) return { pressed: [], held: [] };
    if (g.pieces !== last) { last = g.pieces; wait = Math.round(think * Math.exp((r() * 2 - 1) * 0.9)); }
    if (wait-- > 0) return { pressed: [], held: [] };
    wait = 2 + Math.floor(r() * 7);
    return bot(g, { pace: 0 });
  };
}
function played(head, input, limit = 60 * 400) {
  const g = gameFor(head), rec = createRecorder(head);
  let n = 0;
  while (g.phase !== 'over' && g.phase !== 'done' && n++ < limit) step(g, input(g), 1 / 60, (inp) => record(rec, inp));
  return { g, rec };
}

test('an account: register, log in again from a fresh browser, names are one per person, log out', async () => {
  const api = newApi();
  const r = await post(api, 'register', { name: 'Juan_dela.Cruz', pass: 'kawayan-24', pow: await pow(api) });
  assert.equal(r.status, 200); assert.ok(r.json.token.length > 20);
  assert.equal((await ask(api, 'me', { token: r.json.token })).json.name, 'Juan_dela.Cruz');
  assert.equal((await post(api, 'register', { name: 'juan_DELA.cruz', pass: 'iba-pa-ito', pow: await pow(api) })).status, 409, 'names ignore case');
  assert.equal((await post(api, 'register', { name: 'ab', pass: 'kawayan-24', pow: await pow(api) })).status, 400);
  assert.equal((await post(api, 'login', { name: 'juan_dela.cruz', pass: 'mali' })).status, 401);
  const again = await post(api, 'login', { name: 'juan_dela.cruz', pass: 'kawayan-24' });
  assert.equal(again.status, 200); assert.equal(again.json.name, 'Juan_dela.Cruz');
  assert.notEqual(again.json.token, r.json.token);
  await post(api, 'logout', {}, r.json.token);
  assert.equal((await ask(api, 'me', { token: r.json.token })).status, 401);
  assert.equal((await ask(api, 'me', { token: again.json.token })).status, 200, 'other sessions stay');
  assert.equal((await ask(api, 'register', { method: 'GET' })).status, 404, 'the wrong method');
  assert.equal((await post(api, 'login', { name: 'nobody_here', pass: 'whatever-1' })).status, 401, 'an unknown name reads the same as a wrong password');
});

test('passwords: eight or more, and not a common one or the name', () => {
  assert.ok(passProblem('Ana', 'short1'));
  assert.ok(passProblem('Ana', '12345678'));
  assert.ok(passProblem('Ana', 'PASSWORD'));
  assert.ok(passProblem('Kokak', 'kokak2026'), 'the name inside');
  assert.ok(passProblem('Ana', 'zzzzzzzzzz'));
  assert.equal(passProblem('Ana', 'bahay-kubo-7'), null);
});

test('a new account costs a proof of work: signed, fresh, solved, and used once', async () => {
  const api = newApi();
  const body = (p, name = 'Pedro') => ({ name, pass: 'bayanihan-24', pow: p });
  assert.equal((await post(api, 'register', body(undefined))).status, 400, 'none');
  const p = await pow(api);
  let wrong = p.n + 1; while (meets(sha256(`${p.c}:${wrong}`), BITS)) wrong++;
  assert.equal((await post(api, 'register', body({ c: p.c, n: wrong }))).json.pow, true, 'a wrong answer');
  const [t, nonce] = p.c.split('.');
  assert.equal((await post(api, 'register', body({ c: `${t}.${nonce}.forgedsignature000000`, n: p.n }))).status, 400, 'a forged puzzle');
  assert.equal((await post(api, 'register', body(p))).status, 200);
  assert.equal((await post(api, 'register', body(p, 'Paulo'))).status, 400, 'used twice');
  // an old puzzle
  let clock = Date.now();
  const api2 = newApi({ now: () => clock });
  const old = await pow(api2); clock += 11 * 60e3;
  assert.equal((await post(api2, 'register', body(old))).status, 400);
  // the page's sha256 is the real one
  for (const s of ['', 'abc', 'x'.repeat(64), `${p.c}:${p.n}`]) assert.equal(sha256(s).map((x) => x.toString(16).padStart(8, '0')).join(''), createHash('sha256').update(s).digest('hex'));
});

test('bots filling the hidden field, or signing up by the hundred, are turned away', async () => {
  const api = newApi();
  assert.equal((await post(api, 'register', { name: 'SpamBot', pass: 'bayanihan-24', website: 'http://spam', pow: await pow(api) })).status, 400);
  for (let i = 0; i < 5; i++) assert.equal((await post(api, 'register', { name: `Bot${i}x`, pass: 'bayanihan-24', pow: await pow(api) }, null, '6.6.6.6')).status, 200);
  assert.equal((await post(api, 'register', { name: 'Bot9x', pass: 'bayanihan-24', pow: await pow(api) }, null, '6.6.6.6')).status, 429, 'five an hour per address');
});

test('guessing passwords is slowed per name and per address', async () => {
  const api = newApi();
  await join(api, 'Pedro', 'tamang-pass');
  for (let i = 0; i < 10; i++) assert.equal((await post(api, 'login', { name: 'Pedro', pass: `mali${i}` })).status, 401);
  assert.equal((await post(api, 'login', { name: 'Pedro', pass: 'tamang-pass' })).status, 429);
  const api2 = newApi();
  for (let i = 0; i < 40; i++) await post(api2, 'login', { name: `user${i}`, pass: 'x' }, null, '7.7.7.7');
  assert.equal((await post(api2, 'login', { name: 'another', pass: 'x' }, null, '7.7.7.7')).status, 429, 'spraying many names from one address');
});

test('every address has a request budget, and a board query can\'t carry extras past the cache', async () => {
  const api = newApi();
  for (let i = 0; i < 240; i++) await ask(api, 'challenge', { ip: '8.8.8.8' });
  assert.equal((await ask(api, 'challenge', { ip: '8.8.8.8' })).status, 429);
  assert.equal((await ask(api, 'challenge', { ip: '8.8.4.4' })).status, 200);
  assert.equal((await ask(api, 'board', { query: { b: 'bahay.madali', bust: '1' } })).status, 400);
  const b = await ask(api, 'board', { query: { b: 'bahay.madali' } });
  assert.equal(b.status, 200); assert.match(b.cache, /s-maxage/);
});

test('the cloud save comes back after the browser forgets; an older save never overwrites a newer one', async () => {
  const api = newApi();
  const token = await join(api, 'Ana', 'kubo-sa-bukid');
  assert.equal((await ask(api, 'save', { token })).json.data, null);
  assert.equal((await post(api, 'save', { data: { xp: 900, coins: 40, medals: ['first'] } }, token)).status, 200);
  const { token: t2 } = (await post(api, 'login', { name: 'ana', pass: 'kubo-sa-bukid' })).json; // a cleared browser logs in again
  assert.deepEqual((await ask(api, 'save', { token: t2 })).json.data, { xp: 900, coins: 40, medals: ['first'] });
  const stale = await post(api, 'save', { data: { xp: 300 } }, t2);
  assert.equal(stale.status, 409); assert.equal(stale.json.data.xp, 900, 'the newer save is handed back');
  assert.equal((await post(api, 'save', { data: { xp: 1200 } }, t2)).status, 200);
  assert.equal((await post(api, 'save', { data: { nope: 1 } }, t2)).status, 400);
  assert.equal((await post(api, 'save', { data: { xp: 2000, junk: 'x'.repeat(250_000) } }, t2)).status, 413);
  assert.equal((await post(api, 'save', { data: { xp: 5 } })).status, 401);
});

test('which board a game belongs on: by mode and difficulty, today\'s Daily, this week\'s event', () => {
  const now = Date.UTC(2026, 9, 2, 4), wk = weeklyEvent(now);
  assert.equal(boardFor({ mode: 'bahay', diff: 'mahirap', seed: 5 }, now).board, 'bahay.mahirap');
  assert.equal(boardFor({ mode: 'deadline', diff: 'madali', seed: 5 }, now).board, 'deadline.madali');
  assert.equal(boardFor({ mode: 'daily', diff: 'katamtaman', seed: dailySeed(dateKey(now)) }, now).board, `daily.${dateKey(now)}`);
  assert.ok(boardFor({ mode: 'daily', diff: 'katamtaman', seed: dailySeed('2026-09-01') }, now).err, 'an old Daily');
  assert.ok(boardFor({ mode: 'daily', diff: 'madali', seed: dailySeed(dateKey(now)) }, now).err);
  assert.equal(boardFor({ mode: 'lingguhan', diff: 'katamtaman', seed: dailySeed(wk.week), ev: wk.id }, now).board, `lingguhan.${wk.week}`);
  assert.ok(boardFor({ mode: 'lingguhan', diff: 'katamtaman', seed: dailySeed(wk.week), ev: 'nope' }, now).err);
  for (const head of [{ vs: 'kapatas', seed: 1 }, { mode: 'proyekto', diff: 'katamtaman', job: 'sr1' }, { mode: 'training', diff: 'katamtaman', lesson: {} }, { mode: 'bahay', diff: 'easy' }, null]) assert.ok(boardFor(head, now).err);
});

test('a replay keeps the rank tools and the weekly twist, so the server plays the very same game', () => {
  const wk = weeklyEvent(Date.UTC(2026, 9, 2, 4)), ts = toolsetFor(1e7);
  const a = gameFor({ v: 1, mode: 'bahay', diff: 'katamtaman', seed: 3, ts });
  assert.deepEqual(a.toolset, ts);
  const { g, rec } = played({ v: 1, mode: 'lingguhan', diff: 'katamtaman', seed: dailySeed(wk.week), ev: wk.id }, person(3), 60 * 200);
  assert.ok(g.phase === 'done' || g.phase === 'over');
  assert.equal(runToEnd(rec).score, g.score);
});

test('a bot\'s even beat is caught at every pace; a person\'s uneven play is not', async () => {
  for (const pace of [0, 1, 3, 8]) {
    const { rec } = played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 5 }, (g) => bot(g, { pace }));
    assert.match(verify(await encode(rec), Date.now()).err || '', /bot|bilis/, `pace ${pace}`);
  }
  for (const [seed, think] of [[1, 6], [2, 12], [3, 25]]) {
    const { rec } = played({ v: 1, mode: 'karera', diff: 'katamtaman', seed }, person(seed, think));
    const v = verify(await encode(rec), Date.now());
    assert.ok(!v.err, `think ${think}: ${v.err}`);
  }
  // a game handed to the bot with the Konami code says so, and is ranked like any other
  const { rec, g } = played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 5, auto: 1 }, (x) => bot(x, { pace: 2 }));
  const v = verify(await encode(rec), Date.now());
  assert.ok(!v.err, `auto: ${v.err}`);
  assert.equal(v.value, g.score);
  assert.ok(robotic({ seconds: 60, pps: 7, pieces: 420, gaps: 900, gapShare: 0.1, latShare: 0.1 }), 'faster than a person');
  assert.equal(robotic({ seconds: 60, pps: 3, pieces: 180, gaps: 400, gapShare: 0.6, latShare: 0.6 }), null, 'a drag-happy phone player');
  assert.equal(robotic({ seconds: 20, pps: 2, pieces: 20, gaps: 40, gapShare: 1, latShare: 1 }), null, 'too short to tell');
});

test('a replay can\'t be a decompression bomb, junk, or too long', async () => {
  const bomb = 'z' + deflateRawSync(Buffer.alloc(20_000_000)).toString('base64url');
  assert.ok(bomb.length < 600_000);
  assert.equal(unpack(bomb), null);
  assert.equal(unpack('z!!!'), null); assert.equal(unpack(42), null); assert.equal(unpack('b' + 'A'.repeat(700_000)), null);
  const long = createRecorder({ v: 1, mode: 'bahay', diff: 'madali', seed: 1 }); long.t = 4 * 3600 * 60;
  assert.match(verify(await encode(long), Date.now()).err, /mahaba/);
});

test('scores are what the replay proves: ranked, best kept, the board in order, the best game watchable', async () => {
  const api = newApi();
  const ana = await join(api, 'Ana'), ben = await join(api, 'Ben');
  const [slow, fast] = [played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 11 }, person(11, 25)), played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 12 }, person(12, 6))].sort((a, b) => a.g.score - b.g.score);
  assert.ok(fast.g.score > slow.g.score, `${fast.g.score} vs ${slow.g.score}`);
  const fastCode = await encode(fast.rec), slowCode = await encode(slow.rec);
  assert.equal((await post(api, 'score', { code: fastCode })).status, 401, 'an account is needed');
  const s1 = await post(api, 'score', { code: slowCode }, ana);
  assert.equal(s1.status, 200, JSON.stringify(s1.json)); assert.equal(s1.json.board, 'karera.katamtaman'); assert.equal(s1.json.value, slow.g.score); assert.equal(s1.json.rank, 1);
  const s2 = await post(api, 'score', { code: fastCode, score: 99999999 }, ben);
  assert.equal(s2.json.rank, 1); assert.equal(s2.json.of, 2); assert.equal(s2.json.value, fast.g.score, 'the score is the game\'s, not the request\'s');
  const again = await post(api, 'score', { code: fastCode }, ben);
  assert.equal(again.status, 200, 'sending your own game twice is fine'); assert.equal(again.json.improved, false);
  const b = await ask(api, 'board', { query: { b: 'karera.katamtaman' } });
  assert.deepEqual(b.json.top.map((x) => [x.name, x.value]), [['Ben', fast.g.score], ['Ana', slow.g.score]]);
  assert.deepEqual((await ask(api, 'rank', { query: { b: 'karera.katamtaman' }, token: ana })).json, { name: 'Ana', rank: 2, value: slow.g.score });
  const r = await ask(api, 'replay', { query: { b: 'karera.katamtaman', u: b.json.top[0].id } });
  assert.equal(r.json.code, fastCode);
  // Ana watches Ben's game and sends it as her own
  const stolen = await post(api, 'score', { code: r.json.code }, ana);
  assert.equal(stolen.status, 422); assert.match(stolen.json.error, /Kopya/);
  assert.equal((await ask(api, 'board', { query: { b: 'karera.easy' } })).status, 400);
});

test('Deadline ranks the fastest 40 lines first, and an unfinished one is turned away', async () => {
  const api = newApi();
  const ana = await join(api, 'Ana'), ben = await join(api, 'Ben');
  const [quick, slow] = [played({ v: 1, mode: 'deadline', diff: 'madali', seed: 4 }, person(4, 6)), played({ v: 1, mode: 'deadline', diff: 'madali', seed: 4 }, person(5, 20))].sort((a, b) => a.g.elapsed - b.g.elapsed);
  assert.equal(quick.g.phase, 'done'); assert.equal(slow.g.phase, 'done'); assert.ok(quick.g.elapsed < slow.g.elapsed);
  assert.equal((await post(api, 'score', { code: await encode(slow.rec) }, ana)).status, 200);
  const s = await post(api, 'score', { code: await encode(quick.rec) }, ben);
  assert.equal(s.json.rank, 1); assert.equal(s.json.value, quick.g.elapsed);
  const b = await ask(api, 'board', { query: { b: 'deadline.madali' } });
  assert.equal(b.json.low, true); assert.deepEqual(b.json.top.map((x) => x.name), ['Ben', 'Ana']);
  // cut a finished run short: the rules never reach 40 lines
  const cut = { ...quick.rec, t: Math.floor(quick.rec.t / 2), ev: quick.rec.ev.filter((_, i) => quick.rec.ev[i - (i % 2)] < quick.rec.t / 2) };
  assert.equal((await post(api, 'score', { code: await encode(cut) }, ana)).status, 422);
});
