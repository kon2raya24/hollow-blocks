// Progression, pure: XP from every game, the ranks (Peon to Arkitekto), the medals, the house styles
// each rank unlocks, the stats, and the Daily's date seed and spoiler-free share text.
export const RANKS = [
  { name: 'Peon', xp: 0 }, { name: 'Mason', xp: 1500 }, { name: 'Kapatas', xp: 5000 }, { name: 'Inhinyero', xp: 12000 }, { name: 'Arkitekto', xp: 25000 },
];
// what a game earns: lines, kita, the big clears, stars, and a little for finishing
export function xpFor(r) {
  return Math.round(r.lines * 10 + r.score / 100 + r.bayanihan * 50 + r.tspins * 40 + (r.stars || 0) * 120 + (r.done ? 50 : 0) + (r.daily ? 100 : 0));
}
export function rankOf(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1] || null;
  return { index: i, name: RANKS[i].name, next: next ? next.name : null, need: next ? next.xp - xp : 0, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}
// the house rising next door, by rank
export const STYLES = [
  { id: 'apartment', name: 'Apartment', rank: 0 }, { id: 'kubo', name: 'Bahay Kubo', rank: 1 },
  { id: 'bato', name: 'Bahay na Bato', rank: 2 }, { id: 'condo', name: 'Condo Tower', rank: 3 },
];
export const styleOpen = (xp, id) => { const s = STYLES.find((x) => x.id === id); return !!s && rankOf(xp).index >= s.rank; };

// Medals: checked at the end of a game, against the game (r) and the player's profile (p).
export const MEDALS = [
  { id: 'unang', name: 'Unang Bayanihan', desc: 'Apat na hanay nang sabay', test: (r) => r.bayanihan > 0 },
  { id: 'tst', name: 'T-spin Triple', desc: 'Isang T-spin triple', test: (r) => r.tspinTriple > 0 },
  { id: 'combo10', name: 'Tuloy-tuloy', desc: 'Combo ×10', test: (r) => r.maxCombo >= 10 },
  { id: 'perpekto', name: 'Malinis', desc: 'Perfect clear: walang natirang bloke', test: (r) => r.perfect > 0 },
  { id: 'palapag10', name: 'Sampung Palapag', desc: 'Umabot sa ika-10 palapag', test: (r) => r.level >= 10 },
  { id: 'deadline2', name: 'Pasok sa Oras', desc: 'Deadline sa loob ng 2 minuto', test: (r) => r.mode === 'deadline' && r.done && r.ticks <= 120 * 60 },
  { id: 'bagyo3', name: 'Matibay sa Bagyo', desc: 'Tatlong minuto sa Bagyo', test: (r) => r.mode === 'bagyo' && r.ticks >= 180 * 60 },
  { id: 'karera', name: 'Karerista', desc: '₱20,000 sa isang Karera', test: (r) => r.mode === 'karera' && r.score >= 20000 },
  { id: 'gamit', name: 'Kumpleto sa Gamit', desc: 'Gumamit ng 10 gamit', test: (r, p) => (p.stats.tools || 0) >= 10 },
  { id: 'brgy', name: 'Bida sa Barangay', desc: 'Lahat ng bituin sa isang barangay', test: (r, p) => [0, 1, 2].some((b) => p.brgyStars && p.brgyStars[b] >= 15) },
  { id: 'daily', name: 'Araw-araw', desc: 'Naglaro ng Daily', test: (r) => r.mode === 'daily' },
  { id: 'arkitekto', name: 'Arkitekto', desc: 'Naabot ang pinakamataas na ranggo', test: (r, p) => rankOf(p.xp).index === RANKS.length - 1 },
];
export function newMedals(r, p) { return MEDALS.filter((m) => !p.medals.includes(m.id) && m.test(r, p)).map((m) => m.id); }

// Totals across every game, for the stats page.
export function addStats(st, r) {
  const o = { games: 0, lines: 0, bayanihan: 0, tspins: 0, tools: 0, seconds: 0, pieces: 0, ...st };
  o.games++; o.lines += r.lines; o.bayanihan += r.bayanihan; o.tspins += r.tspins; o.tools += r.tools || 0; o.seconds += Math.round(r.ticks / 60); o.pieces += r.pieces || 0;
  return o;
}

// The Daily: everyone gets the same pieces on the same date (in Manila time).
export function dateKey(now = Date.now()) { return new Date(now + 8 * 3600e3).toISOString().slice(0, 10); }
export function dailySeed(key) {
  let h = 2166136261;
  for (const ch of `hollowblocks:${key}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % 1e9;
}
// a share line with no spoilers: the score and lines, and a row of blocks for how it went
export function shareText(key, r) {
  const bricks = Math.max(1, Math.min(10, Math.round(r.lines / 4)));
  return `Hollow Blocks Daily ${key}\n₱${Math.floor(r.score).toLocaleString('en-US')} · ${r.lines} hanay${r.bayanihan ? ` · ${r.bayanihan}× Bayanihan` : ''}\n${'🧱'.repeat(bricks)}\nhttps://hollow-blocks.vercel.app`;
}
