// Synthesized sound for Hollow Blocks: an original rondalla-style tune (plucked banduria over a
// guitar bass) that speeds up floor by floor, the clack of blocks, the crumble of a cleared row, a
// Bayanihan fanfare and the rumble of the flood. Nothing plays until start() runs from a gesture.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// G–Em–C–D, a bar each; the tune in eighths (-1 rests)
const BASS = [[43, 50], [40, 47], [36, 43], [38, 45]];
const TUNE = [
  [74, 71, 74, 76, 74, 71, 67, -1], [71, 72, 74, 72, 71, 69, 67, -1],
  [72, 76, 79, 76, 74, 72, 71, 72], [74, -1, 72, 71, 69, 71, 72, -1],
  [79, 78, 76, 74, 76, 74, 71, -1], [67, 71, 74, 79, 76, 74, 71, 67],
  [72, 71, 69, 72, 71, 69, 67, 69], [71, -1, 69, -1, 67, -1, -1, -1],
];

export function createAudio() {
  let ctx = null, master = null, music = null, sfx = null, noise = null, muted = false;
  let step = 0, nextAt = 0, playing = false, tempo = 120;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
    sfx = ctx.createGain(); sfx.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 50);
  }

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
    update(g, on) {
      if (!ctx) return;
      const live = on && g && (g.phase === 'play' || g.phase === 'clear' || g.phase === 'ready');
      if (live !== playing) { playing = live; if (live) nextAt = ctx.currentTime + 0.05; }
      music.gain.setTargetAtTime(live ? 1 : 0, ctx.currentTime, 0.2);
      tempo = Math.min(200, 112 + ((g && g.level) || 1) * 5 + (g && g.mode === 'deadline' ? 20 : 0));
    },
    event(e) {
      if (!ctx || muted) return;
      switch (e.type) {
        case 'move': tone(900, 0.025, 'square', 0.015); break;
        case 'rotate': tone(e.kick ? 700 : 560, 0.04, 'triangle', 0.035); break;
        case 'hold': hiss(0.12, 3000, 0.05, 0, 'highpass'); break;
        case 'hardDrop': tone(120, 0.12, 'sine', 0.12, 0, 0.5); hiss(0.08, 800, 0.08); break;
        case 'lock': tone(240, 0.05, 'square', 0.03); hiss(0.05, 1500, 0.04); break;
        case 'lines': {
          hiss(0.5, 1200, 0.16, 0, 'lowpass', 200);
          const run = e.n === 4 ? [0, 4, 7, 12, 16, 19, 24] : [0, 4, 7, 12].slice(0, e.n + 1);
          run.forEach((k, i) => tone(NOTE(67 + k + Math.min(8, e.combo)), 0.14, 'square', 0.04, i * 0.06));
          if (e.spin) tone(400, 0.3, 'sawtooth', 0.03, 0, 2);
          if (e.n === 4) [55, 60, 64, 67].forEach((n, i) => { tone(NOTE(n), 0.5, 'square', 0.03, 0.45 + i * 0.03); tone(NOTE(n - 12), 0.5, 'triangle', 0.05, 0.45); });
          break;
        }
        case 'tspin': tone(400, 0.3, 'sawtooth', 0.03, 0, 2); break;
        case 'levelUp': [67, 71, 74, 79].forEach((n, i) => tone(NOTE(n), 0.14, 'square', 0.045, i * 0.09)); break;
        case 'rise': tone(60, 0.5, 'sawtooth', 0.06, 0, 0.7); hiss(0.4, 300, 0.1, 0, 'lowpass'); break;
        case 'gameover': hiss(1, 600, 0.2, 0, 'lowpass', 80); [67, 64, 60, 55].forEach((n, i) => tone(NOTE(n), 0.4, 'triangle', 0.07, 0.2 + i * 0.28)); break;
        case 'done': [67, 71, 74, 79, 74, 79, 83].forEach((n, i) => tone(NOTE(n), 0.16, 'square', 0.05, i * 0.11)); break;
        case 'go': [67, 74, 79].forEach((n, i) => tone(NOTE(n), 0.12, 'triangle', 0.05, i * 0.1)); break;
        default: break;
      }
    },
  };
}
