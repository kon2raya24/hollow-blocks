// The construction site, built in code: a concrete slab in a barangay, the well (a steel-and-bamboo
// scaffold with a dark shade net behind the pieces), the plywood boards for the hold, the queue and the
// tally, the house going up next door floor by floor, the materials lying about (cement, sand, gravel,
// hollow blocks, rebar, a mixer, a wheelbarrow, a drum of water), and the street behind: houses, a
// sari-sari store, electric poles and their wires, coconut trees. Real scans (envpack.mjs) replace the
// stand-ins and dress the big surfaces when they load.
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/three-extra.min.js';
import * as T from './tex.mjs';
import { CS } from './blocks.mjs';

export const BASE_Y = 0.2; // the bottom of the well: on a sole board on the slab
export const WELL = { x0: -2.5, x1: 2.5, y0: BASE_Y, y1: BASE_Y + 20 * CS, top: BASE_Y + 22 * CS };
const TAU = Math.PI * 2;
let rs = 20260930;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const MATS = new Map();
export const mat = (color, o = {}) => { const key = color + JSON.stringify(o); if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o })); return MATS.get(key); };
// `surface` names the scanned material that can replace this one (envpack.mjs), and the size it covers
const tag = (m, kind, w, h, extra = {}) => { m.userData.surface = { kind, w, h, ...extra }; return m; };
const standIn = (m, id) => { m.userData.standIn = id; return m; }; // a real prop replaces it once loaded
export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true, s = 1 } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.setScalar(s);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
const box = (w, h, d, m, o) => mesh(new THREE.BoxGeometry(w, h, d), m, o);
const cyl = (r0, r1, h, m, o, seg = 10) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, o);
// a pole between two points
function pole(a, b, r, m, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  const o = mesh(new THREE.CylinderGeometry(r, r, l, seg), m);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Merge every static mesh that shares a material into one, so the site costs a few dozen draws.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), rel = new THREE.Matrix4();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep) return;
    const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const parts = list.map((m) => { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
    const geo = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    if (!geo) continue;
    const merged = new THREE.Mesh(geo, list[0].material);
    merged.castShadow = list[0].castShadow; merged.receiveShadow = list[0].receiveShadow;
    merged.userData.standIn = list[0].userData.standIn;
    for (const m of list) m.parent.remove(m);
    root.add(merged);
  }
}

// ---------- painted surfaces ----------
function netTexture() {
  // the shade net behind the well: a dark knit you can half see through (light and the wall behind show
  // between the threads), and chalk lines on each cell, the way a mason marks his courses
  const PXC = 48, W = 10 * PXC, H = 22 * PXC, c = T.canvas(W, H), x = c.getContext('2d'), r = T.rng(77);
  const img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const p = (j * W + i) * 4, knot = (i % 3 === 0) || (j % 3 === 0), edge = Math.min(i, W - 1 - i) / W;
    const a = knot ? 1 : 0.978, v = knot ? 1.25 : 1; // blended in linear light, so even a little open weave shows a lot
    img.data[p] = 16 * v; img.data[p + 1] = 30 * v; img.data[p + 2] = 23 * v; img.data[p + 3] = 255 * Math.min(0.95, a + (edge < 0.06 ? 0.15 : 0));
  }
  x.putImageData(img, 0, 0);
  const top = 2 * PXC; // the two hidden rows above the play area: no chalk there
  const chalk = (x0, y0, x1, y1) => {
    // a rough stroke: broken, a little wavy, heavier in places
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3);
    for (let k = 0; k < n; k++) { if (r() < 0.12) continue; const t = k / n, px = x0 + (x1 - x0) * t + (r() - 0.5) * 1.2, py = y0 + (y1 - y0) * t + (r() - 0.5) * 1.2; x.fillStyle = `rgba(236,232,218,${0.16 + r() * 0.16})`; x.fillRect(px - 1, py - 1, 2 + r() * 1.5, 2 + r() * 1.5); }
  };
  for (let k = 1; k < 10; k++) chalk(k * PXC, top, k * PXC, H);
  for (let k = 1; k < 20; k++) chalk(0, top + k * PXC, W, top + k * PXC);
  x.strokeStyle = 'rgba(255,190,120,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, top + 1); x.lineTo(W, top + 1); x.stroke(); // the top of the wall
  return T.toTex(c);
}
// A plywood board with a stencilled word, as the crew would spray it.
function boardTex(word, w, h, { color = '#ff9f2a' } = {}) {
  const PX = 160, W = Math.round(w * PX), H = Math.round(h * PX), c = T.canvas(W, H), x = c.getContext('2d');
  const r = T.rng(word.length * 31 + W), n = T.fbm(128, 128, 24, 3, r);
  const base = x.createLinearGradient(0, 0, W, H); base.addColorStop(0, '#caa074'); base.addColorStop(1, '#b88c5e');
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  for (let j = 0; j < H; j += 2) { const k = Math.sin(j * 0.09 + n[((j * 3) % 128) * 128] * 7) * 0.5 + 0.5; x.fillStyle = `rgba(120,80,40,${k * 0.16})`; x.fillRect(0, j, W, 2); }
  // dark paint where the pieces sit, so they read against it
  x.fillStyle = 'rgba(20,16,18,0.82)'; x.beginPath(); x.roundRect(W * 0.06, H * 0.2, W * 0.88, H * 0.74, 10); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 3; x.stroke();
  x.font = `italic 900 ${Math.round(H * 0.12)}px "Barlow Condensed", "Baloo 2", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = Math.round(H * 0.02); x.strokeStyle = 'rgba(30,20,16,0.85)'; x.lineJoin = 'round'; x.strokeText(word, W / 2, H * 0.11, W * 0.9);
  x.fillStyle = color; x.fillText(word, W / 2, H * 0.11, W * 0.9);
  for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(255,159,42,${Math.random() * 0.3})`; x.fillRect(W / 2 + (Math.random() - 0.5) * W * 0.6, H * 0.11 + (Math.random() - 0.5) * H * 0.12, 1.5, 1.5); } // overspray
  for (const [a, b] of [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]]) { x.fillStyle = '#6a6a6a'; x.beginPath(); x.arc(W * a, H * b, 4, 0, TAU); x.fill(); } // nails
  return T.toTex(c);
}
function sackTex() {
  const c = T.canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#d9cfb6'; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(120,110,90,${Math.random() * 0.12})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  x.fillStyle = '#2f5aa8'; x.fillRect(0, 40, 256, 70);
  x.fillStyle = '#fff'; x.font = '900 34px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillText('PORTLAND', 128, 72); x.font = '800 24px "Barlow Condensed", sans-serif'; x.fillText('CEMENT · 40 KG', 128, 100);
  x.fillStyle = '#c02a2a'; x.fillRect(0, 118, 256, 10);
  x.fillStyle = 'rgba(160,160,160,0.5)'; for (let k = 0; k < 30; k++) x.fillRect(Math.random() * 256, 150 + Math.random() * 100, 10 + Math.random() * 30, 6 + Math.random() * 10); // cement dust
  return T.toTex(c);
}
function sandTex(color) {
  const r = T.rng(color.length * 7 + 3), n = T.noise(256, 256, 2, r), big = T.fbm(256, 256, 48, 3, r), [cr, cg, cb] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  return T.paint(256, 256, (i, j) => { const k = 0.85 + (n[j * 256 + i] - 0.5) * 0.35 + (big[j * 256 + i] - 0.5) * 0.2; return [cr * k, cg * k, cb * k, n[j * 256 + i] * 0.6 + big[j * 256 + i]]; }, { repeat: [3, 3], strength: 3 });
}
function tarpTex() {
  const c = T.canvas(256, 128), x = c.getContext('2d');
  x.fillStyle = '#2f6fd6'; x.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 256; k += 4) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(k, 0, 2, 128); }
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 256, 18); x.fillRect(0, 110, 256, 18);
  x.fillStyle = '#fff'; x.font = 'italic 900 30px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillText('BAWAL PUMASOK', 128, 56); x.font = '800 18px "Barlow Condensed", sans-serif'; x.fillText('HARD HAT AREA · MAG-INGAT', 128, 86);
  return T.toTex(c);
}

// ---------- the pieces of the site ----------
export function buildSite(scene, { low = false } = {}) {
  const world = new THREE.Group(); world.name = 'site'; scene.add(world);
  const add = (...o) => world.add(...o);
  const dyn = new THREE.Group(); dyn.name = 'site dynamic'; scene.add(dyn); // things that move or change, never merged

  // the ground: packed dirt and gravel around the slab, a road behind
  const dirtT = T.dirt(7, { size: 512, repeat: [40, 40] });
  const groundM = tag(new THREE.MeshStandardMaterial({ map: dirtT.map, normalMap: dirtT.normalMap, roughness: 1, color: '#b8a48a' }), 'ground', 220, 220);
  const ground = mesh(new THREE.PlaneGeometry(220, 220), groundM, { rx: -Math.PI / 2, y: -0.16, cast: false }); add(ground);
  const roadT = T.asphalt(9, { size: 512, repeat: [30, 2] });
  const roadM = tag(new THREE.MeshStandardMaterial({ map: roadT.map, normalMap: roadT.normalMap, roughness: 0.95, color: '#9a968e' }), 'road', 120, 7);
  add(mesh(new THREE.PlaneGeometry(120, 7), roadM, { rx: -Math.PI / 2, y: -0.14, z: -14.5, cast: false }));
  // the slab
  const slabT = T.concrete(11, '#b9b3a8', { size: 512, repeat: [5, 3], grime: 0.4 });
  const slabM = tag(new THREE.MeshStandardMaterial({ map: slabT.map, normalMap: slabT.normalMap, roughness: 0.9 }), 'slab', 20, 12);
  add(box(20, 0.3, 12, slabM, { y: -0.15, z: -0.5, cast: false }));
  const curbM = mat('#8f8a80', { roughness: 0.95 });
  add(box(20.2, 0.08, 0.2, curbM, { y: 0.0, z: 5.55 })); // the formwork edge along the front

  // ---------- the well: steel standards, bamboo ledgers and braces, lashings, the net ----------
  const steel = mat('#9aa4aa', { roughness: 0.38, metalness: 0.85 });
  const bambooT = T.rattan(21); bambooT.map.wrapS = bambooT.map.wrapT = THREE.RepeatWrapping; bambooT.map.repeat.set(1, 8);
  const bamboo = new THREE.MeshStandardMaterial({ map: bambooT.map, normalMap: bambooT.normalMap, color: '#d8cf7a', roughness: 0.5 });
  const rope = mat('#6a4a2a', { roughness: 1 });
  const { x0, x1, top } = WELL, xs = [x0 - 0.22, x1 + 0.22], zs = [0.36, -0.42], H = top + 0.9;
  for (const x of xs) for (const z of zs) {
    add(pole(V(x, 0, z), V(x, H, z), 0.032, steel, 10));
    add(box(0.2, 0.012, 0.2, steel, { x, y: 0.006, z })); // base plate
  }
  // side ledgers (front to back) every metre, and bamboo braces across each side
  for (const x of xs) {
    for (let y = 1; y < H; y += 2) { add(pole(V(x, y, zs[0] + 0.05), V(x, y, zs[1] - 0.05), 0.028, bamboo)); for (const z of zs) add(mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10), rope, { x, y, z, rx: Math.PI / 2 })); }
    for (let y = 1; y + 2 < H; y += 2) add(pole(V(x, y, zs[0]), V(x, y + 2, zs[1]), 0.024, bamboo));
  }
  // behind the net: long bamboo ledgers
  for (let y = 1; y < H; y += 2) add(pole(V(xs[0] - 0.3, y, zs[1] - 0.06), V(xs[1] + 0.3, y, zs[1] - 0.06), 0.03, bamboo));
  // the sole board the well stands on, and the top: a steel ledger, a plank platform and a pulley for the hoist
  const plankT = T.planks(23, { size: 256, repeat: [2, 1], color: '#b08450' });
  const plank = new THREE.MeshStandardMaterial({ map: plankT.map, normalMap: plankT.normalMap, roughness: 0.85 });
  add(box(x1 - x0 + 0.9, BASE_Y, 0.9, plank, { y: BASE_Y / 2, z: -0.03 }));
  add(pole(V(xs[0] - 0.2, top + 0.35, zs[0]), V(xs[1] + 0.2, top + 0.35, zs[0]), 0.03, steel));
  add(box(x1 - x0 + 1.2, 0.06, 1.1, plank, { y: top + 0.42, z: -0.03 }));
  add(box(x1 - x0 + 1.2, 0.18, 0.03, plank, { y: top + 0.54, z: 0.52 })); // toe board
  const pulley = new THREE.Group(); pulley.position.set(0.6, top + 1.25, 0.4);
  pulley.add(mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 18), steel), mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), steel, { rx: Math.PI / 2 }));
  add(pulley, pole(V(0.6, top + 0.45, 0.4), V(0.6, top + 1.1, 0.4), 0.025, steel));
  // the shade net
  const net = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 22 * CS), new THREE.MeshStandardMaterial({ map: netTexture(), roughness: 1, color: '#b8c8bc', transparent: true, depthWrite: false }));
  net.renderOrder = 1;
  // behind the net: the wall this scaffold is for, half built (hollow blocks to about head height, stepped
  // where the last courses stopped), its two columns standing up with their rebar
  {
    const wallT = T.concrete(81, '#a8a69e', { size: 128, repeat: [1, 1], grime: 0.2 });
    const wallM = new THREE.MeshStandardMaterial({ map: wallT.map, normalMap: wallT.normalMap, roughness: 0.95 });
    const list = [];
    for (let c = 0; c < 26; c++) for (let k = 0; k < 14; k++) { const bx = -2.6 + k * 0.4 + (c % 2) * 0.2; if (bx > 2.6) continue; const stop = 18 + Math.round(Math.sin(k * 1.3) * 3 + (k > 8 ? 4 : 0)); if (c > stop) continue; list.push([bx, 0.1 + c * 0.2]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.39, 0.19, 0.15), wallM, list.length), m4 = new THREE.Matrix4();
    list.forEach(([bx, by], i) => { m4.makeTranslation(bx, by, -1.05); im.setMatrixAt(i, m4); });
    im.receiveShadow = true; im.castShadow = false; world.add(im);
    const colM = mat('#b0aca4', { roughness: 0.9 }), rebarM = mat('#8a4a28', { roughness: 0.55, metalness: 0.6 });
    for (const cx of [-2.85, 2.85]) { add(box(0.32, 9.4, 0.32, colM, { x: cx, y: 4.7, z: -1.05, cast: false })); for (const [a2, b2] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) add(cyl(0.012, 0.012, 1.1, rebarM, { x: cx + a2, y: 9.95, z: -1.05 + b2, cast: false }, 5)); }
    add(box(5.9, 0.3, 0.3, colM, { y: 5.6, z: -1.05, cast: false })); // a tie beam, poured
  }
  net.position.set(0, BASE_Y + 11 * CS, -0.3); net.receiveShadow = true; net.userData.keep = true; add(net);
  // the danger light on top: an amber beacon that spins when the wall gets high
  const beacon = new THREE.Group(); beacon.position.set(-2.2, top + 0.62, 0.3);
  const beaconGlass = new THREE.MeshStandardMaterial({ color: '#ff9a2a', emissive: '#ff6a00', emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.9 });
  beacon.add(cyl(0.09, 0.1, 0.06, mat('#222'), { y: 0.03 }), mesh(new THREE.SphereGeometry(0.085, 14, 10, 0, TAU, 0, Math.PI / 2), beaconGlass, { y: 0.06 }));
  dyn.add(beacon);
  const beaconLight = new THREE.PointLight('#ff7a1a', 0, 9, 1.6); beaconLight.position.set(-2.2, top + 0.8, 0.5); dyn.add(beaconLight);

  // ---------- the boards: hold, tally and queue ----------
  const boards = {};
  const mkBoard = (id, word, w, h) => {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), [plank, plank, plank, plank, new THREE.MeshStandardMaterial({ map: boardTex(word, w, h), roughness: 0.85 }), plank]);
    face.castShadow = true; face.receiveShadow = true; g.add(face);
    // two outrigger pipes back to the standards
    g.userData.pipes = [0, 1].map(() => { const p = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), steel); dyn.add(p); return p; });
    g.userData.w = w; g.userData.h = h; g.userData.word = word;
    dyn.add(g); boards[id] = g;
    return g;
  };
  mkBoard('hold', 'IMBAK', 2.1, 2.2); mkBoard('next', 'SUSUNOD', 2.1, 6.9);
  // on a tall phone: a strip on the platform above the well instead
  mkBoard('holdS', 'IMBAK', 1.7, 1.55); mkBoard('nextS', 'SUSUNOD', 3.45, 1.55);
  // the tally: a painted board the foreman writes on in chalk, redrawn when the numbers change
  const tallyC = T.canvas(420, 440), tallyTex = T.toTex(tallyC);
  const tally = new THREE.Group();
  const tallyFace = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 0.04), [plank, plank, plank, plank, new THREE.MeshStandardMaterial({ map: tallyTex, roughness: 0.95 }), plank]);
  tallyFace.castShadow = true; tallyFace.receiveShadow = true; tally.add(tallyFace);
  tally.userData.pipes = [0, 1].map(() => { const p = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), steel); dyn.add(p); return p; });
  dyn.add(tally); boards.tally = tally;
  let tallyKey = '';
  function drawTally(rows) {
    const key = JSON.stringify(rows);
    if (key === tallyKey) return;
    tallyKey = key;
    const x = tallyC.getContext('2d'), W = tallyC.width, Hh = tallyC.height;
    x.fillStyle = '#1e2a24'; x.fillRect(0, 0, W, Hh);
    for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(Math.random() * W, Math.random() * Hh, 3, 2); }
    x.strokeStyle = '#a07a4a'; x.lineWidth = 16; x.strokeRect(8, 8, W - 16, Hh - 16);
    x.fillStyle = '#ffd23f'; x.font = 'italic 900 50px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillText('TALA', W / 2, 66);
    x.font = '700 38px "Baloo 2", sans-serif';
    rows.forEach(([k, v], i) => { const y = 128 + i * 64; x.textAlign = 'left'; x.fillStyle = 'rgba(240,236,220,0.78)'; x.fillText(k, 34, y); x.textAlign = 'right'; x.fillStyle = '#fffbe8'; x.fillText(String(v), W - 34, y); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(30, y + 16, W - 60, 2); });
    tallyTex.needsUpdate = true;
  }
  // Where the boards go: beside the well on a wide screen; narrower and closer on a tall phone.
  function layoutBoards(compact) {
    const show = (g, on) => { g.visible = on; for (const p of g.userData.pipes) p.visible = on; };
    for (const k of ['hold', 'next', 'tally']) show(boards[k], !compact);
    for (const k of ['holdS', 'nextS']) show(boards[k], compact);
    const place = (g, cx, cy, w, h, pipes = true) => {
      g.position.set(cx, cy, pipes ? 0.18 : 0.56); g.scale.set(w / g.children[0].geometry.parameters.width, h / g.children[0].geometry.parameters.height, 1);
      const side = cx < 0 ? 1 : -1, sx = cx + side * w / 2, tx = side > 0 ? xs[0] : xs[1];
      g.userData.pipes.forEach((p, i) => { p.visible = pipes && g.visible; const y = cy + (i ? -1 : 1) * h * 0.3, a = V(sx - side * 0.1, y, 0.14), b = V(tx, y, 0.36), d = b.clone().sub(a); p.position.copy(a).addScaledVector(d, 0.5); p.scale.set(1, d.length(), 1); p.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); });
      g.userData.rect = { cx, cy, w, h, row: !pipes };
    };
    const yTop = WELL.y1;
    if (compact) {
      // hold and next side by side, standing on the platform over the well
      const cy = top + 0.5 + 0.78;
      place(boards.holdS, x0 + 0.85 - 0.12, cy, 1.7, 1.55, false);
      place(boards.nextS, x1 - 1.725 + 0.12, cy, 3.45, 1.55, false);
      boards.hold.userData.rect = boards.holdS.userData.rect; boards.next.userData.rect = boards.nextS.userData.rect;
      return { x0: x0 - 0.35, x1: x1 + 0.35, yTop: cy + 0.8 };
    }
    const bw = 2.1, gap = 0.36, lx = x0 - gap - bw / 2 - 0.22, rx = x1 + gap + bw / 2 + 0.22;
    place(boards.hold, lx, yTop - 1.1, bw, 2.2);
    place(boards.tally, lx, yTop - 3.55, bw, 2.3);
    place(boards.next, rx, yTop - 3.45, bw, 6.9);
    return { lx, rx, bw, x0: lx - bw / 2, x1: rx + bw / 2, yTop: top + 0.35 };
  }

  // ---------- the house going up next door ----------
  const HOUSE_AT = { x: 12.2, z: -7.2, w: 8.4, d: 5.4 };
  const house = buildHouse(dyn, HOUSE_AT);

  // ---------- materials lying about ----------
  const props = new THREE.Group(); props.name = 'stand-in props'; add(props);
  // cement sacks, piled on a pallet
  const sackM = standIn(new THREE.MeshStandardMaterial({ map: sackTex(), roughness: 0.95 }), 'cement_bag');
  const palletM = mat('#8a6a44', { roughness: 0.9 });
  const sackGeo = (() => { const g = new THREE.SphereGeometry(1, 16, 10); g.scale(0.34, 0.1, 0.22); return g; })();
  const sacks = (cx, cz, rows, ry) => {
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
    g.add(box(1.3, 0.12, 1.0, palletM, { y: 0.06 }));
    for (let r = 0; r < rows; r++) for (let k = 0; k < 4; k++) { const alt = r % 2, sx = alt ? (k % 2 - 0.5) * 0.46 : (k - 1.5) * 0.3, sz = alt ? (Math.floor(k / 2) - 0.5) * 0.5 : 0; const m = mesh(sackGeo, sackM, { x: sx, y: 0.2 + r * 0.19, z: sz, ry: alt ? 0 : Math.PI / 2 + (rnd() - 0.5) * 0.2 }); m.material = standIn(sackM, 'cement_bag'); g.add(m); }
    props.add(g); return g;
  };
  sacks(-5.1, 2.9, 4, 0.3); sacks(-7.0, 3.4, 2, -0.2);
  // hollow blocks, stacked in a cube the way the truck leaves them
  const chbT = T.concrete(31, '#a8a8a2', { size: 128, repeat: [1, 1], grime: 0.2 });
  const chbM = new THREE.MeshStandardMaterial({ map: chbT.map, normalMap: chbT.normalMap, roughness: 0.95 });
  const chbStack = (cx, cz, nx, ny, nz, ry) => {
    const n = nx * ny * nz, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.39, 0.19, 0.15), chbM, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) for (let c = 0; c < nz; c++) { if (b === ny - 1 && rnd() < 0.3) { m4.makeScale(0, 0, 0); im.setMatrixAt(i++, m4); continue; } q.setFromEuler(e.set(0, ry + (rnd() - 0.5) * 0.04, 0)); m4.compose(V(cx + (a - nx / 2) * 0.4 * Math.cos(ry) + (c - nz / 2) * 0.16 * Math.sin(ry), 0.1 + b * 0.2, cz - (a - nx / 2) * 0.4 * Math.sin(ry) + (c - nz / 2) * 0.16 * Math.cos(ry)), q, V(1, 1, 1)); im.setMatrixAt(i++, m4); }
    im.castShadow = true; im.receiveShadow = true; add(im);
  };
  chbStack(-7.9, 0.6, 3, 5, 6, 0.15); chbStack(6.9, 3.3, 3, 3, 5, -0.4);
  // sand and gravel, in heaps
  const sandT = sandTex('#c9a878'), gravT = sandTex('#8f8a84');
  const heap = (cx, cz, r, h, t, ry = 0) => { const g = new THREE.SphereGeometry(r, 24, 12, 0, TAU, 0, Math.PI / 2); g.scale(1, h / r, 0.8); const m = mesh(g, new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 1 }), { x: cx, y: -0.02, z: cz, ry }); add(m); };
  heap(8.0, 1.2, 1.7, 1.1, sandT, 0.4); heap(-9.4, -1.6, 1.4, 0.8, gravT);
  // rebar, bundled and lying on timber
  const rebar = mat('#7a4a2e', { roughness: 0.6, metalness: 0.6 });
  for (let k = 0; k < 14; k++) add(pole(V(1.2 + (k % 5) * 0.035, 0.1 + Math.floor(k / 5) * 0.035, 4.1 + (k % 3) * 0.03), V(6.4 + (k % 5) * 0.035, 0.1 + Math.floor(k / 5) * 0.035, 3.7 + (k % 3) * 0.03), 0.012, rebar, 5));
  for (const x of [1.8, 5.8]) add(box(0.12, 0.1, 0.6, palletM, { x, y: 0.05, z: 3.95 }));
  // the concrete mixer (orange drum, yellow frame), and a wheelbarrow
  const mixer = new THREE.Group(); mixer.position.set(5.0, 0, 1.9); mixer.rotation.y = -0.7;
  const drumM = mat('#e8742a', { roughness: 0.45, metalness: 0.3 }), frameM = mat('#e8c02a', { roughness: 0.5, metalness: 0.4 }), tyre = mat('#1a1a1a', { roughness: 0.9 });
  const drumG = new THREE.LatheGeometry([V(0.02, -0.55, 0), V(0.42, -0.45, 0), V(0.52, -0.15, 0), V(0.52, 0.1, 0), V(0.34, 0.45, 0), V(0.22, 0.55, 0)].map((p) => new THREE.Vector2(p.x, p.y)), 20);
  const drum = mesh(drumG, drumM, { y: 1.05, rx: -0.6 }); mixer.add(drum);
  mixer.add(box(0.1, 0.8, 0.1, frameM, { y: 0.55, x: 0.45 }), box(0.1, 0.8, 0.1, frameM, { y: 0.55, x: -0.45 }), box(1.0, 0.08, 0.1, frameM, { y: 0.55 }), box(0.5, 0.35, 0.4, mat('#3a3a3a', { roughness: 0.6, metalness: 0.5 }), { y: 0.45, z: -0.45 }));
  for (const s of [-1, 1]) mixer.add(mesh(new THREE.TorusGeometry(0.22, 0.08, 8, 16), tyre, { x: s * 0.55, y: 0.24, ry: Math.PI / 2 }));
  props.add(mixer);
  const barrow = new THREE.Group(); barrow.position.set(-3.8, 0, 4.1); barrow.rotation.y = 0.9;
  const trayG = new THREE.CylinderGeometry(0.42, 0.3, 0.3, 4, 1, true); trayG.rotateY(Math.PI / 4); trayG.scale(1.25, 1, 0.9);
  barrow.add(mesh(trayG, mat('#2f7a4a', { roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), { y: 0.52 }), mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 14), tyre, { x: 0.62, y: 0.2, ry: Math.PI / 2 }));
  for (const s of [-1, 1]) barrow.add(pole(V(0.62, 0.22, s * 0.05), V(-0.75, 0.62, s * 0.26), 0.02, steel), pole(V(-0.25, 0.4, s * 0.2), V(-0.28, 0.02, s * 0.24), 0.018, steel));
  props.add(barrow);
  // a blue drum of water with a dipper, and a bucket (timba)
  const drumBlue = mat('#2f5fb8', { roughness: 0.5 });
  props.add(cyl(0.29, 0.29, 0.9, standIn(drumBlue, 'Barrel_01'), { x: -6.3, y: 0.45, z: -0.6 }, 18));
  props.add(cyl(0.16, 0.12, 0.26, standIn(mat('#e8384f', { roughness: 0.5 }), 'wooden_bucket_02'), { x: -3.6, y: 0.13, z: 2.2 }, 14));
  // planks, leaning
  for (let k = 0; k < 4; k++) add(box(0.25, 3.2, 0.03, plank, { x: -8.3 + k * 0.3, y: 1.5, z: -2.2, rx: -0.22, rz: (rnd() - 0.5) * 0.05 }));
  // the site hoarding: a tarpaulin on the fence to the left (a hard hat reminder)
  const tarp = new THREE.MeshStandardMaterial({ map: tarpTex(), roughness: 0.8, side: THREE.DoubleSide });
  add(mesh(new THREE.PlaneGeometry(3.4, 1.7), tarp, { x: -11.5, y: 1.2, z: 2.2, ry: 0.95 }));
  for (const [x, z] of [[-12.9, 1.2], [-10.1, 3.2]]) add(pole(V(x, 0, z), V(x, 2.2, z), 0.04, bamboo));

  // ---------- banderitas, raised at each finished-house ceremony ----------
  const FLAGC = ['#e8384f', '#ffd23f', '#2f6fd6', '#3fae5a', '#ff8ae2', '#ff9f43', '#f4f1e6'];
  const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.14, 0, 0, 0.14, 0, 0, 0, -0.3, 0]), 3)); flagGeo.computeVertexNormals();
  const RUNS = [[V(x1 + 0.22, top + 0.9, 0.36), V(house.group.position.x - 4.3, 15.4, house.group.position.z + 2.8)], [V(x0 - 0.22, top + 0.9, 0.36), V(-11, 7.5, -12)], [V(house.group.position.x - 4.3, 15.4, house.group.position.z + 2.8), V(house.group.position.x + 4.3, 15.4, house.group.position.z + 2.8)], [V(-11, 7.5, -12), V(x0 - 0.22, top + 0.9, -0.42)]];
  const PER = 28, bunting = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0.12 }), RUNS.length * PER);
  bunting.count = 0; bunting.castShadow = true; dyn.add(bunting);
  const flagsAt = [];
  RUNS.forEach(([a, b], r) => { for (let k = 0; k < PER; k++) { const f = (k + 0.5) / PER; flagsAt.push({ r, p: V(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 0.9, a.z + (b.z - a.z) * f), ph: k * 0.7 + r }); bunting.setColorAt(r * PER + k, new THREE.Color(FLAGC[(k + r) % FLAGC.length])); } });
  const strings = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#2a2a2a' })); dyn.add(strings);
  const raised = []; // per run: how far up it's been hauled (0..1)
  const m4b = new THREE.Matrix4(), qb = new THREE.Quaternion(), eb = new THREE.Euler(), vb = V(0, 0, 0), one = V(1, 1, 1);
  function raiseBunting() { if (raised.length < RUNS.length) raised.push(0); }
  function resetBunting() { raised.length = 0; }
  function updateBunting(t, dt, wind) {
    bunting.count = 0; const segs = [];
    raised.forEach((k, r) => {
      raised[r] = Math.min(1, k + dt / 1.6); const lift = 1 - (1 - raised[r]) ** 3, drop = (1 - lift) * 6;
      const [a, b] = RUNS[r]; let prev = null;
      for (let s = 0; s <= 16; s++) { const f = s / 16, p = V(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * (0.9 + drop), a.z + (b.z - a.z) * f); if (prev) segs.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p; }
      for (const fl of flagsAt) if (fl.r === r) { qb.setFromEuler(eb.set(Math.sin(t * (2 + wind * 4) + fl.ph) * 0.35 * (0.4 + wind), Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, 0)); m4b.compose(vb.set(fl.p.x, fl.p.y - drop * Math.sin(((flagsAt.indexOf(fl) % PER) + 0.5) / PER * Math.PI), fl.p.z), qb, one); bunting.setMatrixAt(bunting.count++, m4b); }
    });
    bunting.instanceMatrix.needsUpdate = true; bunting.visible = bunting.count > 0;
    strings.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3)); strings.visible = segs.length > 0;
  }

  // ---------- the street behind: houses, a sari-sari store, poles and wires, trees ----------
  const street = buildStreet(world, dyn);

  // the whole site throws and takes shadows; keep the number of draws down
  mergeStatic(world);
  const out = { world, dyn, boards, layoutBoards, drawTally, house, raiseBunting, resetBunting, updateBunting, beacon: { glass: beaconGlass, light: beaconLight, group: beacon }, pulley, net, props, street, slabM, groundM, mixer, drum };
  out.setHouseStyle = (id) => { const h = out.house, done = Math.max(1, h.done), k = Math.max(0, h.courses); dyn.remove(h.group); out.house = buildHouse(dyn, HOUSE_AT, id); out.house.setProgress(done, k / 14); };
  return out;
}

// ---------- the house: floor by floor, the top one rising course by course ----------
// The house styles (picked by rank): walls, frame, windows and the roof for each.
function houseStyle(id) {
  const tex = (fn) => { const t = fn(); return { map: t.map, normalMap: t.normalMap }; };
  if (id === 'kubo') {
    const wall = new THREE.MeshStandardMaterial({ ...tex(() => T.weave(91)), color: '#e8d0a0', roughness: 0.85 }); wall.map.repeat.set(5, 3); if (wall.normalMap) wall.normalMap.repeat.set(5, 3);
    return { wall: () => wall, frame: mat('#c8b46a', { roughness: 0.6 }), win: 'shutter', roof: 'nipa' };
  }
  if (id === 'bato') {
    const stone = new THREE.MeshStandardMaterial({ ...tex(() => T.concrete(93, '#c88a52', { size: 256, repeat: [4, 2], grime: 0.9 })), roughness: 0.95 });
    const wood = new THREE.MeshStandardMaterial({ ...tex(() => T.planks(95, { size: 256, repeat: [1, 3], color: '#8a5a32' })), roughness: 0.8 });
    return { wall: (f) => (f === 0 ? stone : wood), frame: mat('#5a3a22', { roughness: 0.8 }), win: 'capiz', roof: 'tile' };
  }
  if (id === 'condo') {
    const c = T.canvas(256, 256), x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#9ab8d0'); gr.addColorStop(1, '#4a6a8a'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#d8dde0'; for (let k = 0; k <= 4; k++) x.fillRect(k * 64 - 3, 0, 6, 256); x.fillRect(0, 0, 256, 8); x.fillRect(0, 248, 256, 8);
    const t = T.toTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
    const glass = new THREE.MeshStandardMaterial({ map: t, roughness: 0.08, metalness: 0.75, envMapIntensity: 1.5 });
    return { wall: () => glass, frame: mat('#d8d8d4', { roughness: 0.5 }), win: 'none', roof: 'helipad' };
  }
  const paints = ['#f2d8a8', '#bfe0d0', '#f4c6b4', '#d8d4f0', '#f6e7a8'], ps = paints.map((p, f) => new THREE.MeshStandardMaterial({ ...tex(() => T.concrete(50 + f, p, { size: 256, repeat: [3, 2], grime: 0.8 })), roughness: 0.9 }));
  return { wall: (f) => ps[f % ps.length], frame: null, win: 'jalousie', roof: 'deck' };
}

function buildHouse(parent, { x, z, w, d }, styleId = 'apartment') {
  const ST = houseStyle(styleId);
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const FH = 3, FLOORS = 5;
  const conc = new THREE.MeshStandardMaterial({ ...(() => { const t = T.concrete(41, '#b4b0a8', { size: 256, repeat: [2, 2], grime: 0.6 }); return { map: t.map, normalMap: t.normalMap }; })(), roughness: 0.92 });
  const chbT = T.concrete(43, '#a09e98', { size: 128, repeat: [1, 1], grime: 0.15 });
  const chb = new THREE.MeshStandardMaterial({ map: chbT.map, normalMap: chbT.normalMap, roughness: 0.95 });
  const paints = ['#f2d8a8', '#bfe0d0', '#f4c6b4', '#d8d4f0'];
  const rebarM = mat('#8a4a28', { roughness: 0.55, metalness: 0.6 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#2a3440', roughness: 0.15, metalness: 0.3, emissive: '#ffb860', emissiveIntensity: 0 });
  const WH = FH - 0.18, COURSES = 14, winX = (f) => (f === 0 ? [-2.4, 2.4] : [-2.4, 0, 2.4]);
  // the floor going up: real hollow blocks, laid course by course, leaving the window and door openings
  const layout = (f) => {
    const out = [];
    const run = (ax, az, len, alongX, front) => {
      for (let c = 0; c < COURSES; c++) {
        const y = 0.1 + c * 0.2, off = (c % 2) * 0.2;
        for (let s = -len / 2 + 0.2 - off; s < len / 2 - 0.1; s += 0.4) {
          const bx = alongX ? ax + s : ax, bz = alongX ? az : az + s;
          if (front && y > 0.9 && y < 2.2 && winX(f).some((wx) => Math.abs(bx - wx) < 0.75)) continue;
          if (front && f === 0 && y < 2.2 && Math.abs(bx) < 0.6) continue;
          out.push([bx, y, bz, alongX ? 0 : Math.PI / 2, c]);
        }
      }
    };
    run(0, d / 2, w - 0.3, true, true); run(0, -d / 2, w - 0.3, true, false); run(-w / 2, 0, d - 0.3, false, false); run(w / 2, 0, d - 0.3, false, false);
    return out.sort((a, b) => a[4] - b[4]);
  };
  const MAXB = layout(1).length + 20, courses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.39, 0.19, 0.16), chb, MAXB);
  courses.castShadow = true; courses.receiveShadow = true; courses.count = 0; g.add(courses);
  const floors = [];
  for (let f = 0; f < FLOORS; f++) {
    const fg = new THREE.Group(); fg.position.y = f * FH; g.add(fg);
    const paint = ST.wall(f), frame = ST.frame || conc;
    // columns at the corners and the middle of each side
    const cols = [];
    for (const cx of [-w / 2, 0, w / 2]) for (const cz of [-d / 2, d / 2]) { const c = box(0.3, FH, 0.3, frame, { x: cx, y: FH / 2, z: cz }); fg.add(c); cols.push(c); }
    // rebar sticking up from each column top, while this is the floor being built
    const bars = new THREE.Group();
    for (const c of cols) for (const [a, b] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) bars.add(cyl(0.012, 0.012, 0.9, rebarM, { x: c.position.x + a, y: FH + 0.45, z: c.position.z + b }, 5));
    fg.add(bars);
    // the slab on top (a roof deck on the last floor)
    const slab = box(w + 0.4, 0.18, d + 0.4, frame, { y: FH - 0.09 }); fg.add(slab);
    // once the floor is done: plastered, painted walls with windows (dark glass, jalousie slats) and a door
    const done = new THREE.Group(); fg.add(done);
    done.add(box(w - 0.3, WH, 0.16, paint, { y: WH / 2, z: d / 2 }), box(w - 0.3, WH, 0.16, paint, { y: WH / 2, z: -d / 2 }), box(0.16, WH, d - 0.3, paint, { x: -w / 2, y: WH / 2 }), box(0.16, WH, d - 0.3, paint, { x: w / 2, y: WH / 2 }));
    for (const wx of ST.win === 'none' ? [] : winX(f)) {
      if (ST.win === 'jalousie') { done.add(box(1.3, 1.2, 0.05, glassM, { x: wx, y: 1.55, z: d / 2 + 0.07, cast: false })); for (let s = 0; s < 6; s++) done.add(box(1.3, 0.03, 0.04, mat('#dfe6ea', { metalness: 0.6, roughness: 0.3 }), { x: wx, y: 1.02 + s * 0.2, z: d / 2 + 0.1, rx: 0.5, cast: false })); done.add(box(1.45, 0.08, 0.12, mat('#e8e2d6'), { x: wx, y: 0.9, z: d / 2 + 0.1 })); }
      else if (ST.win === 'capiz') { done.add(box(1.5, 1.3, 0.05, mat('#efe6cc', { roughness: 0.4, emissive: '#ffd890', emissiveIntensity: 0.05 }), { x: wx, y: 1.6, z: d / 2 + 0.07, cast: false })); for (let s = 0; s < 4; s++) done.add(box(0.03, 1.3, 0.06, mat('#5a3a22'), { x: wx - 0.56 + s * 0.375, y: 1.6, z: d / 2 + 0.09, cast: false })); for (let s = 0; s < 4; s++) done.add(box(1.5, 0.03, 0.06, mat('#5a3a22'), { x: wx, y: 1.0 + s * 0.4, z: d / 2 + 0.09, cast: false })); }
      else { done.add(box(1.2, 1.1, 0.05, mat('#2a1e14'), { x: wx, y: 1.55, z: d / 2 + 0.07, cast: false })); const sh = box(1.25, 1.1, 0.05, paint, { x: wx, y: 2.2, z: d / 2 + 0.38 }); sh.rotation.x = -1.0; done.add(sh); }
    }
    if (f === 0) done.add(box(1.0, 2.1, 0.06, mat('#6a4a2a', { roughness: 0.7 }), { x: 0, y: 1.05, z: d / 2 + 0.08 }));
    mergeStatic(done); mergeStatic(bars);
    floors.push({ g: fg, bars, slab, done, cols, layout: layout(f) });
  }
  // the roof deck, once the house is done: a parapet, a water tank, a flag
  const deck = new THREE.Group(); deck.position.y = FLOORS * FH; deck.visible = false; g.add(deck);
  deck.add(box(w + 0.4, 0.8, 0.14, conc, { y: 0.4, z: d / 2 + 0.13 }), box(w + 0.4, 0.8, 0.14, conc, { y: 0.4, z: -d / 2 - 0.13 }), box(0.14, 0.8, d + 0.4, conc, { x: w / 2 + 0.13, y: 0.4 }), box(0.14, 0.8, d + 0.4, conc, { x: -w / 2 - 0.13, y: 0.4 }));
  deck.add(cyl(0.6, 0.6, 1.3, mat('#2a4a8a', { roughness: 0.5 }), { x: 2.6, y: 1.4, z: -1 }, 18), box(1.4, 0.7, 1.4, conc, { x: 2.6, y: 0.35, z: -1 }));
  if (ST.roof === 'nipa' || ST.roof === 'tile') {
    // a steep pyramid roof over the top floor instead of a deck
    deck.clear();
    let roofM;
    if (ST.roof === 'nipa') { const c = T.canvas(128, 128), x2 = c.getContext('2d'); x2.fillStyle = '#8a6a3a'; x2.fillRect(0, 0, 128, 128); for (let k = 0; k < 900; k++) { const v = 110 + Math.random() * 70; x2.strokeStyle = `rgb(${v},${v * 0.78 | 0},${v * 0.45 | 0})`; x2.beginPath(); const px = Math.random() * 128, py = Math.random() * 128; x2.moveTo(px, py); x2.lineTo(px + (Math.random() - 0.5) * 3, py + 10); x2.stroke(); } const t = T.toTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); roofM = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); }
    else roofM = mat('#a8442a', { roughness: 0.7 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.6, ST.roof === 'nipa' ? 4 : 2.6, 4, 1), roofM); cone.rotation.y = Math.PI / 4; cone.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414); cone.position.y = (ST.roof === 'nipa' ? 4 : 2.6) / 2; cone.castShadow = true; deck.add(cone);
  } else if (ST.roof === 'helipad') {
    const c = T.canvas(256, 256), x2 = c.getContext('2d'); x2.fillStyle = '#3a3c40'; x2.fillRect(0, 0, 256, 256); x2.strokeStyle = '#ffd23f'; x2.lineWidth = 10; x2.beginPath(); x2.arc(128, 128, 100, 0, TAU); x2.stroke(); x2.fillStyle = '#fff'; x2.font = '900 150px "Barlow Condensed", sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('H', 128, 136);
    deck.add(mesh(new THREE.PlaneGeometry(d - 0.2, d - 0.2), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.8 }), { y: 0.03, x: -1.2, rx: -Math.PI / 2, cast: false }));
  }
  const flag = new THREE.Group(); flag.position.set(ST.roof === 'nipa' || ST.roof === 'tile' ? w / 2 + 0.4 : -3.4, ST.roof === 'nipa' || ST.roof === 'tile' ? -0.2 : 0, 1.6); deck.add(flag);
  flag.add(cyl(0.025, 0.025, 3.2, mat('#dddddd', { metalness: 0.6, roughness: 0.3 }), { y: 1.6 }, 8));
  const flagC = T.canvas(120, 60), fx = flagC.getContext('2d');
  fx.fillStyle = '#0038a8'; fx.fillRect(0, 0, 120, 30); fx.fillStyle = '#ce1126'; fx.fillRect(0, 30, 120, 30); fx.fillStyle = '#fff'; fx.beginPath(); fx.moveTo(0, 0); fx.lineTo(52, 30); fx.lineTo(0, 60); fx.fill();
  fx.fillStyle = '#fcd116'; fx.beginPath(); fx.arc(17, 30, 7, 0, TAU); fx.fill();
  const flagMesh = mesh(new THREE.PlaneGeometry(1.2, 0.6, 12, 4), new THREE.MeshStandardMaterial({ map: T.toTex(flagC), side: THREE.DoubleSide, roughness: 0.8 }), { x: 0.6, y: 2.85 }); flag.add(flagMesh);
  // a bamboo scaffold on its face, up to the floor being built
  const scaf = new THREE.Group(); g.add(scaf);
  const bamboo = mat('#cfc47a', { roughness: 0.55 });
  const scafPoles = [];
  for (let k = 0; k < 5; k++) { const p = cyl(0.035, 0.035, 1, bamboo, { x: -w / 2 + 0.2 + k * (w - 0.4) / 4, z: d / 2 + 0.9 }, 7); scaf.add(p); scafPoles.push(p); }
  const scafLedgers = [];
  for (let k = 0; k < 8; k++) { const l = cyl(0.03, 0.03, w, bamboo, { y: 1 + k * 1.6, z: d / 2 + 0.9, rz: Math.PI / 2 }, 7); scaf.add(l); scafLedgers.push(l); }

  let shown = -1, shownK = -1;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), one = V(1, 1, 1), p4 = V(0, 0, 0);
  // floors complete, and how far up the next one's walls are (0..1)
  function setProgress(done, frac) {
    done = Math.min(FLOORS, Math.max(0, done)); frac = done >= FLOORS ? 0 : Math.max(0, Math.min(1, frac));
    const n = Math.round(frac * COURSES);
    if (done === shown && n === shownK) return;
    shown = done; shownK = n;
    floors.forEach((fl, f) => {
      const built = f < done, current = f === done;
      fl.g.visible = built || current;
      fl.bars.visible = current;
      fl.slab.visible = built;
      fl.done.visible = built;
    });
    courses.count = 0;
    if (done < FLOORS) {
      const fl = floors[done];
      courses.position.y = done * FH;
      for (const [bx, by, bz, ry, c] of fl.layout) { if (c >= n) break; q4.setFromEuler(e4.set(0, ry, 0)); m4.compose(p4.set(bx, by, bz), q4, one); courses.setMatrixAt(courses.count++, m4); }
      courses.instanceMatrix.needsUpdate = true;
    }
    deck.visible = done >= FLOORS;
    const topY = Math.min(done + 1, FLOORS) * FH;
    scaf.visible = done < FLOORS;
    for (const p of scafPoles) { p.scale.y = Math.max(0.01, topY + 1.2); p.position.y = (topY + 1.2) / 2; }
    scafLedgers.forEach((l) => { l.visible = l.position.y < topY + 1; });
  }
  setProgress(0, 0);
  const lights = (on) => { glassM.emissiveIntensity = on ? 1.4 : 0; };
  return { group: g, setProgress, flag: flagMesh, lights, FLOORS, FH, get done() { return shown; }, get courses() { return shownK; }, top: () => Math.min(FLOORS, shown + (shownK > 0 ? 1 : 0)) * FH };
}

// ---------- the street: houses facing the site, a sari-sari store, poles, wires, trees ----------
function buildStreet(world, dyn) {
  const add = (...o) => world.add(...o);
  const COLORS = ['#f2d8a8', '#bfe0d0', '#f4c6b4', '#d8d4f0', '#f6e7a8', '#c8dcf0', '#f0c8d8', '#d8e8b8'];
  const roofM = tag(new THREE.MeshStandardMaterial({ ...(() => { const t = T.corrugated(61, { size: 256, repeat: [6, 1] }); return { map: t.map, normalMap: t.normalMap }; })(), roughness: 0.55, metalness: 0.5, color: '#b8b0a4' }), 'roof', 6, 3);
  const z0 = -19; // the house fronts
  const houses = [];
  let x = -34;
  while (x < 34) {
    const w = 5 + Math.floor(rnd() * 3), floors = rnd() < 0.55 ? 2 : 1, h = floors * 3, cx = x + w / 2;
    const store = Math.abs(cx + 9) < 3.5 && !houses.some((hh) => hh.store);
    const f = T.facade(Math.floor(rnd() * 1e6), w, h, pick(COLORS), { shop: store, lit: 0.35 });
    const front = new THREE.MeshStandardMaterial({ map: f.map, normalMap: f.normalMap, roughness: 0.9 });
    front.userData.facade = true;
    add(mesh(new THREE.PlaneGeometry(w, h), tag(front, 'plaster', w, h, { detail: true }), { x: cx, y: h / 2 - 0.15, z: z0, cast: false }));
    add(box(w, h, 6, mat('#8a8278', { roughness: 0.95 }), { x: cx, y: h / 2 - 0.15, z: z0 - 3.02, cast: true }));
    // a lean-to roof over the front
    const roof = mesh(new THREE.PlaneGeometry(w + 0.2, 1.5), roofM, { x: cx, y: h + 0.1, z: z0 + 0.55, rx: -Math.PI / 2 + 0.35, cast: true }); roof.material.side = THREE.DoubleSide; add(roof);
    houses.push({ cx, w, h, store });
    x += w + 0.2 + rnd() * 1.2;
  }
  // the sari-sari store's sign, bench and awning
  const shop = houses.find((hh) => hh.store) || houses[Math.floor(houses.length / 2)];
  const signT = T.sign([['SARI-SARI STORE', 20, 900], ['Aling Nena · may yelo', 11, 700]], '#f4f1e6', '#c0182e', { w: 512, h: 128, border: '#2f6fd6' });
  add(mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.8 }), { x: shop.cx, y: 2.95, z: z0 + 0.12, cast: false }));
  const awn = T.canvas(128, 64), ax = awn.getContext('2d'); for (let k = 0; k < 8; k++) { ax.fillStyle = k % 2 ? '#fff4e0' : '#2f8a5a'; ax.fillRect(k * 16, 0, 16, 64); }
  add(mesh(new THREE.PlaneGeometry(3.6, 1.2), new THREE.MeshStandardMaterial({ map: T.toTex(awn), roughness: 0.9, side: THREE.DoubleSide }), { x: shop.cx, y: 2.5, z: z0 + 0.6, rx: -Math.PI / 2 + 0.5 }));
  const benchM = mat('#6a4a2a', { roughness: 0.8 });
  add(box(2.2, 0.06, 0.4, benchM, { x: shop.cx, y: 0.42, z: z0 + 0.8 }), box(0.06, 0.42, 0.36, benchM, { x: shop.cx - 1, y: 0.21, z: z0 + 0.8 }), box(0.06, 0.42, 0.36, benchM, { x: shop.cx + 1, y: 0.21, z: z0 + 0.8 }));
  // electric poles along the road, with sagging wires
  const poleM = mat('#8f8a82', { roughness: 0.9 }), wires = [];
  const polesX = [-30, -18, -6, 6, 18, 30];
  for (const px of polesX) { add(cyl(0.13, 0.17, 9, poleM, { x: px, y: 4.5, z: -16.8 }, 10), box(1.6, 0.1, 0.1, poleM, { x: px, y: 8.4, z: -16.8 }), cyl(0.18, 0.18, 0.5, mat('#6a6a6a', { metalness: 0.5, roughness: 0.4 }), { x: px + 0.4, y: 7.6, z: -16.6 }, 10)); }
  for (let k = 0; k + 1 < polesX.length; k++) for (const [dx, dy] of [[-0.7, 8.45], [0, 8.45], [0.7, 8.45], [0.3, 7.9]]) {
    const a = V(polesX[k] + dx, dy, -16.8), b = V(polesX[k + 1] + dx, dy, -16.8);
    let p = a.clone(); for (let s = 1; s <= 16; s++) { const t = s / 16, q = V(a.x + (b.x - a.x) * t, a.y - Math.sin(t * Math.PI) * 0.7, a.z); wires.push(p.x, p.y, p.z, q.x, q.y, q.z); p = q; }
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wires), 3));
  add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#1a1a1a' })));
  // coconut trees: a curved trunk, a crown of fronds that sway in the wind
  const trunkM = new THREE.MeshStandardMaterial({ ...(() => { const t = T.bark(71, { size: 128, repeat: [1, 4] }); return { map: t.map, normalMap: t.normalMap }; })(), color: '#b8a088', roughness: 0.95 });
  const frondM = standIn(new THREE.MeshStandardMaterial({ color: '#4f7a2a', roughness: 0.8, side: THREE.DoubleSide }), 'palm');
  const palms = [];
  const frondGeo = (() => {
    // a frond: a long curved strip with leaflets cut into it, drooping at the tip
    const pts = [], idx = [], N = 14;
    for (let k = 0; k <= N; k++) { const t = k / N, y = Math.sin(t * Math.PI * 0.9) * 0.9 - t * t * 1.6, zz = t * 3.2, wv = (1 - t) * 0.55 + 0.05; pts.push(-wv, y, zz, wv, y, zz, 0, y + 0.06, zz); }
    for (let k = 0; k < N; k++) { const a = k * 3; idx.push(a, a + 3, a + 2, a + 2, a + 3, a + 5, a + 2, a + 5, a + 1, a + 1, a + 5, a + 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const palm = (px, pz, hgt, lean) => {
    const g = new THREE.Group(); g.position.set(px, 0, pz);
    const curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(lean * 0.3, hgt * 0.55, 0), V(lean, hgt, 0));
    const tr = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.16, 8, false), trunkM); tr.castShadow = true; g.add(tr);
    const crown = new THREE.Group(); crown.position.set(lean, hgt, 0); g.add(crown);
    for (let k = 0; k < 11; k++) { const f = new THREE.Mesh(frondGeo, frondM); f.rotation.set(-0.1 - rnd() * 0.5, (k / 11) * TAU + rnd() * 0.3, 0, 'YXZ'); f.castShadow = true; crown.add(f); }
    for (let k = 0; k < 4; k++) crown.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), mat('#5a6a2a'), { x: Math.cos(k * 1.6) * 0.18, y: -0.25, z: Math.sin(k * 1.6) * 0.18 }));
    crown.userData.phase = rnd() * TAU;
    mergeStatic(crown);
    dyn.add(g); palms.push(crown);
  };
  palm(-14, -9, 9, 1.2); palm(-19.5, -12, 11, -0.8); palm(16.5, -9.5, 10, -1.4); palm(22, -12.5, 8.5, 0.9); palm(-25, -8, 10, 1.6); palm(4.5, -24, 12, 0.6); palm(-4, -26, 10.5, -0.9);
  // far off: a line of trees and hills, so the sky meets land
  const hillM = mat('#4a5a44', { roughness: 1, fog: true });
  for (let k = 0; k < 16; k++) { const hx = -90 + k * 12 + rnd() * 6, r = 10 + rnd() * 12; const s = mesh(new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI / 2), hillM, { x: hx, y: -1, z: -70 - rnd() * 20, cast: false, receive: false }); s.scale.y = 0.35 + rnd() * 0.3; add(s); }
  return { palms, shop: { x: shop.cx, z: z0 }, z0 };
}
