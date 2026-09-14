'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Game, PlayerId } from '../../lib/game';
import { assets, rules } from '../../lib/game';
import { events } from '../../lib/events';
import type { Lang } from '../../lib/board';
import { sound } from '../../lib/audio';

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
  const [transfers, setTransfers] = useState<MoneyTransfer[]>([]);
  const [bankActive, setBankActive] = useState(false);
  const lastProcessedLog = useRef(game.logs.length);
  const nextTransferId = useRef(1);

  const copy = (en: string, ko: string, es: string) =>
    lang === 'ko' ? ko : lang === 'es' ? es : en;

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
        sound.playCoin();
        setTransfers((prev) => [...prev, ...discoveredTransfers]);

        // Check if bank was involved
        const touchesBank = discoveredTransfers.some(
          (t) => t.from === 'bank' || t.to === 'bank',
        );
        if (touchesBank) {
          setBankActive(true);
          setTimeout(() => setBankActive(false), 1400);
        }

        // Clean up each transfer after 1.5s
        for (const t of discoveredTransfers) {
          setTimeout(() => {
            setTransfers((prev) => prev.filter((item) => item.id !== t.id));
          }, 1500);
        }
      }
    }
  }, [game.logs, copy]);

  const p0 = game.players[0];
  const p1 = game.players[1];
  const activeEvent = game.lastEvent !== null ? events[game.lastEvent] : null;
  const activeEffect = activeEvent?.effect;

  const getSenderName = (from: 'p0' | 'p1' | 'bank') => {
    if (from === 'p0') return names[0] || 'Player 1';
    if (from === 'p1') return names[1] || 'Player 2';
    return copy('Bank', '두비은행', 'Banco');
  };

  const getReceiverName = (to: 'p0' | 'p1' | 'bank') => {
    if (to === 'p0') return names[0] || 'Player 1';
    if (to === 'p1') return names[1] || 'Player 2';
    return copy('Bank', '두비은행', 'Banco');
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
        <div className="hub-route-subtitle">🇰🇷 SEOUL ↔ LIMA 🇵🇪</div>
      </div>

      {/* Main 3-Hub Arena */}
      <div className="hub-main-arena">
        {/* Player 1 Card (Blue) */}
        <div
          className={`hub-player-card hub-card-0 ${
            game.current === 0 && game.phase !== 'finished' ? 'hub-active-turn' : ''
          } ${roomToken && myPlayerIndex === 0 ? 'hub-is-me' : ''}`}
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
          className={`hub-bank-card ${bankActive ? 'bank-flash-active' : ''}`}
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
          } ${roomToken && myPlayerIndex === 1 ? 'hub-is-me' : ''}`}
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

      {/* Money Transfer Flying FX Layer */}
      <div className="hub-transfer-layer">
        {transfers.map((tf) => (
          <div key={tf.id} className={`hub-transfer-burst burst-${tf.from}-to-${tf.to}`}>
            {/* 4 Staggered Flying Coins */}
            <div className="flying-coin coin-1">🪙</div>
            <div className="flying-coin coin-2">🪙</div>
            <div className="flying-coin coin-3">🪙</div>
            <div className="flying-coin coin-4">💵</div>

            {/* Central Transfer Notification Pill */}
            <div className="hub-transfer-pill">
              <span className="transfer-pill-icon">{tf.icon}</span>
              <span className="transfer-pill-names">
                {getSenderName(tf.from)} ➔ {getReceiverName(tf.to)}
              </span>
              <strong className="transfer-pill-amount">
                {tf.amount.toLocaleString()} Dubi
              </strong>
              <span className="transfer-pill-reason">({tf.reason})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
