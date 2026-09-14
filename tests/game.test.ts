import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  transition,
  assets,
  rentAt,
  restore,
  rules,
  type Game,
  type Action,
} from '../lib/game.ts';
import { events } from '../lib/events.ts';
const fresh = () => createGame(['Dubu', 'Dubi'], 1);
const roll: Action = { type: 'roll', dice: [1, 1], event: 0 };
function at(position: number, cash = 1500) {
  const g = fresh();
  g.players[0].position = position;
  g.players[0].cash = cash;
  return g;
}
test('roll -> buy -> end; no mutation, stale, out-of-turn or duplicate action', () => {
  const initial = fresh();
  const g = transition(initial, roll);
  assert.equal(initial.players[0].position, 0);
  assert.equal(g.players[0].position, 2);
  assert.equal(g.phase, 'choice');
  assert.equal(transition(g, roll), g);
  assert.equal(transition(g, { type: 'buy' }, 1), g);
  assert.equal(transition(g, { type: 'buy' }, 0, 0), g);
  const b = transition(g, { type: 'buy' });
  assert.equal(b.players[0].cash, 1400);
  assert.deepEqual(b.properties[2], { owner: 0, level: 0 });
  assert.equal(transition(b, { type: 'buy' }), b);
  assert.equal(assets(b, 0), 1500);
  const e = transition(b, { type: 'end' });
  assert.equal(e.current, 1);
  assert.equal(e.round, 1);
  assert.equal(e.phase, 'roll');
  assert.equal(transition(e, { type: 'end' }), e);
});
test('rent transfer scales with level and exact balance is not bankruptcy', () => {
  const g = at(0, 48);
  g.properties[2] = { owner: 1, level: 3 };
  const n = transition(g, roll);
  assert.equal(rentAt(g, 2), 48);
  assert.equal(n.players[0].cash, 0);
  assert.equal(n.players[1].cash, 1548);
  assert.equal(n.phase, 'end');
  assert.equal(n.winner, null);
});
test('insufficient rent transfers remaining cash and terminates', () => {
  const g = at(0, 20);
  g.properties[2] = { owner: 1, level: 3 };
  const n = transition(g, roll);
  assert.equal(n.players[0].cash, 0);
  assert.equal(n.players[1].cash, 1520);
  assert.equal(n.phase, 'finished');
  assert.equal(n.winner, 1);
  assert.equal(n.reason, 'bankruptcy');
  assert.equal(transition(n, { type: 'end' }), n);
});
test('purchase/upgrade blocked without cash; at most one upgrade per landing, max 3', () => {
  let g = transition(at(0, 99), roll);
  assert.equal(transition(g, { type: 'buy' }), g);
  g = at(0, 50);
  g.properties[2] = { owner: 0, level: 2 };
  g = transition(g, roll);
  const n = transition(g, { type: 'upgrade' });
  assert.equal(n.properties[2].level, 3);
  assert.equal(n.players[0].cash, 0);
  assert.equal(assets(n, 0), 250);
  assert.equal(transition(n, { type: 'upgrade' }), n);
  const max = at(0);
  max.properties[2] = { owner: 0, level: 3 };
  const m = transition(max, roll);
  assert.equal(transition(m, { type: 'upgrade' }), m);
  const poor = at(0, 49);
  poor.properties[2] = { owner: 0, level: 0 };
  const p = transition(poor, roll);
  assert.equal(transition(p, { type: 'upgrade' }), p);
});
test('forward landing on start grants bonus exactly once', () => {
  const n = transition(at(38), roll);
  assert.equal(n.players[0].position, 0);
  assert.equal(n.players[0].cash, 1700);
  assert.equal(n.logs.filter((e) => e.kind === 'bonus').length, 1);
});
test('all 12 bilingual events resolve, event movement does not chain', () => {
  assert.equal(events.length, 12);
  events.forEach((e, event) => {
    assert.ok(e.text.ko && e.text.es);
    const n = transition(at(1), { ...roll, event });
    assert.equal(n.lastEvent, event);
    assert.equal(n.logs.filter((e) => e.kind === 'event').length, 1);
    assert.ok(n.players[0].cash >= 0);
  });
  const n = transition(at(1), { ...roll, event: 10 });
  assert.equal(n.players[0].position, 8);
  assert.equal(n.phase, 'end');
  assert.equal(n.logs.filter((e) => e.kind === 'event').length, 1);
});
test('event travel resolves destination rent, backward move, and forward crossing', () => {
  let g = at(1);
  g.properties[6] = { owner: 1, level: 0 };
  let n = transition(g, { ...roll, event: 9 });
  assert.equal(n.players[0].position, 6);
  assert.equal(n.players[1].cash, 1522);
  n = transition(at(1), { ...roll, event: 11 });
  assert.equal(n.players[0].position, 1);
  assert.equal(n.players[0].cash, 1500);
  assert.equal(n.phase, 'choice');
  n = transition(at(36), { ...roll, event: 9 });
  assert.equal(n.players[0].position, 1);
  assert.equal(n.players[0].cash, 1700);
});
test('negative cash event can bankrupt, exact amount can be paid', () => {
  const n = transition(at(1, 49), { ...roll, event: 3 });
  assert.equal(n.reason, 'bankruptcy');
  assert.equal(n.players[0].cash, 0);
  const exact = transition(at(1, 50), { ...roll, event: 3 });
  assert.equal(exact.phase, 'end');
  assert.equal(exact.players[0].cash, 0);
});
test('20 complete rounds end with tie or correct asset winner', () => {
  let g = fresh();
  for (let turn = 0; turn < 40; turn++) {
    assert.equal(g.round, Math.floor(turn / 2) + 1);
    g = transition(g, roll);
    g = transition(g, { type: 'end' });
  }
  assert.equal(g.phase, 'finished');
  assert.equal(g.round, rules.rounds);
  assert.equal(g.winner, 'tie');
  const ahead = fresh();
  ahead.current = 1;
  ahead.round = 20;
  ahead.phase = 'end';
  ahead.properties[1] = { owner: 0, level: 3 };
  const n = transition(ahead, { type: 'end' });
  assert.equal(n.winner, 0);
});
test('save/replay exactly restores actions and rejects malformed, stale or incompatible records', () => {
  const names: [string, string] = ['A', 'B'],
    actions: Action[] = [
      roll,
      { type: 'buy' },
      { type: 'end' },
      roll,
      { type: 'end' },
    ];
  let game = createGame(names, 1);
  actions.forEach((a) => (game = transition(game, a)));
  const raw = JSON.stringify({ version: 1, names, actions });
  assert.deepEqual(restore(raw)?.game, game);
  assert.equal(restore('{'), null);
  assert.equal(restore(JSON.stringify({ version: 99, names, actions })), null);
  assert.equal(
    restore(JSON.stringify({ version: 1, names, actions: [{ type: 'buy' }] })),
    null,
  );
  assert.equal(
    restore(
      JSON.stringify({
        version: 1,
        names,
        actions: [{ type: 'roll', dice: [0, 7], event: 0 }],
      }),
    ),
    null,
  );
  assert.equal(
    restore(JSON.stringify({ version: 1, names, actions: [null] })),
    null,
  );
  assert.equal(
    restore(
      JSON.stringify({
        version: 1,
        names,
        actions: [{ type: 'roll', dice: [1, 1], event: 99 }],
      }),
    ),
    null,
  );
});
test('100 deterministic complete games preserve invariants and every checkpoint restores', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let g = fresh(),
      actions: Action[] = [],
      r = seed;
    const random = (max: number) => {
      r = (r * 1664525 + 1013904223) >>> 0;
      return r % max;
    };
    while (g.phase !== 'finished') {
      let a: Action;
      if (g.phase === 'roll')
        a = {
          type: 'roll',
          dice: [random(6) + 1, random(6) + 1],
          event: random(12),
        };
      else if (g.phase === 'choice') {
        const p = g.properties[g.players[g.current].position];
        const candidate: Action = { type: p ? 'upgrade' : 'buy' };
        a = transition(g, candidate) === g ? { type: 'end' } : candidate;
      } else a = { type: 'end' };
      const next = transition(g, a);
      assert.notEqual(next, g);
      g = next;
      actions.push(a);
      assert.ok(actions.length <= 120);
      g.players.forEach((p) =>
        assert.ok(
          p.cash >= 0 &&
            Number.isInteger(p.cash) &&
            p.position >= 0 &&
            p.position < 40,
        ),
      );
      Object.values(g.properties).forEach((p) =>
        assert.ok(p.level >= 0 && p.level <= 3),
      );
      assert.deepEqual(
        restore(
          JSON.stringify({ version: 1, names: ['Dubu', 'Dubi'], actions }),
        )?.game,
        g,
      );
    }
    assert.ok(g.winner !== null);
  }
});
