// The 3D construction site for Hollow Blocks, in three.js. It reads the rules (game.mjs) and their
// events and never changes them. The well is a steel-and-bamboo scaffold on a concrete slab; every
// block is its material (blocks.mjs); the site, the house going up and the street are built in code
// (site.mjs) and dressed with real scans when they load (envpack.mjs). Kapatas watches from the slab,
// motion-captured when the files are there (foreman.mjs), else made in code (folk.mjs). The frame goes
// through the film look (post.mjs).
//
// The camera never moves while a piece is in play: it frames the well to fit the screen, and only kicks
// a few centimetres on impacts (not at all with reduced motion). The cinematic shots (the establishing
// swoop, a Bayanihan, a new floor) play only while no piece is live, and the page stretches the rules'
// short clear pause to cover them.
//
// Laban (versus) adds the rival's scaffold beside yours (rival3d.mjs) and draws its game there, with a
// stack of mud sacks by each well for the rows waiting to come up; the camera widens to take in both.
// Pagsasanay (training) draws the lesson's target as a pulsing gold ghost.
//
// Chapter 2: a brownout darkens the well but for a flashlight cone on the piece; the wind blows dust
// across; cracked blocks show grey and shake before they crumble; the City Inspector walks the site
// (inspector3d.mjs) and his stamps land in red. The plumada's hint is a blue ghost under a plumb bob.
import * as THREE from './vendor/three.module.min.js';
import { COLS, ROWS, HIDDEN, CLEAR_T, READY, cellsOf, ghostOf } from './game.mjs';
import { SHAPES } from './pieces.mjs';
import { CS, KEYS, TYPE_KEY, FEEL, makeMaterials, blockGeometry, ghostTexture, GHOST_COLORS } from './blocks.mjs';
import { buildSite, WELL, BASE_Y } from './site.mjs';
import { createFx } from './fx.mjs';
import { createPost } from './post.mjs';
import { mergeGeometries } from './vendor/three-extra.min.js';
import { person, posePerson, kapatasLook, parade as makeParade } from './folk.mjs';
import { dress } from './envpack.mjs';
import { foremanModel, driveForeman, foremanEvent } from './foreman.mjs';
import { buildCrowd } from './crowd.mjs';
import { createToolFx } from './toolfx.mjs';
import { TOOLS } from './game.mjs';
import { buildRivalRig } from './rival3d.mjs';
import { createInspector } from './inspector3d.mjs';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const rnd = (a, b) => a + Math.random() * (b - a);
export const cx = (x) => WELL.x0 + (x + 0.5) * CS;
export const cy = (y) => BASE_Y + (ROWS - 1 - y + 0.5) * CS;

// The light at each time of day: [sun direction, sun colour, sun strength, sky, ground, hemi strength,
// fog colour, fog near, far, exposure, image light, the painted sky's top, middle, horizon]
const TOD = {
  golden: { sun: [-0.72, 0.36, 0.6], sunC: '#ffb870', sunI: 4.2, sky: '#a8c4e8', gnd: '#a07a58', hemi: 1.1, fog: '#e2c2a4', near: 45, far: 170, exp: 1.05, env: 0.8, top: '#5a8ad0', mid: '#e8b8a0', low: '#ffd8a0', glow: '#ffcf8a', grade: 'golden', lamps: 0 },
  dusk: { sun: [-0.8, 0.14, 0.5], sunC: '#ff7a48', sunI: 1.9, sky: '#8a82b8', gnd: '#5a4040', hemi: 0.7, fog: '#a88a9a', near: 35, far: 140, exp: 1.08, env: 0.4, top: '#3a4a8a', mid: '#b87a9a', low: '#ff9a6a', glow: '#ff8a50', grade: 'dusk', lamps: 0.6 },
  night: { sun: [0.45, 0.62, 0.5], sunC: '#8aa4e0', sunI: 0.55, sky: '#2a3658', gnd: '#15151c', hemi: 0.5, fog: '#1a2232', near: 30, far: 120, exp: 1.15, env: 0.18, top: '#0a1024', mid: '#1a2444', low: '#2a3050', glow: '#8aa0d0', grade: 'night', lamps: 1 },
  noon: { sun: [0.22, 0.94, 0.38], sunC: '#fff2dc', sunI: 3.6, sky: '#c4dcff', gnd: '#c0ae90', hemi: 1.15, fog: '#eae4d4', near: 50, far: 190, exp: 0.98, env: 0.7, top: '#4a8ae0', mid: '#a8ccf0', low: '#f0ecdc', glow: '#fff8e8', grade: 'noon', lamps: 0 },
  storm: { sun: [-0.3, 0.85, 0.42], sunC: '#aebccc', sunI: 0.8, sky: '#8a96a8', gnd: '#46484a', hemi: 1.1, fog: '#5e6874', near: 18, far: 85, exp: 1.12, env: 0.45, top: '#3a4450', mid: '#5a6470', low: '#7a848e', glow: '#9aa4b0', grade: 'storm', lamps: 0.8 },
};
const TOD_KEYS = ['sun', 'sunI', 'hemi', 'near', 'far', 'exp', 'env', 'lamps'];

export function createView(canvas, { low = false, gfx = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const maxPR = low ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e2c2a4', 45, 170);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
  scene.add(camera);
  const fixed = gfx !== null && gfx !== '' && gfx !== undefined;
  const post = createPost(renderer, scene, camera, { level: fixed ? +gfx : low ? 1 : 2, auto: !fixed });
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight('#a8c4e8', '#a07a58', 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffb870', 3.4);
  sun.castShadow = true;
  const setShadowSize = (n) => { if (sun.shadow.mapSize.x === n) return; sun.shadow.mapSize.set(n, n); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } };
  setShadowSize(low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -8, near: 1, far: 90 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
  scene.add(sun, sun.target); sun.target.position.set(0, 3, -1);
  // a soft cool fill from the camera side, so the faces of the blocks never go dead in shadow
  const fill = new THREE.DirectionalLight('#c8d8ff', 0.35); fill.position.set(4, 6, 20); scene.add(fill);
  // the piece in hand lights the wall around it, in its own colour
  const pieceLight = new THREE.PointLight('#ffffff', 0, 3.2, 1.8); scene.add(pieceLight);
  // work lights on the scaffold for dusk, night and storm
  const lamps = [];
  for (const [x, y, z] of [[-3.3, 2.1, 4.6], [3.3, 2.1, 4.6]]) {
    const s = new THREE.SpotLight('#ffe2b0', 0, 30, 0.6, 0.8, 1.4); s.position.set(x, y, z); s.target.position.set(0, 4.5, 0); s.castShadow = false;
    scene.add(s, s.target);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.14), new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#fff0c8', emissiveIntensity: 0, roughness: 0.4 }));
    head.position.set(x, y, z); head.lookAt(0, 4.5, 0); scene.add(head);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, y, 8), new THREE.MeshStandardMaterial({ color: '#3a3a3a', metalness: 0.6, roughness: 0.4 })); stand.position.set(x, y / 2, z); stand.castShadow = true; scene.add(stand);
    for (let k = 0; k < 3; k++) { const a = k * 2.1, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), stand.material); leg.position.set(x + Math.cos(a) * 0.2, 0.35, z + Math.sin(a) * 0.2); leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); scene.add(leg); }
    lamps.push({ s, head });
  }

  // ---------- the sky: painted, until a photographed one loads ----------
  const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: new THREE.Color() } };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, mid, low, sunDir, glow; varying vec3 v; void main(){ float h = v.y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.6, h)) : mix(low, mid, smoothstep(-0.05, 0.08, h)); float s = max(dot(v, sunDir), 0.0); c += glow * (pow(s, 200.0) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12); gl_FragColor = vec4(c, 1.0); }',
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat); skyMesh.renderOrder = -10; scene.add(skyMesh);
  // photographed skies (from the env pack): two at once, blended as the day goes on
  const bdU = { mapA: { value: null }, mapB: { value: null }, k: { value: 0 }, bright: { value: 1 }, flash: { value: 0 }, turn: { value: 0 } };
  const backdropMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: bdU,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D mapA, mapB; uniform float k, bright, flash, turn; varying vec3 v; void main(){ vec2 uv = vec2(atan(v.z, v.x) / 6.2831853 + 0.5 + turn, asin(clamp(v.y, -1.0, 1.0)) / 3.14159265 + 0.5); vec3 a = texture2D(mapA, uv).rgb; vec3 b = texture2D(mapB, uv).rgb; vec3 c = mix(a, b, k) * bright + flash * vec3(0.6, 0.65, 0.8); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  });
  const skies = {}, ibl = {}; // photographed skies (id → texture) and image lights (day, storm)
  let backdropOn = false;

  // ---------- the site ----------
  const site = buildSite(scene, { low });
  const mats = makeMaterials();
  const fx = createFx(scene, mats, { floorY: 0 });
  post.hideFromAO([fx.group]);
  const tfx = createToolFx(scene, { cx, cy, top: WELL.top, fx, CS });
  // a toolbox: a red steel box with a handle, on the face of the cell that carries it
  const tbGeo = (() => { const a = new THREE.BoxGeometry(0.26, 0.17, 0.08); a.translate(0, -0.02, 0); const b = new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI); b.translate(0, 0.065, 0); const g2 = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; })); return g2; })();
  const toolbox = new THREE.InstancedMesh(tbGeo, new THREE.MeshStandardMaterial({ color: '#d8322a', roughness: 0.35, metalness: 0.4, emissive: '#ff5a2a', emissiveIntensity: 0.6 }), 24);
  toolbox.count = 0; toolbox.frustumCulled = false; scene.add(toolbox);

  // ---------- the blocks, instanced per material ----------
  const MAXB = 480, blocks = {}; // room for two wells of mud in a match
  for (const [k, m] of Object.entries(mats)) {
    const g = blockGeometry(); g.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(MAXB), 1));
    const im = new THREE.InstancedMesh(g, m, MAXB); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    im.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(im); blocks[k] = im;
  }
  const ghostM = new THREE.MeshBasicMaterial({ map: ghostTexture(), transparent: true, depthWrite: false, toneMapped: false, color: '#ffffff' });
  const ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(CS * 0.94, CS * 0.94, CS * 0.8), ghostM, 4); ghost.count = 0; ghost.frustumCulled = false; ghost.renderOrder = 3; scene.add(ghost);
  // the lesson's target: a gold outline that breathes
  const hintM = new THREE.MeshBasicMaterial({ map: ghostTexture(), transparent: true, depthWrite: false, toneMapped: false, color: '#ffd23f' });
  const hintMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CS * 1.0, CS * 1.0, CS * 0.86), hintM, 4); hintMesh.count = 0; hintMesh.frustumCulled = false; hintMesh.renderOrder = 4; scene.add(hintMesh);
  // brownout: a dark pane over the well with a soft hole where the flashlight falls, and the beam
  const darkU = { c: { value: new THREE.Vector2() }, k: { value: 0 }, r: { value: 1.3 } };
  const darkM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, uniforms: darkU,
    vertexShader: 'varying vec2 vw; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vw = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec2 c; uniform float k, r; varying vec2 vw; void main(){ float d = length((vw - c) * vec2(1.0, 0.8)); float a = smoothstep(r * 0.55, r * 1.25, d); gl_FragColor = vec4(0.01, 0.012, 0.02, a * 0.93 * k); }' });
  const darkPane = new THREE.Mesh(new THREE.PlaneGeometry(WELL.x1 - WELL.x0 + 0.5, WELL.top - WELL.y0 + 0.6), darkM);
  darkPane.position.set(0, (WELL.y0 + WELL.top) / 2, 0.5); darkPane.renderOrder = 6; darkPane.visible = false; scene.add(darkPane);
  const beamM = new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beamG = new THREE.ConeGeometry(1, 1, 24, 1, true); beamG.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamG, beamM); beam.renderOrder = 7; beam.visible = false; scene.add(beam);
  const torch = new THREE.SpotLight('#fff0d0', 0, 14, 0.38, 0.6, 1.2); scene.add(torch, torch.target);
  let darkK = 0;
  // bitak: a crack decal on the face of each cracked cell
  const crackTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = 'rgba(16,10,6,0.95)'; x.lineCap = 'round'; x.lineJoin = 'round';
    const branch = (px, py, a, len, w) => { if (len < 8 || w < 1) return; const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); branch(nx, ny, a + 0.6, len * 0.62, w * 0.7); branch(nx, ny, a - 0.5, len * 0.55, w * 0.65); };
    x.strokeStyle = 'rgba(255,240,220,0.55)'; x.translate(2, 2); branch(64, 4, 1.5, 44, 12); branch(64, 4, 1.95, 34, 8); branch(10, 72, -0.25, 40, 8); x.setTransform(1, 0, 0, 1, 0, 0);
    x.strokeStyle = 'rgba(16,10,6,0.95)'; branch(64, 4, 1.5, 44, 11); branch(64, 4, 1.95, 34, 7); branch(10, 72, -0.25, 40, 7);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const cracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(CS * 0.9, CS * 0.9), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, toneMapped: false, color: '#ffffff' }), 60);
  cracks.count = 0; cracks.frustumCulled = false; cracks.renderOrder = 2; scene.add(cracks);
  // the City Inspector, made when a job needs him
  let insp = null;
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), qa = new THREE.Quaternion(), ea = new THREE.Euler(), vp = new THREE.Vector3(), vs = new THREE.Vector3(), cW = new THREE.Color();
  function put(key, x, y, z, s = 1, glow = 0, tint = 1, rot = null) {
    const im = blocks[key]; if (!im || im.count >= MAXB) return;
    m4.compose(vp.set(x, y, z), rot || q0, vs.set(s, s, s));
    im.setMatrixAt(im.count, m4); im.geometry.attributes.aGlow.array[im.count] = glow;
    im.setColorAt(im.count, typeof tint === 'number' ? cW.setScalar(tint) : tint);
    im.count++;
  }
  // Bagyo: wet mud runs down the face of the mud rows, and brown floodwater creeps over the site
  const dripM = new THREE.MeshStandardMaterial({ color: '#3a2616', roughness: 0.08, metalness: 0, envMapIntensity: 1.6 });
  const dripGeo = new THREE.SphereGeometry(0.05, 10, 8); dripGeo.translate(0, -0.05, 0);
  const drips = new THREE.InstancedMesh(dripGeo, dripM, 160); drips.count = 0; drips.frustumCulled = false; drips.castShadow = false; scene.add(drips);
  const floodM = new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.88, envMapIntensity: 1.4 });
  const flood = new THREE.Mesh(new THREE.PlaneGeometry(120, 60, 1, 1), floodM); flood.rotation.x = -Math.PI / 2; flood.position.set(0, -0.2, -6); flood.visible = false; flood.receiveShadow = true; scene.add(flood);
  let floodY = -0.2;
  const keyOf = (type, rot) => (type === 'I' ? (rot % 2 ? 'kawayanV' : 'kawayan') : KEYS[TYPE_KEY[type]]);

  // ---------- Kapatas ----------
  const kap = { crafted: person(kapatasLook), real: null, x: -4.3, z: 1.3, yaw: 0.55, state: 'idle', stateT: 0, react: null, reactT: 0 };
  kap.crafted.root.position.set(kap.x, 0, kap.z); kap.crafted.root.rotation.y = kap.yaw; scene.add(kap.crafted.root);
  let foremanLib = null;
  let paradeObj = null;
  const getParade = () => { if (!paradeObj) { paradeObj = makeParade(); paradeObj.group.visible = false; scene.add(paradeObj.group); } return paradeObj; };

  // ---------- state the view keeps ----------
  let orient = new Uint8Array(COLS * ROWS), pending = null, lastGame = null, collapsed = false, hardRows = 0;
  let riseT = 0, spawnT = 0, rotT = 0, holdT = 0, dangerK = 0, lightning = 0, nextBolt = 6, flashK = 0, kickV = 0, kickY = 0, shake = 0, punch = 0;
  let cine = null; // { kind, t, dur }
  let paradeBG = null; // { t } the parade crossing the road behind (no cutscenes)
  let layout = null, compact = false, cellPx = 20, reduced = false;
  const bolt = { mesh: null, t: 0 };
  let todNow = { ...TOD.golden }, todKey = 'golden', todTo = null, todK = 0, stormOn = false, hazeOn = false;

  function resetState() { orient = new Uint8Array(COLS * ROWS); pending = null; collapsed = false; riseT = 0; cine = null; fx.clear(); site.resetBunting(); if (insp) insp.leave(); }
  // the rival's well (a match): its own orientation memory, clears and rises
  let rig = null, vsOn = false;
  const R = { g: null, orient: new Uint8Array(COLS * ROWS), pending: null, riseT: 0, collapsed: false };
  const rx = (x) => rig.RX + cx(x) * rig.S, ry = (y) => rig.LIFT + cy(y) * rig.S;
  const shiftUp = (o, n) => { const a = new Uint8Array(COLS * ROWS); a.set(o.subarray(n * COLS)); return a; };
  function dropRows(o, rows) { const keep = []; for (let y = 0; y < ROWS; y++) if (!rows.includes(y)) keep.push(o.slice(y * COLS, y * COLS + COLS)); const out = new Uint8Array(COLS * ROWS); keep.reverse().forEach((row, i) => out.set(row, (ROWS - 1 - i) * COLS)); return out; }

  // ---------- the camera ----------
  const cam = { pos: new THREE.Vector3(0, 6, 30), look: new THREE.Vector3(0, 5, 0), fov: 30, mode: 'title', blend: 1, from: null };
  const play = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30 };
  let angled = true, insets = { top: 70, bottom: 20 };
  // Fit the well and its boards to the screen, between the HUD at the top and the buttons at the bottom.
  function fit() {
    const r = canvas.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height), aspect = W / H;
    compact = aspect < 0.8;
    layout = site.layoutBoards(compact);
    kap.x = compact ? -3.3 : -4.35; kap.z = compact ? 2.6 : 1.4;
    const fov = compact ? 34 : 30, t = Math.tan((fov * Math.PI) / 360);
    let x0 = layout.x0 - 0.15, x1 = layout.x1 + 0.15, y0 = compact ? 0.05 : -0.35, y1 = layout.yTop;
    if (vsOn && rig) {
      // the rival's scaffold to the right: full size on a wide screen, smaller on a phone
      const S = compact ? 0.5 : 0.84, half = (WELL.x1 - WELL.x0) / 2 + 0.5, lift = compact ? 1.6 : 1.45;
      rig.place(layout.x1 + 0.35 + half * S, S, lift, compact ? 1.0 : 0.9);
      x1 = rig.RX + half * S + 0.15;
      y1 = Math.max(y1, lift + (WELL.top + 1.6) * S);
      if (!compact) x0 = layout.x0 - 0.1;
    }
    const hf = Math.max(0.3, 1 - (insets.top + insets.bottom) / H) * 0.98, wf = compact ? 0.96 : 0.97;
    const frameH = Math.max((y1 - y0) / hf, (x1 - x0) / (aspect * wf));
    const D = frameH / (2 * t);
    const midY = (y0 + y1) / 2 + ((insets.top - insets.bottom) / H / 2) * frameH;
    const yaw = angled ? (compact ? 0 : 0.1) : 0, pitch = compact ? 0.04 : angled ? 0.1 : 0.06;
    play.look.set((x0 + x1) / 2, midY, 0);
    play.pos.set(play.look.x + Math.sin(yaw) * Math.cos(pitch) * D, midY + Math.sin(pitch) * D, Math.cos(yaw) * Math.cos(pitch) * D);
    play.fov = fov;
    cellPx = (CS / frameH) * H;
    fx.setScale(H / (2 * t));
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = Math.max(0.3, r.width / Math.max(1, r.height));
    camera.updateProjectionMatrix();
    post.resize();
    fit();
  }
  // establishing: the whole site from high and to the side, the street and the house behind
  const shots = {
    title: (t) => ({ pos: [Math.sin(t * 0.045) * 9 + 6, 7.5 + Math.sin(t * 0.07) * 1.2, 27 + Math.cos(t * 0.05) * 2], look: [1.2, 4.6, -2], fov: 38 }),
    establish: () => ({ pos: [15, 13, 24], look: [2, 4.2, -3], fov: 42 }),
    results: (t) => { const h = site.house.group.position, top = Math.max(6, site.house.top()), wide = camera.aspect > 1.2; return { pos: [h.x + 3 + Math.sin(t * 0.1) * 0.6, top * 0.42 + 1.2, h.z + 21 + top * 0.7], look: [h.x - (wide ? 5.5 : 0.5), top * 0.52, h.z], fov: wide ? 44 : 56 }; },
    bayanihan: (k) => ({ pos: [lerp(-8.6, -6.8, k), 1.35, 13.6], look: [lerp(-2.6, -0.4, k), 3.35, 2.6], fov: 46 }),
    house: (k) => ({ pos: [lerp(8.6, 10.2, k), 4.2 + k * 1.6, 13.5], look: [site.house.group.position.x - 0.5, site.house.top() + 0.5, site.house.group.position.z], fov: 38 }),
    pause: () => ({ pos: [play.pos.x - 2.5, play.pos.y - 1.2, play.pos.z - 4], look: [play.look.x - 0.4, play.look.y - 0.5, 0], fov: play.fov }),
  };
  const tv = new THREE.Vector3(), tl = new THREE.Vector3();
  function setCam(target, dt, rate) {
    const [px, py, pz] = target.pos, [lx, ly, lz] = target.look;
    if (rate >= 1) { cam.pos.set(px, py, pz); cam.look.set(lx, ly, lz); cam.fov = target.fov; return; }
    const k = 1 - Math.exp(-dt * rate);
    cam.pos.lerp(tv.set(px, py, pz), k); cam.look.lerp(tl.set(lx, ly, lz), k); cam.fov = lerp(cam.fov, target.fov, k);
  }
  const asShot = (v) => ({ pos: [v.pos.x, v.pos.y, v.pos.z], look: [v.look.x, v.look.y, v.look.z], fov: v.fov });

  // ---------- time of day, weather ----------
  function todFor(g, mode) {
    if (!g || mode === 'title') return ['golden', null, 0];
    if (g.mode === 'deadline') return ['noon', null, 0];
    if (g.mode === 'bagyo') return ['storm', null, 0];
    const l = g.lines;
    if (l < 25) return ['golden', null, 0];
    if (l < 45) return ['golden', 'dusk', clamp((l - 25) / 15, 0, 1)];
    return ['dusk', 'night', clamp((l - 45) / 15, 0, 1)];
  }
  const cA = new THREE.Color(), cB = new THREE.Color(), vA = new THREE.Vector3();
  function applyTod(a, b, k, dt) {
    const A = TOD[a], B = b ? TOD[b] : A, target = {};
    for (const key of TOD_KEYS) target[key] = Array.isArray(A[key]) ? A[key].map((v, i) => lerp(v, B[key][i], k)) : lerp(A[key], B[key], k);
    const s = Math.min(1, dt * 1.5);
    for (const key of TOD_KEYS) todNow[key] = Array.isArray(target[key]) ? todNow[key].map((v, i) => lerp(v, target[key][i], s)) : lerp(todNow[key], target[key], s);
    for (const key of ['sunC', 'sky', 'gnd', 'fog', 'top', 'mid', 'low', 'glow']) { cA.set(A[key]).lerp(cB.set(B[key]), k); todNow[key + 'C'] = (todNow[key + 'C'] || cA.clone()).lerp(cA, s); }
    const d = vA.set(...todNow.sun).normalize();
    sun.position.copy(sun.target.position).addScaledVector(d, 40);
    sun.color.copy(todNow.sunCC); sun.intensity = todNow.sunI * (1 + lightning * 2.5);
    hemi.color.copy(todNow.skyC); hemi.groundColor.copy(todNow.gndC); hemi.intensity = todNow.hemi * (1 + lightning * 1.5);
    scene.fog.color.copy(todNow.fogC); scene.fog.near = todNow.near; scene.fog.far = todNow.far;
    renderer.toneMappingExposure = todNow.exp;
    scene.environmentIntensity = todNow.env;
    skyU.top.value.copy(todNow.topC); skyU.mid.value.copy(todNow.midC); skyU.low.value.copy(todNow.lowC); skyU.glow.value.copy(todNow.glowC); skyU.sunDir.value.copy(d);
    for (const l of lamps) { l.s.intensity = todNow.lamps * 32; l.head.material.emissiveIntensity = todNow.lamps * 1.2; }
    site.house.lights(todNow.lamps > 0.5);
    // the photographed sky: which two are showing, and how far between
    if (backdropOn) {
      const ta = skies[a], tb = skies[b || a];
      if (ta) { bdU.mapA.value = ta; bdU.mapB.value = tb || ta; bdU.k.value = tb ? k : 0; }
      const BR = { golden: 1, dusk: 1, night: 0.7, noon: 1, storm: 0.72 }, TURN = { golden: 0.45, dusk: 0.45, night: 0.35, noon: 0.15, storm: 0 };
      bdU.bright.value = lerp(BR[a], BR[b || a], k); bdU.turn.value = lerp(TURN[a], TURN[b || a], k);
      bdU.flash.value = lightning * 0.8;
    }
    const want = (a === 'storm' && ibl.storm) || ibl.day;
    if (want && scene.environment !== want.tex) { scene.environment = want.tex; scene.environmentRotation.set(0, want.turn, 0); }
    post.setStage(A.grade, b ? B.grade : null, k);
    todKey = a; todTo = b; todK = k;
  }

  // ---------- events ----------
  function reactKapatas(kind) {
    kap.react = kind; kap.reactT = kind === 'victory' ? 3 : kind === 'slump' ? 99 : 1.6;
    if (kap.real) foremanEvent(kap.real, kind);
  }
  function burstRow(g, r, n) {
    for (let x = 0; x < COLS; x++) {
      const v = g.board[r * COLS + x]; if (!v) continue;
      const key = v === 1 ? (orient[r * COLS + x] ? 'kawayanV' : 'kawayan') : KEYS[v], feel = FEEL[key.replace('V', '')] || FEEL.hollow;
      const X = cx(x), Y = cy(r), spread = 1 + n * 0.25;
      for (let k = 0; k < 3; k++) fx.chunk(key, X + rnd(-0.2, 0.2), Y + rnd(-0.2, 0.2), rnd(0.05, 0.25), rnd(-1.6, 1.6) * spread + (x - 4.5) * 0.25, rnd(0.5, 4.5) * spread, rnd(1.2, 4) * spread, rnd(0.06, 0.12));
      fx.puff(X, Y, 0.3, feel[2], { size: rnd(0.5, 0.9), vx: rnd(-1, 1), vy: rnd(0, 0.8), vz: rnd(0.4, 1.6), life: rnd(1, 1.8), a: 0.5 });
      if (key === 'yero' || key === 'baldosa') for (let k = 0; k < 3; k++) fx.spark(X, Y, 0.3, key === 'yero' ? '#ffd9a0' : '#e8f0ff', { vx: rnd(-4, 4), vy: rnd(0, 4), vz: rnd(1, 4), size: 0.06, grow: 0, life: 0.35, a: 1, drag: 1, grav: 1 });
    }
    fx.bar(0, cy(r), 0.3, 5.2, CS * 0.9, n === 4 ? '#ffd27a' : '#fff4dc', 0.28, { grow: 0.8 });
  }
  const WORDS = ['', 'ISANG HANAY', 'DALAWA!', 'TATLO!', 'BAYANIHAN!'];
  function event(e, g) {
    if (g !== lastGame) { lastGame = g; resetState(); }
    switch (e.type) {
      case 'spawn': {
        if (pending) { const keep = []; for (let y = 0; y < ROWS; y++) if (!pending.includes(y)) keep.push(orient.slice(y * COLS, y * COLS + COLS)); const o = new Uint8Array(COLS * ROWS); keep.reverse().forEach((row, i) => o.set(row, (ROWS - 1 - i) * COLS)); orient = o; pending = null; }
        spawnT = 1; break;
      }
      case 'rotate': rotT = 1; break;
      case 'hold': holdT = 1; spawnT = 1; break;
      case 'hardDrop': hardRows = e.rows; break;
      case 'lock': {
        const vert = e.piece === 'I' && new Set(e.cells.map(([x]) => x)).size === 1;
        for (const [x, y] of e.cells) if (y >= 0) orient[y * COLS + x] = e.piece === 'I' && vert ? 1 : 0;
        const key = keyOf(e.piece, vert ? 1 : 0), feel = FEEL[key.replace('V', '')];
        const cells = new Set(e.cells.map(([x, y]) => `${x},${y}`));
        for (const [x, y] of e.cells) {
          if (hardRows > 1) fx.streak(cx(x), cy(y - hardRows) + CS / 2, cy(y) - CS / 2, 0.24, GHOST_COLORS[e.piece]);
          if (!cells.has(`${x},${y + 1}`)) for (let k = 0; k < (hardRows > 2 ? 3 : 1); k++) fx.puff(cx(x) + rnd(-0.2, 0.2), cy(y) - CS / 2, rnd(0.1, 0.35), feel[2], { size: rnd(0.25, 0.5), vx: rnd(-0.9, 0.9), vy: rnd(0.1, 0.5), vz: rnd(0.2, 0.8), life: rnd(0.5, 0.9), a: 0.4 });
        }
        if (hardRows > 2 && (e.piece === 'S')) for (const [x, y] of e.cells) fx.spark(cx(x), cy(y) - CS / 2, 0.3, '#ffe0a8', { vx: rnd(-3, 3), vy: rnd(0.5, 3), vz: rnd(0.5, 2), size: 0.05, grow: 0, life: 0.3, a: 1, grav: 1 });
        if (!reduced) kickV -= 0.012 + Math.min(20, hardRows) * 0.004;
        hardRows = 0;
        break;
      }
      case 'lines': {
        pending = e.rows.slice();
        for (const r of e.rows) burstRow(g, r, e.n);
        const midY = e.rows.reduce((a, r) => a + cy(r), 0) / e.rows.length;
        const word = e.spin ? (e.spin === 'mini' ? 'MINI T-SPIN' : `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][e.n]}!`) : WORDS[e.n];
        if (e.n < 4) fx.callout(word, 0, midY + 0.35, 1.2, { color: e.spin ? 'pink' : 'white', height: e.spin ? 1.1 : 0.92, life: 1.4 });
        fx.callout(`+₱${e.points.toLocaleString('en-US')}`, 0, midY - 0.5, 1.2, { color: 'green', height: 0.62, life: 1.3, delay: 0.08 });
        if (e.b2b) {
          // back to back: a streak of sparks along the rows, gold
          for (const r of e.rows) for (let k = 0; k < 26; k++) { const f = k / 25; fx.spark(WELL.x0 + f * 5, cy(r) + rnd(-0.15, 0.15), 0.35, k % 3 ? '#ffd27a' : '#ffffff', { vx: rnd(2, 6), vy: rnd(-0.5, 2.5), vz: rnd(0.5, 2), size: rnd(0.05, 0.09), grow: 0, life: rnd(0.3, 0.6), a: 1, drag: 1.5, grav: 0.6 }); }
          fx.bar(0, midY, 0.4, 5.6, CS * 0.35 * e.rows.length, '#ffc040', 0.35, { grow: 2.4 });
        }
        if (e.b2b) fx.callout('SUNOD-SUNOD ×1.5', 0, midY - 1.2, 1.2, { color: 'blue', height: 0.52, life: 1.3, delay: 0.16 });
        if (e.combo > 0) fx.callout(`TULOY-TULOY ×${e.combo}`, 0, midY + 1.3, 1.2, { color: 'orange', height: 0.56, life: 1.2, delay: 0.12 });
        if (!reduced) { kickV -= 0.03 + e.n * 0.018; flashK = Math.max(flashK, e.n === 4 ? 0.28 : e.spin ? 0.14 : 0); }
        if (e.n === 4) {
          reactKapatas('victory'); cheerT = 3.5;
          fx.confetti(0, WELL.y1 + 1, 1.2, 160);
          if (!reduced && opts.cine) cine = { kind: 'bayanihan', t: 0, dur: 1.9 };
          else { paradeBG = { t: 0 }; punch = reduced ? 0 : 1; }
        } else if (e.spin) reactKapatas('cheer');
        else if (e.n >= 2 || e.combo >= 2) reactKapatas('cheer');
        break;
      }
      case 'tspin': fx.callout(e.kind === 'mini' ? 'MINI T-SPIN' : 'T-SPIN!', 0, cy(10), 1.2, { color: 'pink', height: 0.85, life: 1.2 }); reactKapatas('cheer'); break;
      case 'levelUp': {
        if (!cine && !reduced && opts.cine && g === lastGame && opts.live) cine = { kind: 'house', t: 0, dur: 1.5 };
        reactKapatas('point');
        const hx = site.house.group.position.x, hz = site.house.group.position.z, hy = site.house.top();
        for (let k = 0; k < 18; k++) fx.puff(hx + rnd(-4, 4), hy + rnd(-0.5, 0.5), hz + rnd(-2.5, 3), '#d8d0c0', { size: rnd(0.8, 1.6), vy: rnd(0.2, 0.8), life: rnd(1.2, 2), a: 0.35 });
        fx.confetti(hx, hy + 3, hz + 2, 60);
        // every fifth floor in Bahay, the house is finished: the neighbours cheer and banderitas go up
        if (g.mode === 'bahay' && (1 + Math.floor(g.lines / 10)) % 5 === 0) { site.raiseBunting(); cheerT = 4.5; reactKapatas('victory'); fx.confetti(0, WELL.top + 2, 1, 200); fx.confetti(hx, hy + 4, hz + 2, 120); if (o0.onCeremony) o0.onCeremony(1 + Math.floor(g.lines / 10)); }
        break;
      }
      case 'stamp': {
        if (!insp) insp = createInspector(scene);
        insp.stamp(cx(e.x));
        fx.callout('REJECTED!', cx(e.x), cy(e.y) + 0.5, 1.3, { color: 'pink', height: 0.6, life: 1.2, delay: 0.45 });
        for (let k = 0; k < 10; k++) fx.puff(cx(e.x), cy(e.y), 0.4, '#e8a090', { size: rnd(0.2, 0.4), vx: rnd(-1, 1), vy: rnd(0, 1), vz: rnd(0.3, 1), life: 0.7, a: 0.5 });
        if (!reduced) { kickV -= 0.03; flashK = Math.max(flashK, 0.08); }
        break;
      }
      case 'passed': fx.callout(`PASADO +${3 * e.n}s`, 0, WELL.top - 2, 1.3, { color: 'green', height: 0.6, life: 1.2 }); break;
      case 'lights': if (e.on) { fx.callout('MAY ILAW NA!', 0, WELL.top - 1.6, 1.3, { color: 'gold', height: 0.6, life: 1 }); if (!reduced) flashK = Math.max(flashK, 0.1); } else fx.callout('BROWNOUT!', 0, WELL.top - 1.6, 1.3, { color: 'blue', height: 0.8, life: 1.2 }); break;
      case 'wind': case 'gust': {
        const d = e.dir;
        for (let k = 0; k < (e.type === 'gust' ? 40 : 12); k++) fx.puff(-d * rnd(2.5, 3.5), rnd(0.5, 10.5), rnd(0.3, 0.9), '#d8ccb0', { size: rnd(0.15, 0.35), vx: d * rnd(5, 9), vy: rnd(-0.3, 0.3), vz: 0, life: rnd(0.6, 1.1), a: 0.35 });
        if (e.type === 'gust') fx.callout(d > 0 ? 'HANGIN · SA KANAN' : 'HANGIN · SA KALIWA', 0, WELL.top - 1.5, 1.3, { color: 'blue', height: 0.55, life: 1.2 });
        break;
      }
      case 'crumble': for (const [x, y] of e.cells) { for (let k = 0; k < 3; k++) fx.chunk('semento', cx(x), cy(y), 0.2, rnd(-1, 1), rnd(0, 2), rnd(0.5, 2), rnd(0.05, 0.1)); fx.puff(cx(x), cy(y), 0.3, '#cfc4b0', { size: rnd(0.4, 0.7), vy: 0.3, vz: 0.8, life: 1, a: 0.45 }); } fx.callout('GUMUHO!', cx(e.cells[0][0]), cy(e.cells[0][1]) + 0.4, 1.2, { color: 'orange', height: 0.5, life: 1 }); break;
      case 'andamyo': fx.callout(e.why === 'topout' ? 'SINALO NG ANDAMYO!' : 'ANDAMYO!', 0, e.why === 'topout' ? WELL.top - 2 : cy(19), 1.3, { color: 'gold', height: 0.7, life: 1.4 }); if (!reduced) shake = 0.25; if (e.cells) for (const [x, y, v] of e.cells) fx.chunk(KEYS[v] || 'hollow', cx(x), cy(y), 0.2, rnd(-2, 2), rnd(-1, 2), rnd(1, 3), rnd(0.06, 0.11)); break;
      case 'garbage': {
        riseT = 1; orient = shiftUp(orient, e.rows);
        for (let x = 0; x < COLS; x++) { fx.puff(cx(x), BASE_Y + 0.1, 0.4, '#6a5038', { size: rnd(0.3, 0.6), vy: rnd(0.4, 1.4), vz: rnd(0.4, 1.4), life: 0.9, a: 0.6 }); fx.chunk('putik', cx(x) + rnd(-0.2, 0.2), BASE_Y + 0.2, 0.3, rnd(-1.2, 1.2), rnd(1.5, 3.5), rnd(0.5, 2), rnd(0.03, 0.06)); }
        fx.callout(`+${e.rows} PUTIK`, 0, cy(ROWS - e.rows) + 0.4, 1.2, { color: 'orange', height: 0.7, life: 1.2 });
        if (!reduced) kickV -= 0.04 + e.rows * 0.01;
        reactKapatas('cheer'); kap.react = 'worry'; kap.reactT = 1.4;
        break;
      }
      case 'rise': {
        riseT = 1;
        for (let x = 0; x < COLS; x++) { fx.puff(cx(x), BASE_Y + 0.1, 0.4, '#6a5038', { size: rnd(0.3, 0.6), vy: rnd(0.4, 1.4), vz: rnd(0.4, 1.4), life: 0.9, a: 0.6 }); for (let k = 0; k < 2; k++) fx.chunk('putik', cx(x) + rnd(-0.2, 0.2), BASE_Y + 0.2, 0.3, rnd(-1.2, 1.2), rnd(1.5, 3.5), rnd(0.5, 2), rnd(0.03, 0.06)); }
        if (!reduced) kickV -= 0.045;
        break;
      }
      case 'tool': {
        tfx.play(e); reactKapatas(e.tool === 'merienda' ? 'point' : 'cheer');
        const NAME = { martilyo: 'MARTILYO!', semento: 'SEMENTO!', kreyn: 'KREYN!', pison: 'PISON!', merienda: 'MERIENDA!', plumada: 'PLUMADA!', barena: 'BARENA!', andamyo: 'ANDAMYO!' };
        fx.callout(NAME[e.tool], 0, WELL.top - 1.5, 1.4, { color: 'orange', height: 0.9, life: 1.2 });
        break;
      }
      case 'toolEarned': {
        fx.callout(`+ ${e.tool.toUpperCase()}`, WELL.x0 - 0.6, WELL.y1 - 1, 1.4, { color: 'gold', height: 0.6, life: 1.6, rise: 1.2 });
        for (let k = 0; k < 24; k++) fx.spark(rnd(-2.5, 2.5), rnd(1, 9), 0.4, '#ffd27a', { vx: rnd(-1, 1), vy: rnd(1, 3), vz: rnd(0, 1), size: 0.06, grow: 0, life: 0.6, a: 1, grav: 0.3 });
        break;
      }
      case 'lindol': {
        if (!reduced) shake = 0.35;
        for (let k = 0; k < 20; k++) fx.puff(rnd(-6, 6), 0.1, rnd(-2, 4), '#cbbca4', { size: rnd(0.6, 1.2), vy: rnd(0.2, 0.8), life: rnd(1, 1.8), a: 0.4 });
        fx.callout('LINDOL!', 0, WELL.top - 1.5, 1.4, { color: 'orange', height: 1.0, life: 1.3 });
        reactKapatas('cheer'); kap.react = 'worry'; kap.reactT = 1.8;
        break;
      }
      case 'perfect': fx.callout('MALINIS!', 0, cy(17), 1.4, { color: 'gold', height: 1.2, life: 1.8 }); fx.confetti(0, WELL.y1, 1.2, 140); cheerT = 3; break;
      case 'gameover': {
        collapsed = true; reactKapatas('slump');
        // the wall comes down: every block breaks and falls forward off the scaffold
        for (let y = HIDDEN; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const v = g.board[y * COLS + x]; if (!v) continue;
          const key = v === 1 ? (orient[y * COLS + x] ? 'kawayanV' : 'kawayan') : KEYS[v];
          fx.chunk(key, cx(x), cy(y), rnd(0, 0.2), rnd(-0.8, 0.8), rnd(-1.5, 1), rnd(0.8, 3.2), rnd(0.07, 0.12));
          if (Math.random() < 0.35) fx.puff(cx(x), cy(y), 0.4, '#cfc4b0', { size: rnd(0.7, 1.3), vy: rnd(-0.5, 0.5), vz: rnd(0.3, 1.5), life: rnd(1.5, 2.5), a: 0.45 });
        }
        for (let k = 0; k < 24; k++) fx.puff(rnd(-3, 3), 0.3, rnd(0, 2), '#d8ccb8', { size: rnd(1, 2), vx: rnd(-2, 2), vy: rnd(0.2, 1), vz: rnd(0, 2), life: rnd(2, 3.5), a: 0.4, grow: 1.8 });
        if (!reduced) shake = 0.5;
        break;
      }
      case 'done': reactKapatas('victory'); fx.confetti(0, WELL.y1, 1.5, 220); if (!reduced) flashK = 0.2; break;
      default: break;
    }
  }

 // the rival's events, drawn on its scaffold
  function rivalEvent(e, g) {
    if (!rig) return;
    if (R.g !== g) { R.g = g; R.orient = new Uint8Array(COLS * ROWS); R.pending = null; R.collapsed = false; }
    const S = rig.S;
    switch (e.type) {
      case 'spawn': if (R.pending) { R.orient = dropRows(R.orient, R.pending); R.pending = null; } break;
      case 'lock': {
        const vert = e.piece === 'I' && new Set(e.cells.map(([x]) => x)).size === 1;
        for (const [x, y] of e.cells) if (y >= 0) R.orient[y * COLS + x] = vert ? 1 : 0;
        for (const [x, y] of e.cells) fx.puff(rx(x), ry(y) - CS * S / 2, rig.Z + 0.2, '#cfc4b0', { size: rnd(0.2, 0.4) * S, vy: rnd(0.1, 0.4), vz: rnd(0.2, 0.6), life: 0.6, a: 0.35 });
        break;
      }
      case 'lines': {
        R.pending = e.rows.slice();
        for (const r of e.rows) { for (let x = 0; x < COLS; x++) { const v = g.board[r * COLS + x]; if (!v) continue; const key = v === 1 ? 'kawayan' : KEYS[v]; fx.chunk(key, rx(x), ry(r), rig.Z + 0.2, rnd(-1.2, 1.2), rnd(0.5, 3.5) * S, rnd(1, 3) * S, rnd(0.05, 0.1) * S); } fx.bar(rig.RX, ry(r), rig.Z + 0.3, 5.2 * S, CS * 0.9 * S, e.n === 4 ? '#ffd27a' : '#fff4dc', 0.28, { grow: 0.8 }); }
        const midY = e.rows.reduce((a, r) => a + ry(r), 0) / e.rows.length;
        const word = e.spin ? (e.spin === 'mini' ? 'MINI T-SPIN' : `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][e.n]}!`) : WORDS[e.n];
        if (e.n >= 2 || e.spin) fx.callout(word, rig.RX, midY + 0.35, rig.Z + 1.2, { color: e.spin ? 'pink' : e.n === 4 ? 'gold' : 'white', height: (e.spin ? 0.95 : 0.8) * Math.max(0.7, S), life: 1.3 });
        if (e.n === 4) fx.confetti(rig.RX, ry(ROWS - 20) + 4 * S, 1, 60);
        break;
      }
      case 'garbage': R.riseT = 1; R.orient = shiftUp(R.orient, e.rows); for (let x = 0; x < COLS; x++) fx.puff(rx(x), ry(ROWS - 1), rig.Z + 0.4, '#6a5038', { size: rnd(0.3, 0.5) * S, vy: rnd(0.4, 1.2), vz: rnd(0.4, 1.2), life: 0.8, a: 0.55 }); break;
      case 'gameover': {
        R.collapsed = true;
        for (let y = HIDDEN; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const v = g.board[y * COLS + x]; if (!v) continue; fx.chunk(v === 1 ? 'kawayan' : KEYS[v], rx(x), ry(y), rig.Z + rnd(0, 0.2), rnd(-0.8, 0.8), rnd(-1.5, 1), rnd(0.8, 3.2), rnd(0.07, 0.12) * S); }
        for (let k = 0; k < 18; k++) fx.puff(rig.RX + rnd(-3, 3) * S, 0.3, rnd(0, 2), '#d8ccb8', { size: rnd(1, 2), vx: rnd(-2, 2), vy: rnd(0.2, 1), vz: rnd(0, 2), life: rnd(2, 3.5), a: 0.4, grow: 1.8 });
        if (!reduced) shake = 0.35;
        fx.confetti(0, WELL.top + 1, 1.2, 200); cheerT = 4; reactKapatas('victory');
        break;
      }
      default: break;
    }
  }
  // mud crossing over: sacks flung from the sender's well toward the other's gauge, and the count
  function attack(from, n, cancelled) {
    if (!rig) return;
    const sx = from ? rig.RX : 0, tx = from ? WELL.x0 - 0.4 : rig.RX + (WELL.x0 - 0.4) * rig.S, y0 = from ? ry(8) : cy(8);
    // (the rival's side sits forward, on its deck)
    for (let k = 0; k < Math.min(24, 4 + n * 3); k++) fx.chunk('putik', sx + rnd(-1, 1), y0 + rnd(-1, 1), 0.6, (tx - sx) * rnd(0.55, 0.8), rnd(2.5, 5), rnd(0.3, 1.2), rnd(0.05, 0.1));
    if (n > 0) fx.callout(`+${n} PUTIK`, from ? WELL.x0 - 0.4 : tx, (from ? cy(14) : ry(14)), from ? 1.3 : rig.Z + 1.3, { color: 'orange', height: from ? 0.62 : 0.62 * Math.max(0.7, rig.S), life: 1.4, delay: 0.25 });
    if (cancelled > 0) fx.callout(`HARANG ${cancelled}`, from ? rig.RX : 0, (from ? ry(6) : cy(6)), 1.3, { color: 'blue', height: 0.5, life: 1.1, delay: 0.1 });
  }
  function setVersus(on, prof = null) {
    if (on && !rig) rig = buildRivalRig(scene);
    if (rig) { rig.show(on); rig.showP2(on && !!prof && prof.id === 'p2'); if (on && prof) rig.setName(prof.name, prof.tag || prof.name, prof.color || '#ffd23f'); }
    vsOn = on; R.g = null; fit();
  }

  // ---------- each frame ----------
  const opts = { cine: true, live: false }, pieceAt = { x: 0, y: 6 };
  let o0 = {};
  let clock = 0, danger = false;
  function frame(g, dt, o = {}) {
    dt = clamp(dt || 0, 0, 0.1);
    clock += dt;
    const t = clock;
    reduced = !!o.reduced; opts.cine = o.cine !== false; opts.live = o.mode === 'play'; o0 = o;
    if (g !== lastGame) { lastGame = g; resetState(); }
    // time of day and weather
    const [ta, tb, tk] = todFor(g, o.mode);
    applyTod(ta, tb, tk, o.snapTod ? 1 : dt);
    stormOn = ta === 'storm'; hazeOn = ta === 'noon';
    fx.setRain(stormOn, post.level >= 1 ? 1100 : 500);
    if (stormOn && !reduced) { nextBolt -= dt; if (nextBolt <= 0) { lightning = 1; nextBolt = rnd(5, 12); if (o.onThunder) o.onThunder(); } }
    lightning = Math.max(0, lightning - dt * 3.2);
    // the house next door: floors done and the courses of the next
    const lines = g ? g.lines : 0;
    site.house.setProgress(1 + Math.floor(lines / 10), (lines % 10) / 10);
    // Kapatas
    const tgt = g && g.cur ? { x: cx(g.cur.x + 1.5), y: cy(g.cur.y + 1) } : { x: 0, y: 4 };
    kap.reactT -= dt; if (kap.reactT <= 0 && kap.react !== 'slump') kap.react = null;
    if (g && g.phase !== 'over' && kap.react === 'slump') kap.react = null;
    let top = ROWS; if (g) for (let i = 0; i < g.board.length; i++) if (g.board[i]) { top = Math.floor(i / COLS); break; }
    danger = !!g && g.phase === 'play' && top < HIDDEN + 5;
    dangerK = lerp(dangerK, danger ? 1 : 0, Math.min(1, dt * 4));
    const kState = kap.react === 'victory' || kap.react === 'cheer' ? 'cheer' : kap.react === 'slump' ? 'slump' : kap.react === 'point' ? 'point' : danger || kap.react === 'worry' ? 'worry' : 'idle';
    const lookYaw = Math.atan2(tgt.x - kap.x, 4) * 0.8 - 0.4, lookP = -Math.atan2(tgt.y - 1.7, 4) * 0.5;
    if (kap.real) {
      kap.crafted.root.visible = false;
      driveForeman(kap.real, dt, { state: kState, x: kap.x, z: kap.z, yaw: kap.yaw, look: [tgt.x, tgt.y, 0], reduced });
    } else {
      kap.crafted.root.visible = true; kap.crafted.root.position.set(kap.x, 0, kap.z); kap.crafted.root.rotation.y = kap.yaw;
      posePerson(kap.crafted, kState, dt, { look: kState === 'idle' ? [clamp(lookYaw, -0.9, 0.9), clamp(lookP, -0.6, 0.3)] : null, handsOnHips: Math.sin(t * 0.13) > 0.4 });
    }
    // the danger beacon
    site.beacon.glass.emissiveIntensity = dangerK * (2 + Math.sin(t * 12) * 1.5);
    site.beacon.light.intensity = dangerK * (reduced ? 4 : 6 + Math.sin(t * 12) * 5);
    site.beacon.group.rotation.y += dt * 8 * dangerK;
    // palms and the flag in the wind (harder in a bagyo)
    const wind = stormOn || (g && g.wind) ? 1 : 0.25;
    for (const p of site.street.palms) { p.rotation.z = Math.sin(t * (0.8 + wind) + p.userData.phase) * 0.05 * (1 + wind * 3); p.rotation.x = Math.cos(t * 0.7 + p.userData.phase) * 0.03 * (1 + wind * 2); }
    const fp = site.house.flag.geometry.attributes.position;
    if (site.house.flag.parent && site.house.flag.parent.parent.visible) { for (let i = 0; i < fp.count; i++) { const x = fp.getX(i) + 0.6; fp.setZ(i, Math.sin(x * 5 - t * (4 + wind * 6)) * 0.06 * x); } fp.needsUpdate = true; }
    site.drum.rotation.y += dt * 1.2; // the mixer turns
    // the flood: higher the more mud is in the well
    let mud = 0; if (g && g.mode === 'bagyo') for (let y = ROWS - 1; y >= 0; y--) { if (g.board[y * COLS] === 8 || g.board[y * COLS + 1] === 8 || g.board[y * COLS + 2] === 8) mud++; else break; }
    flood.visible = !!g && g.mode === 'bagyo';
    floodY = lerp(floodY, -0.17 + Math.min(8, mud) * 0.028 + Math.sin(t * 1.3) * 0.006, Math.min(1, dt * 2)); flood.position.y = floodY;
    site.pulley.rotation.z -= dt * (g && g.phase === 'play' ? 2 : 0.4);

    // ---------- blocks ----------
    for (const im of Object.values(blocks)) im.count = 0;
    ghost.count = 0; toolbox.count = 0; cracks.count = 0;
    drips.visible = false;
    riseT = Math.max(0, riseT - dt / 0.16);
    spawnT = Math.max(0, spawnT - dt / 0.1); rotT = Math.max(0, rotT - dt / 0.09); holdT = Math.max(0, holdT - dt / 0.2);
    if (g && !collapsed) {
      const clearing = g.phase === 'clear' && g.clearing ? g.clearing : null;
      const p = clearing ? clamp(1 - (g.phaseT - g.acc * 60) / CLEAR_T, 0, 1) : 0;
      const fall = p < 0.3 ? 0 : ((p - 0.3) / 0.7) ** 2;
      const riseOff = -ease(riseT) * CS;
      const over = g.phase === 'over', tint = over ? 0.45 : 1;
      for (let y = 0; y < ROWS; y++) {
        if (clearing && clearing.includes(y)) continue;
        const drop = clearing ? clearing.filter((r) => r > y).length : 0;
        const Y = cy(y) - drop * CS * fall + riseOff;
        for (let x = 0; x < COLS; x++) {
          const v = g.board[y * COLS + x]; if (!v) continue;
          const key = v === 1 ? (orient[y * COLS + x] ? 'kawayanV' : 'kawayan') : KEYS[v];
          const box = g.boxes && g.boxes.some(([bx, by]) => bx === x && by === y);
          const cr = g.cracks && g.cracks.length ? g.cracks.find((c) => c.x === x && c.y === y) : null;
          if (cr) { const wob = cr.left <= 1 && !reduced ? Math.sin(t * 40 + x) * 0.015 : 0; put(key, cx(x) + wob, Y, 0, 0.97, cr.left <= 1 ? 0.15 + 0.15 * Math.sin(t * 12) : 0, 0.5 + cr.left * 0.04); if (cracks.count < 60) { m4.compose(vp.set(cx(x) + wob, Y, CS * 0.44), q0, vs.setScalar(1)); cracks.setMatrixAt(cracks.count++, m4); } continue; }
          put(key, cx(x), Y, 0, 1, (dangerK > 0.05 && y < HIDDEN + 6 ? dangerK * 0.12 * (0.5 + 0.5 * Math.sin(t * 8)) : 0) + (box ? 0.35 + 0.25 * Math.sin(t * 6) : 0), tint);
          if (box && toolbox.count < 24) { m4.compose(vp.set(cx(x), Y, CS * 0.45), q0, vs.set(1, 1, 1)); toolbox.setMatrixAt(toolbox.count++, m4); }
        }
      }
      // the mud runs: a couple of drops sliding down the face of each mud cell
      drips.count = 0;
      if (g.mode === 'bagyo') for (let y = HIDDEN; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (g.board[y * COLS + x] !== 8 || (clearing && clearing.includes(y)) || drips.count >= 158) continue;
        for (let k = 0; k < 2; k++) {
          const h = ((x * 73 + y * 31 + k * 17) % 97) / 97, ph = (t * (0.18 + h * 0.2) + h) % 1;
          const X = cx(x) + (h - 0.5) * CS * 0.7, Y = cy(y) + riseOff + CS * 0.42 - ph * CS * 0.95;
          m4.compose(vp.set(X, Y, CS * 0.45), q0, vs.set(1, 1 + ph * 2.6, 0.55)); drips.setMatrixAt(drips.count++, m4);
        }
      }
      drips.instanceMatrix.needsUpdate = true; drips.visible = drips.count > 0;
      if (g.cur && g.phase === 'play') {
        const cur = g.cur, key = keyOf(cur.type, cur.rot);
        const lk = g.lockT > 0 ? g.lockT / g.diff.lock : 0;
        const glow = 0.14 + lk * (0.35 + 0.25 * Math.sin(t * 30)) + spawnT * 0.6;
        const s = 1 - spawnT * 0.12 + rotT * 0.06;
        if (o.ghost !== false && g.kicks !== false) {
          const gh = ghostOf(g);
          if (gh.y !== cur.y) { ghostM.color.set(GHOST_COLORS[cur.type]); for (const [x, y] of cellsOf(gh)) { m4.compose(vp.set(cx(x), cy(y), 0), q0, vs.set(1, 1, 1)); ghost.setMatrixAt(ghost.count++, m4); } ghost.instanceMatrix.needsUpdate = true; }
        }

        let sx = 0, sy = 0;
        cellsOf(cur).forEach(([x, y], i) => {
          const box = cur.tool === i;
          put(key, cx(x), cy(y), 0, s, glow + (box ? 0.6 + 0.4 * Math.sin(t * 9) : 0), cur.cracked ? 0.7 : 1); sx += cx(x); sy += cy(y);
          if (cur.cracked && y >= 0 && cracks.count < 60) { m4.compose(vp.set(cx(x), cy(y), CS * 0.44 * s), q0, vs.setScalar(s)); cracks.setMatrixAt(cracks.count++, m4); }
          if (box && y >= 0) { m4.compose(vp.set(cx(x), cy(y), CS * 0.45 * s), q0, vs.set(1.1, 1.1, 1.1)); toolbox.setMatrixAt(toolbox.count++, m4); }
        });
        pieceAt.x = sx / 4; pieceAt.y = sy / 4;
        pieceLight.position.set(sx / 4, sy / 4, 1.0); pieceLight.color.set(GHOST_COLORS[cur.type]); pieceLight.intensity = 2.2 + lk * 3;
      } else pieceLight.intensity = 0;
    } else pieceLight.intensity = 0;
    // the lesson's target
    hintMesh.count = 0;
    const hintCells = o.hint || o.plumb;
    if (hintCells && g && g.phase === 'play') {
      hintM.color.set(o.hint ? '#ffd23f' : '#7fd8ff'); hintM.opacity = 0.55 + 0.35 * Math.sin(t * 5);
      for (const [x, y] of hintCells) { m4.compose(vp.set(cx(x), cy(y), 0), q0, vs.setScalar(1 + 0.04 * Math.sin(t * 5))); hintMesh.setMatrixAt(hintMesh.count++, m4); }
      hintMesh.instanceMatrix.needsUpdate = true;
    }
    hintMesh.visible = hintMesh.count > 0;
    // the rival's well
    if (rig && vsOn && o.rival) {
      const rg = o.rival, S = rig.S;
      if (R.g !== rg) { R.g = rg; R.orient = new Uint8Array(COLS * ROWS); R.pending = null; R.collapsed = false; }
      R.riseT = Math.max(0, R.riseT - dt / 0.16);
      if (!R.collapsed) {
        const clearing = rg.phase === 'clear' && rg.clearing ? rg.clearing : null;
        const pr = clearing ? clamp(1 - (rg.phaseT - rg.acc * 60) / CLEAR_T, 0, 1) : 0, fall = pr < 0.3 ? 0 : ((pr - 0.3) / 0.7) ** 2, off = -ease(R.riseT) * CS * S;
        for (let y = 0; y < ROWS; y++) {
          if (clearing && clearing.includes(y)) continue;
          const drop = clearing ? clearing.filter((r) => r > y).length : 0;
          for (let x = 0; x < COLS; x++) { const v = rg.board[y * COLS + x]; if (!v) continue; put(v === 1 ? (R.orient[y * COLS + x] ? 'kawayanV' : 'kawayan') : KEYS[v], rx(x), ry(y) - drop * CS * S * fall + off, rig.Z, S, 0, rg.phase === 'over' ? 0.45 : 1); }
        }
        if (rg.cur && rg.phase === 'play') for (const [x, y] of cellsOf(rg.cur)) if (y >= 0) put(keyOf(rg.cur.type, rg.cur.rot), rx(x), ry(y), rig.Z, S, 0.18);
      }
      rig.gauges([{ x: WELL.x0 - 0.4, s: 1, list: g ? g.incoming || [] : [] }, { x: rig.RX + (WELL.x0 - 0.4) * S, s: S, y: rig.LIFT, z: rig.Z, list: rg.incoming || [] }], dt, t);
    }
    // brownout: dark but for the flashlight on the piece
    const dk = g && g.dark && g.dark.on && g.phase !== 'over' ? 1 : 0;
    darkK = lerp(darkK, dk, Math.min(1, dt * (dk ? 3 : 6)));
    darkPane.visible = darkK > 0.01; beam.visible = darkK > 0.01 && !!(g && g.cur);
    if (darkPane.visible) {
      const px = g && g.cur ? pieceAt.x : 0, py = g && g.cur ? pieceAt.y : 4;
      darkU.c.value.set(px, py); darkU.k.value = darkK; darkU.r.value = 1.35 + Math.sin(t * 9) * 0.03 * (reduced ? 0 : 1);
      const y0 = WELL.top + 1.6, len = Math.max(0.5, y0 - py + 0.4);
      beam.position.set(px * 0.5, y0, 0.9); beam.scale.set(1.1, len, 0.7); beam.lookAt(px, py, 0.4); beam.rotateX(-Math.PI / 2); beamM.opacity = 0.07 * darkK;
      torch.position.set(px * 0.5, y0, 2.4); torch.target.position.set(px, py, 0); torch.intensity = 30 * darkK;
    } else torch.intensity = 0;
    renderer.toneMappingExposure *= 1 - darkK * 0.3;
    // the Inspector
    if (g && g.insp) { if (!insp) insp = createInspector(scene); if (!insp.on && o.mode === 'play') insp.enter(); if (g.phase === 'done') insp.end(true); if (g.phase === 'over') insp.end(false); }
    else if (insp && insp.on) insp.leave();
    if (insp) insp.update(dt, reduced, compact ? [1.9, 2.7, 3.1] : [3.3, 5.1, 2.7]);
    // a second player on the rival scaffold: their hold and next three, and their ghost
    if (rig && vsOn && o.rival && o.p2 && o.rival.cur && o.rival.phase === 'play') {
      const rg = o.rival, S = rig.S, by = ry(ROWS - 22) + 1.1 * S;
      const mini2 = (type, x, y, sc, tint = 1) => { const cs = SHAPES[type][0], xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]); const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2; for (const [a, b] of cs) put(keyOf(type, 0), x + (a - mx) * CS * sc, y - (b - my) * CS * sc, rig.Z + 0.5, sc, 0.1, tint); };
      // beside the well on the right: IMBAK at the top, then the next three
      void by;
      if (rg.hold) mini2(rg.hold, rx(9) + 1.6 * S, ry(4.2), 0.66 * S, rg.holdUsed ? 0.4 : 1);
      rg.queue.slice(0, 3).forEach((type, i) => mini2(type, rx(9) + 1.6 * S, ry(8.6 + i * 3), (i ? 0.5 : 0.66) * S, i ? 0.85 : 1));
      if (o.ghost !== false) { const gh = ghostOf(rg); if (gh && gh.y !== rg.cur.y) for (const [x, y] of cellsOf(gh)) put(keyOf(rg.cur.type, rg.cur.rot), rx(x), ry(y), rig.Z, S * 0.9, 0, 0.35); }
    }
    // the hold and the queue, on their boards
    if (g && layout) {
      const hb = site.boards.hold.userData.rect, nb = site.boards.next.userData.rect;
      const mini = (type, x, y, s, tint = 1, glow = 0) => {
        const cs = SHAPES[type][0], xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
        const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
        for (const [a, b] of cs) put(keyOf(type, 0), x + (a - mx) * CS * s, y - (b - my) * CS * s, compact ? 0.8 : 0.42, s, glow, tint);
      };
      const hs = compact ? 0.48 : 0.72;
      if (g.hold) mini(g.hold, hb.cx, hb.cy - hb.h * 0.08, hs * (1 + holdT * 0.15), g.holdUsed ? 0.4 : 1, holdT * 0.4);
      // the queue: five by default, one to six by the settings, spaced to fit the board
      const N = clamp(o.next || 5, 1, 6), slots = g.queue.slice(0, N), top0 = nb.cy + nb.h / 2 - nb.h * 0.22;
      const gapR = N > 5 ? 0.48 : 0.6, gapC = N > 5 ? 0.118 : 0.148, sc = N > 5 ? 0.86 : 1;
      if (nb.row) slots.forEach((type, i) => mini(type, nb.cx - nb.w * 0.36 + (i === 0 ? 0 : 0.75 + (i - 1) * gapR), nb.cy - nb.h * 0.08, (i === 0 ? 0.42 : 0.27 * sc) * (i === 0 ? 1 + spawnT * 0.08 : 1), i === 0 ? 1 : 0.88, i === 0 ? 0.1 : 0));
      else slots.forEach((type, i) => mini(type, nb.cx, top0 - (i === 0 ? 0 : nb.h * 0.08 + i * nb.h * gapC), (i === 0 ? hs : hs * 0.78 * sc) * (i === 0 ? 1 + spawnT * 0.08 : 1), i === 0 ? 1 : 0.88, i === 0 ? 0.1 : 0));
      site.drawTally(g.mode === 'bagyo' && g.rise ? [['Oras', fmt(g.elapsed)], ['Bayanihan', g.stats.bayanihan], ['T-spin', g.stats.tspins], ['Baha', `${Math.ceil(g.rise.t / 60)}s`]] : [['Oras', fmt(g.elapsed)], ['Bayanihan', g.stats.bayanihan], ['T-spin', g.stats.tspins], ['Combo', Math.max(0, g.stats.maxCombo)]]);
    }
    toolbox.instanceMatrix.needsUpdate = true; toolbox.visible = toolbox.count > 0;
    cracks.instanceMatrix.needsUpdate = true; cracks.visible = cracks.count > 0;
    tfx.update(dt, { slowT: g ? g.slowT || 0 : 0, piece: pieceAt, kick: () => { if (!reduced) kickV -= 0.05; }, scaffold: !!(g && g.scaffold), floorY: 0.24, plumb: o.plumb && g && g.cur ? { x: o.plumb.reduce((a, [x]) => a + cx(x), 0) / o.plumb.length, y: Math.max(...o.plumb.map(([, y]) => cy(y))) } : null });
    for (const im of Object.values(blocks)) { im.visible = im.count > 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.geometry.attributes.aGlow.needsUpdate = true; }

    // ---------- the parade ----------
    if (paradeObj) paradeObj.group.visible = false;
    if (cine && cine.kind === 'bayanihan' && cine.t / cine.dur < 0.8 && cine.t / cine.dur > 0.15) { const P = getParade(); P.group.visible = true; const k = clamp(cine.t / cine.dur, 0, 1); P.group.position.set(lerp(-6.5, 0.5, k), 0, 3.6); P.group.rotation.y = 0; P.update(dt); }
    else if (paradeBG) { paradeBG.t += dt; const P = getParade(); const k = paradeBG.t / 9; if (k > 1) paradeBG = null; else { P.group.visible = true; P.group.position.set(lerp(-26, 26, k), 0, -12.6); P.update(dt); } }

    cheerT = Math.max(0, cheerT - dt); if (crowd) crowd.update(t, cheerT > 0 ? 1 : 0);
    site.updateBunting(t, dt, stormOn ? 1 : 0.2);
    fx.quality = post.level;
    fx.update(dt, t, { reduced, wind: stormOn ? 3.2 : 0, flash: lightning });

    // ---------- the camera ----------
    for (let k = Math.ceil(dt / 0.004); k > 0; k--) { const h = dt / Math.ceil(dt / 0.004); kickV += (-kickY * 260 - kickV * 22) * h; kickY += kickV * h; } // a stiff spring: a short kick, back at once
    if (!Number.isFinite(kickY)) { kickY = 0; kickV = 0; }
    if (reduced) { kickY = 0; kickV = 0; }
    shake = Math.max(0, shake - dt * 0.8); punch = Math.max(0, punch - dt * 1.6); flashK = Math.max(0, flashK - dt * 2.2);
    const mode = cine ? 'cine' : o.mode;
    let target, rate = 3;
    if (cine) {
      cine.t += dt;
      const k = cine.t / cine.dur;
      if (cine.kind === 'bayanihan') {
        // a beat on the well as the rows go, then the neighbours carrying the kubo past, then back
        if (k < 0.16) { target = { pos: [play.pos.x, play.pos.y - 0.4, play.pos.z * lerp(1, 0.86, ease(k / 0.16))], look: [play.look.x, play.look.y, 0], fov: play.fov }; rate = 1; }
        else if (k < 0.82) { target = shots.bayanihan((k - 0.16) / 0.66); rate = 1; }
        else { const q = ease((k - 0.82) / 0.18); target = { pos: [play.pos.x, play.pos.y, play.pos.z * lerp(0.9, 1, q)], look: [play.look.x, play.look.y, 0], fov: play.fov }; rate = 1; }
      } else {
        if (k < 0.8) { target = shots.house(k / 0.8); rate = 1; } else { const q = ease((k - 0.8) / 0.2); target = { pos: [play.pos.x, play.pos.y, play.pos.z * lerp(0.92, 1, q)], look: [play.look.x, play.look.y, 0], fov: play.fov }; rate = 1; }
      }
      if (cine.t >= cine.dur) cine = null;
    } else if (o.mode === 'play' && g && g.phase === 'ready') {
      // the establishing swoop into the well as the game begins
      const k = clamp(1 - (g.phaseT - g.acc * 60) / READY, 0, 1);
      if (reduced) { target = asShot(play); rate = 1; }
      else { const a = shots.establish(), q = ease(clamp(k / 0.85, 0, 1)); target = { pos: a.pos.map((v, i) => lerp(v, play.pos.getComponent(i), q)), look: a.look.map((v, i) => lerp(v, play.look.getComponent(i), q)), fov: lerp(a.fov, play.fov, q) }; rate = 1; }
    } else if (o.mode === 'play' || o.mode === 'safety') { target = asShot(play); rate = cam.mode === 'play' ? 1 : 4; }
    else if (o.mode === 'pause') { target = shots.pause(); rate = 2.5; }
    else if (o.mode === 'results') {
      target = shots.results(t); rate = 1.6;
      if (cam.mode !== 'results') fx.clear();
      if (cam.mode !== 'results' && g && camera.aspect > 1.1) { const h = site.house.group.position, n = 1 + Math.floor(g.lines / 10); fx.callout(`${n} PALAPAG`, h.x, site.house.top() + 1.6, h.z + 3, { color: 'gold', height: 2.1, life: 60, rise: 0.3, delay: 0.2 }); }
    }
    else { target = shots.title(t); rate = cam.mode === 'title' ? 1 : 1.2; }
    // coming from another shot, ease into the play framing instead of jumping (then it holds still)
    if (mode === 'play' && cam.mode !== 'play' && cam.mode !== 'cine') cam.settle = 0.6;
    if (cam.settle > 0 && rate >= 1 && mode === 'play') { cam.settle -= dt; rate = 7; if (cam.settle <= 0) rate = 1; }
    cam.mode = mode;
    setCam(target, dt, rate);
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    camera.position.y += kickY;
    if (shake > 0 && !reduced) { camera.position.x += (Math.random() - 0.5) * shake * 0.3; camera.position.y += (Math.random() - 0.5) * shake * 0.3; }
    const f = cam.fov * (1 - punch * 0.05 * Math.sin(Math.min(1, punch) * Math.PI));
    if (Math.abs(camera.fov - f) > 1e-4) { camera.fov = f; camera.updateProjectionMatrix(); }
    // the board's place on screen, so the heat haze can leave it alone
    let hole = null;
    if (hazeOn) { const a = vp.set(WELL.x0 - 0.3, WELL.y0 - 0.3, 0.3).project(camera), b = vs.set(WELL.x1 + 0.3, WELL.top + 0.3, 0.3).project(camera); hole = [(a.x + 1) / 2, (a.y + 1) / 2, (b.x + 1) / 2, (b.y + 1) / 2]; }
    post.render(dt, { flash: reduced ? 0 : Math.max(flashK, lightning * 0.35), bloomBoost: flashK * 1.5 + lightning, haze: hazeOn && post.level >= 1 ? 1 : 0, hole });
  }
  const fmt = (ticks) => { const s = Math.floor(ticks / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // Where something in the world is on screen, in CSS pixels (for the foreman's bubble).
  function screenOf(x, y, z) { const v = vp.set(x, y, z).project(camera), r = canvas.getBoundingClientRect(); return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 }; }
  const kapHead = () => screenOf(kap.x, 2.25, kap.z);
  const inspHead = () => (insp && insp.on ? screenOf(...insp.head()) : { x: 0, y: 0, on: false });
  const rivalHead = () => (rig && vsOn ? screenOf(rig.RX, rig.LIFT + (WELL.top + 1.75) * rig.S, rig.Z + 0.3) : { x: 0, y: 0, on: false });

  // ---------- the real things, as they load ----------
  function setEnv(env) {
    const ctx = {
      pmrem, current: () => true,
      setEnvironment(key, tex, power, turn) { ibl[key] = { tex, turn }; },
      setBackdrop(id, tex) { skies[id] = tex; if (!backdropOn && skies.golden) { backdropOn = true; skyMesh.material = backdropMat; } },
    };
    return dress(env, site, ctx);
  }
  let crowd = null, cheerT = 0;
  function setCrowd(lib) {
    const sx = site.street.shop.x, sz = site.street.shop.z;
    const spots = [{ x: sx - 0.6, y: 0.42, z: sz + 0.85, stand: false, face: 0.1 }, { x: sx + 0.5, y: 0.42, z: sz + 0.85, stand: false, face: -0.1 }, { x: sx - 1.6, y: 0.3, z: sz + 1.7, stand: false, face: 0.4 },
      { x: sx + 1.7, y: 0.3, z: sz + 1.8, stand: false, face: -0.3 }, { x: sx + 2.6, y: -0.14, z: sz + 1.4, stand: true, face: -0.5 }, { x: sx - 2.9, y: -0.14, z: sz + 1.5, stand: true, face: 0.6 }, { x: 13.5, y: -0.14, z: -11.5, stand: true, face: -0.4 }];
    let q = 7; const r2 = () => ((q = (q * 16807) % 2147483647) / 2147483647);
    crowd = buildCrowd(lib, spots, r2); scene.add(crowd.group);
  }
  function setPeople(lib) {
    foremanLib = lib;
    try { kap.real = foremanModel(lib, scene); } catch { kap.real = null; }
  }

  resize();
  applyTod('golden', null, 0, 1);
  return {
    frame, event, resize, post, renderer, scene, setEnv, setPeople, setCrowd, kapHead, screenOf, rivalEvent, attack, setVersus, rivalHead, inspHead,
    setHouseStyle(id) { site.setHouseStyle(id); },
    celebrate() { fx.confetti(0, WELL.top + 1, 1.2, 220); cheerT = 4; reactKapatas('victory'); if (!reduced) flashK = 0.2; },
    get cellPx() { return cellPx; }, get cine() { return cine; }, get busy() { return fx.busy; },
    setInsets(top, bottom) { insets = { top, bottom }; fit(); }, setAngled(b) { angled = b; fit(); },
    setShadows(on) { sun.castShadow = on; },
    debug: { cam, play, site, fx, kap, get compact() { return compact; }, get insp() { return insp; } },
  };
}
