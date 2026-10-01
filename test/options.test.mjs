// The modern options live in the rules: with none given the game is exactly as before; DAS, ARR, the
// soft drop, hold off, the next queue, and the half turn with its SRS+ kicks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, rotated, hashState, cellsOf, COLS, ROWS, READY, DIFFICULTY } from '../src/game.mjs';
import { KICKS180 } from '../src/pieces.mjs';
import { bot } from '../src/bot.mjs';

const started = (o = {}) => { const g = createGame({ seed: 5, ...o }); for (let k = 0; k < READY; k++) tick(g); return g; };
const empty = () => new Array(COLS * ROWS).fill(0);

test('default options change nothing: the same game, tick for tick, as with no options at all', () => {
  for (const diff of ['madali', 'katamtaman', 'mahirap']) {
    const d = DIFFICULTY[diff];
    const a = createGame({ seed: 31, mode: 'bahay', difficulty: diff }), b = createGame({ seed: 31, mode: 'bahay', difficulty: diff, opts: { das: d.das, arr: d.arr, soft: 0.5, rot180: false, hold: true, next: 5 } }), c = createGame({ seed: 31, mode: 'bahay', difficulty: diff, opts: {} });
    for (let k = 0; k < 60 * 90; k++) { const i = bot(a, { pace: 2 }); tick(a, i); tick(b, i); tick(c, i); }
    assert.equal(hashState(b), hashState(a), diff); assert.equal(hashState(c), hashState(a), diff);
    assert.ok(a.lines > 10);
  }
});

test('DAS and ARR: the delay before auto-repeat and its rate are the options; ARR 0 goes to the wall at once', () => {
  const g = started({ opts: { das: 4, arr: 3 } });
  g.cur = { type: 'O', rot: 0, x: 3, y: 5 };
  tick(g, { pressed: ['right'], held: ['right'] }); assert.equal(g.cur.x, 4);
  for (let k = 0; k < 3; k++) tick(g, { pressed: [], held: ['right'] }); assert.equal(g.cur.x, 4);
  tick(g, { pressed: [], held: ['right'] }); assert.equal(g.cur.x, 5); // after 4 ticks
  tick(g, { pressed: [], held: ['right'] }); tick(g, { pressed: [], held: ['right'] }); assert.equal(g.cur.x, 5);
  tick(g, { pressed: [], held: ['right'] }); assert.equal(g.cur.x, 6); // every 3 ticks
  const h = started({ opts: { das: 2, arr: 0 } });
  h.cur = { type: 'O', rot: 0, x: 3, y: 5 };
  tick(h, { pressed: ['left'], held: ['left'] }); tick(h, { pressed: [], held: ['left'] }); tick(h, { pressed: [], held: ['left'] });
  assert.equal(h.cur.x, -1); // straight to the wall
});

test('soft drop speed, hold off, and the queue length are options', () => {
  const g = started({ opts: { soft: 2 } });
  g.cur = { type: 'O', rot: 0, x: 3, y: 2 }; g.fall = 0;
  tick(g, { pressed: [], held: ['down'] });
  assert.equal(g.cur.y, 4);
  const h = started({ opts: { hold: false } });
  const was = h.cur.type; tick(h, { pressed: ['hold'], held: [] });
  assert.equal(h.cur.type, was); assert.equal(h.hold, null);
  assert.equal(createGame({ seed: 2, opts: { next: 6 } }).queue.length, 6);
  // the sequence is the same however many are shown
  assert.deepEqual(createGame({ seed: 2, opts: { next: 6 } }).queue.slice(0, 5), createGame({ seed: 2 }).queue);
});

test('the half turn: off by default, on as an option, kicking by the SRS+ 180 table', () => {
  const off = started(); off.cur = { type: 'T', rot: 0, x: 3, y: 8 };
  tick(off, { pressed: ['r180'], held: [] }); assert.equal(off.cur.rot, 0);
  const on = started({ opts: { rot180: true } }); on.cur = { type: 'T', rot: 0, x: 3, y: 8 };
  tick(on, { pressed: ['r180'], held: [] }); assert.equal(on.cur.rot, 2); assert.equal(on.cur.x, 3); assert.equal(on.cur.y, 8);
  // a table entry for every half turn, the first kick always in place
  for (const k of ['02', '13', '20', '31']) { assert.equal(KICKS180.JLSTZ[k].length, 6); assert.ok(KICKS180.JLSTZ[k][0].every((v) => v === 0)); }
  // 0→2 against a roof: the in-place turn is blocked, the SRS+ (0,+1) kick (up one row) takes it
  const b = empty(), p = { type: 'T', rot: 0, x: 3, y: 10 };
  b[12 * COLS + 4] = 8; // under the T's middle: where the pointing-down nub would go
  const r = rotated(b, p, 2);
  assert.ok(r); assert.equal(r.p.rot, 2); assert.equal(r.kick, 1); assert.equal(r.p.y, 9); assert.equal(r.p.x, 3);
  // R→L by the wall: a standing T against the left wall turns over with a sideways kick
  const w = empty();
  const q = { type: 'T', rot: 1, x: -1, y: 10 }; // standing, nub pointing right, flush to the left wall
  const s = rotated(w, q, 2);
  assert.ok(s); assert.equal(s.p.rot, 3); assert.equal(s.kick, 1); assert.equal(s.p.x, 0);
  for (const [x] of cellsOf(s.p)) assert.ok(x >= 0);
});
