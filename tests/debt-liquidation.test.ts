import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  transition,
  sellValue,
  canSell,
  type Action,
} from '../lib/game.ts';

const roll = (d1: number, d2: number, ev = 0): Action => ({
  type: 'roll',
  dice: [d1, d2],
  event: ev,
});

test('insufficient cash with owned properties enters debt phase instead of bankruptcy', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].cash = 20;
  g.players[0].position = 0;

  g.properties[2] = { owner: 1, level: 3 };
  g.properties[5] = { owner: 0, level: 0 };

  const rolled = transition(g, roll(1, 1));

  assert.equal(rolled.players[0].position, 2);
  assert.equal(rolled.phase, 'choice');
  assert.equal(rolled.pendingPayment?.type, 'rent');
  assert.equal(rolled.pendingPayment?.amount, 48);

  const inDebt = transition(rolled, { type: 'payRent' });
  assert.equal(inDebt.phase, 'debt');
  assert.notEqual(inDebt.pendingDebt, null);
  assert.equal(inDebt.pendingDebt?.amount, 48);
  assert.equal(inDebt.pendingDebt?.to, 1);
  assert.equal(inDebt.pendingDebt?.reason, 'rent');
  assert.equal(inDebt.winner, null);
  assert.equal(inDebt.reason, null);

  assert.equal(transition(inDebt, roll(1, 2)), inDebt);
  assert.equal(transition(inDebt, { type: 'end' }), inDebt);
  assert.equal(transition(inDebt, { type: 'payDebt' }), inDebt);

  assert.equal(canSell(inDebt, 5), true);
  const sold = transition(inDebt, { type: 'sell', space: 5 });

  assert.equal(sold.properties[5], undefined);
  assert.equal(sold.players[0].cash, 20 + sellValue(5, 0)); // 20 + 70 = 90
  assert.equal(sold.phase, 'debt');

  const paid = transition(sold, { type: 'payDebt' });

  assert.equal(paid.players[0].cash, 90 - 48); // 42
  assert.equal(paid.players[1].cash, 1500 + 48);
  assert.equal(paid.pendingDebt, null);
  assert.equal(paid.phase, 'roll');
  assert.equal(paid.extraRoll, true);
});

test('natural gameplay flow with emergency property liquidation and replay restore', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);

  // Turn 1 (P0): Roll 1+3 = 4. Space 4 is city (price 140). Buy it.
  g = transition(g, roll(1, 3));
  assert.equal(g.players[0].position, 4);
  g = transition(g, { type: 'buy' });
  assert.equal(g.properties[4]?.owner, 0);
  g = transition(g, { type: 'end' });

  // Turn 2 (P1): Roll 1+4 = 5. Space 5 is city (price 140). Buy it.
  assert.equal(g.current, 1);
  g = transition(g, roll(1, 4));
  assert.equal(g.players[1].position, 5);
  g = transition(g, { type: 'buy' });
  // Set P0 cash to 10 to force debt on landing
  g.players[0].cash = 10;
  // Upgrade P1's property to Lv.2 -> Rent is 140 * 0.12 * 3 = 50
  g.properties[5].level = 2;
  g = transition(g, { type: 'end' });

  // Turn 3 (P0): Position is 4. Roll 0+1 or 1+6? Wait, dice min 1 each: 1+1=2, so 4+1 = wait, min roll is 1+1=2 (lands on 6).
  // Instead of moving from 4 to 5, let's set P0 position to 3 (or roll 1+1 from 3):
  g.players[0].position = 3;
  // P0 rolls 1+1 = 2 -> Lands on space 5 (P1's property, rent 50).
  // Rent is 51. P0 only has 10 cash, but owns space 4 (price 140, sell value = 70). Total = 80 >= 51!
  g = transition(g, roll(1, 1));
  assert.equal(g.players[0].position, 5);
  assert.equal(g.phase, 'choice');
  assert.equal(g.pendingPayment?.type, 'rent');
  g = transition(g, { type: 'payRent' });
  assert.equal(g.phase, 'debt');
  assert.equal(g.pendingDebt?.amount, 51);

  // Sell space 4
  g = transition(g, { type: 'sell', space: 4 });
  assert.equal(g.players[0].cash, 10 + sellValue(4, 0)); // 10 + 70 = 80
  assert.equal(g.properties[4], undefined);
  assert.equal(g.phase, 'debt');

  // Pay debt
  g = transition(g, { type: 'payDebt' });
  assert.equal(g.players[0].cash, 80 - 51); // 29
  assert.equal(g.phase, 'roll'); // Doubles (1, 1) grants extra roll
  assert.equal(g.pendingDebt, null);
});

test('voluntary bankruptcy in debt phase transfers remaining cash and ends game', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].cash = 20;
  g.properties[5] = { owner: 0, level: 0 };
  g.properties[2] = { owner: 1, level: 3 };

  g = transition(g, roll(1, 1));
  assert.equal(g.phase, 'choice');
  assert.equal(g.pendingPayment?.type, 'rent');
  g = transition(g, { type: 'payRent' });
  assert.equal(g.phase, 'debt');

  // Player chooses to surrender / declare bankruptcy
  g = transition(g, { type: 'bankrupt' });
  assert.equal(g.phase, 'finished');
  assert.equal(g.winner, 1);
  assert.equal(g.reason, 'bankruptcy');
  assert.equal(g.players[0].cash, 0);
  assert.equal(g.players[1].cash, 1500 + 20);
});

test('player with zero properties immediately goes bankrupt without debt phase', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  g.players[0].cash = 20;
  g.properties[2] = { owner: 1, level: 3 };

  g = transition(g, roll(1, 1));
  assert.equal(g.phase, 'choice');
  assert.equal(g.pendingPayment?.type, 'rent');
  g = transition(g, { type: 'payRent' });
  assert.equal(g.phase, 'finished');
  assert.equal(g.winner, 1);
  assert.equal(g.reason, 'bankruptcy');
  assert.equal(g.players[0].cash, 0);
  assert.equal(g.players[1].cash, 1520);
});

test('player landing on their own tourist destination pays zero fee and does not go bankrupt', () => {
  let g = createGame(['Dubu', 'Dubi'], 2);
  // P1 (Player 1) owns Piura (space 37, tourist destination) and Cusco (space 26, tourist destination)
  g.properties[37] = { owner: 1, level: 0 };
  g.properties[26] = { owner: 1, level: 0 };

  // Set P1 cash to 20 (less than 100 visit fee)
  g.players[1].cash = 20;
  g.players[1].position = 35; // Two steps before Piura (37)
  g.current = 1;
  g.phase = 'roll';

  // Roll 1 + 1 = 2 -> Lands on Piura (37)
  g = transition(g, roll(1, 1), 1);

  // P1 owns Piura: MUST NOT PAY VISIT FEE! Cash must remain 20, phase becomes roll (doubles)
  assert.equal(g.players[1].position, 37);
  assert.equal(g.players[1].cash, 20);
  assert.equal(g.phase, 'roll'); // Doubles grants extra roll
  assert.equal(g.winner, null);
  assert.equal(g.reason, null);
  assert.equal(g.pendingDebt, null);
});
