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
    }, 2800);
    return () => clearTimeout(timer);
  }, [eventIndex, onClose]);

  if (eventIndex === null || !events[eventIndex]) return null;

  const item = events[eventIndex];
  const isPositive = item.effect.kind === 'cash' ? item.effect.amount > 0 : item.effect.steps > 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50/80 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Ticket punch hole decorations */}
        <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black/50" />
        <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black/50" />

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
        <div className="py-5 text-center">
          <div className="mb-3 text-4xl animate-bounce">🎒</div>
          <p className="text-base font-bold text-slate-900 leading-snug px-2">
            {item.text[lang]}
          </p>

          {/* Effect Badge */}
          <div className="mt-4 flex justify-center">
            {item.effect.kind === 'cash' ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black shadow-sm ${
                  isPositive
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {item.effect.amount > 0 ? `+${item.effect.amount} Dubi 💸` : `${item.effect.amount} Dubi 💸`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-black text-blue-800 border border-blue-300 shadow-sm">
                {item.effect.steps > 0 ? `+${item.effect.steps} ` : `${item.effect.steps} `}
                {lang === 'ko' ? '칸 이동 🏃' : lang === 'es' ? 'pasos 🏃' : 'steps 🏃'}
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
