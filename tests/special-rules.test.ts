import assert from 'node:assert/strict';
import test from 'node:test';
import { board } from '../lib/board.ts';
import {
  createGame,
  rules,
  transition,
  rentAt,
  canUpgrade,
  canSell,
  sellValue,
  restore,
  type Game,
  type Action,
} from '../lib/game.ts';
const fresh = () => createGame(['Dubu', 'Dubi']);
const roll = (a: number, b: number, event = 0): Action => ({
  type: 'roll',
  dice: [a, b],
  event,
});
const end: Action = { type: 'end' };
function resolve(g: Game) {
  return g.phase === 'choice' || g.phase === 'end' ? transition(g, end) : g;
}

test('double purchase then automatic extra roll; non-double finally passes the turn', () => {
  let g = transition(fresh(), roll(1, 1));
  assert.equal(g.phase, 'choice');
  assert.equal(g.extraRoll, true);
  g = transition(g, { type: 'buy' });
  assert.equal(g.phase, 'roll');
  assert.equal(g.current, 0);
  assert.equal(g.round, 1);
  assert.equal(transition(g, end), g);
  g = resolve(transition(g, roll(1, 2)));
  assert.equal(g.current, 1);
  assert.equal(g.doubles, 0);
});
test('double skip and third double go to rest without movement or Start salary', () => {
  let g = resolve(transition(fresh(), roll(1, 1)));
  g = resolve(transition(g, roll(2, 2)));
  g.players[0].position = 39;
  const cash = g.players[0].cash;
  g = transition(g, roll(6, 6));
  assert.equal(g.players[0].position, 20);
  assert.equal(g.players[0].cash, cash);
  assert.equal(g.restTurns![0], 0);
  assert.equal(g.extraRoll, false);
  assert.equal(g.phase, 'end');
  g = transition(g, end);
  assert.equal(g.current, 1);
});
test('double rent resolves payment and extra roll, but bankruptcy cancels it', () => {
  let g = fresh();
  g.properties[2] = { owner: 1, level: 0 };
  const n = transition(g, roll(1, 1));
  assert.equal(n.players[0].cash, 1488);
  assert.equal(n.players[1].cash, 1512);
  assert.equal(n.phase, 'roll');
  g.players[0].cash = 1;
  const poor = transition(g, roll(1, 1));
  assert.equal(poor.phase, 'finished');
  assert.equal(poor.winner, 1);
});
test('airport flight with bonus, harbor rest and sail, ordinary rest visit', () => {
  let g = fresh();
  // Land on space 30 (Airport)
  g.players[0].position = 27;
  g = transition(g, roll(1, 2));
  assert.equal(g.players[0].position, 30);
  assert.equal(g.phase, 'choice');
  // Fly to space 5 (crosses Start 0, receives +200 bonus, pays 50 flight fee)
  g = transition(g, { type: 'fly', space: 5 });
  assert.equal(g.players[0].position, 5);
  assert.equal(g.players[0].cash, 1500 - 50 + 200); // 1650

  // Land on space 10 (Harbor)
  let h = fresh();
  h.players[0].position = 7;
  h = transition(h, roll(1, 2));
  assert.equal(h.players[0].position, 10);
  assert.equal(h.harborTurns![0], 1);
  assert.equal(h.phase, 'end');
  h = resolve(h); // end turn, now player 1
  h = resolve(transition(h, roll(1, 2))); // player 1 rolls & ends turn
  assert.equal(h.current, 0);
  assert.equal(h.harborTurns![0], 1);
  // Player 0 sails to space 2 (crosses Start 0, receives +200 bonus, pays 20 sail fee)
  h = transition(h, { type: 'sail', space: 2 });
  assert.equal(h.players[0].position, 2);
  assert.equal(h.players[0].cash, 1500 - 20 + 200); // 1680
  assert.equal(h.harborTurns![0], null);

  // Ordinary rest landing is only a visit
  let r = fresh();
  r.players[0].position = 17;
  r = transition(r, roll(1, 2));
  assert.equal(r.players[0].position, 20);
  assert.equal(r.restTurns![0], null);
});
test('rest escape doubles give no extra roll; voluntary fee keeps normal roll available', () => {
  let g = fresh();
  g.players[0].position = 20;
  g.restTurns![0] = 0;
  let n = transition(g, roll(1, 1));
  assert.equal(n.restTurns![0], null);
  assert.equal(n.extraRoll, false);
  assert.equal(n.players[0].position, 22);
  n = resolve(n);
  assert.equal(n.current, 1);
  n = transition(g, { type: 'bail' });
  assert.equal(n.players[0].cash, 1450);
  assert.equal(n.phase, 'roll');
  assert.equal(n.restTurns![0], null);
  n = transition(n, roll(1, 1));
  assert.equal(n.extraRoll, true);
  g.players[0].cash = 49;
  assert.equal(transition(g, { type: 'bail' }), g);
});
test('third failed rest roll pays fee, uses that roll; inability to pay causes bankruptcy', () => {
  const g = fresh();
  g.players[0].position = 20;
  g.restTurns![0] = 0;
  const waited = transition(g, roll(1, 2));
  assert.equal(waited.phase, 'end');
  assert.equal(waited.players[0].position, 20);
  assert.equal(waited.restTurns![0], 1);
  g.restTurns![0] = 2;
  const n = transition(g, roll(1, 2));
  assert.equal(n.players[0].position, 23);
  assert.equal(n.restTurns![0], null);
  assert.equal(n.players[0].cash, 1570); // 50 fee then +120 festival event
  g.players[0].cash = 49;
  assert.equal(transition(g, roll(1, 2)).reason, 'bankruptcy');
});
test('exactly four tourist destinations, holdings scale visit fees, no upgrades', () => {
  const tourists = board.filter((s) => s.kind === 'tourist');
  assert.deepEqual(
    tourists.map((s) => s.name.en),
    ['Gyeongju', 'Jeju', 'Cusco', 'Piura'],
  );
  const g = fresh();
  tourists.forEach((s, i) => {
    g.properties[s.index] = { owner: 0, level: 0 };
    assert.equal(rentAt(g, tourists[0].index), 25 * 2 ** i);
  });
  g.current = 0;
  g.phase = 'choice';
  g.players[0].position = tourists[0].index;
  assert.equal(canUpgrade(g), false);
  assert.equal(transition(g, { type: 'upgrade' }), g);
  g.current = 1;
  g.phase = 'roll';
  g.players[1].position = tourists[0].index - 3;
  const n = transition(g, roll(1, 2));
  assert.equal(n.players[1].cash, 1300);
  assert.equal(n.players[0].cash, 1700);
});
test('region monopoly doubles unimproved rent only, with rent collected while resting', () => {
  const g = fresh();
  g.properties[1] = { owner: 0, level: 0 };
  g.properties[2] = { owner: 0, level: 0 };
  assert.equal(rentAt(g, 1), 24);
  g.properties[1].level = 1;
  assert.equal(rentAt(g, 1), 24);
  g.properties[1].level = 2;
  assert.equal(rentAt(g, 1), 36);
  g.restTurns![0] = 0;
  g.current = 1;
  g.players[1].position = 39;
  const n = transition(g, roll(1, 1));
  assert.equal(n.players[0].cash, 1536);
});
test('last-round doubles resolve before winner; v1 saves retain original no-doubles rules', () => {
  let g = fresh();
  g.round = rules.rounds;
  g.current = 1;
  g = resolve(transition(g, roll(1, 1)));
  assert.notEqual(g.phase, 'finished');
  assert.equal(g.round, rules.rounds);
  g = resolve(transition(g, roll(1, 2)));
  assert.equal(g.phase, 'finished');
  const names: [string, string] = ['A', 'B'];
  const actions = [roll(1, 1), end];
  const old = restore(JSON.stringify({ version: 1, names, actions }))!;
  assert.equal(old.game.current, 1);
  const modern = restore(JSON.stringify({ version: 2, names, actions }))!;
  assert.equal(modern.game.current, 0);
  assert.equal(modern.game.phase, 'roll');
});
test('30 seeded modern games terminate and every action replays with doubles/rest/tourism', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let r = seed,
      g = fresh();
    const actions: Action[] = [];
    const random = (max: number) => {
      r ^= r << 13;
      r ^= r >>> 17;
      r ^= r << 5;
      return (r >>> 0) % max;
    };
    while (g.phase !== 'finished') {
      let candidate: Action;
      if (g.phase === 'roll') {
        candidate = roll(random(6) + 1, random(6) + 1, random(12));
      } else if (g.phase === 'choice') {
        candidate = {
          type: g.properties[g.players[g.current].position]
            ? 'upgrade'
            : 'buy',
        };
      } else if (g.phase === 'debt') {
        if (g.pendingDebt && g.players[g.current].cash >= g.pendingDebt.amount) {
          candidate = { type: 'payDebt' };
        } else {
          const owned = Object.keys(g.properties)
            .map(Number)
            .filter((idx) => g.properties[idx].owner === g.current);
          candidate = owned.length > 0 ? { type: 'sell', space: owned[0] } : { type: 'bankrupt' };
        }
      } else {
        candidate = end;
      }
      const a = transition(g, candidate) === g ? end : candidate;
      const next = transition(g, a);
      assert.notEqual(next, g);
      g = next;
      actions.push(a);
      assert.ok(actions.length <= 800);
      assert.ok(
        g.players.every((p) => p.cash >= 0 && Number.isInteger(p.cash)),
      );
      assert.deepEqual(
        restore(
          JSON.stringify({ version: 2, names: ['Dubu', 'Dubi'], actions }),
        )?.game,
        g,
      );
    }
    assert.notEqual(g.winner, null);
  }
});

test('property emergency sale: refund 50% of investment, release property and replay exactly', () => {
  let game = transition(fresh(), roll(1, 1));
  assert.equal(game.players[0].position, 2);
  const city = board[2];
  const price = city.price!; // 60
  game = transition(game, { type: 'buy' });
  assert.equal(game.properties[2]?.owner, 0);
  assert.equal(game.properties[2]?.level, 0);
  const expectedRefund = sellValue(2, 0);
  assert.equal(expectedRefund, Math.floor(price * 0.5)); // 30

  // Sell during choice / end phase
  const preCash = game.players[0].cash;
  assert.equal(canSell(game, 2), true);
  // Other player cannot sell
  assert.equal(canSell(game, 2, 1), false);

  game = transition(game, { type: 'sell', space: 2 });
  assert.equal(game.players[0].cash, preCash + expectedRefund);
  assert.equal(game.properties[2], undefined);
  assert.equal(game.logs[game.logs.length - 1].kind, 'sell');

  // Replay check
  const savePayload = JSON.stringify({
    version: 2,
    names: ['Dubu', 'Dubi'],
    actions: [roll(1, 1), { type: 'buy' }, { type: 'sell', space: 2 }],
  });
  const restored = restore(savePayload);
  assert.notEqual(restored, null);
  assert.deepEqual(restored!.game, game);
});

