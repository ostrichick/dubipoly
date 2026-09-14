'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Game, PlayerId } from '../../lib/game';
import { assets, rules } from '../../lib/game';
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

interface BoardCenterHubProps {
  game: Game;
  names: [string, string];
  cashDeltas: [CashDelta[], CashDelta[]];
  roomToken: string | null;
  myPlayerIndex: number;
  lang: Lang;
}

export function BoardCenterHub({
  game,
  names,
  cashDeltas,
  roomToken,
  myPlayerIndex,
  lang,
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

  const getSenderName = (from: 'p0' | 'p1' | 'bank') => {
    if (from === 'p0') return names[0] || (lang === 'ko' ? '여행자 1' : lang === 'es' ? 'Viajero 1' : 'Player 1');
    if (from === 'p1') return names[1] || (lang === 'ko' ? '여행자 2' : lang === 'es' ? 'Viajero 2' : 'Player 2');
    return copy('Dubi Bank', '두비은행', 'Banco');
  };

  const getReceiverName = (to: 'p0' | 'p1' | 'bank') => {
    if (to === 'p0') return names[0] || (lang === 'ko' ? '여행자 1' : lang === 'es' ? 'Viajero 1' : 'Player 1');
    if (to === 'p1') return names[1] || (lang === 'ko' ? '여행자 2' : lang === 'es' ? 'Viajero 2' : 'Player 2');
    return copy('Dubi Bank', '두비은행', 'Banco');
  };

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

        {/* Active Money Transfer Flow Layer (Overlaid perfectly on top of the 3 cards!) */}
        {activeTransfer && (
          <div
            key={activeTransfer.id}
            className={`hub-transfer-layer burst-${activeTransfer.from}-to-${activeTransfer.to}`}
            aria-hidden="true"
          >
            {/* SVG Directional Flow Arc & Glowing Dash */}
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

              {/* Arcs tailored to exact card centers */}
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

            {/* 8 Staggered Flying Coins & Cash Stream */}
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

      {/* Travel Event Display (Directly on the Board Center!) */}
      {activeEvent && activeEffect && (
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
