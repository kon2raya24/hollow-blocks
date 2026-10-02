// Feel: how hard each moment buzzes the phone (navigator.vibrate) and rumbles a controller
// (vibrationActuator), scaled by its size. hapticFor is pure; apply() does the buzzing.
const clamp = (v) => Math.max(0, Math.min(1, v));
export function hapticFor(e) {
  switch (e.type) {
    case 'hardDrop': { const r = Math.min(20, e.rows || 0); return { ms: 10 + r, strong: clamp(0.1 + r * 0.02), weak: clamp(0.25 + r * 0.02), pattern: [10 + Math.round(r / 2)] }; }
    case 'lines': {
      if (e.n === 4) return { ms: 260, strong: 0.85, weak: 1, pattern: [30, 30, 60, 30, 90] };
      const k = e.n + (e.spin ? 1.5 : 0) + Math.min(5, e.combo || 0) * 0.3;
      return { ms: Math.round(30 + k * 25), strong: clamp(0.15 + k * 0.12), weak: clamp(0.3 + k * 0.1), pattern: [Math.round(15 + k * 10)] };
    }
    case 'gameover': return { ms: 600, strong: 1, weak: 0.6, pattern: [80, 40, 160, 40, 240] };
    case 'tool': return { ms: 120, strong: 0.5, weak: 0.7, pattern: [25, 20, 25] };
    case 'garbage': { const r = Math.min(8, e.rows || 1); return { ms: 40 + r * 15, strong: clamp(0.2 + r * 0.08), weak: 0.4, pattern: [20 + r * 8] }; }
    case 'lindol': case 'andamyo': return { ms: 300, strong: 0.7, weak: 0.5, pattern: [60, 40, 60] };
    case 'perfect': return { ms: 220, strong: 0.6, weak: 1, pattern: [20, 20, 20, 20, 60] };
    default: return null;
  }
}
// buzz a phone and every controller that can rumble
export function apply(h, { touch = false, pads = [] } = {}) {
  if (!h) return;
  try { if (touch && navigator.vibrate) navigator.vibrate(h.pattern); } catch { /* no haptics */ }
  for (const p of pads) { try { const a = p && p.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: h.ms, strongMagnitude: h.strong, weakMagnitude: h.weak }).catch(() => {}); } catch { /* no rumble */ } }
}
