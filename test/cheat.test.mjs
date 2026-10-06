// The Konami code (↑ ↑ ↓ ↓ ← → ← → B A): typed during a game, the bot takes over.
import test from 'node:test';
import assert from 'node:assert/strict';
import { konami, KONAMI, AUTO_SPEEDS } from '../src/cheat.mjs';

const feed = (f, keys) => keys.map((k) => f(k));
test('the code fires on its last key, and again the next time', () => {
  const f = konami();
  const out = feed(f, KONAMI);
  assert.deepEqual(out, [...Array(9).fill(false), true]);
  assert.equal(feed(f, KONAMI).at(-1), true);
});
test('an extra ↑ at the start still counts; a wrong key starts it over', () => {
  const f = konami();
  assert.equal(feed(f, ['ArrowUp', ...KONAMI]).at(-1), true);
  assert.equal(feed(f, ['ArrowUp', 'ArrowUp', 'ArrowDown', 'x', ...KONAMI.slice(3)]).at(-1), false);
  assert.equal(feed(f, ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowUp', ...KONAMI]).at(-1), true);
});
test('three speeds, slowest first', () => assert.deepEqual(AUTO_SPEEDS, [1, 3, 10]));
