// Site themes (the shop): the same well, the same slab, a different place around them. Each adds its
// own backdrop dressing far behind the street and sets its own air (fog tint, ground, a touch of
// exposure). The barangay is the default and adds nothing.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { kubo } from './folk.mjs';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
let seed = 1; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
function windows(w, h, lit) { // a tower's face: glass with a grid of windows, some lit
  const c = T.canvas(128, 256), x = c.getContext('2d');
  x.fillStyle = '#2a3a52'; x.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 32; r++) for (let k = 0; k < 8; k++) { x.fillStyle = rnd(0, 1) < lit ? `rgba(255,${200 + Math.floor(rnd(0, 50))},140,0.95)` : `rgba(${120 + Math.floor(rnd(0, 60))},170,220,0.55)`; x.fillRect(k * 16 + 2, r * 8 + 1, 12, 6); }
  const t = T.toTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 6, h / 12); return t;
}
function palm(g, x, z, h = 7) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, h, 7), M('#7a5a3a')); trunk.position.set(x, h / 2, z); trunk.rotation.z = rnd(-0.12, 0.12); g.add(trunk);
  for (let k = 0; k < 7; k++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.2, 4), M('#3a7a2a', { side: THREE.DoubleSide })); const a = (k / 7) * Math.PI * 2; leaf.position.set(x + Math.cos(a) * 1.2, h - 0.2, z + Math.sin(a) * 1.2); leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); g.add(leaf); }
}
export const THEMES = {
  'site-barangay': { fog: null },
  'site-makati': { fog: '#9aa8c0', k: 0.35, exp: 1.02, ground: null },
  'site-resort': { fog: '#bfe0ee', k: 0.28, exp: 1.02, ground: '#e8d8b0' },
  'site-probinsya': { fog: '#b8c8a8', k: 0.4, exp: 1.0, ground: '#9aa070' },
};
export function buildTheme(scene, id) {
  const g = new THREE.Group(); g.name = `theme ${id}`; seed = 7;
  if (id === 'site-makati') {
    // the business district: glass towers behind the street, a crane on the tallest
    for (let k = 0; k < 18; k++) {
      const w = rnd(9, 18), d = rnd(8, 14), h = rnd(40, 110), x = -100 + k * 12 + rnd(-3, 3), z = rnd(-55, -95);
      const glass = new THREE.MeshStandardMaterial({ map: windows(w, h, 0.25), emissiveMap: windows(w, h, 0.25), emissive: '#ffd8a0', emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.6 });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass); tower.position.set(x, h / 2 - 0.2, z); g.add(tower);
      if (k % 3 === 0) { const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 3, d * 0.6), M('#c8c8cc', { metalness: 0.5 })); cap.position.set(x, h + 1.3, z); g.add(cap); }
      if (k === 9) { const mast = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 1), M('#ffc81e')); mast.position.set(x, h + 15, z); g.add(mast); const jib = new THREE.Mesh(new THREE.BoxGeometry(34, 1, 1), M('#ffc81e')); jib.position.set(x + 8, h + 29, z); g.add(jib); }
    }
  } else if (id === 'site-resort') {
    // the sea behind the road, white sand, umbrellas and palms, a cabana or two
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshStandardMaterial({ color: '#1aa8c8', roughness: 0.08, metalness: 0.2, envMapIntensity: 1.5 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.12, -175); g.add(sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(600, 30), M('#efe2c0', { roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.13, -32); g.add(sand);
    for (let k = 0; k < 9; k++) {
      const x = -48 + k * 12 + rnd(-3, 3), z = rnd(-26, -34), c = ['#ff5a3a', '#ffd23f', '#2ab8d8', '#ff8ae2'][k % 4];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), M('#f4f4f4')); pole.position.set(x, 1.1, z); g.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 10), M(c, { side: THREE.DoubleSide })); top.position.set(x, 2.5, z); g.add(top);
    }
    for (let k = 0; k < 12; k++) palm(g, -70 + k * 12 + rnd(-4, 4), rnd(-24, -40), rnd(6, 9));
    // the resort hotel, tall and white with blue balconies, over the rooftops behind the street
    const hc = T.canvas(128, 256), hx = hc.getContext('2d'); hx.fillStyle = '#f8f4ec'; hx.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 16; r++) { hx.fillStyle = '#5ab8d8'; hx.fillRect(0, r * 16 + 9, 128, 4); for (let k = 0; k < 6; k++) { hx.fillStyle = '#2a6a8a'; hx.fillRect(6 + k * 21, r * 16 + 2, 13, 7); } }
    const ht = T.toTex(hc); ht.wrapS = ht.wrapT = THREE.RepeatWrapping; ht.repeat.set(3, 2);
    for (const [x, z, w, h] of [[-26, -52, 34, 34], [22, -60, 26, 26]]) { const hotel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), new THREE.MeshStandardMaterial({ map: ht, roughness: 0.6 })); hotel.position.set(x, h / 2 - 0.2, z); g.add(hotel); const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1.2, 12), M('#2ab8d8')); roof.position.set(x, h + 0.4, z); g.add(roof); }
    for (const x of [-16, -9, 11, 18]) palm(g, x, -24, 13);
    for (const x of [-22, 26]) { const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5), M('#fff8ec')); cab.position.set(x, 1.5, -44); g.add(cab); const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.4, 4), M('#c8a060')); roof.position.set(x, 4.2, -44); roof.rotation.y = Math.PI / 4; g.add(roof); }
  } else if (id === 'site-probinsya') {
    // rice paddies, a bahay kubo, coconut trees, the mountains
    for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), M(k % 2 ? '#7ab84a' : '#8ac85a', { roughness: 0.9 })); p.rotation.x = -Math.PI / 2; p.position.set(-52 + k * 14, -0.12 + r * 0.02, -26 - r * 10); g.add(p);
      const dike = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.25, 0.4), M('#8a6a4a')); dike.position.set(-52 + k * 14, 0, -21.5 - r * 10); g.add(dike);
    }
    for (let k = 0; k < 7; k++) { const h = rnd(30, 60), m = new THREE.Mesh(new THREE.ConeGeometry(rnd(40, 70), h, 7), M(k % 2 ? '#4a6a5a' : '#5a7a62', { flatShading: true })); m.position.set(-150 + k * 50, h / 2 - 2, rnd(-150, -190)); g.add(m); }
    try { const hut = kubo().group; hut.position.set(-18, 0, -30); hut.scale.setScalar(2.2); g.add(hut); const hut2 = kubo().group; hut2.position.set(24, 0, -38); hut2.scale.setScalar(2); g.add(hut2); } catch { /* a kubo needs folk.mjs */ }
    for (let k = 0; k < 10; k++) palm(g, -60 + k * 13 + rnd(-4, 4), rnd(-20, -52), rnd(7, 11));
  }
  g.traverse((o) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; } });
  scene.add(g);
  return g;
}
