// Rewarded ads: offers only when chosen, capped each day, never before the third game, off with the
// Settings switch, and nothing that reaches a ranked game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, hashState, step } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, runToEnd } from '../src/replay.mjs';
import { contractById, CONTRACTS } from '../src/contracts.mjs';
import { OFFERS, DAILY_MAX, MIN_GAMES, canOffer, spend, left, boosted, useBoost, onTrial, startTrial, brokeStreak, canRescue, rescue } from '../src/ads.mjs';
import { boardFor } from '../api/_hb.mjs';

const T = Date.UTC(2026, 9, 2, 4), DAY = 86400e3;

test('nothing is offered to a new player, with the switch off, or past a day\'s cap', () => {
  const p = (ads, more = {}) => ({ ads, games: 10, on: true, ...more });
  assert.equal(canOffer('barya', p(null, { games: MIN_GAMES - 1 }), T), false);
  assert.equal(canOffer('barya', p(null, { on: false }), T), false);
  assert.equal(canOffer('nope', p(null), T), false);
  let ads = null;
  for (let i = 0; i < OFFERS.barya.perDay; i++) { assert.ok(canOffer('barya', p(ads), T)); ads = spend('barya', ads, T); }
  assert.equal(canOffer('barya', p(ads), T), false); assert.equal(left('barya', ads, T), 0);
  assert.ok(canOffer('double', p(ads), T), 'each offer has its own cap');
  assert.ok(canOffer('barya', p(ads), T + DAY), 'a new day, new counts');
  let all = null;
  for (const k of ['double', 'double', 'double', 'double', 'double', 'barya', 'barya', 'barya', 'overtime', 'trial', 'tool', 'tool']) all = spend(k, all, T);
  assert.equal(all.total, DAILY_MAX);
  assert.equal(canOffer('streak', p(all), T), false, 'twelve a day in all');
});

test('Overtime doubles XP for three games, then stops', () => {
  let b = { games: OFFERS.overtime.games };
  const got = [];
  for (let i = 0; i < 5; i++) { got.push(boosted(100, b)); b = useBoost(b); }
  assert.deepEqual(got, [200, 200, 200, 100, 100]);
  assert.equal(boosted(100, null), 100);
});

test('a trial lasts a day, and old trials are cleared', () => {
  const t = startTrial({ old: T - 1 }, 'skin-x', T);
  assert.ok(onTrial(t, 'skin-x', T + 23 * 3600e3)); assert.ok(!onTrial(t, 'skin-x', T + 25 * 3600e3));
  assert.ok(!('old' in t));
});

test('a broken streak of two days or more can be saved that day only', () => {
  const lost = brokeStreak({ count: 5, best: 5 }, { count: 1, best: 5 }, T);
  assert.deepEqual(lost, { count: 5, day: '2026-10-02' });
  assert.equal(brokeStreak({ count: 1 }, { count: 1 }, T), null);
  assert.equal(brokeStreak({ count: 4 }, { count: 5 }, T), null);
  assert.ok(canRescue(lost, T)); assert.ok(!canRescue(lost, T + DAY));
  assert.deepEqual(rescue({ count: 1, best: 5, last: '2026-10-02' }, lost), { count: 6, best: 6, last: '2026-10-02' });
});

test('a contract\'s starting tool is in the replay, and never goes on a board', () => {
  const job = CONTRACTS.find((c) => createGame({ mode: 'proyekto', contract: c }).toolsOn);
  const plain = createGame({ seed: 4, mode: 'proyekto', contract: job }), extra = createGame({ seed: 4, mode: 'proyekto', contract: job, bonusTool: 'martilyo' });
  assert.deepEqual(extra.tools, [...plain.tools, 'martilyo']);
  assert.equal(hashState(createGame({ seed: 4, mode: 'bahay' })), hashState(createGame({ seed: 4, mode: 'bahay', bonusTool: null })), 'no tool, the same game as before');
  const head = { v: 1, mode: 'proyekto', diff: 'katamtaman', seed: 4, job: job.id, bonus: 'martilyo' };
  const g = createGame({ seed: 4, mode: 'proyekto', contract: contractById(job.id), bonusTool: 'martilyo' }), rec = createRecorder(head);
  for (let n = 0; n < 60 * 60 && g.phase !== 'over' && g.phase !== 'done'; n++) step(g, bot(g, { pace: 2 }), 1 / 60, (i) => record(rec, i));
  assert.equal(hashState(runToEnd(rec)), hashState(g));
  assert.ok(boardFor({ mode: 'bahay', diff: 'madali', seed: 1, bonus: 'martilyo' }, T).err);
});
