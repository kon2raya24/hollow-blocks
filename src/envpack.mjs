// Real surroundings for the site: CC0 scans from Poly Haven (converted by the Bakbakan tools).
// - photographed skies: one lights and reflects everything, and five are seen behind (golden hour, dusk,
//   night, noon, a storm), graded for the time of day
// - the big surfaces (the slab, the ground, the road, roofs, walls, the kubo's sawali and nipa) get
//   scanned materials
// - real props stand where a site and a street would have them: cement bags on their pallets, a drum
//   of water, a generator, floodlights, a ladder, tools, chairs at the sari-sari store, trees
// Without the files, the painted site stays as it is.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';
import { HDRLoader } from './vendor/three-fx.min.js';
import { mergeStatic } from './site.mjs';

// the image light: [photo, strength, turn]
const IBL = { day: ['kloppenheim_06_puresky', 1, 2.2], storm: ['kloofendal_overcast_puresky', 1, 0] };
// the skies seen behind, one per time of day
const BACKDROPS = ['golden', 'dusk', 'night', 'noon', 'storm'];
// what each tagged surface becomes: [Poly Haven material, metres a tile covers, tint]
const SURF = {
  slab: ['concrete_floor_worn_001', 3, '#e8e2d6'], ground: ['gravel_ground_01', 3.2, '#c8bca8'], road: ['asphalt_02', 3, '#b0aca4'],
  roof: ['rusty_corrugated_iron', 2, '#ffffff'], plaster: ['damaged_plaster', 2.2, null], sawali: ['bamboo_wall', 1.4, '#ffffff'], nipa: ['thatch_roof_angled', 1.6, '#ffffff'],
};
// [prop, x, y, z, turn, height (0: its own size), tilt]
const PLACES = [
  ['Barrel_01', -6.3, 0, -0.6, 0.4, 0.9], ['portable_generator', -7.3, 0, 1.9, 0.9, 0], ['metal_jerrycan', -6.5, 0, 2.3, -0.4, 0], ['metal_toolbox', -5.6, 0, 1.3, 0.3, 0],
  ['wooden_bucket_02', -3.6, 0, 2.2, 0, 0.32], ['trowel_01', -3.9, 0, 2.6, 1.2, 0], ['sledgehammer_01', 2.9, 0, 4.7, 0.6, 0],
  ['compost_bags', 6.6, 0, 4.2, -0.3, 0], ['WetFloorSign_01', 1.3, 0, 5.1, -0.3, 0.75], ['hand_truck', 7.2, 0, -0.8, 0.6, 0],
  ['wooden_ladder', 6.9, 0, -0.2, 0.15, 4.2, -0.28], ['boombox', -4.9, 'sacks', 2.9, 0.5, 0],
  ['concrete_road_barrier', -1.8, -0.14, -11.6, 0, 0], ['concrete_road_barrier', 2.4, -0.14, -11.7, 0.05, 0],
  ['plastic_monobloc_chair_01', 'shop', -1.6, 1.7, 0.4, 0], ['plastic_monobloc_chair_01', 'shop', 1.7, 1.8, -0.3, 0], ['plastic_crate_02', 'shop', 2.6, 0.9, 0.2, 0], ['small_lpg_tank', 'shop', -2.5, 0.8, 0, 0],
  ['old_tyre', -15.5, -0.14, -17.6, 1.4, 0], ['trashbag', -12.8, -0.14, -18, 0.3, 0],
];

export async function loadEnv(base = 'assets/env/') {
  const res = await fetch(base + 'env.json');
  if (!res.ok) throw new Error('no env');
  return { base, index: await res.json(), props: new Map(), tex: new Map() };
}

const gltf = new GLTFLoader(), texLoader = new THREE.TextureLoader();
const loadProp = (env, id) => {
  if (!env.index.props[id]) return Promise.resolve(null);
  if (!env.props.has(id)) env.props.set(id, gltf.loadAsync(env.base + 'props/' + id + '.glb').then((g) => g.scene).catch(() => null));
  return env.props.get(id);
};
const loadTex = (env, id) => {
  const t = env.index.tex[id];
  if (!t) return Promise.resolve(null);
  if (!env.tex.has(id)) env.tex.set(id, Promise.all(['diff', 'nor', 'arm', 'rough'].map((k) => (t[k] ? texLoader.loadAsync(env.base + t[k]).catch(() => null) : null))).then(([diff, nor, arm, rough]) => {
    if (diff) diff.colorSpace = THREE.SRGBColorSpace;
    for (const x of [diff, nor, arm, rough]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; }
    return { diff, nor, arm, rough };
  }));
  return env.tex.get(id);
};

// Dress the site. `ctx` is the view: its image-light generator, and where the skies go.
export async function dress(env, site, ctx) {
  const jobs = [];
  // the image light
  for (const [key, [id, power, turn]] of Object.entries(IBL)) {
    if (!env.index.sky[id]) continue;
    jobs.push(new HDRLoader().loadAsync(env.base + env.index.sky[id]).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; const rt = ctx.pmrem.fromEquirectangular(t); t.dispose(); ctx.setEnvironment(key, rt.texture, power, turn); }).catch(() => { /* painted light stays */ }));
  }
  // the skies behind
  for (const id of BACKDROPS) {
    const f = env.index.backdrop && env.index.backdrop[id];
    if (!f) continue;
    jobs.push(texLoader.loadAsync(env.base + f).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; ctx.setBackdrop(id, t); }).catch(() => { /* the painted sky stays */ }));
  }
  // the surfaces
  const mats = new Map();
  const scan = (root) => root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.userData.surface) mats.set(m, m.userData.surface); });
  scan(site.world); scan(site.dyn); if (ctx.extra) for (const r of ctx.extra()) scan(r);
  for (const [m, s] of mats) jobs.push((async () => {
    const [texId, tile, tint] = SURF[s.kind] || [];
    const t = texId && (await loadTex(env, texId));
    if (!t || !t.diff) return;
    const rep = [s.w / tile, s.h / tile], use = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(...rep); c.needsUpdate = true; return c; };
    if (s.detail) { m.normalMap = use(t.nor); m.normalScale = new THREE.Vector2(0.8, 0.8); m.needsUpdate = true; return; }
    m.map = use(t.diff); m.normalMap = use(t.nor); m.normalScale = new THREE.Vector2(1, 1);
    if (t.arm) { m.roughnessMap = use(t.arm); m.aoMap = use(t.arm); m.aoMapIntensity = 0.7; m.metalnessMap = s.kind === 'roof' ? use(t.arm) : null; m.metalness = s.kind === 'roof' ? 1 : 0; }
    m.roughness = 1; if (tint) m.color.set(tint);
    m.needsUpdate = true;
  })());
  // the props
  const group = new THREE.Group(); group.name = 'real props';
  const sackTop = 0.12 + 4 * 0.17;
  const placed = new Set();
  for (const [pid, x0, y0, z0, ry, h, tilt] of PLACES) jobs.push(loadProp(env, pid).then((tpl) => {
    if (!tpl) return;
    const info = env.index.props[pid], o = tpl.clone();
    const shop = x0 === 'shop', x = shop ? site.street.shop.x + y0 : x0, y = shop ? -0.14 : y0 === 'sacks' ? sackTop : y0, z = shop ? site.street.shop.z + z0 : z0;
    o.position.set(x, y, z); o.rotation.set(tilt || 0, shop ? ry : ry, 0, 'YXZ');
    if (h && info.size) o.scale.setScalar(h / info.size[1]);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    group.add(o); placed.add(pid);
  }));
  // cement bags on the two pallets, in alternating courses
  jobs.push(loadProp(env, 'cement_bag').then((tpl) => {
    if (!tpl) return;
    const sz = env.index.props.cement_bag.size, k = 0.6 / Math.max(sz[0], sz[2]);
    for (const [cx, cz, rows, ry] of [[-5.1, 2.9, 4, 0.3], [-7.0, 3.4, 2, -0.2]]) for (let r = 0; r < rows; r++) for (let n = 0; n < 4; n++) {
      const alt = r % 2, a = ry + (alt ? Math.PI / 2 : 0) + (Math.random() - 0.5) * 0.12, off = alt ? [(n % 2 - 0.5) * 0.46, (Math.floor(n / 2) - 0.5) * 0.46] : [(n - 1.5) * 0.3, 0];
      const o = tpl.clone(); o.scale.setScalar(k);
      o.position.set(cx + off[0] * Math.cos(ry) + off[1] * Math.sin(ry), 0.12 + r * sz[1] * k * 0.92, cz - off[0] * Math.sin(ry) + off[1] * Math.cos(ry)); o.rotation.y = a;
      o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      group.add(o);
    }
    placed.add('cement_bag');
  }));
  await Promise.all(jobs);
  mergeStatic(group);
  site.world.add(group);
  // the painted stand-ins the real ones replace
  const hide = (root) => root.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => placed.has(m.userData.standIn))) o.visible = false; });
  hide(site.world); hide(site.dyn);
  return placed;
}
