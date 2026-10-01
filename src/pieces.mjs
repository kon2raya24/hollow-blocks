// The seven pieces, each a building material, with their rotations and the standard wall kicks.
// Cells are [x, y] in the piece's box, x to the right and y down; rotation states are 0, R, 2, L.
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const ID = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }; // board values; 8 is mud from the flood
export const MUD = 8, CEMENT = 9; // 8 is mud from the flood (and rubble); 9 is semento poured into holes

export const MATERIALS = {
  I: { name: 'Kawayan', color: '#b9c95a', dark: '#7f8f2f' },
  O: { name: 'Hollow block', color: '#b3b8bd', dark: '#6f757c' },
  T: { name: 'Ladrilyo', color: '#c4553a', dark: '#8a3423' },
  S: { name: 'Yero', color: '#6fb3c4', dark: '#3f7a8a' },
  Z: { name: 'Plywood', color: '#e0a860', dark: '#a8763a' },
  J: { name: 'Baldosa', color: '#4a7fd6', dark: '#2a4f96' },
  L: { name: 'Adobe', color: '#d98a3a', dark: '#9a5a1f' },
  [MUD]: { name: 'Putik', color: '#6b5a3e', dark: '#4a3e2a' },
  [CEMENT]: { name: 'Semento', color: '#9a9d9c', dark: '#6e7170' },
};

const BASE = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

// Every rotation, turning clockwise inside the piece's box (3 wide, or 4 for the I; the O never turns).
export const SHAPES = {};
for (const t of TYPES) {
  const n = t === 'I' ? 4 : 3;
  const rots = [BASE[t]];
  for (let r = 1; r < 4; r++) rots.push(t === 'O' ? BASE.O : rots[r - 1].map(([x, y]) => [n - 1 - y, x]));
  SHAPES[t] = rots;
}

// The standard (SRS) wall kicks, tried in order; written y-down, so the usual table's y is negated.
const up = (list) => list.map(([x, y]) => [x, -y]);
const JLSTZ = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
export const KICKS = { JLSTZ: {}, I: {} };
for (const k of Object.keys(JLSTZ)) { KICKS.JLSTZ[k] = up(JLSTZ[k]); KICKS.I[k] = up(I[k]); }
// Half turns (an option): the SRS+ 180 kicks (as in TETR.IO), the same table for every piece but the O.
const HALF = {
  '02': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
  '13': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
  '20': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
  '31': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]],
};
export const KICKS180 = { JLSTZ: {}, I: {} };
for (const k of Object.keys(HALF)) { KICKS180.JLSTZ[k] = up(HALF[k]); KICKS180.I[k] = up(HALF[k]); }
