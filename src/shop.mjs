// Tindahan (the shop) and the locker, pure: the catalogue, what is owned, buying with barya (coins,
// earned from every game) or tokens (from the weekly event), and what is equipped. Some items are
// never sold: a medal or a rank opens them.
import { rankOf } from './progress.mjs';

export const KINDS = { skin: 'Bloke', outfit: 'Kapatas', theme: 'Site' };
export const ITEMS = [
  // block skins: each keeps the materials readable (the pattern of every piece stays its own)
  { id: 'skin-klasiko', kind: 'skin', name: 'Klasiko', desc: 'Ang orihinal na materyales.', price: null, swatch: ['#c4553a', '#b9c95a', '#4a7fd6'] },
  { id: 'skin-glazed', kind: 'skin', name: 'Makintab', desc: 'Pinakinang na baldosa: may glaze ang bawat bloke.', price: { coins: 300 }, swatch: ['#e85a3a', '#7ad04a', '#3a8aff'] },
  { id: 'skin-capiz', kind: 'skin', name: 'Capiz', desc: 'Kabibe ng capiz: maputi at kumikinang na parang perlas.', price: { coins: 500 }, swatch: ['#f4ead8', '#e8f0e0', '#e0e8f4'] },
  { id: 'skin-neon', kind: 'skin', name: 'Neon sa Gabi', desc: 'Madilim na bloke, maliwanag na gilid. Para sa gabi.', price: { coins: 800 }, swatch: ['#ff2a8a', '#2affd0', '#8a5aff'] },
  { id: 'skin-parol', kind: 'skin', name: 'Parol', desc: 'Paskong Pinoy: bawat bloke ay isang ilaw na parol.', price: { tokens: 2 }, swatch: ['#ff3a3a', '#ffd23f', '#2ac84a'] },
  { id: 'skin-pintado', kind: 'skin', name: 'Pintado', desc: 'Pinintahang pastel. Para sa may medalyang Malinis.', unlock: { medal: 'perpekto' }, swatch: ['#ffb0c8', '#b0e8d0', '#c8c0ff'] },
  { id: 'skin-ginto', kind: 'skin', name: 'Ginto', desc: 'Purong ginto. Para lang sa mga Arkitekto.', unlock: { rank: 4 }, swatch: ['#ffe08a', '#e8b030', '#c88a10'] },
  // Kapatas's outfits
  { id: 'fit-kapatas', kind: 'outfit', name: 'Pang-trabaho', desc: 'Vest, hard hat at tuwalya.', price: null, swatch: ['#ff8a1a', '#2f5fb8', '#ffc81e'] },
  { id: 'fit-barong', kind: 'outfit', name: 'Barong', desc: 'Pormal para sa blessing ng bahay.', price: { coins: 400 }, swatch: ['#f2ead2', '#1e1e26', '#ffc81e'] },
  { id: 'fit-jersey', kind: 'outfit', name: 'Jersey', desc: 'Pang-liga sa barangay: numero 23.', price: { coins: 300 }, swatch: ['#e8384f', '#ffffff', '#ffc81e'] },
  { id: 'fit-kapote', kind: 'outfit', name: 'Kapote', desc: 'Dilaw na kapote para sa bagyo.', unlock: { medal: 'bagyo3' }, swatch: ['#ffd23f', '#2a5ab8', '#3a3a3a'] },
  { id: 'fit-santa', kind: 'outfit', name: 'Santa', desc: 'Ho ho ho! Simbang gabi na.', price: { tokens: 3 }, swatch: ['#d8222a', '#ffffff', '#1a1a1a'] },
  // site themes: the same well, a different place around it
  { id: 'site-barangay', kind: 'theme', name: 'Barangay', desc: 'Ang kanto, ang sari-sari store, ang golden hour.', price: null, swatch: ['#e8b8a0', '#a8c4e8', '#b8a48a'] },
  { id: 'site-makati', kind: 'theme', name: 'Makati', desc: 'Sa paanan ng mga high-rise: salamin at ilaw ng lungsod.', price: { coins: 1200 }, swatch: ['#3a5a8a', '#8ab8e8', '#ffd890'] },
  { id: 'site-resort', kind: 'theme', name: 'Beach Resort', desc: 'Puting buhangin, dagat at payong sa tabi ng site.', price: { tokens: 4 }, swatch: ['#f4e4c0', '#2ab8d8', '#ff8a5a'] },
  { id: 'site-probinsya', kind: 'theme', name: 'Probinsya', desc: 'Palayan, bundok at bahay-kubo. Para sa mga Kapatas.', unlock: { rank: 2 }, swatch: ['#6ab84a', '#a8c870', '#5a7a9a'] },
];
export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
export const DEFAULT_EQUIP = { skin: 'skin-klasiko', outfit: 'fit-kapatas', theme: 'site-barangay' };
// p: { coins, tokens, owned: [], equip: {}, xp, medals: [] }
export function unlockMet(item, p) {
  const u = item.unlock;
  if (!u) return false;
  if (u.rank !== undefined) return rankOf(p.xp || 0).index >= u.rank;
  if (u.medal) return (p.medals || []).includes(u.medal);
  return false;
}
export const isOwned = (item, p) => !item.price && !item.unlock ? true : (p.owned || []).includes(item.id) || unlockMet(item, p);
export function canBuy(item, p) {
  if (isOwned(item, p) || !item.price) return false;
  return (p.coins || 0) >= (item.price.coins || 0) && (p.tokens || 0) >= (item.price.tokens || 0);
}
export function buy(item, p) {
  if (!canBuy(item, p)) return { ok: false, p };
  return { ok: true, p: { ...p, coins: p.coins - (item.price.coins || 0), tokens: p.tokens - (item.price.tokens || 0), owned: [...(p.owned || []), item.id] } };
}
export function equip(item, p) {
  if (!isOwned(item, p)) return { ok: false, p };
  return { ok: true, p: { ...p, equip: { ...DEFAULT_EQUIP, ...(p.equip || {}), [item.kind]: item.id } } };
}
// what a game pays in barya
export function coinsFor(r) {
  return Math.max(0, Math.round(r.lines * 1.5 + r.score / 800 + (r.bayanihan || 0) * 8 + (r.tspins || 0) * 6 + (r.done ? 15 : 0) + (r.stars || 0) * 20 + (r.win ? 40 : 0)));
}
