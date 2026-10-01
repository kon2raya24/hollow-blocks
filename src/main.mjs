// The page: screens, modes, settings, input (keys, touch gestures and buttons, a controller), the loop,
// sound, saves and hints. The rules live in game.mjs; the 3D site in view3d.mjs, and if WebGL won't
// start, the old 2D drawing in render.mjs takes over and the game plays the same.
import { createGame, step, MODES, DIFFICULTY } from './game.mjs';
import { bot } from './bot.mjs';
import { createAudio } from './audio.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const KEY = 'hollowblocks.v1';
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: play on */ } },
};
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
  ceremony: ['Tapos ang bahay! Salamat sa lahat!', 'Bahay na! Kain tayo mamaya!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const touch = matchMedia('(pointer: coarse)').matches;
const saved = store.get() || {};
const data = {
  best: saved.best && typeof saved.best === 'object' ? saved.best : {}, muted: !!saved.muted, calm: !!saved.calm, safety: !!saved.safety,
  difficulty: DIFFICULTY[saved.difficulty] ? saved.difficulty : 'madali', mode: MODES[saved.mode] ? saved.mode : 'bahay',
  hints: Array.isArray(saved.hints) ? saved.hints : [],
  gfx: [0, 1, 2].includes(saved.gfx) ? saved.gfx : 'auto', // graphics: auto (steps down on slow devices) or a fixed level
  opt: { music: 1, sfx: 1, ghost: true, cine: true, angle: true, ...(saved.opt || {}) }, // the settings screen
};
const persist = () => store.set(data);
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && touch) navigator.vibrate(p); } catch { /* no haptics */ } };
const clock = (ticks) => { const s = ticks / 60; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const peso = (n) => `₱${Math.floor(n).toLocaleString('en-US')}`;
const bestKey = () => `${data.mode}.${data.difficulty}`;

const $ = (id) => document.getElementById(id);
let view = null, R = null; // the 3D view, or the 2D renderer when WebGL is missing
const A = createAudio();
A.setMuted(data.muted); A.setMix(data.opt);

let mode = 'title', game = null;
let demo = newDemo();
function newDemo() { return createGame({ seed: seed(), mode: 'bahay', difficulty: 'madali' }); }

const SCREENS = ['title', 'safety', 'pause', 'results', 'settings'];
function show(name) {
  for (const id of SCREENS) { const el = $(id), on = id === name; if (on && el.hidden) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } el.hidden = !on; }
  if (name) { toasts.length = 0; $('toast').hidden = true; $('big').hidden = true; bigT = 0; }
  $('pause-btn').hidden = name !== null;
  $('hud').hidden = !(name === null || name === 'pause');
  document.body.classList.toggle('playing', name === null);
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
  insets();
}
function insets() { if (view) view.setInsets(touch ? 66 : 76, touch && mode === 'play' ? 86 : 14); }

function start() {
  A.start();
  if (!data.safety && !AUTOPLAY) { mode = 'safety'; show('safety'); return; }
  game = createGame({ seed: seed(), mode: data.mode, difficulty: data.difficulty });
  if (R) R.reset();
  mode = 'play'; clearInput(); show(null); hudKey = ''; sinceI = 0;
  big(MODES[data.mode].name, data.mode === 'deadline' ? '40 hanay, bilisan!' : data.mode === 'bagyo' ? 'Tumataas ang baha!' : 'Buuin ang bahay!', 1.6);
  hint('move', touch ? 'I-tap para iikot, i-drag pakaliwa o pakanan, i-flick pababa para ibagsak. May mga button din sa ibaba.' : '← → galaw · ↑ o X ikot · Z pabalik · ↓ dahan-dahan · Space bagsak · C o Shift imbak · may controller din');
}

function finish(done) {
  const g = game;
  setTimeout(() => {
    if (game !== g) return;
    mode = 'results';
    const k = bestKey(), prev = data.best[k];
    let isBest = false;
    if (g.mode === 'deadline') { if (done && (!prev || g.elapsed < prev)) { data.best[k] = g.elapsed; isBest = true; } }
    else if (!prev || g.score > prev) { data.best[k] = g.score; isBest = g.score > 0; }
    persist();
    $('results-title').textContent = done ? 'Tapos sa oras!' : g.mode === 'bagyo' ? 'Inabot ng baha!' : 'Gumuho ang pader!';
    $('results-score').textContent = g.mode === 'deadline' ? (done ? clock(g.elapsed) : `${g.lines}/40`) : peso(g.score);
    const b = data.best[k];
    $('results-best').textContent = isBest ? 'Bagong best! New best!' : b ? `Best: ${g.mode === 'deadline' ? clock(b) : peso(b)}` : '';
    $('results-best').className = isBest ? 'new' : 'muted';
    const stat = (label, v) => `<div><span>${label}</span><b>${v}</b></div>`;
    $('results-stats').innerHTML = stat('Hanay', g.lines) + stat('Naitayo', `${1 + Math.floor(g.lines / 10)} palapag`) + stat('Oras', clock(g.elapsed)) + stat('Bayanihan', g.stats.bayanihan) + stat('T-spin', g.stats.tspins) + stat('Combo', Math.max(0, g.stats.maxCombo));
    $('results-tip').textContent = `"${pick(TIPS)}" — Kapatas`;
    show('results');
  }, done ? 1800 : 1600);
}

// ---------- hints, callouts, the foreman's bubble ----------
const toasts = [];
let toastBusy = false;
function toast(text, ms = 3800) { if (AUTOPLAY) return; toasts.push([text, ms]); if (!toastBusy) nextToast(); }
function nextToast() {
  const el = $('toast'), item = toasts.shift();
  toastBusy = !!item;
  if (!item) { el.hidden = true; return; }
  el.textContent = item[0]; el.hidden = false;
  setTimeout(nextToast, item[1]);
}
function hint(id, text) { if (data.hints.includes(id)) return; data.hints.push(id); persist(); toast(text); }
let bigT = 0;
function big(title, sub = '', secs = 1.4) {
  if (!view) return; // the 2D board letters its own
  const el = $('big'); el.querySelector('b').textContent = title; el.querySelector('span').textContent = sub;
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); bigT = secs;
}
let bubbleT = 0, sayCool = 0, sinceI = 0;
function say(k, force = false) {
  if (!view) { if (R) R.say(k); return; }
  if (!force && sayCool > 0) return;
  const el = $('bubble'); el.textContent = pick(SAYS[k]); bubbleT = 2.4; sayCool = 1.2;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function onEvent(e) {
  if (view) view.event(e, game); else R.event(e, game);
  A.event(e);
  switch (e.type) {
    case 'go': say('go', true); break;
    case 'lines':
      if (e.n === 4) { buzz([30, 30, 60]); big('BAYANIHAN!', e.b2b ? 'Sunod-sunod! ×1.5' : 'Tulong-tulong!', 1.6); say('four', true); }
      else { buzz(15); if (e.spin) say('tspin', true); else if (e.b2b) say('b2b', true); else if (e.combo >= 2) say('combo'); else if (Math.random() < 0.3) say('one'); }
      if (e.n === 1) hint('bayanihan', 'Tip: apat na hanay nang sabay ay BAYANIHAN, ang pinakamalaking kita!');
      break;
    case 'tspin': say('tspin', true); break;
    case 'spawn':
      if (e.piece === 'I') { if (sinceI >= 12) say('relief', true); sinceI = 0; }
      else if (++sinceI === 12) say('drought', true);
      break;
    case 'levelUp': if (!(view && game.mode === 'bahay' && (1 + Math.floor(game.lines / 10)) % 5 === 0)) { big(`Palapag ${e.level}!`, 'Bagong palapag · New floor', 1.5); say('level', true); } break;
    case 'rise': if (Math.random() < 0.35) say('rise'); hint('bagyo', 'Tumataas ang baha mula sa ilalim! Punuin ang butas para matanggal ang putik.'); break;
    case 'hardDrop': buzz(10); break;
    case 'gameover': say('over', true); finish(false); break;
    case 'done': big('TAPOS!', 'Deadline met!', 2); say('done', true); finish(true); break;
    default: break;
  }
}

function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; clearInput(); show(null); } }
function toMenu() { mode = 'title'; game = null; labels(); show('title'); }

// ---------- input ----------
const KEYS = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down',
  ' ': 'hard', ArrowUp: 'cw', x: 'cw', w: 'cw', z: 'ccw', q: 'ccw', c: 'hold', Shift: 'hold',
};
const HELD = new Set(['left', 'right', 'down']);
const held = new Set();
let pressed = [];
function clearInput() { held.clear(); pressed = []; }
const playing = () => mode === 'play' && game;
document.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const act = KEYS[k];
  if (act && playing()) {
    e.preventDefault();
    if (!e.repeat && act !== 'down') pressed.push(act);
    if (HELD.has(act)) held.add(act);
    return;
  }
  const onButton = document.activeElement?.tagName === 'BUTTON';
  if ((k === ' ' || k === 'Enter') && !onButton && mode === 'title') { e.preventDefault(); start(); return; }
  if (k === 'p' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); else if (mode === 'settings') $('settings-ok').click(); }
  if (k === 'm') toggleSound();
});
document.addEventListener('keyup', (e) => { const act = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (act && HELD.has(act)) held.delete(act); });
window.addEventListener('blur', clearInput);

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
  if (!p) return;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes || [];
  const edge = (name, on) => { const was = padWas[name]; padWas[name] = on; return on && !was; };
  const left = b(14) || (ax[0] || 0) < -0.5, right = b(15) || (ax[0] || 0) > 0.5, down = b(13) || (ax[1] || 0) > 0.6, up = b(12) || (ax[1] || 0) < -0.7;
  if (playing()) {
    const dirs = new Set([left && 'left', right && 'right', down && 'down'].filter(Boolean));
    for (const d of dirs) { if (!padHeldDirs.has(d) && d !== 'down') pressed.push(d); held.add(d); }
    for (const d of padHeldDirs) if (!dirs.has(d)) held.delete(d);
    padHeldDirs = dirs;
    if (edge('up', up)) pressed.push('hard');
    if (edge('a', b(0))) pressed.push('cw');
    if (edge('bb', b(1) || b(2))) pressed.push('ccw');
    if (edge('hold', b(3) || b(4) || b(5) || b(6) || b(7))) pressed.push('hold');
    if (edge('start', b(9))) pause();
    return;
  }
  for (const d of padHeldDirs) held.delete(d); padHeldDirs = new Set();
  const screen = SCREENS.find((id) => !$(id).hidden);
  if (!screen) { edge('start', b(9)); return; }
  const move = (dx, dy) => {
    const btns = [...$(screen).querySelectorAll('button, input')].filter((x) => x.offsetParent);
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
  if (edge('bb', b(1))) { if (screen === 'pause') resume(); else if (screen === 'settings') $('settings-ok').click(); else if (screen === 'results') toMenu(); }
  if (edge('start', b(9))) { if (screen === 'pause') resume(); else if (screen === 'title') start(); }
}

function toggleSound() { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); labels(); }
function labels() {
  for (const b of document.querySelectorAll('.sound')) { b.textContent = data.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', data.muted ? 'Sound off, turn it on' : 'Sound on, turn it off'); }
  for (const b of document.querySelectorAll('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === data.difficulty));
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === data.mode));
  $('mode-note').textContent = {
    bahay: 'Bahay: walang katapusan. Bawat 10 hanay, bagong palapag at mas mabilis.',
    deadline: 'Deadline: 40 hanay sa tanghaling tapat, pinakamabilis na oras ang panalo.',
    bagyo: 'Bagyo: tumataas ang putik mula sa ilalim. Tumagal hangga’t kaya!',
  }[data.mode];
  $('diff-note').textContent = { madali: 'Madali: mas mabagal ang bagsak at mas matagal bago dumikit.', katamtaman: 'Katamtaman: ang klasiko.', mahirap: 'Mahirap: magsisimula sa ika-6 na palapag.' }[data.difficulty];
  const b = data.best[bestKey()];
  $('title-best').textContent = b ? `Best (${MODES[data.mode].name}, ${DIFFICULTY[data.difficulty].name}): ${data.mode === 'deadline' ? clock(b) : peso(b)}` : '';
}
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => { data.difficulty = b.dataset.diff; persist(); labels(); };
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { data.mode = b.dataset.mode; persist(); labels(); };

// ---------- settings ----------
let settingsFrom = 'title';
function openSettings(from) {
  settingsFrom = from; mode = 'settings';
  const o = data.opt, f = document.activeElement, again = f && f.dataset && f.dataset.k ? `[data-k="${f.dataset.k}"]${f.dataset.v !== undefined ? `[data-v="${f.dataset.v}"]` : ''}` : null;
  const val = (key) => (key === 'gfx' ? data.gfx : key === 'calm' ? data.calm : o[key]);
  const seg = (key, list) => `<div class="modes">${list.map(([v, label]) => `<button type="button" data-k="${key}" data-v="${v}" aria-pressed="${String(val(key)) === String(v)}">${label}</button>`).join('')}</div>`;
  const slider = (key, label) => `<label class="slide">${label} <input type="range" min="0" max="1" step="0.05" value="${o[key]}" data-k="${key}"></label>`;
  $('settings-body').innerHTML = `
    <div class="grp"><h3>Laro · Game</h3>
    <p class="muted">Anino ng piraso · Ghost piece</p>${seg('ghost', [[true, 'Oo · On'], [false, 'Wala · Off']])}
    <p class="muted">Eksena sa Bayanihan at bagong palapag · Cutscenes</p>${seg('cine', [[true, 'Buo · Full'], [false, 'Wala · Off']])}
    </div><div class="grp"><h3>Camera</h3>
    <p class="muted">Anggulo · Angle</p>${seg('angle', [[true, 'Pahilig · Angled'], [false, 'Tuwid · Straight']])}
    <p class="muted">Yanig ng camera · Camera shake</p>${seg('calm', [[false, 'Buo · Full'], [true, 'Kalmado · Reduced']])}
    </div><div class="grp"><h3>Tunog at itsura · Sound and look</h3>
    ${slider('music', 'Musika · Music')}${slider('sfx', 'Tunog · Effects')}
    <p class="muted">Graphics</p>${seg('gfx', [['auto', 'Auto'], [2, 'Mataas'], [1, 'Katamtaman'], [0, 'Mababa']])}</div>`;
  for (const b of $('settings-body').querySelectorAll('button')) b.onclick = () => {
    const k = b.dataset.k, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
    if (k === 'gfx') { data.gfx = v; if (view) { view.post.setAuto(v === 'auto'); view.post.setLevel(v === 'auto' ? (touch ? 1 : 2) : v); applyGfx(); } }
    else if (k === 'calm') data.calm = v;
    else { o[k] = v; if (k === 'angle' && view) view.setAngled(v); }
    persist(); openSettings(settingsFrom);
  };
  for (const r of $('settings-body').querySelectorAll('input[type=range]')) r.oninput = () => { o[r.dataset.k] = +r.value; A.start(); A.setMix(o); if (r.dataset.k === 'sfx') A.event({ type: 'lock', piece: 'O', cells: [] }); persist(); };
  show('settings');
  if (again && $('settings-body').querySelector(again)) $('settings-body').querySelector(again).focus({ preventScroll: true });
}
$('settings-ok').onclick = () => { if (settingsFrom === 'pause') { mode = 'pause'; show('pause'); } else { mode = 'title'; show('title'); } };
for (const b of document.querySelectorAll('.settings-btn')) b.onclick = () => openSettings(mode === 'pause' ? 'pause' : 'title');
function applyGfx() { if (view) view.setShadows(view.post.level > 0 || data.gfx !== 0); }

$('play').onclick = start;
$('safety-ok').onclick = () => { data.safety = true; persist(); start(); };
$('retry').onclick = start;
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
for (const b of document.querySelectorAll('.menu')) b.onclick = toMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
labels();

// ---------- the HUD ----------
let hudKey = '';
function hud(g) {
  const best = data.best[bestKey()] || 0;
  const k = `${g.score}|${g.level}|${g.lines}|${g.mode === 'deadline' ? Math.floor(g.elapsed / 6) : best}|${g.rise ? Math.ceil(g.rise.t / 60) : ''}`;
  if (k === hudKey) return;
  const bumped = hudKey && +hudKey.split('|')[0] !== g.score;
  hudKey = k;
  $('h-score').querySelector('b').textContent = peso(g.score);
  if (bumped) { const el = $('h-score'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  $('h-mode').querySelector('b').textContent = g.modeDef.name.toUpperCase();
  $('h-mode').querySelector('em').textContent = g.mode === 'deadline' ? `${Math.max(0, 40 - g.lines)} hanay pa` : `Palapag ${g.level} · ${g.lines} hanay${g.rise && view && view.debug.compact ? ` · baha ${Math.ceil(g.rise.t / 60)}s` : ''}`;
  $('h-best').querySelector('small').textContent = g.mode === 'deadline' ? 'Oras' : 'Best';
  $('h-best').querySelector('b').textContent = g.mode === 'deadline' ? clock(g.elapsed) : peso(Math.max(best, g.score));
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
    if (view && !AUTOPLAY && !reduced()) {
      if (game.phase === 'ready') k = 0.55;
      const c = view.cine;
      if (c && game.phase === 'clear') k = Math.min(1, (game.phaseT / 60) / Math.max(0.05, c.dur - c.t));
    }
    for (const e of step(game, input, dt * k)) onEvent(e);
    hud(game);
    let top = 99; for (let i = 0; i < game.board.length; i++) if (game.board[i]) { top = Math.floor(i / 10); break; }
    highCool -= dt; if (top < 7 && game.phase === 'play' && highCool <= 0) { highCool = 9; say(top < 5 ? 'brink' : 'high', top < 5); }
  } else if (!game) {
    if (demo.phase === 'over' || demo.elapsed > 60 * 150) demo = newDemo();
    for (const e of step(demo, bot(demo, { pace: 5 }), dt)) { if (view) view.event(e, demo); else R.event(e, demo); }
  }
  const g = game || demo;
  const vmode = mode === 'play' ? 'play' : mode === 'pause' ? 'pause' : mode === 'results' ? 'results' : mode === 'safety' ? 'safety' : 'title';
  if (view) {
    view.frame(g, dt, { mode: vmode, reduced: reduced(), cine: data.opt.cine, ghost: data.opt.ghost, onThunder: () => A.thunder(), onCeremony: (n) => { big('BAHAY NA!', `${n} palapag · Salamat, bayanihan!`, 2.4); say('ceremony', true); A.event({ type: 'ceremony' }); } });
    // Kapatas's bubble follows his head
    bubbleT -= dt; sayCool -= dt;
    const el = $('bubble'), p = view.kapHead(), on = bubbleT > 0 && mode === 'play' && p.on && !view.cine;
    el.hidden = !on;
    if (on) { const hw = el.offsetWidth / 2 + 6; p.x = Math.max(hw, Math.min(innerWidth - hw, p.x)); el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`; el.style.opacity = String(Math.min(1, bubbleT / 0.3)); }
    bigT -= dt; if (bigT <= 0) $('big').hidden = true;
  } else R.draw(g, t, { reduced: reduced(), best: game ? data.best[bestKey()] || 0 : 0 });
  A.update(g, !!game && mode === 'play', dt);
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
  show('title');
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
  if (TEST) {
    // fast-forward for soak tests: n ticks of the bot, drawing a frame every 20
    const fast = (n) => { for (let k = 0; k < n; k++) { const g = game; if (!g || mode !== 'play') break; for (const e of step(g, bot(g, { pace: 1 }), 1 / 60)) onEvent(e); if (view && k % 20 === 19) view.frame(g, 1 / 3, { mode: 'play', reduced: reduced(), cine: data.opt.cine, ghost: true }); } return game && game.lines; };
    window.__hb = { fast, A, get game() { return game; }, get mode() { return mode; }, get demo() { return demo; }, start, get view() { return view; }, pause, resume, openSettings: () => openSettings(mode === 'pause' ? 'pause' : 'title'), data };
    if (Q.get('difficulty')) data.difficulty = Q.get('difficulty');
    if (Q.get('mode')) data.mode = Q.get('mode');
    if (Q.get('go') === '1') { data.safety = true; start(); }
  }
}
boot();
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });
