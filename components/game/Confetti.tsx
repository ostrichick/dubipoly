'use client';

import { useMemo } from 'react';

const COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Confetti() {
  const pieces = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: `${(i * 2.2 + Math.random() * 5) % 100}%`,
      delay: `${(i * 0.08).toFixed(2)}s`,
      duration: `${(2.2 + (i % 5) * 0.3).toFixed(2)}s`,
      size: `${6 + (i % 4) * 2}px`,
      isCircle: i % 3 === 0,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute -top-4 opacity-0 animate-confetti-fall"
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.size,
            height: p.isCircle ? p.size : `${parseInt(p.size) * 1.6}px`,
            borderRadius: p.isCircle ? '50%' : '2px',
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}
