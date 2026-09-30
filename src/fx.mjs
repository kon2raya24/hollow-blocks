// The juice, in the world: chunks of the real materials when a row breaks (bouncing on the slab),
// dust, sparks off the yero and the tiles, the flash along a cleared row, the streak of a hard drop,
// confetti for a Bayanihan, rain for a bagyo, and the callouts (T-spins, back-to-backs, combos, the
// pesos earned), lettered in gold and popping up where it happened.
import * as THREE from './vendor/three.module.min.js';
import { chunkGeometry } from './blocks.mjs';

const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
// points that grow and fade: dust (normal blending) or sparks and glints (additive)
function pointCloud(max, additive, tex) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 400 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'attribute vec3 aColor; attribute float aSize, aAlpha; uniform float scale; varying vec3 vC; varying float vA; void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC${additive ? ' * 2.2' : ' * 1.35'}, a); }`,
  });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 5;
  return { pts, pos, col, size, alpha, geo, list: [], max, m };
}

export function createFx(scene, mats, { floorY = 0 } = {}) {
  const group = new THREE.Group(); group.name = 'fx'; scene.add(group);
  const tex = softDot();
  let quality = 2, reduced = false;

  // ---------- chunks ----------
  const chunkGeo = chunkGeometry(), CH = 110, chunks = {}, live = [];
  for (const [k, m] of Object.entries(mats)) {
    const g = chunkGeo.clone(); g.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(CH), 1));
    const im = new THREE.InstancedMesh(g, m, CH); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    group.add(im); chunks[k] = im;
  }
  function chunk(key, x, y, z, vx, vy, vz, s) {
    const cap = quality >= 2 ? 360 : quality === 1 ? 220 : 120;
    if (live.length >= cap || !chunks[key]) return;
    live.push({ key, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, TAU), rnd(0, TAU), 0)), w: new THREE.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)), s: new THREE.Vector3(s * rnd(0.7, 1.3), s * rnd(0.5, 1), s * rnd(0.7, 1.2)), life: rnd(1.6, 2.6), rest: 0 });
  }
  const dq = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sv = new THREE.Vector3();
  function stepChunks(dt) {
    for (const im of Object.values(chunks)) im.count = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const c = live[i];
      c.life -= dt;
      if (c.life <= 0) { live.splice(i, 1); continue; }
      if (c.rest < 1) {
        c.v.y -= 18 * dt; c.p.addScaledVector(c.v, dt);
        const lo = floorY + c.s.y * 0.8;
        if (c.p.y < lo) { c.p.y = lo; if (Math.abs(c.v.y) > 1.2) { c.v.y *= -0.32; c.v.x *= 0.6; c.v.z *= 0.6; c.w.multiplyScalar(0.5); } else { c.v.set(0, 0, 0); c.rest = 1; } }
        const wl = c.w.length(); if (wl > 0 && c.rest < 1) { dq.setFromAxisAngle(sv.copy(c.w).divideScalar(wl), wl * dt); c.q.premultiply(dq); }
      }
      const k = Math.min(1, c.life / 0.5), im = chunks[c.key];
      m4.compose(c.p, c.q, sv.copy(c.s).multiplyScalar(k));
      im.setMatrixAt(im.count++, m4);
    }
    for (const im of Object.values(chunks)) { im.instanceMatrix.needsUpdate = true; im.visible = im.count > 0; }
  }

  // ---------- dust, sparks ----------
  const dust = pointCloud(900, false, tex), sparks = pointCloud(300, true, tex);
  group.add(dust.pts, sparks.pts);
  const cA = new THREE.Color();
  function puff(cloud, x, y, z, color, o = {}) {
    const cap = cloud.max * (quality >= 2 ? 1 : quality === 1 ? 0.6 : 0.35);
    if (cloud.list.length >= cap) return;
    cA.set(color);
    cloud.list.push({ x, y, z, vx: o.vx ?? rnd(-0.6, 0.6), vy: o.vy ?? rnd(0.2, 1.2), vz: o.vz ?? rnd(-0.3, 0.8), size: o.size ?? rnd(0.3, 0.7), grow: o.grow ?? 1.2, life: o.life ?? rnd(0.8, 1.6), max: 0, a: o.a ?? 0.55, r: cA.r, g: cA.g, b: cA.b, drag: o.drag ?? 1.8, grav: o.grav ?? -0.2 });
    cloud.list[cloud.list.length - 1].max = cloud.list[cloud.list.length - 1].life;
  }
  function stepCloud(c, dt) {
    let n = 0;
    for (let i = c.list.length - 1; i >= 0; i--) {
      const p = c.list[i];
      p.life -= dt;
      if (p.life <= 0) { c.list.splice(i, 1); continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt * 9.8 * (p.grav > 0 ? 1 : 0.1);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < floorY + 0.02) { p.y = floorY + 0.02; p.vy = Math.abs(p.vy) * 0.2; }
      const f = p.life / p.max;
      c.pos[n * 3] = p.x; c.pos[n * 3 + 1] = p.y; c.pos[n * 3 + 2] = p.z;
      c.col[n * 3] = p.r; c.col[n * 3 + 1] = p.g; c.col[n * 3 + 2] = p.b;
      c.size[n] = p.size * (1 + (1 - f) * p.grow); c.alpha[n] = p.a * Math.min(1, f * 2.2) * Math.min(1, (1 - f) * 12 + 0.3);
      n++;
    }
    c.geo.setDrawRange(0, n); c.pts.visible = n > 0;
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) c.geo.attributes[k].needsUpdate = true;
  }

  // ---------- confetti ----------
  const CF = 260, confGeo = new THREE.PlaneGeometry(0.07, 0.11), confM = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.15 });
  const conf = new THREE.InstancedMesh(confGeo, confM, CF); conf.count = 0; conf.frustumCulled = false; group.add(conf);
  const confList = [], CONF_C = ['#e8384f', '#ffd23f', '#2f6fd6', '#3fae5a', '#ff8ae2', '#ff9f43', '#ffffff'];
  function confetti(x, y, z, n) { for (let k = 0; k < n && confList.length < CF; k++) { const c = new THREE.Color(CONF_C[k % CONF_C.length]); confList.push({ p: new THREE.Vector3(x + rnd(-3, 3), y + rnd(0, 2), z + rnd(-0.5, 1.5)), v: new THREE.Vector3(rnd(-1.5, 1.5), rnd(1, 5), rnd(0, 2)), a: rnd(0, TAU), w: rnd(4, 12), c, life: rnd(3, 5) }); } }
  const qc = new THREE.Quaternion(), ec = new THREE.Euler();
  function stepConfetti(dt, t) {
    conf.count = 0;
    for (let i = confList.length - 1; i >= 0; i--) {
      const c = confList[i];
      c.life -= dt; if (c.life <= 0 || c.p.y < floorY) { confList.splice(i, 1); continue; }
      c.v.y = Math.max(-1.1, c.v.y - 6 * dt); c.v.x *= 0.98; c.p.addScaledVector(c.v, dt); c.p.x += Math.sin(t * 3 + c.a) * 0.4 * dt; c.a += c.w * dt;
      qc.setFromEuler(ec.set(c.a, c.a * 0.7, c.a * 0.3)); m4.compose(c.p, qc, sv.set(1, 1, 1));
      conf.setMatrixAt(conf.count, m4); conf.setColorAt(conf.count, c.c); conf.count++;
    }
    conf.instanceMatrix.needsUpdate = true; if (conf.instanceColor) conf.instanceColor.needsUpdate = true; conf.visible = conf.count > 0;
  }

  // ---------- flashes and streaks ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 16, 128); return new THREE.CanvasTexture(c); })();
  const bars = [];
  function bar(x, y, z, w, h, color, life, { grow = 0, tex: t = null } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(x, y, z); m.renderOrder = 6; group.add(m);
    bars.push({ m, life, max: life, grow });
  }
  const streak = (x, yTop, yBot, z, color) => bar(x, (yTop + yBot) / 2, z, 0.44, Math.max(0.1, yTop - yBot), color, 0.22, { tex: glowTex });
  function stepBars(dt) {
    for (let i = bars.length - 1; i >= 0; i--) {
      const b = bars[i];
      b.life -= dt;
      if (b.life <= 0) { group.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); bars.splice(i, 1); continue; }
      const f = b.life / b.max;
      b.m.material.opacity = f * f; if (b.grow) b.m.scale.y = 1 + (1 - f) * b.grow;
    }
  }

  // ---------- callouts: gold lettering in the world ----------
  const TEXT = new Map();
  function textTex(text, { color = 'gold', size = 120, sub = false } = {}) {
    const key = text + color + size;
    if (TEXT.has(key)) return TEXT.get(key);
    const c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = `italic 900 ${size}px "Barlow Condensed", "Baloo 2", sans-serif`;
    const w = Math.ceil(x.measureText(text).width + size * 0.6), h = Math.ceil(size * 1.35);
    c.width = w; c.height = h;
    x.font = `italic 900 ${size}px "Barlow Condensed", "Baloo 2", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = size * 0.16; x.strokeStyle = '#120d14'; x.strokeText(text, w / 2, h / 2 + size * 0.05);
    const g = x.createLinearGradient(0, h * 0.2, 0, h * 0.85);
    const C = { gold: ['#fffbe0', '#ffd23f', '#e8741c'], pink: ['#fff0fa', '#ff8ae2', '#c0308a'], blue: ['#f0fbff', '#9ad7ff', '#2f6fd6'], green: ['#f0fff4', '#7cf29a', '#1f9a4a'], orange: ['#fff4e0', '#ffb36b', '#e8581c'], white: ['#ffffff', '#fff8e1', '#d8c9a0'] }[color];
    g.addColorStop(0, C[0]); g.addColorStop(0.5, C[1]); g.addColorStop(1, C[2]);
    x.fillStyle = g; x.fillText(text, w / 2, h / 2 + size * 0.05);
    if (!sub) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, h * 0.18, w, h * 0.14); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const out = { t, aspect: w / h };
    TEXT.set(key, out);
    return out;
  }
  const calls = [];
  function callout(text, x, y, z, { color = 'gold', height = 0.9, life = 1.3, delay = 0, rise = 0.8 } = {}) {
    const { t, aspect } = textTex(text, { color });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    s.renderOrder = 20; s.position.set(x, y, z); s.visible = false; group.add(s);
    calls.push({ s, t: -delay, life, h: height, aspect, y0: y, rise });
  }
  function stepCalls(dt) {
    for (let i = calls.length - 1; i >= 0; i--) {
      const c = calls[i];
      c.t += dt;
      if (c.t < 0) continue;
      c.s.visible = true;
      if (c.t > c.life) { group.remove(c.s); c.s.material.dispose(); calls.splice(i, 1); continue; }
      const k = c.t / c.life, pop = c.t < 0.16 ? 1.5 - Math.sin((c.t / 0.16) * Math.PI / 2) * 0.5 : 1; // lands big, then settles
      const sc = c.h * (reduced ? 1 : pop);
      c.s.scale.set(sc * c.aspect, sc, 1);
      c.s.position.y = c.y0 + (reduced ? 0 : k * c.rise);
      c.s.material.opacity = Math.min(1, (1 - k) * 4) * Math.min(1, c.t * 12);
    }
  }

  // ---------- rain ----------
  let rain = null;
  function makeRain(n) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 6), seed = new Float32Array(n * 2), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const x = rnd(-16, 16), y = rnd(0, 18), z = rnd(-6, 12); for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); seed[i * 2 + k] = Math.random(); end[i * 2 + k] = k; } }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, wind: { value: 2.5 }, strength: { value: 1 }, flash: { value: 0 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aSeed, aEnd; uniform float time, wind; varying float vE; void main(){ vec3 p = position; float sp = 17.0 + aSeed * 6.0; float y = mod(p.y - time * sp, 18.0); p.y = y - 0.2; p.x += wind * (y / sp) + wind * aEnd * 0.035; p.y += aEnd * 0.55; vE = aEnd; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float strength, flash; varying float vE; void main(){ gl_FragColor = vec4(vec3(0.75, 0.82, 0.92) + flash, (0.03 + vE * 0.14) * strength); }',
    });
    const l = new THREE.LineSegments(geo, m); l.frustumCulled = false; l.renderOrder = 4;
    return l;
  }
  function setRain(on, n = 1800) {
    if (on && !rain) { rain = makeRain(n); group.add(rain); }
    if (rain) rain.visible = on;
  }

  function update(dt, t, o = {}) {
    reduced = !!o.reduced;
    stepChunks(dt); stepCloud(dust, dt); stepCloud(sparks, dt); stepConfetti(dt, t); stepBars(dt); stepCalls(dt);
    if (rain && rain.visible) { rain.material.uniforms.time.value = t; rain.material.uniforms.wind.value = o.wind ?? 2.5; rain.material.uniforms.flash.value = o.flash || 0; }
    // splashes on the slab while it rains
    if (rain && rain.visible && quality > 0) for (let k = 0; k < 3; k++) puff(sparks, rnd(-9, 9), floorY + 0.03, rnd(-3, 5), '#9fb4c8', { vx: 0, vy: 0.4, vz: 0, size: 0.12, grow: 1.5, life: 0.25, a: 0.5, drag: 6 });
  }
  function clear() { live.length = 0; dust.list.length = 0; sparks.list.length = 0; confList.length = 0; for (const b of bars) group.remove(b.m); bars.length = 0; for (const c of calls) group.remove(c.s); calls.length = 0; }
  function setScale(px) { dust.m.uniforms.scale.value = px; sparks.m.uniforms.scale.value = px; }
  return {
    group, chunk, puff: (x, y, z, c, o) => puff(dust, x, y, z, c, o), spark: (x, y, z, c, o) => puff(sparks, x, y, z, c, o), confetti, bar, streak, callout, setRain, update, clear, setScale,
    set quality(q) { quality = q; }, get busy() { return live.length + dust.list.length; },
  };
}
