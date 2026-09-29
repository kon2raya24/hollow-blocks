import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, step, hashState, fits, rotated, dropped, place, clearRows, tSpin, gravity, spawnPiece, cellsOf,
  COLS, ROWS, HIDDEN, READY, CLEAR_T, LOCK_RESETS, POINTS, DIFFICULTY, MODES,
} from '../src/game.mjs';
import { TYPES, SHAPES, ID, MUD } from '../src/pieces.mjs';

const run = (g, n, input) => { const ev = []; for (let k = 0; k < n; k++) ev.push(...tick(g, typeof input === 'function' ? input(k) : input || { pressed: [], held: [] })); return ev; };
const press = (...a) => ({ pressed: a, held: [] });
const holdKeys = (...a) => ({ pressed: [], held: a });
function started(over = {}) { const g = createGame({ seed: 5, ...over }); run(g, READY); return g; }
// Rows written bottom-up: '#' filled, '.' empty.
function board(rows) {
  const b = new Array(COLS * ROWS).fill(0);
  rows.forEach((r, i) => { const y = ROWS - 1 - i; [...r].forEach((c, x) => { if (c === '#') b[y * COLS + x] = MUD; }); });
  return b;
}
const put = (g, type, rot, x, y) => { g.cur = { type, rot, x, y }; g.lowest = y; g.lockT = 0; g.resets = 0; g.lastRot = false; };

test('seven pieces, four cells each, and four turns bring each back to where it began', () => {
  for (const t of TYPES) {
    assert.equal(SHAPES[t].length, 4);
    for (const r of SHAPES[t]) assert.equal(r.length, 4);
    let p = { type: t, rot: 0, x: 3, y: 5 };
    const empty = new Array(COLS * ROWS).fill(0);
    for (let k = 0; k < 4; k++) p = rotated(empty, p, 1).p;
    assert.deepEqual(cellsOf(p).sort(), cellsOf({ type: t, rot: 0, x: 3, y: 5 }).sort());
  }
  // the T's standard states: pointing up, right, down, left
  assert.deepEqual(SHAPES.T[1], [[2, 1], [1, 0], [1, 1], [1, 2]]);
});

test('the bag: every seven pieces are all seven, and five are shown coming', () => {
  const g = createGame({ seed: 9 });
  assert.equal(g.queue.length, 5);
  const seen = [];
  run(g, READY);
  for (let k = 0; k < 28; k++) { seen.push(g.cur.type); g.board.fill(0); run(g, 1, press('hard')); if (g.phase === 'clear') run(g, CLEAR_T); }
  for (let i = 0; i < 28; i += 7) assert.deepEqual([...seen.slice(i, i + 7)].sort(), [...TYPES].sort(), `bag ${i / 7}`);
});

test('a piece appears over the middle and drops one row at once; a blocked spawn ends the game', () => {
  const g = started();
  const xs = cellsOf(g.cur).map(([x]) => x);
  assert.ok(Math.min(...xs) >= 3 && Math.max(...xs) <= 6);
  assert.equal(g.cur.y, spawnPiece(g.cur.type).y + 1);
  const h = createGame({ seed: 5 });
  h.board = board(Array.from({ length: 21 }, () => '#.########'));
  run(h, READY);
  assert.equal(h.phase, 'over');
});

test('shifting: one space per press, auto-repeat once held past the delay, and walls stop it', () => {
  const g = started();
  put(g, 'T', 0, 3, 5);
  run(g, 1, press('left'));
  assert.equal(g.cur.x, 2);
  const d = g.diff;
  run(g, d.das - 1, holdKeys('left'));
  assert.equal(g.cur.x, 2, 'nothing until the delay');
  run(g, 1, holdKeys('left'));
  assert.equal(g.cur.x, 1);
  run(g, 20, holdKeys('left'));
  assert.equal(g.cur.x, 0, 'the wall stops it');
});

test('wall kicks: a T turning against the wall slides off it; an I in a gap uses the long kicks', () => {
  const empty = new Array(COLS * ROWS).fill(0);
  const t = rotated(empty, { type: 'T', rot: 1, x: -1, y: 10 }, 1); // pointing right, flush on the left wall, turning down
  assert.ok(t && t.kick === 1 && fits(empty, t.p));
  const i = rotated(empty, { type: 'I', rot: 1, x: -2, y: 10 }, 1); // standing on the left wall, turning to lie flat
  assert.ok(i && i.kick > 0);
  assert.ok(cellsOf(i.p).every(([x]) => x >= 0));
});

test('a T-spin double scores 1200 a level, and is noticed as a full T-spin', () => {
  const g = started();
  // the classic slot, with a roof over its right side
  g.board = board(['####.#####', '###...####']);
  g.board[19 * COLS + 5] = MUD;
  put(g, 'T', 1, 3, 19); // standing in the slot, pointing right
  const r = rotated(g.board, g.cur, 1); // turn it to point down, into the slot
  assert.ok(r && r.kick === 0);
  g.cur = r.p; g.lastRot = true; g.lastKick = r.kick;
  assert.equal(dropped(g.board, g.cur).y, g.cur.y, 'already resting');
  assert.equal(tSpin(g.board, g.cur, true, r.kick), 'full');
  const l = run(g, g.diff.lock + 1).find((e) => e.type === 'lines');
  assert.ok(l && l.spin === 'full' && l.n === 2, JSON.stringify(l));
  assert.equal(l.points, POINTS.tspin[2] * g.level);
  assert.equal(tSpin(g.board, { type: 'T', rot: 2, x: 3, y: 19 }, false, 0), null, 'no turn, no spin');
});

test('gravity: level 1 falls a row a second (slower on Madali), and speeds up with level', () => {
  const k = DIFFICULTY.katamtaman, m = DIFFICULTY.madali;
  assert.ok(Math.abs(1 / gravity(1, k) - 60) < 1e-6);
  assert.ok(Math.abs(1 / gravity(2, k) - 0.793 * 60) < 1e-6);
  assert.ok(gravity(1, m) < gravity(1, k));
  assert.ok(gravity(10, k) > gravity(5, k) && gravity(20, k) === 20);
  assert.ok(gravity(20, m) === gravity(12, m), 'Madali stops speeding up at level 12');
});

test('soft drop scores 1 a row and hard drop 2 a row, locking at once', () => {
  const g = started();
  put(g, 'O', 0, 3, 2);
  const s0 = g.score;
  run(g, 10, holdKeys('down'));
  assert.ok(g.cur.y > 2 && g.score - s0 === g.cur.y - 2);
  const y = g.cur.y, bottom = dropped(g.board, g.cur).y, s1 = g.score;
  const ev = run(g, 1, press('hard'));
  assert.ok(ev.some((e) => e.type === 'lock'));
  assert.equal(g.score - s1, POINTS.hard * (bottom - y));
});

test('lock delay: a resting piece locks after the delay; moving on the ground buys time, but only so often', () => {
  const g = started();
  put(g, 'T', 0, 3, ROWS - 2);
  assert.ok(!fits(g.board, { ...g.cur, y: g.cur.y + 1 }));
  let ev = run(g, g.diff.lock - 1);
  assert.ok(!ev.some((e) => e.type === 'lock'));
  assert.ok(run(g, 1).some((e) => e.type === 'lock'));

  const h = started();
  put(h, 'T', 0, 3, ROWS - 2);
  let locked = false;
  for (let k = 0; k < LOCK_RESETS + 3 && !locked; k++) {
    ev = run(h, h.diff.lock - 2);
    ev.push(...run(h, 1, press(k % 2 ? 'left' : 'right')));
    locked = ev.some((e) => e.type === 'lock');
  }
  assert.ok(locked, 'the resets run out');
  assert.ok(h.pieces === 1);
});

test('line clears: 100/300/500/800 a level, the rows go after a short pause, and they fall into place', () => {
  for (const [n, pts] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
    const g = started();
    g.board = board(Array.from({ length: n }, () => '#########.'));
    put(g, 'I', 1, 7, ROWS - 4); // standing up in the right column
    const ev = run(g, 1, press('hard'));
    const l = ev.find((e) => e.type === 'lines');
    assert.equal(l.n, n);
    assert.equal(l.points, pts * g.level);
    assert.equal(g.phase, 'clear');
    run(g, CLEAR_T);
    assert.equal(g.phase, 'play');
    const left = g.board.filter(Boolean).length;
    assert.equal(left, 4 - n, `${n}: the rest of the I stays`);
  }
});

test('combos add 50 a level for each clear in a row, and back-to-back Bayanihan pays half again', () => {
  const g = started();
  g.board = board(['#########.', '#########.', '#########.', '#########.', '#########.', '#########.', '#########.', '#########.']);
  put(g, 'I', 1, 7, ROWS - 8);
  let ev = run(g, 1, press('hard'));
  assert.equal(ev.find((e) => e.type === 'lines').points, 800);
  run(g, CLEAR_T);
  put(g, 'I', 1, 7, ROWS - 4);
  ev = run(g, 1, press('hard'));
  const l = ev.find((e) => e.type === 'lines');
  assert.ok(l.b2b);
  assert.equal(l.combo, 1);
  assert.equal(l.points, 800 * 1.5 + 50);
});

test('hold: swap the piece away once per piece; the first hold takes the next one', () => {
  const g = started();
  const first = g.cur.type, nextUp = g.queue[0];
  run(g, 1, press('hold'));
  assert.equal(g.hold, first); assert.equal(g.cur.type, nextUp);
  const now = g.cur.type;
  run(g, 1, press('hold'));
  assert.equal(g.cur.type, now, 'only once per piece');
  run(g, 1, press('hard'));
  if (g.phase === 'clear') run(g, CLEAR_T);
  run(g, 1, press('hold'));
  assert.equal(g.cur.type, first, 'the held piece comes back');
});

test('levels: every ten lines in Bahay; Deadline stays slow and ends at forty', () => {
  const g = started({ mode: 'bahay' });
  g.lines = 9;
  g.board = board(['#########.']);
  put(g, 'I', 1, 7, ROWS - 4);
  const ev = run(g, 1, press('hard'));
  assert.ok(ev.some((e) => e.type === 'levelUp' && e.level === 2));
  const d = started({ mode: 'deadline' });
  d.lines = 38;
  d.board = board(['#########.', '#########.']);
  put(d, 'I', 1, 7, ROWS - 4);
  run(d, 1, press('hard'));
  assert.equal(d.level, 1);
  const done = run(d, CLEAR_T);
  assert.equal(d.phase, 'done');
  assert.ok(done.some((e) => e.type === 'done'));
  assert.equal(MODES.deadline.goal, 40);
});

test('Bagyo: mud rises from below with one gap, faster as you clear, and overflowing ends it', () => {
  const g = started({ mode: 'bagyo' });
  put(g, 'O', 0, 3, 2);
  const ev = run(g, MODES.bagyo.rise.start);
  const r = ev.find((e) => e.type === 'rise');
  assert.ok(r);
  const bottom = g.board.slice((ROWS - 1) * COLS);
  assert.equal(bottom.filter((c) => c === MUD).length, COLS - 1);
  assert.equal(bottom[r.gap], 0);
  const h = started({ mode: 'bagyo' });
  h.board[0 * COLS + 0] = MUD; // something already at the very top
  put(h, 'O', 0, 3, 8);
  h.rise.t = 1;
  run(h, 1);
  assert.equal(h.phase, 'over');
});

test('lock out: a piece that locks wholly above the top ends the game', () => {
  const g = started();
  g.board = board(Array.from({ length: 20 }, () => '#.#######.'));
  put(g, 'O', 0, 3, -1);
  g.board[1 * COLS + 4] = MUD; g.board[1 * COLS + 5] = MUD;
  run(g, 1, press('hard'));
  assert.equal(g.phase, 'over');
});

test('replays are exact, whatever the frame rate', () => {
  const inputs = (k) => ({ pressed: k % 23 === 0 ? [['left', 'cw', 'right', 'hard', 'hold', 'ccw', 'hard'][(k / 23) % 7]] : [], held: k % 50 < 10 ? ['down'] : [] });
  const a = createGame({ seed: 4 }), b = createGame({ seed: 4 });
  for (let k = 0; k < 4000; k++) tick(a, inputs(k));
  for (let k = 0; k < 4000; k++) tick(b, inputs(k));
  assert.equal(hashState(a), hashState(b));
  const c = createGame({ seed: 4 }), d = createGame({ seed: 4 });
  for (let k = 0; k < 600; k++) step(c, { pressed: k === 90 ? ['hard'] : [], held: [] }, 1 / 60);
  for (let k = 0; k < 300; k++) step(d, { pressed: k === 45 ? ['hard'] : [], held: [] }, 1 / 30);
  assert.equal(c.tick, d.tick);
  assert.equal(c.pieces, d.pieces);
});

test('the board helpers are pure: placing and clearing return new boards', () => {
  const b = new Array(COLS * ROWS).fill(0);
  const p = dropped(b, spawnPiece('O'));
  const { board: nb, rows } = place(b, p);
  assert.equal(b.filter(Boolean).length, 0);
  assert.equal(nb.filter(Boolean).length, 4);
  assert.equal(rows.length, 0);
  assert.equal(clearRows(nb, [ROWS - 1]).filter(Boolean).length, 2);
  assert.equal(nb[(ROWS - 1) * COLS + 4], ID.O);
  assert.equal(HIDDEN, 2);
});
