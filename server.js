const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { Server } = require("socket.io");
const DATA = require("./game-data");

const PORT = process.env.PORT || 3000;
const HOST_KEY = process.env.HOST_KEY || ""; // optional: protects /host
const PUBLIC_URL = process.env.PUBLIC_URL || ""; // optional: override the URL in the QR code
const WRITE_SECONDS = +process.env.WRITE_SECONDS || 90;
const VOTE_SECONDS = +process.env.VOTE_SECONDS || 45;
const INTRO_SECONDS = +process.env.INTRO_SECONDS || 10; // partner-reveal slides auto-advance
// How long each screen stays up before moving on by itself (the host can always press Next sooner).
// The lobby waits for the host; writing and voting run on their own timers; the finale is the end.
const AUTO_SECONDS = {
  rules: 12,        // "Here's how tonight works"
  intro: INTRO_SECONDS,
  emergency: 28,    // the partner-swap "emergency message" (alert, photo, typed-out quote)
  cast: 8,          // "This season's couples"
  roundIntro: 6,    // "Here's who's left"
  perform: 15,      // each of the two performances
  suspense: 4,      // drumroll
  result: 15,       // eliminated + judges
};
const STATE_FILE = path.join(__dirname, "data", "state.json");
const PRIZE_DIR = path.join(__dirname, "prize");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const NAMES = DATA.COUPLES.map(c => c.name);
const byName = Object.fromEntries(DATA.COUPLES.map(c => [c.name, c]));
const partner = n => (S.swapped && byName[n].swap ? { ...byName[n], ...byName[n].swap } : byName[n]);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = a => a[Math.floor(Math.random() * a.length)];

// ---------------- STATE ----------------
function freshState(keepPlayers) {
  return {
    phase: "lobby",          // lobby | rules | intro | cast | roundIntro | block | perform | vote | suspense | result | finale
    introStep: 0,            // 0..(2*N-1): even = question, odd = reveal
    swapped: false,          // true once the "emergency message" partner swap has happened
    autoAt: null,            // when the current screen auto-advances (see AUTO_SECONDS)
    players: keepPlayers || {}, // name -> token
    remaining: NAMES.slice(),
    eliminated: [],          // [{name, round, tally}]
    blockCount: {},
    settings: { brideClause: false },
    round: null,
    decks: { dances: [], songs: [] },
    champion: null,
  };
}
let S = freshState();
try { if (fs.existsSync(STATE_FILE)) S = Object.assign(freshState(), JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch (e) { console.error("Could not load state", e); }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(S)); } catch (e) { console.error(e); }
  }, 200);
}

function draw(deckName, source) {
  if (!S.decks[deckName] || S.decks[deckName].length === 0) S.decks[deckName] = shuffle(source.map((_, i) => i));
  return source[S.decks[deckName].pop()];
}

function pickBlock() {
  let pool = S.remaining.slice();
  if (S.settings.brideClause && pool.length > 2) pool = pool.filter(n => !byName[n].bride);
  // prefer couples who've been on the block the fewest times
  const min = Math.min(...pool.map(n => S.blockCount[n] || 0));
  let fresh = shuffle(pool.filter(n => (S.blockCount[n] || 0) === min));
  let rest = shuffle(pool.filter(n => (S.blockCount[n] || 0) !== min));
  return fresh.concat(rest).slice(0, 2);
}

function newRound() {
  const block = pickBlock();
  const assign = {};
  block.forEach(n => {
    const [song, artist] = draw("songs", DATA.SONGS);
    assign[n] = { dance: draw("dances", DATA.DANCES), song, artist };
  });
  S.round = {
    n: S.eliminated.length + 1,
    final: S.remaining.length === 2,
    block, assign,
    prompt: rand(DATA.PROMPTS),
    answers: {},
    votes: {},
    deadline: null,
    performIdx: 0,
    result: null,
  };
}

function reshuffleRound() {
  if (!S.round || !["roundIntro", "block"].includes(S.phase)) return;
  newRound();
  if (S.phase === "block") S.round.deadline = Date.now() + WRITE_SECONDS * 1000;
}

function eligibleVoters() {
  if (!S.round) return [];
  return Object.keys(S.players).filter(n => !S.round.block.includes(n));
}

function tallyVotes() {
  const r = S.round, [a, b] = r.block;
  const tally = { [a]: 0, [b]: 0 };
  Object.values(r.votes).forEach(t => { if (t in tally) tally[t]++; });
  let out, tie = false;
  // Votes are for the favorite performance: the couple with FEWER votes goes home
  if (tally[a] === tally[b]) { tie = true; out = rand([a, b]); }
  else out = tally[a] < tally[b] ? a : b;
  const survivor = out === a ? b : a;
  const judges = Object.entries(DATA.JUDGE_QUIPS).map(([j, qs]) => ({ judge: j, quote: rand(qs), score: 2 + Math.floor(Math.random() * 5) }));
  r.result = { out, survivor, tally, tie, judges };
}

function applyElimination() {
  const r = S.round;
  if (!r || !r.result || r.applied) return;
  r.applied = true;
  S.remaining = S.remaining.filter(n => n !== r.result.out);
  S.eliminated.push({ name: r.result.out, round: r.n, tally: r.result.tally });
  r.block.forEach(n => S.blockCount[n] = (S.blockCount[n] || 0) + 1);
  if (S.remaining.length === 1) S.champion = S.remaining[0];
}

// The single "next" button the host presses
function advance() {
  const N = NAMES.length;
  switch (S.phase) {
    case "lobby": S.phase = "rules"; break;
    case "rules": S.phase = "intro"; S.introStep = 0; break;
    case "intro":
      // a reveal of a couple with a `swap` is interrupted by the emergency message
      if (S.introStep % 2 === 1 && DATA.COUPLES[(S.introStep - 1) / 2].swap && !S.swapped) { S.phase = "emergency"; S.swapped = true; break; }
      if (S.introStep < 2 * N - 1) S.introStep++;
      else S.phase = "cast";
      break;
    case "emergency":
      S.phase = "intro";
      if (S.introStep < 2 * N - 1) S.introStep++;
      else S.phase = "cast";
      break;
    case "cast": newRound(); S.phase = "roundIntro"; break;
    case "roundIntro":
      S.phase = "block"; S.round.deadline = Date.now() + WRITE_SECONDS * 1000; break;
    case "block": S.phase = "perform"; S.round.performIdx = 0; S.round.deadline = null; break;
    case "perform":
      if (S.round.performIdx < 1) S.round.performIdx++;
      else { S.phase = "vote"; S.round.deadline = Date.now() + VOTE_SECONDS * 1000; }
      break;
    case "vote": S.round.deadline = null; tallyVotes(); S.phase = "suspense"; break;
    case "suspense": applyElimination(); S.phase = "result"; break;
    case "result":
      if (S.champion) S.phase = "finale";
      else { newRound(); S.phase = "roundIntro"; }
      break;
    case "finale": break;
  }
  timeAuto();
}
function timeAuto() { S.autoAt = AUTO_SECONDS[S.phase] ? Date.now() + AUTO_SECONDS[S.phase] * 1000 : null; }
function back() {
  // light "oops" support for the non-destructive screens
  if (S.phase === "intro" && S.introStep > 0) S.introStep--;
  else if (S.phase === "intro") S.phase = "rules";
  else if (S.phase === "emergency") { S.phase = "intro"; S.swapped = false; }
  else if (S.phase === "rules") S.phase = "lobby";
  else if (S.phase === "cast") { S.phase = "intro"; S.introStep = 2 * NAMES.length - 1; }
  else if (S.phase === "perform" && S.round.performIdx > 0) S.round.performIdx--;
  timeAuto();
}

// ---------------- VIEWS ----------------
function publicState() {
  const r = S.round;
  let round = null;
  if (r) {
    const showAnswers = ["perform", "vote", "suspense", "result", "finale"].includes(S.phase);
    round = {
      n: r.n, final: r.final, block: r.block, assign: r.assign, prompt: r.prompt,
      submitted: Object.fromEntries(r.block.map(n => [n, !!r.answers[n]])),
      answers: showAnswers ? Object.fromEntries(r.block.map(n => [n, r.answers[n] || ""])) : null,
      voteCount: Object.keys(r.votes).length,
      eligible: eligibleVoters().length,
      deadline: r.deadline,
      performIdx: r.performIdx,
      autofilled: showAnswers ? (r.autofilled || []) : [],
      result: ["result", "finale"].includes(S.phase) ? r.result : (S.phase === "suspense" ? { tie: r.result && r.result.tie } : null),
    };
  }
  return {
    phase: S.phase, introStep: S.introStep, swapped: S.swapped, autoAt: S.autoAt, autoSeconds: AUTO_SECONDS[S.phase] || 0,
    joined: Object.keys(S.players),
    remaining: S.remaining, eliminated: S.eliminated,
    settings: S.settings, round, champion: S.phase === "finale" ? S.champion : null,
    now: Date.now(),
  };
}

function playerView(name) {
  const r = S.round;
  return {
    name,
    myAnswer: r && r.answers[name] || "",
    myVote: r && r.votes[name] || null,
    hasPrize: S.phase === "finale" && S.champion === name && prizeFile() !== null,
  };
}

function prizeFile() {
  for (const f of ["prize.png", "prize.jpg", "prize.jpeg", "prize.webp"]) {
    const p = path.join(PRIZE_DIR, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function broadcast() {
  const pub = publicState();
  for (const [, sock] of io.of("/").sockets) {
    const d = sock.data;
    sock.emit("state", { ...pub, you: d.role === "player" && d.name ? playerView(d.name) : null });
  }
  save();
}

// ---------------- HTTP ----------------
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "play.html")));
app.get("/host", (req, res) => {
  if (HOST_KEY && req.query.key !== HOST_KEY) return res.status(403).send('Wrong host password. <a href="/">Go back and try again</a>.');
  res.sendFile(path.join(__dirname, "public", "host.html"));
});
app.get("/api/config", (req, res) => res.json({
  title: DATA.SHOW_TITLE, subtitle: DATA.SUBTITLE, prizeText: DATA.PRIZE_TEXT,
  couples: DATA.COUPLES, writeSeconds: WRITE_SECONDS, voteSeconds: VOTE_SECONDS,
  hostKeyRequired: !!HOST_KEY,
}));
function joinUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL.replace(/\/$/, "") + "/";
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}/`;
}
app.get("/qr.svg", async (req, res) => {
  const svg = await QRCode.toString(joinUrl(req), { type: "svg", margin: 1, color: { dark: "#1A0B2E", light: "#FFFFFF" } });
  res.type("image/svg+xml").send(svg);
});
app.get("/api/joinurl", (req, res) => res.json({ url: joinUrl(req) }));
// Prize image: only served to the champion's own token
app.get("/prize", (req, res) => {
  const tok = req.query.token || "";
  const f = prizeFile();
  if (!f || S.phase !== "finale" || !S.champion || S.players[S.champion] !== tok) return res.status(404).send("Not yet!");
  res.sendFile(f);
});
app.get("/healthz", (req, res) => res.send("ok"));

// ---------------- SOCKETS ----------------
io.on("connection", (sock) => {
  const { role, key, token } = sock.handshake.auth || {};
  if (role === "host") {
    if (HOST_KEY && key !== HOST_KEY) { sock.emit("error-msg", "Wrong host key"); return sock.disconnect(); }
    sock.data.role = "host";
  } else {
    sock.data.role = "player";
    sock.data.token = token;
    const name = Object.keys(S.players).find(n => S.players[n] === token);
    if (name) sock.data.name = name;
  }
  sock.emit("state", { ...publicState(), you: sock.data.name ? playerView(sock.data.name) : null });

  // ----- player events -----
  sock.on("join", (name, cb) => {
    if (sock.data.role !== "player" || !NAMES.includes(name)) return cb && cb({ ok: false, msg: "Unknown name" });
    const owner = S.players[name];
    if (owner && owner !== sock.data.token) return cb && cb({ ok: false, msg: "Someone already picked that name. Ask the host to free it up." });
    // free any previous name this token held
    for (const n of Object.keys(S.players)) if (S.players[n] === sock.data.token && n !== name) delete S.players[n];
    S.players[name] = sock.data.token;
    sock.data.name = name;
    cb && cb({ ok: true });
    broadcast();
  });
  sock.on("answer", (text, cb) => {
    const r = S.round, n = sock.data.name;
    if (!r || S.phase !== "block" || !r.block.includes(n)) return cb && cb({ ok: false, msg: "Not your turn!" });
    if (r.deadline && Date.now() > r.deadline + 2000) return cb && cb({ ok: false, msg: "Time's up!" });
    r.answers[n] = String(text || "").trim().slice(0, 220);
    cb && cb({ ok: true });
    broadcast();
    autoCheck();
  });
  sock.on("vote", (target, cb) => {
    const r = S.round, n = sock.data.name;
    if (!r || S.phase !== "vote" || !n || r.block.includes(n) || !r.block.includes(target)) return cb && cb({ ok: false, msg: "Voting isn't open for you" });
    if (r.deadline && Date.now() > r.deadline + 2000) return cb && cb({ ok: false, msg: "Voting is closed!" });
    // Voting for the bride's opponent (i.e. voting the bride out) gets you called out on the big screen
    const bride = r.block.find(b => byName[b].bride);
    if (bride && target !== bride && r.votes[n] !== target) io.emit("shame", { voter: n, bride });
    r.votes[n] = target;
    cb && cb({ ok: true });
    broadcast();
    autoCheck();
  });

  // ----- host events -----
  const hostOnly = fn => (...args) => { if (sock.data.role === "host") { fn(...args); broadcast(); } };
  // Writing and voting are run by the timer only (they end early once everyone is in)
  sock.on("host:advance", hostOnly(() => { if (!["block", "vote"].includes(S.phase)) advance(); }));
  sock.on("host:back", hostOnly(() => back()));
  sock.on("host:reshuffle", hostOnly(() => reshuffleRound()));
  sock.on("host:extend", hostOnly(() => { if (S.round && S.round.deadline) S.round.deadline = Math.max(S.round.deadline, Date.now()) + 30000; }));
  sock.on("host:bride", hostOnly(v => { S.settings.brideClause = !!v; }));
  sock.on("host:release", hostOnly(name => { delete S.players[name]; }));
  // Full restart: forget every name and send every screen (TV and phones) back to the welcome screen
  sock.on("host:reset", hostOnly(() => { S = freshState(); io.emit("reset"); }));
});

// ---------------- AUTO-ADVANCE ----------------
// Most screens move on after AUTO_SECONDS. Writing and voting move on once everyone is in
// (after a short beat so the TV can show the last "✔"), or when the timer runs out, at which
// point stragglers get an embarrassing routine written for them / a vote cast for them.
function everyoneIn() {
  const r = S.round;
  if (!r) return false;
  if (S.phase === "block") return r.block.every(b => r.answers[b]);
  if (S.phase === "vote") { const el = eligibleVoters(); return el.length > 0 && el.every(v => r.votes[v]); }
  return false;
}
let autoTimer = null;
function autoCheck() {
  if (autoTimer || !everyoneIn()) return;
  const phase = S.phase, r = S.round;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    if (S.phase === phase && S.round === r && everyoneIn()) { advance(); broadcast(); }
  }, 3000);
}
function fillStragglers() {
  const r = S.round;
  if (S.phase === "block") {
    r.autofilled = r.autofilled || [];
    r.block.filter(b => !r.answers[b]).forEach(b => {
      r.answers[b] = rand(DATA.AUTOFILL_ROUTINES).replaceAll("{name}", b).replaceAll("{celeb}", partner(b).short);
      r.autofilled.push(b);
    });
  }
  if (S.phase === "vote") eligibleVoters().filter(v => !r.votes[v]).forEach(v => { r.votes[v] = rand(r.block); });
}
setInterval(() => {
  const r = S.round;
  if (S.autoAt && AUTO_SECONDS[S.phase] && Date.now() >= S.autoAt) { advance(); broadcast(); return; }
  if (r && r.deadline && ["block", "vote"].includes(S.phase) && Date.now() > r.deadline + 1500) { fillStragglers(); advance(); broadcast(); }
}, 500);

// Tick so countdowns stay in sync on clients
setInterval(() => { if (S.round && S.round.deadline) io.emit("tick", Date.now()); }, 5000);

server.listen(PORT, () => console.log(`DWTS live on :${PORT}  — host screen at /host${HOST_KEY ? "?key=..." : ""}`));
