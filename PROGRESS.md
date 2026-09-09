# Progress

## English default and language options — 2026-09-09
- Added English alongside Korean and Spanish for all board cells, 12 events, game rules, logs, and room messages.
- First visits default to English. The header language selector saves the device's choice and updates the document language; existing saved preferences are preserved.
- English page metadata and PWA manifest; room play now identifies itself as online rather than single-device mode.
- Fixed the pre-existing room-store test double's TypeScript annotation.
- Dubu character artwork was added separately as a transparent game mascot asset and is now used in the board center and player cards.

## Hosted test deployment — 2026-09-09
User requested web-hosted testing before stage 3. Registered owner-private Sites project; id in .openai/hosting.json, expected origin https://dubipoly.nukapig.chatgpt.site. Deploy stage 2 as-is; multiplayer still pending. Upgraded React/React DOM/RSC 19.2.8, Vinext beta.9, Vite 8.2.2, plugin-rsc 0.5.34, Cloudflare plugin 1.54.6, Wrangler 4.120.0 and worker types to compatible versions. Build/types and all 13 tests passed after updates. Remaining audit findings: sharp <0.35.4 through local miniflare/wrangler development tooling (4 transitive high reports). No user image uploads or local image conversion endpoints implemented. Do not claim all dependency advisories resolved. Publishing status to be confirmed via Sites tool; never infer live status from expected URL alone.

## Stage 2 complete — 2026-09-09
Pure engine (lib/game.ts), 12 bilingual events (lib/events.ts), localized game messages (lib/game-copy.ts), local action-journal restore, name setup, dice, buy/upgrade/end controls, live balances/tokens/ownership, results, rules, recent history and restart confirmation implemented. Accepted actions use a synchronous session ref and revision check to prevent stale duplicate UI actions. Gameplay is SINGLE DEVICE; no shared rooms yet.

### Stage 2 verified
- Build and TypeScript passed. 13 tests passed, including 100 deterministic full games with save/replay at every accepted action, cash/ownership invariants, stale/wrong-player actions, insufficient funds, exact-zero payment, max upgrades, start bonus, all events, event destination rent, no event chaining, bankruptcy, ties and round limit. Corrected one test's expected city rent from 19 to 22 per existing board price.
- Chromium via agent-browser: entered names and started; duplicate roll click saved one action. Played nine actions (including buys), reloaded, same balances and action count restored.
- Continued through visible controls to end of round 20, 101 accepted actions total. Results: Dubu 2,188 and Dubi 2,312, Dubi winner. Switched to Spanish; result translated. Cancelled restart and refreshed; result preserved. Confirmed restart; zero actions and 1,500 each, first player turn.
- Desktop screenshot inspected; full portrait 390x844 screenshot inspected; landscape 844x390 width checked. Page width equals viewport in both sizes, images loaded, no browser errors reported. Board scroll is intentional.
- npm run dev running at port 3000 with host 0.0.0.0 for same-Wi-Fi access. Real Android device not tested by agent.
- Screenshots stage2-desktop.png, stage2-mobile.png. Personal test state exists only in isolated automated browser, not user's browser.

### Deployment verified
- Stage 2 was published owner-private at `https://dubipoly.nukapig.chatgpt.site` as Sites version 1.

### Stage 3 room lobby prototype — 2026-09-09
- Added six-character room-code creation and join flow.
- Room code is reflected in the URL and can be reopened as a test session.
- Added a `BroadcastChannel` transport for same-browser tab-to-tab state checks.
- Published the prototype owner-private at the same URL as Sites version 2 after `npm test`, `npx tsc --noEmit`, and `npm run build` passed.
- This is intentionally not yet authoritative two-phone networking: the Site currently has no D1 or Durable Object binding, so browser storage and tab messaging are not the final multiplayer source of truth.

### Stage 3 server room relay — 2026-09-09
- Added `POST /api/rooms` to create or join a two-player room and `GET /api/rooms?room=...` to read readiness.
- Room creation and joining were verified locally: host + guest produced a ready two-player room.
- Published as Sites version 3 at the same owner-private URL.
- The room registry is currently Worker-memory only. It is suitable for a short live test but can disappear when the Worker instance restarts or traffic is routed elsewhere; D1/Durable Object persistence is still required before calling this production multiplayer.

### Stage 3 synchronized game actions — 2026-09-09
- Server now owns room game state after both players join and the host starts the match.
- Roll results and event selection are generated on the server; buy, upgrade, and end actions are validated against the current player and revision.
- Clients poll the room snapshot and update board position, cash, ownership, logs, and winner state from the server response.
- Local verification passed for create → join → start → server roll, with 13 tests, TypeScript, and production build passing.
- Published as Sites version 4 at the same owner-private URL.

### Stage 4 resilience basics — 2026-09-09
- Added server-side request IDs so a retried roll, buy, upgrade, or end action is applied at most once.
- Added revision checks so an old screen cannot overwrite a newer server state.
- Added player heartbeat timestamps and presence information to room snapshots.
- Client polling now sends its room token, refreshes state after reconnect, and disables room actions while a request is pending.
- Local verification passed for duplicate action replay returning the same revision and stale revision rejection with HTTP 409.
- Published as Sites version 5 at the same owner-private URL.

### Stage 5 mobile web app shell — 2026-09-09
- Added an installable PWA manifest with Dubipoly branding and mobile standalone display settings.
- Added a service worker that caches only the app shell and never caches room API requests.
- Added online/offline status messaging and preserved the last visible game state while reconnecting.
- Verified the manifest and service worker are included in the deployment archive.
- Published as Sites version 6 at the same owner-private URL.

### Stage 5 room usability — 2026-09-09
- Added host/guest role labels and a connected-player count.
- Added per-player presence dots driven by room heartbeats.
- Added native mobile share or clipboard fallback for the room link.
- Prevented guests and rooms without two players from showing an actionable start control.
- Published as Sites version 7 at the same owner-private URL.

### Stage 6 persistent room storage — 2026-09-09
- Added a D1 logical binding named `DB` and a `dubipoly_rooms` table for serialized room/game snapshots.
- Added a Worker wrapper that exposes the D1 binding to route handlers.
- Room creation, joining, heartbeats, game start, and actions now persist snapshots when D1 is available, while retaining memory fallback for local development.
- Deployment succeeded as Sites version 8, and the live D1 overview confirms the `DB` binding and `dubipoly_rooms` table.
- The database is currently empty because no live room has been created after the migration; the first real room will create its row.

### Stage 6 persistence consistency hardening — 2026-09-09
- Persisted the processed request-ID map inside each D1 room snapshot, so retry deduplication survives Worker instance changes.
- When D1 is available, every room request now reloads the latest snapshot from D1 before validation instead of trusting a possibly stale per-isolate memory copy.
- Kept the in-memory fallback for local development and temporary D1 read failures.
- Verified 13 engine tests, TypeScript/build output, and the deployment archive contents.
- Published as Sites version 9 at the same owner-private URL; the live overview still confirms `DB` → `dubipoly_rooms`.

### GitHub mirror — 2026-09-09
- Added `https://github.com/ostrichick/dubipoly.git` as the project GitHub remote.
- Pushed the `main` branch through the latest persistence-hardening commit.
- Future implementation commits should be pushed to both the Sites source repository and GitHub.

### Stage 7 concurrent room safety — 2026-09-09
- Added D1 compare-and-swap persistence using the room row's `updated_at` value, so two near-simultaneous actions cannot both overwrite the same room revision.
- Moved processed request-ID persistence into the same atomic room snapshot as the game action.
- Added a focused room-store test covering D1 round-trip restoration and stale-writer rejection; the full suite now has 14 passing tests.
- Added a mobile-friendly `상태 새로고침` / `Actualizar estado` control and automatic refresh after a stale-action response or restored network connection.
- Source build and focused lint for the changed server files passed. The repository-wide lint command still sees generated `package-stage*` bundles and reports pre-existing generated-file/UI warnings; this does not block the production build.
- This stage is ready for a real two-phone acceptance test after publishing.

### Stage 8 city-route rearrangement — 2026-09-09
- Reordered the route so spaces 1–20 use Korean cities and spaces 21–40 use Peruvian cities, while keeping the four corners, eight event spaces, 28-city count, and balanced price distribution intact.
- Added a board test that verifies the country boundary by space number.
- The requested Dubu character replacement is not yet integrated because the built-in image-generation service returned a usage-limit response; the existing photo remains temporary until a character asset can be generated or supplied.

### Next requested stage
Run the real two-phone room acceptance test: host creates a room, spouse joins from a separate Android phone, host starts the match, both phones complete turns, and one device refreshes or briefly loses connection. Fix any user-visible issues found in that test.

## Stage 1 history (superseded by stage 2 above)

## Stage 1 complete — 2026-09-08
React/TypeScript/Vite/Vinext with shadcn Button. 40 unique perimeter positions, 28 unique cities (14 per country), 8 events, 4 corners. Top/left Korea, bottom/right Peru, identical price distributions. Selectable cities and details, Korean/Spanish switch, sample player balances, zoom and internally scrollable board. Supplied Dubu photo copied to public/dubu.png; temporary artwork, not final illustration.

## Verified
- Production build and TypeScript passed.
- Board tests: 2 passed (counts, unique geometry, city uniqueness, country placement, localization, price symmetry).
- HTTP localhost:3000 returned 200.
- Chromium: all 40 buttons rendered. Cusco selection updated detail, Spanish changed UI and document language, corner selection and zoom on/off worked. Images loaded; no browser errors returned.
- Desktop screenshot inspected. Portrait 390x844 inspected; landscape 844x390 checked. Page width equals viewport at both mobile sizes; only the board scrolls internally.
- Screenshots: stage1-desktop.png and stage1-mobile.png. Real Android phones not tested.

## Limitations
City emoji and source photo are interim art. Small phones require board scrolling. No dice, buying, engine, save, multiplayer, PWA or deployment yet; UI explicitly says preview.
Starter install reported 11 dependency advisories (8 high); production audit 6 (5 high), including React server DOM, Vinext/image-size, Vite and undici. No public deployment. Update affected dependencies and verify before internet exposure; do not blindly force audit fixes.

## Next
Stage 2: single-device rule engine, events, turn flow, save/restore and complete-game tests. Keep engine separate for stage 3 shared authoritative rooms. Read SPEC.md and PLAN.md before continuing. Do not redo stage 1 or advance without next stage request.
Run npm ci, then npm run dev -- --host 0.0.0.0; current port 3000. Same Wi-Fi needs computer LAN IP and private firewall allowance. No paid resources or hosted site registered. See README.md.
