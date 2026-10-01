// Pagsasanay (training): Kapatas's lessons, each a set board, a set of pieces, a ghost of where the
// piece should go, and a check, plus the finesse coach that counts the keys a placement took against
// the fewest that could do it. Pure, so the tests can play every lesson's solution through the rules.
import { COLS, ROWS, fits, rotated, dropped, cellsOf, spawnPiece, createGame } from './game.mjs';
import { ID } from './pieces.mjs';

// Rows written bottom-up: '#' a block (its material by place, so the wall looks built), '.' empty.
const MIX = [2, 7, 3, 6, 2, 5, 7, 2, 4, 6];
export function boardOf(rows) {
  const b = new Array(COLS * ROWS).fill(0);
  rows.forEach((r, i) => { const y = ROWS - 1 - i; [...r].forEach((c, x) => { if (c === '#') b[y * COLS + x] = MIX[(x * 3 + y * 7) % MIX.length]; else if (ID[c]) b[y * COLS + x] = ID[c]; }); });
  return b;
}

// target: where each piece should end, { type, rot, x, y } (a box position, as the rules keep pieces).
export const LESSONS = [
  {
    id: 'tss', name: 'T-spin Single', short: 'T-spin 1', contracts: ['ml1', 'bs4'],
    brief: 'Ang butas na may bubong: hindi mo maibabagsak nang diretso ang ladrilyo. Itayo ito (↑ o X), ibaba nang dahan-dahan sa butas, saka iikot papasok bago dumikit.',
    tip: 'Ikot → kaliwa → ↓ hanggang sumayad → ikot ulit → bagsak.',
    rows: ['###.######', '##...####.', '###..#####'], seq: ['T'], goal: { spinLines: 1 },
    target: [{ type: 'T', rot: 2, x: 2, y: 19 }],
  },
  {
    id: 'tsd', name: 'T-spin Double', short: 'T-spin 2', contracts: ['ml1', 'bs4'],
    brief: 'Ganito rin, pero puno ang dalawang hanay. Iikot ang ladrilyo papasok sa ilalim ng bubong: dalawang hanay, apat na putik sa kalaban!',
    tip: 'Ikot → kaliwa → ↓ hanggang sumayad → ikot ulit → bagsak.',
    rows: ['###.######', '##...#####', '###..#####', '###.......'], seq: ['T'], goal: { spinLines: 2 },
    target: [{ type: 'T', rot: 2, x: 2, y: 19 }],
  },
  {
    id: 'tst', name: 'T-spin Triple', short: 'T-spin 3', contracts: ['ml1', 'bs4'],
    brief: 'Ang pinakamahirap: tatlong hanay. Ibaba ang ladrilyo nang nakahiga sa tabi ng butas, isingit sa ilalim ng bubong, at iikot pabalik (Z): babagsak ito nang dalawang hanay papasok.',
    tip: 'Kaliwa ×2 → ↓ hanggang sumayad → kanan → ikot pabalik (Z) → bagsak.',
    rows: ['####.#####', '###..#####', '####.#####', '.....#####', '....######'], seq: ['T'], goal: { spinLines: 3 },
    target: [{ type: 'T', rot: 3, x: 3, y: 19 }],
  },
  {
    id: 'combo', name: '4-wide Combo', short: 'Combo', contracts: ['ml2'],
    brief: 'Apat na luwang sa gitna, may tatlong bloke na sa ilalim. Bawat piraso, isang hanay lang ang buuin: tuloy-tuloy ang clear, lumalaki ang combo. Limang sunod-sunod!',
    tip: 'Sundan ang anino: isang hanay bawat piraso, laging tatlong bloke ang natitira.',
    rows: ['######.###', ...Array(8).fill('###....###')], seq: ['I', 'T', 'O', 'Z', 'S', 'J', 'L'], goal: { combo: 4 },
    // one line of play, found by search (.scratch/combo.mjs) and checked by the tests
    target: [{ type: 'I', rot: 0, x: 3, y: 19 }, { type: 'T', rot: 3, x: 5, y: 19 }, { type: 'O', rot: 0, x: 2, y: 20 }, { type: 'Z', rot: 1, x: 4, y: 19 }, { type: 'S', rot: 0, x: 3, y: 20 }, { type: 'J', rot: 1, x: 2, y: 19 }],
  },
  {
    id: 'finesse', name: 'Finesse', short: 'Finesse', contracts: [],
    brief: 'Ang mahusay na mason, walang sayang na galaw. Ilagay ang bawat piraso sa anino sa pinakakaunting pindot: pindutin at hawakan ang ← o → para dumiretso sa pader.',
    tip: 'Hawakan ang ← o → para sa pader. Ang tamang ikot: isang pindot lang.',
    rows: [], seq: ['O', 'I', 'T', 'L', 'J'], goal: null,
    target: [{ type: 'O', rot: 0, x: -1, y: 20 }, { type: 'I', rot: 0, x: 6, y: 20 }, { type: 'T', rot: 2, x: 3, y: 19 }, { type: 'L', rot: 1, x: 1, y: 17 }, { type: 'J', rot: 3, x: 5, y: 17 }],
  },
];
export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;
export const lessonFor = (contractId) => LESSONS.find((l) => l.contracts.includes(contractId)) || null;
export const lessonSetup = (l) => ({ board: boardOf(l.rows), sequence: l.seq });

export function lessonGame(l, opts = null) {
  return createGame({ seed: 7, mode: 'training', difficulty: 'katamtaman', opts, ...lessonSetup(l), contract: { goal: l.goal || { lines: 999 }, tools: false } });
}

// Judge a lesson after each tick's events: 'pass', 'fail' or null (keep going).
// fin: the finesse coach's verdict for a piece that just locked, if any.
export function judge(l, g, evs, fin = null) {
  const lock = evs.find((e) => e.type === 'lock');
  if (l.id === 'finesse') {
    if (!lock) return null;
    const i = g.pieces - 1, t = l.target[i];
    const want = t && new Set(cellsOf(t).map(([x, y]) => `${x},${y}`));
    if (!want || lock.cells.some(([x, y]) => !want.has(`${x},${y}`))) return 'fail';
    if (fin && fin.waste > 0) return 'fail';
    return i + 1 >= l.target.length ? 'pass' : null;
  }
  if (evs.some((e) => e.type === 'done')) return 'pass';
  if (!lock) return null;
  const lines = evs.find((e) => e.type === 'lines');
  if (l.goal.spinLines) return lines && lines.spin === 'full' && lines.n === l.goal.spinLines ? null : 'fail'; // 'done' follows the clear
  if (l.goal.combo) return lines ? null : 'fail'; // the combo broke
  return null;
}

// ---------- reaching a target: the moves, by breadth-first search over shifts, turns and single steps
// down (so tucks and spins are found); the last move into place must be a turn for a T-spin. ----------
export function findPath(board, type, target, { lastTurn = false } = {}) {
  const start = spawnPiece(type);
  const s0 = fits(board, { ...start, y: start.y + 1 }) ? { ...start, y: start.y + 1 } : start;
  const key = (p, t) => `${p.rot},${p.x},${p.y},${t ? 1 : 0}`;
  const q = [[s0, false, []]], seen = new Set([key(s0, false)]);
  while (q.length) {
    const [p, turned, path] = q.shift();
    if (p.rot === target.rot && p.x === target.x && p.y === target.y && (!lastTurn || turned) && !fits(board, { ...p, y: p.y + 1 })) return path;
    const next = [];
    for (const [m, dx] of [['left', -1], ['right', 1]]) { const n = { ...p, x: p.x + dx }; if (fits(board, n)) next.push([n, false, m]); }
    const d = { ...p, y: p.y + 1 }; if (fits(board, d)) next.push([d, false, 'down']);
    for (const [m, dir] of [['cw', 1], ['ccw', -1]]) { const r = rotated(board, p, dir); if (r) next.push([r.p, true, m]); }
    for (const [n, t, m] of next) { const k = key(n, t); if (!seen.has(k) && path.length < 60) { seen.add(k); q.push([n, t, [...path, m]]); } }
  }
  return null;
}

// ---------- finesse ----------
// The fewest presses that bring a piece from where it appears to a column and turn, on an open board:
// a tap left or right, a held left or right (to the wall), a turn either way, and a half turn if on.
export function finesseTable(type, rot180 = false) {
  const empty = new Array(COLS * ROWS).fill(0), Y = 8;
  const s = { ...spawnPiece(type), y: Y }, dist = new Map([[`${s.rot},${s.x}`, 0]]), q = [s];
  while (q.length) {
    const p = q.shift(), d = dist.get(`${p.rot},${p.x}`), out = [];
    for (const dx of [-1, 1]) { const n = { ...p, x: p.x + dx }; if (fits(empty, n)) out.push(n); let w = p; while (fits(empty, { ...w, x: w.x + dx })) w = { ...w, x: w.x + dx }; out.push(w); }
    for (const dir of rot180 ? [1, -1, 2] : [1, -1]) { const r = rotated(empty, p, dir); if (r) out.push({ ...r.p, y: Y }); }
    for (const n of out) { const k = `${n.rot},${n.x}`; if (!dist.has(k)) { dist.set(k, d + 1); q.push(n); } }
  }
  return dist;
}
const TABLES = new Map();
// The fewest presses for a piece to end in these cells, dropped straight (null for a tuck or a spin,
// which finesse doesn't judge). The cells are compared as they land on an open board.
export function finesseMin(type, cells, rot180 = false) {
  const k = `${type}${rot180 ? 1 : 0}`;
  if (!TABLES.has(k)) TABLES.set(k, finesseTable(type, rot180));
  const dist = TABLES.get(k), empty = new Array(COLS * ROWS).fill(0);
  const shape = (p) => { const c = cellsOf(dropped(empty, { ...p, y: 0 })), my = Math.max(...c.map(([, y]) => y)); return c.map(([x, y]) => `${x},${y - my}`).sort().join(' '); };
  const my = Math.max(...cells.map(([, y]) => y)), want = cells.map(([x, y]) => `${x},${y - my}`).sort().join(' ');
  let best = null;
  for (const [id, d] of dist) { const [rot, x] = id.split(',').map(Number); if (shape({ type, rot, x }) === want && (best === null || d < best)) best = d; }
  return best;
}

// The coach: fed each tick's input and events; after a lock, `last` holds { used, min, waste }.
const MOVES = new Set(['left', 'right', 'cw', 'ccw', 'r180']);
export function createCoach(rot180 = false) { return { rot180, active: false, used: 0, type: null, last: null, pieces: 0, waste: 0 }; }
export function coachTick(c, input, evs, g) {
  if (c.active) for (const a of input.pressed || []) if (MOVES.has(a)) c.used++;
  let out = null;
  for (const e of evs) {
    if (e.type === 'spawn') { c.active = true; c.used = 0; c.type = e.piece; }
    else if (e.type === 'lock') {
      c.active = false;
      // a tuck or a spin isn't judged: the piece must land where a straight drop from above would
      const pre = g ? g.board.slice() : null;
      if (pre) for (const [x, y] of e.cells) if (y >= 0) pre[y * COLS + x] = 0;
      const tx = Math.min(...e.cells.map(([x]) => x));
      let straight = true;
      if (pre && !evs.some((v) => v.type === 'garbage')) {
        const col = new Set(e.cells.map(([x]) => x));
        for (const x of col) { const top = Math.min(...e.cells.filter(([cx]) => cx === x).map(([, y]) => y)); for (let y = 0; y < top; y++) if (pre[y * COLS + x]) straight = false; }
      }
      const min = straight ? finesseMin(e.piece, e.cells, c.rot180) : null;
      out = { piece: e.piece, used: c.used, min, waste: min === null ? 0 : Math.max(0, c.used - min), x: tx };
      c.last = out; c.pieces++; c.waste += out.waste;
    }
  }
  return out;
}
