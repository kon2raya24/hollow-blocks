// The page: screens, modes, settings, input (keys, touch gestures and buttons, a controller), the loop,
// sound, saves and hints. The rules live in game.mjs; the 3D site in view3d.mjs, and if WebGL won't
// start, the old 2D drawing in render.mjs takes over and the game plays the same.
import { createGame, step, MODES, DIFFICULTY, cellsOf, pendingRows, TOOLS } from './game.mjs';
import { bot } from './bot.mjs';
import { createMatch, matchStep, LADDER, LEVELS, rivalById, ladderOpen } from './versus.mjs';
import { createRecorder, record, encode, decode, startPlayback, playTick, runToEnd } from './replay.mjs';
import { LESSONS, lessonById, lessonFor, lessonGame, judge, createCoach, coachTick } from './training.mjs';
import { DEF_KEYS_P1, DEF_KEYS_P2, routes, createInput, press as pressIn, drain, clearInput as clearIn } from './controls.mjs';
import { ranked } from './bot.mjs';
import { ITEMS, KINDS, itemById, isOwned, canBuy, buy, equip, unlockMet, coinsFor, DEFAULT_EQUIP, shortfall } from './shop.mjs';
import { hapticFor, apply as applyHaptic } from './haptics.mjs';
import { createVoice, VOICE_LINES } from './voice.mjs';
import { createAudio } from './audio.mjs';
import { CONTRACTS, BARANGAYS, CHAPTERS, chapterOpen, contractById, starsFor, unlocked, brgyStars, describe, lockReason } from './contracts.mjs';
import { icon, portrait } from './icons.mjs';
import { createOnline, RANKED, byDiff } from './online.mjs';
import { createGoogleAds } from './googleads.mjs';
import { canOffer, spend, left, boosted, useBoost, onTrial, startTrial, brokeStreak, canRescue, rescue, OFFERS } from './ads.mjs';
import { xpFor, rankOf, RANKS, STYLES, styleOpen, MEDALS, newMedals, addStats, dateKey, dailySeed, shareText, toolsetFor, TOOL_RANK, weeklyEvent, countdown, WEEKLY_MEDALS, EVENTS, touchStreak } from './progress.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const KEY = 'hollowblocks.v1';
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: play on */ } },
};
// the server (accounts, the cloud save, Ranking): this deploy's own on Vercel; the GitHub Pages copy and
// a local server use the live one
const online = createOnline(Q.get('api') ?? (location.hostname.endsWith('.vercel.app') ? '' : 'https://hollow-blocks.vercel.app'));
const TIPS = [
  'Ang Bayanihan, apat na hanay nang sabay, ang pinakamalaking kita.',
  'Itabi ang kawayan sa IMBAK para sa Bayanihan.',
  'Tingnan ang anino sa ibaba para alam mo kung saan babagsak.',
  'Huwag mag-iwan ng butas sa ilalim: mahirap nang punan.',
  'T-spin: iikot ang ladrilyo papasok sa butas para sa dagdag na kita.',
  'Sunod-sunod na clear, may dagdag na bonus. Tuloy-tuloy lang!',
  'Sa Bagyo, maglinis agad bago umapaw ang baha.',
  'Sa totoong construction site, laging naka-hard hat at safety shoes.',
  'Pahinga rin pag pagod na ang mata, ha. Uminom ng tubig!',
];
const SAYS = {
  go: ['Tara, trabaho na!', 'Buhos na tayo!', 'Simulan na natin!'],
  one: ['Ayos!', 'Sige lang!', 'Isa pa!'],
  four: ['BAYANIHAN! Galing!', 'Ganyan ang tulungan!', 'Buhat-buhat!'],
  tspin: ['Galing ng diskarte!', 'T-spin! Pang-engineer!', 'Ikot-pasok! Ang husay!', 'Parang engineer ka, ah!'],
  combo: ['Tuloy-tuloy!', 'Wag tumigil!'],
  level: ['Bagong palapag!', 'Taas pa!'],
  high: ['Ingat! Ang taas na!', 'Babagsak yan!', 'Linisin muna!'],
  rise: ['Tumataas ang baha!', 'Bilisan, bagyo!'],
  over: ['Gumuho! Overtime tayo bukas.', 'Ay, sayang ang semento!'],
  done: ['Tapos sa oras! Libre kita ng merienda!', 'Pasok sa deadline!'],
  b2b: ['Sunod-sunod! Ang galing!', 'Isa pang ganyan!', 'Walang tigil, ha!'],
  brink: ['Konti na lang, guguho na!', 'Delikado! Ibaba mo na!', 'Susmaryosep, ang taas!'],
  drought: ['Nasaan na ang kawayan?!', 'Wala pang kawayan. Diskarte muna!', 'Matagal pa ang kawayan, ha.'],
  relief: ['Ayan na ang kawayan!', 'Sa wakas, kawayan!'],
  tool: ['Gamitin mo yan!', 'Ayos ang gamit!', 'Diskarte ng tunay na mason!'],
  lindol: ['Lindol! Kapit!', 'Yumayanig! Ingat!'],
  ceremony: ['Tapos ang bahay! Salamat sa lahat!', 'Bahay na! Kain tayo mamaya!'],
  retry: ['Ulitin natin. Kaya mo yan!', 'Sige, isa pa!', 'Dahan-dahan lang. Ulit!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// The controls: actions to keys (up to three each) and to controller buttons. Movement on the d-pad and
// the left stick stays put; everything else can be moved.
const DEF_KEYS = { left: ['ArrowLeft', 'a'], right: ['ArrowRight', 'd'], down: ['ArrowDown', 's'], hard: [' '], cw: ['ArrowUp', 'x', 'w'], ccw: ['z', 'q'], r180: ['v'], hold: ['c', 'Shift'], tool: ['e'], pause: ['p', 'Escape'] };
const DEF_PAD = { cw: [0], ccw: [1], tool: [2], hold: [3, 4, 5, 6, 7], hard: [12], r180: [], pause: [9] };
const DEF_RULES = { next: 5, das: null, arr: null, soft: null, rot180: false, hold: true, coach: false, ghost: true };
const ACT_NAME = { left: 'Kaliwa · Left', right: 'Kanan · Right', down: 'Dahan · Soft drop', hard: 'Bagsak · Hard drop', cw: 'Ikot · Turn', ccw: 'Pabalik · Turn back', r180: 'Ikot 180°', hold: 'Imbak · Hold', tool: 'Gamit · Tool', pause: 'Hinto · Pause' };
const PAD_NAME = ['✕ / A', '○ / B', '□ / X', '△ / Y', 'L1 / LB', 'R1 / RB', 'L2 / LT', 'R2 / RT', 'Share / Back', 'Options / Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →'];
function validMap(v, def, ok) {
  const out = {};
  for (const [a, d] of Object.entries(def)) out[a] = v && Array.isArray(v[a]) && v[a].every(ok) ? v[a].slice(0, a === 'hold' && def === DEF_PAD ? 5 : 3) : d.slice();
  return out;
}
const keyName = (k) => ({ ' ': 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' }[k] || (k.length === 1 ? k.toUpperCase() : k));
const touch = matchMedia('(pointer: coarse)').matches;
const saved = store.get() || {};
const data = {
  best: saved.best && typeof saved.best === 'object' ? saved.best : {}, muted: !!saved.muted, calm: !!saved.calm, safety: !!saved.safety,
  difficulty: DIFFICULTY[saved.difficulty] ? saved.difficulty : 'madali', mode: MODES[saved.mode] ? saved.mode : 'bahay',
  hints: Array.isArray(saved.hints) ? saved.hints : [],
  gfx: [0, 1, 2].includes(saved.gfx) ? saved.gfx : 'auto', // graphics: auto (steps down on slow devices) or a fixed level
  opt: { music: 1, sfx: 1, ghost: true, cine: true, angle: true, ...(saved.opt || {}) }, // the settings screen
  // progression (added in v4; older saves start from zero)
  xp: Number.isFinite(saved.xp) ? saved.xp : 0, medals: Array.isArray(saved.medals) ? saved.medals : [], stats: saved.stats && typeof saved.stats === 'object' ? saved.stats : {},
  stars: saved.stars && typeof saved.stars === 'object' ? saved.stars : {}, daily: saved.daily && typeof saved.daily === 'object' ? saved.daily : {}, style: STYLES.some((x) => x.id === saved.style) ? saved.style : 'apartment',
  // v6: modern controls (null: as the difficulty has it), key and controller maps, the ladder, lessons
  v: 6, rules: { ...DEF_RULES, ...(saved.rules && typeof saved.rules === 'object' ? saved.rules : {}) },
  keys: validMap(saved.keys, DEF_KEYS, (k) => typeof k === 'string'), pad: validMap(saved.pad, DEF_PAD, (b) => Number.isInteger(b) && b >= 0 && b < 20),
  vs: { beaten: Array.isArray(saved.vs?.beaten) ? saved.vs.beaten : [], wins: Number.isFinite(saved.vs?.wins) ? saved.vs.wins : 0 }, lessons: Array.isArray(saved.lessons) ? saved.lessons : [],
  // v7: Tapatan's two key maps and setup, the weekly event's record, the tokens
  keys1: validMap(saved.keys1, DEF_KEYS_P1, (k) => typeof k === 'string'), keys2: validMap(saved.keys2, DEF_KEYS_P2, (k) => typeof k === 'string'),
  tap: { src: ['keys', 'keys'], mult: [1, 1], rubble: [0, 0], ...(saved.tap && typeof saved.tap === 'object' ? saved.tap : {}) },
  weekly: saved.weekly && typeof saved.weekly === 'object' ? saved.weekly : {}, tokens: Number.isFinite(saved.tokens) ? saved.tokens : 0, wmedals: Array.isArray(saved.wmedals) ? saved.wmedals : [],
  // v8: barya, the locker, the login streak
  coins: Number.isFinite(saved.coins) ? saved.coins : 0, owned: Array.isArray(saved.owned) ? saved.owned.filter((id) => itemById(id)) : [],
  equip: { ...DEFAULT_EQUIP, ...(saved.equip && typeof saved.equip === 'object' ? saved.equip : {}) }, streak: saved.streak && typeof saved.streak === 'object' ? saved.streak : null,
  // v11: rewarded ads (ads.mjs): today's counts, Overtime, items on trial, a streak that can be saved
  ads: saved.ads && typeof saved.ads === 'object' ? saved.ads : null, boost: saved.boost && typeof saved.boost === 'object' ? saved.boost : { games: 0 },
  trials: saved.trials && typeof saved.trials === 'object' ? saved.trials : {}, lostStreak: saved.lostStreak && typeof saved.lostStreak === 'object' ? saved.lostStreak : null,
};
data.opt = { haptics: true, voice: true, voiceVol: 0.8, offers: true, ...data.opt };
if (touch && data.mode === 'tapatan') data.mode = 'bahay'; // two players need a keyboard
if (!MODES[data.mode]) data.mode = 'bahay';
for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon, el.closest('.pad') ? 30 : 20);
let pushT = 0;
const persist = () => { store.set(data); if (online.user && !TEST) { clearTimeout(pushT); pushT = setTimeout(pushSave, 3000); } };
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && touch && data.opt.haptics !== false) navigator.vibrate(p); } catch { /* no haptics */ } };
// haptics for a game event: the phone buzzes, every controller rumbles, scaled by the moment
const feel = (e) => { if (data.opt.haptics === false) return; const h = hapticFor(e); if (h) applyHaptic(h, { touch, pads: navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [] }); };
const clock = (ticks) => { const s = ticks / 60; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const peso = (n) => `₱${Math.floor(n).toLocaleString('en-US')}`;
const bestKey = () => `${data.mode}.${data.difficulty}`;

const $ = (id) => document.getElementById(id);
let view = null, R = null; // the 3D view, or the 2D renderer when WebGL is missing
const A = createAudio();
A.setMuted(data.muted); A.setMix(data.opt);
const V = createVoice(A);
V.setOn(data.opt.voice !== false); V.setVolume(data.opt.voiceVol);
// Kapatas says a voice slot's line: the bubble shows it, the voice speaks it
function speak(slot) { say(null, true, VOICE_LINES[slot]); if (data.opt.voice !== false && !AUTOPLAY) V.say(slot, VOICE_LINES[slot]); }

let mode = 'title', game = null, job = null; // job: the contract being played
let match = null, vsPick = null, lesson = null, coach = null, rec = null, ghost = null, viewer = null, capture = null;
let lessonEnd = 0; // ticks left before a lesson's verdict shows
let tap = null; // Tapatan's series: { wins: [p1, p2], round }
let bonusTool = null; // a contract's starting tool, from a rewarded ad; for the next start only
const tapIn = [createInput(), createInput()];
let tapRoutes = new Map();
const tapKeys = () => { tapRoutes = routes([data.tap.src[0] === 'keys' ? data.keys1 : null, data.tap.src[1] === 'keys' ? data.keys2 : null]); };
let demo = newDemo();
function newDemo() { return createGame({ seed: seed(), mode: 'bahay', difficulty: 'madali' }); }

const SCREENS = ['account', 'ranking', 'title', 'safety', 'pause', 'results', 'settings', 'map', 'brief', 'stats', 'how', 'rankup', 'vs', 'rival', 'lessons', 'lesson', 'lessondone', 'replays', 'keys', 'tapatan', 'modes', 'shop', 'book', 'house'];
function show(name) {
  for (const id of SCREENS) { const el = $(id), on = id === name; if (on && el.hidden) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } el.hidden = !on; }
  if (name) { toasts.length = 0; $('toast').hidden = true; $('big').hidden = true; bigT = 0; }
  $('pause-btn').hidden = name !== null || mode === 'replay';
  $('hud').hidden = !(name === null || name === 'pause');
  $('tools').hidden = !(game && game.toolsOn);
  $('rbar').hidden = !(name === null && mode === 'replay');
  $('lesson-corner').hidden = !(name === null && lesson && mode === 'play');
  if (name !== null || mode === 'replay') { $('ghostbar').hidden = true; $('finesse').hidden = true; $('rbubble').hidden = true; }
  document.body.classList.toggle('playing', name === null && mode !== 'replay');
  document.body.classList.toggle('on-title', name === 'title');
  document.body.classList.toggle('replaying', name === null && mode === 'replay');
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
  insets();
}
function insets() { if (view) view.setInsets(touch ? 66 : 76, touch && mode === 'play' ? 86 : 14); }

// The rule options from the settings, leaving out whatever is on its default so it stays the difficulty's.
function ruleOpts() {
  const r = data.rules, o = {};
  if (r.das !== null) o.das = r.das; if (r.arr !== null) o.arr = r.arr; if (r.soft !== null) o.soft = r.soft;
  if (r.rot180) o.rot180 = true; if (r.hold === false) o.hold = false; if (r.next !== 5) o.next = r.next;
  return Object.keys(o).length ? o : null;
}
function start() {
  A.start();
  if (!data.safety && !AUTOPLAY) { mode = 'safety'; show('safety'); return; }
  if (data.mode === 'proyekto' && !job) { openMap(); return; }
  if (data.mode === 'versus' && !vsPick) { openVs(); return; }
  if (data.mode === 'training' && !lesson) { openLessons(); return; }
  if (data.mode === 'tapatan' && !tap) { openTapatan(); return; }
  if (data.mode !== 'training') lesson = null;
  const daily = data.mode === 'daily', sd = daily ? dailySeed(dateKey()) : seed(), opts = ruleOpts();
  match = null; ghost = null; viewer = null; lessonEnd = 0;
  if (data.mode === 'tapatan') {
    match = createMatch({ seed: sd, local: true, opts, opts2: opts, mult: data.tap.mult, rubble: data.tap.rubble });
    game = match.a; rec = null; clearIn(tapIn[0]); clearIn(tapIn[1]); tapKeys();
  } else if (data.mode === 'versus') {
    match = createMatch({ seed: sd, rival: vsPick, opts });
    game = match.a;
    rec = createRecorder({ v: 1, vs: vsPick, seed: sd, opts });
    rivalSays('start', true);
  } else if (data.mode === 'training') {
    game = lessonGame(lesson, opts); rec = null;
    $('lesson-tip').textContent = lesson.tip;
  } else {
    const diff = daily || data.mode === 'proyekto' || data.mode === 'lingguhan' ? 'katamtaman' : data.difficulty;
    const wk = data.mode === 'lingguhan' ? weeklyEvent() : null;
    const gs = wk ? dailySeed(wk.week) : sd, ts = toolsetFor(data.xp);
    const bonus = data.mode === 'proyekto' ? bonusTool : null;
    bonusTool = null;
    game = createGame({ seed: gs, mode: data.mode, difficulty: diff, contract: data.mode === 'proyekto' ? job : wk ? wk.contract : null, opts, toolset: ts, bonusTool: bonus });
    rec = createRecorder({ v: 1, mode: data.mode, diff, seed: gs, job: data.mode === 'proyekto' && job ? job.id : undefined, ev: wk ? wk.id : undefined, ts: ts.length > TOOLS.length ? ts : undefined, bonus: bonus || undefined, opts });
    if (data.rules.ghost && (data.mode === 'deadline' || data.mode === 'karera')) loadGhost(game, bestKey());
  }
  if (view) view.setVersus(!!match, match ? match.prof : null);
  coach = lesson || data.rules.coach ? createCoach(data.rules.rot180) : null;
  $('finesse').hidden = true;
  toolsKey = '';
  if (R) R.reset();
  mode = 'play'; clearInput(); show(null); hudKey = ''; sinceI = 0;
  if (match && match.local) big(`RONDA ${tap.round}`, `P1 ${tap.wins[0]} – ${tap.wins[1]} P2 · Tatlong ronda`, 1.8);
  else if (match) big('LABAN!', `vs ${match.prof.name}`, 1.6);
  else if (game.mode === 'lingguhan') big(weeklyEvent().name, 'Lingguhan · tatlong minuto', 1.8);
  else if (game.insp) { big('ANG INSPEKTOR', 'Dumating ang City Inspector!', 2.2); setTimeout(() => inspSays('enter', true), 1800); }
  else if (lesson) big(lesson.name, 'Pagsasanay · Sundan ang gintong anino', 1.8);
  else big(job && data.mode === 'proyekto' ? job.name : MODES[data.mode].name, job && data.mode === 'proyekto' ? describe(job).goal : { klasiko: 'Iisang bilis. Purong laro.', deadline: '40 hanay, bilisan!', bagyo: 'Tumataas ang baha!', karera: 'Dalawang minuto. Kita, kita, kita!', daily: `Daily ${dateKey()} · pareho para sa lahat` }[data.mode] || 'Buuin ang bahay!', 1.6);
  if (match) hint('versus', 'Ang mga sako sa tabi ng well: putik na paparating. Mag-clear para harangin!');
  hint('move', touch ? 'Tap: ikot · Drag: galaw · Flick ↓ bagsak, ↑ imbak' : '← → galaw · ↑ o X ikot · Z pabalik · ↓ dahan-dahan · Space bagsak · C o Shift imbak · may controller din');
}

function finish(done) {
  const g = game;
  setTimeout(() => {
    if (game !== g) return;
    mode = 'results';
    const k = bestKey(), prev = data.best[k];
    let isBest = false;
    if (g.mode === 'proyekto') { /* contracts keep stars, not a best */ }
    else if (g.mode === 'deadline') { if (done && (!prev || g.elapsed < prev)) { data.best[k] = g.elapsed; isBest = true; } }
    else if (!prev || g.score > prev) { data.best[k] = g.score; isBest = g.score > 0; }
    // progression: stars, XP and rank, medals, stats, the daily
    const r = { mode: g.mode, done, ticks: g.elapsed, score: g.score, lines: g.lines, level: g.level, pieces: g.pieces, bayanihan: g.stats.bayanihan, tspins: g.stats.tspins, tspinTriple: g.stats.tspinTriple || 0, maxCombo: g.stats.maxCombo, perfect: g.stats.perfect, tools: g.stats.tools, daily: g.mode === 'daily' };
    let stars = 0;
    if (g.mode === 'proyekto' && g.contract) { stars = starsFor(g.contract, r); r.stars = stars; data.stars[g.contract.id] = Math.max(data.stars[g.contract.id] || 0, stars); }
    let wkNote = '';
    if (g.mode === 'lingguhan') {
      const w = weeklyEvent(), prevW = data.weekly.week === w.week ? data.weekly : { week: w.week, best: 0, token: false };
      prevW.best = Math.max(prevW.best || 0, g.score);
      if (done && !prevW.token) { prevW.token = true; data.tokens++; wkNote = `+1 token (${data.tokens})`; }
      if (done && !data.wmedals.includes(`wk-${w.id}`)) { data.wmedals.push(`wk-${w.id}`); wkNote += `${wkNote ? ' · ' : ''}Medalya: ${w.name}`; }
      data.weekly = prevW; isBest = g.score >= prevW.best && g.score > 0;
    }
    if (g.mode === 'daily') { const dk = dateKey(); const prevD = data.daily[dk]; if (!prevD || g.score > prevD.score) data.daily = { [dk]: { score: g.score, lines: g.lines, bayanihan: g.stats.bayanihan } }; }
    const ot = (data.boost?.games || 0) > 0, before = rankOf(data.xp), gain = boosted(xpFor(r), data.boost), coins = coinsFor(r);
    data.boost = useBoost(data.boost);
    data.xp += gain; data.stats = addStats(data.stats, r); data.coins += coins;
    const after = rankOf(data.xp);
    const fresh = newMedals(r, { medals: data.medals, stats: data.stats, xp: data.xp, brgyStars: [0, 1, 2].map((b) => brgyStars(data.stars, b)) });
    data.medals.push(...fresh);
    persist();
    keepReplay(g, isBest);
    rankGame(g, done);
    $('watch').hidden = !rec;
    $('watch').onclick = () => { if (replays.last) watch(replays.last.code); };
    $('results-stars').hidden = g.mode !== 'proyekto';
    $('results-stars').innerHTML = [1, 2, 3].map((k) => `<span class="${k <= stars ? '' : 'off'}">★</span>`).join('');
    offerDouble(coins);
    $('results-xp').innerHTML = `+${gain} XP${ot ? ' (2× Overtime)' : ''} · +${coins} barya · ${after.name}${after.next ? ` · ${after.need} pa para sa ${after.next}` : ''}<i style="--p:${Math.round(after.progress * 100)}%"></i>`;
    $('results-medals').innerHTML = fresh.map((id) => { const m = MEDALS.find((x) => x.id === id); return `<div class="medal got fresh"><b>★</b>${m.name}</div>`; }).join('');
    const nextJob = g.mode === 'proyekto' && stars > 0 ? CONTRACTS[CONTRACTS.findIndex((c) => c.id === g.contract.id) + 1] : null;
    $('next-job').hidden = !(nextJob && unlocked(data.stars, nextJob.id)); $('next-job').textContent = 'Susunod na Kontrata';
    $('next-job').onclick = () => openBrief(nextJob);
    $('share').hidden = g.mode !== 'daily';
    $('share').onclick = () => { const txt = shareText(dateKey(), r); try { if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else navigator.clipboard.writeText(txt).then(() => toast('Nakopya! Copied to the clipboard.', 2000)); } catch { /* nothing to share with */ } };
    rankUp = after.index > before.index ? after : null;
    $('results-title').textContent = g.mode === 'proyekto' ? (done ? 'Tapos ang kontrata!' : 'Hindi natapos…') : g.mode === 'karera' || g.mode === 'daily' ? 'Oras na!' : done ? 'Tapos sa oras!' : g.mode === 'bagyo' ? 'Inabot ng baha!' : 'Gumuho ang pader!';
    $('results-score').textContent = g.mode === 'deadline' ? (done ? clock(g.elapsed) : `${g.lines}/40`) : peso(g.score);
    const b = g.mode === 'proyekto' ? 0 : data.best[k];
    $('results-best').textContent = isBest ? 'Bagong best! New best!' : b ? `Best: ${g.mode === 'deadline' ? clock(b) : peso(b)}` : '';
    if (wkNote) $('results-best').textContent += ` · ${wkNote}`;
    $('results-best').className = isBest ? 'new' : 'muted';
    const stat = (label, v) => `<div><span>${label}</span><b>${v}</b></div>`;
    $('results-stats').innerHTML = stat('Hanay', g.lines) + stat('Naitayo', `${1 + Math.floor(g.lines / 10)} palapag`) + stat('Oras', clock(g.elapsed)) + stat('Bayanihan', g.stats.bayanihan) + stat('T-spin', g.stats.tspins) + stat('Combo', Math.max(0, g.stats.maxCombo));
    $('results-tip').textContent = `"${pick(TIPS)}" — Kapatas`;
    if (rankUp) {
      // a rank-up is its own moment, before the results
      const st = STYLES.find((x) => x.rank === rankUp.index);
      $('rankup-name').textContent = rankUp.name;
      $('rankup-note').textContent = st ? `Bagong istilo ng bahay: ${st.name}. Piliin sa Tala at Medalya.` : 'Ang pinakamataas na ranggo sa site!';
      show('rankup'); if (view) setTimeout(() => view.celebrate(), 200); A.event({ type: 'ceremony' }); buzz([40, 30, 80]); setTimeout(() => { if (data.opt.voice !== false) V.say('rankup'); }, 600);
      clearTimeout(rankT); rankT = setTimeout(() => { if (!$('rankup').hidden) show('results'); }, 4500);
    } else show('results');
  }, done ? 1800 : 1600);
}

// ---------- Laban: the end of a match ----------
function finishVersus(winner) {
  const m = match, g = m.a;
  setTimeout(() => {
    if (match !== m) return;
    mode = 'results';
    const win = winner === 'a', secs = Math.max(1, m.tick / 60);
    const r = { mode: 'versus', done: win, ticks: g.elapsed, score: g.score, lines: g.lines, level: g.level, pieces: g.pieces, bayanihan: g.stats.bayanihan, tspins: g.stats.tspins, tspinTriple: g.stats.tspinTriple || 0, maxCombo: g.stats.maxCombo, perfect: g.stats.perfect, tools: 0 };
    const ladderI = LADDER.findIndex((x) => x.id === m.rival);
    if (win) { data.vs.wins++; if (ladderI >= 0 && !data.vs.beaten.includes(m.rival)) data.vs.beaten.push(m.rival); }
    const ot = (data.boost?.games || 0) > 0, before = rankOf(data.xp), gain = boosted(xpFor(r) + (win ? 150 + Math.max(0, ladderI) * 50 : 0), data.boost), coins = coinsFor({ ...r, win });
    data.boost = useBoost(data.boost);
    data.xp += gain; data.stats = addStats(data.stats, r); data.coins += coins;
    const after = rankOf(data.xp);
    const fresh = newMedals(r, { medals: data.medals, stats: data.stats, xp: data.xp, brgyStars: [0, 1, 2].map((b) => brgyStars(data.stars, b)) });
    data.medals.push(...fresh);
    persist();
    keepReplay(g, false);
    $('results-rank').hidden = true;
    $('watch').hidden = false; $('watch').onclick = () => { if (replays.last) watch(replays.last.code); };
    $('results-stars').hidden = true; $('share').hidden = true;
    $('results-title').textContent = winner === 'draw' ? 'Tabla!' : win ? 'Panalo!' : 'Talo…';
    $('results-score').textContent = `${m.sent[0]} – ${m.sent[1]}`;
    $('results-best').textContent = win ? `Tinalo mo si ${m.prof.name}!` : `Natalo ka ni ${m.prof.name}.`;
    $('results-best').className = win ? 'new' : 'muted';
    const stat = (label, v) => `<div><span>${label}</span><b>${v}</b></div>`;
    $('results-stats').innerHTML = stat('Ipinadala', `${m.sent[0]} putik`) + stat('Natanggap', `${m.got[0]} putik`) + stat('Hanay', g.lines) + stat('Piraso/seg', (g.pieces / secs).toFixed(2)) + stat('T-spin', g.stats.tspins) + stat('Oras', clock(m.tick));
    offerDouble(coins);
    $('results-xp').innerHTML = `+${gain} XP${ot ? ' (2× Overtime)' : ''} · +${coins} barya · ${after.name}${after.next ? ` · ${after.need} pa para sa ${after.next}` : ''}<i style="--p:${Math.round(after.progress * 100)}%"></i>`;
    $('results-medals').innerHTML = fresh.map((id) => { const md = MEDALS.find((x) => x.id === id); return `<div class="medal got fresh"><b>★</b>${md.name}</div>`; }).join('');
    const nxt = win && ladderI >= 0 ? LADDER[ladderI + 1] : null;
    $('next-job').hidden = !nxt; $('next-job').textContent = nxt ? `Susunod: ${nxt.name}` : '';
    $('next-job').onclick = () => openRival(nxt.id);
    $('results-tip').textContent = win ? `"${pick((m.prof.says || GENERIC).lose)}" — ${m.prof.name}` : `"${pick((m.prof.says || GENERIC).win)}" — ${m.prof.name}`;
    rankUp = after.index > before.index ? after : null;
    if (rankUp) { $('rankup-name').textContent = rankUp.name; $('rankup-note').textContent = 'Bagong ranggo!'; show('rankup'); clearTimeout(rankT); rankT = setTimeout(() => { if (!$('rankup').hidden) show('results'); }, 4500); }
    else show('results');
  }, 1700);
}

// ---------- Tapatan: rounds, the banner between them, and the winner's ceremony ----------
function tapKo(winner) {
  const m = match;
  if (winner === 'a') tap.wins[0]++; else if (winner === 'b') tap.wins[1]++;
  const champ = tap.wins[0] >= 2 ? 0 : tap.wins[1] >= 2 ? 1 : -1;
  big(winner === 'draw' ? 'TABLA!' : `P${winner === 'a' ? 1 : 2} PANALO!`, `P1 ${tap.wins[0]} – ${tap.wins[1]} P2`, 2);
  A.event({ type: 'done' });
  setTimeout(() => {
    if (match !== m) return;
    if (champ < 0) { tap.round++; start(); return; }
    // the series is won: a ceremony, then the results
    mode = 'results';
    $('results-title').textContent = `Panalo si P${champ + 1}!`;
    $('results-score').textContent = `${tap.wins[0]} – ${tap.wins[1]}`;
    $('results-best').textContent = 'Tapatan · pinakamahusay sa tatlo'; $('results-best').className = 'new';
    const stat = (label, v) => `<div><span>${label}</span><b>${v}</b></div>`;
    $('results-stats').innerHTML = stat('P1 padala', `${m.sent[0]} putik`) + stat('P2 padala', `${m.sent[1]} putik`) + stat('Ronda', tap.round) + stat('P1 hanay', m.a.lines) + stat('P2 hanay', m.b.lines) + stat('Oras', clock(m.tick));
    $('results-xp').innerHTML = ''; $('results-medals').innerHTML = ''; $('results-stars').hidden = true; $('share').hidden = true; $('watch').hidden = true; $('next-job').hidden = true; $('results-rank').hidden = true; $('ad-double').hidden = true;
    $('results-tip').textContent = `"Ganyan ang tapatan! Kamayan na kayo." — Kapatas`;
    if (view) view.celebrate(); A.event({ type: 'ceremony' }); buzz([40, 30, 80]);
    tap = null;
    show('results');
  }, 2300);
}
function openTapatan() {
  mode = 'tapatan'; data.mode = 'tapatan';
  const T = data.tap;
  const seg = (k, p, list) => `<div class="modes">${list.map(([v, label]) => `<button type="button" data-tk="${k}" data-tp="${p}" data-v="${v}" aria-pressed="${String(T[k][p]) === String(v)}">${label}</button>`).join('')}</div>`;
  const col = (p) => `<div class="grp"><h3 style="color:${p ? '#6fb3c4' : '#ffd23f'}">${icon(p ? 'keyb' : 'keyb', 22)} Manlalaro ${p + 1}</h3>
    <p class="muted">Kontrol</p>${seg('src', p, p ? [['keys', 'Keyboard · Arrows'], ['pad0', 'Controller 1'], ['pad1', 'Controller 2']] : [['keys', 'Keyboard · WASD'], ['pad0', 'Controller 1']])}
    <p class="muted">Padala × · Garbage sent</p>${seg('mult', p, [[0.5, '×0.5'], [1, '×1'], [1.5, '×1.5'], [2, '×2']])}
    <p class="muted">Simulang taas · Start height</p>${seg('rubble', p, [[0, '0'], [2, '2'], [4, '4'], [6, '6']])}
    <p class="muted">${p ? 'Arrows: galaw at bagsak (↑), , . ikot, / imbak' : 'A D galaw, S dahan, W bagsak, Q E ikot, C imbak'}</p></div>`;
  const clash = T.src[0] !== 'keys' && T.src[0] === T.src[1];
  $('tapatan-body').innerHTML = col(0) + col(1) + (clash ? `<p class="capnote warn">${icon('warn', 20)} Iisang controller ang dalawang manlalaro. Pumili ng iba.</p>` : '');
  for (const b of $('tapatan-body').querySelectorAll('[data-tk]')) b.onclick = () => { const v = b.dataset.v; T[b.dataset.tk][+b.dataset.tp] = isNaN(+v) ? v : +v; persist(); openTapatan(); };
  $('tap-go').setAttribute('aria-disabled', String(clash));
  show('tapatan');
}
$('tap-go').onclick = () => {
  const T = data.tap;
  if (T.src[0] !== 'keys' && T.src[0] === T.src[1]) { nope({ title: 'Iisang controller', text: 'Pareho ang kontrol ng dalawang manlalaro. Pumili ng ibang kontrol para sa isa sa kanila.', hint: 'Both players are on the same controller. Pick another for one of them.', ico: 'warn' }); return; }
  tap = { wins: [0, 0], round: 1 }; data.mode = 'tapatan'; start();
};
$('tap-keys').onclick = () => { remapTarget = 'p1'; openKeys(); };

// ---------- replays: kept on the device, best Deadline, Karera and Daily, and the last game ----------
const RKEY = 'hollowblocks.replays';
let replays = { best: {}, last: null };
try { if (!TEST) { const r = JSON.parse(localStorage.getItem(RKEY)); if (r && typeof r === 'object') replays = { best: r.best || {}, last: r.last || null }; } } catch { /* none kept */ }
const saveReplays = () => { if (TEST) return; try { localStorage.setItem(RKEY, JSON.stringify(replays)); } catch { /* full: the newest wins next time */ } };
function keepReplay(g, isBest) {
  const r0 = rec;
  if (!r0) return;
  const meta = { mode: r0.head.vs ? 'versus' : g.mode, diff: r0.head.diff || 'katamtaman', score: g.score, lines: g.lines, ticks: g.elapsed, done: g.phase === 'done', date: dateKey(), rival: r0.head.vs || null, job: r0.head.job || null };
  encode(r0).then((code) => {
    meta.code = code; replays.last = meta;
    if (isBest && (g.mode === 'deadline' || g.mode === 'karera')) replays.best[`${g.mode}.${meta.diff}`] = meta;
    if (g.mode === 'daily') { const d = replays.best.daily; if (!d || d.date !== meta.date || g.score > d.score) replays.best.daily = meta; }
    saveReplays();
  }).catch(() => { /* no compression here: not kept */ });
}
// Habulin ang multo: your best run plays alongside, tick for tick
function loadGhost(g, k) {
  const b = replays.best[k];
  if (!b) return;
  decode(b.code).then((r) => { if (game !== g) return; const end = runToEnd(r); ghost = { pb: startPlayback(r), g, final: { lines: end.lines, score: end.score, ticks: end.elapsed } }; }).catch(() => { ghost = null; });
}
function ghostHud() {
  const el = $('ghostbar');
  if (!ghost || ghost.g !== game || !view && !TEST) { el.hidden = true; return; }
  while (ghost.pb.i < game.tick && playTick(ghost.pb));
  const gg = ghost.pb.g, dl = game.mode === 'deadline';
  const you = dl ? game.lines / 40 : game.score / Math.max(1, ghost.final.score, game.score);
  const them = dl ? Math.min(gg.lines, 40) / 40 : gg.score / Math.max(1, ghost.final.score, game.score);
  el.hidden = false;
  el.querySelector('.you').style.setProperty('--p', `${(Math.min(1, you) * 100).toFixed(1)}%`);
  el.querySelector('.fill').style.setProperty('--p', `${(Math.min(1, you) * 100).toFixed(1)}%`);
  el.querySelector('.gh').style.setProperty('--p', `${(Math.min(1, them) * 100).toFixed(1)}%`);
  const d = dl ? game.lines - Math.min(40, gg.lines) : game.score - gg.score, b = el.querySelector('b');
  b.textContent = dl ? `${d > 0 ? '+' : ''}${d} hanay` : `${d >= 0 ? '+' : '−'}${peso(Math.abs(d))}`;
  b.className = d > 0 ? 'ahead' : d < 0 ? 'behind' : '';
}

// ---------- the finesse readout, and the lessons ----------
function showFinesse(f) {
  if (!f || f.min === null) return;
  const el = $('finesse');
  el.className = f.waste ? 'bad' : 'ok';
  el.innerHTML = `Finesse <b>${f.used}</b> pindot · pinakakaunti <b>${f.min}</b> · <em>${f.waste ? `+${f.waste} sayang` : 'walang sayang'}</em>${coach && coach.pieces > 1 ? ` · kabuuan ${coach.waste}` : ''}`;
  el.hidden = false; void el.offsetWidth; el.classList.add('pop');
}
function lessonHint() {
  if (!lesson || !game || !game.cur || !lesson.target) return null;
  const t = lesson.target[game.pieces];
  return t && t.type === game.cur.type ? cellsOf(t) : null;
}
function verdict(v) {
  if (!v || lessonEnd) return;
  const l = lesson, g = game;
  if (v === 'pass') {
    lessonEnd = 1;
    big('PASADO!', l.name, 1.8); A.event({ type: 'done' }); if (view) view.celebrate();
    if (!data.lessons.includes(l.id)) { data.lessons.push(l.id); data.xp += 100; }
    persist();
    setTimeout(() => {
      if (game !== g) return;
      mode = 'lessondone';
      const i = LESSONS.indexOf(l), nxt = LESSONS[i + 1];
      $('ld-title').textContent = 'Pasado!';
      $('ld-text').innerHTML = `<b>Kapatas:</b> "${{ tss: 'Ayan! Iyan ang T-spin. Ngayon, dalawang hanay naman.', tsd: 'T-spin double: apat na putik sa kalaban. Pang-engineer!', tst: 'Tatlong hanay sa isang ikot! Handa ka na sa Tatlong T-spin.', combo: 'Tuloy-tuloy! Ganyan ang Sunod-sunod.', finesse: 'Walang sayang na galaw. Tunay na mason!' }[l.id]}"${l.contracts.length ? `<br><small class="muted">Subukan na ang kontrata: ${l.contracts.map((c) => contractById(c).name).join(', ')}.</small>` : ''}`;
      $('ld-next').hidden = !nxt; $('ld-next').onclick = () => openLesson(nxt);
      show('lessondone');
    }, 1900);
  } else {
    lessonEnd = 1;
    big('ULIT!', l.id === 'finesse' ? 'May sayang na pindot o maling puwesto' : l.id === 'combo' ? 'Naputol ang combo' : 'Hindi T-spin: iikot bago dumikit', 1.6);
    say('retry', true);
    setTimeout(() => { if (game === g && mode === 'play') retryLesson(); }, 1700);
  }
}
function retryLesson() { if (!lesson) return; data.mode = 'training'; start(); }

// ---------- the rival's trash talk ----------
const GENERIC = { start: ['Tara, laban!', 'Handa ka na ba?'], send: ['Ayan ang putik mo!', 'Tanggapin mo yan!'], hurt: ['Aray!', 'Ang galing mo, ah!'], danger: ['Patay, ang taas na!'], win: ['Sa susunod na lang!'], lose: ['Ang galing mo!'] };
let rbubbleT = 0, rsayCool = 0;
function rivalSays(kind, force = false) {
  if (!match || match.local) return;
  if (!force && rsayCool > 0) return;
  const lines = (match.prof.says || GENERIC)[kind] || GENERIC[kind];
  const el = $('rbubble'); el.textContent = pick(lines); rbubbleT = 2.6; rsayCool = 3.5;
  el.style.setProperty('--rc', match.prof.color || '#e8402a');
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (!view) toast(`${match.prof.name}: "${el.textContent}"`, 2000);
}
function onMatch(out) {
  for (const e of out.a) onEvent(e);
  for (const e of out.b) { if (view) view.rivalEvent(e, match.b); if (e.type === 'lines' && e.n === 4) A.event({ type: 'hold' }); }
  for (const e of out.x) {
    if (e.type === 'attack') {
      if (view) view.attack(e.from, e.sent, e.cancelled);
      if (e.from === 1 && e.sent > 0) scorePop(`+${e.sent} PUTIK`, [], 'orange'); else if (e.from === 0 && e.cancelled > 0) scorePop(`HARANG ${e.cancelled}`, [], 'blue');
      if (e.from === 1 && e.sent >= 2) { rivalSays('send'); A.event({ type: 'rise' }); }
      if (e.from === 0 && e.n >= 3) rivalSays('hurt');
      if (e.from === 0 && e.sent > 0) buzz(20);
    } else if (e.type === 'ko' && match.local) { tapKo(e.winner); return; }
    else if (e.type === 'ko') {
      rivalSays(e.winner === 'b' ? 'win' : 'lose', true);
      if (e.winner === 'a') { big('PANALO!', `Gumuho ang kay ${match.prof.name}`, 2); A.event({ type: 'done' }); }
      finishVersus(e.winner);
    }
  }
  let top = 99; for (let i = 0; i < match.b.board.length; i++) if (match.b.board[i]) { top = Math.floor(i / 10); break; }
  if (top < 6 && match.phase === 'play') rivalSays('danger');
}

// ---------- "Hindi pa puwede": a box that says why something can't be done yet, and what would open it ----------
// o: { title, text (html), hint, ico, go: { label, run } a way there }
function nope(o) {
  const d = $('nope');
  $('nope-ico').innerHTML = icon(o.ico || 'lock', 40); $('nope-title').textContent = o.title; $('nope-text').innerHTML = o.text; $('nope-hint').textContent = o.hint || '';
  $('nope-hint').hidden = !o.hint;
  const go = $('nope-go'); go.hidden = !o.go;
  if (o.go) { go.textContent = o.go.label; go.onclick = () => { closeNope(); o.go.run(); }; }
  A.event({ type: 'nope' }); buzz([30, 40, 30]);
  if (!d.open) d.showModal();
  $('nope-ok').focus();
}
function closeNope() { if ($('nope').open) $('nope').close(); }
$('nope-ok').onclick = closeNope;
$('nope').addEventListener('click', (e) => { if (e.target === $('nope')) closeNope(); }); // a tap outside the card
const coinsTxt = (n) => `${icon('barya', 16)} ${n.toLocaleString('en-US')}`, tokTxt = (n) => `${icon('token', 16)} ${n}`;
function rankNeed(r) { const need = RANKS[r].xp - (data.xp || 0); return `ranggong <b>${RANKS[r].name}</b>${need > 0 ? ` · kulang pa ng ${need.toLocaleString('en-US')} XP` : ''}`; }
function nopeContract(c) {
  const why = lockReason(data.stars, c.id);
  if (!why) return;
  if (why.kind === 'prev') nope({ title: 'Sarado pa', text: `Tapusin muna ang <b>${why.prev.name}</b> (kahit 1 ★) para mabuksan ang <b>${c.name}</b>.`, hint: 'Finish the contract before it first.', go: { label: `Buksan ang ${why.prev.name}`, run: () => openBrief(why.prev) } });
  else if (why.kind === 'brgy') nope({ title: 'Sarado pa', text: `Kailangan ng <b>${why.need} ★</b> sa Brgy. ${BARANGAYS[why.brgy]}. Mayroon kang ${why.have} ★, kulang pa ng <b>${why.need - why.have} ★</b>.`, hint: `Earn ${why.need} stars in the barangay before.`, ico: 'star' });
  else nopeChapter();
}
function nopeChapter() {
  const have = CONTRACTS.filter((x) => x.brgy < 3).reduce((a, x) => a + (data.stars[x.id] || 0), 0);
  nope({ title: 'Sarado pa ang Kabanata 2', text: `Bubukas ito kapag natapos ang <b>${contractById('bs5').name}</b>, o may <b>30 ★</b> ka sa Kabanata 1. Mayroon kang ${have} ★.`, hint: 'Finish chapter 1\'s last contract, or earn 30 of its stars.', ico: 'star' });
}

// ---------- hints, callouts, the foreman's bubble ----------
const toasts = [];
let toastBusy = false;
function toast(text, ms = 3800) { if (AUTOPLAY) return; toasts.push([text, ms]); if (!toastBusy) nextToast(); }
function nextToast() {
  const el = $('toast'), item = toasts.shift();
  toastBusy = !!item;
  if (!item) { el.hidden = true; return; }
  el.textContent = item[0]; el.hidden = false; toastEnd = performance.now() + item[1];
  setTimeout(nextToast, item[1]);
  placeToast();
}
// ---------- keeping the well clear: while a piece is in play nothing covers it. A banner becomes a
// callout in the top chip; a hint sits beside the well and its boards (wide screens) or goes in that
// chip too (phones); Kapatas's bubble stays off it ----------
let toastEnd = 0, calloutT = 0;
const live = () => mode === 'play' && !!game && (game.phase === 'play' || game.phase === 'clear') && !(view && view.cine);
const wellBox = (boards = false) => (view ? view.wellRect(boards) : $('board').getBoundingClientRect());
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function callout(title, sub = '', secs = 1.6) {
  const el = $('callout');
  el.querySelector('b').textContent = title; el.querySelector('b').hidden = !title; el.querySelector('em').textContent = sub;
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  $('h-mode').classList.add('under'); calloutT = secs;
}
function placeToast() {
  const el = $('toast');
  if (el.hidden) return;
  if (!live()) { if (el.classList.contains('side')) { el.classList.remove('side'); el.style.cssText = ''; } return; }
  const w = wellBox(true), roomL = w.left - 24, roomR = innerWidth - w.right - 24;
  const o = (el.offsetParent || document.body).getBoundingClientRect(); // left/top are in the container's coordinates
  if (Math.max(roomL, roomR) >= 200) {
    const width = Math.min(340, Math.max(roomL, roomR));
    el.classList.add('side'); el.style.bottom = 'auto'; el.style.transform = 'none';
    el.style.width = `${width}px`;
    el.style.left = `${(roomL >= roomR ? Math.max(12, w.left - 12 - width) : w.right + 12) - o.left}px`;
    el.style.top = `${Math.round(w.top + (w.bottom - w.top) * 0.55 - o.top)}px`;
  } else if (w.top >= el.offsetHeight + 16) { // room above the well (the 2D board's frame)
    el.classList.add('side'); el.style.bottom = 'auto'; el.style.transform = 'none';
    el.style.width = `${Math.min(innerWidth - 24, 420)}px`; el.style.left = `${Math.round((innerWidth - Math.min(innerWidth - 24, 420)) / 2 - o.left)}px`;
    el.style.top = `${Math.round(w.top - el.offsetHeight - 8 - o.top)}px`;
  } else if (view) { el.hidden = true; callout('', el.textContent, Math.max(1.2, (toastEnd - performance.now()) / 1000)); }
}
// a clear's words and kita: beside the well and its boards if there's room, else in the top chip
function scorePop(word, more, tone = '') {
  if (!view) return; // the 2D board draws its own
  const rest = more.filter(Boolean), w = wellBox(true), room = innerWidth - w.right - 24;
  const el = $('pops');
  if (room < 170) {
    // a phone: a single's kita floats under the Kita chip, so the goal chip stays; bigger clears get the callout
    if (word === 'ISANG HANAY' && rest.length === 1) {
      const c = $('h-score').getBoundingClientRect(), o = (el.offsetParent || document.body).getBoundingClientRect();
      el.innerHTML = `<span class="money">${rest[0]}</span>`; el.classList.add('mini');
      el.style.left = `${Math.round(c.left - o.left + 6)}px`; el.style.top = `${Math.round(c.bottom - o.top + 2)}px`; el.style.maxWidth = '';
      el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      clearTimeout(scorePop.t); scorePop.t = setTimeout(() => { el.hidden = true; }, 1400);
    } else callout(word, rest.join(' · '), 1.1);
    return;
  }
  el.classList.remove('mini');
  el.innerHTML = `<b class="${tone}">${word}</b>${rest.map((x, i) => `<span class="${i === 0 ? 'money' : ''}">${x}</span>`).join('')}`;
  el.style.left = `${Math.round(w.right + 16)}px`; el.style.top = `${Math.round(w.top + (w.bottom - w.top) * 0.42)}px`; el.style.maxWidth = `${Math.min(300, room)}px`;
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(scorePop.t); scorePop.t = setTimeout(() => { el.hidden = true; }, 1400);
}
function keepClear(dt) {
  calloutT -= dt;
  if (calloutT <= 0 && !$('callout').hidden) { $('callout').hidden = true; $('h-mode').classList.remove('under'); }
  if (mode !== 'play') { if (!$('callout').hidden) { calloutT = 0; $('callout').hidden = true; $('h-mode').classList.remove('under'); } return; }
  // a banner still up when a piece comes into play finishes in the chip
  if (!$('big').hidden && live()) { $('big').hidden = true; if (bigT > 0.35) callout($('big').querySelector('b').textContent, $('big').querySelector('span').textContent, bigT); bigT = 0; }
  placeToast();
  // the coach's line: beside the well if there's room, else at the top
  const f = $('finesse');
  if (!f.hidden) { f.classList.remove('side', 'top'); if (live() && overlaps(f.getBoundingClientRect(), wellBox())) { const w = wellBox(true); f.classList.add(innerWidth - w.right >= 230 ? 'side' : 'top'); if (f.classList.contains('side')) f.style.left = `${w.right + 12}px`; } else f.style.left = ''; }
}
function hint(id, text) { if (data.hints.includes(id)) return; data.hints.push(id); persist(); toast(text); }
let bigT = 0;
function big(title, sub = '', secs = 1.4) {
  if (!view) return; // the 2D board letters its own
  if (live()) { callout(title, sub, secs); return; } // a piece is in play: the chip, not the middle of the well
  const el = $('big'); el.querySelector('b').textContent = title; el.querySelector('span').textContent = sub;
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); bigT = secs;
}
let bubbleT = 0, sayCool = 0, sinceI = 0, rankUp = null, rankT = 0;
function say(k, force = false, text = null) {
  const line = text || (SAYS[k] ? pick(SAYS[k]) : null);
  if (!line) return;
  if (!view) { if (R) R.say(k, line); return; }
  if (!force && sayCool > 0) return;
  const el = $('bubble'); el.textContent = line; bubbleT = 2.4; sayCool = 1.2;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function onEvent(e) {
  if (view) view.event(e, game); else R.event(e, game);
  A.event(e);
  feel(e);
  switch (e.type) {
    case 'go': say('go', true); break;
    case 'lines':
      if (e.n === 4) { big('BAYANIHAN!', `${e.b2b ? 'Sunod-sunod! ×1.5' : 'Tulong-tulong!'} · +${peso(e.points)}`, 1.6); speak('bayanihan'); }
      else { scorePop(e.spin ? (e.spin === 'mini' ? 'MINI T-SPIN' : `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][e.n]}!`) : ['', 'ISANG HANAY', 'DALAWA!', 'TATLO!'][e.n], [`+${peso(e.points)}`, e.b2b ? 'SUNOD-SUNOD ×1.5' : '', e.combo > 0 ? `TULOY-TULOY ×${e.combo}` : ''], e.spin ? 'pink' : ''); if (e.spin) speak('tspin'); else if (e.b2b) say('b2b', true); else if (e.combo >= 2) say('combo'); else if (Math.random() < 0.3) say('one'); }
      if (e.n === 1) hint('bayanihan', 'Tip: apat na hanay nang sabay ay BAYANIHAN, ang pinakamalaking kita!');
      break;
    case 'tspin': say('tspin', true); scorePop(e.kind === 'mini' ? 'MINI T-SPIN' : 'T-SPIN!', [], 'pink'); break;
    case 'spawn':
      if (e.piece === 'I') { if (sinceI >= 12) say('relief', true); sinceI = 0; }
      else if (++sinceI === 12) say('drought', true);
      break;
    case 'levelUp': if (!(view && game.mode === 'bahay' && (1 + Math.floor(game.lines / 10)) % 5 === 0)) { big(`Palapag ${e.level}!`, 'Bagong palapag · New floor', 1.5); say('level', true); } break;
    case 'rise': if (Math.random() < 0.35) say('rise'); hint('bagyo', 'Tumataas ang baha mula sa ilalim! Punuin ang butas para matanggal ang putik.'); break;
    case 'hardDrop': break;
    case 'toolEarned': toast(touch ? `Bagong gamit: ${e.tool.toUpperCase()}! Pindutin ang kahon.` : `May bagong gamit: ${e.tool.toUpperCase()}! Pindutin ang E para gamitin.`, 2400); buzz([10, 20, 10]); break;
    case 'tool': say('tool', true); scorePop(`${e.tool.toUpperCase()}!`, [], 'orange'); break;
    case 'lindol': say('lindol', true); scorePop('LINDOL!', [], 'orange'); break;
    case 'perfect': big('MALINIS!', 'Perfect clear', 1.6); break;
    case 'stamp': inspSays('stamp'); buzz(30); break;
    case 'passed': inspSays('passed'); scorePop(`PASADO +${3 * e.n}s`, [], 'green'); break;
    case 'gust': scorePop(e.dir > 0 ? 'HANGIN →' : '← HANGIN', [], 'blue'); hint('hangin', 'Hangin: dumudulas ang piraso sa direksyon ng hangin. Bantayan ang palaso!'); break;
    case 'lights': if (e.on) scorePop('MAY ILAW NA!', [], 'gold'); if (!e.on) hint('brownout', 'Brownout! Ang flashlight lang ang ilaw: sundan ang piraso.'); break;
    case 'crumble': hint('bitak', 'May bitak ang piraso: guguho ito pagkatapos ng ilang piraso.'); break;
    case 'andamyo': big('ANDAMYO!', e.why === 'topout' ? 'Sinalo ng andamyo ang pader!' : 'Sinalo ang putik', 1.4); break;
    case 'gameover': if (game && game.insp) inspSays('lost', true); if (!match) speak('lose'); else say('over', true); if (lesson) verdict('fail'); else if (!match) finish(false); break;
    case 'done': if (lesson) break; if (game && game.insp) inspSays('won', true); big('TAPOS!', game && game.mode === 'lingguhan' ? weeklyEvent().name : 'Deadline met!', 2); speak('win'); finish(true); break;
    default: break;
  }
}

function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; clearInput(); show(null); } }
function toMenu() { mode = 'title'; if (versionWaiting) { location.reload(); return; } if (newerSave) adopt(newerSave); game = null; job = null; match = null; lesson = null; viewer = null; ghost = null; tap = null; shopPrev = null; if (view) view.setVersus(false); wearLooks(); labels(); show('title'); }

// ---------- input ----------
let KEYS = {};
function keymap() { KEYS = {}; for (const [a, ks] of Object.entries(data.keys)) for (const k of ks) if (!(k in KEYS)) KEYS[k] = a; }
const HELD = new Set(['left', 'right', 'down']);
const held = new Set();
let pressed = [];
function clearInput() { held.clear(); pressed = []; }
const playing = () => mode === 'play' && game;
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input') && e.key !== 'Escape') return; // typing a name or password
  if (adShowing) { if (e.key === 'Escape' && !$('ad').hidden) $('ad-close').click(); return; } // an ad is up: its own buttons only
  if ($('nope').open) { if (e.key === 'Escape') { e.preventDefault(); closeNope(); } return; } // the box: Enter/Space press its buttons, Escape closes
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (capture && capture.kind === 'key') { e.preventDefault(); captured(k); return; }
  if (match && match.local && (mode === 'play' || mode === 'pause')) {
    // Tapatan: each key to its player
    const r = tapRoutes.get(k);
    if (r) { e.preventDefault(); if (r.act === 'pause') { if (mode === 'play') pause(); else resume(); } else if (mode === 'play') pressIn(tapIn[r.p], r.act, true, e.repeat); return; }
  }
  const act = KEYS[k];
  if (act === 'pause' && (mode === 'play' || mode === 'pause')) { e.preventDefault(); if (mode === 'play') pause(); else resume(); return; }
  if (k === 'r' && mode === 'play' && lesson && act !== 'left' && act !== 'right') { retryLesson(); return; }
  if (act && act !== 'pause' && playing()) {
    e.preventDefault();
    if (!e.repeat && act !== 'down') pressed.push(act);
    if (HELD.has(act)) held.add(act);
    return;
  }
  const onButton = document.activeElement?.tagName === 'BUTTON';
  if ((k === ' ' || k === 'Enter') && !onButton && mode === 'title') { e.preventDefault(); start(); return; }
  if (k === 'p' && (mode === 'play' || mode === 'pause')) { if (mode === 'play') pause(); else resume(); }
  else if (k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); else if (mode === 'settings') $('settings-ok').click(); else if (mode === 'keys') $('keys-ok').click(); else if (mode === 'replay') closeViewer(); else if (['modes', 'shop', 'book', 'stats', 'how', 'replays', 'vs', 'lessons', 'map', 'tapatan', 'account', 'ranking', 'results'].includes(mode)) toMenu(); else if (mode === 'house') openBook(); else if (mode === 'brief') openMap(); else if (mode === 'rival') openVs(); else if (mode === 'lesson') openLessons(); }
  if (mode === 'replay' && k === ' ') { e.preventDefault(); toggleViewer(); }
  if (k === 'm') toggleSound();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const r = tapRoutes.get(k); if (r && r.act !== 'pause') pressIn(tapIn[r.p], r.act, false);
  const act = KEYS[k]; if (act && HELD.has(act)) held.delete(act);
});
window.addEventListener('blur', () => { clearInput(); clearIn(tapIn[0]); clearIn(tapIn[1]); });

// gestures on the board: tap to turn, drag sideways to shift, drag down to drop softly, flick down to
// drop hard, flick up to hold
const stage = $('stage');
let gest = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !playing() || e.target.closest('button')) return;
  A.start();
  gest = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
});
stage.addEventListener('pointermove', (e) => {
  if (!gest || !playing()) return;
  const step = Math.max(14, view ? view.cellPx * 1.1 : (stage.getBoundingClientRect().width / 432) * 24 * 1.1);
  while (e.clientX - gest.x > step) { pressed.push('right'); gest.x += step; gest.moved = true; }
  while (gest.x - e.clientX > step) { pressed.push('left'); gest.x -= step; gest.moved = true; }
  if (e.clientY - gest.sy > step * 1.5) { held.add('down'); gest.moved = true; } else held.delete('down');
});
stage.addEventListener('pointerup', (e) => {
  if (!gest) return;
  const dt = performance.now() - gest.t, dy = e.clientY - gest.sy, dx = e.clientX - gest.sx;
  held.delete('down');
  if (playing()) {
    if (dy > 70 && dy / dt > 0.5 && Math.abs(dy) > Math.abs(dx)) pressed.push('hard');
    else if (dy < -50 && -dy / dt > 0.6) pressed.push('hold');
    else if (!gest.moved && Math.hypot(dx, dy) < 12 && dt < 300) pressed.push('cw');
  }
  gest = null;
});
stage.addEventListener('pointercancel', () => { gest = null; held.delete('down'); });
for (const b of document.querySelectorAll('[data-act]')) {
  const act = b.dataset.act;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); A.start(); if (!playing()) return; if (act !== 'down') pressed.push(act); if (HELD.has(act)) held.add(act); b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => held.delete(act));
}

// a controller (standard mapping): d-pad or left stick to move and drop gently, up to drop hard,
// ✕/A turns, ○/B turns back, △/Y or a shoulder holds, Options/Start pauses. In the menus the d-pad
// moves between buttons, ✕ presses and ○ goes back.
const padWas = {};
let padHeldDirs = new Set();
function readPad(dt) {
  const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null;
  if (!p || adShowing) return;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes || [];
  const edge = (name, on) => { const was = padWas[name]; padWas[name] = on; return on && !was; };
  const left = b(14) || (ax[0] || 0) < -0.5, right = b(15) || (ax[0] || 0) > 0.5, down = b(13) || (ax[1] || 0) > 0.6, up = b(12) || (ax[1] || 0) < -0.7;
  if ($('nope').open) {
    if (edge('mL', left) || edge('mR', right)) { const bs = [$('nope-go'), $('nope-ok')].filter((x) => !x.hidden); bs[(bs.indexOf(document.activeElement) + 1) % bs.length].focus(); }
    if (edge('a', b(0))) document.activeElement?.click();
    if (edge('bb', b(1))) closeNope();
    return;
  }
  if (capture && capture.kind === 'pad') {
    // the remap screen is waiting for a button: the first one newly pressed
    for (let i = 0; i < Math.min(16, p.buttons.length); i++) if (edge(`cap${i}`, b(i)) && capture.armed) { captured(i); return; }
    capture.armed = true; return;
  }
  if (playing() && match && match.local) {
    // Tapatan: each player on a controller reads their own (1 or 2)
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    data.tap.src.forEach((src, pl) => { if (src.startsWith('pad')) padTo(pads[+src.slice(3)], tapIn[pl], `t${pl}:`); });
    return;
  }
  if (playing()) {
    const dirs = new Set([left && 'left', right && 'right', down && 'down'].filter(Boolean));
    for (const d of dirs) { if (!padHeldDirs.has(d) && d !== 'down') pressed.push(d); held.add(d); }
    for (const d of padHeldDirs) if (!dirs.has(d)) held.delete(d);
    padHeldDirs = dirs;
    // the stick's up is a hard drop when the d-pad's up is (the default)
    for (const [act, list] of Object.entries(data.pad)) {
      const on = list.some((i) => b(i)) || (act === 'hard' && list.includes(12) && (ax[1] || 0) < -0.7);
      if (edge(`p:${act}`, on)) { if (act === 'pause') pause(); else pressed.push(act); }
    }
    return;
  }
  for (const d of padHeldDirs) held.delete(d); padHeldDirs = new Set();
  const screen = SCREENS.find((id) => !$(id).hidden);
  if (!screen) { if (edge('start', b(9)) && mode === 'replay') toggleViewer(); if (edge('bb', b(1)) && mode === 'replay') closeViewer(); return; }
  const move = (dx, dy) => {
    const btns = [...$(screen).querySelectorAll('button, input')].filter((x) => x.offsetParent && x.tabIndex >= 0 && !x.disabled);
    const cur = document.activeElement && btns.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { btns[0]?.focus(); return; }
    if (cur.type === 'range' && dx) { cur.value = +cur.value + dx * +cur.step; cur.dispatchEvent(new Event('input')); return; }
    const r = cur.getBoundingClientRect(), c = [r.left + r.width / 2, r.top + r.height / 2];
    let best = null, bd = Infinity;
    for (const x of btns) { if (x === cur) continue; const q = x.getBoundingClientRect(), v = [q.left + q.width / 2 - c[0], q.top + q.height / 2 - c[1]]; const along = v[0] * dx + v[1] * dy; if (along <= 4) continue; const d = along + Math.abs(v[0] * dy + v[1] * dx) * 2; if (d < bd) { bd = d; best = x; } }
    if (best) best.focus();
  };
  if (edge('mL', left)) move(-1, 0); if (edge('mR', right)) move(1, 0); if (edge('mU', up)) move(0, -1); if (edge('mD', down)) move(0, 1);
  if (edge('a', b(0))) { A.start(); document.activeElement?.click(); }
  if (edge('bb', b(1))) { if (screen === 'pause') resume(); else if (screen === 'settings') $('settings-ok').click(); else if (['results', 'map', 'stats', 'how', 'vs', 'lessons', 'replays', 'modes', 'shop', 'book', 'tapatan', 'account', 'ranking'].includes(screen)) toMenu(); else if (screen === 'house') openBook(); else if (screen === 'brief') openMap(); else if (screen === 'rival') openVs(); else if (screen === 'lesson' || screen === 'lessondone') openLessons(); else if (screen === 'keys') $('keys-ok').click(); }
  if (edge('start', b(9))) { if (screen === 'pause') resume(); else if (screen === 'title') start(); }
}

// one controller into one player's input (Tapatan)
function padTo(p, inp, ns) {
  if (!p) return;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes || [];
  const edge = (name, on) => { const was = padWas[ns + name]; padWas[ns + name] = on; return on && !was; };
  const dirs = { left: b(14) || (ax[0] || 0) < -0.5, right: b(15) || (ax[0] || 0) > 0.5, down: b(13) || (ax[1] || 0) > 0.6 };
  for (const [d, on] of Object.entries(dirs)) { if (edge(d, on)) pressIn(inp, d, true); else if (!on) pressIn(inp, d, false); }
  for (const [act, list] of Object.entries(data.pad)) { const on = list.some((i) => b(i)) || (act === 'hard' && list.includes(12) && (ax[1] || 0) < -0.7); if (edge(`p:${act}`, on)) { if (act === 'pause') pause(); else pressIn(inp, act, true); } }
}
function toggleSound() { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); labels(); }
// The modes, for the PLAY button and the Mga Laro cards: an icon, a line, and your best.
const MODE_INFO = {
  bahay: { icon: 'bahay', line: 'Walang katapusan. Bawat 10 hanay, bagong palapag. May gamit.', diff: true },
  klasiko: { icon: 'target', line: 'Purong laro: iisang bilis buong laro, walang gamit, walang eksena.', diff: true },
  deadline: { icon: 'orasan', line: '40 hanay sa tanghaling tapat. Pinakamabilis ang panalo.', diff: true },
  bagyo: { icon: 'bagyo', line: 'Tumataas ang putik mula sa ilalim. Tumagal hangga’t kaya.', diff: true },
  karera: { icon: 'karera', line: 'Dalawang minuto, pinakamataas na kita. May gamit.', diff: true },
  daily: { icon: 'calendar', line: 'Parehong piraso para sa lahat ngayong araw. Dalawang minuto.' },
  lingguhan: { icon: 'token', line: 'Ang twist ngayong linggo. Medalya at token.' },
  proyekto: { icon: 'blueprint', line: `${CONTRACTS.length} kontrata sa ${BARANGAYS.length} barangay, may City Inspector.` },
  versus: { icon: 'vs', line: 'Ang well mo laban sa kalaban. Magpadala ng putik.' },
  tapatan: { icon: 'duo', line: 'Dalawang tao, isang keyboard. Pinakamahusay sa tatlo.', desk: true },
  training: { icon: 'libro', line: 'Mga aralin ni Kapatas: T-spin, combo, finesse.' },
};
const modeName = (m) => (m === 'versus' ? 'Laban' : m === 'training' ? 'Pagsasanay' : m === 'tapatan' ? 'Tapatan' : MODES[m] ? MODES[m].name : m);
function modeBest(m) {
  const b = data.best[`${m}.${data.difficulty}`];
  if (m === 'bahay' || m === 'klasiko' || m === 'karera' || m === 'bagyo') return b ? `Best ${peso(b)}` : 'Wala pang best';
  if (m === 'deadline') return b ? `Best ${clock(b)}` : 'Wala pang best';
  if (m === 'daily') return data.daily[dateKey()] ? `Ngayon ${peso(data.daily[dateKey()].score)}` : `Daily ${dateKey()}`;
  if (m === 'lingguhan') { const w = weeklyEvent(); return `${w.name}${data.weekly.week === w.week && data.weekly.best ? ` · ${peso(data.weekly.best)}` : ''}`; }
  if (m === 'proyekto') return `${CONTRACTS.reduce((a, c) => a + (data.stars[c.id] || 0), 0)}/${CONTRACTS.length * 3} ★`;
  if (m === 'versus') return `Liga ${data.vs.beaten.length}/${LADDER.length} · ${data.vs.wins} panalo`;
  if (m === 'training') return `${data.lessons.length}/${LESSONS.length} pasado`;
  return '2 manlalaro';
}
function labels() {
  for (const b of document.querySelectorAll('.sound')) { b.innerHTML = icon(data.muted ? 'mute' : 'speaker', 24); b.setAttribute('aria-label', data.muted ? 'Sound off, turn it on' : 'Sound on, turn it off'); }
  for (const b of document.querySelectorAll('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === data.difficulty));
  // the hub: PLAY is the last mode played
  const m = MODE_INFO[data.mode] ? data.mode : 'bahay', info = MODE_INFO[m];
  $('play-ico').innerHTML = icon(info.icon, 58);
  $('play-mode').textContent = `${modeName(m)}${info.diff ? ` · ${DIFFICULTY[data.difficulty].name}` : ''}`;
  $('play-best').textContent = modeBest(m);
  $('acct-label').textContent = online.user || 'Account';
  const rk = rankOf(data.xp);
  $('title-rank').innerHTML = `${rk.name} · <b>${data.xp.toLocaleString('en-US')}</b> XP`;
  $('wallet').innerHTML = `${icon('barya', 20)} <b>${(data.coins || 0).toLocaleString('en-US')}</b> ${icon('token', 20)} <b>${data.tokens}</b>`;
  const st = data.streak || {};
  $('streak').innerHTML = st.count ? `${icon('apoy', 22)} <b>${st.count}</b> araw` : '';
  $('streak').classList.toggle('hot', (st.count || 0) >= 3);
  streakOffer();
  if ((data.boost?.games || 0) > 0) $('title-rank').innerHTML += ` · <b>2×</b> XP ${data.boost.games}`;
  weeklyBanner();
  $('diff-note').textContent = { madali: 'Madali: mas mabagal ang bagsak at mas matagal bago dumikit.', katamtaman: 'Katamtaman: ang klasiko.', mahirap: 'Mahirap: magsisimula sa ika-6 na palapag.' }[data.difficulty] + ' (Bahay, Klasiko, Deadline, Bagyo, Karera)';
}
// Mga Laro: a card per mode; picking one plays it (or opens its own screen)
function openModes() {
  mode = 'modes';
  $('modes-body').innerHTML = Object.entries(MODE_INFO).filter(([k, v]) => !(v.desk && touch)).map(([k, v]) => `<button type="button" class="mcard" data-mode="${k}" aria-pressed="${k === data.mode}">${k === 'lingguhan' ? '<span class="tagx">NGAYONG LINGGO</span>' : ''}${icon(v.icon, 42)}<b>${modeName(k)}</b><small>${v.line}</small><em>${modeBest(k)}</em></button>`).join('');
  for (const b of $('modes-body').querySelectorAll('[data-mode]')) b.onclick = () => pickMode(b.dataset.mode);
  show('modes');
}
function pickMode(m) {
  data.mode = m; job = null; vsPick = null; lesson = null; persist(); labels();
  if (m === 'proyekto') openMap(); else if (m === 'versus') openVs(); else if (m === 'training') openLessons(); else if (m === 'tapatan') openTapatan(); else start();
}
$('modes-btn').onclick = openModes;
$('lessons-btn').onclick = () => { data.mode = 'training'; openLessons(); };
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => { data.difficulty = b.dataset.diff; persist(); labels(); if (mode === 'modes') openModes(); };

// ---------- settings ----------
let settingsFrom = 'title';
function openSettings(from) {
  settingsFrom = from; mode = 'settings';
  const o = data.opt, f = document.activeElement, again = f && f.dataset && f.dataset.k ? `[data-k="${f.dataset.k}"]${f.dataset.v !== undefined ? `[data-v="${f.dataset.v}"]` : ''}` : null;
  const val = (key) => (key === 'gfx' ? data.gfx : key === 'calm' ? data.calm : o[key]);
  const seg = (key, list) => `<div class="modes">${list.map(([v, label]) => `<button type="button" data-k="${key}" data-v="${v}" aria-pressed="${String(val(key)) === String(v)}">${label}</button>`).join('')}</div>`;
  const slider = (key, label) => `<label class="slide">${label} <input type="range" min="0" max="1" step="0.05" value="${o[key]}" data-k="${key}"></label>`;
  const R = data.rules, rv = (key) => R[key];
  const rseg = (key, list) => `<div class="modes">${list.map(([v, label]) => `<button type="button" data-k="r:${key}" data-v="${v}" aria-pressed="${String(rv(key)) === String(v)}">${label}</button>`).join('')}</div>`;
  const dasTxt = () => (R.das === null ? `Auto (${DIFFICULTY[data.difficulty].das})` : `${R.das} · ${Math.round(R.das * 16.67)} ms`);
  const arrTxt = () => (R.arr === null ? `Auto (${DIFFICULTY[data.difficulty].arr})` : R.arr === 0 ? '0 · agad' : `${R.arr} · ${Math.round(R.arr * 16.67)} ms`);
  $('settings-body').innerHTML = `
    <div class="grp"><h3>Laro · Game</h3>
    <p class="muted">Anino ng piraso · Ghost piece</p>${seg('ghost', [[true, 'Oo · On'], [false, 'Wala · Off']])}
    <p class="muted">Eksena sa Bayanihan at bagong palapag · Cutscenes</p>${seg('cine', [[true, 'Buo · Full'], [false, 'Wala · Off']])}
    ${AD_PROVIDER ? `<p class="muted">Mga alok na may patalastas · Reward ads</p>${seg('offers', [[true, 'Oo · On'], [false, 'Wala · Off']])}` : ''}
    </div><div class="grp"><h3>Camera</h3>
    <p class="muted">Anggulo · Angle</p>${seg('angle', [[true, 'Pahilig · Angled'], [false, 'Tuwid · Straight']])}
    <p class="muted">Yanig ng camera · Camera shake</p>${seg('calm', [[false, 'Buo · Full'], [true, 'Kalmado · Reduced']])}
    </div><div class="grp"><h3>Tunog at itsura · Sound and look</h3>
    ${slider('music', 'Musika · Music')}${slider('sfx', 'Tunog · Effects')}${slider('voiceVol', 'Boses · Voice')}
    <p class="muted">Boses ni Kapatas · Voice</p>${seg('voice', [[true, 'Oo · On'], [false, 'Wala · Off']])}
    <p class="muted">Yanig · Haptics (phone, controller)</p>${seg('haptics', [[true, 'Oo · On'], [false, 'Wala · Off']])}
    <p class="muted">Graphics</p>${seg('gfx', [['auto', 'Auto'], [2, 'Mataas'], [1, 'Katamtaman'], [0, 'Mababa']])}</div>
    <div class="grp"><h3>Kontrol · Controls</h3>
    <p class="muted">Susunod na piraso · Next queue</p>${rseg('next', [1, 2, 3, 4, 5, 6].map((n) => [n, n]))}
    <label class="slide">DAS <input type="range" min="0" max="20" step="1" value="${R.das ?? 0}" data-k="r:das"><span class="val" id="v-das">${dasTxt()}</span></label>
    <label class="slide">ARR <input type="range" min="-1" max="6" step="1" value="${R.arr ?? -1}" data-k="r:arr"><span class="val" id="v-arr">${arrTxt()}</span></label>
    <p class="muted">Bilis ng dahan · Soft drop</p>${rseg('soft', [[null, 'Normal'], [1, '×2'], [2, '×4'], [20, 'Agad']])}
    <p class="muted">Ikot 180° · Half turn (${keyName(data.keys.r180[0] || '-')})</p>${rseg('rot180', [[false, 'Wala · Off'], [true, 'Oo · On']])}
    <p class="muted">Imbak · Hold</p>${rseg('hold', [[true, 'Oo · On'], [false, 'Wala · Off']])}
    <p class="muted">Finesse coach (sa lahat ng mode)</p>${rseg('coach', [[false, 'Wala · Off'], [true, 'Oo · On']])}
    <p class="muted">Habulin ang multo · Ghost race</p>${rseg('ghost', [[true, 'Oo · On'], [false, 'Wala · Off']])}
    <p class="muted">Sa susunod na laro ang bago. Applies next game.</p>
    <div class="modes"><button type="button" id="open-keys">${icon('keyb', 20)} ${icon('pad', 20)} Mga pindutan · Remap</button></div></div>`;
  for (const b of $('settings-body').querySelectorAll('button')) b.onclick = () => {
    const k = b.dataset.k, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
    if (!k) return;
    if (k.startsWith('r:')) { data.rules[k.slice(2)] = raw === 'null' ? null : v; persist(); openSettings(settingsFrom); return; }
    if (k === 'gfx') { data.gfx = v; if (view) { view.post.setAuto(v === 'auto'); view.post.setLevel(v === 'auto' ? (touch ? 1 : 2) : v); applyGfx(); } }
    else if (k === 'calm') data.calm = v;
    else { o[k] = v; if (k === 'angle' && view) view.setAngled(v); if (k === 'voice') { V.setOn(v); if (v) V.say('win'); } if (k === 'haptics' && v) feel({ type: 'lines', n: 2 }); }
    persist(); openSettings(settingsFrom);
  };
  $('open-keys').onclick = () => { remapTarget = 'solo'; openKeys(); };
  for (const r of $('settings-body').querySelectorAll('input[type=range]')) r.oninput = () => {
    if (r.dataset.k === 'r:das') { data.rules.das = +r.value ? +r.value : null; $('v-das').textContent = dasTxt(); persist(); return; }
    if (r.dataset.k === 'r:arr') { data.rules.arr = +r.value < 0 ? null : +r.value; $('v-arr').textContent = arrTxt(); persist(); return; }
    o[r.dataset.k] = +r.value; if (r.dataset.k === 'voiceVol') { V.setVolume(+r.value); persist(); return; } A.start(); A.setMix(o); if (r.dataset.k === 'sfx') A.event({ type: 'lock', piece: 'O', cells: [] }); persist(); };
  show('settings');
  if (again && $('settings-body').querySelector(again)) $('settings-body').querySelector(again).focus({ preventScroll: true });
}
$('settings-ok').onclick = () => { if (settingsFrom === 'pause') { mode = 'pause'; show('pause'); } else { mode = 'title'; show('title'); } };
for (const b of document.querySelectorAll('.settings-btn')) b.onclick = () => openSettings(mode === 'pause' ? 'pause' : 'title');
function applyGfx() { if (view) view.setShadows(view.post.level > 0 || data.gfx !== 0); }

// ---------- Proyekto: the stage map and the contract card ----------
let mapCh = 0;
function openMap(ch = mapCh) {
  mode = 'map'; job = null; mapCh = ch;
  const total = CONTRACTS.reduce((a, c) => a + (data.stars[c.id] || 0), 0), open2 = chapterOpen(data.stars, 1);
  $('map-note').innerHTML = `<span class="modes">${CHAPTERS.map((c, i) => `<button type="button" data-ch="${i}" aria-pressed="${i === ch}" ${i === 1 && !open2 ? 'aria-disabled="true"' : ''}>${i === 1 && !open2 ? icon('lock', 16) + ' ' : ''}${c.name}</button>`).join('')}</span><br>${total}/${CONTRACTS.length * 3} ★ · Kailangan ng 8 ★ sa isang barangay para sa susunod.${open2 ? '' : ' Kabanata 2: tapusin ang Ang Huling Bahay, o 30 ★.'}`;
  $('map-body').innerHTML = CHAPTERS[ch].brgys.map((b) => [BARANGAYS[b], b]).map(([name, b]) => `<div class="card brgy"><h3>Brgy. ${name}<small>${brgyStars(data.stars, b)}/15 ★</small></h3>${CONTRACTS.filter((c) => c.brgy === b).map((c) => { const st = data.stars[c.id] || 0, open = unlocked(data.stars, c.id); return `<button type="button" class="job" data-job="${c.id}" ${open ? '' : 'aria-disabled="true"'}><span>${open ? '' : icon('lock', 18) + ' '}${c.name}</span><i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i></button>`; }).join('')}</div>`).join('');
  for (const bt of $('map-body').querySelectorAll('[data-job]')) bt.onclick = () => { const c = contractById(bt.dataset.job); if (unlocked(data.stars, c.id)) openBrief(c); else nopeContract(c); };
  for (const bt of $('map-note').querySelectorAll('[data-ch]')) bt.onclick = () => { if (+bt.dataset.ch === 1 && !chapterOpen(data.stars, 1)) nopeChapter(); else openMap(+bt.dataset.ch); };
  show('map');
}
function openBrief(c) {
  job = c; data.mode = 'proyekto'; mode = 'brief';
  const d = describe(c), st = data.stars[c.id] || 0;
  $('brief-brgy').textContent = `Brgy. ${BARANGAYS[c.brgy]} · Kontrata ${CONTRACTS.filter((x) => x.brgy === c.brgy).indexOf(c) + 1}/5`;
  $('brief-name').textContent = c.name; $('brief-text').textContent = c.brief; $('brief-goal').textContent = d.goal; $('brief-twist').textContent = d.twist || 'Walang dagdag na pahirap.'; $('brief-par').textContent = d.par;
  $('brief-stars').innerHTML = [1, 2, 3].map((k) => `<span class="${k <= st ? '' : 'off'}">★</span>`).join('');
  const L = lessonFor(c.id);
  $('brief-lesson').hidden = !L;
  $('brief-ad').hidden = !(createGame({ mode: 'proyekto', contract: c }).toolsOn && adOk('tool'));
  if (L) { $('brief-lesson').innerHTML = `${icon('blueprint', 20)} Aralin: ${L.name}${data.lessons.includes(L.id) ? ` ${icon('check', 18)}` : ''}`; $('brief-lesson').onclick = () => openLesson(L); }
  show('brief');
}
$('brief-go').onclick = start;
$('brief-ad').onclick = async () => {
  if (!(await watchAd('tool'))) return;
  const ts = toolsetFor(data.xp);
  bonusTool = ts[Math.floor(Math.random() * ts.length)];
  start();
  toast(`May dala kang ${bonusTool}! Pindutin ang E (o ang button) para gamitin.`, 3000);
};
$('brief-back').onclick = openMap;
// ---------- Laban: quick matches and the Liga ng Barangay ----------
function openVs() {
  mode = 'vs'; data.mode = 'versus';
  $('vs-quick').innerHTML = Object.values(LEVELS).map((l) => `<button type="button" data-lv="${l.id}">${l.name}</button>`).join('');
  $('vs-note').textContent = `${data.vs.beaten.length}/${LADDER.length} natalo · ${data.vs.wins} panalo lahat`;
  $('vs-ladder').innerHTML = LADDER.map((r, i) => { const open = ladderOpen(data.vs.beaten, r.id), won = data.vs.beaten.includes(r.id); return `<button type="button" class="rcard" data-rv="${r.id}" style="--rc:${r.color}" ${open ? '' : 'aria-disabled="true"'}><span class="num">${i + 1}</span>${won ? `<span class="won">${icon('check', 22)}</span>` : open ? '' : `<span class="won">${icon('lock', 20)}</span>`}${portrait(r.color, 58)}<b>${r.name}</b><small>Brgy. ${r.brgy}</small><em>${r.tag}</em></button>`; }).join('');
  for (const b of $('vs-quick').querySelectorAll('[data-lv]')) b.onclick = () => openRival(b.dataset.lv);
  for (const b of $('vs-ladder').querySelectorAll('[data-rv]')) b.onclick = () => {
    const id = b.dataset.rv;
    if (ladderOpen(data.vs.beaten, id)) { openRival(id); return; }
    const i = LADDER.findIndex((r) => r.id === id), prev = LADDER[i - 1];
    nope({ title: 'Hindi pa puwede', text: `Talunin muna si <b>${prev.name}</b> sa Liga bago si <b>${LADDER[i].name}</b>.`, hint: 'Beat the rival before this one first.', go: ladderOpen(data.vs.beaten, prev.id) ? { label: `Labanan si ${prev.name}`, run: () => openRival(prev.id) } : null });
  };
  show('vs');
}
function openRival(id) {
  const r = rivalById(id), lad = LADDER.find((x) => x.id === id);
  vsPick = id; data.mode = 'versus'; mode = 'rival';
  const bars = (v, max) => Array.from({ length: 5 }, (_, i) => `<i class="${i < Math.round((v / max) * 5) ? 'on' : ''}"></i>`).join('');
  $('rival-card').style.setProperty('--rc', r.color || '#ffd23f');
  $('rival-card').innerHTML = `${portrait(r.color || '#ffd23f', 92)}<small>${lad ? `Liga ng Barangay · Brgy. ${lad.brgy}` : 'Mabilisang laban'}</small><h3>${r.name}</h3><small>${lad ? lad.tag : r.style === 'tetris' ? 'Bayanihan' : r.spins ? 'Lahat' : 'Tagasalansan'}</small>
    <p>${lad ? lad.blurb : { baguhan: 'Bagong peon: mabagal at madalas magkamali. Para sa unang laban.', bihasa: 'Sanay na mason: nag-iipon ng kawayan para sa Bayanihan.', kapatas: 'Si Kapatas mismo: mabilis, may T-spin, halos walang mali.' }[id]}</p>
    <p class="meter" style="--rc:${r.color || '#ffd23f'}">Bilis&nbsp;${bars(r.pps, 2.1)}&nbsp;&nbsp;Husay&nbsp;${bars(1 - r.mistake, 1)}</p>
    ${lad ? `<p><b style="color:${r.color}">${r.name}:</b> "${lad.says.start[0]}"</p>` : ''}`;
  show('rival');
}
$('rival-go').onclick = () => { data.mode = 'versus'; start(); };
$('rival-back').onclick = openVs;

// ---------- Pagsasanay: the lessons ----------
function openLessons() {
  mode = 'lessons'; data.mode = 'training'; lesson = null;
  $('lessons-body').innerHTML = LESSONS.map((l) => `<button type="button" class="lcard" data-ls="${l.id}">${data.lessons.includes(l.id) ? `<span class="done">${icon('check', 22)}</span>` : ''}${icon('blueprint', 44)}<b>${l.name}</b><small>${l.tip}</small>${l.contracts.length ? `<i>Para sa ${[...new Set(l.contracts)].map((c) => contractById(c).name).join(', ')}</i>` : '<i>Para sa lahat</i>'}</button>`).join('');
  for (const b of $('lessons-body').querySelectorAll('[data-ls]')) b.onclick = () => openLesson(lessonById(b.dataset.ls));
  show('lessons');
}
function openLesson(l) {
  lesson = l; data.mode = 'training'; mode = 'lesson';
  $('lesson-num').textContent = `Aralin ${LESSONS.indexOf(l) + 1}/${LESSONS.length}${data.lessons.includes(l.id) ? ' · Pasado na' : ''}`;
  $('lesson-name').textContent = l.name; $('lesson-text').textContent = l.brief; $('lesson-keys').textContent = l.tip;
  $('lesson-for').textContent = l.contracts.length ? `Kailangan sa kontrata: ${[...new Set(l.contracts)].map((c) => contractById(c).name).join(', ')}.` : 'Ang gintong anino ang tamang puwesto; ipapakita ng coach ang sayang na pindot.';
  show('lesson');
}
$('lesson-go').onclick = () => { data.mode = 'training'; start(); };
$('lesson-back').onclick = openLessons;
$('ld-again').onclick = retryLesson;
$('ld-list').onclick = openLessons;
$('lretry').onclick = retryLesson;

// ---------- replays: the list, the viewer, sharing ----------
const MODE_LABEL = { klasiko: 'Klasiko', deadline: 'Deadline', karera: 'Karera', daily: 'Daily', versus: 'Laban', bahay: 'Bahay', bagyo: 'Bagyo', proyekto: 'Proyekto' };
const resultOf = (m) => (m.mode === 'deadline' ? (m.done ? clock(m.ticks) : `${m.lines}/40`) : m.mode === 'versus' ? `vs ${rivalById(m.rival)?.name || ''}` : peso(m.score));
function openReplays() {
  mode = 'replays';
  const rows = [];
  for (const [k, m] of Object.entries(replays.best)) rows.push([k === 'daily' ? `Best Daily ${m.date}` : `Best ${MODE_LABEL[m.mode]} · ${DIFFICULTY[m.diff]?.name || ''}`, m]);
  if (replays.last) rows.push(['Huling laro · Last game', replays.last]);
  $('replays-body').innerHTML = rows.length ? rows.map(([label, m], i) => `<div class="card rrow">${icon(m.mode === 'versus' ? 'vs' : 'replay', 34)}<div><b>${label}</b><small>${MODE_LABEL[m.mode] || m.mode} · ${resultOf(m)} · ${m.lines} hanay · ${m.date}</small></div><button type="button" class="primary" data-w="${i}">${icon('play', 16)} Panoorin</button><button type="button" data-sh="${i}">${icon('share', 16)} Link</button></div>`).join('') : '<p class="note card">Wala pang replay. Maglaro ng Deadline, Karera o Daily: ang pinakamagandang takbo mo ay itatabi rito.</p>';
  for (const b of $('replays-body').querySelectorAll('[data-w]')) b.onclick = () => watch(rows[+b.dataset.w][1].code);
  for (const b of $('replays-body').querySelectorAll('[data-sh]')) b.onclick = () => shareReplay(rows[+b.dataset.sh][1].code);
  show('replays');
}
$('replays-btn').onclick = openReplays;
function shareReplay(code) {
  const url = `${location.origin}${location.pathname}#r=${code}`;
  try { if (navigator.share && touch) navigator.share({ title: 'Hollow Blocks replay', url }).catch(() => {}); else navigator.clipboard.writeText(url).then(() => toast('Nakopya ang link! Replay link copied.', 2200), () => toast(url.slice(0, 80) + '…', 4000)); } catch { /* nothing to share with */ }
}
async function watch(code) {
  let r;
  try { r = await decode(code); } catch { toast('Sira ang replay link · This replay link is broken.', 3000); return; }
  const pb = startPlayback(r);
  viewer = { pb, code, speed: 1, paused: false, acc: 0, ended: false };
  game = null; match = null; lesson = null; ghost = null;
  if (view) view.setVersus(!!r.head.vs, r.head.vs ? rivalById(r.head.vs) : null);
  mode = 'replay'; hudKey = ''; toolsKey = '';
  show(null); viewerUi();
}
const vgame = () => (viewer ? (viewer.pb.rec.head.vs ? viewer.pb.g.a : viewer.pb.g) : null);
function viewerUi() {
  if (!viewer) return;
  $('rb-play').innerHTML = icon(viewer.paused ? 'play' : 'pause', 20);
  $('rb-share').innerHTML = `${icon('share', 18)} Link`;
  for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(+b.dataset.speed === viewer.speed));
}
function toggleViewer() {
  if (!viewer) return;
  if (viewer.ended) { const code = viewer.code; watch(code); return; }
  viewer.paused = !viewer.paused; viewerUi();
}
function closeViewer() { viewer = null; if (view) view.setVersus(false); location.hash && history.replaceState(null, '', location.pathname + location.search); const b = viewerBack; viewerBack = null; (b || openReplays)(); }
$('rb-play').onclick = toggleViewer;
for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { if (viewer) { viewer.speed = +b.dataset.speed; viewerUi(); } };
$('rb-share').onclick = () => { if (viewer) shareReplay(viewer.code); };
$('rb-close').onclick = closeViewer;
$('watch').onclick = () => { if (replays.last) watch(replays.last.code); };

// ---------- the controls: keys and controller buttons ----------
const KEY_ACTS = ['left', 'right', 'down', 'hard', 'cw', 'ccw', 'r180', 'hold', 'tool', 'pause'], PAD_ACTS = ['cw', 'ccw', 'r180', 'hold', 'hard', 'tool', 'pause'];
let remapTarget = 'solo'; // 'solo' or Tapatan's 'p1' / 'p2'
const keyTarget = () => (remapTarget === 'p1' ? data.keys1 : remapTarget === 'p2' ? data.keys2 : data.keys);
const otherTarget = () => (remapTarget === 'p1' ? data.keys2 : remapTarget === 'p2' ? data.keys1 : null);
function openKeys() { mode = 'keys'; capture = null; drawKeys(); show('keys'); }
function drawKeys() {
  const map = keyTarget(), pm = data.pad;
  const kRow = (a) => `<tr class="${capture && capture.kind === 'key' && capture.act === a ? 'cap' : ''} ${capture?.kind === 'key' && capture.clash?.other === a ? 'clash' : ''}"><td>${ACT_NAME[a]}</td><td>${map[a].map((k, i) => `<span class="kchip">${keyName(k)}<button type="button" data-rm="${a}:${i}" aria-label="Remove ${keyName(k)}">×</button></span>`).join('') || '<span class="muted">wala</span>'}</td><td><button type="button" class="add" data-cap="${a}">${capture && capture.kind === 'key' && capture.act === a ? 'Pindutin…' : '+ Dagdag'}</button></td></tr>`;
  const pRow = (a) => `<tr class="${capture && capture.kind === 'pad' && capture.act === a ? 'cap' : ''} ${capture?.kind === 'pad' && capture.clash?.other === a ? 'clash' : ''}"><td>${ACT_NAME[a]}</td><td>${pm[a].map((b) => `<span class="kchip">${PAD_NAME[b] || `#${b}`}</span>`).join('') || '<span class="muted">wala</span>'}</td><td><button type="button" class="add" data-pcap="${a}">${capture && capture.kind === 'pad' && capture.act === a ? 'Pindutin…' : 'Palitan'}</button></td></tr>`;
  let note = '<p class="capnote muted">Pumili ng aksyon, saka pindutin ang bagong key o button. Esc para kanselahin.</p>';
  if (capture && capture.clash) note = `<p class="capnote warn">${icon('warn', 20)} Ang <b>${capture.kind === 'key' ? keyName(capture.clash.key) : PAD_NAME[capture.clash.key]}</b> ay gamit na ng <b>${capture.clash.theirs ? `${remapTarget === 'p1' ? 'P2' : 'P1'}: ` : ''}${ACT_NAME[capture.clash.other]}</b>. Ilipat dito sa ${ACT_NAME[capture.act]}?<button type="button" id="clash-yes">Ilipat · Move</button><button type="button" id="clash-no">Huwag · Cancel</button></p>`;
  else if (capture) note = `<p class="capnote">${icon(capture.kind === 'key' ? 'keyb' : 'pad', 20)} Pindutin ang ${capture.kind === 'key' ? 'key' : 'button sa controller'} para sa <b>${ACT_NAME[capture.act]}</b>… (Esc: kanselahin)</p>`;
  const tabs = `<div class="modes" style="grid-column:1/-1;justify-content:flex-start">${[['solo', 'Isahan · Solo'], ['p1', 'Tapatan · P1'], ['p2', 'Tapatan · P2']].map(([v, l]) => `<button type="button" data-rt="${v}" aria-pressed="${remapTarget === v}">${l}</button>`).join('')}</div>`;
  $('keys-body').innerHTML = tabs + `<div><p class="h3g">${icon('keyb', 22)} Keyboard${remapTarget === 'solo' ? '' : ` · ${remapTarget.toUpperCase()}`}</p><table class="kt">${KEY_ACTS.map(kRow).join('')}</table></div><div><p class="h3g">${icon('pad', 22)} Controller</p><table class="kt">${PAD_ACTS.map(pRow).join('')}</table><p class="muted" style="margin-top:6px">Ang d-pad at kaliwang stick: galaw at dahan.</p></div>${note}`;
  for (const b of $('keys-body').querySelectorAll('[data-rt]')) b.onclick = () => { remapTarget = b.dataset.rt; capture = null; drawKeys(); };
  for (const b of $('keys-body').querySelectorAll('[data-cap]')) b.onclick = () => { capture = { kind: 'key', act: b.dataset.cap }; drawKeys(); };
  for (const b of $('keys-body').querySelectorAll('[data-pcap]')) b.onclick = () => { capture = { kind: 'pad', act: b.dataset.pcap, armed: false }; drawKeys(); };
  for (const b of $('keys-body').querySelectorAll('[data-rm]')) b.onclick = () => { const [a, i] = b.dataset.rm.split(':'); keyTarget()[a].splice(+i, 1); keymap(); tapKeys(); persist(); drawKeys(); };
  if ($('clash-yes')) { $('clash-yes').onclick = () => assign(capture.clash.key, true); $('clash-no').onclick = () => { capture = null; drawKeys(); }; }
}
// a key or button arrived for the action being changed: warn on a clash, else take it
function captured(k) {
  if (!capture) return;
  if (capture.kind === 'key' && (k === 'Escape')) { capture = null; drawKeys(); return; }
  const map = capture.kind === 'key' ? keyTarget() : data.pad;
  const other = Object.keys(map).find((a) => a !== capture.act && map[a].includes(k));
  if (other) { capture.clash = { key: k, other }; drawKeys(); return; }
  // Tapatan: the other player's keys count too
  const om = capture.kind === 'key' ? otherTarget() : null, theirs = om && Object.keys(om).find((a) => om[a].includes(k));
  if (theirs) { capture.clash = { key: k, other: theirs, theirs: true }; drawKeys(); return; }
  assign(k, false);
}
function assign(k, move) {
  const c = capture, map = c.kind === 'key' ? keyTarget() : data.pad;
  if (move) for (const a of Object.keys(map)) if (a !== c.act) map[a] = map[a].filter((x) => x !== k);
  if (move && c.clash && c.clash.theirs) { const om = otherTarget(); for (const a of Object.keys(om)) om[a] = om[a].filter((x) => x !== k); }
  if (c.kind === 'key') { if (!map[c.act].includes(k)) { map[c.act].push(k); if (map[c.act].length > 3) map[c.act].shift(); } }
  else map[c.act] = [k];
  capture = null; keymap(); tapKeys(); persist(); drawKeys();
  toast(`${ACT_NAME[c.act]}: ${c.kind === 'key' ? keyName(k) : PAD_NAME[k]}`, 1600);
}
$('keys-ok').onclick = () => { capture = null; if (remapTarget !== 'solo' && data.mode === 'tapatan' && !game) { remapTarget = 'solo'; openTapatan(); return; } remapTarget = 'solo'; openSettings(settingsFrom); };
$('keys-reset').onclick = () => { if (remapTarget === 'p1') data.keys1 = validMap(null, DEF_KEYS_P1, () => true); else if (remapTarget === 'p2') data.keys2 = validMap(null, DEF_KEYS_P2, () => true); else data.keys = validMap(null, DEF_KEYS, () => true); tapKeys(); data.pad = validMap(null, DEF_PAD, () => true); capture = null; keymap(); persist(); drawKeys(); toast('Ibinalik sa default · Controls reset', 1600); };
keymap();

// ---------- the weekly event: the banner on the title, with a countdown ----------
function weeklyBanner() {
  const w = weeklyEvent(), rec = data.weekly.week === w.week ? data.weekly : null;
  $('weekly').innerHTML = `${icon('calendar', 40)}<div><small>Lingguhan · ${w.week}</small><b>${w.name}</b><span>${w.blurb}</span><em>${rec ? `Best: ${peso(rec.best || 0)} · ` : ''}Susunod: ${w.next.name} sa <i id="wk-left">${countdown(w.left)}</i></em></div><button type="button" class="${data.mode === 'lingguhan' ? 'primary' : ''}" id="wk-go">${icon('play', 16)} Laruin</button>`;
  $('wk-go').onclick = () => { data.mode = 'lingguhan'; persist(); labels(); start(); };
}
setInterval(() => { const el = $('wk-left'); if (el && !$('title').hidden) el.textContent = countdown(weeklyEvent().left); }, 1000);
// the plumada: the bot's best place for the piece in hand, while it lasts
let plumbMemo = { k: '', cells: null };
function plumbHint() {
  if (!game || !game.plumb || !game.cur || game.phase !== 'play') return null;
  const k = `${game.pieces}|${game.cur.type}`;
  if (plumbMemo.k !== k) { const best = ranked(game.board, game.cur.type)[0]; plumbMemo = { k, cells: best ? cellsOf(best.land) : null }; }
  return plumbMemo.cells;
}
// the Inspector's lines, in his own bubble, and his bar
const INSP = {
  enter: ['Inspeksyon! Tingnan natin ang trabaho mo.', 'Nasaan ang building permit?'],
  stamp: ['REJECTED!', 'Hindi pasado ito!', 'Ayusin mo yan!', 'Ito, mali!'],
  passed: ['Hmm. Pwede na.', 'Sige, pasado yan.'],
  late: ['Malapit na ang deadline ng inspeksyon!', 'Tik-tak, tik-tak...'],
  won: ['Pasado! Aprubado ang bahay.', 'Maganda ang trabaho. Pirmado na.'],
  lost: ['Ipapasara ko ang site na ito!', 'Bagsak ang inspeksyon!'],
};
let ibubbleT = 0, isayCool = 0;
function inspSays(kind, force = false) {
  if (!force && isayCool > 0) return;
  const el = $('ibubble'); el.textContent = pick(INSP[kind]); ibubbleT = 2.6; isayCool = 2.5;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (!view) toast(`Inspektor: "${el.textContent}"`, 1800);
}
function inspHud(dt) {
  const bar = $('inspbar'), g = game;
  bar.hidden = !(g && g.insp && mode === 'play');
  if (!bar.hidden) { const k = g.insp.bar / g.insp.max; bar.style.setProperty('--p', `${(k * 100).toFixed(1)}%`); bar.classList.toggle('late', k > 0.8); bar.querySelector('em').textContent = clock(Math.max(0, g.insp.max - g.insp.bar)); if (k > 0.8 && Math.random() < dt * 0.15) inspSays('late'); }
  ibubbleT -= dt; isayCool -= dt;
  const el = $('ibubble'), p = view ? view.inspHead() : { on: false }, on = ibubbleT > 0 && p.on && (mode === 'play' || mode === 'results');
  el.hidden = !on;
  if (on) { const hw = el.offsetWidth / 2 + 6; p.x = Math.max(hw, Math.min(innerWidth - hw, p.x)); el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`; }
}

// ---------- Tindahan: the shop and the locker, previewed live on the site behind ----------
let shopTab = 'skin', shopPrev = null;
const profile = () => ({ coins: data.coins, tokens: data.tokens, owned: data.owned, equip: data.equip, xp: data.xp, medals: data.medals });
const looks = (over = null) => {
  const e = { ...DEFAULT_EQUIP, ...data.equip }, p = profile();
  for (const k of Object.keys(DEFAULT_EQUIP)) { const it = itemById(e[k]); if (!it || !(isOwned(it, p) || onTrial(data.trials, it.id))) e[k] = DEFAULT_EQUIP[k]; } // a trial over: back to the default
  if (over) e[over.kind] = over.id;
  return e;
};
function wearLooks(over = null) { const e = looks(over); if (view) { view.setSkin(e.skin); view.setOutfit(e.outfit); view.setTheme(e.theme); } }
const priceText = (it) => (it.price ? [it.price.coins ? `${icon('barya', 16)} ${it.price.coins}` : '', it.price.tokens ? `${icon('token', 16)} ${it.price.tokens}` : ''].join(' ') : it.unlock ? `${icon('lock', 14)} ${it.unlock.medal ? MEDALS.find((m) => m.id === it.unlock.medal)?.name || 'Medalya' : RANKS[it.unlock.rank].name}` : 'Libre');
function openShop(tab = shopTab) {
  mode = 'shop'; shopTab = tab;
  const p = profile(), e = looks(), prev = shopPrev ? itemById(shopPrev) : itemById(e[tab]);
  $('shop-wallet').innerHTML = `${icon('barya', 20)} <b>${data.coins.toLocaleString('en-US')}</b> ${icon('token', 20)} <b>${data.tokens}</b>`;
  shopOffers();
  $('shop-tabs').innerHTML = Object.entries(KINDS).map(([k, n]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${n}</button>`).join('');
  $('shop-body').innerHTML = ITEMS.filter((it) => it.kind === tab).map((it) => { const own = isOwned(it, p), on = e[it.kind] === it.id; return `<button type="button" class="sitem ${prev && prev.id === it.id ? 'prev' : ''} ${own ? '' : 'locked'}" data-item="${it.id}" aria-pressed="${on}"><span class="swatch">${it.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span><b>${it.name}</b><em>${on ? `${icon('check', 14)} Suot` : own ? 'Iyo na' : priceText(it)}</em></button>`; }).join('');
  if (prev) {
    const own = isOwned(prev, p), on = e[prev.kind] === prev.id, can = canBuy(prev, p);
    const btn = on ? `<button type="button" disabled>${icon('check', 16)} Suot na</button>` : own ? `<button type="button" class="primary" id="shop-equip">Isuot · Equip</button>` : prev.price ? `<button type="button" class="primary" id="shop-buy" ${can ? '' : 'aria-disabled="true"'}>Bilhin ${priceText(prev)}</button>` : `<button type="button" id="shop-locked" aria-disabled="true">${priceText(prev)}</button>`;
    const trialing = !own && onTrial(data.trials, prev.id);
    const tbtn = trialing ? (on ? '' : `<button type="button" class="primary" id="shop-trialwear">Isuot · Trial</button>`) : !own && adOk('trial') ? adBtn('shop-trial', 'Subukan nang 24 oras') : '';
    $('shop-detail').innerHTML = `<b>${prev.name}</b>${trialing ? `<small class="trialnote">Trial · ${countdown(data.trials[prev.id] - Date.now())} pa</small>` : ''}<div class="row">${btn}${tbtn}</div><p>${prev.desc}${!own && prev.price && !can ? ' <i class="muted">Kulang pa ang ipon.</i>' : ''}${!own && prev.unlock ? ` <i class="muted">Bukas kapag nakuha ang ${prev.unlock.medal ? 'medalyang ' + (MEDALS.find((m) => m.id === prev.unlock.medal)?.name || '') : 'ranggong ' + RANKS[prev.unlock.rank].name}.</i>` : ''}</p>`;
    if ($('shop-trial')) $('shop-trial').onclick = async () => { if (await watchAd('trial')) { data.trials = startTrial(data.trials, prev.id); data.equip = { ...data.equip, [prev.kind]: prev.id }; persist(); shopPrev = null; wearLooks(); toast(`Suot mo ang ${prev.name} nang 24 oras!`, 2400); openShop(tab); } };
    if ($('shop-trialwear')) $('shop-trialwear').onclick = () => { data.equip = { ...data.equip, [prev.kind]: prev.id }; persist(); shopPrev = null; wearLooks(); openShop(tab); };
    if ($('shop-equip')) $('shop-equip').onclick = () => { const r = equip(prev, profile()); if (r.ok) { data.equip = r.p.equip; persist(); shopPrev = null; wearLooks(); A.event({ type: 'levelUp' }); openShop(tab); } };
    if ($('shop-locked')) $('shop-locked').onclick = () => nope({ title: 'Naka-lock pa', text: `Hindi ito nabibili: bubukas ang <b>${prev.name}</b> kapag nakuha mo ang ${prev.unlock.medal ? `medalyang <b>${MEDALS.find((m) => m.id === prev.unlock.medal)?.name || ''}</b> (${MEDALS.find((m) => m.id === prev.unlock.medal)?.desc || ''})` : rankNeed(prev.unlock.rank)}.`, hint: 'Not for sale: a medal or a rank opens it.' });
    if ($('shop-buy')) $('shop-buy').onclick = () => {
      if (!canBuy(prev, profile())) {
        const f = shortfall(prev, profile()), short = [f.coins ? `<b>${coinsTxt(f.coins)} barya</b>` : '', f.tokens ? `<b>${tokTxt(f.tokens)} token</b>` : ''].filter(Boolean).join(' at ');
        nope({ title: f.coins ? 'Kulang ang barya' : 'Kulang ang token', ico: f.coins ? 'barya' : 'token', text: `Ang <b>${prev.name}</b> ay ${priceText(prev)}. Mayroon kang ${coinsTxt(data.coins || 0)} at ${tokTxt(data.tokens || 0)}, kulang pa ng ${short}.`,
          hint: [f.coins ? 'Every game earns barya.' : '', f.tokens ? 'Tokens come from the weekly event (Lingguhan).' : ''].filter(Boolean).join(' '),
          go: f.coins && adOk('barya') ? { label: `+${OFFERS.barya.coins} barya · patalastas`, run: () => $('ad-barya')?.click() } : null });
        return;
      }
      const r = buy(prev, profile()); if (r.ok) { Object.assign(data, { coins: r.p.coins, tokens: r.p.tokens, owned: r.p.owned }); const q = equip(prev, profile()); if (q.ok) data.equip = q.p.equip; persist(); shopPrev = null; wearLooks(); A.event({ type: 'ceremony' }); buzz([20, 20, 40]); toast(`Nabili: ${prev.name}!`, 1800); openShop(tab); } };
  } else $('shop-detail').innerHTML = '';
  wearLooks(prev);
  for (const b of $('shop-tabs').querySelectorAll('[data-tab]')) b.onclick = () => { shopPrev = null; openShop(b.dataset.tab); };
  for (const b of $('shop-body').querySelectorAll('[data-item]')) b.onclick = () => { shopPrev = b.dataset.item; openShop(tab); };
  if ($('shop').hidden) show('shop');
}
$('shop-btn').onclick = () => { shopPrev = null; openShop('skin'); };

// ---------- Mga Naitayong Bahay: every house finished in Bahay, with a picture from the site ----------
const HKEY = 'hollowblocks.houses';
let houses = [];
try { if (!TEST) { const h = JSON.parse(localStorage.getItem(HKEY)); if (Array.isArray(h)) houses = h; } } catch { /* none yet */ }
const saveHouses = () => { if (TEST) return; for (let n = houses.length; n > 0; n--) { try { localStorage.setItem(HKEY, JSON.stringify(houses.slice(0, n))); return; } catch { /* too big: keep fewer */ } } };
function recordHouse(g, floors) {
  if (g.mode !== 'bahay') return;
  const e = looks(), h = { id: Date.now(), style: data.style, floors, date: dateKey(), score: g.score, lines: g.lines, ticks: g.elapsed, skin: e.skin, theme: e.theme, thumb: null };
  houses.unshift(h); houses = houses.slice(0, 48); saveHouses();
  if (view) setTimeout(() => view.snapshot(360, 220, 'house').then((u) => { h.thumb = u; saveHouses(); }), 900);
}
const styleName = (id) => (STYLES.find((x) => x.id === id) || STYLES[0]).name;
function openBook() {
  mode = 'book';
  $('book-note').textContent = houses.length ? `${houses.length} bahay · ${houses.reduce((a, h) => a + h.floors, 0)} palapag lahat` : '';
  $('book-body').innerHTML = houses.length ? houses.map((h, i) => `<button type="button" class="bitem" data-h="${i}">${h.thumb ? `<img src="${h.thumb}" alt="">` : `<img alt="">`}<b>${styleName(h.style)} · ${h.floors} palapag</b><small>${h.date} · ${peso(h.score)}</small></button>`).join('') : `<p class="note card">Wala pang natapos na bahay. Sa Bahay, bawat limang palapag ay isang buong bahay: may larawan ito rito.</p>`;
  for (const b of $('book-body').querySelectorAll('[data-h]')) b.onclick = () => openHouse(houses[+b.dataset.h]);
  show('book');
}
function openHouse(h) {
  mode = 'house';
  $('house-img').src = h.thumb || ''; $('house-name').textContent = `${styleName(h.style)} · ${h.floors} palapag`; $('house-date').textContent = `Natapos ${h.date}`;
  const stat = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  $('house-stats').innerHTML = stat('Kita', peso(h.score)) + stat('Hanay', h.lines) + stat('Oras', clock(h.ticks)) + stat('Bloke', itemById(h.skin)?.name || 'Klasiko') + stat('Site', itemById(h.theme)?.name || 'Barangay') + stat('Palapag', h.floors);
  $('house-share').onclick = () => shareHouse(h);
  show('house');
}
// a card picture: the house, its name and numbers, in the game's colours; shared, or saved as a PNG
function shareHouse(h) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 640; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#2a1e30'); g.addColorStop(1, '#120d14'); x.fillStyle = g; x.fillRect(0, 0, 900, 640);
  const done = () => {
    x.fillStyle = '#ffd23f'; x.font = 'italic 900 54px "Barlow Condensed", sans-serif'; x.fillText(`${styleName(h.style).toUpperCase()} · ${h.floors} PALAPAG`, 40, 560);
    x.fillStyle = '#fff8e1'; x.font = '700 24px "Baloo 2", sans-serif'; x.fillText(`${peso(h.score)} · ${h.lines} hanay · ${clock(h.ticks)} · ${h.date}`, 40, 600);
    x.fillStyle = '#e8d8c8'; x.font = 'italic 800 22px "Barlow Condensed", sans-serif'; x.textAlign = 'right'; x.fillText('HOLLOW BLOCKS · hollow-blocks.vercel.app', 860, 600);
    c.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `hollow-blocks-bahay-${h.date}.png`, { type: 'image/png' });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Hollow Blocks', text: `Natapos ko ang ${styleName(h.style)}: ${h.floors} palapag!` }).catch(() => {}); return; } } catch { /* download instead */ }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Naka-save ang larawan · Image saved', 1800);
    }, 'image/png');
  };
  x.strokeStyle = '#ffd23f'; x.lineWidth = 8; x.strokeRect(36, 36, 828, 470);
  if (h.thumb) { const im = new Image(); im.onload = () => { x.drawImage(im, 40, 40, 820, 462); done(); }; im.onerror = done; im.src = h.thumb; } else done();
}
$('book-btn').onclick = openBook;
$('house-back').onclick = openBook;

// ---------- the daily login streak ----------
function streakDay() {
  const r = touchStreak(data.streak);
  if (!r.bonus) return;
  const lost = brokeStreak(data.streak, r.st);
  if (lost) data.lostStreak = lost;
  data.streak = r.st; data.xp += r.bonus.xp; data.coins += r.bonus.coins; persist();
  setTimeout(() => toast(`${r.graced ? 'Nailigtas ng palugit ang streak mo! ' : ''}Araw ${r.st.count} ng streak: +${r.bonus.xp} XP, +${r.bonus.coins} barya`, 3200), 1200);
}

// ---------- rewarded ads (ads.mjs) ----------
// A provider says whether an ad is ready and plays one, resolving to whether it was watched to the end.
// Google's (googleads.mjs) is ready only once AdSense has an ad to give, so offers appear only then;
// ?ads=test plays a stand-in instead, and the test page (?test=1) has none.
// Google's comes a few seconds after the title is up, so its scripts don't slow the game's first load
let AD_PROVIDER = Q.get('ads') === 'test' ? { ready: () => true, show: testAd } : null;
function startAds() {
  if (AD_PROVIDER || TEST) return;
  AD_PROVIDER = createGoogleAds({ test: Q.get('adtest') === '1', onChange: () => refreshOffers(), mute: (on) => A.setMuted(on || data.muted) });
}
// an ad came ready or went: the screen showing offers shows them again
let lastDouble = 0;
function refreshOffers() {
  if (mode === 'title') streakOffer();
  else if (mode === 'shop') shopOffers();
  else if (mode === 'brief' && job) $('brief-ad').hidden = !(createGame({ mode: 'proyekto', contract: job }).toolsOn && adOk('tool'));
  else if (mode === 'results' && lastDouble) offerDouble(lastDouble);
}
function testAd() {
  return new Promise((resolve) => {
    let t = 5, done = false;
    const tick = () => { $('ad-left').textContent = t > 0 ? `${t}` : '✓'; $('ad-claim').hidden = t > 0; };
    $('ad').hidden = false; A.setMuted(true); tick(); $('ad-close').focus();
    const iv = setInterval(() => { t--; tick(); if (t <= 0) { clearInterval(iv); $('ad-claim').focus(); } }, 1000);
    const end = (ok) => { if (done) return; done = true; clearInterval(iv); $('ad').hidden = true; A.setMuted(data.muted); resolve(ok); };
    $('ad-claim').onclick = () => end(true); $('ad-close').onclick = () => end(false);
  });
}
const adOk = (kind) => !!AD_PROVIDER && AD_PROVIDER.ready() && !AUTOPLAY && canOffer(kind, { ads: data.ads, games: Q.get('adtest') === '1' ? 99 : data.stats.games || 0, on: data.opt.offers }, Date.now()); // ?adtest=1: offers from the first game, to check the ads
const adBtn = (id, label) => `<button type="button" class="adbtn" id="${id}">${icon('play', 16)} ${label}<small>patalastas</small></button>`;
let adShowing = false;
const APP_NODES = [...document.body.children]; // the page's own, from before any ad code; an ad network's added later stay live
async function watchAd(kind) {
  if (!adOk(kind) || adShowing) return false;
  // everything but the ad's own layer goes inert (a real network's ad is added later, so it stays live)
  const back = document.activeElement, rest = [];
  for (let n = $('ad'); n && n !== document.body && n.parentElement; n = n.parentElement) for (const sib of n.parentElement.children) if (sib !== n && !sib.inert && sib.tagName !== 'SCRIPT' && (n.parentElement !== document.body || APP_NODES.includes(sib))) rest.push(sib);
  adShowing = true; for (const el of rest) el.inert = true;
  let ok = false;
  try { ok = await AD_PROVIDER.show(kind); } finally { adShowing = false; for (const el of rest) el.inert = false; if (back && back.isConnected) back.focus({ preventScroll: true }); }
  if (!ok) { toast('Walang gantimpala: hindi tinapos ang patalastas.', 2200); return false; }
  data.ads = spend(kind, data.ads); persist();
  return true;
}
// the results screen: the game's barya again
function offerDouble(coins) {
  lastDouble = coins;
  const el = $('ad-double');
  el.hidden = !(coins > 0 && adOk('double'));
  el.disabled = false;
  el.innerHTML = `${icon('play', 16)} Doblehin: +${coins} barya<small>patalastas</small>`;
  el.onclick = async () => { el.disabled = true; if (await watchAd('double')) { data.coins += coins; lastDouble = 0; persist(); el.hidden = true; A.event({ type: 'ceremony' }); toast(`+${coins} barya! Doble ang kita.`, 2200); } el.disabled = false; };
}
// the Tindahan's offers: free barya and Overtime
function shopOffers() {
  const bits = [];
  if (adOk('barya')) bits.push(adBtn('ad-barya', `+${OFFERS.barya.coins} barya (${left('barya', data.ads)} pa ngayon)`));
  if ((data.boost?.games || 0) > 0) bits.push(`<span class="hchip">Overtime: <b>2×</b> XP · ${data.boost.games} laro pa</span>`);
  else if (adOk('overtime')) bits.push(adBtn('ad-overtime', `Overtime: 2× XP sa ${OFFERS.overtime.games} laro`));
  $('shop-offers').innerHTML = bits.join('');
  $('shop-offers').hidden = !bits.length;
  if ($('ad-barya')) $('ad-barya').onclick = async () => { if (await watchAd('barya')) { data.coins += OFFERS.barya.coins; persist(); A.event({ type: 'ceremony' }); toast(`+${OFFERS.barya.coins} barya!`, 1800); openShop(); ($('ad-barya') || $('shop-tabs').querySelector('button'))?.focus({ preventScroll: true }); } };
  if ($('ad-overtime')) $('ad-overtime').onclick = async () => { if (await watchAd('overtime')) { data.boost = { games: OFFERS.overtime.games }; persist(); labels(); toast(`Overtime! Doble ang XP sa susunod na ${OFFERS.overtime.games} laro.`, 2400); openShop(); ($('ad-barya') || $('shop-tabs').querySelector('button'))?.focus({ preventScroll: true }); } };
}
function streakOffer() {
  const lost = canRescue(data.lostStreak) && adOk('streak') ? data.lostStreak : null;
  $('ad-streak').hidden = !lost;
  if (lost) $('ad-streak').innerHTML = `${icon('apoy', 18)} Iligtas ang ${lost.count}-araw na streak<small>patalastas</small>`;
}
$('ad-streak').onclick = async () => {
  if (!canRescue(data.lostStreak) || !(await watchAd('streak'))) return;
  data.streak = rescue(data.streak, data.lostStreak); data.lostStreak = null; persist(); labels();
  A.event({ type: 'ceremony' }); toast(`Naligtas! Araw ${data.streak.count} ng streak mo.`, 2400);
};

// ---------- online: the account, the cloud save and Ranking (online.mjs, api/_hb.mjs) ----------
// The save with more XP wins (XP only grows): a newer one from another device or from before the browser
// was cleared is loaded at once on the title screen, or on the way back to it after a game.
let newerSave = null, pendingScore = null, viewerBack = null, rkMode = 'bahay', rkDiff = null, rkAsk = 0, acctTab = 'login';
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
function adopt(d) {
  if (mode !== 'title' && mode !== 'account') { newerSave = d; return; }
  newerSave = null;
  store.set(d);
  if (store.get()?.xp !== d.xp) return; // this browser keeps nothing: play on as is
  try { sessionStorage.setItem('hollowblocks.restored', '1'); } catch { /* no toast then */ }
  location.reload();
}
async function pushSave() {
  const r = await online.push(data);
  if (r.status === 409 && r.data) adopt(r.data);
  return r;
}
async function sync() {
  const r = await online.pull();
  if (!r.ok) return r;
  if (r.data && r.data.xp > data.xp) { adopt(r.data); return r; }
  return pushSave();
}
// a finished game goes to its board: the server plays the replay through to rank it
function rankGame(g, done) {
  const el = $('results-rank'), r0 = rec;
  el.hidden = true; pendingScore = null;
  if (!r0 || !RANKED[g.mode] || (g.mode === 'deadline' ? !done : !(g.score > 0))) return;
  el.hidden = false; el.className = 'muted';
  const code = encode(r0);
  code.catch(() => { /* no CompressionStream: sendScore says so */ });
  if (!online.user) {
    pendingScore = code;
    el.innerHTML = `<button type="button" id="rank-login">${icon('ranking', 18)} Mag-login para sa Ranking</button>`;
    $('rank-login').onclick = () => openAccount();
    return;
  }
  el.textContent = 'Ipinapadala sa Ranking…';
  sendScore(code).then((t) => { if (game === g && mode === 'results') { el.textContent = t; } });
}
async function sendScore(codeP) {
  let code;
  try { code = await codeP; } catch { return 'Hindi maipadala ang replay dito.'; }
  const r = await online.submit(code);
  if (r.status === 0) { queueScore(code); return 'Walang koneksyon: ipapadala kapag may internet na.'; }
  if (!r.ok) return r.error || 'Hindi naipadala.';
  return `#${r.rank} sa ${boardName(r.board)} (sa ${r.of})${r.improved ? ' · bagong best sa Ranking!' : ` · best mo: ${fmtVal(r.board, r.best)}`}`;
}
// games finished without a connection wait here (this browser only, the newest five) and go when it's back
const PKEY = 'hollowblocks.pending';
function queueScore(code) {
  try { const q = JSON.parse(localStorage.getItem(PKEY) || '[]'); if (!q.includes(code)) q.push(code); localStorage.setItem(PKEY, JSON.stringify(q.slice(-5))); } catch { /* storage off: this one is lost */ }
}
let flushing = false;
async function flushScores() {
  if (flushing || !online.user || TEST) return;
  let q; try { q = JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch { return; }
  if (!q.length) return;
  flushing = true;
  const left = [];
  for (const code of q) {
    const r = await online.submit(code);
    if (r.status === 0) { left.push(code); continue; } // still offline: try later
    if (r.ok) toast(`Naipadala ang laro: #${r.rank} sa ${boardName(r.board)}${r.improved ? ' · bagong best!' : ''}`, 2600);
  }
  try { if (left.length) localStorage.setItem(PKEY, JSON.stringify(left)); else localStorage.removeItem(PKEY); } catch { /* fine */ }
  flushing = false;
}
addEventListener('online', () => flushScores());
const fmtVal = (b, v) => (b.startsWith('deadline.') ? clock(v) : peso(v));
function boardName(b) { const [m, d] = b.split('.'); return `${RANKED[m]}${byDiff(m) ? ` · ${DIFFICULTY[d].name}` : ''}`; }
function boardKey(m, d) { return byDiff(m) ? `${m}.${d}` : m === 'daily' ? `daily.${dateKey()}` : `lingguhan.${weeklyEvent().week}`; }

function openAccount() {
  mode = 'account';
  const u = online.user;
  if (u) {
    $('account-body').innerHTML = `<p class="acct-who">${icon('tao', 40)}<span>Naka-login bilang<b>${esc(u)}</b></span></p>
      <p class="note">Nasa server ang XP, ranggo, barya, medalya, bituin at mga nabili mo, at ang puwesto mo sa Ranking. Kahit burahin ang browser data o lumipat ng device, mag-login lang ulit.</p>
      <p class="muted" id="acct-msg" role="status"></p>
      <div class="row"><button type="button" class="primary" id="acct-sync">I-sync ngayon</button><button type="button" id="acct-out">Mag-logout</button></div>`;
    $('acct-sync').onclick = async (e) => { const bt = e.currentTarget; if (bt.disabled) return; bt.disabled = true; $('acct-msg').textContent = 'Sini-sync…'; const r = await sync(); bt.disabled = false; if (mode === 'account' && $('acct-msg')) { $('acct-msg').textContent = r.ok ? 'Naka-save sa server · Saved' : r.error || 'Hindi na-sync.'; bt.focus({ preventScroll: true }); } };
    $('acct-out').onclick = async (e) => { e.currentTarget.disabled = true; await online.logout(); labels(); toast('Naka-logout. Nasa device pa rin ang progreso mo.', 2400); if (mode === 'account') openAccount(); };
  } else {
    const reg = acctTab === 'register';
    $('account-body').innerHTML = `<div class="modes"><button type="button" data-tab="login" aria-pressed="${!reg}">Mag-login</button><button type="button" data-tab="register" aria-pressed="${reg}">Gumawa ng account</button></div>
      <form id="acct-form" class="acct-form" novalidate>
        <label>Pangalan <small>3–16: letra, numero, _ . -</small><input name="user" autocomplete="username" maxlength="16" autocapitalize="off" spellcheck="false" required></label>
        <label>Password <small>${reg ? '8 o higit pa; huwag ang pangalan o 12345678' : ''}</small><input name="pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" maxlength="72" required></label>
        <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <p class="acct-err" id="acct-err" role="alert"></p>
        <button type="submit" class="primary">${reg ? 'Gumawa at mag-login' : 'Mag-login'}</button>
      </form>
      <p class="note">${reg ? 'Ang progreso mo sa device na ito ay dadalhin sa bagong account. <b>Walang email:</b> tandaan ang password mo.' : 'Mag-login para maibalik ang progreso mo at makasali sa Ranking, kahit na-clear ang browser.'} <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></p>`;
    for (const b of $('account-body').querySelectorAll('[data-tab]')) b.onclick = () => { acctTab = b.dataset.tab; openAccount(); };
    if (reg) online.prepare(); // the puzzle solves while the name is typed
    $('acct-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('button[type=submit]'), tabs = $('account-body').querySelectorAll('[data-tab]');
      if (btn.disabled) return;
      btn.disabled = true; for (const t of tabs) t.disabled = true; $('acct-err').textContent = '';
      if (reg) $('acct-err').textContent = 'Sinusuri na hindi ka bot…';
      const user = f.querySelector('[name=user]').value.trim(), pass = f.querySelector('[name=pass]').value;
      const r = reg ? await online.register(user, pass, f.querySelector('[name=website]').value) : await online.login(user, pass);
      if (reg && !r.ok) online.prepare(); // a fresh puzzle for the next try
      btn.disabled = false; for (const t of tabs) t.disabled = false;
      if (!f.isConnected) return; // the form was redrawn meanwhile
      if (!r.ok) { $('acct-err').textContent = r.error || 'Hindi nakapasok.'; (r.status === 409 || r.status === 400 && /Pangalan/.test(r.error || '') ? f.querySelector('[name=user]') : r.status === 400 && /[Pp]assword/.test(r.error || '') ? f.querySelector('[name=pass]') : btn).focus({ preventScroll: true }); return; }
      labels();
      toast(reg ? `Maligayang pagdating, ${r.name}!` : `Mabuhay, ${r.name}!`, 2200);
      if (pendingScore) { const p = pendingScore; pendingScore = null; sendScore(p).then((t) => toast(t, 3400)); }
      const s = await sync();
      if (mode === 'account') openAccount();
      if (!s.ok && s.error) toast(s.error, 3000);
    };
    if (!touch) setTimeout(() => $('acct-form')?.querySelector('[name=user]').focus(), 50);
  }
  show('account');
}
$('acct-btn').onclick = () => openAccount();

function openRanking(m = rkMode, d = rkDiff || data.difficulty) {
  mode = 'ranking'; rkMode = m; rkDiff = d;
  const b = boardKey(m, d), ask = ++rkAsk;
  $('rk-modes').innerHTML = Object.entries(RANKED).map(([k, n]) => `<button type="button" data-rm="${k}" aria-pressed="${k === m}">${n}</button>`).join('');
  $('rk-diffs').innerHTML = byDiff(m) ? Object.values(DIFFICULTY).map((x) => `<button type="button" data-rd="${x.key}" aria-pressed="${x.key === d}">${x.name}</button>`).join('') : `<span class="muted">${m === 'daily' ? `Daily ${dateKey()} · Katamtaman` : `${weeklyEvent().name} · ${weeklyEvent().week}`}</span>`;
  for (const x of $('rk-modes').querySelectorAll('[data-rm]')) x.onclick = () => { openRanking(x.dataset.rm, d); $('rk-modes').querySelector(`[data-rm="${x.dataset.rm}"]`)?.focus({ preventScroll: true }); };
  for (const x of $('rk-diffs').querySelectorAll('[data-rd]')) x.onclick = () => { openRanking(m, x.dataset.rd); $('rk-diffs').querySelector(`[data-rd="${x.dataset.rd}"]`)?.focus({ preventScroll: true }); };
  $('rk-body').innerHTML = '<p class="muted">Kinukuha…</p>';
  $('rk-me').textContent = '';
  $('rk-acct').hidden = !!online.user;
  show('ranking');
  online.board(b).then((r) => {
    if (ask !== rkAsk || mode !== 'ranking') return;
    if (!r.ok) { $('rk-body').innerHTML = `<p class="muted">${esc(r.error || 'Hindi makuha ang Ranking.')}</p>`; return; }
    $('rk-body').innerHTML = r.top.length ? `<ol class="rk-list">${r.top.map((x, i) => `<li><span class="rk-n">${i + 1}</span><span class="rk-name">${esc(x.name)}</span><b>${fmtVal(b, x.value)}</b><button type="button" data-rw="${x.id}" aria-label="Panoorin ang laro ni ${esc(x.name)}">${icon('play', 14)}</button></li>`).join('')}</ol>`
      : `<p class="muted">Wala pang nakapasok dito. Ikaw na ang mauna!</p>`;
    $('rk-me').textContent = `${r.n} manlalaro`;
    if (online.user) online.rank(b).then((me) => { if (ask !== rkAsk || !me.ok) return; $('rk-body').querySelectorAll('li')[me.rank - 1]?.classList.add('me'); $('rk-me').innerHTML = me.rank ? `Ikaw: <b>#${me.rank}</b> sa ${r.n} · ${fmtVal(b, me.value)}` : `Wala ka pa rito, ${esc(me.name)}. Maglaro ng ${RANKED[m]}!`; });
    for (const x of $('rk-body').querySelectorAll('[data-rw]')) x.onclick = async () => {
      if (x.disabled) return;
      x.disabled = true;
      const rp = await online.replay(b, x.dataset.rw);
      x.disabled = false;
      if (ask !== rkAsk || mode !== 'ranking') return; // left the screen meanwhile
      if (!rp.ok) { toast(rp.error || 'Walang replay.', 2000); return; }
      viewerBack = () => openRanking(m, d); watch(rp.code);
    };
  });
}
$('rank-btn').onclick = () => openRanking();
$('rk-acct').onclick = () => openAccount();

// ---------- the stats page: rank, totals, medals, the house style ----------
function openStats() {
  mode = 'stats';
  const st = { games: 0, lines: 0, bayanihan: 0, tspins: 0, tools: 0, seconds: 0, ...data.stats }, rk = rankOf(data.xp);
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  const best = (m) => { const v = data.best[`${m}.${data.difficulty}`]; return v ? (m === 'deadline' ? clock(v) : peso(v)) : '—'; };
  $('stats-body').innerHTML = `<div class="xp">${rk.name} · ${data.xp.toLocaleString('en-US')} XP${rk.next ? ` · ${rk.need.toLocaleString('en-US')} pa para sa ${rk.next}` : ''}<i style="--p:${Math.round(rk.progress * 100)}%"></i></div>
    <table>${row('Laro', st.games)}${row('Hanay', st.lines)}${row('Bayanihan', st.bayanihan)}${row('T-spin', st.tspins)}${row('Gamit na nagamit', st.tools)}${row('Oras sa site', clock(st.seconds * 60))}
    ${row(`Best Bahay (${DIFFICULTY[data.difficulty].name})`, best('bahay'))}${row('Best Klasiko', best('klasiko'))}${row('Best Deadline', best('deadline'))}${row('Best Bagyo', best('bagyo'))}${row('Best Karera', best('karera'))}${row('Bituin sa Proyekto', `${CONTRACTS.reduce((a, c) => a + (data.stars[c.id] || 0), 0)}/45`)}</table>
    <h3 style="margin:10px 0 4px;font:italic 900 18px 'Barlow Condensed';color:#ffd23f">MEDALYA ${data.medals.length}/${MEDALS.length}</h3>
    <div class="medals">${MEDALS.map((m) => `<div class="medal ${data.medals.includes(m.id) ? 'got' : ''}" title="${m.desc}"><b>★</b>${m.name}</div>`).join('')}</div>
    <h3 style="margin:10px 0 4px;font:italic 900 18px 'Barlow Condensed';color:#ffd23f">LINGGUHAN · ${data.wmedals.length}/${WEEKLY_MEDALS.length} · ${icon('token', 18)} ${data.tokens} token</h3>
    <div class="medals">${WEEKLY_MEDALS.map((m) => `<div class="medal ${data.wmedals.includes(m.id) ? 'got' : ''}" title="${m.desc}"><b>${icon('calendar', 24)}</b>${m.name}</div>`).join('')}</div>
    <h3 style="margin:10px 0 4px;font:italic 900 18px 'Barlow Condensed';color:#ffd23f">GAMIT SA RANGGO</h3>
    <div class="medals">${Object.entries(TOOL_RANK).map(([t, r]) => `<div class="medal ${rankOf(data.xp).index >= r ? 'got' : ''}" title="${RANKS[r].name}"><b>${icon(t, 28)}</b>${t[0].toUpperCase() + t.slice(1)} · ${RANKS[r].name}</div>`).join('')}</div>
    <h3 style="margin:10px 0 4px;font:italic 900 18px 'Barlow Condensed';color:#ffd23f">ISTILO NG BAHAY</h3>
    <div class="modes">${STYLES.map((x) => `<button type="button" data-style="${x.id}" aria-pressed="${data.style === x.id}" ${styleOpen(data.xp, x.id) ? '' : 'aria-disabled="true"'}>${styleOpen(data.xp, x.id) ? x.name : icon('lock', 16) + ' ' + x.name + ' · ' + RANKS[x.rank].name}</button>`).join('')}</div>`;
  for (const bt of $('stats-body').querySelectorAll('[data-style]')) bt.onclick = () => {
    const st = STYLES.find((x) => x.id === bt.dataset.style);
    if (!styleOpen(data.xp, st.id)) { nope({ title: 'Naka-lock pa', text: `Bubukas ang <b>${st.name}</b> sa ${rankNeed(st.rank)}.`, hint: 'Every game earns XP toward the next rank.' }); return; }
    data.style = st.id; persist(); if (view) view.setHouseStyle(data.style); openStats();
  };
  show('stats');
}
$('stats-btn').onclick = openStats;
$('stats-ok').onclick = () => toMenu();
$('rankup-ok').onclick = () => { clearTimeout(rankT); show('results'); };
$('how-btn').onclick = () => { mode = 'how'; show('how'); };
$('how-ok').onclick = () => toMenu();
$('play').onclick = () => { const m = MODE_INFO[data.mode] ? data.mode : 'bahay'; if (m === 'tapatan' && touch) { openModes(); return; } if (m === 'proyekto' && !job) openMap(); else if (m === 'versus' && !vsPick) openVs(); else if (m === 'training' && !lesson) openLessons(); else if (m === 'tapatan') openTapatan(); else { data.mode = m; start(); } };
$('safety-ok').onclick = () => { data.safety = true; persist(); start(); };
$('retry').onclick = () => { if (data.mode === 'tapatan') tap = { wins: [0, 0], round: 1 }; start(); };
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
for (const b of document.querySelectorAll('.menu')) b.onclick = toMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
labels();

// ---------- the HUD ----------
let hudKey = '', toolsKey = '';
function hud(g) {
  if (g.toolsOn) {
    const tk = g.tools.join(',');
    if (tk !== toolsKey) {
      const was = toolsKey ? toolsKey.split(',').filter(Boolean).length : 0; toolsKey = tk;
      [...$('tools').querySelectorAll('span')].forEach((el, i) => { const t = g.tools[i]; el.innerHTML = t ? icon(t, 30) : icon('toolbox', 22); el.className = t ? (i === 0 ? 'next' : '') : 'empty'; el.title = t || ''; if (t && i >= was && i < g.tools.length) { el.classList.add('pop'); } });
      $('pad-tool').disabled = !g.tools.length; $('pad-tool').innerHTML = g.tools.length ? `${icon(g.tools[0], 30)}<b>${g.tools.length}</b>` : icon('toolbox', 30);
    }
  }
  const m = match || (viewer && viewer.pb.rec.head.vs ? viewer.pb.g : null);
  if (m && m.local && tap) {
    const k = `tap|${m.sent[0]}|${m.sent[1]}|${tap.wins}|${tap.round}|${Math.floor(m.tick / 30)}`;
    if (k === hudKey) return;
    hudKey = k;
    const dots = (n) => '●'.repeat(n) + '○'.repeat(2 - n);
    $('h-score').querySelector('small').textContent = `P1 · ${dots(tap.wins[0])}`; $('h-score').querySelector('b').textContent = `${m.sent[0]} putik`;
    $('h-mode').querySelector('b').textContent = 'TAPATAN'; $('h-mode').querySelector('em').textContent = `Ronda ${tap.round} · ${clock(m.tick)}`;
    $('h-best').querySelector('small').textContent = `P2 · ${dots(tap.wins[1])}`; $('h-best').querySelector('b').textContent = `${m.sent[1]} putik`;
    return;
  }
  if (m) {
    // Laban: what you sent, the match, what the rival sent
    const k = `vs|${m.sent[0]}|${m.sent[1]}|${pendingRows(m.a)}|${pendingRows(m.b)}|${Math.floor(m.tick / 30)}`;
    if (k === hudKey) return;
    hudKey = k;
    $('h-score').querySelector('small').textContent = 'Ipinadala'; $('h-score').querySelector('b').textContent = `${m.sent[0]} putik`;
    $('h-mode').querySelector('b').textContent = 'LABAN'; $('h-mode').querySelector('em').textContent = `vs ${m.prof.name} · ${clock(m.tick)}${pendingRows(m.a) ? ` · ${pendingRows(m.a)} paparating` : ''}`;
    $('h-best').querySelector('small').textContent = m.prof.name; $('h-best').querySelector('b').textContent = `${m.sent[1]} putik`;
    return;
  }
  $('h-score').querySelector('small').textContent = 'Kita';
  if (g.mode === 'training' && lesson) {
    const k = `tr|${g.pieces}|${g.lines}|${g.stats.maxCombo}|${coach ? coach.waste : 0}`;
    if (k === hudKey) return;
    hudKey = k;
    $('h-score').querySelector('b').textContent = peso(g.score);
    $('h-mode').querySelector('b').textContent = lesson.name.toUpperCase(); $('h-mode').querySelector('em').textContent = `Pagsasanay · ${lesson.id === 'combo' ? `combo ${Math.max(0, g.stats.maxCombo)}/4` : lesson.id === 'finesse' ? `${Math.min(g.pieces, lesson.target.length)}/${lesson.target.length} piraso` : 'iikot papasok'}`;
    $('h-best').querySelector('small').textContent = 'Sayang'; $('h-best').querySelector('b').textContent = String(coach ? coach.waste : 0);
    return;
  }
  const best = data.best[bestKey()] || 0;
  const k = `${g.score}|${g.level}|${g.lines}|${g.mode !== 'bahay' && g.mode !== 'bagyo' ? Math.floor(g.elapsed / 6) : best}|${g.rise ? Math.ceil(g.rise.t / 60) : ''}|${g.stats.tspins}|${g.stats.maxCombo}|${g.board.filter((v) => v === 8).length}`;
  if (k === hudKey) return;
  const bumped = hudKey && +hudKey.split('|')[0] !== g.score;
  hudKey = k;
  $('h-score').querySelector('b').textContent = peso(g.score);
  if (bumped) { const el = $('h-score'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  $('h-mode').querySelector('b').textContent = g.modeDef.name.toUpperCase();
  $('h-mode').querySelector('em').textContent = g.mode === 'deadline' ? `${Math.max(0, 40 - g.lines)} hanay pa` : g.mode === 'klasiko' ? `${g.lines} hanay · bilis ${g.level}` : `Palapag ${g.level} · ${g.lines} hanay${g.rise && view && view.debug.compact ? ` · baha ${Math.ceil(g.rise.t / 60)}s` : ''}`;
  const timed = g.mode === 'deadline' || g.mode === 'proyekto' || g.limit;
  $('h-best').querySelector('small').textContent = g.limit ? 'Natitira' : timed ? 'Oras' : 'Best';
  $('h-best').querySelector('b').textContent = g.limit ? clock(Math.max(0, g.limit - g.elapsed)) : timed ? clock(g.elapsed) : peso(Math.max(best, g.score));
  if (g.mode === 'proyekto' && g.goal) {
    const q = g.goal, parts = [];
    if (q.lines) parts.push(`${Math.min(g.lines, q.lines)}/${q.lines} hanay`);
    if (q.tspins) parts.push(`${g.stats.tspins}/${q.tspins} T-spin`);
    if (q.bayanihan) parts.push(`${g.stats.bayanihan}/${q.bayanihan} Bayanihan`);
    if (q.combo) parts.push(`combo ${Math.max(0, g.stats.maxCombo)}/${q.combo}`);
    if (q.score) parts.push(`${peso(g.score)}/${peso(q.score)}`);
    if (q.survive) parts.push(`${clock(Math.max(0, q.survive - g.elapsed))} pa`);
    if (q.garbage) parts.push(`${g.board.filter((v) => v === 8).length} kalat`);
    $('h-mode').querySelector('b').textContent = g.contract.name.toUpperCase();
    $('h-mode').querySelector('em').textContent = parts.join(' · ');
  }
}

// ---------- loop ----------
let last = performance.now(), t = 0, highCool = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now; t += dt;
  readPad(dt);
  if (game && mode === 'play') {
    const input = AUTOPLAY ? bot(game, { pace: Number(Q.get('pace')) || 2 }) : { pressed, held: [...held] };
    pressed = [];
    // the rules' short pauses stretch to fit the shots: the establishing swoop as the game begins, and
    // a Bayanihan or a new floor while the rows clear. No piece is in play during either.
    let k = 1;
    if (view && !AUTOPLAY && !reduced() && !match) {
      if (game.phase === 'ready') k = 0.55;
      const c = view.cine;
      if (c && game.phase === 'clear') k = Math.min(1, (game.phaseT / 60) / Math.max(0.05, c.dur - c.t));
    }
    // every tick: written into the replay, read by the finesse coach and the lesson's check
    const onTick = (inp, evs) => {
      if (rec) record(rec, inp);
      if (coach) { const f = coachTick(coach, inp, evs, game); if (f && (lesson || data.rules.coach)) showFinesse(f); if (lesson) verdict(judge(lesson, game, evs, f)); }
      else if (lesson) verdict(judge(lesson, game, evs, null));
    };
    if (match && match.local) onMatch(matchStep(match, AUTOPLAY ? input : drain(tapIn[0]), dt * k, null, AUTOPLAY ? bot(match.b, { pace: 6 }) : drain(tapIn[1])));
    else if (match) onMatch(matchStep(match, input, dt * k, onTick));
    else for (const e of step(game, input, dt * k, onTick)) onEvent(e);
    hud(game);
    ghostHud();
    inspHud(dt);
    let top = 99; for (let i = 0; i < game.board.length; i++) if (game.board[i]) { top = Math.floor(i / 10); break; }
    highCool -= dt; if (top < 7 && game.phase === 'play' && highCool <= 0) { highCool = 9; if (top < 5) { speak('neardeath'); feel({ type: 'lindol' }); } else say('high'); }
  } else if (viewer && mode === 'replay') {
    // the replay viewer: whole ticks at 1×, 2× or 4×
    const V = viewer, vs = !!V.pb.rec.head.vs;
    if (!V.paused) {
      V.acc += dt * 60 * V.speed;
      while (V.acc >= 1) {
        V.acc -= 1;
        const r = playTick(V.pb);
        if (!r) { V.paused = true; V.ended = true; viewerUi(); toast('Tapos ang replay · Pindutin ang play para ulitin', 2400); break; }
        const evA = vs ? r.a : r;
        for (const e of evA) { if (view) view.event(e, vgame()); else R.event(e, vgame()); if (V.speed === 1 || (e.type !== 'move' && e.type !== 'rotate')) A.event(e); }
        if (vs) { for (const e of r.b) if (view) view.rivalEvent(e, V.pb.g.b); for (const e of r.x) if (e.type === 'attack' && view) view.attack(e.from, e.sent, e.cancelled); }
      }
    }
    $('rbar').querySelector('.prog i').style.setProperty('--p', `${((V.pb.i / Math.max(1, V.pb.end)) * 100).toFixed(1)}%`);
    $('rb-time').textContent = `${clock(V.pb.i)} / ${clock(V.pb.end)}`;
    hud(vgame());
  } else if (!game) {
    if (demo.phase === 'over' || demo.elapsed > 60 * 150) demo = newDemo();
    for (const e of step(demo, bot(demo, { pace: 5 }), dt)) { if (view) view.event(e, demo); else R.event(e, demo); }
  }
  const g = game || vgame() || demo;
  const rivalG = match ? match.b : viewer && viewer.pb.rec.head.vs ? viewer.pb.g.b : null;
  const vmode = mode === 'play' || mode === 'replay' ? 'play' : mode === 'pause' ? 'pause' : mode === 'results' ? 'results' : mode === 'safety' ? 'safety' : mode === 'shop' ? 'shop' : 'title';
  const nextN = viewer ? (viewer.pb.rec.head.opts?.next || 5) : data.rules.next;
  if (view) {
    view.frame(g, dt, { mode: vmode, pops: mode === 'play' && !!game, reduced: reduced(), cine: data.opt.cine && !match && !lesson && !viewer && g.mode !== 'klasiko', ghost: data.opt.ghost, rival: rivalG, p2: !!(match && match.local), shopTab, hint: lessonHint(), plumb: plumbHint(), next: nextN, onThunder: () => A.thunder(), onCeremony: (n) => { big('BAHAY NA!', `${n} palapag · Salamat, bayanihan!`, 2.4); say('ceremony', true); A.event({ type: 'ceremony' }); if (game) recordHouse(game, n); } });
    // the rival's bubble over its scaffold
    rbubbleT -= dt; rsayCool -= dt;
    const rb = $('rbubble'), rp = view.rivalHead(), ron = rbubbleT > 0 && (mode === 'play' || mode === 'results') && rp.on && !!match;
    rb.hidden = !ron;
    if (ron) { const hw = rb.offsetWidth / 2 + 6; rp.x = Math.max(hw, Math.min(innerWidth - hw, rp.x)); rb.style.transform = `translate(${rp.x.toFixed(1)}px, ${rp.y.toFixed(1)}px) translate(-50%, -100%)`; rb.style.opacity = String(Math.min(1, rbubbleT / 0.3)); }
    // Kapatas's bubble follows his head
    bubbleT -= dt; sayCool -= dt;
    const el = $('bubble'), p = view.kapHead(), on = bubbleT > 0 && mode === 'play' && p.on && !view.cine;
    el.hidden = !on;
    if (on) { const hw = el.offsetWidth / 2 + 6; p.x = Math.max(hw, Math.min(innerWidth - hw, p.x)); el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`; el.style.opacity = String(Math.min(1, bubbleT / 0.3)); }
    if (on && live() && overlaps(el.getBoundingClientRect(), wellBox())) el.hidden = true; // his voice still says it
    bigT -= dt; if (bigT <= 0) $('big').hidden = true;
  } else R.draw(g, t, { reduced: reduced(), best: game ? data.best[bestKey()] || 0 : 0, rival: rivalG, hint: lessonHint(), plumb: plumbHint(), next: nextN });
  keepClear(dt);
  A.update(g, (!!game && mode === 'play') || (!!viewer && !viewer.paused), dt);
  requestAnimationFrame(frame);
}

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('900 italic 40px "Barlow Condensed"'), document.fonts.load('700 30px "Baloo 2"')]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* system fonts */ }
  const flat = Q.get('flat') === '1';
  try {
    if (flat) throw new Error('2D asked for');
    const { createView } = await import('./view3d.mjs');
    view = createView($('view'), { low: touch, gfx: Q.get('gfx') ?? (data.gfx === 'auto' ? null : String(data.gfx)) });
    view.setAngled(data.opt.angle);
    wearLooks();
    if (data.style !== 'apartment') view.setHouseStyle(data.style);
    window.addEventListener('resize', () => view.resize());
    new ResizeObserver(() => view.resize()).observe($('view'));
  } catch (err) {
    // no WebGL here: the 2D board, as before
    view = null;
    document.body.classList.add('flat');
    const { createRenderer } = await import('./render.mjs');
    R = createRenderer($('board'));
    window.addEventListener('resize', R.resize);
    new ResizeObserver(() => R.resize()).observe($('board'));
    R.resize();
  }
  streakDay(); labels();
  show('title');
  if (online.user && !TEST) { sync(); setTimeout(flushScores, 4000); }
  setTimeout(startAds, 3000);
  try { if (sessionStorage.getItem('hollowblocks.restored')) { sessionStorage.removeItem('hollowblocks.restored'); setTimeout(() => toast(`Naibalik ang progreso ni ${online.user} · Progress restored`, 3200), 900); } } catch { /* no session storage */ }
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
  setTimeout(() => $('curtain').classList.add('off'), 250);
  if (view) {
    // the real site and the real foreman load in the background; a bar shows how far along
    const bar = $('loading'), pct = $('load-pct'), parts = { env: 0, foreman: 0 };
    const loaded = () => { const f = (parts.env + parts.foreman) / 2; bar.hidden = false; pct.textContent = `${Math.round(f * 100)}%`; bar.style.setProperty('--p', `${Math.round(f * 100)}%`); };
    let left = 2;
    const doneOne = () => { if (--left > 0) return; bar.classList.add('done'); setTimeout(() => { bar.hidden = true; }, 700); window.__loaded = true; };
    loaded();
    import('./envpack.mjs').then(({ loadEnv }) => loadEnv(Q.get('env') || 'assets/env/')).then((e) => { parts.env = 0.5; loaded(); return view.setEnv(e); }).then(() => { parts.env = 1; loaded(); }).catch(() => { parts.env = 1; }).finally(doneOne);
    import('./foreman.mjs').then(({ loadForeman }) => loadForeman(Q.get('people') || 'assets/people/', (f) => { parts.foreman = f; loaded(); })).then((lib) => view.setPeople(lib)).catch(() => { /* the foreman made in code stays */ }).finally(() => { parts.foreman = 1; loaded(); doneOne(); });
    import('./crowd.mjs').then(({ loadCrowd }) => loadCrowd(Q.get('people') || 'assets/people/')).then((c) => view.setCrowd(c)).catch(() => { /* no neighbours at the store, then */ });
  } else window.__loaded = true;
  // a shared replay link: #r=<the replay>
  if (location.hash.startsWith('#r=')) watch(location.hash.slice(3));
  if (TEST) {
    // fast-forward for soak tests: n ticks of the bot, drawing a frame every 20
    const fast = (n) => { for (let k = 0; k < n; k++) { const g = game; if (!g || mode !== 'play') break; for (const e of step(g, bot(g, { pace: 1 }), 1 / 60, (inp) => { if (rec) record(rec, inp); })) onEvent(e); if (view && k % 20 === 19) view.frame(g, 1 / 3, { mode: 'play', pops: true, reduced: reduced(), cine: data.opt.cine, ghost: true }); } return game && game.lines; };
    // Tapatan with a bot on each side
    const fastTap = (n) => { for (let k = 0; k < n; k++) { if (!match || mode !== 'play' || match.phase !== 'play') break; onMatch(matchStep(match, bot(match.a, { pace: 4 }), 1 / 60, null, bot(match.b, { pace: 6, style: 'tetris' }))); if (view && k % 20 === 19) view.frame(game, 1 / 3, { mode: 'play', reduced: reduced(), cine: false, ghost: true, rival: match.b, p2: true, next: data.rules.next }); } return match && match.tick; };
    // the same for a match: the bot plays your well too
    const fastVs = (n) => { for (let k = 0; k < n; k++) { if (!match || mode !== 'play' || match.phase !== 'play') break; const out = matchStep(match, bot(match.a, { pace: 4 }), 1 / 60, (inp) => { if (rec) record(rec, inp); }); onMatch(out); if (view && k % 20 === 19) view.frame(game, 1 / 3, { mode: 'play', reduced: reduced(), cine: false, ghost: true, rival: match.b, next: data.rules.next }); } return match && match.tick; };
    window.__hb = { live, wellBox, online, openAccount, offerDouble, shopOffers, openRanking, openModes, openShop, openBook, openHouse, get houses() { return houses; }, recordHouse, labels, V, wearLooks, job: (id) => openBrief(contractById(id)), fastTap, openTapatan, get tap() { return tap; }, tapIn, openMap, weeklyBanner, inspSays, fast, fastVs, A, get game() { return game; }, get match() { return match; }, get mode() { return mode; }, get demo() { return demo; }, get viewer() { return viewer; }, get coach() { return coach; }, get ghost() { return ghost; }, replays, start, get view() { return view; }, pause, resume, openSettings: () => openSettings(mode === 'pause' ? 'pause' : 'title'), openKeys, openVs, openRival, openLessons, openLesson: (id) => openLesson(lessonById(id)), openReplays, watch, encodeLast: async () => rec && encode(rec), keepReplay: () => keepReplay(game, true), data, showFinesse, setRec: (r) => { rec = r; } };
    if (Q.get('rival')) { vsPick = Q.get('rival'); }
    if (Q.get('lesson')) lesson = lessonById(Q.get('lesson'));
    if (Q.get('difficulty')) data.difficulty = Q.get('difficulty');
    if (Q.get('mode')) data.mode = Q.get('mode');
    if (Q.get('go') === '1') { data.safety = true; start(); }
  }
}
boot();
if ('serviceWorker' in navigator && !TEST) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });
  // an update: the new worker takes over in the background; reload into it on the title screen (or on
  // the way back to it), never in the middle of a game. A first visit has no old worker to replace.
  const hadOld = !!navigator.serviceWorker.controller;
  let updated = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadOld && !updated) { updated = true; freshVersion(); } });
}
let versionWaiting = false;
function freshVersion() {
  if (mode === 'title' && !game) { location.reload(); return; }
  versionWaiting = true; // toMenu reloads
}
