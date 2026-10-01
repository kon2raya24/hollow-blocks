// The new rules: tools and toolboxes, time limits, the earthquake, rubble, contracts and their stars,
// the Daily's seed, XP and ranks, medals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, useTool, goalMet, MODES, TOOLS, TOOL_MAX, SLOW_T, READY, COLS, ROWS, gravity, cellsOf, CLEAR_T } from '../src/game.mjs';
import { MUD, CEMENT } from '../src/pieces.mjs';
import { CONTRACTS, starsFor, unlocked, brgyStars, describe } from '../src/contracts.mjs';
import { xpFor, rankOf, RANKS, dailySeed, dateKey, shareText, newMedals, MEDALS, styleOpen, addStats } from '../src/progress.mjs';
import { bot } from '../src/bot.mjs';

const NO = { pressed: [], held: [] };
const run = (g, n, input = NO) => { const ev = []; for (let k = 0; k < n; k++) ev.push(...tick(g, typeof input === 'function' ? input(k) : input)); return ev; };
const press = (...a) => ({ pressed: a, held: [] });
function started(o = {}) { const g = createGame({ seed: 5, ...o }); run(g, READY); return g; }
const at = (g, x, y) => g.board[y * COLS + x];
const set = (g, x, y, v = 3) => { g.board[y * COLS + x] = v; };
const height = (g, x) => { for (let y = 0; y < ROWS; y++) if (at(g, x, y)) return ROWS - y; return 0; };

test('tools are on in Bahay, Karera and Proyekto, and off in Deadline, Bagyo and Daily', () => {
  for (const [m, on] of [['bahay', true], ['karera', true], ['proyekto', true], ['deadline', false], ['bagyo', false], ['daily', false]]) assert.equal(createGame({ mode: m }).toolsOn, on, m);
});

test('toolboxes come every 8 to 12 pieces, and the pieces are the same with tools on or off', () => {
  const a = createGame({ seed: 3, mode: 'bahay' }), b = createGame({ seed: 3, mode: 'bahay', tools: false });
  const seen = [], typesA = [], typesB = [];
  run(a, READY); run(b, READY);
  for (let k = 0; k < 60; k++) {
    if (a.cur.tool != null) seen.push(a.pieces);
    typesA.push(a.cur.type); typesB.push(b.cur.type);
    a.board.fill(0); b.board.fill(0); run(a, 1, press('hard')); run(b, 1, press('hard'));
  }
  assert.deepEqual(typesA, typesB);
  assert.ok(seen.length >= 4, `${seen.length} toolboxes`);
  for (let i = 1; i < seen.length; i++) { const gap = seen[i] - seen[i - 1]; assert.ok(gap >= 8 && gap <= 12, `gap ${gap}`); }
  assert.equal(b.tools.length, 0);
});

test('clearing the row that holds a toolbox banks a tool; a Bayanihan banks one; three at most', () => {
  const g = started({ mode: 'bahay' });
  for (let x = 0; x < COLS; x++) if (x < 6) set(g, x, ROWS - 1);
  g.cur = { type: 'I', rot: 0, x: 6, y: ROWS - 3, tool: 2 }; g.lowest = g.cur.y;
  const ev = run(g, 1, press('hard'));
  assert.ok(ev.some((e) => e.type === 'toolEarned'));
  assert.equal(g.tools.length, 1);
  assert.ok(TOOLS.includes(g.tools[0]));
  run(g, CLEAR_T);
  // a Bayanihan: four rows, no toolbox
  g.board.fill(0);
  for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) set(g, x, y);
  g.cur = { type: 'I', rot: 1, x: COLS - 3, y: ROWS - 6 }; g.lowest = g.cur.y;
  const ev2 = run(g, 1, press('hard'));
  assert.ok(ev2.some((e) => e.type === 'lines' && e.n === 4));
  assert.equal(g.tools.length, 2);
  g.tools = ['pison', 'pison', 'pison'];
  run(g, CLEAR_T);
  g.board.fill(0); for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) set(g, x, y);
  g.cur = { type: 'I', rot: 1, x: COLS - 3, y: ROWS - 6 }; run(g, 1, press('hard'));
  assert.equal(g.tools.length, TOOL_MAX);
});

test('martilyo smashes the top block of each column under the piece', () => {
  const g = started({ mode: 'bahay' });
  set(g, 3, ROWS - 1); set(g, 3, ROWS - 2); set(g, 4, ROWS - 1); set(g, 8, ROWS - 1);
  g.cur = { type: 'O', rot: 0, x: 2, y: 2 }; // over columns 3 and 4
  g.tools = ['martilyo'];
  const ev = run(g, 1, press('tool'));
  assert.equal(at(g, 3, ROWS - 2), 0); assert.ok(at(g, 3, ROWS - 1)); assert.equal(at(g, 4, ROWS - 1), 0); assert.ok(at(g, 8, ROWS - 1));
  assert.deepEqual(ev.find((e) => e.type === 'tool').cells.length, 2);
  assert.equal(g.tools.length, 0);
});

test('semento fills the covered holes in the bottom four rows, and only those', () => {
  const g = started({ mode: 'bahay' });
  set(g, 1, ROWS - 3); // covers (1, ROWS-2) and (1, ROWS-1)
  set(g, 5, ROWS - 6); // covers a hole too high to fill (ROWS-5) and three that are low enough
  set(g, 7, ROWS - 1);
  g.tools = ['semento'];
  run(g, 1, press('tool'));
  assert.equal(at(g, 1, ROWS - 2), CEMENT); assert.equal(at(g, 1, ROWS - 1), CEMENT);
  assert.equal(at(g, 5, ROWS - 5), 0); assert.equal(at(g, 5, ROWS - 4), CEMENT); assert.equal(at(g, 5, ROWS - 1), CEMENT);
  assert.equal(at(g, 0, ROWS - 1), 0); // open from above: not a hole
});

test('kreyn swaps the piece for a kawayan at the top', () => {
  const g = started({ mode: 'bahay' });
  g.cur = { type: 'S', rot: 0, x: 4, y: 8 }; g.tools = ['kreyn'];
  run(g, 1, press('tool'));
  assert.equal(g.cur.type, 'I');
  assert.ok(g.cur.y <= 1);
});

test('pison knocks every column down to the median height', () => {
  const g = started({ mode: 'bahay' });
  const hs = [6, 1, 2, 3, 3, 4, 5, 1, 8, 2];
  hs.forEach((h, x) => { for (let k = 0; k < h; k++) set(g, x, ROWS - 1 - k); });
  g.tools = ['pison'];
  run(g, 1, press('tool'));
  const med = 3; // sorted: 1 1 2 2 3 3 4 5 6 8 → (3 + 3) / 2
  for (let x = 0; x < COLS; x++) assert.equal(height(g, x), Math.min(hs[x], med), `column ${x}`);
});

test('merienda halves gravity for 15 seconds', () => {
  const g = started({ mode: 'bahay', difficulty: 'mahirap' });
  g.tools = ['merienda'];
  run(g, 1, press('tool'));
  assert.equal(g.slowT, SLOW_T - 1);
  g.cur = { type: 'O', rot: 0, x: 3, y: 0 }; g.fall = 0; g.lowest = 0;
  const G = gravity(g.level, g.diff);
  run(g, 1);
  assert.ok(Math.abs(g.fall + (g.cur.y) - G * 0.5) < 1e-9 || g.fall <= G * 0.5 + 1e-9);
  run(g, SLOW_T);
  assert.equal(g.slowT, 0);
});

test('no tool is used with an empty inventory, and tools do nothing where they are off', () => {
  const g = started({ mode: 'deadline' });
  const ev = run(g, 1, press('tool'));
  assert.ok(!ev.some((e) => e.type === 'tool'));
});

test('Karera and Daily end after two minutes with the score standing', () => {
  for (const mode of ['karera', 'daily']) {
    const g = started({ mode, difficulty: 'madali' });
    let ev = [];
    for (let k = 0; k < 125 * 60 && g.phase !== 'done' && g.phase !== 'over'; k++) ev = ev.concat(tick(g, bot(g, { pace: 4 })));
    assert.equal(g.phase, 'done', mode);
    assert.ok(g.elapsed >= MODES[mode].limit);
    assert.ok(ev.some((e) => e.type === 'done'));
  }
});

test('Lindol: every 30 seconds the stack slides a column, alternating, and blocks past the wall fall off', () => {
  const g = started({ mode: 'proyekto', contract: { goal: { lines: 99 }, lindol: 30 * 60 } });
  set(g, 0, ROWS - 1); set(g, 9, ROWS - 1, 4); set(g, 5, ROWS - 2, 6);
  g.cur = { type: 'O', rot: 0, x: 3, y: 0 }; g.lindol.t = 1;
  const ev = run(g, 1);
  const q = ev.find((e) => e.type === 'lindol');
  assert.equal(q.dir, 1); assert.equal(q.lost, 1);
  assert.equal(at(g, 1, ROWS - 1), 3); assert.equal(at(g, 6, ROWS - 2), 6); assert.equal(at(g, 9, ROWS - 1), 0);
  assert.equal(g.lindol.dir, -1); assert.equal(g.lindol.t, 30 * 60);
});

test('a messy foundation: rows of rubble with one gap each, and the contract is done once it is gone', () => {
  const c = CONTRACTS.find((x) => x.id === 'sr4');
  const g = createGame({ seed: 9, mode: 'proyekto', contract: c });
  for (let r = 0; r < c.garbage; r++) assert.equal(g.board.slice((ROWS - 1 - r) * COLS, (ROWS - r) * COLS).filter((v) => v === MUD).length, COLS - 1);
  assert.equal(goalMet(g), false);
  g.board.fill(0);
  assert.equal(goalMet(g), true);
  // and the same seed lays the same rubble
  assert.deepEqual(createGame({ seed: 9, mode: 'proyekto', contract: c }).board, createGame({ seed: 9, mode: 'proyekto', contract: c }).board);
});

test('contract goals end the game as done; a time limit fails it; a hold limit is kept', () => {
  const lines = started({ mode: 'proyekto', contract: { goal: { lines: 1 } } });
  for (let x = 0; x < 6; x++) set(lines, x, ROWS - 1);
  lines.cur = { type: 'I', rot: 0, x: 6, y: ROWS - 3 };
  run(lines, 1, press('hard')); run(lines, CLEAR_T);
  assert.equal(lines.phase, 'done');
  const timed = started({ mode: 'proyekto', contract: { goal: { lines: 50 }, limit: 60 } });
  run(timed, 61);
  assert.equal(timed.phase, 'over');
  const surv = started({ mode: 'proyekto', contract: { goal: { survive: 30 } } });
  run(surv, 31);
  assert.equal(surv.phase, 'done');
  const held = started({ mode: 'proyekto', contract: { goal: { lines: 50 }, holdLimit: 1 } });
  run(held, 1, press('hold')); held.holdUsed = false;
  const was = held.cur.type; run(held, 1, press('hold'));
  assert.equal(held.cur.type, was); assert.equal(held.stats.holds, 1);
  const tsp = started({ mode: 'proyekto', contract: { goal: { tspins: 1 } } });
  tsp.stats.tspins = 1; tsp.board.fill(0); run(tsp, 1, press('hard'));
  assert.equal(tsp.phase, 'done');
});

test('every contract is well formed, and the stars follow the par', () => {
  assert.equal(CONTRACTS.length, 15);
  for (const c of CONTRACTS) {
    assert.ok(c.goal && Object.keys(c.goal).length, c.id);
    const lower = c.star.by === 'time' || c.star.by === 'pieces';
    assert.ok(lower ? c.star.three < c.star.two : c.star.three > c.star.two, c.id);
    assert.ok(describe(c).goal.length > 0);
  }
  const c = { star: { by: 'time', two: 90, three: 60 } };
  assert.equal(starsFor(c, { done: false, ticks: 10 }), 0);
  assert.equal(starsFor(c, { done: true, ticks: 100 * 60 }), 1);
  assert.equal(starsFor(c, { done: true, ticks: 90 * 60 }), 2);
  assert.equal(starsFor(c, { done: true, ticks: 59 * 60 }), 3);
  const l = { star: { by: 'lines', two: 10, three: 18 } };
  assert.equal(starsFor(l, { done: true, lines: 9 }), 1); assert.equal(starsFor(l, { done: true, lines: 18 }), 3);
});

test('contracts open in order; a new barangay needs 8 stars from the last', () => {
  const p = {};
  assert.equal(unlocked(p, 'sr1'), true); assert.equal(unlocked(p, 'sr2'), false);
  p.sr1 = 1; assert.equal(unlocked(p, 'sr2'), true);
  Object.assign(p, { sr2: 2, sr3: 1, sr4: 1, sr5: 1 });
  assert.equal(brgyStars(p, 0), 6); assert.equal(unlocked(p, 'ml1'), false);
  p.sr5 = 3; assert.equal(unlocked(p, 'ml1'), true);
});

test('every contract can be started, and the bot can finish the first', () => {
  for (const c of CONTRACTS) { const g = createGame({ seed: 1, mode: 'proyekto', contract: c }); run(g, READY + 5); assert.ok(g.phase === 'play' || g.phase === 'clear', c.id); }
  const g = createGame({ seed: 2, mode: 'proyekto', contract: CONTRACTS[0], difficulty: 'madali' });
  for (let k = 0; k < 20000 && g.phase !== 'done' && g.phase !== 'over'; k++) tick(g, bot(g));
  assert.equal(g.phase, 'done');
});

test('the Daily seed is the same all day for everyone, and changes with the date', () => {
  assert.equal(dailySeed('2026-10-01'), dailySeed('2026-10-01'));
  assert.notEqual(dailySeed('2026-10-01'), dailySeed('2026-10-02'));
  assert.equal(dateKey(Date.UTC(2026, 8, 30, 17, 0)), '2026-10-01'); // 1 a.m. in Manila
  const a = createGame({ seed: dailySeed('2026-10-01'), mode: 'daily' }), b = createGame({ seed: dailySeed('2026-10-01'), mode: 'daily' });
  assert.deepEqual(a.queue, b.queue);
  const t = shareText('2026-10-01', { score: 12345, lines: 22, bayanihan: 1 });
  assert.match(t, /Daily 2026-10-01/); assert.match(t, /₱12,345/); assert.ok(!/[IOTSZJL]-piece/.test(t));
});

test('XP and ranks', () => {
  assert.equal(xpFor({ lines: 10, score: 1000, bayanihan: 1, tspins: 1, stars: 2, done: true }), 100 + 10 + 50 + 40 + 240 + 50);
  assert.equal(rankOf(0).name, 'Peon'); assert.equal(rankOf(1499).name, 'Peon'); assert.equal(rankOf(1500).name, 'Mason');
  assert.equal(rankOf(1500).need, 3500); assert.equal(rankOf(3250).progress, 0.5);
  assert.equal(rankOf(1e6).name, RANKS[RANKS.length - 1].name); assert.equal(rankOf(1e6).next, null);
  assert.equal(styleOpen(0, 'apartment'), true); assert.equal(styleOpen(0, 'condo'), false); assert.equal(styleOpen(12000, 'condo'), true);
});

test('medals: twelve, each earned once', () => {
  assert.equal(MEDALS.length, 12);
  const p = { medals: [], stats: { tools: 0 }, xp: 0, brgyStars: [0, 0, 0] };
  const r = { bayanihan: 1, tspinTriple: 0, maxCombo: 2, perfect: 0, level: 3, mode: 'bahay', done: false, ticks: 0, score: 0 };
  assert.deepEqual(newMedals(r, p), ['unang']);
  p.medals.push('unang');
  assert.deepEqual(newMedals(r, p), []);
  assert.deepEqual(addStats({}, { lines: 4, bayanihan: 1, tspins: 0, ticks: 600, tools: 2 }), { games: 1, lines: 4, bayanihan: 1, tspins: 0, tools: 2, seconds: 10, pieces: 0 });
});
