# Dubipoly 아키텍처·협업 안내

이 문서는 **코드 구조와 데이터 흐름**만 설명한다. 사용자 실행·배포 절차는 [`README.md`](README.md), 게임 규칙은 [`SPEC.md`](SPEC.md), 코딩 AI의 공통 원칙은 [`AGENTS.md`](AGENTS.md)를 참고한다. 2026-09-14 점검 보고서에 있던 2자리 방 코드, 메모리 기반 운영 장애 복구, 29개 테스트·미커밋 상태 등은 당시 기록일 뿐 현재 동작이 아니다.

## 소스 구조와 수정 위치

| 영역 | 주요 파일과 책임 |
| --- | --- |
| UI | `app/page.tsx` — 로비·방 접속·상태 동기화·화면 조합; `app/globals.css` — 모바일 레이아웃; `components/game/BoardCenterHub.tsx` — 중앙 턴 컨트롤·이벤트 대화상자 |
| 보조 UI | `components/game/BoardMiniMap.tsx`, `RoomQrCode.tsx`, `QuickReaction.tsx` 등 |
| 게임 규칙 | `lib/board.ts` — 보드·가격; `lib/events.ts` — 이벤트 ID·효과·다국어; `lib/game.ts` — 상태 전이·자산·저장 재생; `lib/game-copy.ts` — UI·로그 문구 |
| 온라인 API | `app/api/rooms/route.ts` — 방 생성·참여·이름·시작·조회; `app/api/rooms/[roomCode]/actions/route.ts` — 턴 액션·반응 처리 |
| 저장소 | `lib/server-rooms.ts` — D1 스냅샷·CAS·presence·만료; `worker.ts` — Worker 바인딩 연결; `drizzle/*.sql` — DB 스키마 |
| 배포 | `vite.config.ts`, `.openai/hosting.json`, `.github/workflows/deploy.yml`; `public/manifest.webmanifest`, `public/sw.js` — PWA 구성 |
| 검증 | `tests/` — 게임·특수 규칙·채무·지급·여행 쿨다운·서버·2인 방 흐름 |

## 게임 상태의 책임 경계

1. `lib/game.ts`의 `transition(previous, action, actor, revision)`은 유효하지 않거나 오래된 액션을 거부하며 새로운 게임 상태를 반환한다. 로컬 저장의 **액션 저널**은 `restore()`가 초기 상태부터 재생한다. v1 저장은 예전 규칙, 새 게임은 v2 규칙이다.
2. 온라인 방의 게임 상태는 서버가 결정한다. 서버가 주사위·이벤트를 추첨하고 현재 플레이어·요청값을 검증한다. 클라이언트가 잠깐 표시하는 예측 상태는 서버 응답으로 반드시 교정한다.
3. 각 방은 D1 `dubipoly_rooms`에 방 정보·게임 스냅샷·액션 저널·처리한 요청 ID를 함께 저장한다. 행의 `updated_at`으로 비교 후 갱신(CAS)해 경합 시 오래된 쓰기를 거절한다. `requestId`로 재전송된 액션의 중복 처리를 막는다.
4. 하트비트는 별도 `dubipoly_presence` 테이블에 기록해 게임 상태 갱신과 분리한다. 게임·접속 활동이 마지막으로 기록된 때부터 6시간 비활성이면 방을 만료시키며, 동시 하트비트를 고려해 삭제한다.
5. 빠른 폴링은 `matchId`와 게임 `revision`이 같으면 204를 반환한다. **이름 변경·리액션은 게임 revision을 증가시키지 않으므로 다음 전체 동기화(주기적인 heartbeat 조회)에서 보일 수 있다.** 이를 즉각 동기화가 보장된 것으로 안내하지 않는다.

### D1과 메모리의 구분

실제 Worker 환경에서 `DB` 바인딩이 없으면 서버는 503 오류로 실패해야 하며, 운영 게임을 메모리에 저장한 것처럼 성공 응답하지 않는다. **직접 호출하는 로컬 테스트/개발 환경에 한해서만** 메모리 저장 경로가 가능하다. `.openai/hosting.json`의 `DB`는 바인딩 이름이며, 실제 데이터베이스 UUID나 프로덕션 설정 확인을 대신하지 않는다.

`drizzle/0000_create_rooms.sql`은 방 테이블, `drizzle/0001_room_presence.sql`은 접속 테이블을 만든다. 운영 DB에 두 스키마가 모두 존재하는지는 운영 환경에서 별도 확인해야 한다. CI는 마이그레이션을 적용하지 않는다.

## 안전한 변경 순서

- 게임 규칙 변경: `SPEC.md`와 `lib/game.ts`·관련 테스트를 함께 바꾸고 구 v1 재생 호환성을 확인한다.
- API 또는 저장 구조 변경: 새·구 요청, 동시 요청, 실패·재시도, 재접속 및 재대전 시나리오를 테스트한다. 운영 DB 마이그레이션을 CI가 자동 수행한다고 가정하지 않는다.
- UI 변경: 현재 턴의 행동만 노출하는지, 두 언어 외 영어까지 일관적인지, 터치 영역·키보드 포커스·모바일 화면 크기를 확인한다. 실제 휴대전화 검증을 자동 테스트로 대체하지 않는다.
- 배포 전제·검증 결과가 달라지면 `README.md`·`PLAN.md`·`PROGRESS.md`에서 **담당하는 부분만** 갱신한다. 날짜 지난 테스트 수치나 과거 배포 링크를 최신 현황으로 재사용하지 않는다.

최소 검사 명령과 배포 안전 요건은 [`README.md`](README.md)에만 유지한다. 실제 수정 내역의 완료·미완료 구분은 [`PROGRESS.md`](PROGRESS.md)를 참고한다.
