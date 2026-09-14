'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Game, PlayerId, Action } from '../../lib/game';
import { assets, rules, canBuy, canUpgrade, canFly, canSail, sellValue, playerStartBonus } from '../../lib/game';
import { board } from '../../lib/board';
import { events } from '../../lib/events';
import type { Lang } from '../../lib/board';
import { sound, triggerHaptic } from '../../lib/audio';

export type MoneyTransfer = {
  id: number;
  from: 'p0' | 'p1' | 'bank';
  to: 'p0' | 'p1' | 'bank';
  amount: number;
  reason: string;
  icon: string;
};

type CashDelta = { id: number; amount: number; text: string };

export interface BoardCenterHubProps {
  game: Game;
  names: [string, string];
  cashDeltas: [CashDelta[], CashDelta[]];
  roomToken: string | null;
  myPlayerIndex: number;
  lang: Lang;
  actionsBlocked?: boolean;
  isRolling?: boolean;
  rollingDice?: [number, number] | null;
  pendingAction?: Action['type'] | null;
  targetTravelSpace?: number;
  onAction?: (action: Action) => void;
}

export function BoardCenterHub({
  game,
  names,
  cashDeltas,
  roomToken,
  myPlayerIndex,
  lang,
  actionsBlocked = false,
  isRolling = false,
  rollingDice = null,
  pendingAction = null,
  targetTravelSpace = 0,
  onAction,
}: BoardCenterHubProps) {
  const [activeTransfer, setActiveTransfer] = useState<MoneyTransfer | null>(null);
  const [bankActive, setBankActive] = useState(false);
  const lastProcessedLog = useRef(game.logs.length);
  const nextTransferId = useRef(1);
  const transferQueue = useRef<MoneyTransfer[]>([]);
  const isProcessingQueue = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const copy = (en: string, ko: string, es: string) =>
    lang === 'ko' ? ko : lang === 'es' ? es : en;

  const processQueue = () => {
    if (transferQueue.current.length === 0) {
      setActiveTransfer(null);
      isProcessingQueue.current = false;
      return;
    }
    isProcessingQueue.current = true;
    const next = transferQueue.current.shift()!;
    setActiveTransfer(next);
    sound.playCoin();
    triggerHaptic('medium');

    if (next.from === 'bank' || next.to === 'bank') {
      setBankActive(true);
      setTimeout(() => {
        if (isMounted.current) setBankActive(false);
      }, 1500);
    }

    setTimeout(() => {
      if (isMounted.current) {
        processQueue();
      }
    }, 1800);
  };

  // Process game logs to trigger money transfers
  useEffect(() => {
    const logs = game.logs;
    if (logs.length > lastProcessedLog.current) {
      const newEntries = logs.slice(lastProcessedLog.current);
      lastProcessedLog.current = logs.length;

      const discoveredTransfers: MoneyTransfer[] = [];

      for (const entry of newEntries) {
        const pKey = entry.player === 0 ? ('p0' as const) : ('p1' as const);
        const oppKey = entry.player === 0 ? ('p1' as const) : ('p0' as const);

        if (entry.kind === 'rent' && entry.amount && entry.amount > 0) {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: pKey,
            to: oppKey,
            amount: entry.amount,
            reason: copy('Rent Fee', '방문료', 'Alquiler'),
            icon: '💸',
          });
        } else if (entry.kind === 'bonus' && entry.amount && entry.amount > 0) {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: 'bank',
            to: pKey,
            amount: entry.amount,
            reason: copy('Start Salary', '출발 월급', 'Salario'),
            icon: '💰',
          });
        } else if (entry.kind === 'buy' && entry.amount && entry.amount > 0) {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: pKey,
            to: 'bank',
            amount: entry.amount,
            reason: copy('City Purchase', '도시 매입', 'Compra'),
            icon: '🏗️',
          });
        } else if (entry.kind === 'upgrade' && entry.amount && entry.amount > 0) {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: pKey,
            to: 'bank',
            amount: entry.amount,
            reason: copy('Building Upgrade', '건물 증축', 'Mejora'),
            icon: '🔨',
          });
        } else if (entry.kind === 'flight') {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: pKey,
            to: 'bank',
            amount: rules.flightFee,
            reason: copy('Flight Ticket', '항공료', 'Billete'),
            icon: '✈️',
          });
        } else if (entry.kind === 'sail') {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: pKey,
            to: 'bank',
            amount: rules.sailFee,
            reason: copy('Ferry Ticket', '승선료', 'Pasaje'),
            icon: '⚓',
          });
        } else if (entry.kind === 'sell' && entry.amount && entry.amount > 0) {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: 'bank',
            to: pKey,
            amount: entry.amount,
            reason: copy('Property Sale', '토지 매각', 'Venta'),
            icon: '🏷️',
          });
        } else if (entry.kind === 'rest' && entry.detail === 'rest-fee') {
          discoveredTransfers.push({
            id: nextTransferId.current++,
            from: pKey,
            to: 'bank',
            amount: rules.restFee,
            reason: copy('Rest Bail', '휴식 보석금', 'Fianza'),
            icon: '🗝️',
          });
        } else if (entry.kind === 'event' && entry.event !== undefined) {
          const ev = events[entry.event];
          if (ev?.effect?.kind === 'cash') {
            if (ev.effect.amount > 0) {
              discoveredTransfers.push({
                id: nextTransferId.current++,
                from: 'bank',
                to: pKey,
                amount: ev.effect.amount,
                reason: copy('Event Reward', '이벤트 보너스', 'Premio'),
                icon: '🎒',
              });
            } else if (ev.effect.amount < 0) {
              discoveredTransfers.push({
                id: nextTransferId.current++,
                from: pKey,
                to: 'bank',
                amount: -ev.effect.amount,
                reason: copy('Event Fee', '이벤트 납부', 'Tasa'),
                icon: '🎒',
              });
            }
          }
        }
      }

      if (discoveredTransfers.length > 0) {
        transferQueue.current.push(...discoveredTransfers);
        if (!isProcessingQueue.current) {
          processQueue();
        }
      }
    }
  }, [game.logs, copy]);

  const p0 = game.players[0];
  const p1 = game.players[1];
  const activeEvent = game.lastEvent !== null ? events[game.lastEvent] : null;
  const activeEffect = activeEvent?.effect;

  const isP0Sending = activeTransfer?.from === 'p0';
  const isP0Receiving = activeTransfer?.to === 'p0';
  const isP1Sending = activeTransfer?.from === 'p1';
  const isP1Receiving = activeTransfer?.to === 'p1';
  const isBankSending = activeTransfer?.from === 'bank';
  const isBankReceiving = activeTransfer?.to === 'bank';

  // Game state helpers for controls
  const isMyTurn = !roomToken || myPlayerIndex === game.current;
  const activeActor = (roomToken && myPlayerIndex >= 0 ? myPlayerIndex : game.current) as PlayerId;
  const activePlayer = game.players[game.current];
  const activePos = activePlayer.position;
  const landedSpace = board[activePos];
  const ownedProperty = game.properties[activePos];
  const isTourist = landedSpace.kind === 'tourist' && game.rulesVersion === 2;
  const extraRoll = Boolean(game.rulesVersion === 2 && game.extraRoll);
  const inRest = Boolean(game.rulesVersion === 2 && game.restTurns?.[game.current] != null);
  const isAirportActive = Boolean(game && canFly(game, activeActor));
  const isHarborActive = Boolean(game && canSail(game, activeActor));
  const isHarborAtWait = Boolean(
    game.rulesVersion === 2 &&
    activePos === rules.harborSpace &&
    game.harborTurns?.[activeActor] === 1
  );
  const hasEnoughSailCash = activePlayer.cash >= rules.sailFee;
  const isHarborBlocked = Boolean(
    game.travelBlocked?.space === rules.harborSpace ||
    ((game.travelCooldown?.[activeActor] ?? 0) > 0 && activePos === rules.harborSpace)
  );

  const isAirportAtSpace = Boolean(
    game.rulesVersion === 2 &&
    activePos === rules.airportSpace
  );
  const hasEnoughFlyCash = activePlayer.cash >= rules.flightFee;
  const isAirportBlocked = Boolean(
    game.travelBlocked?.space === rules.airportSpace ||
    ((game.travelCooldown?.[activeActor] ?? 0) > 0 && activePos === rules.airportSpace)
  );
  const isTravelActive = isAirportActive || isHarborActive;

  const hasPropertyAction = canBuy(game) || canUpgrade(game);
  const endEmphasized =
    (game.phase === 'choice' || game.phase === 'end') && !extraRoll && !hasPropertyAction;

  // Dice visual state
  const displayDice: [number, number] =
    rollingDice ?? (game.dice ? [game.dice[0] ?? 0, game.dice[1] ?? 0] : [0, 0]);
  const diceSum = (displayDice[0] || 0) + (displayDice[1] || 0);
  const isDoubles = displayDice[0] > 0 && displayDice[0] === displayDice[1];

  // Debt state
  const pendingDebt = game.pendingDebt;
  const debtAmount = pendingDebt?.amount ?? 0;
  const shortfall = Math.max(0, debtAmount - activePlayer.cash);
  const ownedSpaces = Object.keys(game.properties)
    .map(Number)
    .filter((idx) => game.properties[idx]?.owner === game.current);

  // Action handlers
  const handleRoll = () => {
    if (!onAction || actionsBlocked) return;
    const modifier = game.players[activeActor]?.nextRollModifier;
    let dice: [number, number];
    if (modifier === 'single') {
      dice = [Math.floor(Math.random() * 6) + 1, 0];
    } else if (modifier === 'doubles') {
      const d = Math.floor(Math.random() * 6) + 1;
      dice = [d, d];
    } else {
      dice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    }
    onAction({
      type: 'roll',
      dice,
      event: Math.floor(Math.random() * events.length),
    });
  };

  const handleBuy = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'buy' });
  };

  const handleUpgrade = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'upgrade' });
  };

  const handleEndTurn = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'end' });
  };

  const handleBail = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'bail' });
  };

  const handleFly = () => {
    if (!onAction || actionsBlocked || targetTravelSpace === undefined) return;
    onAction({ type: 'fly', space: targetTravelSpace });
  };

  const handleSkipFly = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'skipFly' });
  };

  const handleSail = () => {
    if (!onAction || actionsBlocked || targetTravelSpace === undefined) return;
    onAction({ type: 'sail', space: targetTravelSpace });
  };

  const handleSkipSail = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'skipSail' });
  };

  const handleSell = (space: number) => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'sell', space });
  };

  const handlePayDebt = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'payDebt' });
  };

  const handlePayRent = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'payRent' });
  };

  const handleClaimEvent = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'claimEvent' });
  };

  const handleBankrupt = () => {
    if (!onAction || actionsBlocked) return;
    onAction({ type: 'bankrupt' });
  };

  const pendingPayment = game.pendingPayment;
  const isPendingRent = pendingPayment?.type === 'rent';
  const pendingEvent = game.pendingEvent;
  const isPendingEventActive = Boolean(pendingEvent || (pendingPayment?.type === 'event'));
  const currentEventIdx = pendingEvent?.event ?? (pendingPayment?.type === 'event' ? pendingPayment.event : (isPendingEventActive ? game.lastEvent : null));
  const modalEvent = currentEventIdx !== null && currentEventIdx !== undefined ? events[currentEventIdx] : null;
  const modalEffect = modalEvent?.effect;

  // Status message
  let statusHintText = '';
  if (isPendingRent && pendingPayment) {
    const oppName = names[pendingPayment.to as number] || (pendingPayment.to === 0 ? 'P1' : 'P2');
    statusHintText = copy(
      `Arrived at ${oppName}'s ${landedSpace?.name[lang]} · Pay ${pendingPayment.amount.toLocaleString()} Dubi rent`,
      `📍 ${oppName}의 ${landedSpace?.name[lang]} 도착 · 방문료 ${pendingPayment.amount.toLocaleString()} Dubi를 지불하세요`,
      `Llegada a ${landedSpace?.name[lang]} de ${oppName} · Paga ${pendingPayment.amount.toLocaleString()} Dubi`,
    );
  } else if (isPendingEventActive && modalEvent) {
    statusHintText = `${modalEvent.icon ?? '🎒'} ${modalEvent.text[lang]}`;
  } else if (isHarborBlocked || isAirportBlocked) {
    statusHintText = copy(
      '🚨 Travel cooldown active! Used Airport/Harbor too recently. Roll dice normally.',
      '🚨 쿨다운 1턴 적용 중! 공항/항구를 너무 자주 이용하여 이번에는 이용할 수 없습니다. 일반 주사위로 진행하세요.',
      '🚨 ¡Enfriamiento activo! Aeropuerto/puerto usado recientemente. Tira los dados normalmente.',
    );
  } else if (isHarborActive) {
    statusHintText = copy(
      `🚢 Harbor Sail (${rules.sailFee} Dubi) · Tap any tile on the board to choose destination!`,
      `🚢 항구 출항 (${rules.sailFee} Dubi) · 보드판에서 이동할 목적지 타일을 터치하세요!`,
      `🚢 Puerto (${rules.sailFee} Dubi) · ¡Toca una casilla en el tablero para zarpar!`,
    );
  } else if (isAirportActive) {
    statusHintText = copy(
      `🛫 Airport Flight (${rules.flightFee} Dubi) · Tap any tile on the board to choose destination!`,
      `🛫 공항 비행 (${rules.flightFee} Dubi) · 보드판에서 이동할 목적지 타일을 터치하세요!`,
      `🛫 Vuelo (${rules.flightFee} Dubi) · ¡Toca una casilla en el tablero para volar!`,
    );
  } else if (isHarborAtWait && !hasEnoughSailCash) {
    const missing = rules.sailFee - activePlayer.cash;
    statusHintText = copy(
      `Short by ${missing} Dubi for Harbor sail (Need ${rules.sailFee} Dubi) · Roll dice to move`,
      `항구 출항 요금 ${rules.sailFee} Dubi 중 ${missing} Dubi 부족 · 주사위를 굴려 이동하세요`,
      `Faltan ${missing} Dubi para zarpar · Tira dados`,
    );
  } else if (isAirportAtSpace && !hasEnoughFlyCash) {
    const missing = rules.flightFee - activePlayer.cash;
    statusHintText = copy(
      `Short by ${missing} Dubi for Airport flight (Need ${rules.flightFee} Dubi)`,
      `비행 요금 ${rules.flightFee} Dubi 중 ${missing} Dubi 부족`,
      `Faltan ${missing} Dubi para volar`,
    );
  } else if (game.phase === 'roll') {
    if (isRolling || pendingAction === 'roll') {
      statusHintText = copy('Rolling dice...', '주사위를 굴리고 있습니다...', 'Tirando dados...');
    } else if (extraRoll) {
      statusHintText = copy('✨ Doubles! Roll again!', '✨ 더블 찬스! 한 번 더 굴리세요!', '¡Dobles! ¡Tira de nuevo!');
    } else if (inRest) {
      statusHintText = copy('💤 Rest: Roll doubles or pay bail', '💤 휴식 중: 더블을 노리거나 보석금을 내세요', '💤 Descanso: Saca dobles o paga fianza');
    } else {
      statusHintText = copy('Roll dice to move', '주사위를 굴려 이동하세요', 'Tira los dados para avanzar');
    }
  } else if (game.phase === 'choice') {
    if (landedSpace?.type === 'city') {
      if (!ownedProperty) {
        const price = landedSpace.price ?? 0;
        const canAfford = activePlayer.cash >= price;
        const missing = price - activePlayer.cash;
        statusHintText = canAfford
          ? copy(
              `Buy ${landedSpace.name[lang]} (${price} Dubi)`,
              `${landedSpace.name[lang]} (${price} Dubi) 매입 가능`,
              `Comprar ${landedSpace.name[lang]}`,
            )
          : copy(
              `Insufficient funds to buy ${landedSpace.name[lang]} (Need: ${price} Dubi · Short: ${missing} Dubi)`,
              `📍 ${landedSpace.name[lang]} 도착 · 잔고 부족 (가격: ${price} Dubi · 부족: ${missing} Dubi)`,
              `Fondos insuficientes (${price} Dubi · Faltan ${missing} Dubi)`,
            );
      } else if (!isTourist && (ownedProperty.level ?? 0) < 3) {
        const upgradeCost = landedSpace.upgrade ?? 0;
        const canAfford = activePlayer.cash >= upgradeCost;
        const missing = upgradeCost - activePlayer.cash;
        const nextLv = (ownedProperty.level ?? 0) + 1;
        statusHintText = canAfford
          ? copy(
              `Upgrade ${landedSpace.name[lang]} Lv.${nextLv} (${upgradeCost} Dubi)`,
              `${landedSpace.name[lang]} Lv.${nextLv} 증축 가능 (${upgradeCost} Dubi)`,
              `Mejorar ${landedSpace.name[lang]} Lv.${nextLv}`,
            )
          : copy(
              `Insufficient funds for Lv.${nextLv} upgrade (Need: ${upgradeCost} Dubi · Short: ${missing} Dubi)`,
              `📍 ${landedSpace.name[lang]} Lv.${nextLv} 증축 잔고 부족 (비용: ${upgradeCost} Dubi · 부족: ${missing} Dubi)`,
              `Fondos insuficientes Nv.${nextLv} (${upgradeCost} Dubi · Faltan ${missing} Dubi)`,
            );
      } else {
        statusHintText = copy('Ready to end turn', '턴을 마칠 준비가 되었습니다', 'Listo para finalizar');
      }
    } else if (isAirportActive) {
      statusHintText = copy('Tap destination tile on board', '보드에서 비행할 칸을 터치하세요', 'Toca casilla en tablero');
    } else if (isHarborActive) {
      statusHintText = copy('Tap destination tile on board', '보드에서 항해할 칸을 터치하세요', 'Toca casilla en tablero');
    } else {
      statusHintText = copy('Ready to end turn', '턴을 마칠 준비가 되었습니다', 'Listo para finalizar');
    }
  } else if (game.phase === 'end') {
    statusHintText = copy('Ready to end turn', '턴 종료를 누르세요', 'Finaliza tu turno');
  } else if (game.phase === 'debt') {
    statusHintText = copy(
      '🚨 Cash shortfall! Sell property to settle debt',
      '🚨 자금 부족! 소유 부동산을 매각하여 채무를 변제하세요',
      '🚨 ¡Fondos insuficientes! Vende propiedades',
    );
  } else if (game.phase === 'finished') {
    statusHintText = copy('Game finished!', '게임이 종료되었습니다!', '¡Juego terminado!');
  }

  return (
    <div className="board-center-hub" role="region" aria-label="Game board center">
      {/* Top Header Bar */}
      <div className="hub-header-bar">
        <div className="hub-brand-row">
          <span className="hub-brand-title">
            Dubi<span>poly</span>
          </span>
          <span className="hub-round-badge">
            {copy('Round', '라운드', 'Ronda')} {game.round}/{rules.rounds}
          </span>
        </div>
        {activeTransfer ? (
          <div className="hub-flow-banner" role="status" aria-live="polite">
            <span className={`flow-actor-pill pill-${activeTransfer.from}`}>
              {activeTransfer.from === 'p0' ? '● P1' : activeTransfer.from === 'p1' ? '◆ P2' : '🏛️ BANK'}
            </span>
            <span className="flow-badge-middle">
              <span className="flow-arrow-beam">🪙➔</span>
              <strong className="flow-badge-amount">
                {activeTransfer.amount.toLocaleString()} Dubi
              </strong>
              <small className="flow-badge-reason">({activeTransfer.reason})</small>
            </span>
            <span className={`flow-actor-pill pill-${activeTransfer.to}`}>
              {activeTransfer.to === 'p0' ? '● P1' : activeTransfer.to === 'p1' ? '◆ P2' : '🏛️ BANK'}
            </span>
          </div>
        ) : (
          <div className="hub-route-subtitle">🇰🇷 SEOUL ↔ LIMA 🇵🇪</div>
        )}
      </div>

      {/* NEW: Upper Turn Controls (Dice, Buy/Upgrade, End Turn, Debt Panel) */}
      {game.phase !== 'finished' && onAction && (
        <div className="hub-upper-controls" role="region" aria-label="Turn controls">
          <div className="hub-turn-indicator-row">
            <span className={`hub-turn-actor-pill actor-${game.current} ${isMyTurn ? 'is-my-turn' : ''}`}>
              <span className="turn-bullet">{game.current === 0 ? '●' : '◆'}</span>
              <strong className="turn-name">{names[game.current] || (game.current === 0 ? 'P1' : 'P2')}</strong>
              {roomToken && isMyTurn && (
                <span className="turn-you-tag">{copy('YOU', '내 턴', 'TÚ')}</span>
              )}
            </span>
            <span className="hub-turn-action-hint" title={statusHintText}>
              {statusHintText}
            </span>
          </div>

          <div className="hub-control-deck">
            {game.phase === 'debt' ? (
              <div className="hub-debt-panel" role="region" aria-label="Debt settlement">
                <div className="hub-debt-top-row">
                  <div className="debt-title-group">
                    <span className="debt-tag">🚨 {copy('Debt Settlement', '긴급 채무 변제', 'Liquidación')}</span>
                    <span className="debt-target-info">
                      {copy('Debt', '변제액', 'Deuda')}: <strong>{debtAmount.toLocaleString()} Dubi</strong>
                    </span>
                  </div>
                  <div className="debt-shortfall-badge">
                    <span className="shortfall-label">{copy('Shortfall', '부족액', 'Falta')}:</span>
                    <strong className="shortfall-amount">
                      {shortfall > 0 ? `${shortfall.toLocaleString()} Dubi` : copy('0 (Cleared!)', '0 (변제 가능)', '0 (¡Cubierto!)')}
                    </strong>
                  </div>
                </div>

                <div className="hub-debt-sale-section">
                  <div className="debt-section-label">
                    {copy('Tap property to sell (50% refund):', '매각할 부동산 선택 (건설비 50% 환급):', 'Vender propiedad (50%):')}
                  </div>
                  <div className="hub-debt-sale-scroll">
                    {ownedSpaces.length > 0 ? (
                      ownedSpaces.map((idx) => {
                        const sp = board[idx];
                        const prop = game.properties[idx];
                        const val = sellValue(idx, prop?.level ?? 0);
                        return (
                          <button
                            key={idx}
                            type="button"
                            className="hub-debt-sell-btn"
                            disabled={actionsBlocked}
                            onClick={() => handleSell(idx)}
                            title={copy(`Sell ${sp.name[lang]} for ${val} Dubi`, `${sp.name[lang]} 매각하고 ${val} Dubi 확보`, `Vender ${sp.name[lang]}`)}
                          >
                            <span className="prop-name">{sp.name[lang]}</span>
                            <span className="prop-val">+{val.toLocaleString()}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="hub-debt-no-props">
                        {copy('No owned properties available to sell', '매각할 수 있는 보유 부동산이 없습니다', 'Sin propiedades para vender')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hub-debt-action-row">
                  <div className="hub-debt-status-note">
                    {activePlayer.cash >= debtAmount ? (
                      <span className="status-ready">
                        ✅ {copy('Ready to settle debt! Tap Pay to continue.', '변제액 확보 완료! 계속하려면 버튼을 누르세요.', '¡Fondos listos!')}
                      </span>
                    ) : (
                      <span className="status-need">
                        ⚠️ {copy(`Need ${shortfall.toLocaleString()} more Dubi`, `${shortfall.toLocaleString()} Dubi 추가 확보 필요`, `Faltan ${shortfall.toLocaleString()} Dubi`)}
                      </span>
                    )}
                  </div>
                  <div className="hub-debt-btns-group">
                    <button
                      type="button"
                      className="hub-btn hub-btn-pay-debt"
                      disabled={actionsBlocked || activePlayer.cash < debtAmount}
                      onClick={handlePayDebt}
                    >
                      <span className="hub-btn-icon">💸</span>
                      <span className="hub-btn-text">
                        {copy('Pay & Continue', '채무 변제하고 계속', 'Pagar y Continuar')} ({debtAmount.toLocaleString()})
                      </span>
                    </button>
                    <button
                      type="button"
                      className="hub-btn hub-btn-bankrupt"
                      disabled={actionsBlocked}
                      onClick={handleBankrupt}
                    >
                      <span className="hub-btn-icon">🏳️</span>
                      <span className="hub-btn-text">
                        {copy('Bankrupt', '파산 선언', 'Bancarrota')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : isHarborActive ? (
              /* Harbor Travel Selection Deck (Dice window hidden!) */
              <div className="hub-travel-panel panel-harbor" role="region" aria-label="Harbor sail controls">
                <div className="hub-travel-badge-row">
                  <span className="hub-travel-tag tag-harbor">
                    🚢 {copy('HARBOR SET SAIL', '항구 출항', 'SALIDA PUERTO')} · {rules.sailFee} Dubi
                  </span>
                  <span className="hub-travel-dest-number">
                    #{String(targetTravelSpace + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="hub-travel-prompt">
                  👆 {copy('Tap any tile on board to choose destination!', '보드판에서 가고 싶은 칸을 터치하세요!', '¡Toca una casilla en el tablero!')}
                </div>
                <div className="hub-travel-dest-card">
                  <span className="travel-dest-icon">{board[targetTravelSpace].icon}</span>
                  <div className="travel-dest-info">
                    <strong className="travel-dest-name">
                      {board[targetTravelSpace].name[lang]}
                      {board[targetTravelSpace].kind === 'tourist' && <span className="tourist-star">✦</span>}
                    </strong>
                    <span className="travel-dest-sub">
                      {targetTravelSpace < rules.harborSpace
                        ? copy(`Passing Start: +${playerStartBonus(game, activeActor)} Dubi 💰`, `출발선 통과 보너스: +${playerStartBonus(game, activeActor)} Dubi 💰`, `Cruza Salida: +${playerStartBonus(game, activeActor)} Dubi`)
                        : copy(`Selected destination: Space #${targetTravelSpace + 1}`, `선택된 목적지: #${targetTravelSpace + 1} 칸`, `Destino: Casilla #${targetTravelSpace + 1}`)}
                    </span>
                  </div>
                </div>
                <div className="hub-travel-actions">
                  <button
                    type="button"
                    className="hub-btn hub-btn-travel hub-btn-sail"
                    disabled={actionsBlocked || activePlayer.cash < rules.sailFee}
                    onClick={handleSail}
                  >
                    <span className="hub-btn-icon">🚢</span>
                    <span className="hub-btn-text">
                      #{targetTravelSpace + 1} {board[targetTravelSpace].name[lang]} {copy('Set Sail (20 Dubi)', '출항하기 (20 Dubi)', 'Zarpar (20 Dubi)')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="hub-btn hub-btn-travel-skip"
                    disabled={actionsBlocked}
                    onClick={handleSkipSail}
                  >
                    <span className="hub-btn-text">
                      {copy('Roll Dice Instead', '일반 주사위 굴리기', 'Tirar dados')}
                    </span>
                  </button>
                </div>
              </div>
            ) : isAirportActive ? (
              /* Airport Travel Selection Deck (Dice window hidden!) */
              <div className="hub-travel-panel panel-airport" role="region" aria-label="Airport flight controls">
                <div className="hub-travel-badge-row">
                  <span className="hub-travel-tag tag-airport">
                    🛫 {copy('AIRPORT FLIGHT', '공항 비행', 'VUELO AEROPUERTO')} · {rules.flightFee} Dubi
                  </span>
                  <span className="hub-travel-dest-number">
                    #{String(targetTravelSpace + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="hub-travel-prompt">
                  👆 {copy('Tap any tile on board to choose destination!', '보드판에서 가고 싶은 칸을 터치하세요!', '¡Toca una casilla en el tablero!')}
                </div>
                <div className="hub-travel-dest-card">
                  <span className="travel-dest-icon">{board[targetTravelSpace].icon}</span>
                  <div className="travel-dest-info">
                    <strong className="travel-dest-name">
                      {board[targetTravelSpace].name[lang]}
                      {board[targetTravelSpace].kind === 'tourist' && <span className="tourist-star">✦</span>}
                    </strong>
                    <span className="travel-dest-sub">
                      {targetTravelSpace <= rules.airportSpace
                        ? copy(`Passing Start: +${playerStartBonus(game, activeActor)} Dubi 💰`, `출발선 통과 보너스: +${playerStartBonus(game, activeActor)} Dubi 💰`, `Cruza Salida: +${playerStartBonus(game, activeActor)} Dubi`)
                        : copy(`Selected destination: Space #${targetTravelSpace + 1}`, `선택된 목적지: #${targetTravelSpace + 1} 칸`, `Destino: Casilla #${targetTravelSpace + 1}`)}
                    </span>
                  </div>
                </div>
                <div className="hub-travel-actions">
                  <button
                    type="button"
                    className="hub-btn hub-btn-travel hub-btn-fly"
                    disabled={actionsBlocked || activePlayer.cash < rules.flightFee}
                    onClick={handleFly}
                  >
                    <span className="hub-btn-icon">🛫</span>
                    <span className="hub-btn-text">
                      #{targetTravelSpace + 1} {board[targetTravelSpace].name[lang]} {copy('Fly Now (50 Dubi)', '비행하기 (50 Dubi)', 'Volar (50 Dubi)')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="hub-btn hub-btn-travel-skip"
                    disabled={actionsBlocked}
                    onClick={handleSkipFly}
                  >
                    <span className="hub-btn-text">
                      {copy('Skip Flight', '비행 건너뛰기', 'Saltar vuelo')}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Dice Visual Box */}
                <button
                  type="button"
                  className={`hub-dice-box ${isRolling || pendingAction === 'roll' ? 'is-dice-rolling' : ''} ${
                    game.phase === 'roll' && !actionsBlocked ? 'can-roll-clickable' : ''
                  }`}
                  disabled={actionsBlocked || game.phase !== 'roll'}
                  onClick={handleRoll}
                  title={game.phase === 'roll' ? copy('Click to roll dice', '클릭하여 주사위 굴리기', 'Toca para tirar dados') : undefined}
                >
                  <div className="hub-dice-pair">
                    {displayDice[0] > 0 ? (
                      <span className="hub-die-face">{['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][displayDice[0] - 1]}</span>
                    ) : (
                      <span className="hub-die-face">🎲</span>
                    )}
                    {displayDice[1] > 0 ? (
                      <span className="hub-die-face">{['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][displayDice[1] - 1]}</span>
                    ) : (
                      displayDice[0] > 0 && <span className="hub-die-face die-single-tag">1D</span>
                    )}
                  </div>
                  {diceSum > 0 && !isRolling && (
                    <span className={`hub-dice-sum-badge ${isDoubles ? 'badge-doubles' : ''}`}>
                      {isDoubles ? `✨ 2x${displayDice[0]}` : `${diceSum}`}
                    </span>
                  )}
                </button>

                {/* Main Action Buttons */}
                <div className="hub-action-buttons">
                  {game.phase === 'roll' && (
                    <>
                      <button
                        type="button"
                        className="hub-btn hub-btn-roll"
                        disabled={actionsBlocked}
                        onClick={handleRoll}
                      >
                        <span className="hub-btn-icon">🎲</span>
                        <span className="hub-btn-text">
                          {isRolling || pendingAction === 'roll'
                            ? copy('Rolling...', '굴리는 중...', 'Tirando...')
                            : inRest
                              ? copy('Try Doubles', '더블 도전', 'Dobles')
                              : extraRoll
                                ? copy('Roll Again! ✨', '더블! 한 번 더 굴리기 ✨', '¡Tirar de nuevo! ✨')
                                : copy('Roll Dice', '주사위 굴리기', 'Tirar dados')}
                        </span>
                      </button>
                      {inRest && (
                        <button
                          type="button"
                          className="hub-btn hub-btn-bail"
                          disabled={actionsBlocked || activePlayer.cash < rules.restFee}
                          onClick={handleBail}
                        >
                          <span className="hub-btn-icon">🗝️</span>
                          <span className="hub-btn-text">
                            {copy('Bail', '보석금', 'Fianza')} ({rules.restFee})
                          </span>
                        </button>
                      )}
                    </>
                  )}

                  {game.phase === 'choice' && (
                    <>
                      {isPendingRent && pendingPayment && (
                        <button
                          type="button"
                          className="hub-btn hub-btn-pay-rent"
                          disabled={actionsBlocked}
                          onClick={handlePayRent}
                        >
                          <span className="hub-btn-icon">💸</span>
                          <span className="hub-btn-text">
                            {copy(
                              `Pay ${pendingPayment.amount.toLocaleString()} Dubi to ${names[pendingPayment.to as number] || 'Opponent'}`,
                              `${names[pendingPayment.to as number] || '상대방'}에게 ${pendingPayment.amount.toLocaleString()} Dubi 주기`,
                              `Pagar ${pendingPayment.amount.toLocaleString()} Dubi a ${names[pendingPayment.to as number] || 'Rival'}`,
                            )}
                          </span>
                        </button>
                      )}

                      {isPendingEventActive && (
                        <button
                          type="button"
                          className={`hub-btn ${modalEffect?.kind === 'cash' && modalEffect.amount < 0 ? 'hub-btn-pay-event' : 'hub-btn-claim-event'}`}
                          disabled={actionsBlocked}
                          onClick={handleClaimEvent}
                        >
                          <span className="hub-btn-icon">{modalEffect?.kind === 'cash' && modalEffect.amount < 0 ? '💸' : '🎒'}</span>
                          <span className="hub-btn-text">
                            {modalEffect?.kind === 'move'
                              ? copy(`Move ${modalEffect.steps > 0 ? `+${modalEffect.steps}` : modalEffect.steps} Spaces`, `${modalEffect.steps > 0 ? `${modalEffect.steps}칸 전진` : `${Math.abs(modalEffect.steps)}칸 후진`}하기`, `Mover ${modalEffect.steps}`)
                              : modalEffect?.kind === 'cash'
                                ? (modalEffect.amount > 0
                                    ? copy(`Collect ${modalEffect.amount} Dubi`, `${modalEffect.amount} Dubi 받기`, `Cobrar ${modalEffect.amount} Dubi`)
                                    : copy(`Pay ${Math.abs(modalEffect.amount)} Dubi`, `${Math.abs(modalEffect.amount)} Dubi 납부하기`, `Pagar ${Math.abs(modalEffect.amount)} Dubi`))
                                : modalEffect?.kind === 'warpTourist'
                                  ? copy('Warp to Tourist Spot', '관광지로 이동', 'Ir a turismo')
                                  : copy('Confirm Event', '이벤트 확인', 'Confirmar evento')}
                          </span>
                        </button>
                      )}

                      {!pendingPayment && !pendingEvent && landedSpace?.type === 'city' && !ownedProperty && (
                        canBuy(game) ? (
                          <button
                            type="button"
                            className="hub-btn hub-btn-buy"
                            disabled={actionsBlocked}
                            onClick={handleBuy}
                          >
                            <span className="hub-btn-icon">🏗️</span>
                            <span className="hub-btn-text">
                              {copy('Buy Land', '토지 매입', 'Comprar')} ({landedSpace.price} Dubi)
                            </span>
                          </button>
                        ) : (
                          <div
                            className="hub-btn hub-btn-shortfall"
                            title={copy(
                              `Price: ${landedSpace.price} Dubi · Short by ${(landedSpace.price ?? 0) - activePlayer.cash} Dubi`,
                              `매입가 ${landedSpace.price} Dubi · ${(landedSpace.price ?? 0) - activePlayer.cash} Dubi 부족`,
                              `Precio: ${landedSpace.price} Dubi · Faltan ${(landedSpace.price ?? 0) - activePlayer.cash} Dubi`,
                            )}
                          >
                            <span className="hub-btn-icon">⚠️</span>
                            <span className="hub-btn-text">
                              {copy('Cannot Buy', '매입 불가', 'No disponible')} ({landedSpace.price} Dubi · <span className="shortfall-sub">{copy(`-${(landedSpace.price ?? 0) - activePlayer.cash} Dubi`, `${(landedSpace.price ?? 0) - activePlayer.cash} 부족`, `-${(landedSpace.price ?? 0) - activePlayer.cash}`)}</span>)
                            </span>
                          </div>
                        )
                      )}

                      {!pendingPayment && !pendingEvent && landedSpace?.type === 'city' && ownedProperty && !isTourist && (
                        (ownedProperty.level ?? 0) < 3 ? (
                          canUpgrade(game) ? (
                            <button
                              type="button"
                              className="hub-btn hub-btn-upgrade"
                              disabled={actionsBlocked}
                              onClick={handleUpgrade}
                            >
                              <span className="hub-btn-icon">🔨</span>
                              <span className="hub-btn-text">
                                {copy('Upgrade', '증축', 'Mejorar')} Lv.{(ownedProperty.level ?? 0) + 1} ({landedSpace.upgrade} Dubi)
                              </span>
                            </button>
                          ) : (
                            <div
                              className="hub-btn hub-btn-shortfall"
                              title={copy(
                                `Upgrade: ${landedSpace.upgrade} Dubi · Short by ${(landedSpace.upgrade ?? 0) - activePlayer.cash} Dubi`,
                                `증축비 ${landedSpace.upgrade} Dubi · ${(landedSpace.upgrade ?? 0) - activePlayer.cash} Dubi 부족`,
                                `Mejora: ${landedSpace.upgrade} Dubi · Faltan ${(landedSpace.upgrade ?? 0) - activePlayer.cash} Dubi`,
                              )}
                            >
                              <span className="hub-btn-icon">⚠️</span>
                              <span className="hub-btn-text">
                                {copy('Cannot Upgrade', '증축 불가', 'Sin fondos')} Lv.{(ownedProperty.level ?? 0) + 1} ({landedSpace.upgrade} Dubi · <span className="shortfall-sub">{copy(`-${(landedSpace.upgrade ?? 0) - activePlayer.cash} Dubi`, `${(landedSpace.upgrade ?? 0) - activePlayer.cash} 부족`, `-${(landedSpace.upgrade ?? 0) - activePlayer.cash}`)}</span>)
                              </span>
                            </div>
                          )
                        ) : null
                      )}

                      {!pendingPayment && !pendingEvent && landedSpace?.type === 'city' && ownedProperty && (ownedProperty.level ?? 0) >= 3 && !isTourist && (
                        <span className="hub-landmark-chip">
                          👑 {copy('Landmark Max', '최고 등급', 'Monumento Máx')}
                        </span>
                      )}

                      {!pendingPayment && !pendingEvent && (
                        <button
                          type="button"
                          className={`hub-btn hub-btn-end ${endEmphasized ? 'hub-btn-end-primary' : 'hub-btn-end-outline'}`}
                          disabled={actionsBlocked}
                          onClick={handleEndTurn}
                        >
                          <span className="hub-btn-text">
                            {extraRoll
                              ? copy('Skip Roll', '더블 포기', 'Pasar')
                              : hasPropertyAction
                                ? copy('Skip', '건너뛰기', 'Pasar')
                                : copy('End Turn', '턴 종료', 'Fin de turno')}
                          </span>
                          <span className="hub-btn-arrow">➔</span>
                        </button>
                      )}
                    </>
                  )}

                  {game.phase === 'end' && (
                    <button
                      type="button"
                      className="hub-btn hub-btn-end hub-btn-end-primary"
                      disabled={actionsBlocked}
                      onClick={handleEndTurn}
                    >
                      <span className="hub-btn-text">
                        {extraRoll
                          ? copy('Skip Roll', '더블 포기', 'Pasar')
                          : copy('End Turn', '턴 종료', 'Fin de turno')}
                      </span>
                      <span className="hub-btn-arrow">➔</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main 3-Hub Arena */}
      <div className="hub-main-arena">
        {/* Player 1 Card (Blue) */}
        <div
          className={`hub-player-card hub-card-0 ${
            game.current === 0 && game.phase !== 'finished' ? 'hub-active-turn' : ''
          } ${roomToken && myPlayerIndex === 0 ? 'hub-is-me' : ''} ${
            isP0Sending ? 'is-sending-cash' : ''
          } ${isP0Receiving ? 'is-receiving-cash' : ''}`}
        >
          <div className="hub-card-header">
            <div className="hub-avatar-box avatar-box-0">
              <span className="hub-avatar-icon" role="img" aria-label="Player 1 avatar">
                🐱
              </span>
              <span className="hub-avatar-accessory">🧢</span>
            </div>
            <div className="hub-player-meta">
              <div className="hub-name-row">
                <span className="hub-pbadge pbadge-0">● P1</span>
                {roomToken && myPlayerIndex === 0 && (
                  <span className="hub-you-chip">{copy('YOU', '나', 'TÚ')}</span>
                )}
              </div>
              <strong className="hub-player-name" title={names[0]}>
                {names[0] || 'Player 1'}
              </strong>
            </div>
          </div>

          <div className="hub-cash-panel">
            <div className="hub-cash-line">
              <span className="hub-cash-icon">💰</span>
              <span className="hub-cash-num">{p0.cash.toLocaleString()}</span>
              <small className="hub-cash-unit">Dubi</small>
            </div>
            <div className="hub-deltas-container">
              {cashDeltas[0]?.map((d) => (
                <span
                  key={d.id}
                  className={`hub-delta-tag ${d.amount > 0 ? 'is-gain' : 'is-loss'}`}
                >
                  {d.text}
                </span>
              ))}
            </div>
          </div>

          <div className="hub-assets-line">
            <span>{copy('Assets', '총자산', 'Activos')}:</span>
            <strong>{assets(game, 0 as PlayerId).toLocaleString()} Dubi</strong>
          </div>

          {/* Buffs and Status Chips */}
          <div className="hub-buffs-list">
            {p0.startBonusBonus && p0.startBonusBonus > 0 ? (
              <span
                className="hub-buff-badge buff-salary"
                title={copy('Start Bonus', '출발 보너스', 'Bono Salida')}
              >
                💼 +{p0.startBonusBonus}
              </span>
            ) : null}
            {p0.nextRollModifier === 'single' ? (
              <span
                className="hub-buff-badge buff-single"
                title={copy('Single Die', '주사위 1개', '1 Dado')}
              >
                🚶 1 Die
              </span>
            ) : null}
            {p0.nextRollModifier === 'doubles' ? (
              <span
                className="hub-buff-badge buff-doubles"
                title={copy('Guaranteed Doubles', '더블 확정', 'Dobles')}
              >
                ✨ Doubles
              </span>
            ) : null}
            {p0.freePasses && p0.freePasses > 0 ? (
              <span
                className="hub-buff-badge buff-pass"
                title={copy('Free Pass', '면제권', 'Pase Libre')}
              >
                🎫 ×{p0.freePasses}
              </span>
            ) : null}
          </div>
        </div>

        {/* Central Dubi Bank */}
        <div
          className={`hub-bank-card ${bankActive ? 'bank-flash-active' : ''} ${
            isBankSending ? 'bank-is-sending' : ''
          } ${isBankReceiving ? 'bank-is-receiving' : ''}`}
          role="region"
          aria-label="Dubi Central Bank"
        >
          <div className="bank-pediment">🏛️</div>
          <div className="bank-vault-visual">
            <div className="vault-glow-ring" />
            <img
              className="bank-mascot-img"
              src="/dubu-mascot.png"
              alt="Dubu Chief Banker"
            />
            <span className="bank-teller-badge">👔 🏦</span>
          </div>
          <div className="bank-name-plate">
            <strong>DUBI BANK</strong>
            <small>{copy('Central Bank', '두비 중앙은행', 'Banco Central')}</small>
          </div>
          <div className="bank-treasury-status">
            <span className="bank-sparkle">✨</span>
            <span>{copy('Treasury Vault', '국고 금고', 'Bóveda')}</span>
            <span className="bank-sparkle">✨</span>
          </div>
        </div>

        {/* Player 2 Card (Red) */}
        <div
          className={`hub-player-card hub-card-1 ${
            game.current === 1 && game.phase !== 'finished' ? 'hub-active-turn' : ''
          } ${roomToken && myPlayerIndex === 1 ? 'hub-is-me' : ''} ${
            isP1Sending ? 'is-sending-cash' : ''
          } ${isP1Receiving ? 'is-receiving-cash' : ''}`}
        >
          <div className="hub-card-header">
            <div className="hub-avatar-box avatar-box-1">
              <span className="hub-avatar-icon" role="img" aria-label="Player 2 avatar">
                🐱
              </span>
              <span className="hub-avatar-accessory">🧣</span>
            </div>
            <div className="hub-player-meta">
              <div className="hub-name-row">
                <span className="hub-pbadge pbadge-1">◆ P2</span>
                {roomToken && myPlayerIndex === 1 && (
                  <span className="hub-you-chip">{copy('YOU', '나', 'TÚ')}</span>
                )}
              </div>
              <strong className="hub-player-name" title={names[1]}>
                {names[1] || 'Player 2'}
              </strong>
            </div>
          </div>

          <div className="hub-cash-panel">
            <div className="hub-cash-line">
              <span className="hub-cash-icon">💰</span>
              <span className="hub-cash-num">{p1.cash.toLocaleString()}</span>
              <small className="hub-cash-unit">Dubi</small>
            </div>
            <div className="hub-deltas-container">
              {cashDeltas[1]?.map((d) => (
                <span
                  key={d.id}
                  className={`hub-delta-tag ${d.amount > 0 ? 'is-gain' : 'is-loss'}`}
                >
                  {d.text}
                </span>
              ))}
            </div>
          </div>

          <div className="hub-assets-line">
            <span>{copy('Assets', '총자산', 'Activos')}:</span>
            <strong>{assets(game, 1 as PlayerId).toLocaleString()} Dubi</strong>
          </div>

          {/* Buffs and Status Chips */}
          <div className="hub-buffs-list">
            {p1.startBonusBonus && p1.startBonusBonus > 0 ? (
              <span
                className="hub-buff-badge buff-salary"
                title={copy('Start Bonus', '출발 보너스', 'Bono Salida')}
              >
                💼 +{p1.startBonusBonus}
              </span>
            ) : null}
            {p1.nextRollModifier === 'single' ? (
              <span
                className="hub-buff-badge buff-single"
                title={copy('Single Die', '주사위 1개', '1 Dado')}
              >
                🚶 1 Die
              </span>
            ) : null}
            {p1.nextRollModifier === 'doubles' ? (
              <span
                className="hub-buff-badge buff-doubles"
                title={copy('Guaranteed Doubles', '더블 확정', 'Dobles')}
              >
                ✨ Doubles
              </span>
            ) : null}
            {p1.freePasses && p1.freePasses > 0 ? (
              <span
                className="hub-buff-badge buff-pass"
                title={copy('Free Pass', '면제권', 'Pase Libre')}
              >
                🎫 ×{p1.freePasses}
              </span>
            ) : null}
          </div>
        </div>

        {/* Active Money Transfer Flow Layer */}
        {activeTransfer && (
          <div
            key={activeTransfer.id}
            className={`hub-transfer-layer burst-${activeTransfer.from}-to-${activeTransfer.to}`}
            aria-hidden="true"
          >
            {/* SVG Directional Flow Arc */}
            <svg
              className="transfer-svg-canvas"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="flowGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <marker
                  id="flowArrowhead"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                </marker>
              </defs>

              {activeTransfer.from === 'p0' && activeTransfer.to === 'p1' && (
                <path
                  d="M 18.5 50 Q 50 -2 81.5 50"
                  className="svg-flow-path"
                  markerEnd="url(#flowArrowhead)"
                />
              )}
              {activeTransfer.from === 'p1' && activeTransfer.to === 'p0' && (
                <path
                  d="M 81.5 50 Q 50 -2 18.5 50"
                  className="svg-flow-path svg-flow-reverse"
                  markerEnd="url(#flowArrowhead)"
                />
              )}
              {activeTransfer.from === 'bank' && activeTransfer.to === 'p0' && (
                <path
                  d="M 50 45 Q 30 16 18.5 50"
                  className="svg-flow-path"
                  markerEnd="url(#flowArrowhead)"
                />
              )}
              {activeTransfer.from === 'bank' && activeTransfer.to === 'p1' && (
                <path
                  d="M 50 45 Q 70 16 81.5 50"
                  className="svg-flow-path"
                  markerEnd="url(#flowArrowhead)"
                />
              )}
              {activeTransfer.from === 'p0' && activeTransfer.to === 'bank' && (
                <path
                  d="M 18.5 50 Q 30 18 50 45"
                  className="svg-flow-path"
                  markerEnd="url(#flowArrowhead)"
                />
              )}
              {activeTransfer.from === 'p1' && activeTransfer.to === 'bank' && (
                <path
                  d="M 81.5 50 Q 70 18 50 45"
                  className="svg-flow-path"
                  markerEnd="url(#flowArrowhead)"
                />
              )}
            </svg>

            {/* Flying Coins & Cash Stream */}
            <div className="hub-coins-flight-container">
              <span className="flying-money money-1">🪙</span>
              <span className="flying-money money-2">💵</span>
              <span className="flying-money money-3">🪙</span>
              <span className="flying-money money-4">💰</span>
              <span className="flying-money money-5">✨</span>
              <span className="flying-money money-6">🪙</span>
              <span className="flying-money money-7">💵</span>
              <span className="flying-money money-8">⭐</span>
            </div>

            {/* Impact Sparkle Burst at Destination */}
            <div className={`hub-impact-burst impact-target-${activeTransfer.to}`}>
              <span className="impact-star star-1">✨</span>
              <span className="impact-star star-2">💥</span>
              <span className="impact-star star-3">⭐</span>
              <span className="impact-star star-4">✨</span>
            </div>

            {/* Floating Delta Badges on Cards */}
            <div className={`flow-floating-delta delta-from-${activeTransfer.from}`}>
              -{activeTransfer.amount.toLocaleString()} 💸
            </div>
            <div className={`flow-floating-delta delta-to-${activeTransfer.to}`}>
              +{activeTransfer.amount.toLocaleString()} 💰
            </div>
          </div>
        )}
      </div>

      {/* Travel Event Popup Modal inside Board */}
      {isPendingEventActive && modalEvent && modalEffect && (
        <div className="hub-event-popup-overlay" role="dialog" aria-modal="true" aria-label="Travel event announcement">
          <div className="hub-event-popup-card">
            <div className="hub-event-popup-header">
              <span className="hub-event-popup-badge">
                🎒 {copy('TRAVEL EVENT', '여행 이벤트', 'EVENTO DE VIAJE')} · #{(currentEventIdx ?? 0) + 1}
              </span>
              <span className="hub-event-hero-icon">{modalEvent.icon ?? '🎒'}</span>
            </div>
            <h3 className="hub-event-popup-title">{modalEvent.text[lang]}</h3>
            <div className="hub-event-popup-details">
              {modalEffect.kind === 'move' && (
                <div className="hub-event-effect-badge badge-move">
                  <span className="effect-icon">🚂</span>
                  <span className="effect-text">
                    {modalEffect.steps > 0
                      ? copy(
                          `Advance ${modalEffect.steps} spaces to [${board[((activePos + modalEffect.steps) % 40 + 40) % 40]?.name[lang]}]`,
                          `앞으로 ${modalEffect.steps}칸 전진 ➔ [${board[((activePos + modalEffect.steps) % 40 + 40) % 40]?.name[lang]}] 도착`,
                          `Avanza ${modalEffect.steps} casillas a [${board[((activePos + modalEffect.steps) % 40 + 40) % 40]?.name[lang]}]`,
                        )
                      : copy(
                          `Move back ${Math.abs(modalEffect.steps)} spaces to [${board[((activePos + modalEffect.steps) % 40 + 40) % 40]?.name[lang]}]`,
                          `뒤로 ${Math.abs(modalEffect.steps)}칸 후진 ➔ [${board[((activePos + modalEffect.steps) % 40 + 40) % 40]?.name[lang]}] 도착`,
                          `Retrocede ${Math.abs(modalEffect.steps)} casillas`,
                        )}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'cash' && (
                <div className={`hub-event-effect-badge ${modalEffect.amount > 0 ? 'badge-gain' : 'badge-loss'}`}>
                  <span className="effect-icon">{modalEffect.amount > 0 ? '💰' : '💸'}</span>
                  <span className="effect-text">
                    {modalEffect.amount > 0
                      ? `+${modalEffect.amount.toLocaleString()} Dubi ${copy('Bonus reward', '보너스 획득', 'Recompensa')}`
                      : `${modalEffect.amount.toLocaleString()} Dubi ${copy('Penalty payment', '범칙금 납부', 'Multa')}`}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'warpTourist' && (
                <div className="hub-event-effect-badge badge-warp">
                  <span className="effect-icon">📸</span>
                  <span className="effect-text">
                    {copy('Warp directly to nearest Tourist Destination!', '가장 가까운 명품 관광지로 즉시 직행!', '¡Viaje directo al destino turístico más cercano!')}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'startBonus' && (
                <div className="hub-event-effect-badge badge-buff">
                  <span className="effect-icon">💼</span>
                  <span className="effect-text">
                    {copy(`Salary bonus permanently +${modalEffect.amount} Dubi per lap!`, `출발선 통과 월급 +${modalEffect.amount} Dubi 영구 인상!`, `¡Salario +${modalEffect.amount} Dubi por vuelta!`)}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'guaranteedDoubles' && (
                <div className="hub-event-effect-badge badge-buff">
                  <span className="effect-icon">✨</span>
                  <span className="effect-text">
                    {copy('Guaranteed Doubles on next dice roll!', '다음 턴 확정 더블 찬스 획득!', '¡Dobles garantizados!')}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'freePass' && (
                <div className="hub-event-effect-badge badge-buff">
                  <span className="effect-icon">🎫</span>
                  <span className="effect-text">
                    {copy('Free Pass x1 received! Next opponent toll is free.', '통행료 면제권 1장 획득! (다음 방문 시 무료)', '¡Pase de peaje gratis!')}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'freeUpgrade' && (
                <div className="hub-event-effect-badge badge-buff">
                  <span className="effect-icon">🏗️</span>
                  <span className="effect-text">
                    {copy('Free 1-level building upgrade coupon!', '소유 도시 1단계 무료 증축 혜택 획득!', '¡Mejora de 1 nivel gratis!')}
                  </span>
                </div>
              )}
              {modalEffect.kind === 'singleDie' && (
                <div className="hub-event-effect-badge badge-buff">
                  <span className="effect-icon">🚶</span>
                  <span className="effect-text">
                    {copy('Single Die restriction on next turn (1~6 spaces)', '다음 턴 주사위 1개만 굴림 (1~6칸 이동)', 'Tirar solo 1 dado')}
                  </span>
                </div>
              )}
            </div>

            <div className="hub-event-popup-actions">
              {isMyTurn ? (
                <button
                  type="button"
                  className={`hub-event-confirm-btn btn-effect-${modalEffect.kind} ${modalEffect.kind === 'cash' && modalEffect.amount < 0 ? 'btn-cash-loss' : ''}`}
                  disabled={actionsBlocked}
                  onClick={handleClaimEvent}
                >
                  {modalEffect.kind === 'move' && (
                    <>
                      <span className="btn-icon">🚂</span>
                      <span>
                        {modalEffect.steps > 0
                          ? copy(`Advance ${modalEffect.steps} Spaces ➔`, `${modalEffect.steps}칸 전진하기 ➔`, `Avanzar ${modalEffect.steps} casillas ➔`)
                          : copy(`Move Back ${Math.abs(modalEffect.steps)} Spaces ➔`, `${Math.abs(modalEffect.steps)}칸 후진하기 ➔`, `Retroceder ${Math.abs(modalEffect.steps)} casillas ➔`)}
                      </span>
                    </>
                  )}
                  {modalEffect.kind === 'cash' && modalEffect.amount > 0 && (
                    <>
                      <span className="btn-icon">💰</span>
                      <span>{copy(`Collect ${modalEffect.amount.toLocaleString()} Dubi`, `${modalEffect.amount.toLocaleString()} Dubi 받기`, `Cobrar ${modalEffect.amount.toLocaleString()} Dubi`)}</span>
                    </>
                  )}
                  {modalEffect.kind === 'cash' && modalEffect.amount < 0 && (
                    <>
                      <span className="btn-icon">💸</span>
                      <span>{copy(`Pay ${Math.abs(modalEffect.amount).toLocaleString()} Dubi`, `${Math.abs(modalEffect.amount).toLocaleString()} Dubi 납부하기`, `Pagar ${Math.abs(modalEffect.amount).toLocaleString()} Dubi`)}</span>
                    </>
                  )}
                  {modalEffect.kind === 'warpTourist' && (
                    <>
                      <span className="btn-icon">📸</span>
                      <span>{copy('Warp to Tourist Destination ➔', '관광지로 직행하기 ➔', 'Ir a turismo ➔')}</span>
                    </>
                  )}
                  {!['move', 'cash', 'warpTourist'].includes(modalEffect.kind) && (
                    <>
                      <span className="btn-icon">✨</span>
                      <span>{copy('Confirm & Continue ➔', '확인하고 계속하기 ➔', 'Confirmar y Continuar ➔')}</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="hub-event-waiting-badge">
                  <span className="waiting-spinner">⏳</span>
                  <span>{copy(`Waiting for ${names[game.current] || 'Opponent'} to confirm...`, `${names[game.current] || '상대방'} 플레이어가 확인 중입니다...`, `Esperando confirmación...`)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Travel Event Display */}
      {!isPendingEventActive && activeEvent && activeEffect && (
        <div className="hub-event-card" role="status" aria-label="Travel event announcement">
          <div className="hub-event-top">
            <span className="hub-event-tag">{activeEvent.icon ?? '🎒'} {copy('Travel Event', '여행 이벤트', 'Evento')}</span>
            <span className="hub-event-number">#{game.lastEvent! + 1}</span>
          </div>
          <p className="hub-event-desc">{activeEvent.text[lang]}</p>
          <div className="hub-event-effect">
            {activeEffect.kind === 'cash' && (
              <span className={`hub-event-pill ${activeEffect.amount > 0 ? 'pill-gain' : 'pill-loss'}`}>
                {activeEffect.amount > 0
                  ? `+${activeEffect.amount} Dubi 💰`
                  : `${activeEffect.amount} Dubi 💸`}
              </span>
            )}
            {activeEffect.kind === 'startBonus' && (
              <span className="hub-event-pill pill-buff">💼 {copy('Salary +', '월급 +', 'Salario +')}{activeEffect.amount} Dubi</span>
            )}
            {activeEffect.kind === 'singleDie' && (
              <span className="hub-event-pill pill-buff">🚶 {copy('1 Die Next Roll', '다음 주사위 1개', '1 Dado')}</span>
            )}
            {activeEffect.kind === 'guaranteedDoubles' && (
              <span className="hub-event-pill pill-buff">✨ {copy('Guaranteed Doubles', '확정 더블', 'Dobles')}</span>
            )}
            {activeEffect.kind === 'freePass' && (
              <span className="hub-event-pill pill-buff">🎫 {copy('Free Pass x1', '통행료 면제권', 'Pase')}</span>
            )}
            {activeEffect.kind === 'freeUpgrade' && (
              <span className="hub-event-pill pill-buff">🏗️ {copy('Free Upgrade', '무료 1단계 증축', 'Mejora')}</span>
            )}
            {activeEffect.kind === 'warpTourist' && (
              <span className="hub-event-pill pill-buff">📸 {copy('Tourist Warp', '관광지 직행', 'Destino Turístico')}</span>
            )}
            {activeEffect.kind === 'move' && (
              <span className="hub-event-pill pill-move">
                {activeEffect.steps > 0
                  ? `🚀 +${activeEffect.steps} ${copy('steps', '칸 전진', 'casillas')}`
                  : `🔙 ${activeEffect.steps} ${copy('steps', '칸 후진', 'casillas')}`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
