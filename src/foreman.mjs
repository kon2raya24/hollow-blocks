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
  slump: [/defeated/i], point: [/^cheering$/i, /victory/i], worry: [/looking around/i], jump: [/^jump$/i],
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
function hardHat(color = '#ffc81e') {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.02 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 14, 0, TAU, 0, Math.PI * 0.5), m); shell.scale.set(1, 0.92, 1.12); g.add(shell);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.155, 0.014, 28), m); brim.scale.set(1, 1, 1.16); brim.position.z = 0.02; g.add(brim);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.24), m); ridge.position.y = 0.105; g.add(ridge);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Santa's: a red cone that flops back, a white fur band and a pompom
function santaHat() {
  const g = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: '#d8222a', roughness: 0.85 }), fur = new THREE.MeshStandardMaterial({ color: '#f8f4ee', roughness: 1 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.118, 0.26, 20), red); cone.position.set(0, 0.12, -0.04); cone.rotation.x = -0.5; g.add(cone);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.03, 10, 28), fur); band.rotation.x = Math.PI / 2; band.scale.set(1, 1.14, 1); band.position.y = 0.01; g.add(band);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), fur); pom.position.set(0, 0.22, -0.13); g.add(pom);
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
  let mount = null;
  if (bones.Head) {
    const ws = new THREE.Vector3(); bones.Head.updateWorldMatrix(true, false); bones.Head.getWorldScale(ws);
    mount = new THREE.Group(); mount.scale.setScalar(1 / ws.x); bones.Head.add(mount);
  }
  scene.add(root);
  const m = { root, model, mixer, bones, action, layers: [], lib, loopT: 0, oneT: 0, one: null, look: { yaw: 0, pitch: 0, w: 0 }, idleAlt: 0, state: 'idle', mount, hat: null, dress: null };
  dressForeman(m, {});
  return m;
}

// Kapatas's outfits on the real man: his atlas recoloured where it is cloth (the white shirt, the
// jeans, the sneakers) with the shading kept, and the hat to match. fit: { shirt, pants, shoes, hat }
// (colours; hat may be 'santa'); a part left out keeps what he came with.
const ZONE_BODY = 1, ZONE_FEET = 2;
function dressBase(m) {
  if (m.dress) return m.dress;
  const meshes = []; m.model.traverse((o) => { if (o.isSkinnedMesh && o.material && o.material.map && !o.material.transparent) meshes.push(o); });
  if (!meshes.length) return null;
  const map = meshes[0].material.map, img = map.image, W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  // which cloth is where: each triangle by the bone that moves it most (head and hands stay as they are)
  const zc = document.createElement('canvas'); zc.width = W; zc.height = H;
  const zx = zc.getContext('2d'), paths = [new Path2D(), new Path2D(), new Path2D()];
  for (const mesh of meshes) {
    const gm = mesh.geometry, uv = gm.attributes.uv, si = gm.attributes.skinIndex, sw = gm.attributes.skinWeight, ix = gm.index, bones = mesh.skeleton.bones;
    const zoneOf = (v) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const q = sw.getComponent(v, k); if (q > w) { w = q; b = si.getComponent(v, k); } } const n = canon(bones[b]?.name || ''); return /Foot|Toe/.test(n) ? ZONE_FEET : /Head|Eye|Hand|Thumb|Index|Middle|Ring|Pinky/.test(n) ? 0 : ZONE_BODY; };
    const n = ix ? ix.count : uv.count;
    for (let t = 0; t < n; t += 3) {
      const v = [0, 1, 2].map((k) => (ix ? ix.getX(t + k) : t + k)), zs = v.map(zoneOf);
      const z = zs[0] === zs[1] || zs[0] === zs[2] ? zs[0] : zs[1], p = paths[z];
      p.moveTo(uv.getX(v[0]) * W, uv.getY(v[0]) * H); p.lineTo(uv.getX(v[1]) * W, uv.getY(v[1]) * H); p.lineTo(uv.getX(v[2]) * W, uv.getY(v[2]) * H); p.closePath();
    }
  }
  zx.lineJoin = 'round';
  for (const [z, col, lw] of [[ZONE_BODY, '#f00', 6], [ZONE_FEET, '#0f0', 6], [0, '#000', 2]]) { zx.fillStyle = zx.strokeStyle = col; zx.lineWidth = lw; zx.fill(paths[z]); zx.stroke(paths[z]); }
  const zd = zx.getImageData(0, 0, W, H).data, zone = new Uint8Array(W * H);
  for (let i = 0; i < zone.length; i++) zone[i] = zd[i * 4 + 1] > 127 ? ZONE_FEET : zd[i * 4] > 127 ? ZONE_BODY : 0;
  x.drawImage(img, 0, 0);
  m.dress = { meshes, map, canvas: c, ctx: x, base: x.getImageData(0, 0, W, H), zone, tex: null, mats: new Map() };
  return m.dress;
}
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
export function dressForeman(m, fit = {}) {
  if (!m) return;
  // the hat
  if (m.hat) { m.mount.remove(m.hat); m.hat.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); m.hat = null; }
  if (m.mount && fit.hat !== null) { m.hat = fit.hat === 'santa' ? santaHat() : hardHat(fit.hat || '#ffc81e'); m.hat.position.set(0, 0.135, 0.012); m.hat.rotation.x = -0.08; m.mount.add(m.hat); }
  // the clothes
  const want = fit.shirt || fit.pants || fit.shoes;
  if (!want && !m.dress) return;
  const d = dressBase(m);
  if (!d) return;
  if (!want) { for (const mesh of d.meshes) mesh.material = d.mats.get(mesh)?.orig || mesh.material; return; }
  const src = d.base.data, out = new ImageData(d.base.width, d.base.height), o = out.data;
  const S = fit.shirt && rgb(fit.shirt), P = fit.pants && rgb(fit.pants), F = fit.shoes && rgb(fit.shoes);
  for (let i = 0, p = 0; i < d.zone.length; i++, p += 4) {
    const r = src[p], g = src[p + 1], b = src[p + 2], z = d.zone[i];
    let to = null, k = 0;
    if (z) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), jeans = b > r + 14 && b >= g;
      if (jeans) { if (P) { to = P; k = Math.min(1.35, lum / 100); } } // the jeans, cuffs and all
      else if (z === ZONE_FEET) { if (F) { to = F; k = Math.min(1.25, lum / 190); } } // the sneakers
      else if (S && lum > 95 && (mx - mn) < 0.13 * mx) { to = S; k = Math.min(1.1, lum / 222); } // the white shirt
    }
    if (to) { o[p] = Math.min(255, to[0] * k); o[p + 1] = Math.min(255, to[1] * k); o[p + 2] = Math.min(255, to[2] * k); }
    else { o[p] = r; o[p + 1] = g; o[p + 2] = b; }
    o[p + 3] = src[p + 3];
  }
  d.ctx.putImageData(out, 0, 0);
  if (!d.tex) {
    d.tex = new THREE.CanvasTexture(d.canvas);
    for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'channel', 'anisotropy', 'magFilter', 'minFilter']) d.tex[k] = d.map[k];
  }
  d.tex.needsUpdate = true;
  for (const mesh of d.meshes) {
    if (!d.mats.has(mesh)) { const dressed = mesh.material.clone(); dressed.map = d.tex; d.mats.set(mesh, { orig: mesh.material, dressed }); }
    mesh.material = d.mats.get(mesh).dressed;
  }
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
