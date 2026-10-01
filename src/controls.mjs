// The controls, pure: which player and action a key belongs to, and each player's input as the rules
// want it (the keys pressed since the last tick, the keys held). Solo play has one map; Tapatan has a
// map per player (player 1 on the left of the keyboard, player 2 on the arrows), either of which can
// be a controller instead.
export const DEF_KEYS = { left: ['ArrowLeft', 'a'], right: ['ArrowRight', 'd'], down: ['ArrowDown', 's'], hard: [' '], cw: ['ArrowUp', 'x', 'w'], ccw: ['z', 'q'], r180: ['v'], hold: ['c', 'Shift'], tool: ['e'], pause: ['p', 'Escape'] };
export const DEF_KEYS_P1 = { left: ['a'], right: ['d'], down: ['s'], hard: ['w'], cw: ['e'], ccw: ['q'], r180: ['x'], hold: ['c'], tool: [], pause: ['Escape'] };
export const DEF_KEYS_P2 = { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], hard: ['ArrowUp'], cw: ['.'], ccw: [','], r180: ['l'], hold: ['/'], tool: [], pause: ['p'] };
export const DEF_PAD = { cw: [0], ccw: [1], tool: [2], hold: [3, 4, 5, 6, 7], hard: [12], r180: [], pause: [9] };
export const HELD = new Set(['left', 'right', 'down']);

// key → { p, act } over the players' maps (the first map that has a key wins, so player 1 on a clash).
export function routes(maps) {
  const r = new Map();
  maps.forEach((m, p) => { if (m) for (const [act, keys] of Object.entries(m)) for (const k of keys) if (!r.has(k)) r.set(k, { p, act }); });
  return r;
}
// Keys bound twice across the maps: [{ key, a: { p, act }, b: { p, act } }]
export function clashes(maps) {
  const seen = new Map(), out = [];
  maps.forEach((m, p) => { if (m) for (const [act, keys] of Object.entries(m)) for (const k of keys) { if (seen.has(k)) out.push({ key: k, a: seen.get(k), b: { p, act } }); else seen.set(k, { p, act }); } });
  return out;
}

// One player's input between ticks.
export function createInput() { return { pressed: [], held: new Set() }; }
export function press(inp, act, down, repeat = false) {
  if (down) { if (!repeat && act !== 'down') inp.pressed.push(act); if (HELD.has(act)) inp.held.add(act); }
  else if (HELD.has(act)) inp.held.delete(act);
}
export function drain(inp) { const out = { pressed: inp.pressed, held: [...inp.held] }; inp.pressed = []; return out; }
export function clearInput(inp) { inp.pressed = []; inp.held.clear(); }
// A key event routed to its player: true if it was theirs.
export function keyTo(players, table, key, down, repeat = false) {
  const r = table.get(key);
  if (!r || !players[r.p] || r.act === 'pause') return r || null;
  press(players[r.p], r.act, down, repeat);
  return r;
}
