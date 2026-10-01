// The City Inspector (Ang Inspektor, the chapter 2 boss): a figure made in code like the neighbours
// (folk.mjs), in a pressed barong and a white hard hat, with glasses, a clipboard and a big red stamp.
// He walks in from the street when the job starts, paces the front of the slab with his clipboard,
// stops to stamp REJECTED on the stack (the rules choose the cell), and slumps or nods at the end.
import * as THREE from './vendor/three.module.min.js';
import { person, posePerson } from './folk.mjs';

const LOOK = { shirt: '#f2ead2', pants: '#1e1e26', skin: '#c08a5e', hair: '#7a7a7a', hat: '#f4f4f0', shoes: '#141414', scale: 1.04 };
const lerp = (a, b, k) => a + (b - a) * k;

export function createInspector(scene) {
  const p = person(LOOK);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  // the barong's embroidery: a pale panel down the front
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.36), M('#fffaf0', { roughness: 0.9, transparent: true, opacity: 0.8 })); panel.position.set(0, 0.26, 0.125); p.spine.add(panel);
  // glasses
  const rim = M('#1a1a1a', { roughness: 0.3, metalness: 0.6 });
  for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 14), rim); g.position.set(s * 0.036, 0.12, 0.1); p.head.add(g); }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.005, 0.005), rim); bridge.position.set(0, 0.122, 0.104); p.head.add(bridge);
  // the clipboard in his left hand, the stamp in his right
  const board = new THREE.Group();
  board.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.012), M('#8a5a2a', { roughness: 0.8 })));
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.25), M('#fbf8ee', { roughness: 1 })); paper.position.z = 0.008; board.add(paper);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), M('#b8b8b8', { metalness: 0.8, roughness: 0.3 })); clip.position.set(0, 0.14, 0.012); board.add(clip);
  board.position.set(0, -0.3, 0.08); board.rotation.set(-1.1, 0, 0); p.armL.el.add(board);
  const stamp = new THREE.Group();
  stamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 10), M('#3a2416', { roughness: 0.6 })));
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.07), M('#c8322a', { roughness: 0.5, emissive: '#ff2a10', emissiveIntensity: 0.2 })); pad.position.y = -0.08; stamp.add(pad);
  stamp.position.set(0, -0.33, 0.03); p.armR.el.add(stamp);
  p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  p.root.visible = false; scene.add(p.root);

  const st = { on: false, x: -14, z: -9, yaw: 0, mode: 'off', t: 0, goal: 2, stampAt: null, lastStamp: 0 };
  return {
    root: p.root,
    // start the job: he walks in from the road
    enter() { Object.assign(st, { on: true, x: 13, z: -10, mode: 'enter', t: 0, goal: 0 }); p.root.visible = true; },
    leave() { st.on = false; st.mode = 'off'; p.root.visible = false; },
    // a stamp at a world position (the cell): he turns to it and brings the stamp down
    stamp(wx) { if (!st.on) return; st.mode = 'stamp'; st.t = 0; st.stampAt = wx; },
    end(won) { if (st.on) { st.mode = won ? 'slump' : 'cheer'; st.t = 0; } },
    get on() { return st.on; }, get mode() { return st.mode; },
    head() { return [st.x, 2.3, st.z]; },
    // area: [x from, x to, z] he paces, beside the well so he never hides it
    update(dt, reduced, area = [3.2, 5.0, 2.7]) {
      if (!st.on) return;
      const [ax0, ax1, az] = area;
      st.t += dt;
      let state = 'idle', yaw = st.yaw, speed = 0;
      if (st.mode === 'enter') {
        // across the road and up to the front of the slab
        const tx = ax0, tz = az, dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz);
        if (d < 0.15) { st.mode = 'patrol'; st.goal = ax1; }
        else { speed = 2.4; st.x += (dx / d) * speed * dt; st.z += (dz / d) * speed * dt; yaw = Math.atan2(dx, dz); state = 'walk'; }
      } else if (st.mode === 'patrol') {
        // up and down in front of the well, reading his clipboard
        const dx = st.goal - st.x;
        if (Math.abs(dx) < 0.1) { if (st.t > 1.6) { st.goal = st.goal === ax1 ? ax0 : ax1; st.t = 0; } state = 'idle'; yaw = Math.PI - 0.5; }
        else { speed = 1.1; st.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt); yaw = dx > 0 ? Math.PI / 2 : -Math.PI / 2; state = 'walk'; }
        st.z = lerp(st.z, az, Math.min(1, dt * 2));
      } else if (st.mode === 'stamp') {
        yaw = Math.atan2((st.stampAt ?? 0) - st.x, -st.z); state = 'point';
        if (st.t > 0.9) { st.mode = 'patrol'; st.t = 0; }
      } else if (st.mode === 'slump' || st.mode === 'cheer') { state = st.mode === 'slump' ? 'slump' : 'point'; yaw = Math.PI - 0.5; }
      st.yaw = lerp(st.yaw, yaw, Math.min(1, dt * 6));
      p.root.position.set(st.x, 0, st.z); p.root.rotation.y = st.yaw;
      // the stamp arm: raised, then down hard
      posePerson(p, state, reduced ? dt * 0.5 : dt, { pace: speed > 2 ? 7.5 : 5.5 });
      if (st.mode === 'stamp') { const k = st.t / 0.9, up = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.15; p.armR.sh.rotation.x = -1.2 - Math.max(0, up) * 1.4; }
      if (st.mode === 'patrol' || st.mode === 'enter') { p.armL.sh.rotation.x = -0.9; p.armL.el.rotation.x = -1.4; } // the clipboard up to read
    },
  };
}
