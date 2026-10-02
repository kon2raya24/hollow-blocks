// Klasiko: endless at one speed, the difficulty's, with nothing extra: no tools, no toolboxes, no
// level-ups. It replays exactly and has its own Ranking board.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, gravity, DIFFICULTY, hashState } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { createRecorder, record, runToEnd } from '../src/replay.mjs';
import { boardFor, BOARD } from '../api/_hb.mjs';

function play(difficulty, ticks, seed = 3) {
  const g = createGame({ seed, mode: 'klasiko', difficulty }), rec = createRecorder({ v: 1, mode: 'klasiko', diff: difficulty, seed });
  const events = [];
  for (let n = 0; n < ticks && g.phase !== 'over'; n++) events.push(...step(g, bot(g, { pace: 1 }), 1 / 60, (i) => record(rec, i)));
  return { g, rec, events };
}

test('the speed never changes: no level-ups however many lines, at each difficulty\'s own speed', () => {
  for (const [diff, level] of [['madali', 1], ['katamtaman', 1], ['mahirap', 6]]) {
    const { g, events } = play(diff, 60 * 240);
    assert.ok(g.lines >= 30, `${diff}: ${g.lines} lines`);
    assert.equal(g.level, level, diff);
    assert.equal(events.filter((e) => e.type === 'levelUp').length, 0, diff);
    assert.equal(gravity(g.level, g.diff), gravity(level, DIFFICULTY[diff]));
  }
  const bahay = createGame({ seed: 3, mode: 'bahay', difficulty: 'katamtaman' });
  for (let n = 0; n < 60 * 240 && bahay.phase !== 'over'; n++) step(bahay, bot(bahay, { pace: 1 }), 1 / 60);
  assert.ok(bahay.level > 1, 'Bahay still speeds up');
});

test('nothing extra: no tools, no toolboxes, no flood or quakes', () => {
  const { g } = play('katamtaman', 60 * 120);
  assert.equal(g.toolsOn, false);
  assert.deepEqual(g.tools, []); assert.deepEqual(g.boxes, []);
  assert.equal(g.rise, null); assert.equal(g.lindol, null);
});

test('a Klasiko game replays exactly and has a board for each difficulty', () => {
  const { g, rec } = play('mahirap', 60 * 90, 9);
  assert.equal(hashState(runToEnd(rec)), hashState(g));
  assert.equal(boardFor({ mode: 'klasiko', diff: 'mahirap', seed: 9 }, Date.now()).board, 'klasiko.mahirap');
  assert.ok(BOARD.test('klasiko.madali'));
});
