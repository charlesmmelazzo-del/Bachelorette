# Handoff for Claude Code: DWTS Bachelorette live game

Mike (mike@cgcocktails.com) is launching this party game for Lauren's bachelorette. The app is **built and tested**. Your job is to help him **deploy it** to GitHub and Railway and do a final test. Don't rewrite the app unless he asks.

## What this is
- A Node app: Express + Socket.io + qrcode. `npm start` runs `server.js` on `$PORT`.
- `/host` is the big-screen TV view. The host presses Space to advance.
- `/` is the phone view. Players pick their name, write performance pitches, and vote.
- All editable content (couples, celebrity partners, one-liners, dances, songs, prompts, judge quips, prize text) is in `game-data.js`.
- Game state is in memory, backed up to `data/state.json` (git-ignored).
- The prize QR image goes at `prize/prize.png`. It's served **only** to the champion's phone at the finale, via `/prize?token=`.
- README.md has the full game flow and host keyboard shortcuts.

## Already verified (in a cloud sandbox)
- A full 10-player game ran end to end with Playwright: lobby → rules → 20 intro steps → cast → 9 rounds → finale. No page errors.
- Tested: tie-breaking, duplicate name rejection, blocked players can't vote, a reconnecting phone keeps its identity, the Bride Clause toggle.

## Launch checklist (walk Mike through these)
1. Run `npm install`, then `npm start`. Open http://localhost:3000/host and http://localhost:3000 to sanity-check locally.
2. **Prize:** Mike will provide the Common Good $15 gift card QR image. Save it as `prize/prize.png`. It can be a PNG, JPG or WEBP named `prize.*`.
3. **GitHub:** create a **PRIVATE** repo, because it contains the prize QR. Commit everything except node_modules and data (already in .gitignore). Push.
   - With the gh CLI: `gh repo create dwts-live --private --source=. --push`
4. **Railway:** New Project → Deploy from GitHub repo. It auto-detects Node and runs `npm start`. No build step is needed.
   - Settings → Networking → **Generate Domain**.
   - Variables: set `HOST_KEY` to a secret word. The host URL becomes `/host?key=<word>`.
   - Optional: `WRITE_SECONDS` (default 90), `VOTE_SECONDS` (default 45), `PUBLIC_URL` (only needed for a custom domain).
   - If the Railway CLI is available: `railway login`, `railway init`, `railway up`, `railway domain`.
5. **Smoke test on the live URL:** open `/host?key=...`, scan the QR with a phone, join as a name, and advance a few screens. Then use "Reset game" (click twice) in the host controls before the party.
6. Remind Mike to keep the backup PowerPoint handy in case the Wi-Fi fails.

## Notes and gotchas
- Socket.io needs a single instance. Keep Railway at 1 replica.
- The QR code URL comes from `x-forwarded-proto` / `x-forwarded-host`, so it works on Railway automatically.
- Celebrity photos are from Wikimedia Commons (CC licenses), resized, in `public/img/`.
- The judges' comments are parody.
