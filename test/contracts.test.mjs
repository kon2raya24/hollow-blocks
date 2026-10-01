// Every contract can be won: the bot plays each at a strong person's pace (8 ticks between key presses)
// and must earn at least one star. Unang Bayanihan uses the bot's Bayanihan style (it keeps a well open).
// Diskarte (ml1), Sunod-sunod (ml2) and Tatlong T-spin (bs4) need T-spins and long combos, which the bot
// doesn't play; for those we check the goal and the par are sound, and the rules for T-spins and combos
// are covered in game.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { CONTRACTS, starsFor } from '../src/contracts.mjs';

const SKILL = ['ml1', 'ml2', 'bs4'];
const play = (c, seed, pace, style = null) => {
  const g = createGame({ seed, mode: 'proyekto', difficulty: 'katamtaman', contract: c });
  while (g.phase !== 'done' && g.phase !== 'over' && g.elapsed < 15 * 3600) tick(g, bot(g, { pace, style }));
  return starsFor(c, { done: g.phase === 'done', ticks: g.elapsed, pieces: g.pieces, lines: g.lines, score: g.score });
};

for (const c of CONTRACTS.filter((x) => x.brgy < 3 && !SKILL.includes(x.id))) { // chapter 1 (chapter 2: chapter2.test.mjs)
  test(`${c.id} ${c.name}: the bot wins it, and three stars take its best`, () => {
    const style = c.id === 'sr5' ? 'tetris' : null;
    const stars = [1, 2].map((seed) => play(c, seed, 8, style));
    for (const s of stars) assert.ok(s >= 1, `${c.id}: ${stars}`);
    if (c.star.by === 'time') assert.ok(play(c, 1, 24, style) < 3, `${c.id}: three stars at a slow pace`);
  });
}

test('the contracts that need T-spins and combos have sound goals and pars', () => {
  for (const id of SKILL) {
    const c = CONTRACTS.find((x) => x.id === id);
    assert.ok(c.goal.tspins || c.goal.combo, id);
    assert.ok(c.star.three >= 45, `${id}: three stars must be humanly possible`);
    if (c.limit) assert.ok(c.star.two * 60 < c.limit, `${id}: two stars inside the time limit`);
  }
});
