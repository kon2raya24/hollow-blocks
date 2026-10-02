// The server: accounts, the cloud save, and leaderboards that rank only what a replay proves. Redis is
// played by a small in-memory stand-in that answers the way Upstash's REST API does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, encode, gameFor, runToEnd } from '../src/replay.mjs';
import { dateKey, dailySeed, weeklyEvent, toolsetFor } from '../src/progress.mjs';
import { createApi, boardFor, verify } from '../api/_hb.mjs';

function fakeRedis() {
  const kv = new Map();
  const z = (key) => { if (!kv.has(key)) kv.set(key, new Map()); return kv.get(key); };
  const h = z;
  const sorted = (key) => [...(kv.get(key) || new Map())].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const C = {
    GET: (key) => kv.get(key) ?? null,
    SET: (key, v, ...o) => { if (o.includes('NX') && kv.has(key)) return null; kv.set(key, String(v)); return 'OK'; },
    DEL: (key) => (kv.delete(key) ? 1 : 0),
    INCR: (key) => { const n = Number(kv.get(key) || 0) + 1; kv.set(key, String(n)); return n; },
    EXPIRE: () => 1,
    HSET: (key, ...fv) => { const m = h(key); for (let i = 0; i < fv.length; i += 2) m.set(fv[i], String(fv[i + 1])); return fv.length / 2; },
    HGET: (key, f) => kv.get(key)?.get(f) ?? null,
    HMGET: (key, ...fs) => fs.map((f) => kv.get(key)?.get(f) ?? null),
    ZADD: (key, s, m) => { z(key).set(m, Number(s)); return 1; },
    ZSCORE: (key, m) => (kv.get(key)?.has(m) ? String(kv.get(key).get(m)) : null),
    ZRANK: (key, m) => { const i = sorted(key).findIndex(([x]) => x === m); return i < 0 ? null : i; },
    ZREVRANK: (key, m) => { const i = sorted(key).reverse().findIndex(([x]) => x === m); return i < 0 ? null : i; },
    ZCARD: (key) => kv.get(key)?.size || 0,
    ZRANGE: (key, a, b, ...o) => { let s = sorted(key); if (o.includes('REV')) s = s.reverse(); return s.slice(a, b + 1).flatMap(([m, v]) => [m, String(v)]); },
  };
  const run = ([c, ...a]) => C[c](...a);
  return { kv, cmd: async (...a) => run(a), pipe: async (cmds) => cmds.map(run) };
}

// a bot's game from a replay head, recorded the way the page records it
function played(head, pace = 3, limit = 60 * 400) {
  const g = gameFor(head), rec = createRecorder(head);
  let n = 0;
  while (g.phase !== 'over' && g.phase !== 'done' && n++ < limit) step(g, { pressed: bot(g, { pace }).pressed, held: [] }, 1 / 60, (inp) => record(rec, inp));
  return { g, rec };
}
const ask = (api, route, more = {}) => api({ route, method: 'GET', query: {}, ip: '1.2.3.4', token: null, ...more });
const post = (api, route, body, token = null) => ask(api, route, { method: 'POST', body, token });

test('an account: register, log in again from a fresh browser, names are one per person, log out', async () => {
  const api = createApi(fakeRedis());
  const r = await post(api, 'register', { name: 'Juan_dela.Cruz', pass: 'kawayan1' });
  assert.equal(r.status, 200); assert.ok(r.json.token.length > 20);
  assert.equal((await ask(api, 'me', { token: r.json.token })).json.name, 'Juan_dela.Cruz');
  assert.equal((await post(api, 'register', { name: 'juan_DELA.cruz', pass: 'iba-pa-ito' })).status, 409, 'names ignore case');
  assert.equal((await post(api, 'register', { name: 'ab', pass: 'kawayan1' })).status, 400);
  assert.equal((await post(api, 'register', { name: 'Maria', pass: '123' })).status, 400);
  assert.equal((await post(api, 'login', { name: 'juan_dela.cruz', pass: 'mali' })).status, 401);
  const again = await post(api, 'login', { name: 'juan_dela.cruz', pass: 'kawayan1' });
  assert.equal(again.status, 200); assert.equal(again.json.name, 'Juan_dela.Cruz');
  assert.notEqual(again.json.token, r.json.token);
  await post(api, 'logout', {}, r.json.token);
  assert.equal((await ask(api, 'me', { token: r.json.token })).status, 401);
  assert.equal((await ask(api, 'me', { token: again.json.token })).status, 200, 'other sessions stay');
  assert.equal((await ask(api, 'register', { method: 'GET' })).status, 404, 'the wrong method');
});

test('guessing a password is slowed: ten tries per name per ten minutes', async () => {
  const api = createApi(fakeRedis());
  await post(api, 'register', { name: 'Pedro', pass: 'tamang-pass' });
  for (let i = 0; i < 10; i++) assert.equal((await post(api, 'login', { name: 'Pedro', pass: `mali${i}` })).status, 401);
  assert.equal((await post(api, 'login', { name: 'Pedro', pass: 'tamang-pass' })).status, 429);
});

test('the cloud save comes back after the browser forgets; an older save never overwrites a newer one', async () => {
  const db = fakeRedis(), api = createApi(db);
  const { token } = (await post(api, 'register', { name: 'Ana', pass: 'hollow1' })).json;
  assert.equal((await ask(api, 'save', { token })).json.data, null);
  assert.equal((await post(api, 'save', { data: { xp: 900, coins: 40, medals: ['first'] } }, token)).status, 200);
  const { token: t2 } = (await post(api, 'login', { name: 'ana', pass: 'hollow1' })).json; // a cleared browser logs in again
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
  const { g, rec } = played({ v: 1, mode: 'lingguhan', diff: 'katamtaman', seed: dailySeed(wk.week), ev: wk.id }, 3, 60 * 200);
  assert.ok(g.phase === 'done' || g.phase === 'over');
  assert.equal(runToEnd(rec).score, g.score);
});

test('scores are what the replay proves: ranked, best kept, the board in order, the best game watchable', async () => {
  const api = createApi(fakeRedis());
  const ana = (await post(api, 'register', { name: 'Ana', pass: 'hollow1' })).json.token;
  const ben = (await post(api, 'register', { name: 'Ben', pass: 'hollow2' })).json.token;
  const [slow, fast] = [played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 11 }, 6), played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 12 }, 2)].sort((a, b) => a.g.score - b.g.score);
  assert.ok(fast.g.score > slow.g.score, `${fast.g.score} vs ${slow.g.score}`);
  const fastCode = await encode(fast.rec), slowCode = await encode(slow.rec);
  assert.equal((await post(api, 'score', { code: fastCode })).status, 401, 'an account is needed');
  const s1 = await post(api, 'score', { code: slowCode }, ana);
  assert.equal(s1.status, 200); assert.equal(s1.json.board, 'karera.katamtaman'); assert.equal(s1.json.value, slow.g.score); assert.equal(s1.json.rank, 1);
  const s2 = await post(api, 'score', { code: fastCode }, ben);
  assert.equal(s2.json.rank, 1); assert.equal(s2.json.of, 2);
  const s3 = await post(api, 'score', { code: slowCode }, ben);
  assert.equal(s3.json.improved, false); assert.equal(s3.json.best, fast.g.score, 'a worse game keeps the best');
  const b = await ask(api, 'board', { query: { b: 'karera.katamtaman' }, token: ana });
  assert.deepEqual(b.json.top.map((x) => [x.name, x.value]), [['Ben', fast.g.score], ['Ana', slow.g.score]]);
  assert.deepEqual(b.json.me, { name: 'Ana', rank: 2, value: slow.g.score });
  const r = await ask(api, 'replay', { query: { b: 'karera.katamtaman', u: b.json.top[0].id } });
  assert.equal(r.json.code, fastCode);
  assert.equal((await ask(api, 'board', { query: { b: 'karera.easy' } })).status, 400);
});

test('Deadline ranks the fastest 40 lines first, and an unfinished one is turned away', async () => {
  const api = createApi(fakeRedis());
  const ana = (await post(api, 'register', { name: 'Ana', pass: 'hollow1' })).json.token;
  const ben = (await post(api, 'register', { name: 'Ben', pass: 'hollow2' })).json.token;
  const [quick, slow] = [played({ v: 1, mode: 'deadline', diff: 'madali', seed: 4 }, 8), played({ v: 1, mode: 'deadline', diff: 'madali', seed: 4 }, 2)].sort((a, b) => a.g.elapsed - b.g.elapsed);
  assert.equal(quick.g.phase, 'done'); assert.equal(slow.g.phase, 'done'); assert.ok(quick.g.elapsed < slow.g.elapsed);
  await post(api, 'score', { code: await encode(slow.rec) }, ana);
  const s = await post(api, 'score', { code: await encode(quick.rec) }, ben);
  assert.equal(s.json.rank, 1); assert.equal(s.json.value, quick.g.elapsed);
  const b = await ask(api, 'board', { query: { b: 'deadline.madali' } });
  assert.equal(b.json.low, true); assert.deepEqual(b.json.top.map((x) => x.name), ['Ben', 'Ana']);
  // cut a finished run short: the rules never reach 40 lines
  const cut = { ...quick.rec, t: Math.floor(quick.rec.t / 2), ev: quick.rec.ev.filter((_, i) => quick.rec.ev[i - (i % 2)] < quick.rec.t / 2) };
  assert.equal((await post(api, 'score', { code: await encode(cut) }, ana)).status, 422);
});

test('a forged score gets nowhere: the server reads the score from the game, not from the request', async () => {
  const api = createApi(fakeRedis());
  const ana = (await post(api, 'register', { name: 'Ana', pass: 'hollow1' })).json.token;
  const { g, rec } = played({ v: 1, mode: 'bahay', diff: 'mahirap', seed: 2 }, 4, 60 * 60);
  const s = await post(api, 'score', { code: await encode(rec), score: 99999999 }, ana);
  if (g.phase === 'over') assert.equal(s.json.value, g.score); else assert.equal(s.status, 422, 'an unfinished game');
  assert.equal((await post(api, 'score', { code: 'znot-a-replay' }, ana)).status, 422);
  const vs = await verify(await encode(createRecorder({ v: 1, vs: 'kapatas', seed: 1 })), Date.now());
  assert.ok(vs.err);
});
