'use client';

import { useEffect, useState } from 'react';
import { generateQrCode } from '../../lib/qr';
import type { Lang } from '../../lib/board';

interface RoomQrCodeProps {
  url: string;
  roomCode: string;
  lang: Lang;
}

export function RoomQrCode({ url, roomCode, lang }: RoomQrCodeProps) {
  const [qrData, setQrData] = useState<string>('');

  useEffect(() => {
    if (!url) return;
    let active = true;
    generateQrCode(url).then((data) => {
      if (active) setQrData(data);
    });
    return () => {
      active = false;
    };
  }, [url]);

  if (!qrData) return null;

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-teal-100 bg-teal-50/50 p-4 text-center">
      <div className="overflow-hidden rounded-xl border border-teal-200 bg-white p-2 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrData} alt={`QR code to join room ${roomCode}`} className="h-36 w-36 object-contain" />
      </div>
      <p className="mt-2 text-xs font-semibold text-teal-800">
        {lang === 'ko'
          ? '카메라로 QR을 비추면 바로 입장할 수 있어요!'
          : lang === 'es'
            ? '¡Escanea el QR con la cámara para unirte!'
            : 'Scan with your camera to join instantly!'}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <span>{lang === 'ko' ? '방 코드:' : lang === 'es' ? 'Código:' : 'Code:'}</span>
        <span className="font-mono font-bold text-teal-700 text-sm tracking-wider">{roomCode}</span>
      </div>
    </div>
  );
}
