import { board } from './board.ts';
import { events } from './events.ts';
export const rules = {
  startingCash: 1500,
  startBonus: 200,
  rounds: 20,
  maxLevel: 3,
  restFee: 50,
  restSpace: 20,
  delaySpace: 30,
};
export type PlayerId = 0 | 1;
export type Phase = 'roll' | 'choice' | 'end' | 'finished';
export type Action =
  | { type: 'roll'; dice: [number, number]; event: number }
  | { type: 'buy' | 'upgrade' | 'end' | 'bail' }
  | { type: 'sell'; space: number };
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
    | 'bankrupt'
    | 'sell';
  detail?:
    | 'doubles'
    | 'three-doubles'
    | 'delay'
    | 'rest-wait'
    | 'rest-release'
    | 'rest-fee';
  player: PlayerId;
  amount?: number;
  space?: number;
  event?: number;
  dice?: [number, number];
};
export type Game = {
  rulesVersion?: 1 | 2;
  doubles?: number;
  extraRoll?: boolean;
  restTurns?: [number | null, number | null];
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
export function createGame(
  names: [string, string],
  rulesVersion: 1 | 2 = 2,
): Game {
  return {
    rulesVersion,
    doubles: 0,
    extraRoll: false,
    restTurns: [null, null],
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
  const space = board[index],
    property = g.properties[index];
  if (g.rulesVersion === 2 && space.kind === 'tourist') {
    const count = property
      ? board.filter(
          (s) =>
            s.kind === 'tourist' &&
            g.properties[s.index]?.owner === property.owner,
        ).length
      : 1;
    return 25 * 2 ** (Math.max(1, count) - 1);
  }
  if (
    g.rulesVersion === 2 &&
    property?.level === 0 &&
    ownsRegion(g, index, property.owner)
  )
    return (space.rent ?? 0) * 2;
  return (board[index].rent ?? 0) * (1 + (g.properties[index]?.level ?? 0));
}
export function ownsRegion(g: Game, index: number, owner: PlayerId) {
  const space = board[index];
  if (space.type !== 'city' || space.kind === 'tourist') return false;
  const group = board.filter(
    (s) =>
      s.type === 'city' &&
      s.kind !== 'tourist' &&
      s.country === space.country &&
      s.region?.en === space.region?.en,
  );
  return (
    group.length > 1 &&
    group.every((s) => g.properties[s.index]?.owner === owner)
  );
}
export function canBuy(g: Game) {
  const p = g.players[g.current],
    s = board[p.position];
  return (
    g.phase === 'choice' &&
    s.type === 'city' &&
    !g.properties[p.position] &&
    p.cash >= s.price!
  );
}
export function canUpgrade(g: Game) {
  const p = g.players[g.current],
    s = board[p.position],
    prop = g.properties[p.position];
  return (
    g.phase === 'choice' &&
    s.type === 'city' &&
    !(g.rulesVersion === 2 && s.kind === 'tourist') &&
    !!prop &&
    prop.owner === g.current &&
    prop.level < rules.maxLevel &&
    p.cash >= s.upgrade!
  );
}
export function sellValue(index: number, level = 0) {
  const s = board[index];
  if (!s || s.type !== 'city') return 0;
  const base = s.price ?? 0;
  const upgrades = level * (s.upgrade ?? 0);
  return Math.floor((base + upgrades) * 0.5);
}
export function canSell(g: Game, index: number, actor: PlayerId = g.current) {
  if (actor !== g.current) return false;
  if (g.phase === 'finished') return false;
  const prop = g.properties[index];
  return !!prop && prop.owner === actor;
}
function finishLanding(g: Game) {
  if (g.rulesVersion === 2 && g.phase === 'end' && g.extraRoll)
    g.phase = 'roll';
}
function sendToRest(g: Game, detail: Entry['detail']) {
  g.players[g.current].position = rules.restSpace;
  g.restTurns![g.current] = 0;
  g.doubles = 0;
  g.extraRoll = false;
  g.phase = 'end';
  log(g, { kind: 'rest', player: g.current, space: rules.restSpace, detail });
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
    g.extraRoll = false;
    g.doubles = 0;
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
  if (g.rulesVersion === 2 && index === rules.delaySpace) {
    sendToRest(g, 'delay');
    return;
  }
  if (s.type === 'city') {
    const property = g.properties[index];
    if (
      !property ||
      (property.owner === g.current &&
        !(g.rulesVersion === 2 && s.kind === 'tourist'))
    ) {
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
      (state.rulesVersion === 2 && city.kind === 'tourist') ||
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
  if (
    action.type === 'bail' &&
    (state.rulesVersion !== 2 ||
      state.phase !== 'roll' ||
      state.restTurns?.[actor] == null ||
      state.players[actor].cash < rules.restFee)
  )
    return state;
  if (
    action.type === 'sell' &&
    (action.space == null || !canSell(state, action.space, actor))
  )
    return state;
  if (!['roll', 'buy', 'upgrade', 'end', 'bail', 'sell'].includes(action.type))
    return state;
  const g = structuredClone(state);
  g.revision++;
  if (action.type === 'roll') {
    g.dice = action.dice;
    g.lastEvent = null;
    log(g, { kind: 'roll', player: actor, dice: action.dice });
    if (g.rulesVersion === 2) {
      const doubles = action.dice[0] === action.dice[1];
      g.extraRoll = false;
      if (g.restTurns![actor] !== null) {
        if (!doubles) {
          g.restTurns![actor]!++;
          if (g.restTurns![actor]! < 3) {
            g.phase = 'end';
            log(g, {
              kind: 'rest',
              player: actor,
              space: rules.restSpace,
              detail: 'rest-wait',
            });
            return g;
          }
          pay(g, rules.restFee);
          log(g, {
            kind: 'rest',
            player: actor,
            amount: rules.restFee,
            detail: 'rest-fee',
          });
          if (g.phase === 'finished') return g;
        }
        g.restTurns![actor] = null;
        g.doubles = 0;
        log(g, { kind: 'rest', player: actor, detail: 'rest-release' });
      } else {
        g.doubles = doubles ? (g.doubles ?? 0) + 1 : 0;
        if (g.doubles >= 3) {
          sendToRest(g, 'three-doubles');
          return g;
        }
        g.extraRoll = doubles;
        if (doubles) log(g, { kind: 'rest', player: actor, detail: 'doubles' });
      }
    }
    move(g, action.dice[0] + action.dice[1]);
    land(g, true, action.event);
    finishLanding(g);
  }
  if (action.type === 'buy') {
    g.players[actor].cash -= city.price!;
    g.properties[pos] = { owner: actor, level: 0 };
    g.phase = 'end';
    log(g, { kind: 'buy', player: actor, space: pos, amount: city.price });
    finishLanding(g);
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
    finishLanding(g);
  }
  if (action.type === 'bail') {
    pay(g, rules.restFee);
    g.restTurns![actor] = null;
    log(g, {
      kind: 'rest',
      player: actor,
      amount: rules.restFee,
      detail: 'rest-fee',
    });
  }
  if (action.type === 'sell') {
    const spaceIndex = action.space;
    const prop = g.properties[spaceIndex];
    if (prop && prop.owner === actor) {
      const value = sellValue(spaceIndex, prop.level);
      g.players[actor].cash += value;
      delete g.properties[spaceIndex];
      log(g, { kind: 'sell', player: actor, space: spaceIndex, amount: value });
    }
  }
  if (action.type === 'end') {
    if (g.rulesVersion === 2 && g.extraRoll) {
      g.phase = 'roll';
      return g;
    }
    g.doubles = 0;
    g.extraRoll = false;
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
export type Save = {
  version: 1 | 2;
  names: [string, string];
  actions: Action[];
};
export function restore(raw: string): { save: Save; game: Game } | null {
  try {
    if (raw.length > 100000) return null;
    const v = JSON.parse(raw);
    if (
      ![1, 2].includes(v.version) ||
      !Array.isArray(v.names) ||
      v.names.length !== 2 ||
      !v.names.every(
        (n: unknown) =>
          typeof n === 'string' && n.trim().length > 0 && n.length <= 24,
      ) ||
      !Array.isArray(v.actions) ||
      v.actions.length > (v.version === 2 ? 500 : 150)
    )
      return null;
    let game = createGame(v.names, v.version);
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
