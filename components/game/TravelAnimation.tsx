'use client';

import { useEffect } from 'react';
import type { Lang } from '../../lib/board';

export type TravelMode = 'flight' | 'sail';

interface TravelAnimationProps {
  mode: TravelMode | null;
  fromSpace: number;
  toSpace: number;
  toName: string;
  lang: Lang;
  onComplete: () => void;
}

export function TravelAnimation({
  mode,
  toName,
  lang,
  onComplete,
}: TravelAnimationProps) {
  useEffect(() => {
    if (!mode) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 2200);
    return () => clearTimeout(timer);
  }, [mode, onComplete]);

  if (!mode) return null;

  const isFlight = mode === 'flight';

  return (
    <div
      onClick={onComplete}
      className="travel-board-center-overlay"
      role="status"
      aria-label={isFlight ? 'Flight animation' : 'Sailing animation'}
    >
      <div className="relative flex flex-col items-center w-full text-center">
        {isFlight ? (
          <>
            {/* Drifting Cloud particles */}
            <div className="pointer-events-none absolute top-2 left-6 text-2xl opacity-75 animate-pulse">☁️</div>
            <div className="pointer-events-none absolute top-8 right-8 text-3xl opacity-60 animate-bounce">☁️</div>
            <div className="pointer-events-none absolute bottom-4 left-10 text-xl opacity-50">☁️</div>

            {/* Flying Airplane */}
            <div className="relative my-3 text-6xl animate-[flight-glide_2s_ease-in-out_infinite] filter drop-shadow-md">
              🛫
              <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-xl opacity-75">
                💨💨
              </div>
            </div>

            <div className="mt-2 rounded-2xl bg-white/95 px-5 py-3 border-2 border-sky-300 shadow-lg max-w-[260px]">
              <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-700">
                {lang === 'ko' ? '🛫 항공 여행 중' : lang === 'es' ? '🛫 Vuelo en avión' : '🛫 In Flight'}
              </span>
              <h3 className="mt-1 text-base font-extrabold text-slate-800 leading-snug">
                {toName}{lang === 'ko' ? '(으)로 비행합니다!' : lang === 'es' ? ' ¡Llegando!' : ' Arriving!'}
              </h3>
            </div>
          </>
        ) : (
          <>
            {/* Wave ripples */}
            <div className="pointer-events-none absolute top-4 left-6 text-2xl opacity-75 animate-pulse">🌊</div>
            <div className="pointer-events-none absolute top-6 right-8 text-3xl opacity-60 animate-bounce">🌊</div>
            <div className="pointer-events-none absolute bottom-4 left-10 text-2xl opacity-50">🌊</div>

            {/* Sailing Ship */}
            <div className="relative my-3 text-6xl animate-[sail-wave_2s_ease-in-out_infinite] filter drop-shadow-md">
              🚢
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-lg opacity-80">
                🌊🌊🌊
              </div>
            </div>

            <div className="mt-2 rounded-2xl bg-white/95 px-5 py-3 border-2 border-emerald-300 shadow-lg max-w-[260px]">
              <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                {lang === 'ko' ? '🚢 여객선 출항 중' : lang === 'es' ? '🚢 En navegación' : '🚢 Setting Sail'}
              </span>
              <h3 className="mt-1 text-base font-extrabold text-slate-800 leading-snug">
                {toName}{lang === 'ko' ? '(으)로 출항합니다!' : lang === 'es' ? ' ¡Zarpando!' : ' Sailing in!'}
              </h3>
            </div>
          </>
        )}

        <p className="mt-3 text-[10px] font-bold text-slate-400">
          {lang === 'ko' ? '탭하여 건너뛰기 ✕' : lang === 'es' ? 'Toca para saltar ✕' : 'Tap to skip ✕'}
        </p>
      </div>
    </div>
  );
}
