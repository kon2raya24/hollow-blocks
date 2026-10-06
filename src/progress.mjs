import { TOOLS } from './game.mjs';
import { t as tl } from './i18n.mjs';
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
export function shareText(key, r, url = true) { // url: off on a portal (no links out)
  const bricks = Math.max(1, Math.min(10, Math.round(r.lines / 4)));
  return `Hollow Blocks Daily ${key}\n₱${Math.floor(r.score).toLocaleString('en-US')} · ${tl('{n} hanay', { n: r.lines })}${r.bayanihan ? ` · ${r.bayanihan}× Bayanihan` : ''}\n${'🧱'.repeat(bricks)}${url ? '\nhttps://hollow-blocks.vercel.app' : ''}`;
}

// ---------- tools by rank: the plumada at Kapatas, the barena at Inhinyero, the andamyo at Arkitekto ----------
export const TOOL_RANK = { plumada: 2, barena: 3, andamyo: 4 };
export function toolsetFor(xp) { const r = rankOf(xp).index; return [...TOOLS, ...Object.keys(TOOL_RANK).filter((t) => r >= TOOL_RANK[t])]; }

// ---------- the weekly event: one twist a week by the ISO week (Manila time), the same for everyone ----------
// Each is three minutes for the most kita on a twisted ruleset; finishing one earns its medal, and the
// first finish of a week banks a token (spent in a later update).
export const EVENTS = [
  { id: 'bagyo', name: 'Bagyo Week', blurb: 'Tumataas ang putik buong linggo. Tatlong minuto, pinakamataas na kita.', contract: { rise: { start: 540, fastest: 240, step: 15 } } },
  { id: 'lindol', name: 'Lindol Week', blurb: 'Lumilindol tuwing 20 segundo: dumudulas ang tumpok.', contract: { lindol: 20 * 60 } },
  { id: 'gamit', name: 'Gamit Lang', blurb: 'Tools only: bawat ikaapat na piraso, may bagong gamit.', contract: { tools: true, toolEvery: 4 } },
  { id: 'mabilis', name: 'Mabilis', blurb: '20G: bumabagsak agad ang bawat piraso. Bilis ng isip!', contract: { g20: true } },
  { id: 'retro', name: 'Retro', blurb: 'Lumang patakaran: walang imbak, walang anino, isang susunod lang, walang wall kick.', contract: { retro: true } },
];
export const WEEKLY_MEDALS = EVENTS.map((e) => ({ id: `wk-${e.id}`, name: e.name, desc: `Natapos ang ${e.name}` }));
const DAY = 86400e3, EPOCH = Date.UTC(2026, 0, 5); // a Monday (ISO week 2 of 2026)
// the Monday (Manila) a time falls in, as a UTC day number
const mondayOf = (now) => { const d = Math.floor((now + 8 * 3600e3) / DAY) * DAY, wd = (new Date(d).getUTCDay() + 6) % 7; return d - wd * DAY; };
export function isoWeek(now = Date.now()) {
  const d = new Date(mondayOf(now) + 3 * DAY); // the week's Thursday decides its year
  const y = d.getUTCFullYear(), jan4 = Date.UTC(y, 0, 4), wk = 1 + Math.round((mondayOf(d.getTime() - 8 * 3600e3) - mondayOf(jan4 - 8 * 3600e3)) / (7 * DAY));
  return `${y}-W${String(wk).padStart(2, '0')}`;
}
export function weeklyEvent(now = Date.now()) {
  const n = Math.round((mondayOf(now) - EPOCH) / (7 * DAY));
  const ev = EVENTS[((n % EVENTS.length) + EVENTS.length) % EVENTS.length];
  const ends = mondayOf(now) + 7 * DAY - 8 * 3600e3; // next Monday, midnight in Manila
  return { ...ev, week: isoWeek(now), ends, left: ends - now, next: EVENTS[(((n + 1) % EVENTS.length) + EVENTS.length) % EVENTS.length] };
}
export function countdown(ms) { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? tl('{d}a {h}o', { d, h }) : h ? tl('{h}o {m}m', { h, m }) : `${m}m ${s % 60}s`; } // a: araw (days), o: oras (hours)

// ---------- the daily login streak: a day more each day you come back (Manila dates), one grace day
// that covers a single missed day, and a bonus that grows to the seventh day ----------
export const STREAK_CAP = 7;
export const streakBonus = (n) => { const d = Math.max(1, Math.min(STREAK_CAP, n)); return { xp: 25 * d, coins: 10 * d }; };
const dayNum = (key) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86400e3);
// st: { count, best, last (a date key), grace (used in this run) } → { st, bonus, graced }
export function touchStreak(st, now = Date.now()) {
  const s = { count: 0, best: 0, last: null, grace: false, ...(st || {}) }, today = dateKey(now);
  if (s.last && dayNum(today) - dayNum(s.last) <= 0) return { st: s, bonus: null, graced: false }; // already counted today (or the clock went back)
  const gap = s.last ? dayNum(today) - dayNum(s.last) : null;
  let graced = false;
  if (gap === 1) s.count++;
  else if (gap === 2 && !s.grace) { s.count++; s.grace = true; graced = true; }
  else { s.count = 1; s.grace = false; }
  s.last = today; s.best = Math.max(s.best, s.count);
  return { st: s, bonus: streakBonus(s.count), graced };
}
