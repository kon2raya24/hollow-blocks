// The rules of Hollow Blocks: a pure, seeded, fixed 60 Hz simulation of the modern falling-block
// game: a 7-piece bag, standard rotation with wall kicks, hold, lock delay with move resets, T-spins,
// back-to-back and combos. The board helpers (fits, rotated, dropped, place) are pure, so the bot
// plans with the same code. Rendering and audio only read the state and the events.
//
// Tick order: a tool, hold, rotate, shift (with auto-repeat), hard drop, gravity and soft drop, lock,
// then the flood (Bagyo) and the earthquake (Lindol).
//
// Tools (gamit): now and then a piece comes with a toolbox in one cell; clearing the row it sits in
// banks a tool (up to three), and so does a Bayanihan. Using one ('tool' pressed) spends the oldest:
// martilyo smashes the top block of each column under the piece, semento fills the covered holes in the
// bottom four rows, kreyn swaps the piece for a kawayan, pison knocks every column down to the median
// height, merienda halves gravity for 15 s. The toolboxes come from their own seeded stream, so the
// pieces are the same with tools on or off.
import { rand } from './rng.mjs';
import { TYPES, ID, MUD, CEMENT, SHAPES, KICKS } from './pieces.mjs';

export const COLS = 10, ROWS = 22, HIDDEN = 2, VISIBLE = 20;
export const TICK = 1 / 60;
export const READY = 60, CLEAR_T = 20, LOCK_RESETS = 15, NEXT = 5, SOFT = 0.5;
export const POINTS = { lines: [0, 100, 300, 500, 800], tspin: [400, 800, 1200, 1600], mini: [100, 200, 400], combo: 50, soft: 1, hard: 2 };
export const MODES = {
  bahay: { key: 'bahay', name: 'Bahay', goal: null, levels: true, tools: true },
  deadline: { key: 'deadline', name: 'Deadline', goal: 40, levels: false, tools: false },
  bagyo: { key: 'bagyo', name: 'Bagyo', goal: null, levels: true, tools: false, rise: { start: 600, fastest: 240, step: 20 } },
  karera: { key: 'karera', name: 'Karera', goal: null, levels: true, tools: true, limit: 120 * 60 }, // two minutes, score attack
  daily: { key: 'daily', name: 'Daily', goal: null, levels: true, tools: false, limit: 120 * 60 }, // the same pieces for everyone today
  proyekto: { key: 'proyekto', name: 'Proyekto', goal: null, levels: true, tools: true }, // a contract sets the goal and the twist
};
export const TOOLS = ['martilyo', 'semento', 'kreyn', 'pison', 'merienda'];
export const TOOL_MAX = 3, TOOL_EVERY = [8, 12], SLOW_T = 15 * 60, LINDOL_EVERY = 30 * 60;
export const DIFFICULTY = {
  madali: { key: 'madali', name: 'Madali', level: 1, slow: 1.6, fastest: 12, lock: 45, das: 12, arr: 3 },
  katamtaman: { key: 'katamtaman', name: 'Katamtaman', level: 1, slow: 1, fastest: 20, lock: 30, das: 10, arr: 2 },
  mahirap: { key: 'mahirap', name: 'Mahirap', level: 6, slow: 1, fastest: 20, lock: 25, das: 9, arr: 1 },
};
export const NOINPUT = Object.freeze({ pressed: [], held: [] });

// Rows fallen per tick at a level (the standard curve), capped at 20: the piece lands at once.
export function gravity(level, diff) {
  const l = Math.min(level, diff.fastest);
  const secs = Math.pow(0.8 - (l - 1) * 0.007, l - 1) * diff.slow;
  return Math.min(20, 1 / (secs * 60));
}

// ---------- the board ----------
export const cellsOf = (p) => SHAPES[p.type][p.rot].map(([x, y]) => [p.x + x, p.y + y]);
export function fits(board, p) {
  for (const [x, y] of cellsOf(p)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && board[y * COLS + x]) return false;
  }
  return true;
}
// Turn clockwise (dir 1) or anticlockwise (-1), trying each kick in order: { p, kick } or null.
export function rotated(board, p, dir) {
  const to = (p.rot + dir + 4) % 4;
  if (p.type === 'O') return { p: { ...p, rot: to }, kick: 0 };
  const kicks = KICKS[p.type === 'I' ? 'I' : 'JLSTZ'][`${p.rot}${to}`];
  for (let k = 0; k < kicks.length; k++) {
    const q = { ...p, rot: to, x: p.x + kicks[k][0], y: p.y + kicks[k][1] };
    if (fits(board, q)) return { p: q, kick: k };
  }
  return null;
}
export function dropped(board, p) {
  let q = p;
  while (fits(board, { ...q, y: q.y + 1 })) q = { ...q, y: q.y + 1 };
  return q;
}
// Set a piece into a board: the new board and the rows it filled.
export function place(board, p) {
  const b = board.slice();
  for (const [x, y] of cellsOf(p)) if (y >= 0) b[y * COLS + x] = ID[p.type];
  const rows = [];
  for (let y = 0; y < ROWS; y++) { let full = true; for (let x = 0; x < COLS; x++) if (!b[y * COLS + x]) { full = false; break; } if (full) rows.push(y); }
  return { board: b, rows };
}
export function clearRows(board, rows) {
  const keep = [];
  for (let y = 0; y < ROWS; y++) if (!rows.includes(y)) keep.push(board.slice(y * COLS, y * COLS + COLS));
  const out = new Array(rows.length * COLS).fill(0);
  for (const r of keep) out.push(...r);
  return out;
}
export const spawnPiece = (type) => ({ type, rot: 0, x: 3, y: type === 'I' ? -1 : 0 });

// A T that turned into place with three of its four corners filled is a T-spin; with both of the
// corners it points at filled (or after the long kick), a full one, otherwise a mini.
export function tSpin(board, p, lastRot, lastKick) {
  if (p.type !== 'T' || !lastRot) return null;
  const cx = p.x + 1, cy = p.y + 1;
  const filled = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && !!board[y * COLS + x]);
  const c = [filled(cx - 1, cy - 1), filled(cx + 1, cy - 1), filled(cx + 1, cy + 1), filled(cx - 1, cy + 1)]; // tl tr br bl
  if (c.filter(Boolean).length < 3) return null;
  const front = [[0, 1], [1, 2], [2, 3], [3, 0]][p.rot];
  return (c[front[0]] && c[front[1]]) || lastKick === 4 ? 'full' : 'mini';
}

// ---------- a game ----------
export function createGame({ seed = 1, mode = 'bahay', difficulty = 'katamtaman', tools = null, contract = null } = {}) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.katamtaman;
  const m = MODES[mode] || MODES.bahay;
  const c = contract || {};
  const toolsOn = tools === null ? !!m.tools && c.tools !== false : !!tools;
  const start = c.startLevel || (m.levels ? diff.level : 1);
  const g = {
    seed, mode: m.key, modeDef: m, difficulty: diff.key, diff,
    rs: (seed * 2654435761) >>> 0, board: new Array(COLS * ROWS).fill(0), bag: [], queue: [], hold: null, holdUsed: false, cur: null,
    start: 1, level: 1, lines: 0, score: 0, combo: -1, b2b: false,
    tick: 0, acc: 0, elapsed: 0, fall: 0, lockT: 0, resets: 0, lowest: 0, das: null, lastRot: false, lastKick: 0,
    phase: 'ready', phaseT: READY, clearing: null, pieces: 0, stats: { bayanihan: 0, tspins: 0, maxCombo: 0, tools: 0, perfect: 0, holds: 0, lindol: 0 },
    riseDef: c.rise || m.rise || null, rise: (c.rise || m.rise) ? { t: (c.rise || m.rise).start } : null,
    contract: contract || null, goal: c.goal || null, limit: c.limit || m.limit || 0, holdLimit: c.holdLimit ?? null,
    lindol: c.lindol ? { t: c.lindol, every: c.lindol, dir: 1 } : null,
    toolsOn, tools: [], boxes: [], toolIn: 0, slowT: 0, trs: { rs: (seed * 40503 + 12345) >>> 0 }, grs: { rs: (seed * 69069 + 777) >>> 0 },
  };
  g.start = start; g.level = start;
  if (toolsOn) g.toolIn = TOOL_EVERY[0] + Math.floor(rand(g.trs) * (TOOL_EVERY[1] - TOOL_EVERY[0] + 1));
  // a messy foundation: rows of rubble at the bottom, one gap each
  if (c.garbage) for (let r = 0; r < c.garbage; r++) { const y = ROWS - 1 - r, gap = Math.floor(rand(g.grs) * COLS); for (let x = 0; x < COLS; x++) if (x !== gap) g.board[y * COLS + x] = MUD; }
  while (g.queue.length < NEXT) g.queue.push(fromBag(g));
  return g;
}

// The 7-piece bag: every piece once, in a shuffled order, then a new bag.
function fromBag(g) {
  if (!g.bag.length) {
    const b = [...TYPES];
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    g.bag = b;
  }
  return g.bag.shift();
}

function spawn(g, type, ev) {
  const p = spawnPiece(type);
  if (!fits(g.board, p)) { over(g, ev); return false; }
  const down = { ...p, y: p.y + 1 };
  g.cur = fits(g.board, down) ? down : p; // it appears and drops one row at once
  if (g.toolsOn && --g.toolIn <= 0) { g.cur.tool = Math.floor(rand(g.trs) * 4); g.toolIn = TOOL_EVERY[0] + Math.floor(rand(g.trs) * (TOOL_EVERY[1] - TOOL_EVERY[0] + 1)); }
  g.lockT = 0; g.resets = 0; g.lowest = g.cur.y; g.fall = 0; g.lastRot = false; g.lastKick = 0;
  ev.push({ type: 'spawn', piece: type, tool: g.cur.tool ?? null });
  return true;
}
function next(g, ev) {
  const t = g.queue.shift();
  g.queue.push(fromBag(g));
  g.holdUsed = false;
  spawn(g, t, ev);
}

export function step(g, input = NOINPUT, dt = TICK) {
  g.inbox = { held: input.held || [], pressed: [...(g.inbox?.pressed || []), ...(input.pressed || [])] };
  g.acc += Math.min(dt, 0.1);
  const ev = [];
  while (g.acc >= TICK - 1e-9) {
    g.acc -= TICK;
    ev.push(...tick(g, g.inbox));
    g.inbox = { held: g.inbox.held, pressed: [] };
  }
  return ev;
}

export function tick(g, input = NOINPUT) {
  const ev = [];
  g.tick++;
  switch (g.phase) {
    case 'ready':
      if (--g.phaseT <= 0) { g.phase = 'play'; ev.push({ type: 'go' }); next(g, ev); }
      break;
    case 'clear':
      if (--g.phaseT <= 0) {
        g.board = clearRows(g.board, g.clearing);
        g.boxes = g.boxes.filter(([, y]) => !g.clearing.includes(y)).map(([x, y]) => [x, y + g.clearing.filter((r) => r > y).length]);
        g.clearing = null;
        if (g.board.every((v) => !v)) { g.stats.perfect++; ev.push({ type: 'perfect' }); }
        if ((g.modeDef.goal && g.lines >= g.modeDef.goal) || goalMet(g)) { done(g, ev); break; }
        g.phase = 'play';
        next(g, ev);
      }
      if (g.phase !== 'over' && g.phase !== 'done') { g.elapsed++; timeAndGoals(g, ev); }
      break;
    case 'play': play(g, input, ev); if (g.phase === 'play') timeAndGoals(g, ev); break;
    default: break;
  }
  return ev;
}

function play(g, input, ev) {
  const P = input.pressed || [], H = input.held || [];
  g.elapsed++;
  // hold: once per piece
  if (P.includes('tool') && g.tools.length) useTool(g, ev);
  if (g.phase !== 'play') return;
  if (P.includes('hold') && !g.holdUsed && (g.holdLimit === null || g.stats.holds < g.holdLimit)) {
    g.stats.holds++;
    const was = g.cur.type;
    if (g.hold) { const t = g.hold; g.hold = was; if (!spawn(g, t, ev)) return; } else { g.hold = was; const t = g.queue.shift(); g.queue.push(fromBag(g)); if (!spawn(g, t, ev)) return; }
    g.holdUsed = true;
    ev.push({ type: 'hold', piece: was });
  }
  for (const [act, dir] of [['cw', 1], ['ccw', -1]]) {
    if (!P.includes(act)) continue;
    const r = rotated(g.board, g.cur, dir);
    if (r) { g.cur = r.p; g.lastRot = true; g.lastKick = r.kick; moved(g); ev.push({ type: 'rotate', kick: r.kick }); }
  }
  // shifting, with auto-repeat once a direction has been held long enough
  const shift = (dx) => {
    const q = { ...g.cur, x: g.cur.x + dx };
    if (!fits(g.board, q)) return false;
    g.cur = q; g.lastRot = false; moved(g); ev.push({ type: 'move' });
    return true;
  };
  const pl = P.includes('left'), pr = P.includes('right');
  if (pl || pr) { const d = pr && !pl ? 1 : pl && !pr ? -1 : (P.lastIndexOf('right') > P.lastIndexOf('left') ? 1 : -1); shift(d); g.das = { dir: d, t: 0 }; }
  else if (g.das && H.includes(g.das.dir < 0 ? 'left' : 'right')) {
    g.das.t++;
    if (g.das.t >= g.diff.das && (g.das.t - g.diff.das) % g.diff.arr === 0) shift(g.das.dir);
  } else g.das = null;
  // hard drop: straight down and locked
  if (P.includes('hard')) {
    const d = dropped(g.board, g.cur), rows = d.y - g.cur.y;
    if (rows > 0) g.lastRot = false;
    g.cur = d; g.score += POINTS.hard * rows;
    ev.push({ type: 'hardDrop', rows });
    lock(g, ev);
    return;
  }
  // gravity, and the soft drop
  if (g.slowT > 0) g.slowT--;
  const G = gravity(g.level, g.diff) * (g.slowT > 0 ? 0.5 : 1), soft = H.includes('down');
  g.fall += soft ? Math.max(G, SOFT) : G;
  while (g.fall >= 1) {
    const q = { ...g.cur, y: g.cur.y + 1 };
    if (!fits(g.board, q)) { g.fall = 0; break; }
    g.fall -= 1;
    g.cur = q; g.lastRot = false;
    if (soft) g.score += POINTS.soft;
    if (q.y > g.lowest) { g.lowest = q.y; g.resets = 0; g.lockT = 0; }
  }
  if (!fits(g.board, { ...g.cur, y: g.cur.y + 1 })) { if (++g.lockT >= g.diff.lock) { lock(g, ev); return; } }
  else g.lockT = 0;
  if (g.rise && flood(g, ev)) return;
  if (g.lindol && --g.lindol.t <= 0) quake(g, ev);
}

// A move or turn on the ground buys more time, up to LOCK_RESETS times per piece.
function moved(g) {
  if (!fits(g.board, { ...g.cur, y: g.cur.y + 1 }) && g.resets < LOCK_RESETS) { g.lockT = 0; g.resets++; }
}

function lock(g, ev) {
  const p = g.cur;
  const spin = tSpin(g.board, p, g.lastRot, g.lastKick);
  const { board, rows } = place(g.board, p);
  g.board = board; g.cur = null; g.pieces++;
  if (p.tool !== undefined && p.tool !== null) { const [bx, by] = cellsOf(p)[p.tool]; if (by >= 0) g.boxes.push([bx, by]); }
  ev.push({ type: 'lock', piece: p.type, cells: cellsOf(p) });
  if (cellsOf(p).every(([, y]) => y < HIDDEN)) { over(g, ev); return; } // locked wholly above the top
  const n = rows.length;
  if (!n) {
    g.combo = -1;
    if (spin) { const pts = (spin === 'mini' ? POINTS.mini[0] : POINTS.tspin[0]) * g.level; g.score += pts; g.stats.tspins++; ev.push({ type: 'tspin', kind: spin, lines: 0, points: pts }); }
    if (goalMet(g)) { done(g, ev); return; }
    next(g, ev);
    return;
  }
  const hard = n === 4 || !!spin;
  const b2b = hard && g.b2b;
  g.b2b = hard;
  g.combo++;
  const base = spin ? (spin === 'mini' ? POINTS.mini[Math.min(n, 2)] : POINTS.tspin[n]) : POINTS.lines[n];
  const pts = Math.floor(base * g.level * (b2b ? 1.5 : 1)) + (g.combo > 0 ? POINTS.combo * g.combo * g.level : 0);
  g.score += pts;
  g.lines += n;
  if (n === 4) g.stats.bayanihan++;
  if (spin) g.stats.tspins++;
  if (spin === 'full' && n === 3) g.stats.tspinTriple = (g.stats.tspinTriple || 0) + 1;
  g.stats.maxCombo = Math.max(g.stats.maxCombo, g.combo);
  ev.push({ type: 'lines', n, rows, spin, b2b, combo: g.combo, points: pts });
  // a toolbox in a cleared row, or a Bayanihan, banks a tool
  for (const [, by] of g.boxes) if (rows.includes(by)) bank(g, ev);
  if (n === 4 && g.toolsOn) bank(g, ev);
  if (g.modeDef.levels) {
    const level = g.start + Math.floor(g.lines / 10);
    if (level > g.level) { g.level = level; ev.push({ type: 'levelUp', level }); }
  }
  g.clearing = rows; g.phase = 'clear'; g.phaseT = CLEAR_T;
}

// Bagyo: the flood pushes a row of mud up from the bottom, with one gap, faster and faster.
function flood(g, ev) {
  if (--g.rise.t > 0) return false;
  const r = g.riseDef;
  g.rise.t = Math.max(r.fastest, r.start - r.step * g.lines);
  if (g.board.slice(0, COLS).some(Boolean)) { over(g, ev); return true; }
  const gap = Math.floor(rand(g) * COLS);
  g.board = [...g.board.slice(COLS), ...Array.from({ length: COLS }, (_, x) => (x === gap ? 0 : MUD))];
  g.boxes = g.boxes.map(([x, y]) => [x, y - 1]).filter(([, y]) => y >= 0);
  if (g.cur && !fits(g.board, g.cur)) {
    const upq = { ...g.cur, y: g.cur.y - 1 };
    if (fits(g.board, upq)) g.cur = upq; else { over(g, ev); return true; }
  }
  if (g.cur) g.lowest = Math.min(g.lowest, g.cur.y);
  ev.push({ type: 'rise', gap });
  return false;
}

function over(g, ev, reason = 'topout') {
  g.phase = 'over';
  ev.push({ type: 'gameover', score: g.score, lines: g.lines, ticks: g.elapsed, reason });
}
function done(g, ev) {
  g.phase = 'done'; g.cur = null;
  ev.push({ type: 'done', ticks: g.elapsed, score: g.score });
}

// ---------- goals, time, tools, the earthquake ----------
// A contract's goal: { lines, tspins, bayanihan, combo, score, survive (ticks), garbage (clear the rubble) }.
export function goalMet(g) {
  const q = g.goal;
  if (!q) return false;
  if (q.lines && g.lines < q.lines) return false;
  if (q.tspins && g.stats.tspins < q.tspins) return false;
  if (q.bayanihan && g.stats.bayanihan < q.bayanihan) return false;
  if (q.combo && g.stats.maxCombo < q.combo) return false;
  if (q.score && g.score < q.score) return false;
  if (q.survive && g.elapsed < q.survive) return false;
  if (q.garbage && g.board.some((v) => v === MUD)) return false;
  return true;
}
function timeAndGoals(g, ev) {
  if (g.goal && g.goal.survive && goalMet(g) && g.phase === 'play') { done(g, ev); return; }
  if (g.limit && g.elapsed >= g.limit && (g.phase === 'play' || g.phase === 'clear')) {
    if (!g.goal) done(g, ev); // a score attack: time's up, the score stands
    else over(g, ev, 'time');
  }
}
function bank(g, ev) {
  if (!g.toolsOn || g.tools.length >= TOOL_MAX) return;
  const tool = TOOLS[Math.floor(rand(g.trs) * TOOLS.length)];
  g.tools.push(tool);
  ev.push({ type: 'toolEarned', tool });
}
const heightOf = (board, x) => { for (let y = 0; y < ROWS; y++) if (board[y * COLS + x]) return ROWS - y; return 0; };
export function useTool(g, ev) {
  const tool = g.tools[0], b = g.board.slice(), cells = [];
  if (!tool || !g.cur) return false;
  if (tool === 'martilyo') {
    // the top block of each column under the piece
    for (const x of new Set(cellsOf(g.cur).map(([cx]) => cx))) for (let y = 0; y < ROWS; y++) if (b[y * COLS + x]) { if (y > Math.max(...cellsOf(g.cur).filter(([cx]) => cx === x).map(([, cy]) => cy))) { cells.push([x, y, b[y * COLS + x]]); b[y * COLS + x] = 0; } break; }
  } else if (tool === 'semento') {
    // every covered hole in the bottom four rows
    for (let x = 0; x < COLS; x++) { let roof = false; for (let y = 0; y < ROWS; y++) { if (b[y * COLS + x]) roof = true; else if (roof && y >= ROWS - 4) { b[y * COLS + x] = CEMENT; cells.push([x, y]); } } }
  } else if (tool === 'kreyn') {
    const p = spawnPiece('I');
    if (!fits(g.board, p)) return false;
    g.cur = p; g.lockT = 0; g.resets = 0; g.lowest = p.y; g.fall = 0; g.lastRot = false;
  } else if (tool === 'pison') {
    // every column down to the median height
    const hs = Array.from({ length: COLS }, (_, x) => heightOf(b, x)).sort((a, c) => a - c), med = Math.floor((hs[4] + hs[5]) / 2);
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS - med; y++) if (b[y * COLS + x]) { cells.push([x, y, b[y * COLS + x]]); b[y * COLS + x] = 0; }
  } else if (tool === 'merienda') g.slowT = SLOW_T;
  g.tools.shift();
  g.board = b; g.stats.tools++;
  g.boxes = g.boxes.filter(([x, y]) => b[y * COLS + x]);
  ev.push({ type: 'tool', tool, cells, piece: g.cur && g.cur.type, med: tool === 'pison' ? cells.length : 0 });
  return true;
}
// Lindol: every so often the ground shakes and the whole stack slides a column, one way then the other;
// whatever goes past the wall falls off.
function quake(g, ev) {
  const L = g.lindol, d = L.dir, b = new Array(COLS * ROWS).fill(0);
  let lost = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const v = g.board[y * COLS + x]; if (!v) continue; const nx = x + d; if (nx < 0 || nx >= COLS) lost++; else b[y * COLS + nx] = v; }
  g.board = b; g.boxes = g.boxes.map(([x, y]) => [x + d, y]).filter(([x]) => x >= 0 && x < COLS);
  L.dir = -d; L.t = L.every; g.stats.lindol++;
  ev.push({ type: 'lindol', dir: d, lost });
  if (g.cur && !fits(g.board, g.cur)) { const up = { ...g.cur, y: g.cur.y - 1 }; if (fits(g.board, up)) g.cur = up; else over(g, ev); }
}

export function ghostOf(g) { return g.cur ? dropped(g.board, g.cur) : null; }

// A stable fingerprint of everything that matters, for replay tests.
export function hashState(g) {
  return JSON.stringify([g.tick, g.phase, g.score, g.lines, g.level, g.board.join(''), g.cur, g.hold, g.queue, g.rs, g.combo, g.b2b, g.rise, g.tools, g.boxes, g.slowT, g.lindol]);
}
