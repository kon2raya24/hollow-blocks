// Procedural textures for Hollow Blocks (adapted from Tumbang Preso): noise, normal maps from heights,
// and painted surfaces for the site, the houses and the signs, all drawn into canvases at load time.
// No image files.
import * as THREE from './vendor/three.module.min.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => clamp(Math.round(v * k), 0, 255); return `rgb(${f(r)},${f(g)},${f(b)})`; };

// Smooth value noise on a wrapping lattice, so every texture tiles.
export function noise(w, h, cell, r) {
  const gw = Math.max(1, Math.round(w / cell)), gh = Math.max(1, Math.round(h / cell)), grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(w * h), s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = (y / h) * gh, y0 = Math.floor(gy) % gh, y1 = (y0 + 1) % gh, fy = s(gy - Math.floor(gy));
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * gw, x0 = Math.floor(gx) % gw, x1 = (x0 + 1) % gw, fx = s(gx - Math.floor(gx));
      const a = grid[y0 * gw + x0], b = grid[y0 * gw + x1], c = grid[y1 * gw + x0], d = grid[y1 * gw + x1];
      out[y * w + x] = lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    }
  }
  return out;
}
export function fbm(w, h, cell, octaves, r) {
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) { const n = noise(w, h, Math.max(1, cell / 2 ** o), r); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function toTex(c, { repeat = null, color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// A normal map from a height field: the slope in x and y, packed into RGB.
export function normalMap(hgt, w, h, strength = 2, opts = {}) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = hgt[j * w + ((i - 1 + w) % w)], rr = hgt[j * w + ((i + 1) % w)], u = hgt[((j - 1 + h) % h) * w + i], d = hgt[((j + 1) % h) * w + i];
    let nx = (l - rr) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const p = (j * w + i) * 4;
    img.data[p] = (nx * 0.5 + 0.5) * 255; img.data[p + 1] = (ny * 0.5 + 0.5) * 255; img.data[p + 2] = (nz * 0.5 + 0.5) * 255; img.data[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return toTex(c, { ...opts, color: false });
}
// Paint pixels from a function of (x, y) giving [r, g, b] (0-255) and optionally a height.
export function paint(w, h, fn, { repeat = null, strength = 0 } = {}) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), hgt = strength ? new Float32Array(w * h) : null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = fn(i, j), p = (j * w + i) * 4;
    img.data[p] = clamp(v[0], 0, 255); img.data[p + 1] = clamp(v[1], 0, 255); img.data[p + 2] = clamp(v[2], 0, 255); img.data[p + 3] = 255;
    if (hgt) hgt[j * w + i] = v[3] ?? 0;
  }
  x.putImageData(img, 0, 0);
  return { map: toTex(c, { repeat }), normalMap: hgt ? normalMap(hgt, w, h, strength, { repeat }) : null, canvas: c };
}

// ---------- stage surfaces ----------
export function asphalt(seed, { size = 512, repeat = [14, 5] } = {}) {
  const r = rng(seed), big = fbm(size, size, 128, 4, r), grain = noise(size, size, 2, r), stone = noise(size, size, 5, r);
  return paint(size, size, (x, y) => {
    const i = y * size + x, st = stone[i] > 0.78 ? (stone[i] - 0.78) * 4 : 0, v = 64 + (big[i] - 0.5) * 30 + (grain[i] - 0.5) * 26 + st * 50;
    let c = [v, v, v * 1.03];
    return [...c, grain[i] * 0.5 + st * 0.8];
  }, { repeat, strength: 2.5 });
}
export function concrete(seed, color, { size = 256, repeat = [2, 2], grime = 1 } = {}) {
  const r = rng(seed), [cr, cg, cb] = hex(color), big = fbm(size, size, 96, 4, r), grain = noise(size, size, 2, r);
  return paint(size, size, (x, y) => {
    const i = y * size + x, streak = grime * Math.max(0, big[(x * 7) % size] - 0.45) * (1 - y / size) * 0.4, k = 1 - (big[i] - 0.5) * 0.18 - (grain[i] - 0.5) * 0.06 - streak - grime * Math.max(0, y / size - 0.85) * 0.8;
    return [cr * k, cg * k, cb * k, grain[i] * 0.4 + big[i] * 0.4];
  }, { repeat, strength: 2 });
}
export function planks(seed, { size = 512, repeat = [4, 1], color = '#c08a4e' } = {}) {
  const r = rng(seed), [cr, cg, cb] = hex(color), grain = fbm(size, size, 64, 3, r), fine = noise(size, size, 2, r), tone = new Float32Array(16);
  for (let i = 0; i < 16; i++) tone[i] = 0.85 + r() * 0.25;
  return paint(size, size, (x, y) => {
    const row = Math.floor(y / (size / 8)), seam = y % (size / 8) < 2 || ((x + row * 97) % (size / 2)) < 2;
    const i = y * size + x, g = Math.sin((y * 0.9 + grain[i] * 40) * 0.6) * 0.5 + 0.5, k = tone[row % 16] * (0.9 + g * 0.12 + (fine[i] - 0.5) * 0.05) * (seam ? 0.55 : 1);
    return [cr * k, cg * k, cb * k, seam ? -1 : g * 0.2];
  }, { repeat, strength: 3 });
}
export function bark(seed, { size = 256, repeat = [3, 2] } = {}) {
  const r = rng(seed), f = fbm(size, size, 32, 4, r), fine = noise(size, size, 3, r);
  return paint(size, size, (x, y) => {
    const i = y * size + x, ridge = Math.abs(Math.sin((x / size) * 40 + f[i] * 9)), v = 40 + ridge * 45 + (fine[i] - 0.5) * 20;
    return [v * 1.15, v * 0.95, v * 0.72, ridge + fine[i] * 0.3];
  }, { repeat, strength: 5 });
}
export function dirt(seed, { size = 512, repeat = [5, 2] } = {}) {
  const r = rng(seed), big = fbm(size, size, 96, 4, r), grain = noise(size, size, 2, r), leaf = noise(size, size, 7, r);
  return paint(size, size, (x, y) => {
    const i = y * size + x, l = leaf[i] > 0.74, v = 58 + (big[i] - 0.5) * 30 + (grain[i] - 0.5) * 22;
    return l ? [70 + grain[i] * 40, 60 + grain[i] * 30, 22, 0.8] : [v * 1.1, v * 0.9, v * 0.62, grain[i] * 0.6 + big[i] * 0.3];
  }, { repeat, strength: 3 });
}
// Corrugated sheet: the ridges in the normal map, rust in the colour.
export function corrugated(seed, { size = 256, repeat = [8, 1] } = {}) {
  const r = rng(seed), rust = fbm(size, size, 48, 3, r);
  return paint(size, size, (x, y) => {
    const i = y * size + x, rid = Math.sin((x / size) * Math.PI * 16), ru = Math.max(0, rust[i] - 0.55) * 2.2, v = 170 + rid * 20;
    return [lerp(v, 150, ru), lerp(v, 80, ru), lerp(v + 6, 45, ru), rid * 0.5];
  }, { repeat, strength: 6 });
}
// Rattan for the arnis sticks: fibres along the stick and the nodes every few centimetres.
export function rattan(seed = 11) {
  const r = rng(seed), f = noise(64, 256, 3, r);
  return paint(64, 256, (x, y) => {
    const node = Math.abs((y % 42) - 21) < 2, k = (0.85 + f[y * 64 + x] * 0.25) * (node ? 0.6 : 1);
    return [205 * k, 158 * k, 88 * k, node ? 1 : f[y * 64 + x] * 0.3];
  }, { strength: 3 });
}
// A woven bamboo basket.
export function weave(seed = 12) {
  const r = rng(seed), f = noise(128, 128, 3, r);
  return paint(128, 128, (x, y) => {
    const over = ((x >> 3) + (y >> 3)) % 2, band = over ? Math.sin(((x % 8) / 8) * Math.PI) : Math.sin(((y % 8) / 8) * Math.PI), k = 0.6 + band * 0.4 + (f[y * 128 + x] - 0.5) * 0.1;
    return [196 * k, 150 * k, 90 * k, band];
  }, { repeat: [4, 2], strength: 4 });
}

// A painted building front: stained concrete, windows with glass that catches the sky, iron grilles,
// a door or a roll-up shop shutter, and a sign. Returns colour and normal maps.
export function facade(seed, w, h, color, { shop = false, sky = ['#8fc8f0', '#fff2d8'], lit = 0 } = {}) {
  const PX = 48, W = Math.round(w * PX), H = Math.round(h * PX), r = rng(seed);
  const base = concrete(seed, color, { size: 256 }).canvas;
  const cv = canvas(W, H), x = cv.getContext('2d');
  const pat = x.createPattern(base, 'repeat'); x.fillStyle = pat; x.fillRect(0, 0, W, H);
  const hgt = new Float32Array(W * H);
  const rect = (x0, y0, ww, hh, v) => { for (let j = Math.max(0, y0 | 0); j < Math.min(H, (y0 + hh) | 0); j++) for (let i = Math.max(0, x0 | 0); i < Math.min(W, (x0 + ww) | 0); i++) hgt[j * W + i] = v; };
  const floors = Math.max(1, Math.floor(h / 3));
  for (let f = 0; f < floors; f++) {
    const top = H - (f + 1) * 3 * PX, n = Math.max(1, Math.floor(w / 2.2));
    if (f === 0 && shop) {
      // a roll-up shutter, half open, the shop inside
      const sx = W * 0.12, sw = W * 0.76, sy = top + 0.5 * PX, sh = 2.4 * PX;
      const gr = x.createLinearGradient(0, sy, 0, sy + sh); gr.addColorStop(0, '#2a2420'); gr.addColorStop(1, '#4a3a2e'); x.fillStyle = gr; x.fillRect(sx, sy, sw, sh);
      for (let k = 0; k < 60; k++) { x.fillStyle = ['#e8384f', '#ffd23f', '#2f6fd6', '#3fae5a', '#f4f1e6', '#ff9f43'][k % 6]; x.fillRect(sx + 6 + r() * (sw - 20), sy + sh * 0.35 + r() * sh * 0.5, 6 + r() * 10, 8 + r() * 14); }
      x.fillStyle = '#9aa0a8'; x.fillRect(sx, sy, sw, sh * 0.32); for (let k = 0; k < sh * 0.32; k += 5) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(sx, sy + k, sw, 1.5); }
      rect(sx, sy, sw, sh, -1);
      continue;
    }
    for (let k = 0; k < n; k++) {
      const ww = 1.1 * PX, wh = 1.2 * PX, wx = (W / n) * (k + 0.5) - ww / 2, wy = top + (f === 0 ? 0.9 : 0.8) * PX;
      if (f === 0 && k === 0) { // a door
        const dx = wx, dh = 2.2 * PX, dy = top + 3 * PX - dh;
        x.fillStyle = shade(['#6a4a2a', '#2e5a3a', '#7a2a2a', '#3a4a6a'][Math.floor(r() * 4)], 1); x.fillRect(dx, dy, ww * 0.9, dh);
        x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(dx + 8, dy + 8, ww * 0.9 - 16, dh / 2 - 12); x.strokeRect(dx + 8, dy + dh / 2 + 4, ww * 0.9 - 16, dh / 2 - 12);
        rect(dx, dy, ww * 0.9, dh, -0.6);
        continue;
      }
      x.fillStyle = '#e8e2d6'; x.fillRect(wx - 5, wy - 5, ww + 10, wh + 10); // the frame
      const gl = x.createLinearGradient(0, wy, 0, wy + wh);
      if (lit && r() < lit) { gl.addColorStop(0, '#ffe7a0'); gl.addColorStop(1, '#ffb850'); } else { gl.addColorStop(0, sky[0]); gl.addColorStop(0.55, shade('#34404c', 1)); gl.addColorStop(1, '#1e262e'); }
      x.fillStyle = gl; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(wx, wy + wh * 0.6); x.lineTo(wx + ww * 0.5, wy); x.lineTo(wx + ww * 0.7, wy); x.lineTo(wx, wy + wh); x.fill(); // a reflection
      x.fillStyle = '#1a1a1a'; for (let b = wx + 6; b < wx + ww; b += 9) x.fillRect(b, wy, 2.5, wh); x.fillRect(wx, wy + wh / 2 - 1, ww, 3); // grille
      x.fillStyle = 'rgba(60,50,40,0.25)'; x.fillRect(wx - 4, wy + wh + 5, ww + 8, 3); for (let s = 0; s < 3; s++) x.fillRect(wx + r() * ww, wy + wh + 8, 2, 20 + r() * 40); // stains under the sill
      rect(wx - 5, wy - 5, ww + 10, wh + 10, 0.4); rect(wx, wy, ww, wh, -0.8);
    }
    // a ledge between floors
    if (f > 0) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, top + 3 * PX - 6, W, 6); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, top + 3 * PX, W, 5); rect(0, top + 3 * PX - 6, W, 6, 0.7); }
  }
  // grime at the bottom, from rain splashing up
  const gr = x.createLinearGradient(0, H - 1.2 * PX, 0, H); gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(1, 'rgba(40,30,20,0.45)'); x.fillStyle = gr; x.fillRect(0, H - 1.2 * PX, W, 1.2 * PX);
  return { map: toTex(cv), normalMap: normalMap(hgt, W, H, 4) };
}

// Lettering on a board, drawn crisp.
export function sign(lines, bg, fg, { w = 512, h = 128, border = null } = {}) {
  const cv = canvas(w, h), x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, shade(bg, 1.08)); gr.addColorStop(1, shade(bg, 0.88)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = h * 0.06; x.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach(([text, size, weight = 800], k) => { x.font = `${weight} ${size * (h / 32)}px "Baloo 2", system-ui, sans-serif`; x.fillText(text, w / 2, h * (lines.length === 1 ? 0.54 : 0.34 + k * 0.4), w * 0.94); });
  // weathering
  const r = rng(w + h), n = noise(64, 16, 4, r);
  x.globalCompositeOperation = 'multiply';
  for (let j = 0; j < 16; j++) for (let i = 0; i < 64; i++) { const v = 1 - n[j * 64 + i] * 0.12; x.fillStyle = `rgba(${255 * v | 0},${250 * v | 0},${240 * v | 0},1)`; x.fillRect((i * w) / 64, (j * h) / 16, w / 64 + 1, h / 16 + 1); }
  x.globalCompositeOperation = 'source-over';
  return toTex(cv);
}
