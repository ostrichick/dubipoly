export type Lang = 'en' | 'ko' | 'es';
export type Space = {
  index: number;
  row: number;
  col: number;
  type: 'city' | 'event' | 'corner';
  country?: 'korea' | 'peru';
  name: Record<Lang, string>;
  region?: Record<Lang, string>;
  icon: string;
  price?: number;
  rent?: number;
  upgrade?: number;
};
type CityDefinition = [
  ko: string,
  es: string,
  en: string,
  icon: string,
  region: Record<Lang, string>,
];
const korea: CityDefinition[] = [
  ['광주', 'Gwangju', 'Gwangju', '🎨', { ko: '한국 서남부', es: 'Suroeste de Corea', en: 'Southwestern Korea' }],
  ['전주', 'Jeonju', 'Jeonju', '🏯', { ko: '한국 서남부', es: 'Suroeste de Corea', en: 'Southwestern Korea' }],
  ['대전', 'Daejeon', 'Daejeon', '🔭', { ko: '한국 중부·내륙', es: 'Centro e interior de Corea', en: 'Central & Inland Korea' }],
  ['수원', 'Suwon', 'Suwon', '🏯', { ko: '한국 수도권', es: 'Área metropolitana de Seúl', en: 'Seoul Capital Area' }],
  ['경주', 'Gyeongju', 'Gyeongju', '🪷', { ko: '한국 중부·내륙', es: 'Centro e interior de Corea', en: 'Central & Inland Korea' }],
  ['춘천', 'Chuncheon', 'Chuncheon', '🏞️', { ko: '한국 중부·내륙', es: 'Centro e interior de Corea', en: 'Central & Inland Korea' }],
  ['강릉', 'Gangneung', 'Gangneung', '🌊', { ko: '한국 동남부·동해', es: 'Sureste y costa este de Corea', en: 'Southeastern & East Coast Korea' }],
  ['속초', 'Sokcho', 'Sokcho', '⛰️', { ko: '한국 동남부·동해', es: 'Sureste y costa este de Corea', en: 'Southeastern & East Coast Korea' }],
  ['대구', 'Daegu', 'Daegu', '🌳', { ko: '한국 동남부·동해', es: 'Sureste y costa este de Corea', en: 'Southeastern & East Coast Korea' }],
  ['울산', 'Ulsan', 'Ulsan', '⛵', { ko: '한국 동남부·동해', es: 'Sureste y costa este de Corea', en: 'Southeastern & East Coast Korea' }],
  ['부산', 'Busan', 'Busan', '🌉', { ko: '한국 동남부·동해', es: 'Sureste y costa este de Corea', en: 'Southeastern & East Coast Korea' }],
  ['제주시', 'Jeju', 'Jeju', '🍊', { ko: '한국 섬', es: 'Isla coreana', en: 'Korean Island' }],
  ['인천', 'Incheon', 'Incheon', '✈️', { ko: '한국 수도권', es: 'Área metropolitana de Seúl', en: 'Seoul Capital Area' }],
  ['서울', 'Seúl', 'Seoul', '🏙️', { ko: '한국 수도권', es: 'Área metropolitana de Seúl', en: 'Seoul Capital Area' }],
];
const peru: CityDefinition[] = [
  ['푸노', 'Puno', 'Puno', '⛵', { ko: '페루 남동부', es: 'Sureste del Perú', en: 'Southeastern Peru' }],
  ['아레키파', 'Arequipa', 'Arequipa', '🌋', { ko: '페루 남동부', es: 'Sureste del Perú', en: 'Southeastern Peru' }],
  ['타크나', 'Tacna', 'Tacna', '⛲', { ko: '페루 남동부', es: 'Sureste del Perú', en: 'Southeastern Peru' }],
  ['쿠스코', 'Cusco', 'Cusco', '⛰️', { ko: '페루 남동부', es: 'Sureste del Perú', en: 'Southeastern Peru' }],
  ['이카', 'Ica', 'Ica', '🏜️', { ko: '페루 남부 사막', es: 'Desierto del sur del Perú', en: 'Southern Peru Desert' }],
  ['아야쿠초', 'Ayacucho', 'Ayacucho', '🎨', { ko: '페루 중부', es: 'Centro del Perú', en: 'Central Peru' }],
  ['와라스', 'Huaraz', 'Huaraz', '🏔️', { ko: '페루 중부', es: 'Centro del Perú', en: 'Central Peru' }],
  ['우앙카요', 'Huancayo', 'Huancayo', '🌻', { ko: '페루 중부', es: 'Centro del Perú', en: 'Central Peru' }],
  ['트루히요', 'Trujillo', 'Trujillo', '🏛️', { ko: '페루 북부·아마존', es: 'Norte y Amazonía del Perú', en: 'Northern Peru & Amazon' }],
  ['치클라요', 'Chiclayo', 'Chiclayo', '☀️', { ko: '페루 북부·아마존', es: 'Norte y Amazonía del Perú', en: 'Northern Peru & Amazon' }],
  ['카하마르카', 'Cajamarca', 'Cajamarca', '🏞️', { ko: '페루 북부·아마존', es: 'Norte y Amazonía del Perú', en: 'Northern Peru & Amazon' }],
  ['피우라', 'Piura', 'Piura', '🌴', { ko: '페루 북부·아마존', es: 'Norte y Amazonía del Perú', en: 'Northern Peru & Amazon' }],
  ['이키토스', 'Iquitos', 'Iquitos', '🌿', { ko: '페루 북부·아마존', es: 'Norte y Amazonía del Perú', en: 'Northern Peru & Amazon' }],
  ['리마', 'Lima', 'Lima', '🏛️', { ko: '페루 수도권', es: 'Área metropolitana de Lima', en: 'Lima Capital Area' }],
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
    return { ...base, type: 'corner', name: { ko, es, en: ({ 0: 'Start', 10: 'Airport', 20: "Dubu’s rest", 30: 'Harbor' } as Record<number, string>)[index] }, icon };
  }
  // The first half of the route (spaces 1–20, top and right edges) is Korea;
  // the second half (spaces 21–40, bottom and left edges) is Peru.
  const country = index < 20 ? 'korea' : 'peru';
  if (index % 10 === 3 || index % 10 === 8)
    return {
      ...base,
      country,
      type: 'event',
      name: { en: 'Travel event', ko: '여행 이벤트', es: 'Evento' },
      icon: '🎒',
    };
  const rank = country === 'korea' ? ki++ : pi++;
  const [ko, es, en, icon, region] = (country === 'korea' ? korea : peru)[rank];
  const price = 100 + Math.floor(rank / 2) * 40;
  return {
    ...base,
    type: 'city',
    country,
    name: { ko, es, en },
    region,
    icon,
    price,
    rent: Math.round(price * 0.12),
    upgrade: price / 2,
  };
});
