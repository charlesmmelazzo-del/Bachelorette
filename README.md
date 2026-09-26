# Dancing with the Stars: Lauren's Bachelorette Edition (live game)

A Jackbox-style party game. The TV shows the ballroom (host screen), and everyone plays on their phone.

## How the game runs

1. **Lobby:** the TV shows a QR code. Everyone scans it and taps her name.
2. **How it works + prize:** the TV announces that the champion wins the gift card.
3. **Meet the couples:** a question-mark frame for each girl, then the flip reveals her AI-cast celebrity partner.
4. **Rounds (repeat until one couple is left):**
   - "Here's who's left" shows the couples still in.
   - "On the chopping block" puts two couples up. Each gets a random dance and a random (ridiculous) song.
   - Those two write their performance pitch on their phones, with a 90-second timer.
   - The TV shows each performance one at a time.
   - Everyone else votes on their phone for who to eliminate. Eliminated girls keep voting. 45-second timer.
   - Drumroll, reveal, vote split, parody judges' comments.
5. **Finale:** confetti. The gift card QR appears **only on the winner's phone** so she can screenshot it.

## Running the host screen

Open `https://YOUR-APP.up.railway.app/host` on the laptop connected to the TV, then press **F** for fullscreen.

| Key | Does |
|---|---|
| Space / → | Next |
| ← | Back (intro screens only) |
| F | Fullscreen |
| H | Show/hide host controls (they also appear when you hover the bottom-left corner) |

Host controls:

- **Reshuffle round:** picks two different couples, if you don't like the matchup.
- **+30s:** adds time to the writing or voting timer.
- **Bride Clause:** when checked, Lauren can't be put on the chopping block until the final two.
- **Reset game:** bottom-right corner of the TV (or in the host controls). Click it twice. It clears every player and sends the TV and all phones back to the welcome screen.
- **Name taken by the wrong phone?** In the lobby, double-click the name on the TV to free it up.

## Deploying to Railway (about 10 minutes)

1. **Add the prize:** save the gift card QR image as `prize/prize.png`.
2. **Push to GitHub** as a **private** repo. Private matters because the prize QR is in it.
   ```bash
   cd dwts-live
   git init && git add . && git commit -m "DWTS live game"
   gh repo create dwts-live --private --source=. --push   # or create the repo on github.com and push
   ```
3. **On Railway:** New Project → Deploy from GitHub repo → pick `dwts-live`. Railway detects Node and runs `npm start`.
4. **Settings → Networking → Generate Domain.** That gives you `https://something.up.railway.app`.
5. **Recommended:** add a variable `HOST_KEY` = any secret word. Then the host screen is `/host?key=yourword`, so no one can control the show from their phone.
6. Open `/host` on the TV laptop and scan the QR with your own phone to test.

Optional variables:

| Variable | Default | What it does |
|---|---|---|
| `HOST_KEY` | (none) | Protects the host screen |
| `WRITE_SECONDS` | 90 | Time to write a routine |
| `VOTE_SECONDS` | 45 | Time to vote |
| `PUBLIC_URL` | auto | Force the URL in the QR code, if you add a custom domain |

## Customizing

Everything is in **`game-data.js`**: names, celebrity partners, one-liners, the dance list, the song list, the writing prompts, the judges' comments and the prize text. Edit it, push, and Railway redeploys automatically.

## Run it locally

```bash
npm install
npm start          # then open http://localhost:3000/host
```
Phones on the same Wi-Fi can join via your computer's local IP, e.g. `http://192.168.1.20:3000`.

## Good to know

- Game state lives in memory, with a backup in `data/state.json`. If the server restarts mid-game, it picks up where it left off (until the next deploy).
- If someone's phone locks or refreshes, she's still logged in as herself when she comes back.
- If there's a tie, the "judges" break it at random, with an "IT'S A TIE!" moment on screen.
- Keep the PowerPoint as a backup in case the Wi-Fi is bad.
- Celebrity photos come from Wikimedia Commons (Creative Commons licenses). Everything the judges say is parody.
