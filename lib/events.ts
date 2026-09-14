import type { Lang } from './board.ts';
export type TravelEventEffect =
  | { kind: 'cash'; amount: number }
  | { kind: 'move'; steps: number }
  | { kind: 'startBonus'; amount: number }
  | { kind: 'singleDie' }
  | { kind: 'guaranteedDoubles' }
  | { kind: 'freePass' }
  | { kind: 'freeUpgrade' }
  | { kind: 'warpTourist' };

export type TravelEvent = {
  id: string;
  icon?: string;
  text: Record<Lang, string>;
  effect: TravelEventEffect;
};
export const events: TravelEvent[] = [
  {
    id: 'festival',
    icon: '🎉',
    text: {
      en: "A festival gift! Receive 120 Dubi.",
      ko: '지역 축제의 작은 선물! 120 Dubi를 받아요.',
      es: '¡Un regalo del festival! Recibes 120 Dubi.',
    },
    effect: { kind: 'cash', amount: 120 },
  },
  {
    id: 'postcard',
    icon: '💌',
    text: {
      en: "Earn 80 Dubi selling travel postcards.",
      ko: '여행 엽서 판매로 80 Dubi를 벌었어요.',
      es: 'Ganas 80 Dubi vendiendo postales de viaje.',
    },
    effect: { kind: 'cash', amount: 80 },
  },
  {
    id: 'picnic',
    icon: '🧺',
    text: {
      en: "Spend 60 Dubi on a picnic for two.",
      ko: '둘만의 피크닉 준비에 60 Dubi를 써요.',
      es: 'Gastas 60 Dubi preparando un pícnic para dos.',
    },
    effect: { kind: 'cash', amount: -60 },
  },
  {
    id: 'dubu',
    icon: '🐱',
    text: {
      en: "Treats and toys for Dubu! Pay 50 Dubi.",
      ko: 'Dubu의 간식과 장난감! 50 Dubi를 써요.',
      es: '¡Premios y juguetes para Dubu! Pagas 50 Dubi.',
    },
    effect: { kind: 'cash', amount: -50 },
  },
  {
    id: 'refund',
    icon: '🏨',
    text: {
      en: "Receive a 100 Dubi accommodation refund.",
      ko: '숙소 할인으로 100 Dubi를 돌려받아요.',
      es: 'Recibes un reembolso de 100 Dubi por tu alojamiento.',
    },
    effect: { kind: 'cash', amount: 100 },
  },
  {
    id: 'market',
    icon: '🛍️',
    text: {
      en: "Buy souvenirs at the market. Pay 90 Dubi.",
      ko: '시장에서 기념품을 샀어요. 90 Dubi를 내요.',
      es: 'Compras recuerdos en el mercado. Pagas 90 Dubi.',
    },
    effect: { kind: 'cash', amount: -90 },
  },
  {
    id: 'photo',
    icon: '🏆',
    text: {
      en: "Win a travel photo contest! Receive 150 Dubi.",
      ko: '여행 사진 공모전 수상! 150 Dubi를 받아요.',
      es: '¡Ganas un concurso de fotos de viaje! Recibes 150 Dubi.',
    },
    effect: { kind: 'cash', amount: 150 },
  },
  {
    id: 'repair',
    icon: '🧳',
    text: {
      en: "Repairing your suitcase costs 110 Dubi.",
      ko: '여행 가방 수리에 110 Dubi가 필요해요.',
      es: 'Reparar la maleta cuesta 110 Dubi.',
    },
    effect: { kind: 'cash', amount: -110 },
  },
  {
    id: 'guide',
    icon: '🗺️',
    text: {
      en: "Earn 70 Dubi helping a tour guide.",
      ko: '여행 가이드 일을 도와 70 Dubi를 벌어요.',
      es: 'Ganas 70 Dubi ayudando a un guía de viajes.',
    },
    effect: { kind: 'cash', amount: 70 },
  },
  {
    id: 'train',
    icon: '🚂',
    text: {
      en: "Take the train and move forward 3 spaces.",
      ko: '기차를 타고 앞으로 3칸 이동해요.',
      es: 'Tomas el tren y avanzas 3 casillas.',
    },
    effect: { kind: 'move', steps: 3 },
  },
  {
    id: 'flight',
    icon: '✈️',
    text: {
      en: "Take a flight and move forward 5 spaces.",
      ko: '비행기를 타고 앞으로 5칸 이동해요.',
      es: 'Tomas un avión y avanzas 5 casillas.',
    },
    effect: { kind: 'move', steps: 5 },
  },
  {
    id: 'detour',
    icon: '🧢',
    text: {
      en: "Go back 2 spaces to find your hat.",
      ko: '두고 온 모자를 찾아 뒤로 2칸 이동해요.',
      es: 'Retrocedes 2 casillas para buscar tu sombrero.',
    },
    effect: { kind: 'move', steps: -2 },
  },
  {
    id: 'salaryBoost',
    icon: '💼',
    text: {
      en: "Sponsorship deal! Salary bonus per Start crossing permanently increases by +100 Dubi.",
      ko: '스폰서십 계약 체결! 출발선을 지날 때 받는 월급이 영구적으로 +100 Dubi 인상돼요.',
      es: '¡Contrato de patrocinio! La bonificación por pasar la Salida aumenta permanentemente +100 Dubi.',
    },
    effect: { kind: 'startBonus', amount: 100 },
  },
  {
    id: 'singleDie',
    icon: '🚶',
    text: {
      en: "Alleyway walking tour! On your next turn, roll only 1 die for a slow and precise stroll.",
      ko: '골목길 도보 탐방! 다음 턴에는 주사위를 1개만 굴려(1~6) 천천히 산책해요.',
      es: '¡Paseo a pie por callejones! En tu próximo turno, tira solo 1 dado (1~6) para pasear despacio.',
    },
    effect: { kind: 'singleDie' },
  },
  {
    id: 'luckyDoubles',
    icon: '✨',
    text: {
      en: "Golden four-leaf clover! Your next roll is guaranteed to be doubles with an extra roll.",
      ko: '황금 네잎클로버 발견! 다음 주사위는 100% 무조건 더블이 나와 한 번 더 굴려요.',
      es: '¡Trébol de cuatro hojas dorado! Tu próxima tirada será dobles garantizados con tirada extra.',
    },
    effect: { kind: 'guaranteedDoubles' },
  },
  {
    id: 'freePass',
    icon: '🎫',
    text: {
      en: "VIP traveler pass! 1 free rent exemption when you land on opponent's property.",
      ko: 'VIP 여행자 프리패스! 상대방 도시를 방문해도 통행료를 1회 전액 면제받아요.',
      es: '¡Pase VIP de viajero! 1 exención total de alquiler cuando visites una propiedad rival.',
    },
    effect: { kind: 'freePass' },
  },
  {
    id: 'freeUpgrade',
    icon: '🏗️',
    text: {
      en: "Urban renewal grant! Free +1 building upgrade on 1 of your cities (or +100 Dubi if none).",
      ko: '도시 재생 지원금! 내가 가진 도시 1곳의 건물이 무료로 1단계 증축돼요 (없으면 100 Dubi).',
      es: '¡Subvención de renovación! Mejora gratis (+1) de edificio en 1 de tus ciudades (o 100 Dubi).',
    },
    effect: { kind: 'freeUpgrade' },
  },
  {
    id: 'warpTourist',
    icon: '📸',
    text: {
      en: "Tourism board VIP flight! Ride a tailwind directly to the nearest famous tourist spot.",
      ko: '관광청 특별 초청! 순풍을 타고 가장 가까운 명품 관광지로 즉시 날아가요.',
      es: '¡Vuelo VIP de turismo! Aprovecha el viento favorable y vuela al punto turístico más cercano.',
    },
    effect: { kind: 'warpTourist' },
  },
];
