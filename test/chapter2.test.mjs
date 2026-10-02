// Proyekto chapter 2: every twist does what it says, the City Inspector, the chapter's unlock, and
// the bot wins every contract it can (two of three seeds at a strong person's pace).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, cellsOf, COLS, ROWS, READY } from '../src/game.mjs';
import { MUD, REJECTED } from '../src/pieces.mjs';
import { bot } from '../src/bot.mjs';
import { CONTRACTS, starsFor, unlocked, chapterOpen, describe } from '../src/contracts.mjs';

const C = (id) => CONTRACTS.find((c) => c.id === id);
const started = (contract, seed = 3) => { const g = createGame({ seed, mode: 'proyekto', contract }); for (let k = 0; k < READY; k++) tick(g); return g; };
const run = (g, n, input) => { const ev = []; for (let k = 0; k < n && g.phase !== 'over'; k++) ev.push(...tick(g, input || { pressed: [], held: [] })); return ev; };

test('chapter 2: fifteen contracts in three new barangays, opened by finishing chapter 1 or by 30 stars', () => {
  const ch2 = CONTRACTS.filter((c) => c.brgy >= 3);
  assert.equal(ch2.length, 15);
  assert.deepEqual([...new Set(ch2.map((c) => c.brgy))], [3, 4, 5]);
  assert.ok(!chapterOpen({}, 1) && !unlocked({}, 'sl1'));
  assert.ok(chapterOpen({ bs5: 1 }, 1) && unlocked({ bs5: 1 }, 'sl1'));
  const thirty = Object.fromEntries(CONTRACTS.filter((c) => c.brgy < 3).slice(0, 10).map((c) => [c.id, 3]));
  assert.ok(unlocked(thirty, 'sl1'));
  assert.ok(!unlocked({ bs5: 1 }, 'sl2') && unlocked({ bs5: 1, sl1: 1 }, 'sl2'));
  for (const c of ch2) { const d = describe(c); assert.ok(d.goal && d.twist, c.id); assert.ok(c.star.two > 0 && c.star.three > 0, c.id); }
});

test('brownout: the lights go out and come back on their clock', () => {
  const g = started(C('sl1'));
  assert.equal(g.dark.on, true);
  const ev = run(g, C('sl1').brownout.dark + 2, { pressed: [], held: [] });
  assert.ok(ev.some((e) => e.type === 'lights' && e.on));
  assert.equal(g.dark.on, false);
});

test('hangin: the piece drifts a column with the wind, and the gust turns', () => {
  const g = started({ goal: { lines: 99 }, wind: { every: 10, gust: 2 } });
  g.cur = { type: 'O', rot: 0, x: 3, y: 2 }; g.wind.t = 10; g.fall = -999;
  const x0 = g.cur.x;
  let ev = run(g, 10); assert.equal(g.cur.x, x0 + 1); assert.ok(ev.some((e) => e.type === 'wind'));
  ev = run(g, 10); assert.equal(g.cur.x, x0 + 2); assert.ok(ev.some((e) => e.type === 'gust' && e.dir === -1));
  run(g, 10); assert.equal(g.cur.x, x0 + 1);
});

test('bitak: a cracked piece crumbles after so many more placements', () => {
  const g = started({ goal: { lines: 99 }, bitak: { every: 1, life: 2 } });
  assert.ok(g.cur.cracked);
  const first = (() => { tick(g, { pressed: ['hard'], held: [] }); return g.cracks.map((c) => [c.x, c.y]); })();
  assert.equal(first.length, 4);
  tick(g, { pressed: ['hard'], held: [] });
  for (const [x, y] of first) assert.ok(g.board[y * COLS + x], 'still there after one more');
  const ev = tick(g, { pressed: ['hard'], held: [] });
  const gone = ev.find((e) => e.type === 'crumble');
  assert.ok(gone && gone.cells.length === 4);
  for (const [x, y] of first) assert.equal(g.board[y * COLS + x], 0);
});

test('Lunes: no kawayan in the bag at all', () => {
  const h = createGame({ seed: 4, mode: 'proyekto', contract: C('sl4') });
  for (let k = 0; k < READY; k++) tick(h);
  const types = [];
  for (let k = 0; k < 60 && h.phase === 'play'; k++) { types.push(h.cur.type); h.board.fill(0); tick(h, { pressed: ['hard'], held: [] }); }
  assert.ok(types.length >= 50 && !types.includes('I') && new Set(types).size === 6);
});

test('limited tools: the contract hands over its tools, and no toolboxes come', () => {
  const g = started(C('mg1'));
  assert.deepEqual(g.tools, ['martilyo', 'semento']);
  for (let k = 0; k < 40 && g.phase === 'play'; k++) { const ev = tick(g, { pressed: ['hard'], held: [] }); assert.ok(!ev.some((e) => e.type === 'spawn' && e.tool !== null)); }
});

test('the City Inspector stamps REJECTED on top of a column, his bar fills, and clearing a stamp pushes it back', () => {
  const c = C('bg5'), g = started(c);
  g.insp.t = 1;
  const ev = run(g, 1);
  const st = ev.find((e) => e.type === 'stamp');
  assert.ok(st); assert.equal(g.board[st.y * COLS + st.x], REJECTED);
  assert.equal(st.y, ROWS - 1); // an empty column: on the slab
  // a full row with a stamp in it clears and buys time
  const y = ROWS - 1; for (let x = 0; x < COLS; x++) if (x !== st.x && !(x >= 4 && x < 8)) g.board[y * COLS + x] = MUD;
  g.insp.bar = 1000; g.insp.t = 999;
  g.cur = { type: 'I', rot: 0, x: 4, y: 3 };
  const ev2 = run(g, 1, { pressed: ['hard'], held: [] });
  assert.ok(ev2.some((e) => e.type === 'passed' && e.n === 1));
  assert.equal(g.insp.bar, 1000 - c.inspector.relief); // (the lock ends the tick's play, so no tick is added)
  // a full bar ends the job
  const h = started(c); h.insp.bar = h.insp.max - 1; const evh = run(h, 2);
  assert.ok(evh.some((e) => e.type === 'gameover' && e.reason === 'inspected'));
});

const play = (c, seed, pace) => {
  const g = createGame({ seed, mode: 'proyekto', difficulty: 'katamtaman', contract: c });
  while (g.phase !== 'done' && g.phase !== 'over' && g.elapsed < 15 * 3600) tick(g, bot(g, { pace }));
  return starsFor(c, { done: g.phase === 'done', ticks: g.elapsed, pieces: g.pieces, lines: g.lines, score: g.score });
};
for (const c of CONTRACTS.filter((x) => x.brgy >= 3)) {
  test(`${c.id} ${c.name}: the bot earns a star on at least two of three seeds`, () => {
    const stars = [1, 2, 3].map((seed) => play(c, seed, 8));
    assert.ok(stars.filter((s) => s >= 1).length >= 2, `${c.id}: ${stars}`);
    if (c.star.by === 'time') assert.ok(play(c, 1, 24) < 3, `${c.id}: three stars at a slow pace`);
  });
}

test('Lunes: the kreyn never hands over a kawayan, and none is banked there', () => {
  const g = createGame({ seed: 8, mode: 'proyekto', contract: { goal: { lines: 99 }, noI: true, tools: true, toolEvery: 1 } });
  for (let k = 0; k < READY; k++) tick(g);
  const banked = [];
  for (let k = 0; k < 80 && g.phase === 'play'; k++) { g.board.fill(0); const ev = tick(g, { pressed: ['hard'], held: [] }); for (const e of ev) if (e.type === 'toolEarned') banked.push(e.tool); g.tools.length = 0; }
  assert.ok(banked.length > 30 && !banked.includes('kreyn'), banked.join());
  const h = createGame({ seed: 8, mode: 'proyekto', contract: { goal: { lines: 99 }, noI: true, startTools: ['kreyn'] } });
  for (let k = 0; k < READY; k++) tick(h);
  const was = h.cur.type;
  const ev = tick(h, { pressed: ['tool'], held: [] });
  assert.equal(h.cur.type, was); assert.ok(!ev.some((e) => e.type === 'tool'));
  assert.notEqual(h.cur.type, 'I');
});
