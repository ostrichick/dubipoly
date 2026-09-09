# Dubipoly

Stage 2: playable single-device, two-person game. Each player takes turns using the same screen. Independent phones do NOT yet share game state.

Node >=22.13. `npm ci`, then `npm run dev -- --host 0.0.0.0`. Use the printed localhost URL. On the same Wi-Fi use the computer LAN IPv4 in place of localhost and preserve the port; allow the process on Windows private-network firewall if needed. Keep computer/server running. No port forwarding needed. This does not yet synchronize gameplay.

`npm run build`, `npx tsc --noEmit`, `npm test`.

## Play
Choose Korean or Spanish, enter two names (optional), and start. Roll two dice. Buy or skip an unowned city, pay opponent rent automatically, or upgrade your own landed city once. End the turn and pass the device. Two turns make one round. After 20 rounds the higher total assets win; inability to pay a mandatory cost ends the game early. Read the in-game rules for details.

Progress saves automatically in this browser; refresh to resume. A finished result also survives refresh. New game asks for confirmation; cancel preserves the current game. Storage failures show a warning. Clearing browser storage loses progress. Use the same address to resume (localhost and LAN IP use different storage). Avoid simultaneously opening this single-device game in multiple tabs. No network rooms until stage 3.

Read SPEC.md, PLAN.md and PROGRESS.md before resuming. Internet hosting and PWA are phase 5; no paid resources created. Personal Dubu photo supplied by user for private project. Replace artwork independently of UI.
