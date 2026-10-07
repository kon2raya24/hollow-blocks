// The English option: t() swaps and fills; every line the game shows has an English one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { t, setLang } from '../src/i18n.mjs';
import { EN } from '../src/lang-en.mjs';

test('t() keeps Filipino, swaps to English, and fills {names} either way', () => {
  setLang('fil');
  assert.equal(t('Kulang pa ng {n} barya', { n: 5 }), 'Kulang pa ng 5 barya');
  setLang('en');
  const k = Object.keys(EN)[0];
  if (k) assert.equal(t(k), EN[k]);
  assert.equal(t('wala sa diksyunaryo'), 'wala sa diksyunaryo', 'a missing line stays as written');
  setLang('fil');
});

// Every line handed to t() / tr() in the code, and every word on the page, has its English.
import { readFileSync, readdirSync } from 'node:fs';
const SKIP = /^(hollowblocks|assets\/|data-|[a-z-]+\.(mjs|json|glb|mp3|png|jpg)$)|=>|\$\(|\btr\(/; // file names, keys, code
const KEEP = new Set([ // the same in both: names, game words, English already
  'AUTO 3×', 'BAHAY', 'Best', 'HOLLOW BLOCKS', 'Bahay', 'Replay', 'Ranking', 'Account', 'Menu', 'REPLAY', 'Kapatas:', 'Phone:', 'Controller:', 'Bayanihan:',
  'Space,', 'Streak:', 'Pagsasanay:', 'A falling-block game by', 'Lemmuel Turaya', 'More games', '☕ Support', 'Privacy', 'About', 'How to play', 'Sound', 'Difficulty', 'A house you built',
  'Mode', 'Controls', 'Turn anticlockwise', 'Left', 'Soft drop', 'Right', 'Turn clockwise', 'Hard drop', 'Hold', 'Use a tool', 'Play or pause', 'Share',
  'Camera', 'Graphics', 'Auto', 'Normal', 'Brownout', 'Deadline', 'Daily', 'Rejected', 'Hollow block', 'Plywood', 'Adobe', 'Mason', 'Apartment', 'Condo Tower',
  'T-spin Triple', 'Combo ×10', 'Retro', 'Capiz', 'Barong', 'Jersey', 'Santa', 'Barangay', 'Makati', 'Beach Resort', 'Site', 'T-spin Single', 'T-spin Double',
  '4-wide Combo', 'Finesse', 'Bayanihan', 'T-spin',
  'kawayan', 'putik', 'lang', // code: material keys, the setting's key
  'Aling Nena · may yelo', // the sari-sari store's sign, painted on the 3D site
]);
test('every line in the code has its English', () => {
  const missing = [];
  for (const f of readdirSync('src').filter((x) => x.endsWith('.mjs') && x !== 'lang-en.mjs' && x !== 'i18n.mjs')) {
    const src = readFileSync(`src/${f}`, 'utf8');
    for (const m of src.matchAll(/\b(?:tr|tl|t|lang18)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const s = m[2].replace(/\\(['"`\\])/g, '$1');
      if (!(s in EN) && !KEEP.has(s)) missing.push(`${f}: ${s}`);
    }
  }
  assert.deepEqual(missing, []);
});
test('every word on the page has its English', () => {
  const html = readFileSync('index.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const body = html.slice(html.indexOf('<body')), missing = [];
  const ent = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  for (const m of body.matchAll(/>([^<>]+)</g)) { const s = ent(m[1].trim()); if (/[A-Za-z]{2}/.test(s) && !(s in EN) && !KEEP.has(s) && !/^[A-Z]?\d|^[A-Z]$/.test(s)) missing.push(s); }
  for (const m of body.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]+)"/g)) { const s = ent(m[1]); if (!(s in EN) && !KEEP.has(s) && !/^A (construction site|house)/.test(s)) missing.push(s); }
  assert.deepEqual([...new Set(missing)], []);
});

// Lists shown through a translating spot (Kapatas's lines, tips, key names, mode lines, the Inspector):
// every Filipino literal in the game's code has its English, not only the ones handed to tr().
const FIL = /\b(ang|ng|mga|sa|na|ka|mo|pa|lang|muna|wala|walang|hindi|bawat|para|may|kita|hanay|laro|ito|ikaw|lahat|palapag|putik|piraso|araw|natin|tayo|yan|ayan|kawayan|baha|isa|ulit)\b/i;
test('every Filipino line in the code has its English', () => {
  const missing = [];
  for (const f of readdirSync('src').filter((x) => x.endsWith('.mjs') && !['lang-en.mjs', 'i18n.mjs'].includes(x))) {
    const src = readFileSync(`src/${f}`, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').replace(/\/\/[^\n'"`]*$/gm, '');
    for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      const s = m[2].replace(/\\(['"`\\])/g, '$1');
      if (s.includes('${') || s.length < 4 || !FIL.test(s) || !/[a-z]{3}/.test(s)) continue;
      if (!(s in EN) && !KEEP.has(s) && !SKIP.test(s)) missing.push(`${f}: ${s}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

// The game's data, read where it's shown: names, descriptions, briefs, rival talk, lessons, Kapatas's voice.
import { CONTRACTS, CHAPTERS } from '../src/contracts.mjs';
import { MODES, DIFFICULTY } from '../src/game.mjs';
import { MATERIALS } from '../src/pieces.mjs';
import { RANKS, STYLES, MEDALS, EVENTS, WEEKLY_MEDALS } from '../src/progress.mjs';
import { ITEMS, KINDS } from '../src/shop.mjs';
import { LESSONS } from '../src/training.mjs';
import { LEVELS, LADDER } from '../src/versus.mjs';
import { VOICE_LINES } from '../src/voice.mjs';
test('every name, description and line in the data has its English', () => {
  const want = [
    ...CONTRACTS.flatMap((c) => [c.name, c.brief]), ...CHAPTERS.map((c) => c.name),
    ...Object.values(MODES).map((m) => m.name), ...Object.values(DIFFICULTY).map((d) => d.name), ...Object.values(MATERIALS).map((m) => m.name),
    ...RANKS.map((r) => r.name), ...STYLES.map((s) => s.name), ...MEDALS.flatMap((m) => [m.name, m.desc]),
    ...EVENTS.flatMap((e) => [e.name, e.blurb]), ...WEEKLY_MEDALS.flatMap((m) => [m.name, m.desc]),
    ...ITEMS.flatMap((i) => [i.name, i.desc]), ...Object.values(KINDS),
    ...LESSONS.flatMap((l) => [l.name, l.brief, l.tip]), ...Object.values(LEVELS).map((l) => l.name),
    ...LADDER.flatMap((r) => [r.tag, r.blurb, ...Object.values(r.says).flat()]), ...Object.values(VOICE_LINES),
    'Martilyo', 'Semento', 'Kreyn', 'Pison', 'Merienda', 'Plumada', 'Barena', 'Andamyo',
  ].filter((s) => typeof s === 'string' && s);
  const missing = [...new Set(want)].filter((s) => !(s in EN) && !KEEP.has(s));
  assert.deepEqual(missing, []);
});
test('every ALL-CAPS Filipino word drawn in the 3D site, the 2D board or the page has its English', () => {
  const W = /\b(SA|NG|ANG|NA|MAY|PA|ISANG|HANAY|PALAPAG|PUTIK|HARANG|KITA|ORAS|TALA|SUSUNOD|IMBAK|KALABAN|LINDOL|MALINIS|TAPOS|PASADO|ULIT|LABAN|TABLA|PANALO|DALAWA|TATLO|SUNOD|TULOY|HANGIN|ILAW|MEDALYA|GAMIT|ISTILO|NGAYONG|LINGGO|BAHAY|RONDA|INSPEKTOR|MARTILYO|SEMENTO|KREYN|PISON|MERIENDA|PLUMADA|BARENA|ANDAMYO|SINALO|TAPATAN)\b/;
  const missing = [];
  for (const f of ['view3d.mjs', 'render.mjs', 'site.mjs', 'fx.mjs', 'main.mjs']) for (const m of readFileSync(`src/${f}`, 'utf8').matchAll(/'([A-Z][A-Z0-9 ·!×+\-→←]{3,})'/g)) if (W.test(m[1]) && !(m[1] in EN)) missing.push(`${f}: ${m[1]}`);
  assert.deepEqual(missing, []);
});
test('English counts: one line, two lines; the countdown in d and h', async () => {
  const { countdown } = await import('../src/progress.mjs');
  setLang('en');
  assert.equal(t('{n} hanay', { n: 1 }), '1 line');
  assert.equal(t('{n} hanay', { n: 2 }), '2 lines');
  assert.equal(t('{n} PALAPAG', { n: 1 }), '1 FLOOR');
  assert.equal(countdown((3 * 24 + 12) * 3600e3 + 5000), '3d 12h');
  setLang('fil');
  assert.equal(t('{n} hanay', { n: 1 }), '1 hanay');
  assert.equal(countdown((3 * 24 + 12) * 3600e3 + 5000), '3a 12o');
});
