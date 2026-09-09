import type { Lang } from './board.ts';
export type TravelEvent = {
  id: string;
  text: Record<Lang, string>;
  effect: { kind: 'cash'; amount: number } | { kind: 'move'; steps: number };
};
export const events: TravelEvent[] = [
  {
    id: 'festival',
    text: {
      en: "A festival gift! Receive 120 Dubi.",
      ko: '지역 축제의 작은 선물! 120 Dubi를 받아요.',
      es: '¡Un regalo del festival! Recibes 120 Dubi.',
    },
    effect: { kind: 'cash', amount: 120 },
  },
  {
    id: 'postcard',
    text: {
      en: "Earn 80 Dubi selling travel postcards.",
      ko: '여행 엽서 판매로 80 Dubi를 벌었어요.',
      es: 'Ganas 80 Dubi vendiendo postales de viaje.',
    },
    effect: { kind: 'cash', amount: 80 },
  },
  {
    id: 'picnic',
    text: {
      en: "Spend 60 Dubi on a picnic for two.",
      ko: '둘만의 피크닉 준비에 60 Dubi를 써요.',
      es: 'Gastas 60 Dubi preparando un pícnic para dos.',
    },
    effect: { kind: 'cash', amount: -60 },
  },
  {
    id: 'dubu',
    text: {
      en: "Treats and toys for Dubu! Pay 50 Dubi.",
      ko: 'Dubu의 간식과 장난감! 50 Dubi를 써요.',
      es: '¡Premios y juguetes para Dubu! Pagas 50 Dubi.',
    },
    effect: { kind: 'cash', amount: -50 },
  },
  {
    id: 'refund',
    text: {
      en: "Receive a 100 Dubi accommodation refund.",
      ko: '숙소 할인으로 100 Dubi를 돌려받아요.',
      es: 'Recibes un reembolso de 100 Dubi por tu alojamiento.',
    },
    effect: { kind: 'cash', amount: 100 },
  },
  {
    id: 'market',
    text: {
      en: "Buy souvenirs at the market. Pay 90 Dubi.",
      ko: '시장에서 기념품을 샀어요. 90 Dubi를 내요.',
      es: 'Compras recuerdos en el mercado. Pagas 90 Dubi.',
    },
    effect: { kind: 'cash', amount: -90 },
  },
  {
    id: 'photo',
    text: {
      en: "Win a travel photo contest! Receive 150 Dubi.",
      ko: '여행 사진 공모전 수상! 150 Dubi를 받아요.',
      es: '¡Ganas un concurso de fotos de viaje! Recibes 150 Dubi.',
    },
    effect: { kind: 'cash', amount: 150 },
  },
  {
    id: 'repair',
    text: {
      en: "Repairing your suitcase costs 110 Dubi.",
      ko: '여행 가방 수리에 110 Dubi가 필요해요.',
      es: 'Reparar la maleta cuesta 110 Dubi.',
    },
    effect: { kind: 'cash', amount: -110 },
  },
  {
    id: 'guide',
    text: {
      en: "Earn 70 Dubi helping a tour guide.",
      ko: '여행 가이드 일을 도와 70 Dubi를 벌어요.',
      es: 'Ganas 70 Dubi ayudando a un guía de viajes.',
    },
    effect: { kind: 'cash', amount: 70 },
  },
  {
    id: 'train',
    text: {
      en: "Take the train and move forward 3 spaces.",
      ko: '기차를 타고 앞으로 3칸 이동해요.',
      es: 'Tomas el tren y avanzas 3 casillas.',
    },
    effect: { kind: 'move', steps: 3 },
  },
  {
    id: 'flight',
    text: {
      en: "Take a flight and move forward 5 spaces.",
      ko: '비행기를 타고 앞으로 5칸 이동해요.',
      es: 'Tomas un avión y avanzas 5 casillas.',
    },
    effect: { kind: 'move', steps: 5 },
  },
  {
    id: 'detour',
    text: {
      en: "Go back 2 spaces to find your hat.",
      ko: '두고 온 모자를 찾아 뒤로 2칸 이동해요.',
      es: 'Retrocedes 2 casillas para buscar tu sombrero.',
    },
    effect: { kind: 'move', steps: -2 },
  },
];
