// Phase 3's pure parts: the shop and its economy, the login streak, the haptics, the voice's choice
// of source, and the music's layers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, itemById, isOwned, canBuy, buy, equip, unlockMet, coinsFor, DEFAULT_EQUIP } from '../src/shop.mjs';
import { touchStreak, streakBonus, STREAK_CAP, RANKS } from '../src/progress.mjs';
import { hapticFor } from '../src/haptics.mjs';
import { plan, pickVoice, VOICE_SLOTS, VOICE_LINES } from '../src/voice.mjs';
import { musicLevels } from '../src/audio.mjs';
import { createGame, COLS, ROWS } from '../src/game.mjs';

const P = (o = {}) => ({ coins: 0, tokens: 0, owned: [], equip: {}, xp: 0, medals: [], ...o });

test('the catalogue: about six block skins, four outfits, three themes, and a free default of each', () => {
  const by = (k) => ITEMS.filter((i) => i.kind === k);
  assert.ok(by('skin').length >= 6 && by('outfit').length >= 4 && by('theme').length >= 3);
  for (const k of ['skin', 'outfit', 'theme']) { const d = itemById(DEFAULT_EQUIP[k]); assert.equal(d.kind, k); assert.ok(isOwned(d, P())); }
  assert.ok(ITEMS.some((i) => i.unlock && i.unlock.medal) && ITEMS.some((i) => i.unlock && i.unlock.rank !== undefined));
  assert.ok(ITEMS.some((i) => i.price && i.price.tokens) && ITEMS.some((i) => i.price && i.price.coins));
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
});

test('buying with coins or tokens, owning, equipping; medal and rank items are never sold', () => {
  const glazed = itemById('skin-glazed'), parol = itemById('skin-parol'), ginto = itemById('skin-ginto'), pintado = itemById('skin-pintado');
  assert.ok(!canBuy(glazed, P({ coins: 299 })) && canBuy(glazed, P({ coins: 300 })));
  const r = buy(glazed, P({ coins: 350 }));
  assert.ok(r.ok); assert.equal(r.p.coins, 50); assert.ok(isOwned(glazed, r.p)); assert.ok(!canBuy(glazed, r.p));
  assert.ok(!buy(parol, P({ tokens: 1 })).ok); assert.equal(buy(parol, P({ tokens: 2 })).p.tokens, 0);
  assert.ok(!equip(itemById('site-makati'), P()).ok);
  const e = equip(glazed, r.p); assert.ok(e.ok); assert.equal(e.p.equip.skin, 'skin-glazed'); assert.equal(e.p.equip.outfit, DEFAULT_EQUIP.outfit);
  assert.ok(!canBuy(ginto, P({ coins: 1e9, tokens: 99 })) && !isOwned(ginto, P()));
  assert.ok(unlockMet(ginto, P({ xp: RANKS[4].xp })) && isOwned(ginto, P({ xp: RANKS[4].xp })));
  assert.ok(!isOwned(pintado, P()) && isOwned(pintado, P({ medals: ['perpekto'] })));
});

test('barya: a game pays for its lines, kita, Bayanihans, T-spins, finishing, stars and wins', () => {
  assert.equal(coinsFor({ lines: 0, score: 0 }), 0);
  const a = coinsFor({ lines: 40, score: 8000, bayanihan: 2, tspins: 1, done: true });
  assert.equal(a, 60 + 10 + 16 + 6 + 15);
  assert.ok(coinsFor({ lines: 10, score: 1000, win: true }) > coinsFor({ lines: 10, score: 1000 }));
});

const at = (s) => Date.parse(s);
test('the streak: a day more each day, Manila dates, a single grace day, a reset after that, the bonus capped at seven', () => {
  let r = touchStreak(null, at('2026-10-01T09:00:00+08:00'));
  assert.equal(r.st.count, 1); assert.deepEqual(r.bonus, streakBonus(1));
  r = touchStreak(r.st, at('2026-10-01T23:30:00+08:00')); assert.equal(r.bonus, null); assert.equal(r.st.count, 1); // same day
  r = touchStreak(r.st, at('2026-10-01T16:30:00Z')); assert.equal(r.st.count, 2); // 00:30 on the 2nd in Manila
  r = touchStreak(r.st, at('2026-10-03T08:00:00+08:00')); assert.equal(r.st.count, 3);
  r = touchStreak(r.st, at('2026-10-05T08:00:00+08:00')); assert.equal(r.st.count, 4); assert.equal(r.graced, true); // missed the 4th: grace
  r = touchStreak(r.st, at('2026-10-07T08:00:00+08:00')); assert.equal(r.st.count, 1); // missed again: grace already spent
  r = touchStreak(r.st, at('2026-10-08T08:00:00+08:00')); assert.equal(r.st.count, 2);
  r = touchStreak(r.st, at('2026-10-12T08:00:00+08:00')); assert.equal(r.st.count, 1); assert.equal(r.st.best, 4);
  // the clock going back counts nothing
  assert.equal(touchStreak(r.st, at('2026-10-11T08:00:00+08:00')).bonus, null);
  // the bonus grows to the seventh day and stays
  let s = null; const bonuses = [];
  for (let d = 1; d <= 10; d++) { const x = touchStreak(s, at(`2026-11-${String(d).padStart(2, '0')}T12:00:00+08:00`)); s = x.st; bonuses.push(x.bonus.xp); }
  assert.equal(s.count, 10); assert.equal(bonuses[6], bonuses[9]); assert.ok(bonuses[0] < bonuses[6]); assert.equal(STREAK_CAP, 7);
});

test('haptics scale with the moment: a bigger drop or clear buzzes longer and harder; a Bayanihan and a top-out the most', () => {
  const d1 = hapticFor({ type: 'hardDrop', rows: 1 }), d18 = hapticFor({ type: 'hardDrop', rows: 18 });
  assert.ok(d18.ms > d1.ms && d18.strong > d1.strong);
  const l = [1, 2, 3].map((n) => hapticFor({ type: 'lines', n })), bay = hapticFor({ type: 'lines', n: 4 }), over = hapticFor({ type: 'gameover' });
  assert.ok(l[0].ms < l[1].ms && l[1].ms < l[2].ms && l[2].ms < bay.ms && bay.ms < over.ms);
  assert.ok(hapticFor({ type: 'lines', n: 2, spin: 'full' }).strong > l[1].strong);
  for (const h of [d1, bay, over, hapticFor({ type: 'tool' })]) { assert.ok(h.strong <= 1 && h.weak <= 1 && Array.isArray(h.pattern)); }
  assert.equal(hapticFor({ type: 'move' }), null);
});

test('the voice: a recording if there is one, else a Filipino speech voice, else the babble', () => {
  const fil = { lang: 'fil-PH', name: 'Filipino' }, tl = { lang: 'tl', name: 'Tagalog' }, en = { lang: 'en-US', name: 'English' };
  assert.equal(pickVoice([en, fil]), fil); assert.equal(pickVoice([en, tl]), tl); assert.equal(pickVoice([en]), null);
  assert.equal(plan('bayanihan', { files: new Set(['bayanihan']), voice: fil }), 'file');
  assert.equal(plan('tspin', { files: new Set(['bayanihan']), voice: fil }), 'speech');
  assert.equal(plan('win', { files: new Set(), voice: null }), 'blip');
  assert.deepEqual(VOICE_SLOTS, ['bayanihan', 'tspin', 'rankup', 'neardeath', 'win', 'lose']);
  for (const s of VOICE_SLOTS) assert.ok(VOICE_LINES[s]);
});

test('the music builds: tension with the stack, rhythm with a combo', () => {
  const g = createGame({ seed: 1 });
  assert.deepEqual(musicLevels(g), { tension: 0, rhythm: 0 });
  for (let y = ROWS - 12; y < ROWS; y++) g.board[y * COLS] = 8;
  const mid = musicLevels(g).tension;
  for (let y = ROWS - 18; y < ROWS; y++) g.board[y * COLS] = 8;
  assert.ok(mid > 0 && musicLevels(g).tension > mid && musicLevels(g).tension <= 1);
  g.combo = 1; const r1 = musicLevels(g).rhythm; g.combo = 6;
  assert.ok(r1 > 0 && musicLevels(g).rhythm > r1);
});
