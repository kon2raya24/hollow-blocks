// The building materials, as physically based surfaces painted in code: every cell of the board is a
// bevelled block of its real material, with colour, relief (a normal map) and roughness.
// - kawayan: two bamboo culms with a node, glossy (lying down, or standing when the piece stood up)
// - hollow block: grey concrete with its two cores
// - ladrilyo: three courses of red brick in running bond
// - yero: painted corrugated iron, scratched to the zinc, with its screws
// - plywood: rotary-cut veneer with a football patch
// - baldosa: a glossy blue tile with a cream flower, under a clear coat
// - adobe: porous volcanic tuff, chiselled
// - putik: wet mud with pebbles, shining where it's wettest
// The colours stay far apart so a piece reads at a glance.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three-extra.min.js';
import { rng, noise, fbm, canvas, toTex, normalMap, clamp, lerp } from './tex.mjs';

export const CS = 0.5; // a cell, in metres
const S = 256;
const hexRGB = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const sc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// Paint colour, height and roughness from fn(x, y) → [r, g, b, height, roughness 0..1].
function pbr(fn, { strength = 3, size = S } = {}) {
  const cv = canvas(size, size), rv = canvas(size, size), x = cv.getContext('2d'), xr = rv.getContext('2d');
  const img = x.createImageData(size, size), ri = xr.createImageData(size, size), hgt = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const v = fn(i, j), p = (j * size + i) * 4;
    img.data[p] = clamp(v[0], 0, 255); img.data[p + 1] = clamp(v[1], 0, 255); img.data[p + 2] = clamp(v[2], 0, 255); img.data[p + 3] = 255;
    hgt[j * size + i] = v[3];
    const r = clamp(v[4] * 255, 0, 255); ri.data[p] = r; ri.data[p + 1] = r; ri.data[p + 2] = r; ri.data[p + 3] = 255;
  }
  x.putImageData(img, 0, 0); xr.putImageData(ri, 0, 0);
  return { map: toTex(cv), normalMap: normalMap(hgt, size, size, strength), roughnessMap: toTex(rv, { color: false }), canvas: cv };
}
const rot90 = (t) => { const c = t.clone(); c.center.set(0.5, 0.5); c.rotation = Math.PI / 2; c.needsUpdate = true; return c; };

// ---------- the surfaces ----------
function kawayan() {
  const r = rng(101), fib = noise(S, S, 2, r), streak = fbm(S, S, 24, 3, r), blot = fbm(S, S, 64, 3, r);
  const base = hexRGB('#b8c24e'), dark = hexRGB('#6f7a22'), sun = hexRGB('#e2d77a');
  return pbr((x, y) => {
    const i = y * S + x, v = y / S, u = x / S;
    const k = v < 0.5 ? 0 : 1, c = 0.25 + k * 0.5, rr = 0.235, d = (v - c) / rr; // two culms, one above the other
    const round = Math.sqrt(Math.max(0, 1 - d * d));
    const node = Math.exp(-(((u - 0.5) * 34) ** 2)), ring = Math.exp(-(((u - 0.53) * 60) ** 2));
    const fibre = (fib[(y * 7 % S) * S + x] - 0.5) * 0.12 + (streak[i] - 0.5) * 0.25;
    let col = mix3(base, sun, clamp(0.5 - d * 0.6 + fibre, 0, 1));
    col = mix3(col, dark, clamp(node * 0.55 + Math.max(0, blot[i] - 0.62) * 1.2 + (1 - round) * 0.6, 0, 1));
    if (Math.abs(d) > 0.97) col = sc(dark, 0.5); // the crease between the culms
    const h = round * 1.2 + ring * 0.25 - node * 0.12 + fibre * 0.05;
    return [...sc(col, 0.8 + round * 0.25), h, clamp(0.34 + node * 0.3 + (1 - round) * 0.25 + (fib[i] - 0.5) * 0.08, 0, 1)];
  }, { strength: 5 });
}
function hollowBlock() {
  const r = rng(202), grain = noise(S, S, 2, r), agg = noise(S, S, 5, r), big = fbm(S, S, 64, 3, r), chip = noise(S, S, 18, r);
  const base = hexRGB('#a8adb0');
  return pbr((x, y) => {
    const i = y * S + x, u = x / S, v = y / S;
    const core = (cx) => { const dx = Math.abs(u - cx) / 0.16, dy = Math.abs(v - 0.52) / 0.24; return Math.max(dx, dy) < 1 ? 1 - Math.max(0, Math.max(dx, dy) - 0.85) / 0.15 : 0; };
    const hole = Math.max(core(0.29), core(0.71));
    const edge = Math.min(u, v, 1 - u, 1 - v), chipped = edge < 0.06 && chip[i] > 0.62;
    const spk = agg[i] > 0.7 ? 0.8 : agg[i] < 0.22 ? 1.12 : 1;
    let col = sc(base, (0.92 + (big[i] - 0.5) * 0.18 + (grain[i] - 0.5) * 0.14) * spk);
    if (hole > 0) col = sc(col, lerp(1, 0.22, clamp(hole * 1.2, 0, 1)) * (0.8 + v * 0.3)); // the dark core, lit a little from above
    if (chipped) col = sc(col, 1.08);
    const h = -hole * 1.4 + grain[i] * 0.18 + (agg[i] - 0.5) * 0.3 - (chipped ? 0.5 : 0);
    return [...col, h, 0.9 - hole * 0.1];
  }, { strength: 3.2 });
}
function ladrilyo() {
  const r = rng(303), grain = noise(S, S, 2, r), fleck = noise(S, S, 3, r), tone = Array.from({ length: 24 }, () => r());
  const brick = hexRGB('#b8452c'), burnt = hexRGB('#7a2a1a'), pale = hexRGB('#d6784e'), mortar = hexRGB('#cfc7b8');
  return pbr((x, y) => {
    const i = y * S + x, v = y / S, u = x / S, row = Math.floor(v * 3), fy = v * 3 - row;
    const off = (row % 2) * 0.5, bu = u + off, col = Math.floor(bu * 2), fx = bu * 2 - col;
    const j = 0.045, joint = fy < j || fy > 1 - j || fx < j * 0.6 || fx > 1 - j * 0.6;
    if (joint) { const g = 0.85 + (grain[i] - 0.5) * 0.3; return [...sc(mortar, g), -0.9 + grain[i] * 0.2, 0.95]; }
    const t = tone[(row * 5 + col) % 24];
    let c = mix3(brick, t > 0.7 ? pale : burnt, t > 0.7 ? (t - 0.7) * 1.6 : (0.7 - t) * 0.5);
    c = sc(c, 0.9 + (grain[i] - 0.5) * 0.2);
    if (fleck[i] > 0.8) c = sc(c, 0.65);
    const bev = Math.min(fy, 1 - fy, fx * 0.5, (1 - fx) * 0.5) / j;
    return [...c, Math.min(1, bev) * 0.6 + (grain[i] - 0.5) * 0.12, 0.82];
  }, { strength: 3 });
}
function yero() {
  const r = rng(404), scratch = noise(S, S, 3, r), rust = fbm(S, S, 32, 3, r), fine = noise(S, S, 2, r);
  const paint = hexRGB('#5fb0c6'), zinc = hexRGB('#c9cfd2'), rustc = hexRGB('#8a4a22');
  return pbr((x, y) => {
    const i = y * S + x, u = x / S, v = y / S;
    const rid = Math.sin(u * Math.PI * 2 * 5), shade = 0.82 + rid * 0.16;
    const worn = scratch[(y * 3 % S) * S + x] > 0.8 && fine[i] > 0.4; // scratched through to the zinc
    const edge = Math.min(u, v, 1 - u, 1 - v), rusty = Math.max(0, rust[i] - 0.6) * 3 * (edge < 0.12 ? 1 : 0.25);
    let c = worn ? zinc : sc(paint, shade);
    c = mix3(c, rustc, clamp(rusty, 0, 1));
    const screw = [[0.2, 0.12], [0.8, 0.12], [0.2, 0.88], [0.8, 0.88]].some(([a, b]) => (u - a) ** 2 + (v - b) ** 2 < 0.0009);
    if (screw) c = hexRGB('#dfe4e6');
    return [...c, rid * 0.9 + (screw ? 0.8 : 0), worn ? 0.25 : clamp(0.32 + rusty * 0.6 + (fine[i] - 0.5) * 0.1, 0, 1)];
  }, { strength: 4 });
}
function plywood() {
  const r = rng(505), fig = fbm(S, S, 48, 4, r), fine = noise(S, S, 2, r), warp = fbm(S, S, 96, 2, r);
  const light = hexRGB('#e6c79a'), mid = hexRGB('#cfa36c'), dark = hexRGB('#a8784a');
  return pbr((x, y) => {
    const i = y * S + x, u = x / S, v = y / S;
    const ring = Math.sin((v * 9 + fig[i] * 3.2 + warp[i] * 2) * Math.PI * 2) * 0.5 + 0.5; // the wide, wavy figure of a rotary-cut veneer
    let c = mix3(light, mid, ring * 0.7);
    c = mix3(c, dark, Math.max(0, ring - 0.85) * 3);
    c = sc(c, 0.94 + (fine[(y * 5 % S) * S + x] - 0.5) * 0.12);
    // a football patch where a knot was cut out
    const pu = (u - 0.68) / 0.12, pv = (v - 0.3) / 0.07, patch = pu * pu + pv * pv < 1, rim = Math.abs(pu * pu + pv * pv - 1) < 0.12;
    if (patch) c = sc(mix3(light, mid, 0.3), 1.05);
    if (rim) c = sc(dark, 0.9);
    return [...c, ring * 0.12 + (rim ? -0.4 : 0) + (fine[i] - 0.5) * 0.05, 0.72 - ring * 0.08];
  }, { strength: 2.5 });
}
function baldosa() {
  const r = rng(606), fine = noise(S, S, 2, r), crackle = noise(S, S, 4, r);
  const blue = hexRGB('#2f5fc4'), deep = hexRGB('#1c3a86'), cream = hexRGB('#f2ead2'), grout = hexRGB('#bdb6a6'), gold = hexRGB('#e8b43a');
  return pbr((x, y) => {
    const i = y * S + x, u = x / S, v = y / S, g = 0.05;
    if (u < g || v < g || u > 1 - g || v > 1 - g) return [...sc(grout, 0.9 + fine[i] * 0.2), -1, 0.85];
    const du = u - 0.5, dv = v - 0.5, rad = Math.hypot(du, dv), a = Math.atan2(dv, du);
    const petal = rad < 0.34 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2))); // a four-petal flower
    const ring = Math.abs(rad - 0.08) < 0.03, corner = [[0, 0], [1, 0], [0, 1], [1, 1]].some(([a2, b]) => Math.hypot(u - a2, v - b) < 0.2);
    const border = Math.min(u, v, 1 - u, 1 - v) < 0.1;
    let c = mix3(blue, deep, rad * 0.9);
    if (border) c = deep;
    if (corner) c = cream;
    if (petal) c = cream;
    if (rad < 0.06 || ring) c = gold;
    c = sc(c, 0.97 + (fine[i] - 0.5) * 0.06);
    return [...c, 0.4 + (crackle[i] - 0.5) * 0.04, 0.12];
  }, { strength: 1.5 });
}
function adobe() {
  const r = rng(707), pore = noise(S, S, 3, r), big = fbm(S, S, 48, 4, r), fine = noise(S, S, 2, r), chis = noise(S, S, 10, r);
  const tuff = hexRGB('#d6823a'), sand = hexRGB('#e9b06a'), burnt = hexRGB('#9a5424');
  return pbr((x, y) => {
    const i = y * S + x, u = x / S, v = y / S;
    let c = mix3(tuff, big[i] > 0.5 ? sand : burnt, Math.abs(big[i] - 0.5) * 1.3);
    const pit = pore[i] > 0.72, speck = fine[i] > 0.86;
    if (pit) c = sc(c, 0.55);
    if (speck) c = sc(c, 1.15);
    const cut = Math.sin((u + v * 0.3) * 60 + chis[i] * 6) * 0.5 + 0.5; // chisel marks
    return [...sc(c, 0.9 + cut * 0.08 + (fine[i] - 0.5) * 0.1), -(pit ? 1 : 0) * 0.8 + cut * 0.25 + big[i] * 0.4, 0.96];
  }, { strength: 3.5 });
}
function semento() {
  // freshly poured, trowelled smooth: pale grey, a sheen where it's still wet
  const r = rng(909), big = fbm(S, S, 64, 3, r), fine = noise(S, S, 2, r), trowel = fbm(S, S, 24, 2, r);
  const grey = hexRGB('#a4a8a6');
  return pbr((x, y) => { const i = y * S + x, sw = Math.sin((x + y) * 0.05 + trowel[i] * 6) * 0.5 + 0.5; return [...sc(grey, 0.92 + (big[i] - 0.5) * 0.12 + (fine[i] - 0.5) * 0.06), sw * 0.15 + fine[i] * 0.08, 0.5 - sw * 0.25]; }, { strength: 2 });
}
// the Inspector's stamp: grey block, a red REJECTED stamp across it
function rejected() {
  const base = semento(), c = canvas(S, S), x = c.getContext('2d');
  x.drawImage(base.map.image, 0, 0, S, S);
  x.fillStyle = 'rgba(120,30,20,0.25)'; x.fillRect(0, 0, S, S);
  x.save(); x.translate(S / 2, S / 2); x.rotate(-0.35);
  x.strokeStyle = '#d42a1e'; x.lineWidth = S * 0.05; x.strokeRect(-S * 0.44, -S * 0.15, S * 0.88, S * 0.3);
  x.fillStyle = '#d42a1e'; x.font = `900 ${Math.round(S * 0.17)}px "Barlow Condensed", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('REJECTED', 0, S * 0.01);
  x.restore();
  return { map: toTex(c), normalMap: base.normalMap, roughnessMap: base.roughnessMap };
}
function putik() {
  const r = rng(808), lump = fbm(S, S, 40, 4, r), fine = noise(S, S, 2, r), peb = noise(S, S, 9, r), wet = fbm(S, S, 64, 3, r);
  const mud = hexRGB('#4a3220'), dark = hexRGB('#2a1c10'), clay = hexRGB('#6a4a2c');
  return pbr((x, y) => {
    const i = y * S + x;
    let c = mix3(mud, lump[i] > 0.5 ? clay : dark, Math.abs(lump[i] - 0.5) * 1.5);
    const pebble = peb[i] > 0.8, w = clamp((wet[i] - 0.3) * 2.5, 0, 1);
    if (pebble) c = [128, 118, 104];
    c = sc(c, 1 - w * 0.25);
    return [...c, lump[i] * 1.2 + (pebble ? 0.5 : 0) + (fine[i] - 0.5) * 0.1, pebble ? 0.45 : lerp(0.45, 0.05, w)];
  }, { strength: 4 });
}

// ---------- the materials ----------
// board value → material (the view tracks which way each bamboo cell lies, for kawayanV)
export const KEYS = { 1: 'kawayan', 2: 'hollow', 3: 'ladrilyo', 4: 'yero', 5: 'plywood', 6: 'baldosa', 7: 'adobe', 8: 'putik', 9: 'semento', 10: 'rejected' }; // and 'kawayanV': bamboo standing
export const TYPE_KEY = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
// what each material sounds like and sheds when it breaks: [sound, debris colour, dust colour]
export const FEEL = {
  kawayan: ['bamboo', '#c9c768', '#d8d2a8'], hollow: ['block', '#9aa0a4', '#c8c6c0'], ladrilyo: ['brick', '#b04a30', '#d6a58a'], yero: ['metal', '#6fb3c4', '#c8d4d8'],
  plywood: ['wood', '#d8b07a', '#e6d2b0'], semento: ['block', '#9a9d9c', '#d0d0cc'], baldosa: ['tile', '#3a6ad0', '#e8e4dc'], adobe: ['stone', '#d4843e', '#e6b886'], putik: ['mud', '#5a4028', '#7a6048'], rejected: ['block', '#c8322a', '#e0b0a8'],
};

// Instanced blocks get a per-instance glow (the piece in hand, the lock warning, a row about to go).
function withGlow(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aGlow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow;');
    sh.fragmentShader = 'varying float vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * min(vGlow, 1.0) * 0.9 + vec3(1.0, 0.86, 0.6) * max(vGlow - 1.0, 0.0);');
  };
  m.customProgramCacheKey = () => 'glow';
  return m;
}

export function makeMaterials() {
  const out = {};
  const std = (t, o = {}) => withGlow(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, ...o }));
  const k = kawayan();
  out.kawayan = std(k, { normalScale: new THREE.Vector2(1, 1), envMapIntensity: 1.1 });
  out.kawayanV = std({ map: rot90(k.map), normalMap: rot90(k.normalMap), roughnessMap: rot90(k.roughnessMap) }, { envMapIntensity: 1.1 });
  out.hollow = std(hollowBlock());
  out.ladrilyo = std(ladrilyo());
  out.yero = std(yero(), { metalness: 0.55, envMapIntensity: 1.3 });
  out.plywood = std(plywood());
  const b = baldosa();
  out.baldosa = withGlow(new THREE.MeshPhysicalMaterial({ map: b.map, normalMap: b.normalMap, roughnessMap: b.roughnessMap, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 }));
  out.adobe = std(adobe());
  out.putik = std(putik(), { envMapIntensity: 1.8 });
  out.semento = std(semento());
  out.rejected = std(rejected(), { emissive: '#ff2a10', emissiveIntensity: 0.08 });
  return out;
}

// A block: bevelled, a little smaller than its cell so the joints show.
export function blockGeometry() {
  const g = new RoundedBoxGeometry(CS * 0.97, CS * 0.97, CS * 0.86, 2, CS * 0.075);
  return g;
}
// A broken piece of one: a lumpy chunk (flat-shaded, like a fracture).
export function chunkGeometry() {
  const g = new THREE.DodecahedronGeometry(1, 0).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// The ghost: a glowing outline with a faint fill, in the piece's colour.
export function ghostTexture() {
  const c = canvas(128, 128), x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, 0, 128, 128);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0.0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 7; x.strokeRect(5, 5, 118, 118);
  x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 3; x.strokeRect(13, 13, 102, 102);
  return toTex(c);
}
export const GHOST_COLORS = { I: '#d9e86a', O: '#e4ecf0', T: '#ff7a5a', S: '#7fe0f4', Z: '#ffd79a', J: '#6f9cff', L: '#ffa24a' };
