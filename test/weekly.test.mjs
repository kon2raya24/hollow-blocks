// The weekly event: a twist for each ISO week (Manila time), the same for everyone, no server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyEvent, isoWeek, countdown, EVENTS, WEEKLY_MEDALS } from '../src/progress.mjs';
import { createGame, tick, READY } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';

const at = (s) => Date.parse(s);
test('the week decides the event: the same all week, the next on Monday midnight in Manila', () => {
  assert.equal(weeklyEvent(at('2026-01-05T00:00:00+08:00')).id, 'bagyo');
  assert.equal(weeklyEvent(at('2026-01-11T23:59:59+08:00')).id, 'bagyo');
  assert.equal(weeklyEvent(at('2026-01-12T00:00:00+08:00')).id, 'lindol');
  assert.equal(weeklyEvent(at('2026-01-11T16:00:00Z')).id, 'lindol'); // already Monday in Manila
  // five weeks in a row are the five events
  const five = [0, 1, 2, 3, 4].map((k) => weeklyEvent(at('2026-03-02T12:00:00+08:00') + k * 7 * 86400e3).id);
  assert.deepEqual([...five].sort(), EVENTS.map((e) => e.id).sort());
  // and it wraps back, before the epoch too
  assert.equal(weeklyEvent(at('2026-03-02T12:00:00+08:00')).id, weeklyEvent(at('2026-03-02T12:00:00+08:00') + 5 * 7 * 86400e3).id);
  assert.ok(EVENTS.some((e) => e.id === weeklyEvent(at('2019-06-15T12:00:00+08:00')).id));
  assert.equal(weeklyEvent(at('2026-01-05T00:00:00+08:00')).next.id, 'lindol');
});

test('ISO weeks, the countdown, and a medal for each event', () => {
  assert.equal(isoWeek(at('2026-01-01T12:00:00+08:00')), '2026-W01');
  assert.equal(isoWeek(at('2026-12-31T12:00:00+08:00')), '2026-W53');
  assert.equal(isoWeek(at('2027-01-04T12:00:00+08:00')), '2027-W01');
  assert.equal(isoWeek(at('2021-01-03T12:00:00+08:00')), '2020-W53');
  const w = weeklyEvent(at('2026-10-01T12:00:00+08:00'));
  assert.equal(w.ends, at('2026-10-05T00:00:00+08:00'));
  assert.equal(countdown(w.left), '3a 12o');
  assert.equal(WEEKLY_MEDALS.length, EVENTS.length);
});

test('each event plays its twist: mud, quakes, tools every fourth piece, 20G, and retro rules', () => {
  const g = (id) => { const e = EVENTS.find((x) => x.id === id); const h = createGame({ seed: 2, mode: 'lingguhan', contract: e.contract }); for (let k = 0; k < READY; k++) tick(h); return h; };
  assert.ok(g('bagyo').rise && g('lindol').lindol);
  const t = g('gamit');
  assert.ok(t.toolsOn && !t.boxesOn);
  for (let k = 0; k < 8; k++) { t.board.fill(0); tick(t, { pressed: ['hard'], held: [] }); }
  assert.equal(t.tools.length, 2);
  const f = g('mabilis'); f.cur = { ...f.cur, y: 2 }; tick(f); assert.ok(!require_fits(f));
  const r = g('retro');
  assert.equal(r.rules.hold, false); assert.equal(r.rules.next, 1);
  const was = r.cur.type; tick(r, { pressed: ['hold'], held: [] }); assert.equal(r.cur.type, was);
  // three minutes, then the score stands
  const s = createGame({ seed: 5, mode: 'lingguhan', contract: EVENTS[4].contract });
  while (s.phase !== 'done' && s.phase !== 'over') tick(s, bot(s, { pace: 4 }));
  assert.equal(s.phase, 'done'); assert.equal(s.elapsed, 180 * 60);
});
import { fits } from '../src/game.mjs';
function require_fits(g) { return fits(g.board, { ...g.cur, y: g.cur.y + 1 }); }
