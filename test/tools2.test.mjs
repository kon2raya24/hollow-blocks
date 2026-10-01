// The rank tools: the plumada, the barena and the andamyo, opened by rank; the old toolset is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, useTool, receive, hashState, COLS, ROWS, READY, TOOLS } from '../src/game.mjs';
import { MUD } from '../src/pieces.mjs';
import { toolsetFor, TOOL_RANK, RANKS } from '../src/progress.mjs';
import { bot } from '../src/bot.mjs';

const started = (o = {}) => { const g = createGame({ seed: 6, mode: 'bahay', ...o }); for (let k = 0; k < READY; k++) tick(g); return g; };

test('the new tools open with rank: plumada at Kapatas, barena at Inhinyero, andamyo at Arkitekto', () => {
  assert.deepEqual(toolsetFor(0), TOOLS);
  assert.ok(toolsetFor(RANKS[2].xp).includes('plumada') && !toolsetFor(RANKS[2].xp).includes('barena'));
  assert.ok(toolsetFor(RANKS[3].xp).includes('barena') && !toolsetFor(RANKS[3].xp).includes('andamyo'));
  assert.deepEqual(toolsetFor(RANKS[4].xp).slice(-3), ['plumada', 'barena', 'andamyo']);
  assert.equal(Object.keys(TOOL_RANK).length, 3);
});

test('a game given the old toolset plays exactly as one given none', () => {
  const a = createGame({ seed: 12, mode: 'bahay' }), b = createGame({ seed: 12, mode: 'bahay', toolset: TOOLS });
  for (let k = 0; k < 60 * 120; k++) { const i = bot(a, { pace: 2 }); tick(a, i); tick(b, i); }
  assert.equal(hashState(a), hashState(b));
  assert.ok(a.stats.tools >= 0 && a.lines > 20);
});

test('plumada: the hint lasts the next three pieces', () => {
  const g = started(); g.tools = ['plumada'];
  tick(g, { pressed: ['tool'], held: [] });
  assert.equal(g.plumb, 3);
  for (let k = 0; k < 3; k++) { g.board.fill(0); tick(g, { pressed: ['hard'], held: [] }); }
  assert.equal(g.plumb, 0);
});

test('barena: drills out the whole column under the middle of the piece', () => {
  const g = started();
  for (let y = 10; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x !== 9) g.board[y * COLS + x] = MUD;
  g.cur = { type: 'T', rot: 0, x: 3, y: 2 }; g.tools = ['barena'];
  const ev = []; useTool(g, ev);
  const e = ev.find((x) => x.type === 'tool');
  assert.equal(e.tool, 'barena'); assert.equal(e.cells.length, ROWS - 10);
  for (let y = 0; y < ROWS; y++) assert.equal(g.board[y * COLS + 4], 0);
  assert.ok(g.board[(ROWS - 1) * COLS + 3] && g.board[(ROWS - 1) * COLS + 5]);
});

test('andamyo: takes the next mud, then breaks', () => {
  const g = started({ mode: 'versus' }); g.tools = ['andamyo'];
  tick(g, { pressed: ['tool'], held: [] });
  assert.equal(g.scaffold, true);
  receive(g, 4); g.incoming[0].t = 0;
  const ev = tick(g, { pressed: ['hard'], held: [] });
  assert.ok(ev.some((e) => e.type === 'andamyo' && e.why === 'mud'));
  assert.equal(g.scaffold, false);
  assert.ok(!g.board.slice((ROWS - 4) * COLS).some((v) => v === MUD));
  // a second one can't go up while one stands
  g.tools = ['andamyo', 'andamyo']; tick(g, { pressed: ['tool'], held: [] }); assert.equal(g.tools.length, 1);
  const ev2 = []; assert.equal(useTool(g, ev2), false);
});

test('andamyo: or one top-out: the top of the stack comes down onto it and play goes on', () => {
  const g = started(); g.tools = ['andamyo'];
  tick(g, { pressed: ['tool'], held: [] });
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x !== y % COLS) g.board[y * COLS + x] = MUD;
  g.cur = { type: 'O', rot: 0, x: 3, y: 0 };
  const ev = []; for (let k = 0; k < 40 && g.phase === 'play' && !ev.some((e) => e.type === 'andamyo'); k++) ev.push(...tick(g, { pressed: ['hard'], held: [] }));
  assert.ok(ev.some((e) => e.type === 'andamyo' && e.why === 'topout'));
  assert.notEqual(g.phase, 'over');
  assert.equal(g.scaffold, false);
  assert.ok(!g.board.slice(0, 8 * COLS).some(Boolean));
});

test('the Bagyo flood is taken by the scaffold too, and the pieces stay the same', () => {
  const a = started({ mode: 'bagyo' }), b = started({ mode: 'bagyo' });
  b.scaffold = true; a.rise.t = 1; b.rise.t = 1;
  tick(a); const ev = tick(b);
  void ev;
  assert.equal(b.scaffold, false);
  assert.ok(a.board.slice((ROWS - 1) * COLS).some((v) => v === MUD) && !b.board.slice((ROWS - 1) * COLS).some((v) => v === MUD));
  assert.deepEqual(a.queue, b.queue); assert.equal(a.rs, b.rs);
});
