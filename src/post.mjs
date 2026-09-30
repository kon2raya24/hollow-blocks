// The film look (adapted from Tumbang Preso and Bakbakan). The frame is rendered in HDR, then:
// - ambient occlusion grounds the blocks, the scaffold and the props
// - bloom makes the sun, the lamps, the sparks and the callouts glow
// - a filmic tone map
// - a grade per time of day (contrast, saturation, a tint, lifted shadows), with a vignette and fine grain
// - heat haze at noon, shimmering everywhere but over the board, so the pieces stay crisp
// - a white flash for lightning and the big clears
// - SMAA for clean edges
// Three levels (2 all, 1 without occlusion, 0 plain). It steps down by itself when frames run slow.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, OutputPass, SMAAPass, ShaderPass } from './vendor/three-fx.min.js';

// [contrast, saturation, tint, vignette, bloom strength, bloom threshold, shadow lift]
export const GRADE = {
  golden: [1.08, 1.12, [1.06, 0.99, 0.9], 0.42, 0.32, 0.95, [0.02, 0.01, 0.03]],
  dusk: [1.1, 1.08, [1.02, 0.94, 1.0], 0.48, 0.4, 0.8, [0.03, 0.01, 0.05]],
  night: [1.12, 0.95, [0.92, 0.96, 1.08], 0.55, 0.35, 0.85, [0.0, 0.01, 0.03]],
  noon: [1.18, 1.06, [1.06, 1.02, 0.92], 0.34, 0.22, 1.25, [0.0, 0.0, 0.0]],
  storm: [1.12, 0.78, [0.9, 0.97, 1.06], 0.55, 0.32, 0.9, [0.0, 0.01, 0.025]],
};

const Grade = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, contrast: { value: 1 }, sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3(0, 0, 0) },
    vig: { value: 0.4 }, grain: { value: 0.03 }, flash: { value: 0 }, haze: { value: 0 }, hole: { value: new THREE.Vector4(0, 0, 0, 0) }, aspect: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, contrast, sat, vig, grain, flash, haze, aspect; uniform vec3 tint, lift; uniform vec4 hole; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5, uv = vUv;
      if (haze > 0.001) {
        // rising heat: a shimmer strongest low in the frame, and none over the board (hole: x0, y0, x1, y1)
        vec2 m = smoothstep(vec2(0.0), vec2(0.03), uv - hole.xy) * smoothstep(vec2(0.0), vec2(0.03), hole.zw - uv);
        float k = haze * (1.0 - m.x * m.y) * smoothstep(0.75, 0.05, uv.y);
        uv += vec2(sin(uv.y * 90.0 - time * 5.0) * 0.0016, sin(uv.x * 70.0 + time * 3.0) * 0.0012) * k;
      }
      vec3 c = texture2D(tDiffuse, uv).rgb;
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat) * tint + lift * (1.0 - l);
      c *= mix(1.0, smoothstep(0.95, 0.2, length(d * vec2(1.0 + 0.25 * aspect, 1.0))), vig);
      c += (rnd(vUv * 731.0 + fract(time) * 17.0) - 0.5) * grain;
      c = mix(c, vec3(1.0, 0.98, 0.94), flash);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { level = 2, auto: auto0 = true } = {}) {
  let auto = auto0;
  let composer = null, gtao = null, bloom = null, grade = null, lvl = level, aoHidden = [];
  const size = new THREE.Vector2();
  function build() {
    if (composer) composer.dispose();
    composer = null; gtao = bloom = grade = null;
    if (lvl <= 0) return;
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, camera));
    if (lvl >= 2) {
      // the occlusion pass redraws the scene's shape: leave the effects (callouts, dust, rain) out of it,
      // or their quads would cast dark boxes
      const toggle = (on) => ({ enabled: true, needsSwap: false, clear: false, renderToScreen: false, setSize() {}, dispose() {}, render() { for (const o of aoHidden) o.visible = on; } });
      composer.addPass(toggle(false));
      gtao = new GTAOPass(scene, camera, size.x, size.y, undefined, { radius: 0.5, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1 }, { radius: 8, rings: 2, samples: 16 });
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
      composer.addPass(toggle(true));
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.55, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(Grade);
    composer.addPass(grade);
    composer.addPass(new SMAAPass());
    setStage(stageId);
  }
  let stageId = 'golden', mixTo = null, mixK = 0;
  const cur = () => {
    const A = GRADE[stageId] || GRADE.golden;
    if (!mixTo || mixK <= 0) return A;
    const B = GRADE[mixTo] || A, k = mixK, l = (a, b) => a + (b - a) * k;
    return [l(A[0], B[0]), l(A[1], B[1]), A[2].map((v, i) => l(v, B[2][i])), l(A[3], B[3]), l(A[4], B[4]), l(A[5], B[5]), A[6].map((v, i) => l(v, B[6][i]))];
  };
  function apply() {
    const G = cur();
    if (grade) { const u = grade.uniforms; u.contrast.value = G[0]; u.sat.value = G[1]; u.tint.value.set(...G[2]); u.vig.value = G[3]; u.lift.value.set(...G[6]); }
    if (bloom) { bloom.threshold = G[5]; }
  }
  // a grade, or a blend of two (the sky going from gold to dusk to night as the house rises)
  function setStage(id, to = null, k = 0) { if (id !== stageId) grace = Math.max(grace, 2); stageId = id; mixTo = to; mixK = k; apply(); }
  // slow frames: step down once the average stays under ~40 fps for a few seconds
  let avg = 1 / 60, slowT = 0, last = 0, grace = 6; // loading and shader compiles hitch at first: give it a few seconds
  function render(dt, { bloomBoost = 0, flash = 0, haze = 0, hole = null } = {}) {
    // real time between frames (the game's dt is capped, so it can't tell how slow things are)
    const t = performance.now() / 1000, real = last ? Math.min(1, t - last) : 1 / 60; last = t;
    avg = avg * 0.9 + real * 0.1;
    if (grace > 0) grace -= real; else slowT = avg > 1 / 40 ? slowT + real : Math.max(0, slowT - real);
    if (auto && slowT > 4 && lvl > 0) { lvl--; slowT = 0; grace = 3; build(); if (onStep) onStep(lvl); }
    if (!composer) { renderer.render(scene, camera); return; }
    const u = grade.uniforms;
    u.time.value = t; u.flash.value = flash; u.haze.value = haze; u.aspect.value = size.x / Math.max(1, size.y);
    if (hole) u.hole.value.set(...hole); else u.hole.value.set(0, 0, 0, 0);
    bloom.strength = cur()[4] + bloomBoost;
    composer.render(dt);
  }
  let onStep = null;
  function resize() { if (!composer) return; renderer.getSize(size); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(size.x, size.y); }
  build();
  return {
    render, resize, setStage, setAuto(b) { auto = b; }, onStep(f) { onStep = f; }, hideFromAO(list) { aoHidden = list; },
    get level() { return lvl; }, setLevel(n) { if (n !== lvl) { lvl = n; build(); } },
    get fps() { return 1 / avg; },
  };
}
