// The tools, seen: a martilyo swinging down on the stack, semento pouring from a bucket into the holes,
// the kreyn's hook lowering the new kawayan, a pison rolling across the top, a merienda clock that slows.
// Each is a short show in the world; the rules have already done the work.
import * as THREE from './vendor/three.module.min.js';

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
function part(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; }

export function createToolFx(scene, { cx, cy, top, fx, CS }) {
  const steel = M('#8a9094', { metalness: 0.8, roughness: 0.35 }), wood = M('#9a6a3a', { roughness: 0.7 }), yellow = M('#ffc81e', { roughness: 0.45 });
  // the martilyo
  const hammer = new THREE.Group();
  const handle = part(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 10), wood, 0, -0.8, 0); hammer.add(handle);
  hammer.add(part(new THREE.BoxGeometry(0.55, 0.3, 0.3), steel, 0, -1.6, 0));
  hammer.visible = false; scene.add(hammer);
  // the semento bucket and its stream
  const bucket = part(new THREE.CylinderGeometry(0.3, 0.22, 0.4, 16, 1, true), M('#d84a2a', { side: THREE.DoubleSide })); bucket.visible = false; scene.add(bucket);
  const streamM = M('#9a9c9a', { roughness: 0.3 }), streams = [];
  // the kreyn: a cable and a hook
  const cable = part(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), M('#2a2a2a')), hook = new THREE.Group();
  hook.add(part(new THREE.BoxGeometry(0.5, 0.18, 0.18), yellow, 0, 0.1, 0), part(new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI * 1.4), steel, 0, -0.12, 0));
  cable.visible = hook.visible = false; scene.add(cable, hook);
  // the pison: a road roller, drum in front, cab on top
  const roller = new THREE.Group();
  const drum = part(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 20), steel); drum.rotation.x = Math.PI / 2; roller.add(drum);
  roller.add(part(new THREE.BoxGeometry(1.0, 0.55, 1.0), yellow, -0.75, 0.15, 0), part(new THREE.BoxGeometry(0.55, 0.5, 0.8), M('#2a3440', { roughness: 0.2, metalness: 0.4 }), -0.85, 0.65, 0));
  const back = part(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 16), M('#1a1a1a')); back.rotation.x = Math.PI / 2; back.position.set(-1.25, -0.12, 0); roller.add(back);
  roller.scale.setScalar(0.75); roller.visible = false; scene.add(roller);
  hammer.scale.setScalar(1.5);
  // the merienda clock
  const clockC = document.createElement('canvas'); clockC.width = clockC.height = 256;
  const clockT = new THREE.CanvasTexture(clockC); clockT.colorSpace = THREE.SRGBColorSpace;
  const clock = new THREE.Sprite(new THREE.SpriteMaterial({ map: clockT, transparent: true, depthTest: false, toneMapped: false })); clock.renderOrder = 19; clock.visible = false; scene.add(clock);
  function drawClock(a, label) {
    const x = clockC.getContext('2d'); x.clearRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,248,225,0.95)'; x.strokeStyle = '#120d14'; x.lineWidth = 12; x.beginPath(); x.arc(128, 120, 90, 0, Math.PI * 2); x.fill(); x.stroke();
    x.strokeStyle = '#e8741c'; x.lineWidth = 10; x.beginPath(); x.arc(128, 120, 72, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2); x.stroke();
    x.strokeStyle = '#120d14'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(128, 120); x.lineTo(128 + Math.sin(a * 40) * 55, 120 - Math.cos(a * 40) * 55); x.stroke();
    x.font = 'italic 900 34px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#120d14'; x.fillText(label, 128, 248);
    clockT.needsUpdate = true;
  }
  let show = null; // { kind, t, dur, ... }

  function play(e) {
    const cells = e.cells || [];
    if (e.tool === 'martilyo') {
      const xs = cells.length ? cells.map(([x]) => cx(x)) : [0], X = xs.reduce((a, b) => a + b, 0) / xs.length, Y = cells.length ? Math.max(...cells.map(([, y]) => cy(y))) : top - 2;
      show = { kind: 'martilyo', t: 0, dur: 0.75, X, Y, cells, hit: false };
    } else if (e.tool === 'semento') show = { kind: 'semento', t: 0, dur: 1.1, cells, X: cells.length ? cells.reduce((a, [x]) => a + cx(x), 0) / cells.length : 0 };
    else if (e.tool === 'kreyn') show = { kind: 'kreyn', t: 0, dur: 1.2 };
    else if (e.tool === 'pison') show = { kind: 'pison', t: 0, dur: 1.1, cells, Y: cells.length ? Math.min(...cells.map(([, y]) => cy(y))) - CS / 2 : 1 };
    else if (e.tool === 'merienda') show = { kind: 'merienda', t: 0, dur: 2.2 };
  }
  const chunkOf = (v) => ({ 1: 'kawayan', 2: 'hollow', 3: 'ladrilyo', 4: 'yero', 5: 'plywood', 6: 'baldosa', 7: 'adobe', 8: 'putik', 9: 'semento' }[v] || 'hollow');
  function burst(cells, kick) {
    for (const [x, y, v] of cells) {
      for (let k = 0; k < 3; k++) fx.chunk(chunkOf(v), cx(x), cy(y), 0.2, (Math.random() - 0.5) * 3, 1 + Math.random() * 3, 1 + Math.random() * 2.5, 0.06 + Math.random() * 0.06);
      fx.puff(cx(x), cy(y), 0.3, '#d8ccb8', { size: 0.6 + Math.random() * 0.5, vy: 0.5, vz: 1, life: 1.2, a: 0.45 });
    }
    if (kick) kick();
  }
  // o: { slowT (ticks left of a merienda), piece: { x, y } where the current piece is, kick() }
  function update(dt, o = {}) {
    hammer.visible = bucket.visible = cable.visible = hook.visible = roller.visible = false;
    for (const s of streams) s.visible = false;
    if (show) {
      show.t += dt;
      const k = Math.min(1, show.t / show.dur);
      if (show.kind === 'martilyo') {
        hammer.visible = true;
        const swing = k < 0.45 ? -1.6 + ease(k / 0.45) * 0.5 : k < 0.6 ? -1.1 + ((k - 0.45) / 0.15) * 1.25 : 0.15 - (k - 0.6) * 0.4;
        hammer.position.set(show.X + 1.4, show.Y + 2.0, 0.6); hammer.rotation.set(0, 0, swing);
        if (k >= 0.6 && !show.hit) { show.hit = true; burst(show.cells, o.kick); }
      } else if (show.kind === 'semento') {
        bucket.visible = true; bucket.position.set(show.X, top + 1.2, 0.4); bucket.rotation.z = Math.min(1, k * 3) * 1.6;
        show.cells.forEach(([x, y], i) => {
          if (!streams[i]) { const s = part(new THREE.CylinderGeometry(0.07, 0.09, 1, 8), streamM); scene.add(s); streams[i] = s; }
          const s = streams[i], on = k > 0.2 && k < 0.85; s.visible = on;
          if (on) { const y0 = top + 1.0, y1 = cy(y); s.position.set(cx(x), (y0 + y1) / 2, 0.3); s.scale.set(1, y0 - y1, 1); if (Math.random() < 0.3) fx.puff(cx(x), y1, 0.3, '#b8bab8', { size: 0.25, vy: 0.4, vz: 0.6, life: 0.5, a: 0.5 }); }
        });
      } else if (show.kind === 'kreyn' && o.piece) {
        cable.visible = hook.visible = true;
        const down = k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.5), hy = top + 4 - down * (top + 4 - o.piece.y - 0.6);
        hook.position.set(o.piece.x, hy, 0.3); cable.position.set(o.piece.x, (hy + top + 6) / 2, 0.3); cable.scale.set(1, top + 6 - hy, 1);
      } else if (show.kind === 'pison') {
        roller.visible = true; const X = -4.2 + k * 8.4; roller.position.set(X, show.Y + 0.32, 0.35);
        drum.rotation.y = -k * 14;
        for (const c of show.cells) if (!c.done && cx(c[0]) < X + 0.4) { c.done = true; burst([c]); }
        if (k > 0.98 && o.kick) { o.kick(); show.t = show.dur; }
      } else if (show.kind === 'merienda') { /* the clock, below */ }
      if (show.t >= show.dur) show = null;
    }
    // the merienda clock: big when it starts, then small over the well while it lasts
    if (o.slowT > 0) {
      clock.visible = true;
      const intro = show && show.kind === 'merienda' ? 1 - Math.min(1, show.t / 0.8) : 0, sz = 0.9 + intro * 1.4;
      clock.scale.set(sz, sz, 1); clock.position.set(0, top + 1.0 + intro * -3, 0.8);
      drawClock(o.slowT / (15 * 60), `${Math.ceil(o.slowT / 60)}s`);
    } else clock.visible = false;
  }
  return { play, update, get busy() { return !!show; } };
}
