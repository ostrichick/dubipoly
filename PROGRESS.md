# Progress

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

### Next requested stage
Add a server-backed room store and authoritative turn validation for two phones. This requires selecting and attaching durable Sites storage before the shared-room implementation is treated as complete. Stage 4 handles reconnect resilience. Stage 5 handles PWA and real two-phone tests. Known dependency advisories below remain unresolved.

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
