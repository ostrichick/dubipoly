'use client';

import { board, type Lang } from '../../lib/board';
import type { Game } from '../../lib/game';
import { Button } from '../ui/button';

interface BoardMiniMapProps {
  game?: Game | null;
  lang: Lang;
  onClose: () => void;
  onSelectSpace: (index: number) => void;
}

export function BoardMiniMap({ game, lang, onClose, onSelectSpace }: BoardMiniMapProps) {
  const p0 = game?.players[0];
  const p1 = game?.players[1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl border border-teal-100 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗺️</span>
            <h3 className="text-base font-bold text-slate-800">
              {lang === 'ko' ? '보드 전체 조감도' : lang === 'es' ? 'Vista general del tablero' : 'Board Overview'}
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 rounded-full p-0">
            ✕
          </Button>
        </div>

        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>{lang === 'ko' ? '한국 (1~20)' : lang === 'es' ? 'Corea (1~20)' : 'Korea (1~20)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>{lang === 'ko' ? '페루 (21~40)' : lang === 'es' ? 'Perú (21~40)' : 'Peru (21~40)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-300" />
            <span className="font-bold text-emerald-800">{lang === 'ko' ? '✦ 관광지 (4곳)' : lang === 'es' ? '✦ Destinos (4)' : '✦ Tourist (4)'}</span>
          </div>
          {p0 && (
            <div className="flex items-center gap-1">
              <span className="inline-block rounded bg-teal-600 px-1 py-0.5 text-[10px] font-bold text-white">P1</span>
              <span className="truncate max-w-[60px]">{p0.name}</span>
            </div>
          )}
          {p1 && (
            <div className="flex items-center gap-1">
              <span className="inline-block rounded bg-orange-500 px-1 py-0.5 text-[10px] font-bold text-white">P2</span>
              <span className="truncate max-w-[60px]">{p1.name}</span>
            </div>
          )}
        </div>

        {/* 40 spaces list in a responsive 4-column compact grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {board.map((space) => {
              const isP0 = p0?.position === space.index;
              const isP1 = p1?.position === space.index;
              const prop = game?.properties[space.index];
              const isKorea = space.country === 'korea';
              const isPeru = space.country === 'peru';

              return (
                <button
                  key={space.index}
                  type="button"
                  onClick={() => {
                    onSelectSpace(space.index);
                    onClose();
                  }}
                  className={`relative flex flex-col items-center justify-between rounded-xl p-1.5 text-center transition-all border ${
                    space.kind === 'tourist'
                      ? 'border-emerald-400 bg-emerald-50/90 text-emerald-950 font-bold shadow-sm ring-1 ring-emerald-300 hover:bg-emerald-100'
                      : isKorea
                        ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-100/60'
                        : isPeru
                          ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-100/60'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[10px] text-slate-400">
                    <span>{space.index}</span>
                    <span>{space.icon}</span>
                  </div>
                  <span className="my-1 line-clamp-1 text-[11px] font-semibold text-slate-800">
                    {space.name[lang]}
                  </span>

                  {/* Property Owner Badge */}
                  {prop && (
                    <div className="mb-0.5">
                      <span
                        className={`inline-block rounded px-1 text-[9px] font-bold text-white ${
                          prop.owner === 0 ? 'bg-teal-600' : 'bg-orange-500'
                        }`}
                      >
                        Lv.{prop.level}
                      </span>
                    </div>
                  )}

                  {/* Player Token Indicators */}
                  <div className="flex items-center gap-1 min-h-[16px]">
                    {isP0 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] text-white font-bold shadow">
                        1
                      </span>
                    )}
                    {isP1 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white font-bold shadow">
                        2
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-slate-100 flex justify-end">
          <Button onClick={onClose} size="sm" className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl">
            {lang === 'ko' ? '닫기' : lang === 'es' ? 'Cerrar' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
}
