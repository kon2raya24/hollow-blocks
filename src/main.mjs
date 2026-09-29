// The page: screens, modes, input (keys, touch gestures and buttons), the loop, sound, saves and
// hints. The rules live in game.mjs; the drawing in render.mjs.
import { createGame, step, MODES, DIFFICULTY } from './game.mjs';
import { bot } from './bot.mjs';
import { createRenderer, peso } from './render.mjs';
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
const touch = matchMedia('(pointer: coarse)').matches;
const saved = store.get() || {};
const data = {
  best: saved.best && typeof saved.best === 'object' ? saved.best : {}, muted: !!saved.muted, calm: !!saved.calm, safety: !!saved.safety,
  difficulty: DIFFICULTY[saved.difficulty] ? saved.difficulty : 'madali', mode: MODES[saved.mode] ? saved.mode : 'bahay',
  hints: Array.isArray(saved.hints) ? saved.hints : [],
};
const persist = () => store.set(data);
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && touch) navigator.vibrate(p); } catch { /* no haptics */ } };
const clock = (ticks) => { const s = ticks / 60; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const bestKey = () => `${data.mode}.${data.difficulty}`;

const $ = (id) => document.getElementById(id);
const R = createRenderer($('board'));
const A = createAudio();
A.setMuted(data.muted);

let mode = 'title', game = null;
let demo = newDemo();
function newDemo() { return createGame({ seed: seed(), mode: 'bahay', difficulty: 'madali' }); }

const SCREENS = ['title', 'safety', 'pause', 'results'];
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  if (name) { toasts.length = 0; $('toast').hidden = true; }
  $('pause-btn').hidden = name !== null;
  document.body.classList.toggle('playing', name === null);
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
}

function start() {
  A.start();
  if (!data.safety && !AUTOPLAY) { mode = 'safety'; show('safety'); return; }
  game = createGame({ seed: seed(), mode: data.mode, difficulty: data.difficulty });
  R.reset(); mode = 'play'; clearInput(); show(null);
  hint('move', touch ? 'I-tap para iikot, i-drag pakaliwa o pakanan, i-flick pababa para ibagsak. May mga button din sa ibaba.' : '← → galaw · ↑ o X ikot · Z pabalik · ↓ dahan-dahan · Space bagsak · C o Shift imbak');
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
    $('results-best').classList.toggle('new', isBest);
    $('results-stats').textContent = `${g.lines} hanay · Palapag ${g.level} · ${clock(g.elapsed)} · ${g.stats.bayanihan} Bayanihan · ${g.stats.tspins} T-spin`;
    $('results-tip').textContent = `"${TIPS[Math.floor(Math.random() * TIPS.length)]}" — Kapatas`;
    show('results');
  }, done ? 1600 : 1300);
}

// ---------- hints ----------
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

function onEvent(e) {
  R.event(e, game);
  A.event(e);
  switch (e.type) {
    case 'lines': if (e.n === 4) buzz([30, 30, 60]); else buzz(15); if (e.n === 1) hint('bayanihan', 'Tip: apat na hanay nang sabay ay BAYANIHAN, ang pinakamalaking kita!'); break;
    case 'rise': hint('bagyo', 'Tumataas ang baha mula sa ilalim! Punuin ang butas para matanggal ang putik.'); break;
    case 'hardDrop': buzz(10); break;
    case 'gameover': finish(false); break;
    case 'done': finish(true); break;
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
  if (k === 'p' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
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
  const step = stage.getBoundingClientRect().width / 432 * 24 * 1.1;
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

function toggleSound() { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); labels(); }
function labels() {
  for (const b of document.querySelectorAll('.sound')) { b.textContent = data.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', data.muted ? 'Sound off, turn it on' : 'Sound on, turn it off'); }
  for (const b of document.querySelectorAll('.calm')) { b.setAttribute('aria-pressed', String(data.calm)); b.textContent = data.calm ? 'Bawas-galaw: on' : 'Bawas-galaw: off'; }
  for (const b of document.querySelectorAll('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === data.difficulty));
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === data.mode));
  $('mode-note').textContent = {
    bahay: 'Bahay: walang katapusan. Bawat 10 hanay, bagong palapag at mas mabilis.',
    deadline: 'Deadline: 40 hanay, pinakamabilis na oras ang panalo.',
    bagyo: 'Bagyo: tumataas ang putik mula sa ilalim. Tumagal hangga’t kaya!',
  }[data.mode];
  $('diff-note').textContent = { madali: 'Madali: mas mabagal ang bagsak at mas matagal bago dumikit.', katamtaman: 'Katamtaman: ang klasiko.', mahirap: 'Mahirap: magsisimula sa ika-6 na palapag.' }[data.difficulty];
  const b = data.best[bestKey()];
  $('title-best').textContent = b ? `Best (${MODES[data.mode].name}, ${DIFFICULTY[data.difficulty].name}): ${data.mode === 'deadline' ? clock(b) : peso(b)}` : '';
}
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('.calm')) b.onclick = () => { data.calm = !data.calm; persist(); labels(); };
for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => { data.difficulty = b.dataset.diff; persist(); labels(); };
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { data.mode = b.dataset.mode; persist(); labels(); };
$('play').onclick = start;
$('safety-ok').onclick = () => { data.safety = true; persist(); start(); };
$('retry').onclick = start;
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
for (const b of document.querySelectorAll('.menu')) b.onclick = toMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
labels();

// ---------- loop ----------
let last = performance.now(), t = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  if (game && mode === 'play') {
    const input = AUTOPLAY ? bot(game, { pace: Number(Q.get('pace')) || 2 }) : { pressed, held: [...held] };
    pressed = [];
    for (const e of step(game, input, dt)) onEvent(e);
  } else if (!game) {
    if (demo.phase === 'over' || demo.elapsed > 60 * 150) demo = newDemo();
    for (const e of step(demo, bot(demo, { pace: 5 }), dt)) R.event(e, demo);
  }
  const view = game || demo;
  R.draw(view, t, { reduced: reduced(), best: game ? data.best[bestKey()] || 0 : 0 });
  A.update(view, !!game && mode === 'play');
  requestAnimationFrame(frame);
}
window.addEventListener('resize', R.resize);
new ResizeObserver(() => R.resize()).observe($('board'));
R.resize();
show('title');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });

if (TEST) {
  window.__hb = { get game() { return game; }, get mode() { return mode; }, get demo() { return demo; }, start };
  if (Q.get('difficulty')) data.difficulty = Q.get('difficulty');
  if (Q.get('mode')) data.mode = Q.get('mode');
  if (Q.get('go') === '1') { data.safety = true; start(); }
}
