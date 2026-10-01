// Tapatan: two people on one device. Keys go to the right player, each player's input reaches only
// their own well, the handicaps work, and a whole match replays from both input streams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { routes, clashes, createInput, keyTo, drain, DEF_KEYS_P1, DEF_KEYS_P2 } from '../src/controls.mjs';
import { createMatch, matchTick, matchStep, hashMatch } from '../src/versus.mjs';
import { pendingRows, READY, ROWS, COLS } from '../src/game.mjs';
import { MUD } from '../src/pieces.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, inputs } from '../src/replay.mjs';

test('keys route to their player: WASD-side to player 1, the arrows to player 2, unknown keys nowhere', () => {
  const t = routes([DEF_KEYS_P1, DEF_KEYS_P2]);
  assert.deepEqual(t.get('a'), { p: 0, act: 'left' });
  assert.deepEqual(t.get('w'), { p: 0, act: 'hard' });
  assert.deepEqual(t.get('ArrowLeft'), { p: 1, act: 'left' });
  assert.deepEqual(t.get('ArrowUp'), { p: 1, act: 'hard' });
  assert.equal(t.get('m'), undefined);
  assert.deepEqual(clashes([DEF_KEYS_P1, DEF_KEYS_P2]), []);
  // a clash is found, and player 1 keeps the key
  const bad = { ...DEF_KEYS_P2, left: ['a'] };
  assert.equal(clashes([DEF_KEYS_P1, bad]).length, 1);
  assert.equal(routes([DEF_KEYS_P1, bad]).get('a').p, 0);
});

test("held and pressed keys build each player's input separately", () => {
  const t = routes([DEF_KEYS_P1, DEF_KEYS_P2]), P = [createInput(), createInput()];
  keyTo(P, t, 'a', true); keyTo(P, t, 'ArrowRight', true); keyTo(P, t, 'ArrowRight', true, true); keyTo(P, t, 's', true); keyTo(P, t, '.', true);
  const a = drain(P[0]), b = drain(P[1]);
  assert.deepEqual(a.pressed, ['left']); assert.deepEqual(a.held.sort(), ['down', 'left']);
  assert.deepEqual(b.pressed, ['right', 'cw']); assert.deepEqual(b.held, ['right']);
  keyTo(P, t, 'a', false);
  assert.deepEqual(drain(P[0]), { pressed: [], held: ['down'] });
});

test("each player's input moves only their own piece", () => {
  const m = createMatch({ seed: 3, local: true });
  for (let k = 0; k < READY + 2; k++) matchTick(m);
  const ax = m.a.cur.x, bx = m.b.cur.x;
  matchTick(m, { pressed: ['left'], held: [] }, { pressed: [], held: [] });
  assert.equal(m.a.cur.x, ax - 1); assert.equal(m.b.cur.x, bx);
  matchTick(m, { pressed: [], held: [] }, { pressed: ['right'], held: [] });
  assert.equal(m.a.cur.x, ax - 1); assert.equal(m.b.cur.x, bx + 1);
});

test('handicaps: a garbage multiplier on what a side sends (fractions carried), and a starting height', () => {
  const m = createMatch({ seed: 5, local: true, mult: [0.5, 2], rubble: [0, 4] });
  for (let x = 0; x < COLS; x++) assert.equal(m.b.board[(ROWS - 1) * COLS + x] === MUD || m.b.board[(ROWS - 1) * COLS + x] === 0, true);
  assert.equal(m.b.board.filter((v) => v === MUD).length, 4 * (COLS - 1));
  assert.equal(m.a.board.filter(Boolean).length, 0);
  for (let k = 0; k < READY + 1; k++) matchTick(m);
  const quad = (g) => { for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) g.board[y * COLS + x] = MUD; g.cur = { type: 'I', rot: 1, x: COLS - 3, y: 4 }; };
  quad(m.a); matchTick(m, { pressed: ['hard'], held: [] });
  assert.equal(pendingRows(m.b), 2); // 4 × 0.5
  for (let k = 0; k < 30; k++) matchTick(m);
  m.b.board.fill(0); m.b.incoming.length = 0; quad(m.b); matchTick(m, {}, { pressed: ['hard'], held: [] });
  assert.equal(pendingRows(m.a), 8); // 4 × 2
});

test("a whole Tapatan match replays identically from both players' inputs", () => {
  const m = createMatch({ seed: 19, local: true, mult: [1, 1.5] });
  const ra = createRecorder({}), rb = createRecorder({});
  let n = 0;
  while (m.phase === 'play' && n++ < 60 * 300) matchStep(m, bot(m.a, { pace: 5 }), [1 / 60, 1 / 30, 1 / 90][n % 3], (ia, _ea, ib) => { record(ra, ia); record(rb, ib); }, bot(m.b, { pace: 7, style: 'tetris' }));
  assert.equal(m.phase, 'over');
  const again = createMatch({ seed: 19, local: true, mult: [1, 1.5] }), fa = inputs(ra), fb = inputs(rb);
  for (let i = 0; i < ra.t; i++) matchTick(again, fa(i), fb(i));
  assert.equal(hashMatch(again), hashMatch(m));
  assert.equal(again.winner, m.winner);
});
