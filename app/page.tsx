'use client';
import { useEffect, useRef, useState } from 'react';
import { board, type Lang } from '../lib/board';
import { events } from '../lib/events';
import {
  assets,
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
import { ui, describe } from '../lib/game-copy';
import { roomFromLocation, roomUrl, type RoomMessage } from '../lib/room';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
const KEY = 'dubipoly.game.v1';
type Session = { game: Game; save: Save };
type RoomSnapshot = {
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
  const [lang, setLang] = useState<Lang>('ko'),
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
    [roomPresence, setRoomPresence] = useState<Array<{ connected: boolean }>>([]),
    [online, setOnline] = useState(true),
    [roomRefresh, setRoomRefresh] = useState(0);
  const current = useRef<Session | null>(null),
    boardRef = useRef<HTMLDivElement>(null);
  const t = ui[lang],
    g = session?.game,
    s = board[selected],
    property = g?.properties[selected];
  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      setRoomRefresh((value) => value + 1);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    const initialRoom = roomFromLocation();
    if (initialRoom) {
      setRoomCode(initialRoom);
      setRoomInput(initialRoom);
      const savedToken = localStorage.getItem(`dubipoly.room.${initialRoom}`);
      if (savedToken) setRoomToken(savedToken);
    }
    const channel = 'BroadcastChannel' in window && initialRoom
      ? new BroadcastChannel(`dubipoly-room-${initialRoom}`)
      : null;
    const onMessage = (event: MessageEvent<RoomMessage>) => {
      if (event.data.type !== 'state' || event.data.roomCode !== initialRoom) return;
      const restored = restore(JSON.stringify(event.data.save));
      if (restored) {
        current.current = restored;
        setSession(restored);
        setSelected(restored.game.players[restored.game.current].position);
        setRoomNotice(lang === 'ko' ? '다른 탭에서 게임 상태를 받았습니다.' : 'Estado recibido desde otra pestaña.');
      }
    };
    channel?.addEventListener('message', onMessage);
    try {
      const language = localStorage.getItem('dubipoly.lang');
      if (language === 'ko' || language === 'es') {
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
      channel?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  useEffect(() => {
    if (!roomCode || !roomToken) return;
    let stopped = false;
    async function syncRoom() {
      try {
        const response = await fetch(`/api/rooms?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(roomToken)}`, {
          cache: 'no-store',
        });
        if (!response.ok || stopped) return;
        const snapshot = (await response.json()) as RoomSnapshot;
        if (stopped) return;
        setRoomReady(snapshot.ready);
        setRoomRole(snapshot.playerIndex === 0 ? 'host' : snapshot.playerIndex === 1 ? 'guest' : '');
        setRoomPresence(snapshot.presence ?? []);
        if (snapshot.names) setNames(snapshot.names);
        if (snapshot.game && snapshot.save) applyRoomSnapshot(snapshot);
      } catch {
        if (!stopped) setRoomNotice(lang === 'ko' ? '방 연결을 확인하는 중입니다.' : 'Comprobando la conexión de la sala.');
      }
    }
    void syncRoom();
    const timer = window.setInterval(syncRoom, 1200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [roomCode, roomToken, roomRefresh]);
  function changeLanguage(l: Lang) {
    setLang(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem('dubipoly.lang', l);
    } catch {
      setSaveError(true);
    }
  }
  function commit(next: Session) {
    current.current = next;
    setSession(next);
    try {
      if (!roomCode) localStorage.setItem(KEY, JSON.stringify(next.save));
      setSaveError(false);
      setBadSave(false);
    } catch {
      setSaveError(true);
    }
    if (roomCode && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`dubipoly-room-${roomCode}`);
      channel.postMessage({ type: 'state', roomCode, save: next.save } satisfies RoomMessage);
      channel.close();
    }
  }
  async function createRoom() {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: names[0] }),
    });
    if (!response.ok) return setRoomNotice(lang === 'ko' ? '방을 만들지 못했습니다.' : 'No se pudo crear la sala.');
    const result = (await response.json()) as RoomSnapshot & { token: string };
    setRoomCode(result.roomCode);
    setRoomInput(result.roomCode);
    setRoomToken(result.token);
    setRoomReady(result.ready);
    setRoomRole('host');
    setRoomPresence(result.presence ?? []);
    localStorage.setItem(`dubipoly.room.${result.roomCode}`, result.token);
    window.history.replaceState({}, '', roomUrl(result.roomCode));
    setRoomNotice(lang === 'ko' ? '방이 만들어졌습니다. 다른 기기에서 코드를 입력하세요.' : 'Sala creada. Introduce el código en el otro dispositivo.');
  }
  async function joinRoom() {
    const code = roomInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setRoomNotice(lang === 'ko' ? '6자리 방 코드를 입력하세요.' : 'Escribe un código de sala de 6 caracteres.');
      return;
    }
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', roomCode: code, name: names[0] || names[1] }),
    });
    if (!response.ok) {
      setRoomNotice(lang === 'ko' ? '방을 찾을 수 없거나 이미 가득 찼습니다.' : 'La sala no existe o está llena.');
      return;
    }
    const result = (await response.json()) as RoomSnapshot & { token: string };
    setRoomCode(result.roomCode);
    setRoomToken(result.token);
    setRoomReady(result.ready);
    setRoomRole('guest');
    setRoomPresence(result.presence ?? []);
    localStorage.setItem(`dubipoly.room.${result.roomCode}`, result.token);
    setNames(result.names);
    window.history.replaceState({}, '', roomUrl(code));
    setRoomNotice(lang === 'ko' ? '방에 참가했습니다. 두 플레이어가 준비되었습니다.' : 'Sala conectada. Los dos jugadores están listos.');
  }
  function applyRoomSnapshot(snapshot: RoomSnapshot) {
    if (!snapshot.game || !snapshot.save) return;
    const next = { game: snapshot.game, save: snapshot.save };
    if (current.current?.game.revision === next.game.revision) return;
    current.current = next;
    setSession(next);
    setSelected(next.game.players[next.game.current].position);
    setReset(false);
  }
  async function startRoom() {
    if (!roomCode || !roomToken) return;
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', roomCode, token: roomToken }),
    });
    if (!response.ok) {
      setRoomNotice(
        response.status === 409
          ? lang === 'ko'
            ? '두 플레이어가 모두 들어와야 시작할 수 있어요.'
            : 'Deben entrar los dos jugadores para empezar.'
          : lang === 'ko'
            ? '방장만 게임을 시작할 수 있어요.'
            : 'Solo el anfitrión puede empezar.',
      );
      return;
    }
    const snapshot = (await response.json()) as RoomSnapshot;
    setRoomReady(snapshot.ready);
    setRoomPresence(snapshot.presence ?? []);
    applyRoomSnapshot(snapshot);
  }
  async function shareRoom() {
    if (!roomCode) return;
    const url = roomUrl(roomCode);
    const browserNavigator = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    try {
      if (browserNavigator.share) {
        await browserNavigator.share({ title: 'Dubipoly', text: roomCode, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setRoomNotice(lang === 'ko' ? '방 링크를 공유했습니다.' : 'Enlace de sala compartido.');
    } catch {
      setRoomNotice(lang === 'ko' ? `이 링크를 보내세요: ${url}` : `Envía este enlace: ${url}`);
    }
  }
  function start() {
    const actual = names.map(
      (n, i) => n.trim() || `${lang === 'ko' ? '여행자' : 'Viajero'} ${i + 1}`,
    ) as [string, string];
    commit({
      game: createGame(actual),
      save: { version: 1, names: actual, actions: [] },
    });
    setSelected(0);
    setReset(false);
  }
  async function act(a: Action, revision: number) {
    const old = current.current;
    if (!old) return;
    if (roomCode && roomToken) {
      setRoomBusy(true);
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: roomToken,
            type: a.type,
            revision,
            requestId: crypto.randomUUID(),
          }),
        });
        if (!response.ok) {
          setRoomNotice(
            response.status === 409
              ? lang === 'ko'
                ? '다른 기기에서 상태가 바뀌었습니다. 최신 상태를 다시 불러옵니다.'
                : 'El otro dispositivo cambió el estado. Actualizando la partida.'
              : lang === 'ko'
                ? '방 서버와 연결할 수 없습니다.'
                : 'No se pudo conectar con la sala.',
          );
          if (response.status === 409) setRoomRefresh((value) => value + 1);
          return;
        }
        applyRoomSnapshot((await response.json()) as RoomSnapshot);
      } finally {
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
    const pos = g.players[g.current].position;
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
    landed = active ? board[active.position] : null,
    owned = g && active ? g.properties[active.position] : undefined;
  return (
    <main>
      <header>
        <a className="wordmark" href="/">
          Dubi<span>poly</span> ✈
        </a>
        <span className="route-label">KOREA ··· ✈ ··· PERÚ</span>
        <nav aria-label="Language">
          <Button
            variant={lang === 'ko' ? 'default' : 'outline'}
            aria-pressed={lang === 'ko'}
            onClick={() => changeLanguage('ko')}
          >
            한국어
          </Button>
          <Button
            variant={lang === 'es' ? 'default' : 'outline'}
            aria-pressed={lang === 'es'}
            onClick={() => changeLanguage('es')}
          >
            Español
          </Button>
        </nav>
      </header>
      {!online && (
        <p className="network-banner offline" role="status">
          {lang === 'ko'
            ? '오프라인 상태입니다. 연결이 돌아오면 방 상태를 다시 확인합니다.'
            : 'Estás sin conexión. La sala se actualizará al volver la conexión.'}
        </p>
      )}
      {online && roomCode && roomToken && (
        <p className="network-banner online" role="status">
          {lang === 'ko' ? '방 서버에 연결됨' : 'Conectado a la sala'} · {roomCode}
        </p>
      )}
      <div className="toolbar">
        <div>
          <h1>{t.title}</h1>
          <p>
            {t.mode}
            {g ? ` · ${t.round} ${g.round}/${rules.rounds}` : ''}
          </p>
        </div>
        <div className="toolbar-actions">
          <Button
            variant="outline"
            onClick={() => setZoom(!zoom)}
            aria-pressed={zoom}
          >
            {zoom ? t.fit : t.zoom} ⤢
          </Button>
          {g && (
            <Button variant="outline" onClick={() => setReset(true)}>
              {t.new}
            </Button>
          )}
        </div>
      </div>
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
                  if (roomCode && roomToken && !reset) void startRoom();
                  else start();
                }}
              >
                <div className="name-fields">
                  {[0, 1].map((i) => (
                    <label key={i}>
                      {t.name} {i + 1}
                      <Input
                        maxLength={24}
                        aria-label={`${t.name} ${i + 1}`}
                        placeholder={`${lang === 'ko' ? '여행자' : 'Viajero'} ${i + 1}`}
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
                <div className="setup-actions">
                  <Button
                    type="submit"
                    disabled={Boolean(roomCode && roomToken && (roomRole === 'guest' || !roomReady))}
                  >
                    {reset
                      ? t.yes
                      : roomCode && roomToken
                        ? roomRole === 'guest'
                          ? lang === 'ko' ? '방장 시작 대기' : 'Esperar al anfitrión'
                          : roomReady
                            ? lang === 'ko' ? '게임 시작' : 'Empezar partida'
                            : lang === 'ko' ? '플레이어 대기' : 'Esperar jugador'
                        : t.start} ✈
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
                <p className="eyebrow">{lang === 'ko' ? '방 코드 · 3단계 준비' : 'SALA · PREPARACIÓN DE ETAPA 3'}</p>
                <div className="room-actions">
                  <Button type="button" variant="outline" onClick={createRoom}>
                    {lang === 'ko' ? '방 만들기' : 'Crear sala'}
                  </Button>
                  <Input
                    maxLength={6}
                    aria-label={lang === 'ko' ? '방 코드' : 'Código de sala'}
                    placeholder="ABC123"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  />
                  <Button type="button" variant="outline" onClick={joinRoom}>
                    {lang === 'ko' ? '참가' : 'Unirse'}
                  </Button>
                </div>
                {roomCode && (
                  <p className="room-code">
                    {lang === 'ko' ? '현재 방:' : 'Sala actual:'} <strong>{roomCode}</strong>{roomToken ? ' · ✓' : ''}
                    <br />
                    {roomRole === 'host'
                      ? lang === 'ko' ? '방장' : 'Anfitrión'
                      : roomRole === 'guest'
                        ? lang === 'ko' ? '참가자' : 'Invitado'
                        : ''}{' '}
                    · {roomPresence.filter((player) => player.connected).length}/2 {lang === 'ko' ? '접속' : 'conectados'}
                    <br />
                    {roomReady
                      ? lang === 'ko'
                        ? '두 플레이어 준비 완료 · 방장이 시작할 수 있어요.'
                        : 'Dos jugadores listos · el anfitrión puede empezar.'
                      : lang === 'ko'
                        ? '다른 플레이어를 기다리는 중…'
                        : 'Esperando al otro jugador…'}
                  </p>
                )}
                {roomCode && roomToken && (
                  <div className="room-actions room-share-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRoomRefresh((value) => value + 1)}
                      disabled={!online || roomBusy}
                    >
                      {lang === 'ko' ? '상태 새로고침' : 'Actualizar estado'}
                    </Button>
                    <Button type="button" variant="outline" onClick={shareRoom}>
                      {lang === 'ko' ? '방 링크 공유' : 'Compartir sala'}
                    </Button>
                    <span className="presence-dots" aria-label={`${roomPresence.filter((player) => player.connected).length}/2 connected`}>
                      {roomPresence.map((player, index) => (
                        <span key={index} className={player.connected ? 'presence-dot connected' : 'presence-dot'}>
                          {player.connected ? '●' : '○'} {index + 1}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {roomNotice && <p className="room-notice" role="status">{roomNotice}</p>}
              </div>
            </section>
          )}
          <div className="workspace">
            <section
              className="board-scroll"
              tabIndex={0}
              aria-label="Dubipoly board"
            >
              <div ref={boardRef} className={`board ${zoom ? 'zoom' : ''}`}>
                <div className="board-center">
                  <div className="postmark">
                    SEOUL ↔ LIMA <span>40 STOPS · 2 TRAVELERS</span>
                  </div>
                  <h2>
                    Dubi<span>poly</span>
                  </h2>
                  <p className="center-route">🇰🇷 ··· ✈ ··· 🇵🇪</p>
                  <img className="dubu" src="/dubu.png" alt="Dubu" />
                  <p className="photo-caption">Dubu ♥</p>
                  <div className="legend">
                    <span>● {t.korea}</span>
                    <span>● {t.peru}</span>
                  </div>
                </div>
                {board.map((x) => {
                  const p = g?.properties[x.index];
                  return (
                    <button
                      key={x.index}
                      data-space={x.index}
                      className={`tile ${x.country ?? 'special'} ${x.type !== 'city' ? 'event' : ''} ${selected === x.index ? 'selected' : ''}`}
                      style={{ gridRow: x.row, gridColumn: x.col }}
                      aria-label={`${x.index + 1}. ${x.name[lang]}${p ? ` · ${g!.players[p.owner].name} · ${t.level} ${p.level}` : ''}`}
                      aria-pressed={selected === x.index}
                      onClick={() => setSelected(x.index)}
                    >
                      <span className="tile-number">
                        {String(x.index + 1).padStart(2, '0')}
                      </span>
                      <span className="tile-icon" aria-hidden="true">
                        {x.icon}
                      </span>
                      <span className="tile-name">{x.name[lang]}</span>
                      {p ? (
                        <span className={`ownership owner-${p.owner}`}>
                          {p.owner === 0 ? '●' : '◆'}{' '}
                          {p.level ? '★'.repeat(p.level) : '0'}
                        </span>
                      ) : (
                        x.price && <span className="tile-price">{x.price}</span>
                      )}
                      <span className="tokens">
                        {g?.players.map((p, i) =>
                          p.position === x.index ? (
                            <span
                              key={i}
                              className={`token token-${i}`}
                              title={p.name}
                              aria-label={p.name}
                            >
                              {i + 1}
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
                        className={`player player-${i + 1} ${g.current === i && g.phase !== 'finished' ? 'active-player' : ''}`}
                        key={i}
                      >
                        <img src="/dubu.png" alt="Dubu" />
                        <div>
                          <span className="player-name">
                            {i + 1}. {p.name}
                          </span>
                          <strong>
                            <span className="coin">🐾</span>{' '}
                            {p.cash.toLocaleString()} <small>Dubi</small>
                          </strong>
                          <p>
                            {t.assets}:{' '}
                            {assets(g, i as PlayerId).toLocaleString()}
                          </p>
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
                      <p>{g.reason === 'bankruptcy' ? t.bankrupt : t.score}</p>
                      {g.players.map((p, i) => (
                        <p key={i}>
                          {p.name}:{' '}
                          <strong>
                            {assets(g, i as PlayerId).toLocaleString()} Dubi
                          </strong>
                        </p>
                      ))}
                      <Button onClick={() => setReset(true)}>{t.new}</Button>
                    </section>
                  ) : (
                    <section className="action-panel" aria-live="polite">
                      <h2>
                        {active!.name}
                        {t.turn}
                      </h2>
                      <p className="landed">
                        📍 {board[active!.position].name[lang]}
                      </p>
                      <div className="dice" aria-label={g.dice?.join(' + ')}>
                        {g.dice ? (
                          g.dice.map((d, i) => (
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
                        {g.phase === 'roll'
                          ? t.rollHint
                          : g.phase === 'choice'
                            ? t.choice
                            : t.endHint}
                      </p>
                      <div className="actions">
                        <Button
                          disabled={g.phase !== 'roll' || reset || roomBusy}
                          onClick={() =>
                            act(
                              {
                                type: 'roll',
                                dice: [randomInt(6) + 1, randomInt(6) + 1],
                                event: randomInt(events.length),
                              },
                              g.revision,
                            )
                          }
                        >
                          {t.roll}
                        </Button>
                        {g.phase === 'choice' && landed?.type === 'city' && (
                          <>
                            {!owned ? (
                              <Button
                                disabled={active!.cash < landed.price! || reset || roomBusy}
                                onClick={() => act({ type: 'buy' }, g.revision)}
                              >
                                {t.buy} · {landed.price} Dubi
                              </Button>
                            ) : (
                              <Button
                                disabled={
                                  owned.level >= 3 ||
                                  active!.cash < landed.upgrade! ||
                                  reset ||
                                  roomBusy
                                }
                                onClick={() =>
                                  act({ type: 'upgrade' }, g.revision)
                                }
                              >
                                {t.upgrade} · {landed.upgrade} Dubi
                              </Button>
                            )}
                            {owned && owned.level >= 3 ? (
                              <p>{t.max}</p>
                            ) : (
                              active!.cash <
                                (owned ? landed.upgrade! : landed.price!) && (
                                <p>{t.low}</p>
                              )
                            )}
                          </>
                        )}
                        <Button
                          variant="outline"
                          disabled={g.phase === 'roll' || reset || roomBusy}
                          onClick={() => act({ type: 'end' }, g.revision)}
                        >
                          {g.phase === 'choice' ? t.skip : t.end}
                        </Button>
                        <Button variant="ghost" onClick={follow}>
                          {t.follow}
                        </Button>
                      </div>
                    </section>
                  )}
                  <p className="save-status" role="status">
                    {saveError ? t.saveFail : t.saved}
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
                  <h2>{s.name[lang]}</h2>
                  {s.type === 'city' ? (
                    <>
                      <p className="subtitle">
                        {t.owner}:{' '}
                        {property ? g!.players[property.owner].name : t.none} ·{' '}
                        {t.level} {property?.level ?? 0}/3
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
                            {g ? rentAt(g, selected) : s.rent}{' '}
                            <small>Dubi</small>
                          </dd>
                        </div>
                        <div>
                          <dt>{t.cost}</dt>
                          <dd>
                            {s.upgrade} <small>Dubi</small>
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p>{s.type === 'event' ? t.event : t.rest}</p>
                  )}
                </div>
              </section>
              <details className="rules">
                <summary>{t.rules}</summary>
                <p>{t.rulesText}</p>
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
    </main>
  );
}
