// Why a thing can't be done yet: the numbers the "Hindi pa puwede" box shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemById, shortfall } from '../src/shop.mjs';
import { CONTRACTS, lockReason } from '../src/contracts.mjs';

test('shortfall: how much barya or tokens a buy still needs', () => {
  const glazed = itemById('skin-glazed'), parol = itemById('skin-parol');
  assert.deepEqual(shortfall(glazed, { coins: 120, tokens: 0 }), { coins: 180, tokens: 0 });
  assert.deepEqual(shortfall(glazed, { coins: 300, tokens: 0 }), { coins: 0, tokens: 0 });
  assert.deepEqual(shortfall(parol, { coins: 9999, tokens: 1 }), { coins: 0, tokens: 1 });
  assert.equal(shortfall(itemById('skin-ginto'), { coins: 0 }), null); // not sold
});

test('lockReason: the contract before, a barangay\'s 8 stars, or chapter 2', () => {
  assert.equal(lockReason({}, CONTRACTS[0].id), null);
  assert.deepEqual(lockReason({}, CONTRACTS[1].id), { kind: 'prev', prev: CONTRACTS[0] });
  assert.equal(lockReason({ [CONTRACTS[0].id]: 1 }, CONTRACTS[1].id), null);
  const firstOf1 = CONTRACTS.find((c) => c.brgy === 1);
  const three = Object.fromEntries(CONTRACTS.filter((c) => c.brgy === 0).slice(0, 3).map((c) => [c.id, 1]));
  assert.deepEqual(lockReason(three, firstOf1.id), { kind: 'brgy', brgy: 0, have: 3, need: 8 });
  const firstOf3 = CONTRACTS.find((c) => c.brgy === 3);
  assert.deepEqual(lockReason({ [CONTRACTS[0].id]: 2 }, firstOf3.id), { kind: 'chapter', have: 2, need: 30 });
  assert.equal(lockReason({ bs5: 1 }, firstOf3.id), null);
});
