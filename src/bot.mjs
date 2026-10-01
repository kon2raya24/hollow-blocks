// A player for the title demo and the balance tests. For the piece in hand (and the one it could swap
// from hold) it tries every turn and column with the rules' own board helpers, scores the board it
// would leave with the classic El-Tetris weights, and then presses the keys a person would: hold,
// turns, shifts, hard drop.
import { COLS, ROWS, fits, rotated, dropped, place, clearRows, spawnPiece, cellsOf, NOINPUT } from './game.mjs';

const W = { height: -4.500158825082766, lines: 3.4181268101392694, rowT: -3.2178882868487753, colT: -9.348695305445199, holes: -7.899265427351652, wells: -3.3855972247263626 };

function evaluate(board, p, style = null) {
  const { board: b, rows } = place(board, p);
  const cells = cellsOf(p);
  const eaten = cells.filter(([, y]) => rows.includes(y)).length;
  const after = rows.length ? clearRows(b, rows) : b;
  const filled = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && !!after[y * COLS + x]);
  let rowT = 0, colT = 0, holes = 0, wells = 0, wellR = 0, rowR = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x <= COLS; x++) if (filled(x - 1, y) !== filled(x, y)) rowT++;
  for (let x = 0; x < COLS; x++) {
    let roof = false, well = 0;
    for (let y = 0; y <= ROWS; y++) {
      const f = filled(x, y);
      if (y > 0 && f !== filled(x, y - 1)) colT++;
      if (f && y < ROWS) roof = true;
      else if (!f && roof) holes++;
      if (!f && filled(x - 1, y) && filled(x + 1, y)) { well++; wells += well; if (x === COLS - 1) wellR += well; } else well = 0;
    }
  }
  const height = ROWS - cells.reduce((a, [, y]) => a + y, 0) / cells.length;
  let v = W.height * height + W.lines * rows.length * eaten + W.rowT * rowT + W.colT * colT + W.holes * holes + W.wells * wells;
  if (style === 'tetris') {
    // build for Bayanihans: keep the right-hand column open as a well, and save the clears for four at once
    let inWell = 0, top = ROWS;
    for (let y = 0; y < ROWS; y++) { if (after[y * COLS + COLS - 1]) inWell++; for (let x = 0; x < COLS; x++) if (after[y * COLS + x] && y < top) top = y; }
    const high = ROWS - top > 12;
    for (let y = 0; y < ROWS; y++) if (filled(COLS - 2, y) && !filled(COLS - 1, y)) rowR++;
    v += (high ? 0 : -9 * inWell - W.wells * wellR - W.rowT * rowR) + (rows.length === 4 ? 120 : rows.length && !high ? -30 : 0);
  }
  return v;
}

// Every place a piece can be dropped from the top, with the keys that get it there.
function placements(board, type) {
  const out = [];
  for (let r = 0; r < (type === 'O' ? 1 : 4); r++) {
    let p = spawnPiece(type), ok = true;
    const keys = [];
    for (let k = 0; k < r && ok; k++) {
      const q = r === 3 ? rotated(board, p, -1) : rotated(board, p, 1);
      if (!q) ok = false; else p = q.p;
      if (r === 3) { keys.push('ccw'); break; }
      keys.push('cw');
    }
    if (!ok || !fits(board, p)) continue;
    for (const dir of [0, -1, 1]) {
      let q = p;
      const shifts = [];
      for (;;) {
        const land = dropped(board, q);
        if (dir !== 0 || shifts.length === 0) out.push({ keys: [...keys, ...shifts, 'hard'], land });
        if (dir === 0) break;
        const n = { ...q, x: q.x + dir };
        if (!fits(board, n)) break;
        q = n; shifts.push(dir < 0 ? 'left' : 'right');
      }
    }
  }
  return out;
}

export function choose(g, style = null) {
  const best = (type) => {
    let top = null;
    for (const c of placements(g.board, type)) { const v = evaluate(g.board, c.land, style); if (!top || v > top.v) top = { ...c, v }; }
    return top;
  };
  const now = best(g.cur.type);
  if (!g.holdUsed && (g.holdLimit == null || g.stats.holds < g.holdLimit)) {
    const other = best(g.hold || g.queue[0]);
    if (other && (!now || other.v > now.v + 1)) return { keys: ['hold', ...other.keys], v: other.v };
  }
  return now;
}

const MEM = new WeakMap();

// pace: ticks between key presses (a person-like rhythm on the title screen).
export function bot(g, { pace = 0, style = null } = {}) {
  if (g.phase !== 'play' || !g.cur) return NOINPUT;
  let m = MEM.get(g);
  if (!m || m.piece !== g.pieces) { m = { piece: g.pieces, keys: choose(g, style)?.keys || ['hard'], wait: pace }; MEM.set(g, m); }
  if (m.wait-- > 0) return NOINPUT;
  m.wait = pace;
  const k = m.keys.shift();
  return k ? { pressed: [k], held: [] } : NOINPUT;
}
