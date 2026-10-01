// Laban (versus): your well against a rival's, both pure games stepped in lockstep, tick for tick.
// Clears send mud: 2 rows send 1, 3 send 2, a Bayanihan 4, a T-spin double 4 (single 2, triple 6),
// back-to-back adds 1, a combo adds more the longer it runs, and a perfect clear sends 10. What you send
// first cancels mud still waiting for you; the rest crosses over. The rival is the bot, paced to a
// number of pieces a second and making a mistake now and then, all from the match's own seeded stream,
// so a match replays exactly from its seed and your inputs.
import { createGame, tick, receive, cancel, pendingRows, NOINPUT, fits } from './game.mjs';
import { choose, chooseSpin, ranked } from './bot.mjs';
import { rand } from './rng.mjs';

export const ATTACK = {
  lines: [0, 0, 1, 2, 4], tspin: [0, 2, 4, 6], mini: [0, 0, 1], b2b: 1, perfect: 10,
  combo: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5], // by the combo count (0 is the first clear)
};
// The mud a clear sends (a 'lines' event from the rules).
export function attackFor(e) {
  let a = e.spin === 'full' ? ATTACK.tspin[e.n] : e.spin === 'mini' ? ATTACK.mini[Math.min(e.n, 2)] : ATTACK.lines[e.n];
  if (e.b2b) a += ATTACK.b2b;
  if (e.combo > 0) a += ATTACK.combo[Math.min(e.combo, ATTACK.combo.length - 1)];
  return a;
}

// The rivals. pps: pieces a second; mistake: how often a worse placement is taken; style: the bot's
// (null stacks clean, 'tetris' builds for Bayanihans, 'tspin' builds T-slots); spins: takes T-spins.
// Tuned against the bot as the player (.scratch/vs-sim.mjs): Baguhan sends a few rows a minute,
// Bihasa about 14, Kapatas about 30 with T-spins on top.
export const LEVELS = {
  baguhan: { id: 'baguhan', name: 'Baguhan', pps: 0.75, mistake: 0.3, style: null, think: 14 },
  bihasa: { id: 'bihasa', name: 'Bihasa', pps: 1.25, mistake: 0.12, style: 'tetris', think: 8 },
  kapatas: { id: 'kapatas', name: 'Kapatas', pps: 2, mistake: 0.04, style: 'tetris', spins: true, think: 4 },
};
// Liga ng Barangay: six rivals, each beaten opens the next. Every one talks their own way.
export const LADDER = [
  { id: 'totoy', name: 'Totoy Bato', brgy: 'San Roque', tag: 'Tagasalansan', blurb: 'Bagong peon. Mabagal pero matiyaga: patag at malinis ang salansan.', pps: 0.7, mistake: 0.28, style: null, think: 16, color: '#6fb3c4',
    says: { start: ['Dahan-dahan lang, pare.', 'Sige, turuan mo ako!'], send: ['Ayan, may putik ka!', 'Uy, tumama!'], hurt: ['Aray, ang bigat!', 'Teka lang, teka lang!'], danger: ['Patay, ang taas na!'], win: ['Swerte lang, pare!'], lose: ['Ang galing mo, idol!'] } },
  { id: 'nena', name: 'Aling Nena', brgy: 'San Roque', tag: 'Tagasalansan', blurb: 'May-ari ng hardware. Kilala niya ang bawat hollow block, at walang butas ang pader niya.', pps: 1, mistake: 0.14, style: null, think: 12, color: '#ff8ae2',
    says: { start: ['Walang utang dito, ha.', 'Bayad muna bago laro!'], send: ['Libre na yang putik, suki!', 'O, dagdag pa!'], hurt: ['Hoy, ang daya!', 'Ay, susmaryosep!'], danger: ['Naku, puno na ang bodega!'], win: ['Balik ka bukas, suki!'], lose: ['Sige na nga, panalo ka.'] } },
  { id: 'berto', name: 'Mang Berto', brgy: 'Malinta', tag: 'Bayanihan', blurb: 'Tatlumpung taon sa construction. Iniipon ang kawayan para sa malaking Bayanihan.', pps: 1.1, mistake: 0.1, style: 'tetris', think: 10, color: '#b9c95a',
    says: { start: ['Kawayan lang ang kailangan ko.', 'Tingnan natin, bata.'], send: ['BAYANIHAN! Tanggapin mo!', 'Buhat-buhat yan!'], hurt: ['Hindi pa ako tapos!', 'Matibay pa rin!'], danger: ['Nasaan na ang kawayan ko?!'], win: ['Karanasan ang panalo, iho.'], lose: ['Ikaw na ang bagong mason!'] } },
  { id: 'bebang', name: 'Bebang Bilis', brgy: 'Malinta', tag: 'Bilis', blurb: 'Delivery rider tuwing umaga, kampeon tuwing gabi. Hindi naghihintay ng kawayan.', pps: 1.8, mistake: 0.18, style: 'tetris', think: 3, color: '#ffa24a',
    says: { start: ['Bilisan mo, may delivery pa ako!', 'Go, go, go!'], send: ['Express delivery ng putik!', 'Bilis, oh!'], hurt: ['Ang kupad mo pero ang sakit!', 'Aguy!'], danger: ['Traffic! Traffic!'], win: ['Sa susunod, bilisan mo!'], lose: ['Ang bilis mo rin pala!'] } },
  { id: 'dado', name: 'Engr. Dado', brgy: 'Bagong Silang', tag: 'T-spin', blurb: 'Lisensyadong inhinyero. Mahilig sa diskarte: iniikot ang ladrilyo papasok sa butas.', pps: 1.5, mistake: 0.06, style: 'tspin', spins: true, think: 6, color: '#c4553a',
    says: { start: ['Kalkulado ko na ang lahat.', 'Physics lang yan.'], send: ['T-spin! Pang-engineer!', 'Diskarte, hindi swerte.'], hurt: ['Hmm, hindi ko inasahan yan.', 'Recalculating...'], danger: ['Lagpas na sa design load!'], win: ['Q.E.D.'], lose: ['Kailangan kong i-recompute.'] } },
  { id: 'kapatas', name: 'Kapatas Rodel', brgy: 'Bagong Silang', tag: 'Lahat', blurb: 'Ang Kapatas mismo. Mabilis, matalino, at hindi nagkakamali. Talunin mo siya para sa korona.', pps: 2.1, mistake: 0.03, style: 'tetris', spins: true, think: 3, color: '#ffd23f',
    says: { start: ['Ipakita mo ang natutunan mo.', 'Walang awa sa site ko.'], send: ['Trabaho, hindi laro!', 'Ganyan magtayo!', 'Overtime ka bukas!'], hurt: ['Aba, natuto ka na!', 'Magaling, magaling!'], danger: ['Hindi pa tapos ang shift!'], win: ['Balik sa pagsasanay, iho.'], lose: ['Ikaw na ang bagong Kapatas!'] } },
];
export const rivalById = (id) => LADDER.find((r) => r.id === id) || LEVELS[id] || null;
// The ladder opens one rival at a time: each needs the one before beaten.
export const ladderOpen = (beaten, id) => { const i = LADDER.findIndex((r) => r.id === id); return i === 0 || (i > 0 && beaten.includes(LADDER[i - 1].id)); };

export function createMatch({ seed = 1, rival = 'baguhan', opts = null } = {}) {
  const prof = rivalById(rival) || LEVELS.baguhan;
  const a = createGame({ seed, mode: 'versus', difficulty: 'katamtaman', opts }); // the same pieces for both
  const b = createGame({ seed, mode: 'versus', difficulty: 'katamtaman' });
  return { seed, rival: prof.id, prof, a, b, ai: { rs: (seed * 1103515245 + 4242) >>> 0, piece: -1, keys: [], wait: 0 }, tick: 0, acc: 0, phase: 'play', winner: null, sent: [0, 0], got: [0, 0] };
}

// The rival's keys for this tick: plan a placement when a piece arrives (now and then a worse one), wait
// out the thinking, then press one key a tick; 'soft' holds down until the piece lands.
function rivalInput(m) {
  const g = m.b, P = m.prof, ai = m.ai;
  if (g.phase !== 'play' || !g.cur) return NOINPUT;
  if (ai.piece !== g.pieces) {
    let c = P.spins ? chooseSpin(g, P.style) : choose(g, P.style);
    if (rand(ai) < P.mistake) { const list = ranked(g.board, g.cur.type, P.style); if (list.length > 1) c = list[1 + Math.floor(rand(ai) * Math.min(6, list.length - 1))]; }
    ai.keys = c ? c.keys.slice() : ['hard'];
    ai.piece = g.pieces;
    ai.wait = Math.max(1, Math.round(60 / P.pps) - ai.keys.length * 2 - Math.floor(rand(ai) * P.think));
  }
  if (ai.wait-- > 0) return NOINPUT;
  const k = ai.keys[0];
  if (k === 'soft') { if (fits(g.board, { ...g.cur, y: g.cur.y + 1 })) return { pressed: [], held: ['down'] }; ai.keys.shift(); return NOINPUT; }
  ai.keys.shift(); ai.wait = 1;
  return k ? { pressed: [k], held: [] } : NOINPUT;
}

// One tick of the match: both wells, then the mud crosses. Returns each side's events and the match's.
export function matchTick(m, input = NOINPUT) {
  const out = { a: [], b: [], x: [] };
  if (m.phase !== 'play') return out;
  m.tick++;
  out.a = tick(m.a, input);
  out.b = tick(m.b, rivalInput(m));
  for (const [side, evs] of [[0, out.a], [1, out.b]]) {
    const me = side ? m.b : m.a, them = side ? m.a : m.b;
    for (const e of evs) {
      const atk = e.type === 'lines' ? attackFor(e) : e.type === 'perfect' ? ATTACK.perfect : 0;
      if (!atk) continue;
      const left = cancel(me, atk);
      if (left > 0) { receive(them, left); m.sent[side] += left; m.got[1 - side] += left; }
      out.x.push({ type: 'attack', from: side, n: atk, sent: left, cancelled: atk - left, spin: e.spin || null, lines: e.n || 0, b2b: !!e.b2b, combo: e.combo || 0 });
    }
  }
  const aOut = m.a.phase === 'over', bOut = m.b.phase === 'over';
  if (aOut || bOut) {
    m.phase = 'over';
    m.winner = aOut && bOut ? 'draw' : aOut ? 'b' : 'a';
    out.x.push({ type: 'ko', winner: m.winner });
  }
  return out;
}

// The page's step: real time in, whole ticks out (like step() in the rules); onTick sees your input.
export function matchStep(m, input = NOINPUT, dt = 1 / 60, onTick = null) {
  m.inbox = { held: input.held || [], pressed: [...(m.inbox?.pressed || []), ...(input.pressed || [])] };
  m.acc += Math.min(dt, 0.1);
  const out = { a: [], b: [], x: [] };
  while (m.acc >= 1 / 60 - 1e-9) {
    m.acc -= 1 / 60;
    const r = matchTick(m, m.inbox);
    if (onTick) onTick(m.inbox, r.a);
    out.a.push(...r.a); out.b.push(...r.b); out.x.push(...r.x);
    m.inbox = { held: m.inbox.held, pressed: [] };
  }
  return out;
}

export const incoming = (g) => pendingRows(g);
export function hashMatch(m) {
  return JSON.stringify([m.tick, m.phase, m.winner, m.sent, m.a.board.join(''), m.b.board.join(''), m.a.score, m.b.score, m.a.incoming, m.b.incoming, m.a.cur, m.b.cur, m.ai.rs]);
}
