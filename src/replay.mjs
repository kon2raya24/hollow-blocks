// Replays: a game is its setup (seed, mode, difficulty, rule options, a contract, a rival or a lesson)
// plus the input of every tick. Only changes are written: a key pressed, or the set of held keys
// (left, right, down) changing, each as the ticks since the last change and a code. That packs into
// bytes, deflated (CompressionStream) and base64url'd for a share link: a two-minute game is a few
// kilobytes. Playing it back through the same pure rules gives the very same game.
import { createGame, tick, NOINPUT } from './game.mjs';
import { createMatch, matchTick } from './versus.mjs';
import { contractById } from './contracts.mjs';
import { EVENTS } from './progress.mjs';

export const PRESS = ['left', 'right', 'cw', 'ccw', 'hard', 'hold', 'tool', 'r180']; // codes 0..7
export const HELD = ['left', 'right', 'down']; // code 8 + a bit mask of these

export function createRecorder(head) { return { head, ev: [], held: 0, t: 0 }; }
// Write down one tick's input; call it once per tick, in order (step()'s onTick does).
export function record(r, input) {
  const held = input.held || [];
  const mask = (held.includes('left') ? 1 : 0) | (held.includes('right') ? 2 : 0) | (held.includes('down') ? 4 : 0);
  if (mask !== r.held) { r.ev.push(r.t, 8 + mask); r.held = mask; }
  for (const a of input.pressed || []) { const c = PRESS.indexOf(a); if (c >= 0) r.ev.push(r.t, c); }
  r.t++;
}

// A player for a recording: input(i) gives tick i's input, ticks in order.
export function inputs(rec) {
  let k = 0, held = [];
  return (i) => {
    const pressed = [];
    while (k < rec.ev.length && rec.ev[k] === i) {
      const c = rec.ev[k + 1];
      if (c >= 8) held = HELD.filter((_, b) => (c - 8) & (1 << b)); else pressed.push(PRESS[c]);
      k += 2;
    }
    return pressed.length || held.length ? { pressed, held } : NOINPUT;
  };
}

// The game a recording starts from. ts: the rank tools in play; ev: the weekly event's id.
export function gameFor(head) {
  if (head.vs) return createMatch({ seed: head.seed, rival: head.vs, opts: head.opts || null });
  const contract = head.job ? contractById(head.job) : head.ev ? EVENTS.find((e) => e.id === head.ev)?.contract || null : null;
  return createGame({ seed: head.seed, mode: head.mode, difficulty: head.diff, contract, opts: head.opts || null, toolset: head.ts || null, ...(head.lesson || {}) });
}
// Advance a replay by one tick: { g (or match), feed, i }.
export function startPlayback(rec) { return { rec, g: gameFor(rec.head), feed: inputs(rec), i: 0, end: rec.t }; }
export function playTick(pb) {
  if (pb.i >= pb.end) return null;
  const input = pb.feed(pb.i++);
  return pb.rec.head.vs ? matchTick(pb.g, input) : tick(pb.g, input);
}
// Run a recording to its end (tests, the ghost's final numbers).
export function runToEnd(rec) { const pb = startPlayback(rec); while (playTick(pb)); return pb.g; }

// ---------- bytes ----------
function varint(out, n) { while (n > 127) { out.push((n & 127) | 128); n >>>= 7; } out.push(n); }
function readVarint(b, at) { let n = 0, s = 0, v; do { v = b[at.i++]; n += (v & 127) * 2 ** s; s += 7; } while (v & 128); return n; }
export function toBytes(rec) {
  const head = new TextEncoder().encode(JSON.stringify(rec.head)), out = [1];
  varint(out, head.length); out.push(...head);
  varint(out, rec.t); varint(out, rec.ev.length / 2);
  let last = 0;
  for (let k = 0; k < rec.ev.length; k += 2) { varint(out, rec.ev[k] - last); out.push(rec.ev[k + 1]); last = rec.ev[k]; }
  return new Uint8Array(out);
}
export function fromBytes(b) {
  if (b[0] !== 1) throw new Error('not a Hollow Blocks replay');
  const at = { i: 1 }, hl = readVarint(b, at);
  const head = JSON.parse(new TextDecoder().decode(b.subarray(at.i, at.i + hl))); at.i += hl;
  const t = readVarint(b, at), n = readVarint(b, at), ev = [];
  let last = 0;
  for (let k = 0; k < n; k++) { last += readVarint(b, at); ev.push(last, b[at.i++]); }
  return { head, ev, held: 0, t };
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(t, (c) => c.charCodeAt(0)); };
async function through(u8, stream) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer()); }
// A recording as a short text: 'z' + base64url of the deflated bytes ('b' + plain bytes without CompressionStream).
export async function encode(rec) {
  const bytes = toBytes(rec);
  if (typeof CompressionStream === 'function') return 'z' + b64(await through(bytes, new CompressionStream('deflate-raw')));
  return 'b' + b64(bytes);
}
export async function decode(text) {
  const kind = text[0], raw = unb64(text.slice(1));
  if (kind === 'z') return fromBytes(await through(raw, new DecompressionStream('deflate-raw')));
  if (kind === 'b') return fromBytes(raw);
  throw new Error('not a Hollow Blocks replay');
}
