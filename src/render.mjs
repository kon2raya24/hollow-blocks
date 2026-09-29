// Draws Hollow Blocks: the construction site (a sky that turns from morning to night as the building
// rises), the kawayan scaffolding round the board, every block in its material, the ghost, the hold
// and the queue, Kapatas and his remarks, and the juice: dust, words, and the Bayanihan parade.
import { COLS, ROWS, HIDDEN, VISIBLE, CLEAR_T, cellsOf, ghostOf } from './game.mjs';
import { SHAPES, MATERIALS, ID, MUD } from './pieces.mjs';

export const C = 24, BX = 96, BY = 52, W = 432, H = 560;
const TYPE_OF = Object.fromEntries(Object.entries(ID).map(([t, v]) => [v, t]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FONT = (w, s) => `${w} ${s}px "Baloo 2", system-ui, sans-serif`;
export const peso = (n) => `₱${Math.floor(n).toLocaleString('en-US')}`;
const WORDS = ['', 'Isang hanay!', 'Dalawa!', 'Tatlo!', 'BAYANIHAN!'];
const SAYS = {
  go: ['Tara, trabaho na!', 'Buhos na tayo!', 'Simulan na natin!'],
  one: ['Ayos!', 'Sige lang!', 'Isa pa!'],
  four: ['BAYANIHAN! Galing!', 'Ganyan ang tulungan!', 'Buhat-buhat!'],
  tspin: ['Galing ng diskarte!', 'T-spin! Pang-engineer!'],
  combo: ['Tuloy-tuloy!', 'Wag tumigil!'],
  level: ['Bagong palapag!', 'Taas pa!'],
  high: ['Ingat! Ang taas na!', 'Babagsak yan!', 'Linisin muna!'],
  rise: ['Tumataas ang baha!', 'Bilisan, bagyo!'],
  over: ['Gumuho! Overtime tayo bukas.', 'Ay, sayang ang semento!'],
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = new Map();
  const parts = [], popups = [];
  let lastT = null, reduced = false, flash = 0, shake = 0, bubble = null, parade = null, rain = [], bolt = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  // ---------- one block of each material, painted once ----------
  function block(v) {
    if (sprites.has(v)) return sprites.get(v);
    const c = document.createElement('canvas'); c.width = C * 2; c.height = C * 2;
    const m = c.getContext('2d'); m.scale(2, 2);
    const mat = MATERIALS[v === MUD ? MUD : TYPE_OF[v]];
    m.fillStyle = mat.dark; m.fillRect(0, 0, C, C);
    m.fillStyle = mat.color; m.fillRect(1, 1, C - 2, C - 3);
    const t = v === MUD ? 'MUD' : TYPE_OF[v];
    switch (t) {
      case 'I': // kawayan: nodes and a shine
        m.fillStyle = 'rgba(255,255,255,0.3)'; m.fillRect(3, 1, 3, C - 3);
        m.fillStyle = mat.dark; m.fillRect(1, 10, C - 2, 2);
        m.fillStyle = 'rgba(0,0,0,0.15)'; m.fillRect(C - 6, 1, 4, C - 3);
        break;
      case 'O': // hollow block: two holes
        m.fillStyle = '#5c6268'; m.fillRect(4, 6, 6, 10); m.fillRect(14, 6, 6, 10);
        m.fillStyle = '#3f444a'; m.fillRect(4, 6, 6, 3); m.fillRect(14, 6, 6, 3);
        m.fillStyle = 'rgba(255,255,255,0.25)'; m.fillRect(1, 1, C - 2, 2);
        break;
      case 'T': // ladrilyo: bricks and mortar
        m.fillStyle = '#e8d8c0'; m.fillRect(1, 7, C - 2, 1.5); m.fillRect(1, 15, C - 2, 1.5);
        m.fillRect(11, 1, 1.5, 6); m.fillRect(5, 8.5, 1.5, 6.5); m.fillRect(17, 8.5, 1.5, 6.5); m.fillRect(11, 16.5, 1.5, 6);
        break;
      case 'S': // yero: corrugated ridges
        for (let x = 2; x < C - 1; x += 4) { m.fillStyle = 'rgba(255,255,255,0.35)'; m.fillRect(x, 1, 1.5, C - 3); m.fillStyle = 'rgba(0,0,0,0.18)'; m.fillRect(x + 2, 1, 1.5, C - 3); }
        m.fillStyle = '#9aa0a6'; m.fillRect(4, 4, 1.5, 1.5); m.fillRect(C - 6, C - 7, 1.5, 1.5);
        break;
      case 'Z': // plywood: grain
        m.strokeStyle = mat.dark; m.lineWidth = 0.8;
        for (let y = 4; y < C - 2; y += 4) { m.beginPath(); m.moveTo(1, y); m.bezierCurveTo(8, y - 2, 14, y + 2, C - 1, y); m.stroke(); }
        break;
      case 'J': // baldosa: a glossy tile with a flower
        m.fillStyle = 'rgba(255,255,255,0.45)'; m.beginPath(); m.moveTo(2, 2); m.lineTo(10, 2); m.lineTo(2, 10); m.fill();
        m.fillStyle = '#e8f0ff'; for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; m.beginPath(); m.arc(12 + Math.cos(a) * 3, 11 + Math.sin(a) * 3, 2, 0, TAU); m.fill(); }
        m.fillStyle = '#ffd23f'; m.beginPath(); m.arc(12, 11, 1.6, 0, TAU); m.fill();
        break;
      case 'L': // adobe: rough stone
        m.fillStyle = mat.dark; for (const [a, b] of [[5, 5], [15, 7], [9, 14], [18, 17], [4, 18], [12, 4]]) { m.beginPath(); m.arc(a, b, 1.3, 0, TAU); m.fill(); }
        m.fillStyle = 'rgba(255,255,255,0.18)'; m.fillRect(1, 1, C - 2, 2);
        break;
      default: // putik
        m.fillStyle = mat.dark; for (const [a, b, r] of [[6, 7, 3], [16, 12, 4], [9, 17, 2.5], [19, 5, 2]]) { m.beginPath(); m.arc(a, b, r, 0, TAU); m.fill(); }
    }
    sprites.set(v, c);
    return c;
  }
  const cellY = (y) => BY + (y - HIDDEN) * C;

  function piece(type, x, y, size, alpha = 1) {
    ctx.globalAlpha = alpha;
    for (const [cx, cy] of SHAPES[type][0]) ctx.drawImage(block(ID[type]), x + cx * size, y + cy * size, size, size);
    ctx.globalAlpha = 1;
  }
  // a piece centred in a box, for the hold and the queue
  function boxed(type, cx, cy, size, alpha) {
    const cs = SHAPES[type][0], xs = cs.map(([x]) => x), ys = cs.map(([, y]) => y);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * size, h = (Math.max(...ys) - Math.min(...ys) + 1) * size;
    piece(type, cx - w / 2 - Math.min(...xs) * size, cy - h / 2 - Math.min(...ys) * size, size, alpha);
  }

  // ---------- effects ----------
  const emit = (p) => { if (parts.length < (reduced ? 120 : 400)) parts.push({ g: 0, drag: 0.94, size: 2, ...p, max: p.life }); };
  const popup = (text, x, y, color, size = 16, life = 1.2) => popups.push({ text, x, y, color, size, life, max: life });
  const say = (k) => { bubble = { text: pick(SAYS[k]), life: 2.4 }; };

  function event(e, g) {
    switch (e.type) {
      case 'go': say('go'); break;
      case 'hardDrop':
        if (e.rows > 2 && g.cur) for (const [x, y] of cellsOf(g.cur)) emit({ x: BX + x * C + C / 2, y: cellY(y) + C, vx: rnd(-30, 30), vy: rnd(-40, -10), life: 0.4, color: 'rgba(220,210,190,0.7)', size: 3 });
        shake = reduced ? 0 : Math.min(3, 1 + e.rows / 8);
        break;
      case 'lines': {
        const midY = cellY(e.rows.reduce((a, b) => a + b, 0) / e.rows.length) + C / 2;
        for (const r of e.rows) for (let x = 0; x < COLS; x++) for (let k = 0; k < 2; k++) emit({ x: BX + x * C + rnd(0, C), y: cellY(r) + rnd(0, C), vx: rnd(-60, 60), vy: rnd(-90, 10), g: 220, life: rnd(0.5, 0.9), color: pick(['#d9d4c7', '#b3b8bd', '#e8dcc6', '#fff']), size: rnd(1.5, 3.5) });
        const word = e.spin ? (e.n ? `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][e.n]}!` : 'T-SPIN!') : WORDS[e.n];
        popup(word, BX + (COLS * C) / 2, midY - 10, e.n === 4 ? '#ffd23f' : e.spin ? '#ff8ae2' : '#fff8e1', e.n === 4 || e.spin ? 22 : 17, 1.4);
        popup(`+${peso(e.points)}`, BX + (COLS * C) / 2, midY + 14, '#7cf29a', 14, 1.4);
        if (e.b2b) popup('Sunod-sunod! ×1.5', BX + (COLS * C) / 2, midY + 34, '#9ad7ff', 12, 1.4);
        if (e.combo > 0) popup(`Tuloy-tuloy ×${e.combo}`, BX + (COLS * C) / 2, midY - 34, '#ffb36b', 13, 1.2);
        if (e.n === 4) { say('four'); parade = { t: 0 }; flash = reduced ? 0 : 0.35; shake = reduced ? 0 : 6; }
        else if (e.spin) say('tspin');
        else if (e.combo >= 2) say('combo');
        else if (Math.random() < 0.3) say('one');
        break;
      }
      case 'tspin': popup('T-SPIN!', BX + (COLS * C) / 2, BY + 160, '#ff8ae2', 18); break;
      case 'levelUp': popup(`Palapag ${e.level}!`, BX + (COLS * C) / 2, BY + 120, '#ffd23f', 22, 1.8); say('level'); break;
      case 'rise': if (Math.random() < 0.35) say('rise'); for (let x = 0; x < COLS; x++) emit({ x: BX + x * C + C / 2, y: BY + VISIBLE * C, vx: rnd(-20, 20), vy: rnd(-60, -20), life: 0.5, color: 'rgba(120,100,70,0.8)', size: 3 }); shake = reduced ? 0 : 2; break;
      case 'gameover': say('over'); shake = reduced ? 0 : 5; break;
      case 'done': popup('TAPOS! Deadline met!', BX + (COLS * C) / 2, BY + 200, '#7cf29a', 20, 2.4); break;
      default: break;
    }
  }

  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.drag; }
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.life -= dt; p.y -= 16 * dt; if (p.life <= 0) popups.splice(i, 1); }
    if (bubble && (bubble.life -= dt) <= 0) bubble = null;
    if (parade && (parade.t += dt) > 3.2) parade = null;
    flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt * 30);
  }

  // ---------- the site ----------
  function sky(g, t) {
    const lvl = g.level || 1;
    const stages = [
      ['#8fd0ff', '#e8f6ff'], ['#5fb8f0', '#cdeeff'], ['#ff9a5c', '#ffd79a'], ['#6a4a9a', '#e0788a'], ['#101838', '#2a2c5a'],
    ];
    const k = g.mode === 'bagyo' ? -1 : g.mode === 'deadline' ? 0 : Math.min(4, Math.floor((lvl - 1) / 3));
    const [a, b] = k < 0 ? ['#3a4450', '#6a7480'] : stages[k];
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    if (k === 4) for (let s = 0; s < 40; s++) { ctx.fillStyle = `rgba(255,255,230,${0.4 + 0.4 * Math.sin(t * 2 + s)})`; ctx.fillRect((s * 97) % W, (s * 53) % 200, 1.4, 1.4); }
    if (k >= 0 && k <= 2) { ctx.fillStyle = k === 2 ? '#ffb36b' : '#fff4c2'; ctx.beginPath(); ctx.arc(k === 2 ? 60 : 380, k === 2 ? 180 : 70, 24, 0, TAU); ctx.fill(); }
    // the building going up behind: one floor a level
    const floors = Math.min(18, (g.mode === 'deadline' ? Math.floor(g.lines / 4) : lvl + Math.floor((g.lines % 10) / 10)) + 1);
    const night = k === 4;
    for (const [bx, bw] of [[6, 80], [W - 86, 80]]) {
      for (let f = 0; f < floors; f++) {
        const fy = H - 30 - (f + 1) * 26;
        ctx.fillStyle = night ? '#23263a' : '#c9c2b4'; ctx.fillRect(bx, fy, bw, 24);
        ctx.fillStyle = night ? 'rgba(255,214,120,0.8)' : 'rgba(80,100,120,0.55)';
        for (let w = 0; w < 4; w++) if (!night || (f * 7 + w * 3) % 5 !== 0) ctx.fillRect(bx + 8 + w * 18, fy + 6, 10, 12);
        ctx.fillStyle = night ? '#1a1c2a' : '#a8a092'; ctx.fillRect(bx, fy + 22, bw, 2);
      }
      // the top floor still being built: bare posts and rebar
      const top = H - 30 - (floors + 1) * 26;
      ctx.fillStyle = '#8a8274'; for (let p = 0; p < 5; p++) ctx.fillRect(bx + p * 19, top + 4, 3, 22);
      ctx.strokeStyle = '#6b5a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, top + 10); ctx.lineTo(bx + bw, top + 10); ctx.stroke();
    }
    ctx.fillStyle = '#6b5a3e'; ctx.fillRect(0, H - 30, W, 30); // the ground
    ctx.fillStyle = '#8a7654'; for (let x = 0; x < W; x += 22) ctx.fillRect(x, H - 30, 12, 3);
  }

  // Kawayan scaffolding (plantsa) round the board, tied with rope.
  function scaffold() {
    const x0 = BX - 10, x1 = BX + COLS * C + 4, y0 = BY - 10, y1 = BY + VISIBLE * C + 4;
    const pole = (x, y, w, h) => { ctx.fillStyle = '#b9a45a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#8f7a38'; if (w < h) { for (let k = y + 30; k < y + h; k += 60) ctx.fillRect(x, k, w, 2); } else for (let k = x + 30; k < x + w; k += 60) ctx.fillRect(k, y, 2, h); };
    pole(x0, y0 - 6, 6, y1 - y0 + 16); pole(x1, y0 - 6, 6, y1 - y0 + 16);
    for (const y of [y0, BY + 7 * C, BY + 14 * C, y1]) { pole(x0 - 4, y, x1 - x0 + 14, 6); ctx.fillStyle = '#e8d8a0'; ctx.fillRect(x0 - 1, y - 1, 8, 8); ctx.fillRect(x1 - 1, y - 1, 8, 8); }
  }

  function kapatas(t, g) {
    const x = 46, y = H - 70;
    const bob = reduced ? 0 : Math.sin(t * 2) * 1.5;
    ctx.save(); ctx.translate(x, y + bob);
    ctx.fillStyle = '#2f6fd6'; ctx.beginPath(); ctx.roundRect(-16, 4, 32, 30, 8); ctx.fill(); // shirt
    ctx.fillStyle = '#ff9f43'; ctx.fillRect(-16, 10, 32, 4); ctx.fillRect(-16, 22, 32, 4); // safety vest stripes
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(4, 2, 12, 8, 3); ctx.fill(); // the bimpo on his shoulder
    ctx.fillStyle = '#c98a5a'; ctx.beginPath(); ctx.arc(0, -8, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#231626'; ctx.beginPath(); ctx.arc(-4, -9, 1.6, 0, TAU); ctx.arc(4, -9, 1.6, 0, TAU); ctx.fill();
    ctx.fillRect(-5, -4, 10, 2.4); // moustache
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, -16, 15, 5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, -17, 11, Math.PI, 0); ctx.fill(); // hard hat
    ctx.fillStyle = '#e0b020'; ctx.fillRect(-1.5, -27, 3, 10);
    ctx.restore();
    if (bubble) {
      ctx.font = FONT(700, 11);
      const lines = wrap(bubble.text, 80);
      const bw = 88, bh = 8 + lines.length * 13, bx = 4, by = y - 44 - bh;
      ctx.globalAlpha = clamp(bubble.life * 3, 0, 1);
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(38, by + bh); ctx.lineTo(46, by + bh + 8); ctx.lineTo(52, by + bh); ctx.fill();
      ctx.fillStyle = '#231626'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 14 + i * 13)); ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
  function wrap(text, width) {
    const words = text.split(' '), out = [];
    let line = '';
    for (const w of words) { const test = line ? `${line} ${w}` : w; if (ctx.measureText(test).width > width && line) { out.push(line); line = w; } else line = test; }
    if (line) out.push(line);
    return out;
  }

  // The Bayanihan: neighbours carrying a bahay kubo across the top of the board.
  function bayanihan() {
    const k = parade.t / 3.2, x = -120 + k * (W + 240), y = BY + 70;
    ctx.save(); ctx.translate(x, y);
    const step = Math.sin(parade.t * 14);
    for (let p = 0; p < 6; p++) {
      const px = -48 + p * 19, ly = p % 2 ? step : -step;
      ctx.strokeStyle = '#231626'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, 26); ctx.lineTo(px - 4, 40 + ly * 2); ctx.moveTo(px, 26); ctx.lineTo(px + 4, 40 - ly * 2); ctx.moveTo(px, 12); ctx.lineTo(px, 26); ctx.moveTo(px, 14); ctx.lineTo(px, 4); ctx.stroke();
      ctx.fillStyle = '#c98a5a'; ctx.beginPath(); ctx.arc(px, 8, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = ['#e8384f', '#2f6fd6', '#ffd23f', '#3fae5a', '#ff8ae2', '#ff9f43'][p]; ctx.fillRect(px - 4, 12, 8, 10);
    }
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-62, 0, 124, 4); // the bamboo poles on their shoulders
    ctx.fillStyle = '#d9b77a'; ctx.fillRect(-36, -30, 72, 30); // the walls of the kubo
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-10, -20, 20, 20);
    ctx.fillStyle = '#b8864a'; ctx.beginPath(); ctx.moveTo(-50, -28); ctx.lineTo(0, -62); ctx.lineTo(50, -28); ctx.fill(); // nipa roof
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; for (let r = -44; r < 44; r += 7) { ctx.beginPath(); ctx.moveTo(r, -28); ctx.lineTo(r * 0.3, -50); ctx.stroke(); }
    ctx.restore();
    if (!reduced && Math.random() < 0.6) emit({ x: rnd(BX, BX + COLS * C), y: BY, vx: rnd(-20, 20), vy: rnd(20, 80), life: 1.2, color: pick(['#e8384f', '#ffd23f', '#2f6fd6', '#7cf29a', '#ff8ae2']), size: 2.4 });
  }

  // ---------- the HUD ----------
  function panels(g, best) {
    ctx.textBaseline = 'middle';
    // top bar
    ctx.fillStyle = 'rgba(18,16,24,0.82)'; ctx.fillRect(0, 0, W, 40);
    ctx.textAlign = 'left'; ctx.fillStyle = '#cfc6b4'; ctx.font = FONT(700, 10); ctx.fillText('KITA', 12, 12);
    ctx.fillStyle = '#ffd23f'; ctx.font = FONT(800, 18); ctx.fillText(peso(g.score), 12, 28);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff8e1'; ctx.font = FONT(800, 15); ctx.fillText(g.modeDef.name.toUpperCase(), W / 2, 14);
    ctx.fillStyle = '#9ad7ff'; ctx.font = FONT(700, 11);
    ctx.fillText(g.mode === 'deadline' ? `${Math.max(0, 40 - g.lines)} hanay pa` : `Palapag ${g.level} · ${g.lines} hanay`, W / 2, 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#cfc6b4'; ctx.font = FONT(700, 10); ctx.fillText(g.mode === 'deadline' ? 'ORAS' : 'BEST', W - 12, 12);
    ctx.fillStyle = '#ff8ae2'; ctx.font = FONT(800, 18);
    ctx.fillText(g.mode === 'deadline' ? clock(g.elapsed) : peso(Math.max(best, g.score)), W - 12, 28);
    // the hold, on the left
    const box = (x, y, w, h, label) => {
      ctx.fillStyle = 'rgba(18,16,24,0.7)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,63,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#cfc6b4'; ctx.font = FONT(800, 10); ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + 10);
    };
    box(8, BY, 76, 70, 'IMBAK');
    if (g.hold) boxed(g.hold, 46, BY + 42, 15, g.holdUsed ? 0.35 : 1);
    if (g.hold) { ctx.fillStyle = '#fff8e1'; ctx.font = FONT(700, 9); ctx.fillText(MATERIALS[g.hold].name, 46, BY + 64); }
    box(8, BY + 80, 76, g.mode === 'bagyo' ? 116 : 96, 'TALA');
    ctx.textAlign = 'left'; ctx.font = FONT(700, 10); ctx.fillStyle = '#fff8e1';
    const stats = [['Oras', clock(g.elapsed)], ['Bayanihan', g.stats.bayanihan], ['T-spin', g.stats.tspins], ['Combo', Math.max(0, g.stats.maxCombo)]];
    if (g.mode === 'bagyo' && g.rise) stats.push(['Baha', `${Math.ceil(g.rise.t / 60)}s`]);
    stats.forEach(([k, v], i) => { ctx.fillStyle = '#cfc6b4'; ctx.textAlign = 'left'; ctx.fillText(k, 14, BY + 102 + i * 18); ctx.fillStyle = '#fff8e1'; ctx.textAlign = 'right'; ctx.fillText(String(v), 78, BY + 102 + i * 18); });
    // the queue, on the right
    box(W - 84, BY, 76, 250, 'SUSUNOD');
    g.queue.forEach((t, i) => boxed(t, W - 46, BY + 38 + i * 46, i === 0 ? 15 : 12, i === 0 ? 1 : 0.85));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  const clock = (ticks) => { const s = Math.floor(ticks / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ---------- the frame ----------
  function draw(g, t, opts = {}) {
    reduced = !!opts.reduced;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1);
    lastT = t;
    updateFx(dt);
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, canvas.height / H, 0, 0);
    sky(g, t);
    if (g.mode === 'bagyo') { if (!reduced && Math.random() < 0.004) bolt = 0.25; bolt = Math.max(0, bolt - dt); if (bolt > 0) { ctx.fillStyle = `rgba(255,255,255,${bolt})`; ctx.fillRect(0, 0, W, H); } }
    const sx = shake && !reduced ? rnd(-shake, shake) : 0, sy = shake && !reduced ? rnd(-shake, shake) : 0;
    ctx.setTransform(k, 0, 0, canvas.height / H, sx * k, sy * k);
    scaffold();
    // the slab
    ctx.fillStyle = '#26232c'; ctx.fillRect(BX, BY, COLS * C, VISIBLE * C);
    ctx.strokeStyle = 'rgba(154,215,255,0.07)'; ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(BX + x * C + 0.5, BY); ctx.lineTo(BX + x * C + 0.5, BY + VISIBLE * C); ctx.stroke(); }
    for (let y = 1; y < VISIBLE; y++) { ctx.beginPath(); ctx.moveTo(BX, BY + y * C + 0.5); ctx.lineTo(BX + COLS * C, BY + y * C + 0.5); ctx.stroke(); }
    // danger: the stack near the top
    let top = ROWS;
    for (let i = 0; i < g.board.length; i++) if (g.board[i]) { top = Math.floor(i / COLS); break; }
    const high = top < HIDDEN + 5 && g.phase !== 'over';
    if (high) { ctx.strokeStyle = `rgba(255,92,92,${0.4 + 0.4 * Math.sin(t * 8)})`; ctx.lineWidth = 3; ctx.strokeRect(BX - 1.5, BY - 1.5, COLS * C + 3, VISIBLE * C + 3); if (!bubble && Math.random() < 0.01) say('high'); }
    // the blocks already set
    const clearing = g.phase === 'clear' && g.clearing;
    const over = g.phase === 'over';
    for (let y = HIDDEN; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = g.board[y * COLS + x];
      if (!v) continue;
      ctx.drawImage(block(v), BX + x * C, cellY(y), C, C);
      if (over) { ctx.fillStyle = 'rgba(40,36,44,0.55)'; ctx.fillRect(BX + x * C, cellY(y), C, C); }
    }
    if (clearing) {
      const f = g.phaseT / CLEAR_T;
      for (const r of g.clearing) { ctx.fillStyle = `rgba(255,250,235,${reduced ? 0.6 : 0.4 + 0.5 * Math.abs(Math.sin(f * 10))})`; ctx.fillRect(BX, cellY(r), COLS * C * f, C); } // the row is wiped away from the right
    }
    // the ghost and the piece in hand
    if (g.cur && g.phase === 'play') {
      const gh = ghostOf(g);
      if (gh.y !== g.cur.y) for (const [x, y] of cellsOf(gh)) if (y >= HIDDEN) { ctx.strokeStyle = MATERIALS[gh.type].color; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(BX + x * C + 2, cellY(y) + 2, C - 4, C - 4); ctx.setLineDash([]); ctx.globalAlpha = 0.12; ctx.fillStyle = MATERIALS[gh.type].color; ctx.fillRect(BX + x * C, cellY(y), C, C); ctx.globalAlpha = 1; }
      const lockGlow = g.lockT > 0 ? g.lockT / g.diff.lock : 0;
      for (const [x, y] of cellsOf(g.cur)) if (y >= HIDDEN) {
        ctx.drawImage(block(ID[g.cur.type]), BX + x * C, cellY(y), C, C);
        if (lockGlow) { ctx.fillStyle = `rgba(255,255,255,${lockGlow * 0.35})`; ctx.fillRect(BX + x * C, cellY(y), C, C); }
      }
    }
    // rain in a bagyo
    if (g.mode === 'bagyo') {
      while (rain.length < (reduced ? 40 : 120)) rain.push({ x: Math.random() * W, y: Math.random() * H, v: rnd(380, 520) });
      ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of rain) { d.y += d.v * dt; d.x -= d.v * 0.2 * dt; if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 80); } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 2, d.y - 9); }
      ctx.stroke();
    }
    for (const p of parts) { ctx.globalAlpha = clamp((p.life / p.max) * 1.5, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
    if (parade) bayanihan();
    if (flash > 0) { ctx.fillStyle = `rgba(255,248,220,${flash})`; ctx.fillRect(BX, BY, COLS * C, VISIBLE * C); }
    ctx.setTransform(k, 0, 0, canvas.height / H, 0, 0);
    panels(g, opts.best || 0);
    kapatas(t, g);
    ctx.textAlign = 'center';
    for (const p of popups) {
      const a = clamp((p.life / p.max) * 2, 0, 1);
      ctx.font = FONT(800, p.size); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(20,16,24,${a})`; ctx.strokeText(p.text, p.x, p.y);
      ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
    }
    if (g.phase === 'ready') {
      ctx.fillStyle = 'rgba(18,16,24,0.75)'; ctx.fillRect(BX, BY + 200, COLS * C, 70);
      ctx.font = FONT(800, 24); ctx.fillStyle = '#ffd23f'; ctx.fillText(g.modeDef.name.toUpperCase(), BX + (COLS * C) / 2, BY + 230);
      ctx.font = FONT(700, 13); ctx.fillStyle = '#fff8e1'; ctx.fillText(g.mode === 'deadline' ? '40 hanay, bilisan!' : g.mode === 'bagyo' ? 'Tumataas ang baha!' : 'Buuin ang bahay!', BX + (COLS * C) / 2, BY + 254);
    }
    ctx.textAlign = 'left';
  }

  function reset() { parts.length = 0; popups.length = 0; flash = 0; shake = 0; parade = null; bubble = null; }
  return { draw, resize, event, reset, say };
}
