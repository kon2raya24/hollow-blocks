// Sanity floors from the bot (src/bot.mjs), which uses the rules' own board helpers. It is a strong
// player, so these only guard against a rules change that makes the game impossible or broken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, gravity, DIFFICULTY } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';

function play(mode, difficulty, seed, limit, seconds = Infinity) {
  const g = createGame({ seed, mode, difficulty });
  while (g.phase !== 'over' && g.phase !== 'done' && g.pieces < limit && g.elapsed < seconds * 60) tick(g, bot(g));
  return g;
}

test('Bahay: the bot builds 20 floors of lines without topping out, on every difficulty', () => {
  for (const d of ['madali', 'katamtaman', 'mahirap']) for (const seed of [1, 2]) {
    const g = play('bahay', d, seed, 260);
    assert.notEqual(g.phase, 'over', `${d} seed ${seed}: topped out at ${g.lines} lines`);
    assert.ok(g.lines >= 90, `${d} seed ${seed}: ${g.lines} lines`);
  }
});

test('Deadline: forty lines, then it ends, with the time kept', () => {
  const g = play('deadline', 'katamtaman', 3, 400);
  assert.equal(g.phase, 'done');
  assert.ok(g.lines >= 40 && g.elapsed > 0);
});

test('Bagyo: the flood keeps coming, and a steady player can hold it off for minutes', () => {
  const g = play('bagyo', 'madali', 4, Infinity, 180);
  assert.notEqual(g.phase, 'over', `flooded after ${(g.elapsed / 60).toFixed(0)} s`);
  assert.ok(g.elapsed >= 60 * 180);
});

test('Mahirap starts faster than Katamtaman, and Madali slower', () => {
  const [m, k, h] = ['madali', 'katamtaman', 'mahirap'].map((d) => gravity(DIFFICULTY[d].level, DIFFICULTY[d]));
  assert.ok(m < k && k < h);
});
