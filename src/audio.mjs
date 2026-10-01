// Sound for Hollow Blocks. Real recordings (CC0, from Kenney) for every material: bamboo knocks, a
// hollow block's dull clunk, a brick's clink, yero's rattle, plywood, a tile's ring, adobe, mud; and
// for the crumble of a row and a new floor's bell. Around them, synthesized: an original rondalla-style
// tune (plucked banduria over a guitar bass) that speeds up floor by floor, the Bayanihan fanfare and
// the neighbours' cheer, the flood's rumble, rain, wind and thunder in a bagyo, cicadas at noon.
// Nothing plays until start() runs from a gesture.
const SAMPLES = ['wood', 'plank', 'mining', 'metal', 'plate', 'soft', 'heavy', 'bell', 'tin', 'glass'];
// each piece's material: [recording, pitch, gain]
const MAT = { I: [['wood', 1.25, 0.9]], O: [['mining', 0.8, 0.8], ['heavy', 1.1, 0.35]], T: [['plate', 0.7, 0.55], ['mining', 1.1, 0.4]], S: [['metal', 1.0, 0.6], ['tin', 0.8, 0.3]], Z: [['plank', 1.0, 0.9]], J: [['plate', 1.15, 0.7], ['glass', 1.2, 0.25]], L: [['mining', 0.95, 0.7]], 8: [['soft', 0.8, 0.9]] };
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// G–Em–C–D, a bar each; the tune in eighths (-1 rests)
const BASS = [[43, 50], [40, 47], [36, 43], [38, 45]];
const TUNE = [
  [74, 71, 74, 76, 74, 71, 67, -1], [71, 72, 74, 72, 71, 69, 67, -1],
  [72, 76, 79, 76, 74, 72, 71, 72], [74, -1, 72, 71, 69, 71, 72, -1],
  [79, 78, 76, 74, 76, 74, 71, -1], [67, 71, 74, 79, 76, 74, 71, 67],
  [72, 71, 69, 72, 71, 69, 67, 69], [71, -1, 69, -1, 67, -1, -1, -1],
];

export function createAudio({ base = 'assets/sfx/' } = {}) {
  let ctx = null, master = null, music = null, sfx = null, noise = null, muted = false, amb = null;
  const buf = {}, norm = {}, mix = { music: 1, sfx: 1 };
  // each recording brought to the same loudness (RMS over its loud part), and never past 0.9 at its peak
  function normOf(b) {
    const d = b.getChannelData(0); let peak = 0, sum = 0, n = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak * 0.1) { sum += v * v; n++; } }
    const rms = n ? Math.sqrt(sum / n) : peak;
    return Math.min(0.9 / Math.max(peak, 1e-4), 0.22 / Math.max(rms, 1e-4));
  }
  let step = 0, nextAt = 0, playing = false, tempo = 120;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    // everything goes through a gentle limiter, so a Bayanihan's pile-up of sounds never clips
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -9; lim.knee.value = 6; lim.ratio.value = 10; lim.attack.value = 0.003; lim.release.value = 0.2; lim.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(lim);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = mix.sfx; sfx.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 50);
    for (const k of SAMPLES) for (let i = 0; i < 3; i++) fetch(`${base}${k}${i}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => ctx.decodeAudioData(a)).then((b) => { buf[k + i] = b; norm[k + i] = normOf(b); }).catch(() => { /* synth only */ });
    // the weather beds: rain (and wind) for a bagyo, cicadas at noon; each a filtered noise loop
    const bed = (type, f, q) => { const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noise; src.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl).connect(g).connect(sfx); src.start(); return { g, fl }; };
    amb = { rain: bed('highpass', 1800, 0.4), wind: bed('lowpass', 420, 1), cicada: bed('bandpass', 5200, 12) };
  }
  // one of a recording's takes, a little higher or lower each time
  function play(name, gain = 1, rate = 1, when = 0) {
    if (!ctx || muted) return false;
    const takes = [0, 1, 2].map((i) => buf[name + i]).filter(Boolean);
    if (!takes.length) return false;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    const pickI = Math.floor(Math.random() * takes.length), key = [0, 1, 2].map((i) => name + i).filter((k) => buf[k])[pickI];
    s.buffer = buf[key]; s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * 0.07);
    g.gain.value = gain * (norm[key] || 1); s.connect(g).connect(sfx); s.start(ctx.currentTime + when);
    return true;
  }
  function impact(piece, gain) { const m = MAT[piece] || MAT.O; let any = false; for (const [n, r, g] of m) any = play(n, g * gain, r) || any; return any; }

  function tone(freq, dur, type = 'square', gain = 0.05, when = 0, bend = 0, out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, freq, gain, when = 0, type = 'bandpass', to = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // a plucked string: bright attack, quick fade (the banduria), doubled an octave up, softly
  function pluck(n, when, gain = 0.03) { tone(NOTE(n), 0.22, 'triangle', gain, when, 0, music); tone(NOTE(n + 12), 0.08, 'square', gain * 0.25, when, 0, music); }

  function schedule() {
    if (!ctx || !playing || muted) return;
    const eighth = 30 / tempo;
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.2) {
      const when = nextAt - ctx.currentTime, bar = Math.floor(step / 8) % TUNE.length, s = step % 8;
      const n = TUNE[bar][s];
      if (n > 0) { pluck(n, when); if (s % 2 === 0) pluck(n, when + eighth * 0.5, 0.012); } // the tremolo
      const b = BASS[bar % 4];
      if (s === 0 || s === 4) tone(NOTE(b[s ? 1 : 0]), eighth * 1.8, 'triangle', 0.07, when, 0, music);
      if (s === 2 || s === 6) for (const c of [b[0] + 12, b[0] + 16, b[0] + 19]) tone(NOTE(c), eighth * 0.4, 'triangle', 0.01, when, 0, music); // the strum
      nextAt += eighth; step++;
    }
  }

  return {
    start,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    setMix(o) { mix.music = o.music ?? 1; mix.sfx = o.sfx ?? 1; if (sfx) sfx.gain.value = mix.sfx; },
    thunder() { if (!ctx || muted) return; hiss(2.4, 180, 0.5, 0.15, 'lowpass', 40); hiss(0.4, 900, 0.12, 0.1, 'lowpass', 200); tone(45, 1.8, 'sawtooth', 0.05, 0.2, 0.6); },
    update(g, on) {
      if (!ctx) return;
      const live = on && g && (g.phase === 'play' || g.phase === 'clear' || g.phase === 'ready');
      if (live !== playing) { playing = live; if (live) nextAt = ctx.currentTime + 0.05; }
      music.gain.setTargetAtTime(live ? mix.music * 1.4 : 0, ctx.currentTime, 0.2); // the tune sits under the effects
      if (amb) { const storm = g && g.mode === 'bagyo' && live, noon = g && g.mode === 'deadline' && live; amb.rain.g.gain.setTargetAtTime(storm ? 0.05 : 0, ctx.currentTime, 0.6); amb.wind.g.gain.setTargetAtTime(storm ? 0.06 + Math.sin(ctx.currentTime * 0.4) * 0.03 : 0, ctx.currentTime, 0.8); amb.cicada.g.gain.setTargetAtTime(noon ? 0.012 * (0.6 + 0.4 * Math.sin(ctx.currentTime * 7)) : 0, ctx.currentTime, 0.1); }
      tempo = Math.min(200, 112 + ((g && g.level) || 1) * 5 + (g && g.mode === 'deadline' ? 20 : 0));
    },
    event(e) {
      if (!ctx || muted) return;
      switch (e.type) {
        case 'move': tone(900, 0.025, 'square', 0.015); break;
        case 'rotate': tone(e.kick ? 700 : 560, 0.04, 'triangle', 0.035); break;
        case 'hold': hiss(0.12, 3000, 0.05, 0, 'highpass'); break;
        case 'hardDrop': tone(110, 0.14, 'sine', 0.14, 0, 0.5); if (!play('heavy', 0.35 + Math.min(20, e.rows) * 0.02, 0.9)) hiss(0.08, 800, 0.08); break;
        case 'lock': if (!impact(e.piece, 0.8)) { tone(240, 0.05, 'square', 0.03); hiss(0.05, 1500, 0.04); } break;
        case 'lines': {
          hiss(0.5, 1200, 0.16, 0, 'lowpass', 200);
          for (let k = 0; k < Math.min(4, e.n + 1); k++) play('mining', 0.5, 0.7 + k * 0.12, k * 0.05);
          if (e.n === 4) { hiss(1.8, 700, 0.12, 0.3, 'bandpass', 900); hiss(1.5, 2200, 0.05, 0.3, 'bandpass'); play('bell', 0.35, 1, 0.45); } // the neighbours cheer
          const run = e.n === 4 ? [0, 4, 7, 12, 16, 19, 24] : [0, 4, 7, 12].slice(0, e.n + 1);
          run.forEach((k, i) => tone(NOTE(67 + k + Math.min(8, e.combo)), 0.14, 'square', 0.04, i * 0.06));
          if (e.spin) tone(400, 0.3, 'sawtooth', 0.03, 0, 2);
          if (e.b2b) { tone(900, 0.35, 'sine', 0.04, 0.05, 2.5); play('metal', 0.35, 1.8, 0.05); play('glass', 0.3, 1.5, 0.12); hiss(0.3, 6000, 0.05, 0.05, 'highpass'); } // the spark streak
          if (e.n === 4) [55, 60, 64, 67].forEach((n, i) => { tone(NOTE(n), 0.5, 'square', 0.03, 0.45 + i * 0.03); tone(NOTE(n - 12), 0.5, 'triangle', 0.05, 0.45); });
          break;
        }
        case 'tspin': tone(400, 0.3, 'sawtooth', 0.03, 0, 2); break;
        case 'ceremony': { [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => { tone(NOTE(n), 0.3, 'square', 0.025, 0.2 + i * 0.13); tone(NOTE(n - 12), 0.3, 'triangle', 0.04, 0.2 + i * 0.13); }); hiss(2.5, 700, 0.1, 0.1, 'bandpass', 900); play('bell', 0.4, 1, 0.2); play('bell', 0.3, 1.5, 1.1); break; }
        case 'levelUp': [67, 71, 74, 79].forEach((n, i) => tone(NOTE(n), 0.14, 'square', 0.045, i * 0.09)); play('bell', 0.3, 1.3, 0.2); break;
        case 'rise': tone(60, 0.5, 'sawtooth', 0.06, 0, 0.7); hiss(0.4, 300, 0.1, 0, 'lowpass'); play('soft', 0.8, 0.7); break;
        case 'gameover': hiss(1.6, 600, 0.26, 0, 'lowpass', 60); for (let k = 0; k < 6; k++) play(k % 2 ? 'mining' : 'heavy', 0.45, 0.6 + Math.random() * 0.3, k * 0.09); [67, 64, 60, 55].forEach((n, i) => tone(NOTE(n), 0.4, 'triangle', 0.07, 0.2 + i * 0.28)); break;
        case 'done': [67, 71, 74, 79, 74, 79, 83].forEach((n, i) => tone(NOTE(n), 0.16, 'square', 0.05, i * 0.11)); break;
        case 'go': [67, 74, 79].forEach((n, i) => tone(NOTE(n), 0.12, 'triangle', 0.05, i * 0.1)); break;
        default: break;
      }
    },
  };
}
