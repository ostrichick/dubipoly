# Dubipoly

Stage 8: hosted two-player mobile web game. Each player joins the same room from a separate phone. 
The official web deployment is available at `https://dubipoly.ostrichick.workers.dev`.

Node >=22.13. `npm ci`, then `npm run dev -- --host 0.0.0.0`. Use the printed localhost URL. On the same Wi-Fi use the computer LAN IPv4 in place of localhost and preserve the port; allow the process on Windows private-network firewall if needed. Keep computer/server running. No port forwarding needed. This does not yet synchronize gameplay.

`npm run build`, `npm test`.

## Play
Choose Korean or Spanish, enter two names (optional), and start. Roll two dice. Buy or skip an unowned city, pay opponent rent automatically, or upgrade your own landed city once. End the turn and pass the device. Two turns make one round. After 20 rounds the higher total assets win; inability to pay a mandatory cost ends the game early. Read the in-game rules for details.

For a shared match, create a room on one phone and join with the six-character code or shared link on the other phone. The server owns the dice, events, turn order, balance, and ownership state. The room token is saved locally on each device so refresh/reconnect can resume the same seat. Use `상태 새로고침` if a device reports a stale state. The current deployment is owner-private and still needs a real two-Android acceptance test.

Read SPEC.md, PLAN.md and PROGRESS.md before resuming. Personal Dubu photo supplied by the user remains temporary artwork; replace it independently of the game rules when the character asset is available.
