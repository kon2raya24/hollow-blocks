// Pagsasanay: every lesson's solution, played through the rules key by key, passes its check; the
// wrong move fails it; and the finesse minimums are right.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tick, fits, cellsOf, READY, COLS, ROWS } from '../src/game.mjs';
import { LESSONS, lessonGame, judge, findPath, lessonFor, finesseMin, createCoach, coachTick, boardOf } from '../src/training.mjs';
import { CONTRACTS } from '../src/contracts.mjs';

// Play key moves through the rules like a person: a press, then a quiet tick; 'down' holds the soft drop
// for one row, 'soft' until the piece lands. Returns the verdict and the coach's last reading.
function play(l, moves, coach = createCoach()) {
  const g = lessonGame(l);
  let verdict = null;
  const go = (input) => { const ev = tick(g, input); const fin = coachTick(coach, input, ev, g); verdict = verdict || judge(l, g, ev, fin); return ev; };
  for (let k = 0; k < READY; k++) go({ pressed: [], held: [] });
  for (const piece of moves) {
    if (verdict || !g.cur) break;
    for (const m of piece) {
      if (m === 'down' || m === 'soft') { const y0 = g.cur.y; let n = 0; while (g.cur && fits(g.board, { ...g.cur, y: g.cur.y + 1 }) && (m === 'soft' || g.cur.y === y0) && n++ < 200) go({ pressed: [], held: ['down'] }); continue; }
      go({ pressed: [m], held: [] }); if (m !== 'hard') go({ pressed: [], held: [] });
    }
    for (let k = 0; k < 40 && !verdict && g.phase !== 'play'; k++) go({ pressed: [], held: [] });
    while (!verdict && g.phase === 'clear') go({ pressed: [], held: [] });
  }
  for (let k = 0; k < 40 && !verdict; k++) go({ pressed: [], held: [] });
  return { verdict, g, coach };
}

test('T-spin single, double and triple: the taught keys pass, and a plain drop fails', () => {
  const taught = { tss: ['cw', 'left', 'soft', 'cw', 'hard'], tsd: ['cw', 'left', 'soft', 'cw', 'hard'], tst: ['left', 'left', 'soft', 'right', 'ccw', 'hard'] };
  for (const id of ['tss', 'tsd', 'tst']) {
    const l = LESSONS.find((x) => x.id === id);
    assert.equal(play(l, [taught[id]]).verdict, 'pass', id);
    assert.equal(play(l, [['hard']]).verdict, 'fail', `${id} dropped flat`);
    // the target is reachable with a turn last, as the hint shows
    assert.ok(findPath(boardOf(l.rows), 'T', l.target[0], { lastTurn: true }), `${id} reachable`);
  }
});

test('the 4-wide combo: following the ghost for each piece passes; breaking the combo fails', () => {
  const l = LESSONS.find((x) => x.id === 'combo');
  const g = lessonGame(l);
  const moves = [];
  // each piece's way to its target, found on the board it will meet
  let board = g.board.slice();
  for (const t of l.target) {
    const path = findPath(board, t.type, t);
    assert.ok(path, `${t.type} reachable`);
    moves.push([...path, 'hard']);
    const cells = cellsOf(t);
    for (const [x, y] of cells) board[y * COLS + x] = 1;
    for (let y = 0; y < ROWS; y++) if (board.slice(y * COLS, y * COLS + COLS).every(Boolean)) board = [...new Array(COLS).fill(0), ...board.slice(0, y * COLS), ...board.slice(y * COLS + COLS)];
  }
  const r = play(l, moves);
  assert.equal(r.verdict, 'pass');
  assert.ok(r.g.stats.maxCombo >= 4);
  assert.equal(play(l, [['left', 'left', 'left', 'hard']]).verdict, 'fail');
});

test('finesse: each piece on its ghost with the fewest keys passes; an extra key fails', () => {
  const l = LESSONS.find((x) => x.id === 'finesse');
  // a held left or right is one press (the rules' auto-repeat carries it to the wall)
  const best = [['dasL'], ['dasR'], ['cw', 'cw'], ['cw', 'left', 'left'], ['ccw', 'right', 'right']];
  const expand = (ks) => ks.flatMap((k) => (k === 'dasL' ? ['left', ...Array(9).fill('left')] : k === 'dasR' ? ['right', ...Array(9).fill('right')] : [k]));
  // fewest presses per piece, from the table
  assert.deepEqual(l.target.map((t) => finesseMin(t.type, cellsOf(t))), [1, 1, 2, 3, 3]);
  // played with taps standing in for the held key, the waste shows; played as holds, it passes
  const g = lessonGame(l), coach = createCoach();
  let verdict = null;
  const go = (input) => { const ev = tick(g, input); verdict = verdict || judge(l, g, ev, coachTick(coach, input, ev, g)); };
  for (let k = 0; k < READY; k++) go({ pressed: [], held: [] });
  for (const ks of best) {
    for (const k of ks) {
      if (k === 'dasL' || k === 'dasR') { const d = k === 'dasL' ? 'left' : 'right'; go({ pressed: [d], held: [d] }); for (let n = 0; n < 30; n++) go({ pressed: [], held: [d] }); }
      else { go({ pressed: [k], held: [] }); go({ pressed: [], held: [] }); }
    }
    go({ pressed: ['hard'], held: [] });
    for (let n = 0; n < 3; n++) go({ pressed: [], held: [] });
  }
  assert.equal(verdict, 'pass');
  assert.equal(coach.waste, 0);
  assert.equal(play(l, [[...expand(['dasL']).slice(0, 4), 'hard']]).verdict, 'fail'); // four taps where one hold does
  void expand;
});

test('finesse minimums for a sample of placements', () => {
  const at = (type, rot, x) => { const b = new Array(COLS * ROWS).fill(0); let p = { type, rot, x, y: 0 }; while (fits(b, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 }; return cellsOf(p); };
  assert.equal(finesseMin('T', at('T', 0, 3)), 0); // where it appears
  assert.equal(finesseMin('O', at('O', 0, -1)), 1); // against the left wall: hold left
  assert.equal(finesseMin('O', at('O', 0, 7)), 1);
  assert.equal(finesseMin('I', at('I', 0, 0)), 1);
  assert.equal(finesseMin('I', at('I', 1, -2)), 2); // standing, left wall: turn, hold left
  assert.equal(finesseMin('I', at('I', 1, 2)), 1); // standing in column 4: one turn back
  assert.equal(finesseMin('I', at('I', 1, 1)), 2); // standing in column 3: a turn and a tap
  assert.equal(finesseMin('T', at('T', 2, 3)), 2); // upside down: two turns...
  assert.equal(finesseMin('T', at('T', 2, 3), true), 1); // ...or one half turn
  assert.equal(finesseMin('Z', at('Z', 0, 7)), 1);
  assert.equal(finesseMin('L', at('L', 0, 1)), 2); // two taps left
  assert.equal(finesseMin('J', at('J', 0, 0)), 1); // hold left
  assert.equal(finesseMin('S', at('S', 1, 0)), 2); // standing: a turn and a tap
  assert.equal(finesseMin('S', at('S', 2, 3)), 0); // the S's two flat turns land the same
});

test('the hard contracts link to their lessons', () => {
  for (const id of ['ml1', 'ml2', 'bs4']) assert.ok(lessonFor(id), id);
  for (const l of LESSONS) for (const c of l.contracts) assert.ok(CONTRACTS.some((x) => x.id === c));
});
