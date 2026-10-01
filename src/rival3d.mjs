// Laban in 3D: the rival's scaffold beside yours (the same steel standards, bamboo ledgers, sole board,
// platform and shade net, with the rival's name painted on a board on top), and the mud gauges: a stack
// of sacks beside each well, one per row of mud waiting to come up, amber while it waits and red once
// it is armed. The rival's scaffold stands on a raised plank deck, forward of the mixer and the ladder,
// so the site's props never hide its well. Built only when a match first starts.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { CS } from './blocks.mjs';
import { WELL, BASE_Y, mergeStatic } from './site.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function pole(a, b, r, m) {
  const d = b.clone().sub(a), mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m);
  mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
function nameTex(name, tag, color) {
  const c = T.canvas(512, 128), x = c.getContext('2d');
  x.fillStyle = '#20160f'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = color; x.fillRect(0, 0, 512, 14); x.fillRect(0, 114, 512, 14);
  for (let k = 0; k < 300; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * 512, Math.random() * 128, 3, 2); }
  x.textAlign = 'center'; x.fillStyle = '#ffd23f'; x.font = 'italic 900 58px "Barlow Condensed", sans-serif'; x.fillText(name.toUpperCase(), 256, 72);
  x.fillStyle = 'rgba(255,248,225,0.8)'; x.font = 'italic 800 24px "Barlow Condensed", sans-serif'; x.fillText(`KALABAN · ${tag.toUpperCase()}`, 256, 104);
  return T.toTex(c);
}

export function buildRivalRig(scene) {
  const group = new THREE.Group(); group.name = 'rival scaffold'; scene.add(group);
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa4aa', roughness: 0.38, metalness: 0.85 });
  const bambooT = T.rattan(33); bambooT.map.wrapS = bambooT.map.wrapT = THREE.RepeatWrapping; bambooT.map.repeat.set(1, 8);
  const bamboo = new THREE.MeshStandardMaterial({ map: bambooT.map, normalMap: bambooT.normalMap, color: '#d8cf7a', roughness: 0.5 });
  const plankT = T.planks(41, { size: 256, repeat: [2, 1], color: '#a87a48' });
  const plank = new THREE.MeshStandardMaterial({ map: plankT.map, normalMap: plankT.normalMap, roughness: 0.85 });
  const { x0, x1, top } = WELL, xs = [x0 - 0.22, x1 + 0.22], zs = [0.36, -0.42], H = top + 0.9;
  for (const x of xs) for (const z of zs) group.add(pole(V(x, 0, z), V(x, H, z), 0.032, steel));
  for (const x of xs) {
    for (let y = 1; y < H; y += 2) group.add(pole(V(x, y, zs[0] + 0.05), V(x, y, zs[1] - 0.05), 0.028, bamboo));
    for (let y = 1; y + 2 < H; y += 2) group.add(pole(V(x, y, zs[0]), V(x, y + 2, zs[1]), 0.024, bamboo));
  }
  for (let y = 1; y < H; y += 2) group.add(pole(V(xs[0] - 0.3, y, zs[1] - 0.06), V(xs[1] + 0.3, y, zs[1] - 0.06), 0.03, bamboo));
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; group.add(b); return b; };
  box(x1 - x0 + 0.9, BASE_Y, 0.9, plank, 0, BASE_Y / 2, -0.03);
  box(x1 - x0 + 1.2, 0.06, 1.1, plank, 0, top + 0.42, -0.03);
  group.add(pole(V(xs[0] - 0.2, top + 0.35, zs[0]), V(xs[1] + 0.2, top + 0.35, zs[0]), 0.03, steel));
  // the net, darker: the rival's side of the site
  const net = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 22 * CS), new THREE.MeshStandardMaterial({ color: '#26382f', roughness: 1, transparent: true, opacity: 0.95, depthWrite: false }));
  net.position.set(0, BASE_Y + 11 * CS, -0.3); net.renderOrder = 1; group.add(net);
  // the name board on the platform
  const signM = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, 0.06), [plank, plank, plank, plank, signM, plank]);
  sign.position.set(0, top + 1.05, 0.25); sign.castShadow = true; group.add(sign);
  for (const sx of [-1.7, 1.7]) group.add(pole(V(sx, top + 0.45, 0.2), V(sx, top + 0.6, 0.2), 0.03, steel));
  // a red flag on the far standard: the other crew
  const flagM = new THREE.MeshStandardMaterial({ color: '#c8322a', roughness: 0.7, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5, 8, 1), flagM); flag.position.set(xs[1] + 0.4, H + 0.2, zs[0]); flag.userData.keep = true; group.add(flag, pole(V(xs[1], H, zs[0]), V(xs[1], H + 0.5, zs[0]), 0.02, steel));

  net.userData.keep = true;
  mergeStatic(group); // a few draw calls for the whole scaffold
  // the gauges: sacks of mud, instanced, one stack beside each well (0: yours, 1: the rival's)
  const sackGeo = new THREE.CylinderGeometry(0.12, 0.14, CS * 0.86, 10, 1); sackGeo.rotateZ(Math.PI / 2); sackGeo.scale(1, 1, 0.8);
  const sackM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, emissive: '#ff3a10', emissiveIntensity: 0 });
  const sacks = new THREE.InstancedMesh(sackGeo, sackM, 48); sacks.count = 0; sacks.frustumCulled = false; sacks.castShadow = true; scene.add(sacks);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3(), col = new THREE.Color();
  const shown = [0, 0]; // eased stack heights
  // the deck: planks on steel legs with braces, rebuilt whenever the rig is placed
  const deck = new THREE.Group(); deck.name = 'rival deck'; scene.add(deck);
  function buildDeck(rx, s, lift, z) {
    deck.clear();
    const w = (x1 - x0 + 1.4) * s, d = 1.5 * s;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), plank); top.position.set(rx, lift - 0.06, z - 0.03 * s); top.castShadow = true; top.receiveShadow = true; deck.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) deck.add(pole(V(rx + sx * (w / 2 - 0.1), 0, z + sz * (d / 2 - 0.1)), V(rx + sx * (w / 2 - 0.1), lift - 0.1, z + sz * (d / 2 - 0.1)), 0.035, steel));
    for (const sz of [-1, 1]) deck.add(pole(V(rx - w / 2 + 0.1, 0.15, z + sz * (d / 2 - 0.1)), V(rx + w / 2 - 0.1, lift - 0.2, z + sz * (d / 2 - 0.1)), 0.025, bamboo));
    const toe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.04), plank); toe.position.set(rx, lift + 0.05, z + d / 2); deck.add(toe);
  }
  const cWait = new THREE.Color('#b8862a'), cArmed = new THREE.Color('#e8402a');
  return {
    group, sacks, S: 1, RX: 9, LIFT: 1.5, Z: 0.9,
    setName(name, tag, color) { signM.map = nameTex(name, tag, color); signM.needsUpdate = true; },
    place(rx, s, lift, z) { Object.assign(this, { RX: rx, S: s, LIFT: lift, Z: z }); group.position.set(rx, lift, z); group.scale.setScalar(s); buildDeck(rx, s, lift, z); },
    show(on) { group.visible = on; sacks.visible = on; deck.visible = on; },
    // gauges: [{ x, s, y, z, list: incoming entries }] in world units
    gauges(list, dt, t) {
      sacks.count = 0;
      list.forEach((gg, i) => {
        let n = 0; for (const e of gg.list) n += e.n;
        shown[i] += (Math.min(20, n) - shown[i]) * Math.min(1, dt * 10);
        let row = 0;
        for (const e of gg.list) for (let k = 0; k < e.n && row < 20 && sacks.count < 48; k++, row++) {
          if (row >= shown[i] + 0.5) break;
          const armed = e.t <= 0, wob = armed ? Math.sin(t * 14 + row) * 0.012 : 0;
          m4.compose(vp.set(gg.x + wob, (gg.y || 0) + (BASE_Y + (row + 0.5) * CS) * gg.s, (gg.z || 0) + 0.38 * gg.s), q, vs.setScalar(gg.s));
          sacks.setMatrixAt(sacks.count, m4); sacks.setColorAt(sacks.count, col.copy(armed ? cArmed : cWait)); sacks.count++;
        }
      });
      sacks.instanceMatrix.needsUpdate = true; if (sacks.instanceColor) sacks.instanceColor.needsUpdate = true;
      sackM.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 10);
      flag.geometry.attributes.position.array.forEach((_, k, a) => { if (k % 3 === 2) { const x = a[k - 2] + 0.4; a[k] = Math.sin(x * 6 - t * 5) * 0.05 * x; } });
      flag.geometry.attributes.position.needsUpdate = true;
    },
  };
}
