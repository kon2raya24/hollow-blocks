// Proyekto: fifteen contracts across three barangays. Each is a job order from Kapatas: a goal, a
// twist, a par for the stars. Finishing earns one star; beating the par for two and three earns more.
// Pure data and maths, so the tests can check every goal and every threshold.
const MIN = 60 * 60, SEC = 60;
// Pars come from the bot playing every contract at a strong human's pace (8 ticks between keys,
// about 1.3 pieces a second): three stars is about its time; two is a comfortable, steady game.
// Diskarte (ml1), Sunod-sunod (ml2) and Tatlong T-spin (bs4) need T-spins and combos the bot doesn't
// play: their pars are set for a person. Unang Bayanihan (sr5) is benchmarked with the bot's Bayanihan style.
// star: { by: 'time' (seconds, lower is better) | 'pieces' (lower is better) | 'score' | 'lines' (higher), two, three }
export const CONTRACTS = [
  // Barangay San Roque: learning the trade
  { id: 'sr1', brgy: 0, name: 'Pundasyon', brief: 'Maglatag muna ng pundasyon: walong hanay.', goal: { lines: 8 }, star: { by: 'time', two: 40, three: 24 } },
  { id: 'sr2', brgy: 0, name: 'Dalawang Imbak', brief: 'Labindalawang hanay, pero dalawang beses lang puwedeng mag-imbak.', goal: { lines: 12 }, holdLimit: 2, star: { by: 'time', two: 55, three: 34 } },
  { id: 'sr3', brgy: 0, name: 'Ikalawang Palapag', brief: 'Umabot sa ikalawang palapag (10 hanay) sa loob ng 3 minuto.', goal: { lines: 10 }, limit: 3 * MIN, star: { by: 'time', two: 45, three: 28 } },
  { id: 'sr4', brgy: 0, name: 'Kalat sa Pundasyon', brief: 'May naiwang kalat sa pundasyon. Linisin lahat ng putik.', goal: { garbage: true }, garbage: 5, tools: false, star: { by: 'pieces', two: 22, three: 15 } },
  { id: 'sr5', brgy: 0, name: 'Unang Bayanihan', brief: 'Apat na hanay nang sabay. Ipunin ang kawayan!', goal: { bayanihan: 1 }, star: { by: 'time', two: 45, three: 22 } },
  // Barangay Malinta: tricks of the trade
  { id: 'ml1', brgy: 1, name: 'Diskarte', brief: 'Dalawang T-spin. Iikot ang ladrilyo papasok!', goal: { tspins: 2 }, star: { by: 'time', two: 150, three: 90 } },
  { id: 'ml2', brgy: 1, name: 'Sunod-sunod', brief: 'Apat na sunod-sunod na clear (combo ×4).', goal: { combo: 4 }, star: { by: 'time', two: 110, three: 60 } },
  { id: 'ml3', brgy: 1, name: 'Ulan sa Gabi', brief: 'Tumagal nang 90 segundo habang tumataas ang putik.', goal: { survive: 90 * SEC }, rise: { start: 420, fastest: 240, step: 20 }, star: { by: 'lines', two: 24, three: 40 } },
  { id: 'ml4', brgy: 1, name: 'Lindol!', brief: 'Kumita ng ₱6,000 kahit lumilindol tuwing 30 segundo.', goal: { score: 6000 }, lindol: 30 * SEC, star: { by: 'time', two: 100, three: 60 } },
  { id: 'ml5', brgy: 1, name: 'Mabilisang Kontrata', brief: 'Dalawampung hanay sa 2:30, simula sa ika-5 palapag.', goal: { lines: 20 }, limit: 150 * SEC, startLevel: 5, star: { by: 'time', two: 85, three: 55 } },
  // Barangay Bagong Silang: the hard jobs
  { id: 'bs1', brgy: 2, name: 'Gibaan', brief: 'Siyam na hanay ng kalat. Linisin, tipid sa piraso.', goal: { garbage: true }, garbage: 9, tools: false, star: { by: 'pieces', two: 40, three: 28 } },
  { id: 'bs2', brgy: 2, name: 'Walang Imbak', brief: 'Labinlimang hanay, walang imbak.', goal: { lines: 15 }, holdLimit: 0, star: { by: 'time', two: 65, three: 40 } },
  { id: 'bs3', brgy: 2, name: 'Bagyo at Lindol', brief: 'Dalawang minuto: putik mula sa ilalim, lindol tuwing 30 segundo.', goal: { survive: 120 * SEC }, rise: { start: 480, fastest: 260, step: 15 }, lindol: 30 * SEC, star: { by: 'lines', two: 28, three: 45 } },
  { id: 'bs4', brgy: 2, name: 'Tatlong T-spin', brief: 'Tatlong T-spin bago matapos ang 4 na minuto.', goal: { tspins: 3 }, limit: 4 * MIN, star: { by: 'time', two: 210, three: 150 } },
  { id: 'bs5', brgy: 2, name: 'Ang Huling Bahay', brief: 'Apat na palapag (40 hanay) sa 5 minuto, simula sa ika-3.', goal: { lines: 40 }, limit: 5 * MIN, startLevel: 3, star: { by: 'time', two: 170, three: 105 } },
];
export const BARANGAYS = ['San Roque', 'Malinta', 'Bagong Silang'];
export const contractById = (id) => CONTRACTS.find((c) => c.id === id) || null;

// Stars for a finished contract: 0 if it failed, else 1, 2 or 3 by its par.
export function starsFor(c, r) {
  if (!r.done) return 0;
  const s = c.star, v = s.by === 'time' ? r.ticks / 60 : s.by === 'pieces' ? r.pieces : s.by === 'score' ? r.score : r.lines;
  const better = (lim) => (s.by === 'time' || s.by === 'pieces' ? v <= lim : v >= lim);
  return better(s.three) ? 3 : better(s.two) ? 2 : 1;
}
// A contract opens once the one before it has at least one star; the first of each barangay opens once
// the barangay before has 8 stars.
export function unlocked(progress, id) {
  const i = CONTRACTS.findIndex((c) => c.id === id);
  if (i <= 0) return i === 0;
  const c = CONTRACTS[i], prev = CONTRACTS[i - 1];
  if (prev.brgy !== c.brgy) return brgyStars(progress, prev.brgy) >= 8;
  return (progress[prev.id] || 0) > 0;
}
export const brgyStars = (progress, b) => CONTRACTS.filter((c) => c.brgy === b).reduce((a, c) => a + (progress[c.id] || 0), 0);
// the description of a contract's goal and twist, for its card
export function describe(c) {
  const q = c.goal, out = [];
  if (q.lines) out.push(`${q.lines} hanay`);
  if (q.tspins) out.push(`${q.tspins} T-spin`);
  if (q.bayanihan) out.push(`${q.bayanihan} Bayanihan`);
  if (q.combo) out.push(`combo ×${q.combo}`);
  if (q.score) out.push(`₱${q.score.toLocaleString('en-US')}`);
  if (q.survive) out.push(`tumagal ${q.survive / 3600 >= 1 ? `${q.survive / 3600} min` : `${q.survive / 60} s`}`);
  if (q.garbage) out.push('linisin ang kalat');
  const tw = [];
  if (c.limit) tw.push(`⏱ ${Math.floor(c.limit / 3600)}:${String((c.limit / 60) % 60).padStart(2, '0')}`);
  if (c.holdLimit !== undefined) tw.push(c.holdLimit === 0 ? 'walang imbak' : `${c.holdLimit} imbak lang`);
  if (c.rise) tw.push('tumataas ang putik');
  if (c.lindol) tw.push('lindol');
  if (c.startLevel) tw.push(`ika-${c.startLevel} palapag`);
  if (c.tools === false) tw.push('walang gamit');
  const s = c.star, unit = s.by === 'time' ? 's' : s.by === 'pieces' ? ' piraso' : s.by === 'lines' ? ' hanay' : '';
  return { goal: out.join(' · '), twist: tw.join(' · '), par: `★★ ${s.by === 'time' || s.by === 'pieces' ? '≤' : '≥'} ${s.two}${unit} · ★★★ ${s.by === 'time' || s.by === 'pieces' ? '≤' : '≥'} ${s.three}${unit}` };
}
