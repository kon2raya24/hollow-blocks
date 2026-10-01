// Replays: a recorded game plays back to the very same final state and score, and the share link's
// text round-trips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, hashState } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, runToEnd, encode, decode, toBytes, fromBytes, inputs } from '../src/replay.mjs';
import { dailySeed } from '../src/progress.mjs';

function played(head, limit = 60 * 200) {
  const g = createGame({ seed: head.seed, mode: head.mode, difficulty: head.diff, opts: head.opts || null });
  const rec = createRecorder(head);
  let n = 0;
  // a person's uneven frames, with soft drops and holds mixed in
  while (g.phase !== 'over' && g.phase !== 'done' && n++ < limit) {
    const b = bot(g, { pace: 3 }), held = n % 97 < 6 ? ['down'] : n % 211 < 20 ? ['left'] : [];
    step(g, { pressed: b.pressed, held }, [1 / 60, 1 / 50, 1 / 120, 1 / 30][n % 4], (inp) => record(rec, inp));
  }
  return { g, rec };
}

test('a recorded Deadline replays to the exact final state, time and score', () => {
  const { g, rec } = played({ v: 1, mode: 'deadline', diff: 'katamtaman', seed: 21 });
  assert.equal(g.phase, 'done');
  const r = runToEnd(rec);
  assert.equal(hashState(r), hashState(g));
  assert.equal(r.score, g.score); assert.equal(r.elapsed, g.elapsed);
});

test('a Karera with tools and a Daily with rule options replay exactly too', () => {
  for (const head of [{ v: 1, mode: 'karera', diff: 'mahirap', seed: 8 }, { v: 1, mode: 'daily', diff: 'katamtaman', seed: dailySeed('2026-10-01'), opts: { das: 7, arr: 0, soft: 2, rot180: true, next: 3 } }]) {
    const { g, rec } = played(head, 60 * 130);
    assert.equal(g.phase, 'done', head.mode);
    assert.equal(hashState(runToEnd(rec)), hashState(g), head.mode);
  }
});

test('the bytes and the share text round-trip, and the text is compact', async () => {
  const { rec } = played({ v: 1, mode: 'karera', diff: 'katamtaman', seed: 99 }, 60 * 130);
  const back = fromBytes(toBytes(rec));
  assert.deepEqual(back.head, rec.head); assert.deepEqual(back.ev, rec.ev); assert.equal(back.t, rec.t);
  const text = await encode(rec);
  assert.match(text, /^[zb][A-Za-z0-9_-]+$/);
  const again = await decode(text);
  assert.deepEqual(again.ev, rec.ev); assert.deepEqual(again.head, rec.head);
  assert.ok(text.length < toBytes(rec).length * 1.4, `compressed ${text.length} vs ${toBytes(rec).length} bytes`);
  await assert.rejects(decode('xnope'));
});

test('the input stream gives back what each tick was given', () => {
  const rec = createRecorder({});
  const ticks = [{ pressed: ['left'], held: ['left'] }, { pressed: [], held: ['left'] }, { pressed: ['cw', 'hard'], held: [] }, { pressed: [], held: [] }, { pressed: ['r180'], held: ['down', 'right'] }];
  for (const t of ticks) record(rec, t);
  const feed = inputs(rec);
  const out = ticks.map((_, i) => feed(i));
  assert.deepEqual(out.map((x) => x.pressed), [['left'], [], ['cw', 'hard'], [], ['r180']]);
  assert.deepEqual(out.map((x) => [...x.held].sort()), [['left'], ['left'], [], [], ['down', 'right']]);
});
