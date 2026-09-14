import { board, type Lang } from './board.ts';
import { events } from './events.ts';
import { rules, type Entry, type Game } from './game.ts';
export const ui = {
  en: {
    start: 'Start a new trip',
    continue: 'Continue',
    title: 'A trip for two',
    name: 'Traveler name',
    roll: 'Roll dice',
    end: 'End turn',
    skip: 'Skip and end turn',
    buy: 'Buy city',
    upgrade: 'Upgrade one level',
    round: 'Round',
    turn: '’s turn',
    cash: 'Dubi balance',
    assets: 'Total assets',
    level: 'Upgrade level',
    owner: 'Owner',
    none: 'Unowned',
    rent: 'Visit fee',
    price: 'Purchase price',
    cost: 'Upgrade cost',
    waiting: 'Next turn',
    choice: 'You can buy or upgrade the city you landed on.',
    rollHint: 'Roll the dice to continue your trip.',
    endHint: 'Your action is complete. End your turn for the next traveler.',
    max: 'Maximum upgrade level reached.',
    low: 'Not enough Dubi. You can skip.',
    finished: 'The trip is over!',
    win: 'Winner',
    tie: 'Joint winners',
    bankrupt: 'The trip ended because a required payment could not be covered.',
    score:
      '20 rounds complete: cash, purchase costs and upgrades make up your total assets.',
    new: 'New game',
    confirm: 'End this trip and start a new one?',
    yes: 'Start again',
    cancel: 'Cancel',
    saved: 'Automatically saved in this browser',
    saveFail: 'Unable to save. Closing this page may lose your progress.',
    badSave: 'Unable to read the saved game. Please start a new one.',
    log: 'Travel journal',
    mode: 'One device · 2 players',
    zoom: 'Zoom in',
    fit: 'Fit board',
    korea: 'Korea',
    peru: 'Peru',
    special: 'Travel stop',
    follow: 'Show current position',
    rules: 'How to play',
    rulesText:
      'Each traveler starts with 1,500 Dubi. Passing Start earns 200 Dubi. Buy or upgrade only the city you land on. Upgrades have 3 levels; the visit fee is the base fee × (level + 1). Movement cards apply destination city rules but never trigger another event. Two turns make a round. After 20 rounds, the most total assets wins. A required payment exceeding your cash causes bankruptcy. Passing Start backwards earns no bonus.',
    rest: 'A free place to rest. You can end your turn.',
    event: 'Landing here triggers a travel event.',
    loading: 'Preparing your trip…',
    sell: 'Sell property (50%)',
    sellHint: 'Sell this city to the bank for 50% of your total investment.',
    qrTitle: 'Scan to join room',
    miniMap: 'Board Overview',
    soundOn: 'Sound enabled',
    soundOff: 'Sound muted',
  },
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
    sell: '도시 매각 (50%)',
    sellHint: '투자한 금액의 50%를 받고 은행에 도시를 긴급 매각합니다.',
    qrTitle: 'QR 코드로 방 입장',
    miniMap: '보드 조감도',
    soundOn: '효과음 켜짐',
    soundOff: '효과음 꺼짐',
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
    turn: ': turno actual',
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
    sell: 'Vender propiedad (50%)',
    sellHint: 'Vende esta ciudad al banco por el 50% de tu inversión total.',
    qrTitle: 'Escanear para unirse',
    miniMap: 'Vista general',
    soundOn: 'Sonido activado',
    soundOff: 'Sonido desactivado',
  },
};
export function describe(e: Entry, g: Game, l: Lang) {
  const n = g.players[e.player].name,
    c = e.space === undefined ? '' : board[e.space].name[l],
    a = `${e.amount ?? 0} Dubi`;
  const es = l === 'es';
  const en = l === 'en';
  if (e.detail)
    return `${n}: ${specialCopy[l].log[e.detail]}${e.amount ? ` · −${a}` : ''}`;
  switch (e.kind) {
    case 'roll':
      return `${n}: 🎲 ${e.dice?.join(' + ')}`;
    case 'bonus':
      return `${n}: +${a} (${en ? 'Start' : es ? 'Salida' : '출발'})`;
    case 'event':
      return `${n}: ${events[e.event!].text[l]}`;
    case 'rent':
      return `${n}: ${c} · −${a} (${en ? 'visit fee' : es ? 'visita' : '방문료'})`;
    case 'buy':
      return `${n}: ${c} · −${a} (${en ? 'purchase' : es ? 'compra' : '구매'})`;
    case 'upgrade':
      return `${n}: ${c} · −${a} (${en ? 'upgrade' : es ? 'mejora' : '발전'})`;
    case 'rest':
      return `${n}: ${c} · ${en ? 'rest' : es ? 'descanso' : '휴식'}`;
    case 'bankrupt':
      return `${n}: ${en ? 'bankruptcy' : es ? 'bancarrota' : '파산'}`;
    case 'sell':
      return `${n}: ${c} · +${a} (${en ? 'sold' : es ? 'venta' : '매각'})`;
    case 'finish':
      return `${ui[l].finished} (${rules.rounds} ${en ? 'rounds completed' : es ? 'rondas completadas' : '라운드 완주!'})`;
  }
}

export const specialCopy = {
  en: {
    tourist: 'Tourist destination',
    touristHint:
      'Own 1 / 2 / 3 / 4 destinations: visit fee 25 / 50 / 100 / 200 Dubi.',
    noBuildings: 'No buildings',
    regionSet: 'Region complete · base rent ×2',
    youHere: 'Your token is here',
    myPosition: 'Find my token',
    delay: 'Travel delay',
    delayHint: 'Go directly to Dubu’s rest. No Start bonus; your turn ends.',
    restSpaceHint:
      'Just visiting is free. Travelers sent here must roll doubles or pay 50 Dubi to leave.',
    rolling: 'Rolling…',
    saving: 'Confirming your action…',
    rollAgain: 'Roll again · Doubles!',
    doubleHint:
      'Doubles! Roll again. Three doubles in one turn send you to Dubu’s rest.',
    doubleChoice:
      'Doubles! Buy or upgrade first, then roll again. You may also skip the purchase.',
    skipRoll: 'Skip purchase · Roll again',
    tryDoubles: 'Roll to leave rest',
    payRest: 'Leave rest',
    restHint:
      'Roll doubles to leave, or pay 50 Dubi before rolling. After 3 failed attempts, pay 50 and move.',
    restAttempt: 'Rest attempt',
    legacy:
      'This trip keeps its original rules. Start a new game to use doubles, tourist destinations and special rules.',
    rules:
      'New trips: doubles grant another roll after resolving your landing. Three consecutive doubles send you directly to Dubu’s rest, with no Start bonus. Travel delay also sends you there. Roll doubles to leave (no extra roll), or pay 50 before rolling. The third failed attempt requires 50, then you move using that roll. Rent is still collected during rest. Owning every regular city in a region doubles only its unupgraded rent. Tourist destinations cannot be upgraded; owning 1–4 gives fees of 25/50/100/200. Extra rolls do not advance the round. These casual rules do not include auctions, mortgages or trading.',
    airport: 'Airport',
    airportHint:
      'Pay 50 Dubi to fly immediately to any space. Crossing Start awards 200 Dubi!',
    harbor: 'Harbor',
    harborHint:
      'Rest for 1 turn. Next turn, pay 20 Dubi to sail to any destination space!',
    flyBtn: '🛫 Take Flight (50 Dubi)',
    skipFly: 'Skip Flight',
    sailBtn: '🚢 Set Sail (20 Dubi)',
    skipSail: 'Roll Dice Normally',
    chooseDest: 'Choose your destination',
    crossingBonus: 'Crosses Start: +200 Dubi bonus!',
    log: {
      doubles: 'Doubles: another roll after this landing.',
      'three-doubles': 'Three doubles: go directly to Dubu’s rest.',
      delay: 'Travel delay: go directly to Dubu’s rest.',
      'rest-wait': 'No doubles: remain at rest.',
      'rest-release': 'Leave rest and move; no bonus roll.',
      'rest-fee': 'Paid to leave rest',
      flight: 'Flew directly to destination.',
      sail: 'Set sail and arrived at destination.',
      'harbor-wait': 'Resting at harbor for 1 turn.',
      freepass: 'VIP pass used! Rent completely waived.',
      'free-upgrade': 'Urban renewal! Free building upgrade.',
    },
  },
  ko: {
    tourist: '관광지',
    touristHint:
      '관광지 1 / 2 / 3 / 4곳 보유 시 방문료 25 / 50 / 100 / 200 Dubi',
    noBuildings: '건물 발전 없음',
    regionSet: '지역 독점 · 기본 방문료 2배',
    youHere: '내 말이 있는 칸',
    myPosition: '내 말 찾기',
    delay: '여행 지연',
    delayHint: '출발 보너스 없이 Dubu 쉼터로 바로 이동하고 턴을 마칩니다.',
    restSpaceHint:
      '일반 방문은 무료입니다. 강제 휴식 중이면 더블 또는 50 Dubi로 나올 수 있어요.',
    airport: '여행 공항',
    airportHint:
      '50 Dubi를 내고 원하는 칸으로 즉시 비행할 수 있어요. 출발점을 지나면 +200 Dubi 보너스!',
    harbor: '여행 항구',
    harborHint:
      '이번 턴은 쉬고, 다음 턴에 20 Dubi를 내고 원하는 칸으로 출항할 수 있어요.',
    flyBtn: '🛫 비행기 탑승 (50 Dubi)',
    skipFly: '비행 건너뛰기',
    sailBtn: '🚢 여객선 출항 (20 Dubi)',
    skipSail: '일반 주사위 굴리기',
    chooseDest: '이동할 목적지를 선택하세요',
    crossingBonus: '출발점 통과: +200 Dubi 보너스 획득!',
    rolling: '주사위 굴리는 중…',
    saving: '행동을 확인하는 중…',
    rollAgain: '더블! 한 번 더 굴리기',
    doubleHint:
      '더블이에요! 한 번 더 굴리세요. 한 턴에 3연속 더블이면 Dubu 쉼터로 이동합니다.',
    doubleChoice:
      '더블! 구매·발전을 마치면 다시 굴려요. 구매를 건너뛸 수도 있습니다.',
    skipRoll: '구매 건너뛰고 다시 굴리기',
    tryDoubles: '쉼터 탈출 주사위',
    payRest: '쉼터에서 나가기',
    restHint:
      '더블로 탈출하거나, 굴리기 전에 50 Dubi를 내세요. 3번째 실패 시 50 Dubi를 내고 이동합니다.',
    restAttempt: '쉼터 탈출 시도',
    legacy:
      '진행 중인 여행은 기존 규칙을 유지합니다. 새 게임부터 더블·관광지·특수 규칙이 적용됩니다.',
    rules:
      '새 경기: 더블이면 도착 칸 처리를 마친 뒤 한 번 더 굴립니다. 한 턴에 3연속 더블이면 출발 보너스 없이 Dubu 쉼터로 갑니다. 30번 공항은 50 Dubi로 원하는 칸으로 비행(출발 통과 시 +200 Dubi), 10번 항구는 1턴 휴식 후 20 Dubi로 원하는 칸으로 출항합니다. 더블로 쉼터 탈출 시 추가 굴림은 없으며, 굴리기 전 50 Dubi를 내고 나올 수도 있습니다. 관광지는 발전할 수 없고 보유 1~4곳에 따라 25/50/100/200입니다.',
    log: {
      doubles: '더블! 도착 칸 처리 후 다시 굴립니다.',
      'three-doubles': '3연속 더블! Dubu 쉼터로 바로 이동합니다.',
      delay: '여행 지연! Dubu 쉼터로 이동합니다.',
      'rest-wait': '더블 실패: 쉼터에 머뭅니다.',
      'rest-release': '쉼터에서 나와 이동합니다. 추가 굴림은 없어요.',
      'rest-fee': '쉼터 복귀 비용 지불',
      flight: '비행기를 타고 목적지로 이동했어요.',
      sail: '여객선을 타고 목적지로 출항했어요.',
      'harbor-wait': '항구에서 출항 준비로 한 턴 쉽니다.',
      freepass: 'VIP 여행자 패스 사용! 통행료를 전액 면제받았습니다.',
      'free-upgrade': '도시 재생 지원! 건물을 무료로 1단계 증축했습니다.',
    },
  },
  es: {
    tourist: 'Destino turístico',
    touristHint:
      'Con 1 / 2 / 3 / 4 destinos: tarifa de 25 / 50 / 100 / 200 Dubi.',
    noBuildings: 'Sin edificios',
    regionSet: 'Región completa · tarifa base ×2',
    youHere: 'Tu ficha está aquí',
    myPosition: 'Encontrar mi ficha',
    delay: 'Retraso de viaje',
    delayHint:
      'Ve directamente al descanso de Dubu, sin bono de Salida, y termina el turno.',
    restSpaceHint:
      'La visita normal es gratis. Si te enviaron aquí, sal con dobles o pagando 50 Dubi.',
    airport: 'Aeropuerto',
    airportHint:
      'Paga 50 Dubi para volar a cualquier casilla. ¡Cruzar Salida da 200 Dubi!',
    harbor: 'Puerto',
    harborHint:
      'Descansa 1 turno. En el siguiente turno, paga 20 Dubi para zarpar a cualquier casilla.',
    flyBtn: '🛫 Tomar vuelo (50 Dubi)',
    skipFly: 'Pasar vuelo',
    sailBtn: '🚢 Zarpar en barco (20 Dubi)',
    skipSail: 'Lanzar dados normalmente',
    chooseDest: 'Elige tu destino',
    crossingBonus: '¡Cruza Salida: +200 Dubi de bono!',
    rolling: 'Lanzando…',
    saving: 'Confirmando tu acción…',
    rollAgain: '¡Dobles! Lanzar otra vez',
    doubleHint:
      '¡Dobles! Lanza otra vez. Tres dobles consecutivos te envían al descanso de Dubu.',
    doubleChoice:
      '¡Dobles! Compra o mejora y vuelve a lanzar. También puedes pasar la compra.',
    skipRoll: 'Pasar compra · Lanzar otra vez',
    tryDoubles: 'Lanzar para salir',
    payRest: 'Salir del descanso',
    restHint:
      'Sal con dobles o paga 50 Dubi antes de lanzar. Al tercer fallo, paga 50 y avanza.',
    restAttempt: 'Intento de salida',
    legacy:
      'Este viaje mantiene las reglas anteriores. Empieza una nueva partida para activar dobles, turismo y reglas especiales.',
    rules:
      'Partidas nuevas: con dobles, resuelve la casilla y lanza de nuevo. Tres dobles seguidos te envían al descanso de Dubu. En el aeropuerto puedes volar pagando 50 Dubi; en el puerto descansas 1 turno y luego zarpas pagando 20 Dubi. Los destinos turísticos dan tarifas de 25/50/100/200 según la cantidad que poseas.',
    log: {
      doubles: 'Dobles: vuelve a lanzar tras resolver la casilla.',
      'three-doubles': 'Tres dobles: ve al descanso de Dubu.',
      delay: 'Retraso: ve al descanso de Dubu.',
      'rest-wait': 'Sin dobles: sigues en el descanso.',
      'rest-release': 'Sales y avanzas, sin lanzamiento extra.',
      'rest-fee': 'Pago para salir del descanso',
      flight: 'Voló en avión a su destino.',
      sail: 'Zarpó en barco a su destino.',
      'harbor-wait': 'Descansando en el puerto por 1 turno.',
      freepass: '¡Pase VIP usado! Alquiler totalmente exento.',
      'free-upgrade': '¡Renovación urbana! Mejora gratuita de edificio.',
    },
  },
};
