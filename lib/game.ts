import { board } from './board.ts';
import { events } from './events.ts';
export const rules = {
  startingCash: 1500,
  startBonus: 200,
  rounds: 20,
  maxLevel: 3,
};
export type PlayerId = 0 | 1;
export type Phase = 'roll' | 'choice' | 'end' | 'finished';
export type Action =
  | { type: 'roll'; dice: [number, number]; event: number }
  | { type: 'buy' | 'upgrade' | 'end' };
export type Entry = {
  kind:
    | 'roll'
    | 'bonus'
    | 'rent'
    | 'event'
    | 'buy'
    | 'upgrade'
    | 'rest'
    | 'finish'
    | 'bankrupt';
  player: PlayerId;
  amount?: number;
  space?: number;
  event?: number;
  dice?: [number, number];
};
export type Game = {
  players: [
    { name: string; cash: number; position: number },
    { name: string; cash: number; position: number },
  ];
  properties: Record<number, { owner: PlayerId; level: number }>;
  current: PlayerId;
  round: number;
  phase: Phase;
  dice: [number, number] | null;
  lastEvent: number | null;
  logs: Entry[];
  winner: PlayerId | 'tie' | null;
  reason: 'rounds' | 'bankruptcy' | null;
  revision: number;
};
export function createGame(names: [string, string]): Game {
  return {
    players: names.map((name) => ({
      name: name.trim().slice(0, 24),
      cash: rules.startingCash,
      position: 0,
    })) as Game['players'],
    properties: {},
    current: 0,
    round: 1,
    phase: 'roll',
    dice: null,
    lastEvent: null,
    logs: [],
    winner: null,
    reason: null,
    revision: 0,
  };
}
export function assets(g: Game, id: PlayerId) {
  return (
    g.players[id].cash +
    Object.entries(g.properties).reduce(
      (sum, [i, p]) =>
        sum +
        (p.owner === id
          ? board[Number(i)].price! + p.level * board[Number(i)].upgrade!
          : 0),
      0,
    )
  );
}
export function rentAt(g: Game, index: number) {
  return (board[index].rent ?? 0) * (1 + (g.properties[index]?.level ?? 0));
}
function log(g: Game, e: Entry) {
  g.logs.push(e);
  g.logs = g.logs.slice(-80);
}
function pay(g: Game, amount: number, to?: PlayerId) {
  const p = g.players[g.current];
  if (p.cash < amount) {
    if (to !== undefined) g.players[to].cash += p.cash;
    p.cash = 0;
    g.phase = 'finished';
    g.winner = g.current === 0 ? 1 : 0;
    g.reason = 'bankruptcy';
    log(g, { kind: 'bankrupt', player: g.current, amount });
    return;
  }
  p.cash -= amount;
  if (to !== undefined) g.players[to].cash += amount;
}
function move(g: Game, steps: number) {
  const p = g.players[g.current],
    next = p.position + steps;
  if (steps > 0 && next >= 40) {
    p.cash += rules.startBonus;
    log(g, { kind: 'bonus', player: g.current, amount: rules.startBonus });
  }
  p.position = ((next % 40) + 40) % 40;
}
function land(g: Game, allowEvent: boolean, event: number) {
  const index = g.players[g.current].position,
    s = board[index];
  g.phase = 'end';
  if (s.type === 'city') {
    const property = g.properties[index];
    if (!property || property.owner === g.current) {
      g.phase = 'choice';
      return;
    }
    const amount = rentAt(g, index);
    log(g, { kind: 'rent', player: g.current, amount, space: index });
    pay(g, amount, property.owner);
    return;
  }
  if (s.type === 'event' && allowEvent) {
    g.lastEvent = event;
    log(g, { kind: 'event', player: g.current, event });
    const effect = events[event].effect;
    if (effect.kind === 'cash') {
      if (effect.amount < 0) pay(g, -effect.amount);
      else g.players[g.current].cash += effect.amount;
    } else {
      move(g, effect.steps);
      land(g, false, event);
    }
    return;
  }
  log(g, { kind: 'rest', player: g.current, space: index });
}
/** Pure transition, usable by a future authoritative room server. Invalid/stale requests are no-ops. */
export function transition(
  state: Game,
  action: Action,
  actor: PlayerId = state.current,
  revision = state.revision,
): Game {
  if (
    state.phase === 'finished' ||
    actor !== state.current ||
    revision !== state.revision
  )
    return state;
  const pos = state.players[actor].position,
    prop = state.properties[pos],
    city = board[pos];
  if (
    action.type === 'roll' &&
    (state.phase !== 'roll' ||
      !Array.isArray(action.dice) ||
      action.dice.length !== 2 ||
      !action.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) ||
      !Number.isInteger(action.event) ||
      !events[action.event])
  )
    return state;
  if (
    action.type === 'buy' &&
    (state.phase !== 'choice' ||
      city.type !== 'city' ||
      prop ||
      state.players[actor].cash < city.price!)
  )
    return state;
  if (
    action.type === 'upgrade' &&
    (state.phase !== 'choice' ||
      city.type !== 'city' ||
      !prop ||
      prop.owner !== actor ||
      prop.level >= rules.maxLevel ||
      state.players[actor].cash < city.upgrade!)
  )
    return state;
  if (
    action.type === 'end' &&
    state.phase !== 'choice' &&
    state.phase !== 'end'
  )
    return state;
  if (!['roll', 'buy', 'upgrade', 'end'].includes(action.type)) return state;
  const g = structuredClone(state);
  g.revision++;
  if (action.type === 'roll') {
    g.dice = action.dice;
    g.lastEvent = null;
    log(g, { kind: 'roll', player: actor, dice: action.dice });
    move(g, action.dice[0] + action.dice[1]);
    land(g, true, action.event);
  }
  if (action.type === 'buy') {
    g.players[actor].cash -= city.price!;
    g.properties[pos] = { owner: actor, level: 0 };
    g.phase = 'end';
    log(g, { kind: 'buy', player: actor, space: pos, amount: city.price });
  }
  if (action.type === 'upgrade') {
    g.players[actor].cash -= city.upgrade!;
    g.properties[pos].level++;
    g.phase = 'end';
    log(g, {
      kind: 'upgrade',
      player: actor,
      space: pos,
      amount: city.upgrade,
    });
  }
  if (action.type === 'end') {
    if (g.current === 1 && g.round === rules.rounds) {
      g.phase = 'finished';
      g.reason = 'rounds';
      const a = assets(g, 0),
        b = assets(g, 1);
      g.winner = a === b ? 'tie' : a > b ? 0 : 1;
      log(g, { kind: 'finish', player: actor });
    } else {
      if (g.current === 1) g.round++;
      g.current = g.current === 0 ? 1 : 0;
      g.phase = 'roll';
      g.lastEvent = null;
    }
  }
  return g;
}
// Save actions, replay with the rules on restore: malformed states cannot inject balances or ownership.
export type Save = { version: 1; names: [string, string]; actions: Action[] };
export function restore(raw: string): { save: Save; game: Game } | null {
  try {
    if (raw.length > 100000) return null;
    const v = JSON.parse(raw);
    if (
      v.version !== 1 ||
      !Array.isArray(v.names) ||
      v.names.length !== 2 ||
      !v.names.every(
        (n: unknown) =>
          typeof n === 'string' && n.trim().length > 0 && n.length <= 24,
      ) ||
      !Array.isArray(v.actions) ||
      v.actions.length > 150
    )
      return null;
    let game = createGame(v.names);
    for (const a of v.actions) {
      if (!a || typeof a !== 'object') return null;
      const next = transition(game, a);
      if (next === game) return null;
      game = next;
    }
    return { save: v, game };
  } catch {
    return null;
  }
}
