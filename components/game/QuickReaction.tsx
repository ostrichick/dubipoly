'use client';

import { useState } from 'react';
import { sound, triggerHaptic } from '../../lib/audio';

const REACTIONS = [
  { emoji: '😍', label: 'Love' },
  { emoji: '😭', label: 'Tears' },
  { emoji: '😱', label: 'Shock' },
  { emoji: '💪', label: 'Cheer' },
];

export type ReactionEvent = {
  player: number;
  emoji: string;
  name: string;
  id: number;
};

interface QuickReactionProps {
  onSend: (emoji: string) => void;
  activeReaction: ReactionEvent | null;
}

export function QuickReaction({ onSend, activeReaction }: QuickReactionProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    sound.playPop();
    triggerHaptic('light');
    onSend(emoji);
    setOpen(false);
  };

  return (
    <aside aria-label="Quick reactions" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Floating incoming reaction bubble */}
      {activeReaction && (
        <div
          key={activeReaction.id}
          className="animate-reaction-float absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-teal-200/50 bg-white/95 px-4 py-2 shadow-xl backdrop-blur-md"
        >
          <span className="text-2xl animate-bounce">{activeReaction.emoji}</span>
          <span className="text-xs font-bold text-teal-800">{activeReaction.name}</span>
        </div>
      )}

      {/* Floating Reaction Launcher Button on bottom-right */}
      <div className="pointer-events-auto absolute bottom-20 right-3 flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-teal-100 bg-white/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
            {REACTIONS.map((item) => (
              <button
                key={item.emoji}
                type="button"
                onClick={() => handleSelect(item.emoji)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-transform hover:scale-125 active:scale-95 hover:bg-teal-50"
                title={item.label}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            sound.playPop();
            setOpen((prev) => !prev);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-gradient-to-tr from-amber-400 to-orange-400 text-white shadow-lg transition-transform active:scale-90 hover:brightness-105"
          title="Send Reaction"
        >
          <span className="text-lg">🐾</span>
        </button>
      </div>
    </aside>
  );
}
