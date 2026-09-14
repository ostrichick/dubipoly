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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
    >
      <div className="relative flex flex-col items-center max-w-sm w-full p-8 text-center text-white overflow-hidden">
        {isFlight ? (
          <>
            {/* Cloud particles */}
            <div className="absolute top-10 left-4 text-3xl opacity-60 animate-pulse">☁️</div>
            <div className="absolute top-16 right-6 text-4xl opacity-50 animate-bounce">☁️</div>
            <div className="absolute bottom-12 left-10 text-2xl opacity-40">☁️</div>

            {/* Flying Airplane */}
            <div className="relative my-6 text-7xl animate-[flight-glide_2s_ease-in-out_infinite]">
              🛫
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-2xl opacity-75">
                💨💨
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/15 px-5 py-3.5 backdrop-blur-md border border-white/20 shadow-xl">
              <span className="text-xs font-black uppercase tracking-widest text-sky-300">
                {lang === 'ko' ? '항공 여행 중' : lang === 'es' ? 'Volando en avión' : 'In Flight'}
              </span>
              <h3 className="mt-1 text-xl font-black text-white">
                ✈️ {toName} {lang === 'ko' ? '(으)로 비행합니다!' : lang === 'es' ? '¡Llegando al destino!' : 'Arriving!'}
              </h3>
            </div>
          </>
        ) : (
          <>
            {/* Wave ripples */}
            <div className="absolute top-14 left-6 text-3xl opacity-60">🌊</div>
            <div className="absolute top-20 right-8 text-4xl opacity-50">🌊</div>
            <div className="absolute bottom-16 left-12 text-3xl opacity-40">🌊</div>

            {/* Sailing Ship */}
            <div className="relative my-6 text-7xl animate-[sail-wave_2s_ease-in-out_infinite]">
              🚢
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xl opacity-80">
                🌊🌊🌊
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/15 px-5 py-3.5 backdrop-blur-md border border-white/20 shadow-xl">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-300">
                {lang === 'ko' ? '여객선 항해 중' : lang === 'es' ? 'Navegando en barco' : 'Setting Sail'}
              </span>
              <h3 className="mt-1 text-xl font-black text-white">
                ⚓ {toName} {lang === 'ko' ? '(으)로 출항합니다!' : lang === 'es' ? '¡Zarpando al destino!' : 'Sailing in!'}
              </h3>
            </div>
          </>
        )}

        <p className="mt-6 text-xs text-white/70">
          {lang === 'ko' ? '화면을 탭하면 즉시 이동합니다 ✕' : lang === 'es' ? 'Toca para saltar ✕' : 'Tap to skip ✕'}
        </p>
      </div>
    </div>
  );
}
