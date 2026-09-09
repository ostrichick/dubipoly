# Dubipoly

## Confirmed requirements
Private game for a Korean/Peruvian couple, ultimately two Android phones in one shared room. Cute bright travel aesthetic based on the conversation concept. 40 perimeter cells; top/left Korea, bottom/right Peru. Currency Dubi, mascot Dubu (tabby face/back, white muzzle/chest/paws, pink nose). No store release, account, ads, payment, chat, matchmaking or leaderboard. Independent Korean/Spanish per device.

## Proposed defaults, editable
28 unique cities (14 per country), 4 corners and 8 events. Starting cash 1,500. Two six-sided dice, no doubles extra turn. Passing start +200. Buy/skip unowned cities; automatic opponent rent; upgrade own landed city to level 3. No auction, mortgage, trading or set prerequisites. 12+ localized events, no movement event chains. Two turns per round, 20 rounds. Final score cash + purchase cost + spent upgrades; ties shared. Bankruptcy on unaffordable mandatory payment. No optional overdraft. Country price distributions identical, not real economic valuations.

## Final contract
Host creates random code/link, second player joins, both ready then start. Authoritative dice/state, validate turn, balance and duplicate requests. Separate seat recovery tokens; refresh/reconnect resync, block offline input. Explicit room expiry/restart persistence. Event IDs and values in shared state, not translated strings. No secrets in browser. Genuine two-session validation.

## UI and architecture
Reference is guidance, never a screenshot with overlaid buttons. Functional cells and detail panel; landscape side panel, portrait scrollable board and panel below. Photo of Dubu is temporary artwork, replaceable later. React/TypeScript with Vite/Vinext from Sites scaffold, shadcn Button, CSS. Data in lib/board.ts; later rule engine separate from UI. Phase 1 local preview only; internet hosting and PWA phase 5.

## Stage 2 rule clarifications
Rent = base rent × (upgrade level + 1), levels 0–3. One upgrade per landing. Paying exactly all remaining cash is allowed; only an unaffordable mandatory cost causes bankruptcy. Bankruptcy transfers remaining cash to the rent creditor, cash becomes zero and game ends immediately. Forward event movement awards start bonus and resolves destination city purchase/rent/upgrade; backward movement has no start bonus. A second event tile reached by a card is inert. All corners except start are free rest. Events are sampled independently with replacement. The round counter increments after player 2 ends their turn. At the end of round 20, both players have taken 20 turns unless bankruptcy ended play early.

## Stage 2 save contract
One-device pass-and-play only. Save version 1 contains initial names and accepted action journal (dice and event outcomes included); restore replays through pure rule engine. Phase and ownership are reconstructed, not trusted as arbitrary saved state. UI synchronously rejects duplicate stale revisions. Browser storage is per origin/device; localhost and LAN IP are separate saves. Clearing browser data loses saves. Multiple tabs sharing one origin are not synchronized and should not be used concurrently. Room authority and two-device synchronization remain stage 3. Bump save version or migrate before incompatible future rule changes.
