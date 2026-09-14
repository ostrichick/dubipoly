import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, transition, rules, canFly, canSail } from '../lib/game.ts';

function roll(d1: number, d2: number) {
  return { type: 'roll' as const, dice: [d1, d2] as [number, number], event: 0 };
}

function resolve(g: ReturnType<typeof createGame>) {
  if (g.pendingEvent) {
    g = transition(g, { type: 'claimEvent' });
  }
  if (g.phase === 'choice' || g.phase === 'end') {
    g = transition(g, { type: 'end' });
  }
  return g;
}

test('flying from airport applies 1-turn cooldown preventing consecutive airport usage on next turn', () => {
  let g = createGame(['Player 1', 'Player 2'], 2);

  // Player 0 lands on space 30 (Airport)
  g.players[0].position = 27;
  g = transition(g, roll(1, 2));
  assert.equal(g.players[0].position, rules.airportSpace); // 30
  assert.equal(canFly(g, 0), true);

  // Player 0 flies to space 27 (right before airport)
  g = transition(g, { type: 'fly', space: 27 });
  assert.equal(g.players[0].position, 27);
  assert.equal(g.travelCooldown?.[0], 2);

  // Player 0 ends turn
  g = resolve(g);
  assert.equal(g.current, 1);
  assert.equal(g.travelCooldown?.[0], 1); // 1-turn cooldown active for Player 0!

  // Player 1 takes turn
  g = transition(g, roll(1, 2));
  g = resolve(g);
  assert.equal(g.current, 0);
  assert.equal(g.travelCooldown?.[0], 1); // Still active at start of Player 0's turn!

  // Player 0 rolls (1, 2) and lands on space 30 (Airport) again!
  g = transition(g, roll(1, 2));
  assert.equal(g.players[0].position, rules.airportSpace);
  // Must be BLOCKED due to cooldown!
  assert.equal(canFly(g, 0), false);
  assert.equal(g.phase, 'end');
  assert.equal(g.travelBlocked?.space, rules.airportSpace);

  // Player 0 ends turn
  g = resolve(g);
  assert.equal(g.current, 1);
  assert.equal(g.travelCooldown?.[0], 0); // Cooldown expired now!
});

test('sailing from harbor applies 1-turn cooldown preventing consecutive harbor usage on next turn', () => {
  let g = createGame(['Player 1', 'Player 2'], 2);

  // Player 0 lands on space 10 (Harbor)
  g.players[0].position = 8;
  g = transition(g, roll(1, 1));
  assert.equal(g.players[0].position, rules.harborSpace);
  assert.equal(g.harborTurns?.[0], 1);

  // End turn, opponent turn, then back to Player 0
  g = resolve(g); // P1 turn
  g = resolve(transition(g, roll(1, 2))); // P1 ends, back to P0
  assert.equal(g.current, 0);
  assert.equal(canSail(g, 0), true);

  // Player 0 sails to space 8 (right before harbor)
  g = transition(g, { type: 'sail', space: 8 });
  assert.equal(g.players[0].position, 8);
  assert.equal(g.travelCooldown?.[0], 2);

  // Player 0 ends turn
  g = resolve(g);
  assert.equal(g.current, 1);
  assert.equal(g.travelCooldown?.[0], 1); // Cooldown active

  // Player 1 takes turn
  g = resolve(transition(g, roll(1, 2)));
  assert.equal(g.current, 0);
  assert.equal(g.travelCooldown?.[0], 1);

  // Player 0 rolls 2 and lands on Harbor again!
  g = transition(g, roll(1, 1));
  assert.equal(g.players[0].position, rules.harborSpace);
  // Must be BLOCKED: harborTurns is not set, travelBlocked is recorded!
  assert.equal(g.harborTurns?.[0], null);
  assert.equal(canSail(g, 0), false);
  assert.equal(g.travelBlocked?.space, rules.harborSpace);
});
