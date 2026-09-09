import { test } from 'node:test';
import assert from 'node:assert/strict';
import { board } from '../lib/board.ts';
test('40 unique perimeter cells', () => {
  assert.equal(board.length, 40);
  assert.equal(new Set(board.map((s) => `${s.row},${s.col}`)).size, 40);
  board.forEach((s) => {
    assert.ok(s.row >= 1 && s.row <= 11 && s.col >= 1 && s.col <= 11);
    assert.ok(s.row === 1 || s.row === 11 || s.col === 1 || s.col === 11);
  });
});
test('28 unique cities, 8 events, 4 corners, balanced country placement', () => {
  const cities = board.filter((s) => s.type === 'city');
  assert.equal(cities.length, 28);
  assert.equal(new Set(cities.map((s) => s.name.es)).size, 28);
  assert.equal(board.filter((s) => s.type === 'event').length, 8);
  assert.equal(board.filter((s) => s.type === 'corner').length, 4);
  for (const c of ['korea', 'peru']) {
    const list = cities.filter((s) => s.country === c);
    assert.equal(list.length, 14);
    list.forEach((s) => assert.ok(c === 'korea' ? s.index < 20 : s.index > 20));
  }
  assert.deepEqual(
    cities
      .filter((s) => s.country === 'korea')
      .map((s) => s.price)
      .sort(),
    cities
      .filter((s) => s.country === 'peru')
      .map((s) => s.price)
      .sort(),
  );
  board.forEach((s) => assert.ok(s.name.ko && s.name.es));
});
