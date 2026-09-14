import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  transition,
  canBuy,
  canUpgrade,
  rules,
  type Action,
} from '../lib/game.ts';

const roll = (d1: number, d2: number, ev = 0): Action => ({
  type: 'roll',
  dice: [d1, d2],
  event: ev,
});

test('landing on opponent property requires payRent action', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].position = 0;
  g.properties[2] = { owner: 1, level: 1 };
  const p0InitialCash = g.players[0].cash;
  const p1InitialCash = g.players[1].cash;

  // P0 rolls 1+1 = 2 -> Lands on space 2 (doubles)
  g = transition(g, roll(1, 1));

  // Must enter choice phase with pending rent payment
  assert.equal(g.players[0].position, 2);
  assert.equal(g.phase, 'choice');
  assert.notEqual(g.pendingPayment, null);
  assert.equal(g.pendingPayment?.type, 'rent');
  assert.equal(g.pendingPayment?.to, 1);
  assert.equal(g.pendingPayment?.from, 0);
  assert.equal(g.pendingPayment?.space, 2);
  const rentAmount = g.pendingPayment!.amount;
  assert(rentAmount > 0);

  // While pendingPayment is active, cash should not yet have changed
  assert.equal(g.players[0].cash, p0InitialCash);
  assert.equal(g.players[1].cash, p1InitialCash);

  // Cannot buy or upgrade while pending payment
  assert.equal(canBuy(g), false);
  assert.equal(canUpgrade(g), false);

  // Pay rent
  g = transition(g, { type: 'payRent' });

  assert.equal(g.players[0].cash, p0InitialCash - rentAmount);
  assert.equal(g.players[1].cash, p1InitialCash + rentAmount);
  assert.equal(g.pendingPayment, null);
  // Rolled doubles (1, 1), so phase becomes roll (extra roll)
  assert.equal(g.phase, 'roll');
  assert.equal(g.extraRoll, true);
});

test('landing on positive cash event requires claimEvent action to receive money', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].position = 0;
  const p0Cash = g.players[0].cash;
  // Space 3 is an event space. Event 0: effect = { kind: 'cash', amount: 120 }
  g = transition(g, roll(1, 2, 0));

  assert.equal(g.players[0].position, 3);
  assert.equal(g.phase, 'choice');
  assert.notEqual(g.pendingPayment, null);
  assert.equal(g.pendingPayment?.type, 'event');
  assert.equal(g.pendingPayment?.isGain, true);
  assert.equal(g.pendingPayment?.amount, 120);

  // Cash not yet credited
  assert.equal(g.players[0].cash, p0Cash);

  // Claim event
  g = transition(g, { type: 'claimEvent' });

  assert.equal(g.players[0].cash, p0Cash + 120);
  assert.equal(g.pendingPayment, null);
  assert.equal(g.phase, 'end');
});

test('landing on negative cash event requires claimEvent action to pay penalty', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].position = 0;
  const p0Cash = g.players[0].cash;
  // Space 3 is an event space. Event 3: effect = { kind: 'cash', amount: -50 }
  g = transition(g, roll(1, 2, 3));

  assert.equal(g.players[0].position, 3);
  assert.equal(g.phase, 'choice');
  assert.notEqual(g.pendingPayment, null);
  assert.equal(g.pendingPayment?.type, 'event');
  assert.equal(g.pendingPayment?.isGain, false);
  assert.equal(g.pendingPayment?.amount, 50);

  // Cash not yet deducted
  assert.equal(g.players[0].cash, p0Cash);

  // Pay event penalty
  g = transition(g, { type: 'claimEvent' });

  assert.equal(g.players[0].cash, p0Cash - 50);
  assert.equal(g.pendingPayment, null);
  assert.equal(g.phase, 'end');
});

test('auto-settlement fallback on end turn action', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].position = 0;
  g.properties[2] = { owner: 1, level: 0 };
  const p0InitialCash = g.players[0].cash;
  const p1InitialCash = g.players[1].cash;

  // Roll 1+1 = 2 (lands on space 2)
  g = transition(g, roll(1, 1));
  assert.notEqual(g.pendingPayment, null);
  const rent = g.pendingPayment!.amount;

  // Sending { type: 'end' } directly should auto-settle rent without deadlock
  g = transition(g, { type: 'end' });
  assert.equal(g.pendingPayment, null);
  assert.equal(g.players[0].cash, p0InitialCash - rent);
  assert.equal(g.players[1].cash, p1InitialCash + rent);
});

test('flying to event space triggers event and pendingPayment', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].position = 30; // Airport
  g.phase = 'choice';
  const initialCash = g.players[0].cash; // 1500

  // Fly to space 38 (travel event) with event 0 (+120 cash)
  g = transition(g, { type: 'fly', space: 38, event: 0 });

  assert.equal(g.players[0].position, 38);
  assert.equal(g.phase, 'choice');
  assert.notEqual(g.pendingPayment, null);
  assert.equal(g.pendingPayment?.type, 'event');
  assert.equal(g.pendingPayment?.amount, 120);
  assert.equal(g.pendingPayment?.isGain, true);
  // Flight fee 50 deducted
  assert.equal(g.players[0].cash, initialCash - 50);

  // Claim event
  g = transition(g, { type: 'claimEvent' });
  assert.equal(g.players[0].cash, initialCash - 50 + 120);
  assert.equal(g.pendingPayment, null);
  assert.equal(g.phase, 'end');
});

test('sailing to event space triggers event and pendingPayment', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].position = 10; // Harbor
  g.phase = 'roll';
  g.harborTurns![0] = 1;
  const initialCash = g.players[0].cash;

  // Sail to space 18 (event space) with event 0 (+120 cash)
  g = transition(g, { type: 'sail', space: 18, event: 0 });

  assert.equal(g.players[0].position, 18);
  assert.equal(g.phase, 'choice');
  assert.notEqual(g.pendingPayment, null);
  assert.equal(g.pendingPayment?.type, 'event');
  assert.equal(g.pendingPayment?.amount, 120);
  assert.equal(g.pendingPayment?.isGain, true);
  // Sail fee deducted (20 Dubi)
  assert.equal(g.players[0].cash, initialCash - rules.sailFee);

  // Claim event
  g = transition(g, { type: 'claimEvent' });
  assert.equal(g.players[0].cash, initialCash - rules.sailFee + 120);
  assert.equal(g.pendingPayment, null);
  assert.equal(g.phase, 'end');
});

