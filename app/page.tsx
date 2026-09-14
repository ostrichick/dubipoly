'use client';
import { useEffect, useRef, useState } from 'react';
import { board, type Lang } from '../lib/board';
import { events } from '../lib/events';
import {
  assets,
  canBuy,
  canUpgrade,
  canSell,
  canFly,
  canSail,
  playerStartBonus,
  sellValue,
  ownsRegion,
  createGame,
  rentAt,
  restore,
  rules,
  transition,
  type Action,
  type Game,
  type Save,
  type PlayerId,
} from '../lib/game';
import { ui, describe, specialCopy } from '../lib/game-copy';
import { roomFromLocation, roomUrl } from '../lib/room';
import { sound, triggerHaptic } from '../lib/audio';
import { QuickReaction, type ReactionEvent } from '../components/game/QuickReaction';
import { BoardMiniMap } from '../components/game/BoardMiniMap';
import { RoomQrCode } from '../components/game/RoomQrCode';
import { Confetti } from '../components/game/Confetti';
import { BoardCenterHub } from '../components/game/BoardCenterHub';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
const KEY = 'dubipoly.game.v1';
type CashDelta = { id: number; amount: number; text: string };
type Session = { game: Game; save: Save; matchId?: string };
type RoomSnapshot = {
  matchId: string;
  role?: 'host' | 'guest';
  roomCode: string;
  names: [string, string];
  players: number;
  ready: boolean;
  started: boolean;
  game: Game | null;
  save: Save | null;
  token?: string;
  playerIndex?: number;
  presence?: Array<{ connected: boolean }>;
  reaction?: { player: number; emoji: string; at: number } | null;
};
function randomInt(max: number) {
  const limit = 0x100000000 - (0x100000000 % max),
    bytes = new Uint32Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);
  return bytes[0] % max;
}
export default function Home() {
  const [lang, setLang] = useState<Lang>('en'),
    [session, setSession] = useState<Session | null>(null),
    [loaded, setLoaded] = useState(false),
    [selected, setSelected] = useState(0),
    [zoom, setZoom] = useState(false),
    [names, setNames] = useState<[string, string]>(['', '']),
    [reset, setReset] = useState(false),
    [saveError, setSaveError] = useState(false),
    [badSave, setBadSave] = useState(false);

  const [roomCode, setRoomCode] = useState(''),
    [roomInput, setRoomInput] = useState(''),
    [roomNotice, setRoomNotice] = useState(''),
    [roomToken, setRoomToken] = useState(''),
    [roomReady, setRoomReady] = useState(false),
    [roomBusy, setRoomBusy] = useState(false),
    [roomRole, setRoomRole] = useState<'host' | 'guest' | ''>(''),
    [roomNameDraft, setRoomNameDraft] = useState(''),
    [roomNameDirty, setRoomNameDirty] = useState(false),
    [roomPresence, setRoomPresence] = useState<Array<{ connected: boolean }>>(
      [],
    ),
    [online, setOnline] = useState(true),
    [pendingAction, setPendingAction] = useState<Action['type'] | null>(null),
    [roomRefresh, setRoomRefresh] = useState(0),
    [roomConnected, setRoomConnected] = useState(false),
    [soundEnabled, setSoundEnabled] = useState(true),
    [showMiniMap, setShowMiniMap] = useState(false),
    [isRolling, setIsRolling] = useState(false),
    [rollingDice, setRollingDice] = useState<[number, number] | null>(null),
    [activeReaction, setActiveReaction] = useState<ReactionEvent | null>(null),
    [displayPositions, setDisplayPositions] = useState<[number, number]>([0, 0]),
    [bonusPopup, setBonusPopup] = useState<{ active: boolean; at: number }>({ active: false, at: 0 }),
    [opponentToast, setOpponentToast] = useState<string | null>(null),
    [constructingSpace, setConstructingSpace] = useState<{
      space: number;
      level: number;
      kind: 'buy' | 'upgrade';
    } | null>(null),
    [tokenSpeechBubble, setTokenSpeechBubble] = useState<{
      player: number;
      mode: 'flight' | 'sail';
      toSpace: number;
      toName: string;
    } | null>(null),
    [targetTravelSpace, setTargetTravelSpace] = useState<number>(0),
    [cashDeltas, setCashDeltas] = useState<[CashDelta[], CashDelta[]]>([[], []]);
  const tokenBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCashRef = useRef<[number | null, number | null]>([null, null]),
    nextDeltaId = useRef(1);
  const mutation = useRef(false),
    epoch = useRef(0),
    lastProcessedReactionAt = useRef(0),
    lastLogCount = useRef(0),
    retiredMatches = useRef(new Set<string>());
  const current = useRef<Session | null>(null),
    boardRef = useRef<HTMLDivElement>(null);
  const copy = (en: string, ko: string, es: string) => ({ en, ko, es })[lang];
  const special = specialCopy[lang];
  const t = ui[lang],
    g = session?.game,
    s = board[selected],
    property = g?.properties[selected],
    myPlayerIndex = roomRole === 'host' ? 0 : roomRole === 'guest' ? 1 : -1;
  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      setRoomRefresh((value) => value + 1);
    };
    const handleOffline = () => setOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sound.unlock();
        setRoomRefresh((value) => value + 1);
      }
    };
    const handleGlobalUnlock = () => {
      sound.unlock();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pointerdown', handleGlobalUnlock, { once: true });
    window.addEventListener('touchstart', handleGlobalUnlock, { once: true });
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js');
    const initialRoom = roomFromLocation();
    if (initialRoom) {
      setRoomCode(initialRoom);
      setRoomInput(initialRoom);
      const savedToken = localStorage.getItem(`dubipoly.room.${initialRoom}`);
      if (savedToken) setRoomToken(savedToken);
    }
    try {
      const language = localStorage.getItem('dubipoly.lang');
      if (language === 'en' || language === 'ko' || language === 'es') {
        setLang(language);
        document.documentElement.lang = language;
      }
      const raw = localStorage.getItem(KEY);
      if (raw && !initialRoom) {
        const restored = restore(raw);
        if (restored) {
          current.current = restored;
          setSession(restored);
          setSelected(restored.game.players[restored.game.current].position);
        } else setBadSave(true);
      }
    } catch {
      setSaveError(true);
    }
    setLoaded(true);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pointerdown', handleGlobalUnlock);
      window.removeEventListener('touchstart', handleGlobalUnlock);
    };
  }, []);
  useEffect(() => {
    if (!roomCode || !roomToken) return;
    let stopped = false;
    let presenceAt = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function syncRoom() {
      const requestEpoch = epoch.current;
      try {
        if (mutation.current) return;
        const reportPresence =
          Date.now() - presenceAt >= 5000 || !current.current?.matchId;
        const response = await fetch(
          `/api/rooms?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(roomToken)}${!reportPresence && current.current?.matchId ? `&sync=1&match=${current.current.matchId}&revision=${current.current.game.revision}` : ''}`,
          {
            cache: 'no-store',
          },
        );
        if (stopped || requestEpoch !== epoch.current || mutation.current)
          return;
        if (!response.ok) throw new Error('Room unavailable');
        if (response.status === 204) {
          setRoomConnected(true);
          return;
        }
        if (reportPresence) presenceAt = Date.now();
        const snapshot = (await response.json()) as RoomSnapshot;
        if (stopped || requestEpoch !== epoch.current || mutation.current)
          return;
        setRoomConnected(true);
        setRoomNotice((previous) =>
          previous ===
            copy(
              'Checking the room connection.',
              '방 연결을 확인하는 중입니다.',
              'Comprobando la conexión de la sala.',
            ) ||
          previous ===
            copy(
              'Connection interrupted. Refreshing the room; please check the state before retrying.',
              '연결이 끊겼습니다. 방 상태를 확인한 뒤 다시 시도하세요.',
              'Conexión interrumpida. Comprueba el estado antes de reintentar.',
            )
            ? ''
            : previous,
        );
        setRoomReady(snapshot.ready);
        setRoomRole(
          snapshot.playerIndex === 0
            ? 'host'
            : snapshot.playerIndex === 1
              ? 'guest'
              : '',
        );
        if (snapshot.presence) setRoomPresence(snapshot.presence);
        if (snapshot.names) {
          setNames(snapshot.names);
          const playerIndex = snapshot.playerIndex ?? -1;
          if (!roomNameDirty && playerIndex >= 0)
            setRoomNameDraft(snapshot.names[playerIndex]);
        }
        if (snapshot.game && snapshot.save) applyRoomSnapshot(snapshot);
      } catch {
        if (!stopped) {
          setRoomConnected(false);
          setRoomNotice(
            copy(
              'Checking the room connection.',
              '방 연결을 확인하는 중입니다.',
              'Comprobando la conexión de la sala.',
            ),
          );
        }
      } finally {
        if (!stopped)
          timer = setTimeout(syncRoom, document.hidden ? 1500 : 500);
      }
    }
    void syncRoom();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [roomCode, roomToken, roomRefresh, lang, roomNameDirty]);
  function changeLanguage(l: Lang) {
    setLang(l);
    setRoomNotice('');
    document.documentElement.lang = l;
    try {
      localStorage.setItem('dubipoly.lang', l);
    } catch {
      setSaveError(true);
    }
  }

  useEffect(() => {
    if (!g) return;
    const target0 = g.players[0].position;
    const target1 = g.players[1].position;
    if (displayPositions[0] === target0 && displayPositions[1] === target1) return;

    const timer = setInterval(() => {
      setDisplayPositions(([p0, p1]) => {
        let next0 = p0;
        let next1 = p1;
        let moved = false;
        if (next0 !== target0) {
          next0 = (next0 + 1) % 40;
          moved = true;
        }
        if (next1 !== target1) {
          next1 = (next1 + 1) % 40;
          moved = true;
        }
        if (moved) {
          sound.playStep();
          triggerHaptic('light');
        }
        if (next0 === target0 && next1 === target1) {
          clearInterval(timer);
          setTokenSpeechBubble(null);
          if (tokenBubbleTimerRef.current) {
            clearTimeout(tokenBubbleTimerRef.current);
            tokenBubbleTimerRef.current = null;
          }
        }
        return [next0, next1];
      });
    }, 75);

    return () => clearInterval(timer);
  }, [g?.players[0]?.position, g?.players[1]?.position]);

  useEffect(() => {
    if (!g || g.logs.length === 0) return;
    const count = g.logs.length;
    if (count > lastLogCount.current) {
      lastLogCount.current = count;
      const latest = g.logs[count - 1];

      if (latest.kind === 'bonus') {
        sound.playCoin();
        setBonusPopup({ active: true, at: Date.now() });
        setTimeout(() => {
          setBonusPopup({ active: false, at: 0 });
        }, 2200);
      }

      if (latest.kind === 'event' && latest.event !== undefined) {
        sound.playFanfare();
      }

      if ((latest.kind === 'flight' || latest.kind === 'sail') && latest.space !== undefined) {
        if (tokenBubbleTimerRef.current) clearTimeout(tokenBubbleTimerRef.current);
        setTokenSpeechBubble({
          player: latest.player,
          mode: latest.kind === 'flight' ? 'flight' : 'sail',
          toSpace: latest.space,
          toName: board[latest.space].name[lang],
        });
        tokenBubbleTimerRef.current = setTimeout(() => {
          setTokenSpeechBubble(null);
        }, 5000);
      }

      if (latest.kind === 'rest' && latest.detail === 'rest-release') {
        sound.playFanfare();
      }

      if (roomToken && latest.player !== myPlayerIndex) {
        const desc = describe(latest, g, lang);
        setOpponentToast(desc ?? null);
        setTimeout(() => {
          setOpponentToast(null);
        }, 3500);
      }
    }
  }, [g?.logs?.length, g, roomToken, myPlayerIndex, lang]);

  useEffect(() => {
    if (!g || g.revision === 0) {
      prevCashRef.current = g ? [g.players[0].cash, g.players[1].cash] : [null, null];
      setCashDeltas([[], []]);
      return;
    }

    const p0Cash = g.players[0]?.cash;
    const p1Cash = g.players[1]?.cash;

    if (prevCashRef.current[0] === null || prevCashRef.current[1] === null) {
      prevCashRef.current = [p0Cash, p1Cash];
      return;
    }

    const [old0, old1] = prevCashRef.current;
    const d0 = p0Cash - old0;
    const d1 = p1Cash - old1;
    prevCashRef.current = [p0Cash, p1Cash];

    if (d0 !== 0 || d1 !== 0) {
      const newDeltas: [CashDelta[], CashDelta[]] = [[], []];

      if (d0 !== 0) {
        const id = nextDeltaId.current++;
        const text = d0 > 0 ? `+${d0.toLocaleString()} Dubi 💰` : `${d0.toLocaleString()} Dubi 💸`;
        newDeltas[0].push({ id, amount: d0, text });
        setTimeout(() => {
          setCashDeltas((prev) => [prev[0].filter((item) => item.id !== id), prev[1]]);
        }, 1800);
      }

      if (d1 !== 0) {
        const id = nextDeltaId.current++;
        const text = d1 > 0 ? `+${d1.toLocaleString()} Dubi 💰` : `${d1.toLocaleString()} Dubi 💸`;
        newDeltas[1].push({ id, amount: d1, text });
        setTimeout(() => {
          setCashDeltas((prev) => [prev[0], prev[1].filter((item) => item.id !== id)]);
        }, 1800);
      }

      setCashDeltas((prev) => [
        [...prev[0], ...newDeltas[0]],
        [...prev[1], ...newDeltas[1]],
      ]);
    }
  }, [g?.players[0]?.cash, g?.players[1]?.cash, g?.revision]);

  function commit(next: Session) {
    if (next.game.phase === 'finished' && current.current?.game.phase !== 'finished') {
      if (next.game.winner !== null) sound.playFanfare();
      else sound.playSad();
    }
    current.current = next;
    setSession(next);
    try {
      if (!roomCode) localStorage.setItem(KEY, JSON.stringify(next.save));
      setSaveError(false);
      setBadSave(false);
    } catch {
      setSaveError(true);
    }
  }

  async function roomWork(work: () => Promise<void>) {
    if (mutation.current || (roomToken && !navigator.onLine)) return;
    mutation.current = true;
    epoch.current++;
    setRoomBusy(true);
    try {
      await work();
    } catch {
      setRoomConnected(false);
      setRoomNotice(
        copy(
          'Connection interrupted. Refreshing the room; please check the state before retrying.',
          '연결이 끊겼습니다. 방 상태를 확인한 뒤 다시 시도하세요.',
          'Conexión interrumpida. Comprueba el estado antes de reintentar.',
        ),
      );
    } finally {
      mutation.current = false;
      epoch.current++;
      setRoomBusy(false);
      setRoomRefresh((value) => value + 1);
    }
  }
  async function createRoom() {
    const requestedName =
      names[0].trim() || copy('Traveler 1', '여행자 1', 'Viajero 1');
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: requestedName }),
    });
    if (!response.ok)
      return setRoomNotice(
        copy(
          'Unable to create the room.',
          '방을 만들지 못했습니다.',
          'No se pudo crear la sala.',
        ),
      );
    const result = (await response.json()) as RoomSnapshot & { token: string };
    current.current = null;
    setSession(null);
    setRoomConnected(true);
    setRoomCode(result.roomCode);
    setRoomInput(result.roomCode);
    setRoomToken(result.token);
    setRoomReady(result.ready);
    setRoomRole('host');
    setRoomPresence(result.presence ?? []);
    setNames(result.names);
    setRoomNameDraft(result.names[0] ?? requestedName);
    setRoomNameDirty(false);
    localStorage.setItem(`dubipoly.room.${result.roomCode}`, result.token);
    window.history.replaceState({}, '', roomUrl(result.roomCode));
    setRoomNotice(
      copy(
        'Room created. Enter this code on the other device.',
        '방이 만들어졌습니다. 다른 기기에서 코드를 입력하세요.',
        'Sala creada. Introduce el código en el otro dispositivo.',
      ),
    );
  }
  async function joinRoom() {
    const code = roomInput.trim();
    if (!/^\d{2}$/.test(code)) {
      setRoomNotice(
        copy(
          'Enter a 2-digit room code.',
          '두 자리 숫자 방 코드를 입력하세요.',
          'Escribe un código de sala de 2 dígitos.',
        ),
      );
      return;
    }
    const requestedName =
      names[0].trim() ||
      names[1].trim() ||
      copy('Traveler 2', '여행자 2', 'Viajero 2');
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        roomCode: code,
        name: requestedName,
        token: localStorage.getItem(`dubipoly.room.${code}`),
      }),
    });
    if (!response.ok) {
      setRoomNotice(
        copy(
          'Room not found or already full.',
          '방을 찾을 수 없거나 이미 가득 찼습니다.',
          'La sala no existe o está llena.',
        ),
      );
      return;
    }
    const result = (await response.json()) as RoomSnapshot & { token: string };
    setRoomCode(result.roomCode);
    setRoomToken(result.token);
    setRoomReady(result.ready);
    current.current = null;
    setSession(null);
    setRoomConnected(true);
    setRoomRole(result.role ?? 'guest');
    setRoomPresence(result.presence ?? []);
    localStorage.setItem(`dubipoly.room.${result.roomCode}`, result.token);
    setNames(result.names);
    setRoomNameDraft(
      result.names[result.role === 'host' ? 0 : 1] ?? requestedName,
    );
    applyRoomSnapshot(result);
    setRoomNameDirty(false);
    window.history.replaceState({}, '', roomUrl(code));
    setRoomNotice(
      copy(
        'Joined the room. Both players are ready.',
        '방에 참가했습니다. 두 플레이어가 준비되었습니다.',
        'Sala conectada. Los dos jugadores están listos.',
      ),
    );
  }
  async function renameRoom() {
    const name = roomNameDraft.trim();
    if (!roomCode || !roomToken || !name) {
      setRoomNotice(
        copy(
          'Enter your name first.',
          '이름을 먼저 입력하세요.',
          'Escribe tu nombre primero.',
        ),
      );
      return;
    }
    setRoomBusy(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          roomCode,
          token: roomToken,
          name,
        }),
      });
      if (!response.ok) {
        setRoomNotice(
          copy(
            'Your name could not be saved.',
            '이름을 저장하지 못했습니다.',
            'No se pudo guardar tu nombre.',
          ),
        );
        return;
      }
      const snapshot = (await response.json()) as RoomSnapshot;
      setNames(snapshot.names);
      setRoomNameDraft(name);
      setRoomNameDirty(false);
      setRoomNotice(
        copy('Name saved.', '이름을 저장했습니다.', 'Nombre guardado.'),
      );
      if (snapshot.game && snapshot.save) applyRoomSnapshot(snapshot);
    } finally {
      setRoomBusy(false);
    }
  }
  function applyRoomSnapshot(snapshot: RoomSnapshot) {
    if (!snapshot.game || !snapshot.save) return;
    if (retiredMatches.current.has(snapshot.matchId)) return;
    const next = {
      game: snapshot.game,
      save: snapshot.save,
      matchId: snapshot.matchId,
    };
    const previous = current.current;
    if (
      previous?.matchId === next.matchId &&
      previous.game.revision >= next.game.revision
    )
      return;
    if (previous?.matchId && previous.matchId !== next.matchId) {
      retiredMatches.current.add(previous.matchId);
      setReset(false);
    }
    if (snapshot.game.phase === 'finished' && previous?.game.phase !== 'finished') {
      if (snapshot.game.winner !== null) sound.playFanfare();
      else sound.playSad();
    }
    if (snapshot.reaction && snapshot.reaction.at > lastProcessedReactionAt.current) {
      lastProcessedReactionAt.current = snapshot.reaction.at;
      const reactorIndex = snapshot.reaction.player;
      const reactorName = snapshot.names[reactorIndex] ?? `Traveler ${reactorIndex + 1}`;
      setActiveReaction({
        player: reactorIndex,
        emoji: snapshot.reaction.emoji,
        name: reactorName,
        id: snapshot.reaction.at,
      });
      sound.playPop();
    }
    current.current = next;
    setSession(next);
    setSelected(next.game.players[next.game.current].position);
  }

  async function handleSendReaction(emoji: string) {
    const myIndex = roomRole === 'host' ? 0 : roomRole === 'guest' ? 1 : (g?.current ?? 0);
    const myName = names[myIndex] || (myIndex === 0 ? copy('Traveler 1', '여행자 1', 'Viajero 1') : copy('Traveler 2', '여행자 2', 'Viajero 2'));
    setActiveReaction({
      player: myIndex,
      emoji,
      name: myName,
      id: Date.now(),
    });

    if (roomCode && roomToken) {
      try {
        await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: roomToken,
            type: 'reaction',
            emoji,
          }),
        });
      } catch {
        // network reaction fallback
      }
    }
  }
  async function startRoom(rematch = false) {
    if (!roomCode || !roomToken) return;
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: rematch ? 'rematch' : 'start',
        roomCode,
        token: roomToken,
        matchId: current.current?.matchId,
      }),
    });
    if (!response.ok) {
      setRoomNotice(
        response.status === 409
          ? copy(
              'Both players must join before starting.',
              '두 플레이어가 모두 들어와야 시작할 수 있어요.',
              'Deben entrar los dos jugadores para empezar.',
            )
          : copy(
              'Only the host can start.',
              '방장만 게임을 시작할 수 있어요.',
              'Solo el anfitrión puede empezar.',
            ),
      );
      return;
    }
    const snapshot = (await response.json()) as RoomSnapshot;
    setRoomReady(snapshot.ready);
    setRoomPresence(snapshot.presence ?? []);
    applyRoomSnapshot(snapshot);
    setReset(false);
    setRoomNotice('');
  }
  async function shareRoom() {
    if (!roomCode) return;
    const url = roomUrl(roomCode);
    const browserNavigator = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    try {
      if (browserNavigator.share) {
        await browserNavigator.share({
          title: 'Dubipoly',
          text: roomCode,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setRoomNotice(
        copy(
          'Room link shared.',
          '방 링크를 공유했습니다.',
          'Enlace de sala compartido.',
        ),
      );
    } catch {
      setRoomNotice(
        `${copy('Send this link:', '이 링크를 보내세요:', 'Envía este enlace:')} ${url}`,
      );
    }
  }
  function start() {
    const actual = names.map(
      (n, i) => n.trim() || `${copy('Traveler', '여행자', 'Viajero')} ${i + 1}`,
    ) as [string, string];
    commit({
      game: createGame(actual),
      save: { version: 2, names: actual, actions: [] },
    });
    setSelected(0);
    setReset(false);
  }
  async function act(a: Action, revision: number) {
    const old = current.current;
    if (!old) return;

    if (a.type === 'roll') {
      sound.playDice();
      triggerHaptic('medium');
      setIsRolling(true);
      const isSingle = old.game.players[old.game.current].nextRollModifier === 'single';
      const interval = setInterval(() => {
        setRollingDice(
          isSingle
            ? [randomInt(6) + 1, 0]
            : [randomInt(6) + 1, randomInt(6) + 1],
        );
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        setIsRolling(false);
        setRollingDice(null);
      }, 400);
    } else if (a.type === 'buy') {
      sound.playCoin();
      triggerHaptic('light');
      const pos = old.game.players[old.game.current].position;
      setConstructingSpace({ space: pos, level: 0, kind: 'buy' });
      setTimeout(() => setConstructingSpace(null), 1500);
    } else if (a.type === 'upgrade') {
      sound.playBuild();
      triggerHaptic('light');
      const pos = old.game.players[old.game.current].position;
      const nextLevel = (old.game.properties[pos]?.level ?? 0) + 1;
      setConstructingSpace({ space: pos, level: nextLevel, kind: 'upgrade' });
      setTimeout(() => setConstructingSpace(null), 1500);
    } else if (a.type === 'fly') {
      sound.playCoin();
      triggerHaptic('medium');
      if (tokenBubbleTimerRef.current) clearTimeout(tokenBubbleTimerRef.current);
      setTokenSpeechBubble({
        player: old.game.current,
        mode: 'flight',
        toSpace: a.space,
        toName: board[a.space].name[lang],
      });
      tokenBubbleTimerRef.current = setTimeout(() => {
        setTokenSpeechBubble(null);
      }, 5000);
    } else if (a.type === 'sail') {
      sound.playCoin();
      triggerHaptic('medium');
      if (tokenBubbleTimerRef.current) clearTimeout(tokenBubbleTimerRef.current);
      setTokenSpeechBubble({
        player: old.game.current,
        mode: 'sail',
        toSpace: a.space,
        toName: board[a.space].name[lang],
      });
      tokenBubbleTimerRef.current = setTimeout(() => {
        setTokenSpeechBubble(null);
      }, 5000);
    } else if (a.type === 'sell' || a.type === 'bail') {
      sound.playCoin();
      triggerHaptic('light');
    } else if (a.type === 'end' || a.type === 'skipFly' || a.type === 'skipSail') {
      sound.playPop();
    }

    if (roomCode && roomToken) {
      if (old.game.current !== (roomRole === 'host' ? 0 : 1)) return;
      setRoomBusy(true);
      setPendingAction(a.type);
      if (a.type !== 'roll') {
        const predicted = transition(old.game, a, old.game.current, revision);
        if (predicted !== old.game) setSession({ ...old, game: predicted });
      }
      let accepted = false;
      try {
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomCode)}/actions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: roomToken,
              matchId: old.matchId,
              type: a.type,
              space: (a.type === 'sell' || a.type === 'fly' || a.type === 'sail') ? a.space : undefined,
              revision,
              requestId: crypto.randomUUID(),
            }),
          },
        );
        if (!response.ok) {
          setRoomNotice(
            response.status === 409
              ? copy(
                  'The room state changed. Fetching the latest state.',
                  '다른 기기에서 상태가 바뀌었습니다. 최신 상태를 다시 불러옵니다.',
                  'El otro dispositivo cambió el estado. Actualizando la partida.',
                )
              : copy(
                  'Unable to connect to the room.',
                  '방 서버와 연결할 수 없습니다.',
                  'No se pudo conectar con la sala.',
                ),
          );
          if (response.status === 409) setRoomRefresh((value) => value + 1);
          return;
        }
        applyRoomSnapshot((await response.json()) as RoomSnapshot);
        accepted = true;
        setRoomConnected(true);
        setRoomNotice('');
      } finally {
        if (!accepted) setSession(current.current);
        setPendingAction(null);
        setRoomBusy(false);
      }
      return;
    }
    const game = transition(old.game, a, old.game.current, revision);
    if (game === old.game) return;
    commit({ game, save: { ...old.save, actions: [...old.save.actions, a] } });
    setSelected(game.players[game.current].position);
  }
  function follow() {
    if (!g) return;
    const pos =
      g.players[
        roomToken && roomRole ? (roomRole === 'host' ? 0 : 1) : g.current
      ].position;
    setSelected(pos);
    const cell = boardRef.current?.querySelector<HTMLElement>(
      `[data-space="${pos}"]`,
    );
    cell?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }
  const active = g?.players[g.current],
    isMyTurn = myPlayerIndex >= 0 && g?.current === myPlayerIndex,
    landed = active ? board[active.position] : null,
    owned = g && active ? g.properties[active.position] : undefined;
  const actionsBlocked =
    reset ||
    roomBusy ||
    Boolean(roomToken && (!isMyTurn || !online || !roomConnected));
  const myPosition =
    g?.players[myPlayerIndex >= 0 ? (myPlayerIndex as PlayerId) : g.current]
      .position;
  const tourist = landed?.kind === 'tourist' && g?.rulesVersion === 2;
  const extraRoll = g?.rulesVersion === 2 && g.extraRoll;
  const inRest = g?.rulesVersion === 2 && g.restTurns?.[g.current] != null;
  const hasPropertyAction = !!g && (canBuy(g) || canUpgrade(g));
  const endEmphasized =
    !!g &&
    (g.phase === 'choice' || g.phase === 'end') &&
    !extraRoll &&
    !hasPropertyAction;
  const travelActor = (roomToken && myPlayerIndex >= 0 ? myPlayerIndex : g?.current ?? 0) as PlayerId;
  const isAirportActive = Boolean(g && canFly(g, travelActor));
  const isHarborActive = Boolean(g && canSail(g, travelActor));
  const isTravelSelection = isAirportActive || isHarborActive;
  return (
    <main
      data-match-id={session?.matchId ?? ''}
      data-revision={g?.revision}
      data-phase={g?.phase}
      data-current={g?.current}
      data-round={g?.round}
      data-winner={g?.winner ?? ''}
      data-rules-version={g?.rulesVersion ?? 1}
      data-extra-roll={String(!!extraRoll)}
      data-pending={pendingAction ?? ''}
    >
      <header>
        <a className="wordmark" href="/">
          Dubi<span>poly</span> ✈
        </a>
        <span className="route-label">KOREA ··· ✈ ··· PERÚ</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full p-0 text-base"
            onClick={() => {
              const next = sound.toggle();
              setSoundEnabled(next);
            }}
            title={soundEnabled ? t.soundOn : t.soundOff}
            aria-label={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </Button>
          <label className="language-options">
            <span>{copy('Language', '언어', 'Idioma')}</span>
            <select
              aria-label={copy('Language', '언어', 'Idioma')}
              value={lang}
              onChange={(event) => changeLanguage(event.target.value as Lang)}
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
              <option value="es">Español</option>
            </select>
          </label>
        </div>
      </header>
      {!online && (
        <p className="network-banner offline" role="status">
          {copy(
            'You are offline. The room will refresh when your connection returns.',
            '오프라인 상태입니다. 연결이 돌아오면 방 상태를 다시 확인합니다.',
            'Estás sin conexión. La sala se actualizará al volver la conexión.',
          )}
        </p>
      )}
      {online && roomCode && roomToken && (
        <p className="network-banner online" role="status">
          {roomConnected
            ? copy(
                'Connected to the room',
                '방 서버에 연결됨',
                'Conectado a la sala',
              )
            : copy('Connecting…', '연결 확인 중…', 'Conectando…')}{' '}
          · {roomCode}
        </p>
      )}
      <div className="toolbar">
        <div>
          <h1>{t.title}</h1>
          <p>
            {roomToken
              ? copy(
                  'Online · 2 players',
                  '온라인 · 2인 플레이',
                  'En línea · 2 jugadores',
                )
              : t.mode}
            {g ? ` · ${t.round} ${g.round}/${rules.rounds}` : ''}
          </p>
        </div>
        <div className="toolbar-actions">
          {g && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMiniMap(true)}
              title={t.miniMap}
              aria-label={t.miniMap}
            >
              🗺️
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setZoom(!zoom)}
            aria-pressed={zoom}
          >
            {zoom ? t.fit : t.zoom} ⤢
          </Button>
          {g && (
            <Button
              variant="outline"
              disabled={roomBusy || Boolean(roomToken && roomRole !== 'host')}
              onClick={() => setReset(true)}
            >
              {t.new}
            </Button>
          )}
        </div>
      </div>
      {opponentToast && (
        <aside
          aria-label="Opponent action notification"
          className="mx-auto mb-2 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-teal-200 bg-white/95 px-4 py-2 text-xs font-bold text-teal-900 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="text-base">📢</span>
          <span className="flex-1">{opponentToast}</span>
        </aside>
      )}
      {g && g.round >= rules.rounds - 5 && g.phase !== 'finished' && (
        <aside
          aria-label="Fever time announcement"
          className="fever-shimmer mx-auto mb-3 flex w-full max-w-lg items-center justify-between rounded-2xl px-4 py-1.5 text-xs font-extrabold text-amber-950 shadow-md border border-amber-300"
        >
          <span>
            {g.round === rules.rounds
              ? `🏁 ${copy('FINAL ROUND! Match concludes after this round.', `마지막 ${rules.rounds}라운드! 이번 라운드 종료 시 최종 승자가 결정됩니다.`, '¡ÚLTIMA RONDA! La partida finaliza tras esta ronda.')}`
              : `✨ ${copy('Golden Travel Fever Time!', '골든 트래블 피버 타임!', '¡Viaje Dorado!')}`}
          </span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px]">
            {g.round === rules.rounds
              ? copy(`Final ${rules.rounds}/${rules.rounds}`, `마지막 ${rules.rounds}/${rules.rounds}`, `Final ${rules.rounds}/${rules.rounds}`)
              : copy(`${rules.rounds - g.round + 1} rounds left`, `남은 ${rules.rounds - g.round + 1}라운드`, `Quedan ${rules.rounds - g.round + 1} rondas`)}
          </span>
        </aside>
      )}
      {bonusPopup.active && (
        <aside
          aria-label="Salary bonus notification"
          className="animate-bonus-float fixed top-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-amber-300 bg-gradient-to-r from-amber-400 to-yellow-300 px-5 py-2.5 text-sm font-black text-amber-950 shadow-2xl"
        >
          <span className="text-xl">💰</span>
          <span>{copy('+200 Dubi Start Salary!', '출발점 통과! +200 Dubi 월급 지급!', '¡+200 Dubi por pasar por Salida!')}</span>
        </aside>
      )}
      {roomNotice && (
        <p className="room-notice" role="status">
          {roomNotice}
        </p>
      )}
      {!loaded ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          {(saveError || badSave) && (
            <p className="save-warning" role="alert">
              {saveError ? t.saveFail : t.badSave}
            </p>
          )}
          {(!g || reset) && (
            <section className="setup">
              <h2>{reset ? t.confirm : t.start}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (roomCode && roomToken)
                    void roomWork(() => startRoom(reset));
                  else start();
                }}
              >
                {roomCode && roomToken ? (
                  <div className="name-fields room-name-edit">
                    <label>
                      {copy('Your name', '내 이름', 'Tu nombre')}
                      <Input
                        maxLength={24}
                        aria-label={copy('Your name', '내 이름', 'Tu nombre')}
                        placeholder={copy(
                          'Traveler 1 or Traveler 2',
                          '여행자 1 또는 여행자 2',
                          'Viajero 1 o Viajero 2',
                        )}
                        value={roomNameDraft}
                        onChange={(e) => {
                          setRoomNameDraft(e.target.value);
                          setRoomNameDirty(true);
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void roomWork(renameRoom)}
                      disabled={roomBusy || !roomNameDirty}
                    >
                      {copy('Save name', '이름 저장', 'Guardar nombre')}
                    </Button>
                  </div>
                ) : (
                  <div className="name-fields">
                    {[0, 1].map((i) => (
                      <label key={i}>
                        {t.name} {i + 1}
                        <Input
                          maxLength={24}
                          aria-label={`${t.name} ${i + 1}`}
                          placeholder={`${copy('Traveler', '여행자', 'Viajero')} ${i + 1}`}
                          value={names[i]}
                          onChange={(e) =>
                            setNames(
                              (previous) =>
                                previous.map((n, j) =>
                                  i === j ? e.target.value : n,
                                ) as [string, string],
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="setup-actions">
                  <Button
                    type="submit"
                    disabled={
                      roomBusy ||
                      Boolean(
                        roomCode &&
                        roomToken &&
                        (roomRole !== 'host' ||
                          !roomReady ||
                          !online ||
                          !roomConnected ||
                          roomNameDirty),
                      )
                    }
                  >
                    {reset
                      ? t.yes
                      : roomCode && roomToken
                        ? roomRole === 'guest'
                          ? copy(
                              'Waiting for the host',
                              '방장 시작 대기',
                              'Esperar al anfitrión',
                            )
                          : roomReady
                            ? copy('Start game', '게임 시작', 'Empezar partida')
                            : copy(
                                'Waiting for a player',
                                '플레이어 대기',
                                'Esperar jugador',
                              )
                        : t.start}{' '}
                    ✈
                  </Button>
                  {reset && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setReset(false)}
                    >
                      {t.cancel}
                    </Button>
                  )}
                </div>
              </form>
              <div className="room-lobby">
                <p className="eyebrow">
                  {copy(
                    'Play on two devices',
                    '두 기기로 함께 플레이',
                    'Jugar en dos dispositivos',
                  )}
                </p>
                <div className="room-actions" hidden={Boolean(roomToken)}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={roomBusy}
                    onClick={() => void roomWork(createRoom)}
                  >
                    {copy('Create room', '방 만들기', 'Crear sala')}
                  </Button>
                  <Input
                    maxLength={2}
                    inputMode="numeric"
                    aria-label={copy('Room code', '방 코드', 'Código de sala')}
                    placeholder="27"
                    value={roomInput}
                    onChange={(e) =>
                      setRoomInput(
                        e.target.value.replace(/\D/g, '').slice(0, 2),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={roomBusy}
                    onClick={() => void roomWork(joinRoom)}
                  >
                    {copy('Join', '참가', 'Unirse')}
                  </Button>
                </div>
                {roomCode && (
                  <p className="room-code">
                    {copy('Current room:', '현재 방:', 'Sala actual:')}{' '}
                    <strong>{roomCode}</strong>
                    {roomToken ? ' · ✓' : ''}
                    <br />
                    {roomRole === 'host'
                      ? copy('Host', '방장', 'Anfitrión')
                      : roomRole === 'guest'
                        ? copy('Guest', '참가자', 'Invitado')
                        : ''}{' '}
                    · {roomPresence.filter((player) => player.connected).length}
                    /2 {copy('connected', '접속', 'conectados')}
                    <br />
                    {copy('Your name:', '내 이름:', 'Tu nombre:')}{' '}
                    <strong>
                      {names[roomRole === 'host' ? 0 : 1] || roomNameDraft}
                    </strong>
                    <br />
                    {roomReady
                      ? copy(
                          'Both players are ready. The host can start.',
                          '두 플레이어 준비 완료 · 방장이 시작할 수 있어요.',
                          'Dos jugadores listos · el anfitrión puede empezar.',
                        )
                      : copy(
                          'Waiting for the other player…',
                          '다른 플레이어를 기다리는 중…',
                          'Esperando al otro jugador…',
                        )}
                  </p>
                )}
                {roomCode && (
                  <div className="mt-3 w-full max-w-xs mx-auto">
                    <RoomQrCode
                      url={roomUrl(roomCode)}
                      roomCode={roomCode}
                      lang={lang}
                    />
                  </div>
                )}
                {roomCode && roomToken && (
                  <div className="room-actions room-share-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRoomRefresh((value) => value + 1)}
                      disabled={!online || roomBusy}
                    >
                      {copy(
                        'Refresh room',
                        '상태 새로고침',
                        'Actualizar estado',
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={shareRoom}>
                      {copy('Share room', '방 링크 공유', 'Compartir sala')}
                    </Button>
                    <span
                      className="presence-dots"
                      aria-label={`${roomPresence.filter((player) => player.connected).length}/2 connected`}
                    >
                      {roomPresence.map((player, index) => (
                        <span
                          key={index}
                          className={
                            player.connected
                              ? 'presence-dot connected'
                              : 'presence-dot'
                          }
                        >
                          {player.connected ? '●' : '○'} {index + 1}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}
          {g && roomToken && !reset && (
            <details className="rules">
              <summary>
                {copy(
                  'Your name / Room',
                  '내 이름 / 방 정보',
                  'Tu nombre / Sala',
                )}{' '}
                · {myPlayerIndex >= 0 ? names[myPlayerIndex as PlayerId] : ''} ·{' '}
                {roomCode}
              </summary>
              <label>
                {copy('Your name', '내 이름', 'Tu nombre')}
                <Input
                  aria-label={copy('Your name', '내 이름', 'Tu nombre')}
                  maxLength={24}
                  value={roomNameDraft}
                  onChange={(e) => {
                    setRoomNameDraft(e.target.value);
                    setRoomNameDirty(true);
                  }}
                />
              </label>
              <Button
                disabled={roomBusy || !roomNameDirty || !roomNameDraft.trim()}
                onClick={() => void roomWork(renameRoom)}
              >
                {copy('Save name', '이름 저장', 'Guardar nombre')}
              </Button>
              <Button variant="outline" onClick={shareRoom}>
                {copy('Share room', '방 링크 공유', 'Compartir sala')}
              </Button>
            </details>
          )}
          <div className="workspace">
            <section
              className="board-scroll"
              tabIndex={0}
              aria-label="Dubipoly board"
            >
              <div ref={boardRef} className={`board ${zoom ? 'zoom' : ''}`}>
                <div className="board-center">
                  {/* 4 Corner Dubu Mascot Watermarks */}
                  <div className="board-corner-mascot corner-top-left" aria-hidden="true">
                    <img src="/dubu-mascot.png" alt="" className="corner-mascot-img" />
                    <span className="corner-mascot-label">DUBU</span>
                  </div>
                  <div className="board-corner-mascot corner-top-right" aria-hidden="true">
                    <img src="/dubu-mascot.png" alt="" className="corner-mascot-img" />
                    <span className="corner-mascot-label">DUBU</span>
                  </div>
                  <div className="board-corner-mascot corner-bottom-left" aria-hidden="true">
                    <img src="/dubu-mascot.png" alt="" className="corner-mascot-img" />
                    <span className="corner-mascot-label">DUBU</span>
                  </div>
                  <div className="board-corner-mascot corner-bottom-right" aria-hidden="true">
                    <img src="/dubu-mascot.png" alt="" className="corner-mascot-img" />
                    <span className="corner-mascot-label">DUBU</span>
                  </div>

                  {g ? (
                    <BoardCenterHub
                      game={g}
                      names={names}
                      cashDeltas={cashDeltas}
                      roomToken={roomToken}
                      myPlayerIndex={myPlayerIndex}
                      lang={lang}
                    />
                  ) : (
                    <>
                      <div className="postmark">
                        SEOUL ↔ LIMA <span>40 STOPS · 2 TRAVELERS</span>
                      </div>
                      <h2>
                        Dubi<span>poly</span>
                      </h2>
                      <p className="center-route">🇰🇷 ··· ✈ ··· 🇵🇪</p>
                      <img
                        className="dubu"
                        src="/dubu-mascot.png"
                        alt="Dubu the cat mascot"
                      />
                      <p className="photo-caption">Dubu ♥</p>
                      <div className="legend">
                        <span>● {t.korea}</span>
                        <span>● {t.peru}</span>
                      </div>
                    </>
                  )}
                </div>
                {board.map((x) => {
                  const p = g?.properties[x.index];
                  const isSelectedDest = isTravelSelection && targetTravelSpace === x.index;
                  const isLandmark = Boolean(p && p.level >= 3);
                  const hasBubble = tokenSpeechBubble && (displayPositions[tokenSpeechBubble.player] ?? g?.players[tokenSpeechBubble.player]?.position) === x.index;
                  return (
                    <button
                      key={x.index}
                      data-space={x.index}
                      data-kind={x.kind ?? x.type}
                      data-my-position={String(myPosition === x.index)}
                      data-owner={p?.owner ?? ''}
                      data-level={p?.level ?? ''}
                      className={`tile ${x.country ?? 'special'} ${x.type !== 'city' ? 'event' : ''} ${x.kind === 'tourist' ? 'tourist-tile' : ''} ${p ? `owned-tile owned-by-${p.owner} building-tier-${p.level} ${isLandmark ? 'has-landmark' : ''}` : ''} ${myPosition === x.index ? 'my-position' : ''} ${selected === x.index ? 'selected' : ''} ${constructingSpace?.space === x.index ? 'is-constructing' : ''} ${isTravelSelection ? 'is-travel-target' : ''} ${isSelectedDest ? 'is-selected-destination' : ''} ${hasBubble ? 'has-speech-bubble' : ''}`}
                      style={{ gridRow: x.row, gridColumn: x.col }}
                      aria-label={`${x.index + 1}. ${x.name[lang]}${p ? ` · ${g!.players[p.owner].name} · ${t.level} ${p.level}` : ''}`}
                      aria-pressed={selected === x.index}
                      onClick={() => {
                        setSelected(x.index);
                        setTargetTravelSpace(x.index);
                        if (isTravelSelection) {
                          sound.playPop();
                          triggerHaptic('light');
                        }
                      }}
                    >
                      {p && (
                        <div
                          className={`tile-owner-bar owner-bar-${p.owner}`}
                          title={`${g!.players[p.owner].name} · ${p.level ? `Lv.${p.level}` : copy('Land', '토지', 'Terreno')}`}
                        >
                          <span className="owner-bar-dot">{p.owner === 0 ? '● P1' : '◆ P2'}</span>
                          {isLandmark && <span className="owner-bar-crown">👑</span>}
                        </div>
                      )}
                      {isSelectedDest && (
                        <span
                          className="destination-target-pin"
                          title={copy('Destination', '목적지', 'Destino')}
                        >
                          {isAirportActive ? '🛬' : '⚓'}
                        </span>
                      )}
                      {constructingSpace?.space === x.index && (
                        <span className="construction-popup">
                          {constructingSpace.kind === 'buy'
                            ? copy('Land bought! 🏗️', '토지 매입! 🏗️', '¡Terreno comprado! 🏗️')
                            : copy(
                                `Upgrade Lv.${constructingSpace.level}! 🔨`,
                                `건물 증축 Lv.${constructingSpace.level}! 🔨`,
                                `¡Mejora Nv.${constructingSpace.level}! 🔨`,
                              )}
                        </span>
                      )}
                      <span className="tile-number">
                        {String(x.index + 1).padStart(2, '0')}
                      </span>
                      <span className="tile-icon" aria-hidden="true">
                        {x.icon}
                      </span>
                      <span className="tile-name">
                        {x.index === rules.airportSpace && g?.rulesVersion === 2
                          ? special.airport
                          : x.index === rules.harborSpace && g?.rulesVersion === 2
                            ? special.harbor
                            : x.name[lang]}
                      </span>
                      {x.kind === 'tourist' && (
                        <span
                          className="tourist-badge"
                          title={special.tourist}
                          aria-label={special.tourist}
                        >
                          ✦
                        </span>
                      )}
                      {myPosition === x.index && (
                        <span
                          className="position-marker"
                          aria-label={special.youHere}
                        >
                          ▼
                        </span>
                      )}
                      {p ? (
                        <div className={`tile-building-showcase owner-${p.owner} tier-${p.level}`}>
                          <div className="building-graphic-row">
                            {x.kind === 'tourist' ? (
                              <span className="building-graphic tourist-graphic" title={special.tourist}>
                                🏖️
                              </span>
                            ) : p.level === 0 ? (
                              <span className="building-graphic land-flag" title={copy('Owned Land', '보유 토지', 'Terreno')}>
                                🚩
                              </span>
                            ) : p.level === 1 ? (
                              <span className="building-graphic house-graphic" title={copy('House Lv.1', '별장 1단계', 'Casa Nv.1')}>
                                🏡
                              </span>
                            ) : p.level === 2 ? (
                              <span className="building-graphic hotel-graphic" title={copy('Hotel Lv.2', '빌딩 2단계', 'Hotel Nv.2')}>
                                🏢
                              </span>
                            ) : (
                              <span className="building-graphic landmark-graphic" title={copy('Landmark Lv.3', '랜드마크 3단계', 'Monumento Nv.3')}>
                                🏰
                              </span>
                            )}
                            {p.level > 0 && x.kind !== 'tourist' && (
                              <span className="building-stars">
                                {'★'.repeat(p.level)}
                              </span>
                            )}
                          </div>
                          {g && (
                            <span className="tile-rent-badge" title={copy('Rent', '방문료', 'Alquiler')}>
                              <small>💸</small>{rentAt(g, x.index)}
                            </span>
                          )}
                        </div>
                      ) : (
                        x.price && <span className="tile-price">{x.price}</span>
                      )}
                      <span className="tokens">
                        {g?.players.map((p, i) =>
                          (displayPositions[i] ?? p.position) === x.index ? (
                            <span
                              key={i}
                              className={`token token-${i} token-hopping ${tokenSpeechBubble?.player === i ? 'token-has-bubble' : ''}`}
                              title={p.name}
                              aria-label={p.name}
                            >
                              {i + 1}
                              {tokenSpeechBubble?.player === i && (
                                <span
                                  className={`token-speech-bubble bubble-${tokenSpeechBubble.mode} ${x.row === 1 ? 'bubble-pos-below' : 'bubble-pos-above'}`}
                                  role="status"
                                  aria-label={`${tokenSpeechBubble.mode === 'flight' ? 'Flight to' : 'Voyage to'} ${tokenSpeechBubble.toName}`}
                                >
                                  <span className="bubble-icon">
                                    {tokenSpeechBubble.mode === 'flight' ? '✈️' : '🚢'}
                                  </span>
                                  <span className="bubble-dest">{tokenSpeechBubble.toName}</span>
                                  <span className="bubble-arrow" />
                                </span>
                              )}
                            </span>
                          ) : null,
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <aside>
              {g && (
                <>
                  <div className="players">
                    {g.players.map((p, i) => (
                      <section
                        className={`player player-${i + 1} ${g.current === i && g.phase !== 'finished' ? 'active-player' : ''} ${roomToken && i === myPlayerIndex ? 'my-player' : ''}`}
                        key={i}
                        data-player={i}
                        data-cash={p.cash}
                        data-position={p.position}
                      >
                        <img
                          className="player-mascot"
                          src="/dubu-mascot.png"
                          alt="Dubu"
                        />
                        <div>
                          <span className="player-name">
                            {i + 1}. {p.name}
                          </span>
                          {roomToken && (
                            <span className="player-role">
                              {i === myPlayerIndex
                                ? copy('You', '나', 'Tú')
                                : copy('Opponent', '상대', 'Oponente')}
                              {g.current === i && g.phase !== 'finished'
                                ? ` · ${copy('Current turn', '현재 턴', 'Turno actual')}`
                                : ''}
                            </span>
                          )}
                          <strong className="player-cash-display">
                            <span className="coin">🐾</span>{' '}
                            {p.cash.toLocaleString()} <small>Dubi</small>
                            <span className="cash-delta-container">
                              {cashDeltas[i]?.map((delta) => (
                                <span
                                  key={delta.id}
                                  className={`cash-delta-badge ${delta.amount > 0 ? 'is-gain' : 'is-loss'}`}
                                >
                                  {delta.text}
                                </span>
                              ))}
                            </span>
                          </strong>
                          <p>
                            {t.assets}:{' '}
                            {assets(g, i as PlayerId).toLocaleString()}
                          </p>
                          {((p.startBonusBonus && p.startBonusBonus > 0) ||
                            p.nextRollModifier ||
                            (p.freePasses && p.freePasses > 0)) && (
                            <div className="player-buffs flex flex-wrap gap-1 mt-1">
                              {p.startBonusBonus && p.startBonusBonus > 0 ? (
                                <span
                                  className="player-buff-chip buff-salary"
                                  title={copy(
                                    `Start salary bonus: +${p.startBonusBonus} Dubi`,
                                    `출발선 월급 추가 보너스: +${p.startBonusBonus} Dubi`,
                                    `Bono de salida: +${p.startBonusBonus} Dubi`,
                                  )}
                                >
                                  💼 +{p.startBonusBonus}
                                </span>
                              ) : null}
                              {p.nextRollModifier === 'single' && (
                                <span
                                  className="player-buff-chip buff-single"
                                  title={copy(
                                    'Next roll uses 1 die (1~6)',
                                    '다음 주사위는 1개만 굴림 (1~6)',
                                    'Siguiente tirada: 1 dado (1~6)',
                                  )}
                                >
                                  🚶 {copy('1 Die', '주사위 1개', '1 Dado')}
                                </span>
                              )}
                              {p.nextRollModifier === 'doubles' && (
                                <span
                                  className="player-buff-chip buff-doubles"
                                  title={copy(
                                    'Next roll is guaranteed doubles!',
                                    '다음 주사위 무조건 더블!',
                                    '¡Siguiente tirada: dobles garantizados!',
                                  )}
                                >
                                  ✨ {copy('Doubles', '더블 확정', 'Dobles')}
                                </span>
                              )}
                              {p.freePasses && p.freePasses > 0 ? (
                                <span
                                  className="player-buff-chip buff-pass"
                                  title={copy(
                                    'Free rent pass remaining',
                                    '통행료 면제권 보유',
                                    'Pase de peaje gratuito',
                                  )}
                                >
                                  🎫 {copy('Pass', '면제권', 'Pase')} ×{p.freePasses}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                  {g.phase === 'finished' ? (
                    <section className="result" role="status">
                      <p>🏆 {t.finished}</p>
                      <h2>
                        {g.winner === 'tie'
                          ? t.tie
                          : `${g.players[g.winner!].name} · ${t.win}`}
                      </h2>
                      <div
                        style={{
                          margin: '8px 0 12px',
                          display: 'flex',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            background:
                              g.reason === 'bankruptcy' ? '#fee2e2' : '#e0f2fe',
                            color:
                              g.reason === 'bankruptcy' ? '#b91c1c' : '#0369a1',
                            border: `1px solid ${g.reason === 'bankruptcy' ? '#fca5a5' : '#bae6fd'}`,
                          }}
                        >
                          {g.reason === 'bankruptcy'
                            ? copy(
                                '💥 Bankruptcy Decision',
                                '💥 상대방 파산 판정승',
                                '💥 Victoria por bancarrota',
                              )
                            : copy(
                                `🏁 ${rules.rounds} Rounds Complete · Total Assets Decision`,
                                `🏁 ${rules.rounds}라운드 완주 · 총자산 판정승`,
                                `🏁 ${rules.rounds} rondas completadas · Decisión por activos`,
                              )}
                        </span>
                      </div>
                      <p>{g.reason === 'bankruptcy' ? t.bankrupt : t.score}</p>
                      {g.players.map((p, i) => (
                        <p key={i}>
                          {p.name}:{' '}
                          <strong>
                            {assets(g, i as PlayerId).toLocaleString()} Dubi
                          </strong>
                        </p>
                      ))}
                      <Button
                        disabled={
                          roomBusy || Boolean(roomToken && roomRole !== 'host')
                        }
                        onClick={() => setReset(true)}
                      >
                        {t.new}
                      </Button>
                    </section>
                  ) : (
                    <section
                      className="action-panel"
                      aria-live="polite"
                      aria-busy={roomBusy}
                    >
                      <p
                        className={`turn-status ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}
                      >
                        {roomToken
                          ? isMyTurn
                            ? copy('Your turn', '내 턴', 'Tu turno')
                            : copy(
                                'Opponent’s turn',
                                '상대방 턴',
                                'Turno del oponente',
                              )
                          : copy('Current turn', '현재 턴', 'Turno actual')}
                      </p>
                      <h2>
                        {active!.name}
                        {t.turn}
                      </h2>
                      <p className="landed">
                        📍 {board[active!.position].name[lang]}
                      </p>
                      <div
                        className={`dice ${isRolling || pendingAction === 'roll' ? 'rolling dice-rolling' : ''}`}
                        aria-label={
                          isRolling || pendingAction === 'roll'
                            ? special.rolling
                            : (rollingDice ?? g.dice)?.filter((d) => d > 0).join(' + ')
                        }
                      >
                        {(rollingDice ?? g.dice) ? (
                          (rollingDice ?? g.dice)!
                            .filter((d) => d > 0)
                            .map((d, i) => (
                              <span key={i}>
                                {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d - 1]}
                              </span>
                            ))
                        ) : (
                          <span>🎲</span>
                        )}
                      </div>
                      {g.lastEvent !== null && (
                        <p className="event-card">
                          🎒 {events[g.lastEvent].text[lang]}
                        </p>
                      )}
                      <p>
                        {roomToken && !isMyTurn
                          ? copy(
                              `Waiting for ${active!.name}`,
                              `${active!.name}의 플레이를 기다리는 중`,
                              `Esperando a ${active!.name}`,
                            )
                          : inRest
                            ? special.restHint
                            : extraRoll
                              ? g.phase === 'choice'
                                ? special.doubleChoice
                                : special.doubleHint
                              : g.phase === 'roll'
                                ? t.rollHint
                                : g.phase === 'choice'
                                  ? t.choice
                                  : t.endHint}
                      </p>
                      {inRest && (
                        <p className="event-card">
                          {special.restAttempt}{' '}
                          {(g.restTurns?.[g.current] ?? 0) +
                            (g.phase === 'roll' ? 1 : 0)}
                          /3
                        </p>
                      )}
                      {pendingAction && (
                        <p className="action-feedback" role="status">
                          {pendingAction === 'roll'
                            ? special.rolling
                            : special.saving}
                        </p>
                      )}
                      <div className="actions">
                        {g.phase === 'roll' && (
                          <Button
                            data-action="roll"
                            disabled={actionsBlocked}
                            onClick={() => {
                              const actor = (roomToken && myPlayerIndex >= 0 ? myPlayerIndex : g.current) as PlayerId;
                              const modifier = g.players[actor]?.nextRollModifier;
                              let dice: [number, number];
                              if (modifier === 'single') {
                                dice = [randomInt(6) + 1, 0];
                              } else if (modifier === 'doubles') {
                                const d = randomInt(6) + 1;
                                dice = [d, d];
                              } else {
                                dice = [randomInt(6) + 1, randomInt(6) + 1];
                              }
                              void roomWork(() =>
                                act(
                                  {
                                    type: 'roll',
                                    dice,
                                    event: randomInt(events.length),
                                  },
                                  g.revision,
                                ),
                              );
                            }}
                          >
                            {pendingAction === 'roll'
                              ? special.rolling
                              : inRest
                                ? special.tryDoubles
                                : extraRoll
                                  ? special.rollAgain
                                  : t.roll}
                          </Button>
                        )}
                        {inRest && g.phase === 'roll' && (
                          <Button
                            data-action="bail"
                            variant="outline"
                            disabled={
                              actionsBlocked || active!.cash < rules.restFee
                            }
                            onClick={() =>
                              void roomWork(() =>
                                act({ type: 'bail' }, g.revision),
                              )
                            }
                          >
                            {special.payRest} · {rules.restFee} Dubi
                          </Button>
                        )}
                        {g.phase === 'choice' && landed?.type === 'city' && (
                          <>
                            {!owned ? (
                              <Button
                                data-action="buy"
                                disabled={actionsBlocked || !canBuy(g)}
                                onClick={() =>
                                  void roomWork(() =>
                                    act({ type: 'buy' }, g.revision),
                                  )
                                }
                              >
                                {copy('Buy', '구매', 'Comprar')}{' '}
                                {landed.name[lang]} · {landed.price} Dubi
                              </Button>
                            ) : (
                              !tourist && (
                                <Button
                                  data-action="upgrade"
                                  disabled={actionsBlocked || !canUpgrade(g)}
                                  onClick={() =>
                                    void roomWork(() =>
                                      act({ type: 'upgrade' }, g.revision),
                                    )
                                  }
                                >
                                  {landed.name[lang]} · {t.upgrade} ·{' '}
                                  {landed.upgrade} Dubi
                                </Button>
                              )
                            )}
                            {!hasPropertyAction && (
                              <p>{owned && owned.level >= 3 ? t.max : t.low}</p>
                            )}
                          </>
                        )}
                        {g.phase === 'choice' && active!.position === rules.airportSpace && (
                          <div className="w-full my-2 rounded-2xl border-2 border-sky-300 bg-sky-50/90 p-3.5 text-center shadow-sm">
                            <div className="flex items-center justify-center gap-1.5 text-sm font-black text-sky-900">
                              <span>🛫</span>
                              <span>{special.airport}</span>
                              <span className="rounded-full bg-sky-200 px-2 py-0.5 text-xs text-sky-800 font-bold">
                                {rules.flightFee} Dubi
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-sky-700">
                              {special.airportHint}
                            </p>
                            {/* Direct Interactive Board Selection Card */}
                            <div className="travel-destination-card mt-2.5 p-2.5 rounded-xl border border-sky-300/80 bg-white/95 shadow-sm text-left">
                              <div className="text-[11px] font-medium text-sky-700 flex items-center justify-between">
                                <span>{copy('👆 Tap any tile on board to choose', '👆 보드판에서 원하는 칸을 터치하세요', '👆 Toca una casilla en el tablero')}</span>
                                <span className="font-extrabold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded-md">
                                  #{String(targetTravelSpace + 1).padStart(2, '0')}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{board[targetTravelSpace].icon}</span>
                                  <div>
                                    <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1">
                                      {board[targetTravelSpace].name[lang]}
                                      {board[targetTravelSpace].kind === 'tourist' && (
                                        <span className="text-emerald-600 font-bold text-xs">✦ {special.tourist}</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {board[targetTravelSpace].type === 'city'
                                        ? g.properties[targetTravelSpace]
                                          ? `${g.players[g.properties[targetTravelSpace].owner].name} · Lv.${g.properties[targetTravelSpace].level}`
                                          : `${board[targetTravelSpace].price} Dubi`
                                        : board[targetTravelSpace].type}
                                    </div>
                                  </div>
                                </div>
                                {targetTravelSpace <= rules.airportSpace && (
                                  <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700 whitespace-nowrap shadow-xs">
                                    +{playerStartBonus(g, (roomToken && myPlayerIndex >= 0 ? myPlayerIndex : g.current) as PlayerId)} Dubi 💰
                                  </span>
                                )}
                              </div>
                            </div>
                            {targetTravelSpace <= rules.airportSpace && (
                              <p className="mt-1.5 text-[11px] font-bold text-emerald-700">
                                ✨ {special.crossingBonus}
                              </p>
                            )}
                            <div className="mt-3 flex justify-center gap-2">
                              <Button
                                size="sm"
                                className="bg-sky-600 hover:bg-sky-700 text-white font-black"
                                disabled={actionsBlocked || active!.cash < rules.flightFee}
                                onClick={() =>
                                  void roomWork(() =>
                                    act(
                                      { type: 'fly', space: targetTravelSpace },
                                      g.revision,
                                    ),
                                  )
                                }
                              >
                                {special.flyBtn}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionsBlocked}
                                onClick={() =>
                                  void roomWork(() =>
                                    act({ type: 'skipFly' }, g.revision),
                                  )
                                }
                              >
                                {special.skipFly}
                              </Button>
                            </div>
                          </div>
                        )}
                        {canSail(g, (roomToken && myPlayerIndex >= 0 ? myPlayerIndex : g.current) as PlayerId) && (
                          <div className="w-full my-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3.5 text-center shadow-sm">
                            <div className="flex items-center justify-center gap-1.5 text-sm font-black text-emerald-900">
                              <span>🚢</span>
                              <span>{special.harbor}</span>
                              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs text-emerald-800 font-bold">
                                {rules.sailFee} Dubi
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-emerald-700">
                              {special.harborHint}
                            </p>
                            {/* Direct Interactive Board Selection Card */}
                            <div className="travel-destination-card mt-2.5 p-2.5 rounded-xl border border-emerald-300/80 bg-white/95 shadow-sm text-left">
                              <div className="text-[11px] font-medium text-emerald-700 flex items-center justify-between">
                                <span>{copy('👆 Tap any tile on board to choose', '👆 보드판에서 원하는 칸을 터치하세요', '👆 Toca una casilla en el tablero')}</span>
                                <span className="font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                  #{String(targetTravelSpace + 1).padStart(2, '0')}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{board[targetTravelSpace].icon}</span>
                                  <div>
                                    <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1">
                                      {board[targetTravelSpace].name[lang]}
                                      {board[targetTravelSpace].kind === 'tourist' && (
                                        <span className="text-emerald-600 font-bold text-xs">✦ {special.tourist}</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {board[targetTravelSpace].type === 'city'
                                        ? g.properties[targetTravelSpace]
                                          ? `${g.players[g.properties[targetTravelSpace].owner].name} · Lv.${g.properties[targetTravelSpace].level}`
                                          : `${board[targetTravelSpace].price} Dubi`
                                        : board[targetTravelSpace].type}
                                    </div>
                                  </div>
                                </div>
                                {targetTravelSpace < rules.harborSpace && (
                                  <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700 whitespace-nowrap shadow-xs">
                                    +{playerStartBonus(g, (roomToken && myPlayerIndex >= 0 ? myPlayerIndex : g.current) as PlayerId)} Dubi 💰
                                  </span>
                                )}
                              </div>
                            </div>
                            {targetTravelSpace < rules.harborSpace && (
                              <p className="mt-1.5 text-[11px] font-bold text-emerald-700">
                                ✨ {special.crossingBonus}
                              </p>
                            )}
                            <div className="mt-3 flex justify-center gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                                disabled={actionsBlocked || active!.cash < rules.sailFee}
                                onClick={() =>
                                  void roomWork(() =>
                                    act(
                                      { type: 'sail', space: targetTravelSpace },
                                      g.revision,
                                    ),
                                  )
                                }
                              >
                                {special.sailBtn}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionsBlocked}
                                onClick={() =>
                                  void roomWork(() =>
                                    act({ type: 'skipSail' }, g.revision),
                                  )
                                }
                              >
                                {special.skipSail}
                              </Button>
                            </div>
                          </div>
                        )}
                        {(g.phase === 'choice' || g.phase === 'end') && (
                          <Button
                            data-action="end"
                            className={endEmphasized ? 'end-turn-primary' : ''}
                            variant={endEmphasized ? 'default' : 'outline'}
                            disabled={actionsBlocked}
                            onClick={() =>
                              void roomWork(() =>
                                act({ type: 'end' }, g.revision),
                              )
                            }
                          >
                            {extraRoll
                              ? special.skipRoll
                              : g.phase === 'choice' && hasPropertyAction
                                ? t.skip
                                : t.end}{' '}
                            {endEmphasized ? '→' : ''}
                          </Button>
                        )}
                        <Button variant="ghost" onClick={follow}>
                          {special.myPosition}
                        </Button>
                      </div>
                    </section>
                  )}
                  <p className="save-status" role="status">
                    {saveError
                      ? t.saveFail
                      : roomToken
                        ? copy(
                            'Game state saved on the server',
                            '게임 상태는 서버에 저장됩니다',
                            'Partida guardada en el servidor',
                          )
                        : t.saved}
                  </p>
                </>
              )}
              <section className="destination" aria-live="polite">
                <div className={`destination-art ${s.country ?? ''}`}>
                  <span>{s.icon}</span>
                  <small>
                    {s.country === 'korea'
                      ? 'KOREA'
                      : s.country === 'peru'
                        ? 'PERÚ'
                        : 'DUBU'}
                  </small>
                </div>
                <div className="destination-body">
                  <p className="eyebrow">
                    {String(s.index + 1).padStart(2, '0')} ·{' '}
                    {s.country ? t[s.country] : t.special}
                  </p>
                  <h2>
                    {s.index === rules.airportSpace && g?.rulesVersion === 2
                      ? special.airport
                      : s.index === rules.harborSpace && g?.rulesVersion === 2
                        ? special.harbor
                        : s.name[lang]}
                  </h2>
                  {s.kind === 'tourist' && (
                    <p className="tourist-description">
                      ✦ {special.tourist}
                      {!g || g.rulesVersion === 2
                        ? ` · ${special.touristHint}`
                        : ''}
                    </p>
                  )}
                  {s.type === 'city' ? (
                    <>
                      <p className="subtitle">
                        {s.region?.[lang]} · {t.owner}:{' '}
                        {property ? g!.players[property.owner].name : t.none} ·{' '}
                        {s.kind === 'tourist' && g?.rulesVersion !== 1
                          ? special.noBuildings
                          : `${t.level} ${property?.level ?? 0}/3`}
                        {g?.rulesVersion === 2 &&
                        property &&
                        ownsRegion(g, selected, property.owner)
                          ? ` · ${special.regionSet}`
                          : ''}
                      </p>
                      <dl>
                        <div>
                          <dt>{t.price}</dt>
                          <dd>
                            {s.price} <small>Dubi</small>
                          </dd>
                        </div>
                        <div>
                          <dt>{t.rent}</dt>
                          <dd>
                            {g
                              ? rentAt(g, selected)
                              : s.kind === 'tourist'
                                ? 25
                                : s.rent}{' '}
                            <small>Dubi</small>
                          </dd>
                        </div>
                        <div>
                          <dt>
                            {s.kind === 'tourist' && g?.rulesVersion !== 1
                              ? special.tourist
                              : t.cost}
                          </dt>
                          <dd>
                            {s.kind === 'tourist' && g?.rulesVersion !== 1
                              ? '25 / 50 / 100 / 200'
                              : s.upgrade}{' '}
                            <small>Dubi</small>
                          </dd>
                        </div>
                      </dl>
                      {g &&
                        property &&
                        property.owner === (roomToken ? myPlayerIndex : g.current) &&
                        canSell(
                          g,
                          selected,
                          (roomToken ? myPlayerIndex : g.current) as PlayerId,
                        ) && (
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              disabled={actionsBlocked}
                              onClick={() => {
                                sound.playCoin();
                                triggerHaptic('medium');
                                void roomWork(() =>
                                  act(
                                    { type: 'sell', space: selected },
                                    g.revision,
                                  ),
                                );
                              }}
                              title={t.sellHint}
                            >
                              💰 {t.sell} · +{sellValue(selected, property.level)} Dubi
                            </Button>
                          </div>
                        )}
                    </>
                  ) : (
                    <p>
                      {s.type === 'event'
                        ? t.event
                        : s.index === rules.airportSpace && g?.rulesVersion === 2
                          ? special.airportHint
                          : s.index === rules.harborSpace && g?.rulesVersion === 2
                            ? special.harborHint
                            : s.index === rules.restSpace && g?.rulesVersion === 2
                              ? special.restSpaceHint
                              : t.rest}
                    </p>
                  )}
                </div>
              </section>
              <details className="rules">
                <summary>{t.rules}</summary>
                <p>{t.rulesText}</p>
                {(!g || g.rulesVersion === 2) && <p>{special.rules}</p>}
                {g && g.rulesVersion !== 2 && <p>{special.legacy}</p>}
              </details>
              {g && (
                <details className="travel-log" open>
                  <summary>{t.log}</summary>
                  <ol>
                    {g.logs
                      .slice(-12)
                      .reverse()
                      .map((e, i) => (
                        <li key={`${g.revision}-${i}`}>
                          {describe(e, g, lang)}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </aside>
          </div>
        </>
      )}
      <footer>Made for two. Inspired by Dubu. ♥</footer>
      {showMiniMap && (
        <BoardMiniMap
          game={g ?? null}
          lang={lang}
          onClose={() => setShowMiniMap(false)}
          onSelectSpace={(index) => {
            setSelected(index);
            const cell = boardRef.current?.querySelector<HTMLElement>(
              `[data-space="${index}"]`,
            );
            cell?.scrollIntoView({
              block: 'nearest',
              inline: 'nearest',
              behavior: 'smooth',
            });
          }}
        />
      )}
      {g && (
        <QuickReaction
          onSend={handleSendReaction}
          activeReaction={activeReaction}
        />
      )}
      {g && g.phase === 'finished' && g.winner !== null && g.winner !== 'tie' && (
        <Confetti />
      )}
    </main>
  );
}
