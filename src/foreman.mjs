// Kapatas, real: a Mixamo man with motion capture (converted by the Bakbakan tools), in a yellow hard
// hat. He idles and looks about, follows the piece in play with his head, cheers a good clear, throws
// his arms up for a Bayanihan, points at a new floor, frets when the wall gets high and slumps when it
// comes down. The files ship only in the Vercel deploy (Mixamo's terms); without them the view keeps
// the Kapatas made in code (folk.mjs).
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader, cloneSkinned } from './vendor/three-mocap.min.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;
const canon = (n) => n.replace(/^mixamorig\d*[:_]?/i, '');
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// state → [clip name patterns], first match wins
const SLOTS = {
  idle: [/happy idle/i, /^idle/i], look: [/looking around/i], cheer: [/^cheering$/i, /victory/i], victory: [/^victory$/i, /cheering/i],
  slump: [/defeated/i], point: [/taunt/i, /cheering/i], worry: [/looking around/i], jump: [/^jump$/i],
};
const HEIGHT = 1.72;

export async function loadForeman(base = 'assets/people/', onProgress = null) {
  const res = await fetch(base + 'clips.json');
  if (!res.ok) throw new Error('no foreman');
  const meta = await res.json();
  if (!meta.chars || !meta.chars.kapatas) throw new Error('no foreman');
  const g = await new GLTFLoader().loadAsync(base + 'kapatas.glb', (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); });
  const names = Object.keys(meta.clips), slots = {};
  for (const [slot, pats] of Object.entries(SLOTS)) slots[slot] = pats.map((p) => names.find((n) => p.test(n))).find(Boolean) || names[0];
  return { meta, template: g.scene, slots };
}

function bindClips(lib, bones, hipRest) {
  const out = {};
  for (const [name, c] of Object.entries(lib.meta.clips)) {
    const tracks = [];
    for (const [bone, kind, times, values] of c.tr) {
      const b = bones[bone];
      if (!b) continue;
      if (kind === 'q') tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values));
      else { const k = hipRest / c.hip, v = values.slice(); for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 1] *= k; v[i + 2] = 0; } tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, times, v)); }
    }
    out[name] = new THREE.AnimationClip(name, c.d, tracks);
  }
  return out;
}

// the hard hat: a smooth shell with a brim and a ridge
function hardHat() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#ffc81e', roughness: 0.32, metalness: 0.02 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 14, 0, TAU, 0, Math.PI * 0.5), m); shell.scale.set(1, 0.92, 1.12); g.add(shell);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.155, 0.014, 28), m); brim.scale.set(1, 1, 1.16); brim.position.z = 0.02; g.add(brim);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.24), m); ridge.position.y = 0.105; g.add(ridge);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function foremanModel(lib, scene) {
  const meta = lib.meta.chars.kapatas;
  const model = cloneSkinned(lib.template), root = new THREE.Group();
  root.add(model);
  model.scale.multiplyScalar(HEIGHT / meta.height);
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[canon(o.name)] = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  if (!bones.Hips) throw new Error('no hips');
  const clips = bindClips(lib, bones, bones.Hips.position.y);
  const mixer = new THREE.AnimationMixer(model), actions = new Map();
  const action = (name) => { if (!actions.has(name)) { const a = mixer.clipAction(clips[name]); a.play(); a.paused = true; a.setEffectiveWeight(0); actions.set(name, a); } return actions.get(name); };
  // the hat, mounted on the head (a mount undoes the bone's scale, so it's placed in metres)
  if (bones.Head) {
    const ws = new THREE.Vector3(); bones.Head.updateWorldMatrix(true, false); bones.Head.getWorldScale(ws);
    const mount = new THREE.Group(); mount.scale.setScalar(1 / ws.x); const hat = hardHat(); hat.position.set(0, 0.135, 0.012); hat.rotation.x = -0.08; mount.add(hat); bones.Head.add(mount);
  }
  scene.add(root);
  return { root, model, mixer, bones, action, layers: [], lib, loopT: 0, oneT: 0, one: null, look: { yaw: 0, pitch: 0, w: 0 }, idleAlt: 0, state: 'idle' };
}

// a moment: plays once over what he's doing
export function foremanEvent(m, kind) {
  if (!m) return;
  if (kind === 'victory' || kind === 'cheer' || kind === 'point') { m.one = kind; m.oneT = 0; }
  if (kind === 'slump') { m.one = 'slump'; m.oneT = 0; }
}

const hv = new THREE.Vector3(), ax = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qp = new THREE.Quaternion();
function turnBone(bone, q) { bone.parent.getWorldQuaternion(qp); bone.quaternion.premultiply(qp).premultiply(q).premultiply(qp.invert()); bone.updateMatrixWorld(true); }

// o: { state (idle, worry, cheer, point, slump), x, z, yaw, look: [x, y, z] }
export function driveForeman(m, dt, o) {
  const S = m.lib.slots, D = (slot) => m.lib.meta.clips[S[slot]].d;
  m.loopT += dt;
  let want;
  if (m.one) {
    m.oneT += dt;
    const slot = m.one === 'cheer' ? 'cheer' : m.one === 'victory' ? 'victory' : m.one === 'point' ? 'point' : 'slump';
    const d = D(slot), len = slot === 'slump' ? d * 0.55 : Math.min(d, slot === 'victory' ? 3.2 : 1.8);
    if (slot === 'slump' && o.state !== 'slump') { m.one = null; }
    else if (m.oneT >= len && slot !== 'slump') m.one = null;
    else want = { slot, t: slot === 'slump' ? Math.min(m.oneT, len) : (m.oneT % d) };
  }
  if (!want) {
    // idle, now and then a look about (more when the wall is high)
    m.idleAlt -= dt;
    if (m.idleAlt < -9) m.idleAlt = o.state === 'worry' ? 6 : 5;
    const looking = o.state === 'worry' || m.idleAlt > 0;
    want = looking ? { slot: 'look', t: (m.loopT * (o.state === 'worry' ? 1.3 : 1)) % D('look') } : { slot: 'idle', t: m.loopT % D('idle') };
  }
  const a = m.action(S[want.slot]);
  let l = m.layers.find((x) => x.a === a);
  if (!l) { l = { a, w: m.layers.length ? 0 : 1 }; m.layers.push(l); }
  l.t = want.t;
  for (const x of m.layers) { x.on = x === l; x.w = clamp(x.w + (x.on ? 1 : -1) * dt / 0.25, 0, 1); }
  for (const x of m.layers) if (!x.on && x.w <= 0) x.a.setEffectiveWeight(0);
  m.layers = m.layers.filter((x) => x.on || x.w > 0);
  const sum = m.layers.reduce((s, x) => s + x.w, 0) || 1;
  for (const x of m.layers) { x.a.time = x.t; x.a.setEffectiveWeight(x.w / sum); }
  m.mixer.update(0);
  m.root.position.set(o.x, 0, o.z);
  m.root.rotation.y = o.yaw;
  // his head follows the piece in play while he idles
  const lk = m.look, free = !m.one && o.state === 'idle' && o.look;
  let wy = 0, wp = 0;
  if (free && m.bones.Head && m.bones.Neck) {
    m.bones.Head.getWorldPosition(hv);
    const dx = o.look[0] - hv.x, dy = o.look[1] - hv.y, dz = o.look[2] - hv.z;
    wy = clamp(wrap(Math.atan2(dx, dz) - o.yaw), -1.0, 1.0); wp = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.45);
  }
  lk.w = clamp(lk.w + (free ? dt : -dt) * 3, 0, 1);
  lk.yaw = lerp(lk.yaw, wy, Math.min(1, dt * 5)); lk.pitch = lerp(lk.pitch, wp, Math.min(1, dt * 5));
  if (lk.w > 0.001 && m.bones.Head && m.bones.Neck) {
    m.model.updateMatrixWorld(true);
    const rx = -Math.cos(o.yaw), rz = Math.sin(o.yaw);
    for (const [bone, share] of [[m.bones.Neck, 0.4], [m.bones.Head, 0.6]]) { qa.setFromAxisAngle(UP, lk.yaw * share * lk.w); qb.setFromAxisAngle(ax.set(rx, 0, rz), -lk.pitch * share * lk.w); turnBone(bone, qa.multiply(qb)); }
  }
}
