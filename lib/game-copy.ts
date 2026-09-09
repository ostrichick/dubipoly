import { board, type Lang } from './board.ts';
import { events } from './events.ts';
import type { Entry, Game } from './game.ts';
export const ui = {
  ko: {
    start: '새 여행 시작',
    continue: '이어하기',
    title: '둘만의 여행',
    name: '여행자 이름',
    roll: '주사위 굴리기',
    end: '턴 종료',
    skip: '건너뛰고 턴 종료',
    buy: '도시 구매',
    upgrade: '한 단계 발전',
    round: '라운드',
    turn: '님의 차례',
    cash: '보유 Dubi',
    assets: '총자산',
    level: '발전 단계',
    owner: '소유자',
    none: '주인 없음',
    rent: '방문료',
    price: '구매가',
    cost: '발전 비용',
    waiting: '다음 차례',
    choice: '도착한 도시를 구매하거나 발전시킬 수 있어요.',
    rollHint: '주사위를 굴려 여행을 이어가세요.',
    endHint: '이번 행동을 마쳤어요. 휴대폰을 다음 여행자에게 넘겨주세요.',
    max: '최대 발전 단계입니다.',
    low: 'Dubi가 부족해요. 건너뛰기를 선택하세요.',
    finished: '여행이 끝났어요!',
    win: '우승',
    tie: '공동 우승',
    bankrupt: '필수 비용을 지불하지 못해 여행이 끝났어요.',
    score: '20라운드 완료 · 현금과 구매·발전 비용을 합산했어요.',
    new: '새 게임',
    confirm: '현재 여행을 끝내고 새로 시작할까요?',
    yes: '새로 시작',
    cancel: '취소',
    saved: '이 브라우저에 자동 저장',
    saveFail: '저장할 수 없어요. 이 페이지를 닫으면 진행을 잃을 수 있습니다.',
    badSave: '저장된 게임을 읽을 수 없습니다. 새 게임으로 시작해 주세요.',
    log: '여행 기록',
    mode: '한 기기 · 2인 플레이',
    zoom: '확대',
    fit: '기본 크기',
    korea: '한국',
    peru: '페루',
    special: '여행 정류장',
    follow: '현재 위치 보기',
    rules: '게임 방법',
    rulesText:
      '각자 1,500 Dubi로 시작합니다. 출발을 지나면 200 Dubi! 주사위를 굴려 도착한 도시만 구매·발전할 수 있습니다. 발전은 최대 3단계, 방문료는 기본료 × (단계 + 1)입니다. 이벤트로 이동해도 도착 도시 규칙은 적용되지만 이벤트는 연속 발생하지 않습니다. 두 사람의 차례가 끝나면 1라운드, 20라운드 후 총자산으로 승리합니다. 필수 비용이 잔액을 초과하면 파산합니다. 뒤로 출발을 지나면 보너스는 없습니다.',
    rest: '잠깐 쉬어가는 곳이에요. 비용 없이 턴을 마칠 수 있습니다.',
    event: '여기에 도착하면 여행 이벤트가 발생해요.',
    loading: '여행 준비 중…',
  },
  es: {
    start: 'Empezar un viaje',
    continue: 'Continuar',
    title: 'Un viaje para dos',
    name: 'Nombre del viajero',
    roll: 'Lanzar dados',
    end: 'Terminar turno',
    skip: 'Pasar y terminar turno',
    buy: 'Comprar ciudad',
    upgrade: 'Mejorar un nivel',
    round: 'Ronda',
    turn: ': tu turno',
    cash: 'Dubi disponibles',
    assets: 'Patrimonio',
    level: 'Nivel',
    owner: 'Propietario',
    none: 'Sin propietario',
    rent: 'Tarifa de visita',
    price: 'Precio',
    cost: 'Costo de mejora',
    waiting: 'Próximo turno',
    choice: 'Puedes comprar o mejorar la ciudad a la que llegaste.',
    rollHint: 'Lanza los dados y sigue el viaje.',
    endHint: 'Tu acción ha terminado. Pasa el teléfono al otro viajero.',
    max: 'Nivel máximo alcanzado.',
    low: 'No tienes suficientes Dubi. Puedes pasar.',
    finished: '¡Terminó el viaje!',
    win: 'Ganador',
    tie: '¡Empate!',
    bankrupt: 'El viaje terminó porque no se pudo cubrir un pago obligatorio.',
    score: '20 rondas completas: sumamos efectivo, compras y mejoras.',
    new: 'Nueva partida',
    confirm: '¿Terminar este viaje y empezar uno nuevo?',
    yes: 'Empezar de nuevo',
    cancel: 'Cancelar',
    saved: 'Guardado automático en este navegador',
    saveFail:
      'No se pudo guardar. Si cierras la página puedes perder el progreso.',
    badSave: 'No se pudo leer la partida guardada. Empieza una nueva.',
    log: 'Diario de viaje',
    mode: 'Un dispositivo · 2 jugadores',
    zoom: 'Ampliar',
    fit: 'Tamaño normal',
    korea: 'Corea',
    peru: 'Perú',
    special: 'Parada de viaje',
    follow: 'Ver posición actual',
    rules: 'Cómo jugar',
    rulesText:
      'Cada viajero empieza con 1,500 Dubi. Recibe 200 al pasar por Salida. Solo puedes comprar o mejorar la ciudad donde aterrizas. Hay 3 niveles de mejora; la tarifa es la base × (nivel + 1). Las cartas de movimiento aplican las reglas de la ciudad de destino, pero no activan otra carta. Una ronda son dos turnos; gana el mayor patrimonio tras 20 rondas. Si no puedes pagar un costo obligatorio, pierdes por bancarrota. Retroceder por Salida no da un bono.',
    rest: 'Un lugar para descansar. Termina tu turno sin costo.',
    event: 'Al llegar aquí se activa un evento de viaje.',
    loading: 'Preparando el viaje…',
  },
};
export function describe(e: Entry, g: Game, l: Lang) {
  const n = g.players[e.player].name,
    c = e.space === undefined ? '' : board[e.space].name[l],
    a = `${e.amount ?? 0} Dubi`;
  const es = l === 'es';
  switch (e.kind) {
    case 'roll':
      return `${n}: 🎲 ${e.dice?.join(' + ')}`;
    case 'bonus':
      return `${n}: +${a} (${es ? 'Salida' : '출발'})`;
    case 'event':
      return `${n}: ${events[e.event!].text[l]}`;
    case 'rent':
      return `${n}: ${c} · −${a} (${es ? 'visita' : '방문료'})`;
    case 'buy':
      return `${n}: ${c} · −${a} (${es ? 'compra' : '구매'})`;
    case 'upgrade':
      return `${n}: ${c} · −${a} (${es ? 'mejora' : '발전'})`;
    case 'rest':
      return `${n}: ${c} · ${es ? 'descanso' : '휴식'}`;
    case 'bankrupt':
      return `${n}: ${es ? 'bancarrota' : '파산'}`;
    case 'finish':
      return ui[l].finished;
  }
}
