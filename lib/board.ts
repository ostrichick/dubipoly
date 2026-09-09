export type Lang = 'ko' | 'es';
export type Space = {
  index: number;
  row: number;
  col: number;
  type: 'city' | 'event' | 'corner';
  country?: 'korea' | 'peru';
  name: Record<Lang, string>;
  icon: string;
  price?: number;
  rent?: number;
  upgrade?: number;
};
const korea = [
  ['서울', 'Seúl', '🏙️'],
  ['인천', 'Incheon', '✈️'],
  ['수원', 'Suwon', '🏯'],
  ['대전', 'Daejeon', '🔭'],
  ['대구', 'Daegu', '🌳'],
  ['울산', 'Ulsan', '⛵'],
  ['부산', 'Busan', '🌉'],
  ['광주', 'Gwangju', '🎨'],
  ['전주', 'Jeonju', '🏯'],
  ['경주', 'Gyeongju', '🪷'],
  ['춘천', 'Chuncheon', '🏞️'],
  ['강릉', 'Gangneung', '🌊'],
  ['속초', 'Sokcho', '⛰️'],
  ['제주시', 'Jeju', '🍊'],
];
const peru = [
  ['리마', 'Lima', '🏛️'],
  ['아레키파', 'Arequipa', '🌋'],
  ['트루히요', 'Trujillo', '🏛️'],
  ['치클라요', 'Chiclayo', '☀️'],
  ['쿠스코', 'Cusco', '⛰️'],
  ['이카', 'Ica', '🏜️'],
  ['피우라', 'Piura', '🌴'],
  ['이키토스', 'Iquitos', '🌿'],
  ['푸노', 'Puno', '⛵'],
  ['타크나', 'Tacna', '⛲'],
  ['아야쿠초', 'Ayacucho', '🎨'],
  ['와라스', 'Huaraz', '🏔️'],
  ['우앙카요', 'Huancayo', '🌻'],
  ['카하마르카', 'Cajamarca', '🏞️'],
];
export function position(i: number) {
  if (i <= 10) return { row: 1, col: i + 1 };
  if (i <= 20) return { row: i - 9, col: 11 };
  if (i <= 30) return { row: 11, col: 31 - i };
  return { row: 41 - i, col: 1 };
}
const corners: Record<number, string[]> = {
  0: ['출발', 'Salida', '✈️'],
  10: ['여행 공항', 'Aeropuerto', '🛫'],
  20: ['Dubu의 쉼터', 'Descanso', '🐾'],
  30: ['여행 항구', 'Puerto', '🚢'],
};
let ki = 0,
  pi = 0;
export const board: Space[] = Array.from({ length: 40 }, (_, index) => {
  const base = { index, ...position(index) };
  if (corners[index]) {
    const [ko, es, icon] = corners[index];
    return { ...base, type: 'corner', name: { ko, es }, icon };
  }
  const country = index < 10 || index > 30 ? 'korea' : 'peru';
  if (index % 10 === 3 || index % 10 === 8)
    return {
      ...base,
      country,
      type: 'event',
      name: { ko: '여행 이벤트', es: 'Evento' },
      icon: '🎒',
    };
  const rank = country === 'korea' ? ki++ : pi++;
  const [ko, es, icon] = (country === 'korea' ? korea : peru)[rank];
  const price = 100 + Math.floor(rank / 2) * 40;
  return {
    ...base,
    type: 'city',
    country,
    name: { ko, es },
    icon,
    price,
    rent: Math.round(price * 0.12),
    upgrade: price / 2,
  };
});
