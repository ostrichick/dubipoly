'use client';

import { useEffect } from 'react';
import { events } from '../../lib/events';
import type { Lang } from '../../lib/board';

interface EventCardModalProps {
  eventIndex: number | null;
  lang: Lang;
  onClose: () => void;
}

export function EventCardModal({ eventIndex, lang, onClose }: EventCardModalProps) {
  useEffect(() => {
    if (eventIndex === null) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3200);
    return () => clearTimeout(timer);
  }, [eventIndex, onClose]);

  if (eventIndex === null || !events[eventIndex]) return null;

  const item = events[eventIndex];
  const isPositive =
    item.effect.kind === 'cash'
      ? item.effect.amount > 0
      : item.effect.kind === 'move'
        ? item.effect.steps > 0
        : true;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50/90 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Ticket punch hole decorations */}
        <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black/55" />
        <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black/55" />

        {/* Dynamic Cash Burst Particles */}
        {item.effect.kind === 'cash' && isPositive && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute left-1/4 top-1/3 text-2xl animate-[coin-fountain_1.8s_ease-out_infinite]" style={{ animationDelay: '0.1s' }}>🪙</span>
            <span className="absolute left-1/2 top-1/4 text-3xl animate-[coin-fountain_1.8s_ease-out_infinite]" style={{ animationDelay: '0.3s' }}>💰</span>
            <span className="absolute right-1/4 top-1/3 text-2xl animate-[coin-fountain_1.8s_ease-out_infinite]" style={{ animationDelay: '0.5s' }}>✨</span>
            <span className="absolute left-1/3 top-2/3 text-xl animate-[coin-fountain_1.8s_ease-out_infinite]" style={{ animationDelay: '0.7s' }}>🪙</span>
            <span className="absolute right-1/3 top-2/3 text-2xl animate-[coin-fountain_1.8s_ease-out_infinite]" style={{ animationDelay: '0.4s' }}>✨</span>
          </div>
        )}
        {item.effect.kind === 'cash' && !isPositive && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute left-1/4 top-1/4 text-2xl animate-[cash-drop_2s_ease-in_infinite]" style={{ animationDelay: '0.1s' }}>💸</span>
            <span className="absolute left-1/2 top-1/3 text-2xl animate-[cash-drop_2s_ease-in_infinite]" style={{ animationDelay: '0.4s' }}>💸</span>
            <span className="absolute right-1/4 top-1/4 text-3xl animate-[cash-drop_2s_ease-in_infinite]" style={{ animationDelay: '0.6s' }}>💨</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-dashed border-amber-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✈️</span>
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-amber-600 uppercase">
                {lang === 'ko' ? '여행 행운권' : lang === 'es' ? 'Boleto de Viaje' : 'Travel Boarding Pass'}
              </p>
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'ko' ? '특별 여행 이벤트' : lang === 'es' ? 'Evento Especial' : 'Special Travel Event'}
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">
            #{eventIndex + 1}
          </span>
        </div>

        {/* Body */}
        <div className="py-5 text-center relative z-10">
          <div className="mb-3 text-4xl animate-bounce">🎒</div>
          <p className="text-base font-bold text-slate-900 leading-snug px-2">
            {item.text[lang]}
          </p>

          {/* Effect Badge */}
          <div className="mt-5 flex justify-center">
            {item.effect.kind === 'cash' && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-base font-black shadow-md transition-all ${
                  isPositive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200 animate-pulse'
                    : 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-200 animate-pulse'
                }`}
              >
                {item.effect.amount > 0 ? `+${item.effect.amount} Dubi 💰` : `${item.effect.amount} Dubi 💸`}
              </span>
            )}
            {item.effect.kind === 'move' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1.5 text-base font-black text-white shadow-md shadow-blue-200">
                {item.effect.steps > 0 ? `+${item.effect.steps} ` : `${item.effect.steps} `}
                {lang === 'ko' ? '칸 이동 🏃' : lang === 'es' ? 'pasos 🏃' : 'steps 🏃'}
              </span>
            )}
            {item.effect.kind === 'startBonus' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-1.5 text-base font-black text-white shadow-md shadow-amber-200 animate-pulse">
                💼 +{item.effect.amount} Dubi {lang === 'ko' ? '월급 영구 인상!' : lang === 'es' ? '¡Sueldo aumentado!' : 'Salary Boost!'}
              </span>
            )}
            {item.effect.kind === 'singleDie' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-1.5 text-base font-black text-white shadow-md shadow-indigo-200">
                🚶 {lang === 'ko' ? '다음 턴 주사위 1개 (1~6)' : lang === 'es' ? 'Próximo turno 1 dado' : '1 Die Next Turn'}
              </span>
            )}
            {item.effect.kind === 'guaranteedDoubles' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-1.5 text-base font-black text-white shadow-md shadow-purple-200 animate-pulse">
                🎲✨ {lang === 'ko' ? '다음 주사위 100% 더블!' : lang === 'es' ? '¡Dobles 100% garantizados!' : 'Guaranteed Doubles!'}
              </span>
            )}
            {item.effect.kind === 'freePass' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-1.5 text-base font-black text-white shadow-md shadow-emerald-200">
                🎫 {lang === 'ko' ? 'VIP 통행료 1회 면제권' : lang === 'es' ? 'Pase VIP sin alquiler' : 'VIP Free Rent Pass'}
              </span>
            )}
            {item.effect.kind === 'freeUpgrade' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-1.5 text-base font-black text-white shadow-md shadow-orange-200 animate-pulse">
                🏗️ {lang === 'ko' ? '도시 건물 무료 1단계 증축' : lang === 'es' ? 'Mejora de edificio gratis' : 'Free Building Upgrade'}
              </span>
            )}
            {item.effect.kind === 'warpTourist' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-1.5 text-base font-black text-white shadow-md shadow-teal-200">
                📸 {lang === 'ko' ? '가장 가까운 관광지로 직행!' : lang === 'es' ? '¡Vuelo directo a destino turístico!' : 'Direct Tourist Flight!'}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-amber-200 pt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900"
          >
            {lang === 'ko' ? '화면을 탭하여 계속하기 ✕' : lang === 'es' ? 'Toca para continuar ✕' : 'Tap to continue ✕'}
          </button>
        </div>
      </div>
    </div>
  );
}
