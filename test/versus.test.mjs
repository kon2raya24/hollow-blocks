// Laban: the mud maths, cancelling, garbage coming up, and a whole match replaying identically.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, receive, cancel, pendingRows, COLS, ROWS, READY, GARBAGE_DELAY, GARBAGE_CAP } from '../src/game.mjs';
import { MUD } from '../src/pieces.mjs';
import { attackFor, createMatch, matchTick, matchStep, hashMatch, LADDER, LEVELS, ladderOpen } from '../src/versus.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, runToEnd } from '../src/replay.mjs';

const L = (n, o = {}) => ({ type: 'lines', n, spin: null, b2b: false, combo: 0, ...o });

test('mud sent: 2 rows send 1, 3 send 2, a Bayanihan 4, a T-spin double 4, plus back-to-back and combos', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => attackFor(L(n))), [0, 1, 2, 4]);
  assert.equal(attackFor(L(2, { spin: 'full' })), 4);
  assert.equal(attackFor(L(1, { spin: 'full' })), 2);
  assert.equal(attackFor(L(3, { spin: 'full' })), 6);
  assert.equal(attackFor(L(1, { spin: 'mini' })), 0);
  assert.equal(attackFor(L(4, { b2b: true })), 5);
  assert.equal(attackFor(L(2, { spin: 'full', b2b: true })), 5);
  // combos: nothing for the first two clears in a row, then more the longer it runs
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((c) => attackFor(L(1, { combo: c }))), [0, 0, 1, 1, 2, 2, 3]);
  assert.equal(attackFor(L(4, { combo: 30 })), 4 + 5);
});

test('incoming mud queues, is cancelled by your own clears first, and the rest is returned to send', () => {
  const g = createGame({ seed: 3, mode: 'versus' });
  receive(g, 3); receive(g, 2);
  assert.equal(pendingRows(g), 5);
  assert.equal(cancel(g, 4), 0); // all four cancel
  assert.equal(pendingRows(g), 1);
  assert.equal(cancel(g, 4), 3); // one cancels, three go across
  assert.equal(pendingRows(g), 0);
});

test('armed mud comes up from below on a lock without a clear, one gap per attack, at most eight at once', () => {
  const g = createGame({ seed: 4, mode: 'versus' });
  for (let k = 0; k < READY; k++) tick(g);
  receive(g, 3); receive(g, 9);
  const gaps = g.incoming.map((e) => e.gap);
  // not armed yet: a lock now brings nothing
  g.cur = { type: 'O', rot: 0, x: -1, y: 18 };
  let ev = tick(g, { pressed: ['hard'], held: [] });
  assert.ok(!ev.some((e) => e.type === 'garbage'));
  for (let k = 0; k < GARBAGE_DELAY; k++) tick(g);
  g.cur = { type: 'O', rot: 0, x: 7, y: 2 };
  ev = tick(g, { pressed: ['hard'], held: [] });
  const gar = ev.find((e) => e.type === 'garbage');
  assert.equal(gar.rows, GARBAGE_CAP);
  // the bottom eight rows: mud everywhere but the gap (3 rows of the first attack, 5 of the second)
  for (let r = 0; r < 8; r++) {
    const y = ROWS - 1 - r, gap = r < 5 ? gaps[1] : gaps[0];
    for (let x = 0; x < COLS; x++) assert.equal(g.board[y * COLS + x] === MUD, x !== gap, `row ${y} col ${x}`);
  }
  assert.equal(pendingRows(g), 4); // the rest waits for the next lock
});

test('a clear in a match sends across: the rival gets the mud', () => {
  const m = createMatch({ seed: 5, rival: 'baguhan' });
  for (let k = 0; k < READY + 1; k++) matchTick(m);
  // set up a Bayanihan for you: four full rows but the right column, and a kawayan standing over it
  for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) m.a.board[y * COLS + x] = MUD;
  m.a.cur = { type: 'I', rot: 1, x: COLS - 3, y: 4 };
  const out = matchTick(m, { pressed: ['hard'], held: [] });
  const atk = out.x.find((e) => e.type === 'attack' && e.from === 0);
  assert.equal(atk.n, 4);
  assert.equal(m.sent[0], 4);
  assert.equal(pendingRows(m.b) + 0, 4);
});

test('the ladder: six rivals with their own pace and style; each opens the next', () => {
  assert.equal(LADDER.length, 6);
  for (const r of LADDER) { assert.ok(r.pps > 0 && r.mistake >= 0 && r.mistake < 1 && r.says.start.length && r.says.send.length && r.blurb); }
  assert.ok(LADDER[5].pps > LADDER[0].pps);
  assert.ok(new Set(LADDER.map((r) => r.style)).size >= 3);
  assert.ok(ladderOpen([], 'totoy') && !ladderOpen([], 'nena') && ladderOpen(['totoy'], 'nena'));
  assert.ok(LEVELS.kapatas.pps > LEVELS.bihasa.pps && LEVELS.bihasa.pps > LEVELS.baguhan.pps);
});

test('a whole versus match, recorded as your inputs, replays identically, frame rate and all', () => {
  const m = createMatch({ seed: 11, rival: 'bihasa' });
  const rec = createRecorder({ v: 1, vs: 'bihasa', seed: 11, opts: null });
  let n = 0;
  while (m.phase === 'play' && n++ < 60 * 400) matchStep(m, bot(m.a, { pace: 6 }), [1 / 60, 1 / 30, 1 / 144][n % 3], (inp) => record(rec, inp));
  assert.equal(m.phase, 'over');
  assert.ok(m.sent[0] + m.sent[1] > 10, 'mud went both ways');
  const again = runToEnd(rec);
  assert.equal(hashMatch(again), hashMatch(m));
  assert.equal(again.winner, m.winner);
});

test('the rivals get harder: the bot as the player beats Baguhan more often than Kapatas', () => {
  const wins = (rival) => { let w = 0; for (const seed of [1, 2, 3]) { const m = createMatch({ seed, rival }); while (m.phase === 'play' && m.tick < 60 * 240) matchTick(m, bot(m.a, { pace: 12 })); if (m.winner === 'a') w++; } return w; };
  assert.ok(wins('baguhan') > wins('kapatas'));
});
