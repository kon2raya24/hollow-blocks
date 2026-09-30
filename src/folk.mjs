// People made in code, for when the motion-captured Kapatas hasn't loaded (and for the neighbours who
// carry the bahay kubo in a Bayanihan): smooth capsules on a simple skeleton of hips, spine, neck,
// shoulders, elbows, hips and knees, posed by procedural motion (breathing, weight shifts, a walk with
// a bob, arms up to the carrying poles, a cheer, a slump). And the kubo itself: stilts, a bamboo frame,
// woven sawali walls, a steep nipa roof and a window propped open.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const M = new Map();
const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o })); return M.get(k); };
function capsule(r, len, m, seg = 10) { const g = new THREE.CapsuleGeometry(r, len, 4, seg); g.translate(0, -len / 2 - r * 0.5, 0); const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; }
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const put = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

// look: { shirt, pants, skin, hair, shoes, vest, hat, towel, moustache, scale }
export function person(look = {}) {
  const L = { shirt: '#2f6fd6', pants: '#2a3a5a', skin: '#b87a4a', hair: '#1b1320', shoes: '#2a2420', scale: 1, ...look };
  const shirt = mat(L.shirt, { roughness: 0.9 }), pants = mat(L.pants, { roughness: 0.9 }), skin = mat(L.skin, { roughness: 0.6 }), hair = mat(L.hair, { roughness: 0.7 }), shoes = mat(L.shoes, { roughness: 0.7 });
  const root = new THREE.Group(); root.scale.setScalar(L.scale);
  const hips = joint(root, 0, 0.93, 0);
  put(hips, new THREE.SphereGeometry(0.15, 14, 10), pants).scale.set(1.05, 0.7, 0.8);
  const spine = joint(hips, 0, 0.05, 0);
  // the torso: a lathe, broader at the chest
  const torsoG = new THREE.LatheGeometry([[0.0, 0], [0.14, 0.0], [0.155, 0.12], [0.17, 0.32], [0.16, 0.44], [0.09, 0.52], [0.0, 0.53]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
  const torso = put(spine, torsoG, shirt); torso.scale.set(1.1, 1, 0.72);
  if (L.vest) {
    const vest = put(spine, torsoG, mat(L.vest, { roughness: 0.7, emissive: L.vest, emissiveIntensity: 0.08 })); vest.scale.set(1.16, 0.86, 0.78); vest.position.y = 0.04;
    for (const y of [0.16, 0.3]) { const band = put(spine, new THREE.CylinderGeometry(0.172, 0.172, 0.035, 16, 1, true), mat('#e8eef0', { roughness: 0.25, metalness: 0.4, emissive: '#c8d0d8', emissiveIntensity: 0.25 }), 0, y, 0); band.scale.set(1.16, 1, 0.8); }
  }
  const neck = joint(spine, 0, 0.52, 0);
  put(neck, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin, 0, 0.03, 0);
  const head = joint(neck, 0, 0.08, 0);
  const skull = put(head, new THREE.SphereGeometry(0.105, 18, 14), skin, 0, 0.1, 0); skull.scale.set(0.95, 1.08, 1.02);
  put(head, new THREE.SphereGeometry(0.108, 16, 10, 0, TAU, 0, Math.PI * 0.5), hair, 0, 0.115, -0.008).scale.set(0.97, 1, 1.02);
  put(head, new THREE.SphereGeometry(0.022, 8, 6), skin, 0, 0.09, 0.1); // nose
  for (const s of [-1, 1]) { put(head, new THREE.SphereGeometry(0.012, 6, 5), mat('#140c0a', { roughness: 0.3 }), s * 0.035, 0.12, 0.092); put(head, new THREE.SphereGeometry(0.02, 6, 5), skin, s * 0.1, 0.1, 0); }
  if (L.moustache) put(head, new THREE.BoxGeometry(0.07, 0.014, 0.02), hair, 0, 0.06, 0.098);
  if (L.hat) {
    const hat = joint(head, 0, 0.16, 0);
    const hm = mat(L.hat, { roughness: 0.35, metalness: 0.05 });
    put(hat, new THREE.SphereGeometry(0.125, 18, 10, 0, TAU, 0, Math.PI * 0.5), hm, 0, 0, 0).scale.set(1, 0.95, 1.08);
    put(hat, new THREE.CylinderGeometry(0.15, 0.155, 0.018, 20), hm, 0, 0.0, 0.015).scale.set(1, 1, 1.12);
    put(hat, new THREE.BoxGeometry(0.03, 0.03, 0.22), hm, 0, 0.115, 0); // the ridge
  }
  // arms
  const arm = (s) => {
    const sh = joint(spine, s * 0.2, 0.43, 0);
    put(sh, new THREE.SphereGeometry(0.062, 10, 8), shirt);
    const up = capsule(0.052, 0.22, shirt); sh.add(up);
    const el = joint(sh, 0, -0.3, 0);
    const fore = capsule(0.043, 0.2, skin); el.add(fore);
    const hand = put(el, new THREE.SphereGeometry(0.05, 10, 8), skin, 0, -0.28, 0.01); hand.scale.set(0.8, 1.1, 0.7);
    return { sh, el };
  };
  const armL = arm(1), armR = arm(-1);
  if (L.towel) { const tw = put(spine, new THREE.BoxGeometry(0.12, 0.04, 0.22), mat('#f4f1e6', { roughness: 1 }), 0.13, 0.5, 0); tw.rotation.z = -0.4; }
  const leg = (s) => {
    const th = joint(hips, s * 0.085, -0.02, 0);
    th.add(capsule(0.072, 0.34, pants));
    const kn = joint(th, 0, -0.44, 0);
    kn.add(capsule(0.058, 0.34, pants));
    const shoe = put(kn, new THREE.BoxGeometry(0.11, 0.08, 0.24), shoes, 0, -0.45, 0.04);
    shoe.geometry.translate(0, 0, 0);
    return { th, kn };
  };
  const legL = leg(1), legR = leg(-1);
  return { root, hips, spine, neck, head, armL, armR, legL, legR, look: L, t: Math.random() * 10, pose: {} };
}

// Pose by name and a phase: idle, walk, carry (hands up to a pole on the shoulder), cheer, point, slump.
const P = { hipsY: 0, lean: 0, twist: 0, headY: 0, headP: 0, sL: [0, 0], sR: [0, 0], eL: 0, eR: 0, tL: 0, tR: 0, kL: 0, kR: 0 };
export function posePerson(p, state, dt, o = {}) {
  p.t += dt;
  const t = p.t, w = { ...P };
  const breathe = Math.sin(t * 1.7) * 0.015;
  if (state === 'walk' || state === 'carry') {
    const ph = t * (o.pace || 6.5), s = Math.sin(ph), c = Math.cos(ph);
    w.tL = s * 0.45; w.tR = -s * 0.45; w.kL = Math.max(0, -c) * 0.7 + 0.08; w.kR = Math.max(0, c) * 0.7 + 0.08;
    w.hipsY = -Math.abs(c) * 0.03; w.twist = s * 0.08; w.lean = 0.06;
    if (state === 'walk') { w.sL = [-s * 0.4, 0.08]; w.sR = [s * 0.4, -0.08]; w.eL = 0.3; w.eR = 0.3; }
    else { w.sL = [-2.7, 0.15]; w.sR = [-2.7, -0.15]; w.eL = 1.1; w.eR = 1.1; w.headP = 0.15; w.lean = 0.02; } // both hands up on the pole above the shoulder
  } else if (state === 'cheer') {
    const b = Math.abs(Math.sin(t * 7));
    w.sL = [-2.9 + b * 0.25, 0.35]; w.sR = [-2.9 + b * 0.25, -0.35]; w.eL = 0.4; w.eR = 0.4; w.hipsY = b * 0.06 - 0.02; w.headP = -0.25; w.kL = w.kR = 0.15 + (1 - b) * 0.2;
  } else if (state === 'point') {
    w.sR = [-1.45, -0.25]; w.eR = 0.1; w.sL = [0.1, 0.15]; w.eL = 0.9; w.headY = -0.3; w.lean = 0.04;
  } else if (state === 'slump') {
    w.sL = [-2.1, 0.7]; w.sR = [-2.1, -0.7]; w.eL = 2.2; w.eR = 2.2; w.headP = 0.45; w.lean = 0.2; w.kL = w.kR = 0.1;
  } else if (state === 'worry') {
    w.sL = [-0.6, 0.2]; w.sR = [-0.6, -0.2]; w.eL = 1.9; w.eR = 1.9; w.headP = -0.15; w.headY = Math.sin(t * 2.4) * 0.35;
  } else { // idle: weight on one leg, then the other, arms loose, the odd look about
    const sh = Math.sin(t * 0.45);
    w.hipsY = breathe; w.twist = sh * 0.05; w.tL = sh * 0.05; w.tR = -sh * 0.05; w.kL = Math.max(0, sh) * 0.12; w.kR = Math.max(0, -sh) * 0.12;
    w.sL = [0.05, 0.12]; w.sR = [0.05, -0.12]; w.eL = 0.25 + breathe; w.eR = 0.35;
    if (o.handsOnHips) { w.sL = [0.15, 0.75]; w.sR = [0.15, -0.75]; w.eL = 1.9; w.eR = 1.9; }
  }
  if (o.look) { w.headY += o.look[0]; w.headP += o.look[1]; }
  const k = Math.min(1, dt * (o.snap || 8)), q = p.pose;
  for (const key of Object.keys(w)) { const v = w[key]; if (Array.isArray(v)) { q[key] = q[key] || [0, 0]; q[key][0] = lerp(q[key][0], v[0], k); q[key][1] = lerp(q[key][1], v[1], k); } else q[key] = lerp(q[key] ?? 0, v, k); }
  p.hips.position.y = 0.93 + q.hipsY; p.spine.rotation.set(q.lean, q.twist, 0); p.head.rotation.set(q.headP, q.headY, 0, 'YXZ');
  p.armL.sh.rotation.set(q.sL[0], 0, q.sL[1]); p.armR.sh.rotation.set(q.sR[0], 0, q.sR[1]); p.armL.el.rotation.x = -q.eL; p.armR.el.rotation.x = -q.eR;
  p.legL.th.rotation.x = -q.tL; p.legR.th.rotation.x = -q.tR; p.legL.kn.rotation.x = q.kL; p.legR.kn.rotation.x = q.kR;
}

// The foreman: blue shirt, orange vest with reflective bands, jeans, boots, a yellow hard hat, a towel.
export const kapatasLook = { shirt: '#2f5fb8', pants: '#34405a', skin: '#b07448', vest: '#ff8a1a', hat: '#ffc81e', towel: true, moustache: true, shoes: '#3a2a1a' };

// ---------- the bahay kubo ----------
export function kubo() {
  const g = new THREE.Group();
  const bamboo = mat('#c8b46a', { roughness: 0.6 }), dark = mat('#6a5030', { roughness: 0.8 });
  const wallT = T.weave(33); wallT.map.repeat.set(6, 3); if (wallT.normalMap) wallT.normalMap.repeat.set(6, 3);
  const wall = new THREE.MeshStandardMaterial({ map: wallT.map, normalMap: wallT.normalMap, color: '#e8d4a0', roughness: 0.85 });
  wall.userData.surface = { kind: 'sawali', w: 2.6, h: 1.4 };
  const nipa = (() => {
    const c = T.canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#8a6a3a'; x.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 16; row++) for (let k = 0; k < 90; k++) { const v = 120 + Math.random() * 60; x.strokeStyle = `rgb(${v},${v * 0.8 | 0},${v * 0.45 | 0})`; x.lineWidth = 1.5; const px = Math.random() * 256; x.beginPath(); x.moveTo(px, row * 16); x.lineTo(px + (Math.random() - 0.5) * 4, row * 16 + 20); x.stroke(); }
    const t = T.toTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
  })();
  const roofM = new THREE.MeshStandardMaterial({ map: nipa, roughness: 1, side: THREE.DoubleSide });
  roofM.userData.surface = { kind: 'nipa', w: 3.4, h: 2 };
  const W = 2.6, D = 2.2, FLOOR = 0.9, WALL = 1.4;
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) put(g, new THREE.CylinderGeometry(0.06, 0.07, FLOOR + WALL, 8), bamboo, x, (FLOOR + WALL) / 2, z);
  put(g, new THREE.BoxGeometry(W + 0.1, 0.1, D + 0.1), dark, 0, FLOOR, 0);
  const walls = [[0, D / 2, W, 0], [0, -D / 2, W, 0], [-W / 2, 0, D, Math.PI / 2], [W / 2, 0, D, Math.PI / 2]];
  for (const [x, z, l, ry] of walls) { const m = put(g, new THREE.BoxGeometry(l, WALL, 0.05), wall, x, FLOOR + WALL / 2, z); m.rotation.y = ry; }
  // the window, propped open, and the door with its ladder
  put(g, new THREE.BoxGeometry(0.8, 0.55, 0.06), mat('#2a1e14'), 0.5, FLOOR + 0.8, D / 2 + 0.01);
  const shutter = put(g, new THREE.BoxGeometry(0.85, 0.6, 0.04), wall, 0.5, FLOOR + 1.1, D / 2 + 0.2); shutter.rotation.x = -0.9;
  put(g, new THREE.BoxGeometry(0.55, 1.0, 0.06), mat('#3a2a1a'), -0.7, FLOOR + 0.55, D / 2 + 0.01);
  // the roof: four steep faces of nipa, meeting at a ridge
  const rg = new THREE.BufferGeometry(), RH = 1.5, OV = 0.45, rx = W / 2 + OV, rz = D / 2 + OV, top = FLOOR + WALL, ridge = 0.5;
  const v = [-rx, top, rz, rx, top, rz, ridge, top + RH, 0, -rx, top, rz, ridge, top + RH, 0, -ridge, top + RH, 0,
    rx, top, -rz, -rx, top, -rz, -ridge, top + RH, 0, rx, top, -rz, -ridge, top + RH, 0, ridge, top + RH, 0,
    rx, top, rz, rx, top, -rz, ridge, top + RH, 0, -rx, top, -rz, -rx, top, rz, -ridge, top + RH, 0];
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  rg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0.7, 1, 0, 0, 0.7, 1, 0.3, 1, 0, 0, 1, 0, 0.7, 1, 0, 0, 0.7, 1, 0.3, 1, 0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1]), 2));
  rg.computeVertexNormals();
  const roof = new THREE.Mesh(rg, roofM); roof.castShadow = true; g.add(roof);
  put(g, new THREE.CylinderGeometry(0.05, 0.05, ridge * 2 + 0.3, 8), dark, 0, top + RH + 0.02, 0).rotation.z = Math.PI / 2;
  // the two long bamboo poles it's carried on, under the floor
  const poles = [];
  for (const z of [-0.75, 0.75]) { const p = put(g, new THREE.CylinderGeometry(0.05, 0.05, 6.4, 8), bamboo, 0, 0.25, z); p.rotation.z = Math.PI / 2; poles.push(p); }
  return { group: g, poles, height: top + RH };
}

// The Bayanihan: neighbours in bright shirts carrying a kubo on the poles, walking in step.
const SHIRTS = ['#e8384f', '#ffd23f', '#3fae5a', '#ff8ae2', '#ff9f43', '#2f6fd6', '#f4f1e6', '#8a4ad6'];
const SKINS = ['#c98a5a', '#b87a4a', '#d9a06b', '#a86a3a', '#c48450'];
export function parade() {
  const g = new THREE.Group(); g.name = 'bayanihan';
  const house = kubo(); house.group.position.y = 1.35; g.add(house.group);
  const folk = [];
  let i = 0;
  for (const z of [-0.95, 0.95]) for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) {
    const p = person({ shirt: SHIRTS[i % SHIRTS.length], skin: SKINS[i % SKINS.length], pants: ['#2a3a5a', '#3a3f4a', '#5a4a3a', '#2a2a3a'][i % 4], scale: 0.95 + (i % 3) * 0.03 });
    p.root.position.set(x, 0, z + (z > 0 ? -0.2 : 0.2)); p.t = i * 0.37; g.add(p.root); folk.push(p); i++;
  }
  function update(dt) { for (const p of folk) posePerson(p, 'carry', dt, { pace: 6, snap: 20 }); house.group.position.y = 1.35 + Math.abs(Math.sin(folk[0].t * 6)) * 0.03; }
  return { group: g, update };
}
