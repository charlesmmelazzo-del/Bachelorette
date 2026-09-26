const params = new URLSearchParams(location.search);
const socket = io({ auth: { role: "host", key: params.get("key") || "" } });
let CFG = null, ST = null, clockSkew = 0, resetArmed = 0;

const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v; else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
// A couple's current partner (after the emergency swap, the swapped-in celebrity)
const C = name => { const c = CFG.couples.find(c => c.name === name); return ST && ST.swapped && c.swap ? { ...c, ...c.swap } : c; };
const couple = n => `${n} & ${C(n).short}`;
const img = n => `img/${C(n).img}.jpg`;
const frame = (n, cls = "") => h("div", { class: "frame " + cls }, h("img", { src: img(n), alt: C(n).celeb }));
const qframe = () => h("div", { class: "frame q" }, h("span", {}, "?"));
const pickFrom = (arr, seed) => arr[Math.abs(seed) % arr.length];

fetch("/api/config").then(r => r.json()).then(c => { CFG = c; if (ST) render(); });
fetch("/api/joinurl").then(r => r.json()).then(j => window.JOIN_URL = j.url);
socket.on("state", s => { ST = s; clockSkew = s.now - Date.now(); if (CFG) render(); });
socket.on("tick", t => { clockSkew = t - Date.now(); });
socket.on("reset", () => { try { localStorage.removeItem("dwts_role"); } catch (e) {} location.href = "/"; });
socket.on("error-msg", m => alert(m));

// ---------- "voting out the bride" call-outs (3 seconds each, queued) ----------
const shameQueue = [];
let shaming = false;
socket.on("shame", x => { shameQueue.push(x); if (!shaming) nextShame(); });
function nextShame() {
  const x = shameQueue.shift(), box = $("shame");
  if (!x) { shaming = false; box.style.display = "none"; return; }
  shaming = true;
  box.replaceChildren(
    h("div", { class: "shame-wow" }, "WOW."),
    h("div", {}, h("div", { class: "shame-line" }, h("b", {}, x.voter), ` is voting to eliminate ${x.bride}!`),
      h("div", { class: "shame-sub" }, "Wow. That says a lot about them.")));
  box.style.display = "";
  box.style.animation = "none"; void box.offsetWidth; box.style.animation = ""; // replay the pop-in for each call-out
  shameTimer = setTimeout(nextShame, 3000);
}
let shameTimer = null;
function clearShame() { shameQueue.length = 0; clearTimeout(shameTimer); shaming = false; $("shame").style.display = "none"; }

// ---------- controls ----------
const send = (ev, v) => socket.emit(ev, v);
$("bNext").onclick = () => send("host:advance");
$("nextBig").onclick = e => { e.currentTarget.blur(); send("host:advance"); };
// Big-screen reset: two clicks within 3 seconds. Everyone (TV included) goes back to the welcome screen.
let bigResetArmed = 0, bigResetTimer = null;
$("resetBig").onclick = e => {
  const b = e.currentTarget;
  b.blur();
  clearTimeout(bigResetTimer);
  const disarm = () => { bigResetArmed = 0; b.classList.remove("armed"); b.textContent = "↺ Reset game"; };
  if (Date.now() - bigResetArmed < 3000) { send("host:reset"); disarm(); return; }
  bigResetArmed = Date.now();
  b.classList.add("armed");
  b.textContent = "Click again to restart the whole game";
  bigResetTimer = setTimeout(disarm, 3000);
};
$("bBack").onclick = () => send("host:back");
$("bShuffle").onclick = () => send("host:reshuffle");
$("bExtend").onclick = () => send("host:extend");
$("cBride").onchange = e => send("host:bride", e.target.checked);
$("bReset").onclick = () => {
  if (Date.now() - resetArmed < 3000) { send("host:reset"); resetArmed = 0; $("bReset").textContent = "Reset game…"; }
  else { resetArmed = Date.now(); $("bReset").textContent = "Click again to restart everything"; setTimeout(() => $("bReset").textContent = "Reset game…", 3000); }
};
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === " " || e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); send("host:advance"); }
  if (e.key === "ArrowLeft" || e.key === "PageUp") send("host:back");
  if (e.key === "f" || e.key === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  if (e.key === "h" || e.key === "H") document.body.classList.toggle("show-controls");
});

// ---------- timers ----------
setInterval(() => {
  const el = document.querySelector("[data-deadline]");
  if (!el) return;
  const left = Math.max(0, Math.ceil((+el.dataset.deadline - (Date.now() + clockSkew)) / 1000));
  el.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "TIME!";
  el.classList.toggle("low", left <= 10);
}, 250);
const timer = dl => dl ? h("div", { class: "timer", "data-deadline": dl }, "") : null;

// ---------- emergency message: alert (3s) → photo → quote types out → new partner ----------
const EM_ALERT_MS = 3000, EM_TYPE_START_MS = 4000, EM_CHARS_PER_SEC = 28;
setInterval(() => {
  const em = document.querySelector(".emergency");
  if (!em) return;
  const t = Date.now() - +em.dataset.started, msg = em.dataset.msg;
  em.classList.toggle("alert", t < EM_ALERT_MS);
  const n = Math.max(0, Math.min(msg.length, Math.floor((t - EM_TYPE_START_MS) / 1000 * EM_CHARS_PER_SEC)));
  const typed = em.querySelector(".em-typed");
  if (typed.textContent.length !== n) typed.textContent = msg.slice(0, n);
  em.classList.toggle("typed", n >= msg.length && t > EM_TYPE_START_MS);
}, 40);

// ---------- confetti ----------
function confetti(on) {
  const box = $("confetti");
  if (!on) { box.innerHTML = ""; return; }
  if (box.childElementCount) return;
  const colors = ["#F2C94C", "#FF5FB0", "#ffffff", "#C8A24A", "#B388FF"];
  for (let i = 0; i < 90; i++) box.append(h("i", { style: `left:${Math.random() * 100}vw;background:${colors[i % 5]};animation-duration:${3 + Math.random() * 4}s;animation-delay:${-Math.random() * 6}s` }));
}

// ---------- rendering ----------
function setScene(bg, cornerText, mcText, showJoin = true) {
  $("stage").className = "bg-" + bg;
  $("corner").textContent = cornerText || "";
  const mc = $("mc");
  if (mcText) { mc.style.display = ""; mc.replaceChildren(h("b", {}, "MC:"), mcText); } else mc.style.display = "none";
  $("joinCorner").style.display = showJoin ? "" : "none";
}

function grid(names, big) {
  return h("div", { class: "grid" + (big ? " big" : "") }, names.map(n =>
    h("div", { class: "cell pop" }, frame(n), h("div", { class: "nm" }, n), h("div", { class: "cl" }, "& " + C(n).celeb))));
}

// The on-screen "what happens next" button (lobby has its own START button; finale is the end)
function nextLabel(s) {
  const r = s.round;
  switch (s.phase) {
    case "rules": return "Meet the couples ▶";
    case "intro": return s.introStep % 2 === 0 ? "Reveal partner ▶" : (s.introStep >= 2 * CFG.couples.length - 1 ? "See all couples ▶" : "Next couple ▶");
    case "emergency": return "Next couple ▶";
    case "cast": return "Start round 1 ▶";
    case "roundIntro": return "Who's on the block? ▶";
    case "block": return "";
    case "perform": return r.performIdx < 1 ? "Next performance ▶" : "Open voting ▶";
    case "vote": return "";
    case "suspense": return "Reveal ▶";
    case "result": return r.final ? "Crown the champion 🏆" : "Next round ▶";
  }
  return "";
}

function render() {
  const s = ST, stage = $("stage"), r = s.round;
  const nl = nextLabel(s), nb = $("nextBig");
  nb.style.display = nl ? "" : "none";
  nb.textContent = nl;
  $("resetBig").style.display = s.phase === "lobby" ? "none" : "";
  $("cBride").checked = !!s.settings.brideClause;
  confetti(s.phase === "finale");
  if (s.phase !== "vote") clearShame();
  let body;
  switch (s.phase) {
    case "lobby": {
      setScene("stage", "", "Grab your phones, ladies! Scan the code and pick your name.", false);
      body = [
        h("div", { class: "kicker" }, "Live tonight · The Bachelorette Special"),
        h("div", { class: "title-xl" }, CFG.title.toUpperCase()),
        h("div", { class: "sub" }, CFG.subtitle),
        h("div", { class: "lobby-wrap", style: "margin-top:3vh" },
          h("div", {}, h("div", { class: "qr-big" }, h("img", { src: "/qr.svg", alt: "Scan to join" })), h("div", { class: "url" }, window.JOIN_URL || "")),
          h("div", {},
            h("div", { class: "kicker", style: "margin-bottom:1.5vh" }, `${s.joined.length} of ${CFG.couples.length} contestants checked in`),
            h("div", { class: "names" }, CFG.couples.map(c => h("div", {
              class: "chip" + (s.joined.includes(c.name) ? " on" : ""),
              title: "Double-click to free up this name",
              ondblclick: () => s.joined.includes(c.name) && send("host:release", c.name),
            }, c.name))),
            h("button", { class: "startbtn", onclick: () => send("host:advance") }, "▶  START THE SHOW"))),
      ];
      break;
    }
    case "rules": {
      setScene("question", "", "Closest thing to a real TV show you'll ever be on. Let's go!");
      body = [
        h("div", { class: "title-l" }, "HERE'S HOW TONIGHT WORKS"),
        h("div", { class: "steps" },
          [["1", "Meet the couples", "AI cast each of you with a celebrity partner. Guess who before the big reveal."],
           ["2", "The chopping block", "Each round, two couples get a random dance and song. Pitch your performance on your phone."],
           ["3", "Vote for your favorite", "Everyone else votes for the best performance. That couple stays; the other goes home. Last couple standing wins."]]
            .map(([n, t, d]) => h("div", { class: "step card" }, h("div", { class: "num" }, n), h("h3", {}, t), h("p", {}, d)))),
        h("div", { class: "prize" }, `🏆 The Mirrorball champion wins ${CFG.prizeText}!`),
      ];
      break;
    }
    case "intro": {
      const idx = Math.floor(s.introStep / 2), reveal = s.introStep % 2 === 1, n = CFG.couples[idx].name, c = C(n);
      const kick = c.bride ? "And now... our bride-to-be!" : `Contestant ${idx + 1} of ${CFG.couples.length}`;
      setScene(reveal ? "reveal" : "question", "Round one · Meet the couples",
        reveal ? `${c.celeb}! Who called it?` : (c.bride ? "Ladies, on your feet for the bride! Who's HER partner?" : pickFrom(["Who's her partner, ballroom? Shout it out!", "Who did AI pick for her?", "Who's waiting backstage for her?", "Loudest guess wins!"], idx)));
      body = [h("div", { class: "split" },
        reveal ? frame(n, "flip") : qframe(),
        h("div", { class: "txt" },
          h("div", { class: "kicker" }, kick),
          h("div", { class: "title-xl", style: reveal ? "color:#fff;font-size:4.4vw" : "" }, n.toUpperCase()),
          h("div", { class: "sub" }, "is dancing with..."),
          reveal ? [h("div", { class: "title-l pop" }, c.celeb.toUpperCase()), h("div", { class: "sub", style: "font-size:1.7vw;margin-top:2vh" }, c.why)] : null))];
      break;
    }
    case "emergency": {
      const t = CFG.couples.find(c => c.swap), sw = t.swap;
      setScene("emergency", "", `Uh oh. ${t.name}, I think you have a new partner...`, false);
      // Built once, then animated by the emergency ticker below, so state updates don't restart the typing
      const started = s.autoAt - s.autoSeconds * 1000 - clockSkew;
      const existing = $("stage").querySelector(".emergency");
      if (existing && +existing.dataset.started === started) return;
      body = h("div", { class: "emergency alert", "data-started": started, "data-msg": `“${sw.message}”` },
        h("div", { class: "em-head" }, "🚨 EMERGENCY MESSAGE FROM THE OFFICE OF THE PRESIDENT OF THE UNITED STATES 🚨"),
        h("div", { class: "em-body" },
          h("div", { class: "frame em-photo" }, h("img", { src: `img/${sw.img}.jpg`, alt: sw.celeb })),
          h("div", {},
            h("div", { class: "em-quote" }, h("span", { class: "em-typed" }), h("span", { class: "em-caret" }, "▍")),
            h("div", { class: "em-new" }, `NEW PARTNER: ${t.name.toUpperCase()} & ${sw.celeb.toUpperCase()}`))));
      break;
    }
    case "cast": {
      setScene("stage", "", "There they are, ladies! This season's couples. Now... let the eliminations begin!");
      body = [h("div", { class: "title-l" }, "THIS SEASON'S COUPLES"), grid(CFG.couples.map(c => c.name))];
      break;
    }
    case "roundIntro": {
      const n = s.remaining.length;
      setScene("question", r.final ? "The Grand Finale" : `Round ${r.n}`,
        r.final ? "Two couples left. One Mirrorball. Who's it going to be?" : "Here's who's left! Now... who's on the chopping block?");
      body = [
        h("div", { class: "kicker" }, r.final ? "The grand finale" : `${n} couples remain`),
        h("div", { class: "title-l" }, r.final ? "Two couples. One Mirrorball." : "Here's who's left..."),
        grid(s.remaining, n <= 6),
      ];
      break;
    }
    case "block": {
      setScene("question", r.final ? "The Grand Finale" : `Round ${r.n}`,
        `${r.block.join(" and ")}, check your phones! Tell us about your performance.`);
      body = [
        h("div", { class: "kicker" }, r.final ? "The final showdown" : "On the chopping block..."),
        h("div", { class: "block" }, r.block.map(n => {
          const a = r.assign[n];
          return h("div", { class: "bcard card pop" }, frame(n),
            h("div", {}, h("div", { class: "who" }, couple(n)),
              h("div", { class: "lbl" }, "Tonight's dance"), h("div", { class: "val" }, a.dance),
              h("div", { class: "lbl" }, "The song"), h("div", { class: "val" }, `"${a.song}"`, h("small", {}, a.artist)),
              h("div", { class: "status" + (r.submitted[n] ? " done" : "") }, r.submitted[n] ? "✔ Routine submitted" : "✍ Rehearsing...")));
        })),
        timer(r.deadline),
      ];
      break;
    }
    case "perform": {
      const n = r.block[r.performIdx], a = r.assign[n], ans = (r.answers[n] || "").trim();
      setScene("reveal", r.final ? "The Grand Finale" : `Round ${r.n}`,
        r.performIdx === 0 ? "Ladies and gentlemen... our first performance!" : "And now, the couple fighting to stay...");
      body = h("div", { class: "split perform" }, frame(n, "flip"),
        h("div", { class: "txt" },
          h("div", { class: "kicker" }, "Now performing"),
          h("div", { class: "title-l" }, couple(n)),
          h("div", { class: "meta" }, "The ", h("b", {}, a.dance), " to ", h("b", {}, `"${a.song}"`), ` by ${a.artist}`),
          h("div", { class: "quote pop" }, ans || "...she froze. Total silence. The band kept playing."),
          (r.autofilled || []).includes(n) ? h("div", { class: "autofill-tag" }, "⏱ She ran out of time, so the producers wrote this one for her.") : null));
      break;
    }
    case "vote": {
      setScene("question", r.final ? "The Grand Finale" : `Round ${r.n}`,
        r.final ? "Vote for your favorite. The winner takes the Mirrorball!" : "Voting is open! Vote for your favorite performance. The other couple goes home!");
      body = [
        h("div", { class: "kicker" }, "Voting is open"),
        h("div", { class: "title-l" }, r.final ? "Who wins the Mirrorball?" : "Who should STAY?"),
        h("div", { class: "vote-how" }, r.final ? "💚 Vote for your favorite performance. Most votes wins!" : "💚 Vote for your favorite performance. Fewest votes goes home."),
        h("div", { class: "block vote" }, r.block.map(n => {
          const a = r.assign[n];
          return h("div", { class: "bcard card" }, frame(n),
            h("div", {}, h("div", { class: "who" }, couple(n)),
              h("div", { class: "val", style: "font-size:1.3vw" }, `${a.dance} · "${a.song}"`),
              h("div", { class: "ans" }, (r.answers[n] || "(speechless)").slice(0, 140))));
        })),
        h("div", { class: "count" }, h("b", {}, r.voteCount), ` of ${r.eligible} votes in`),
        timer(r.deadline),
      ];
      break;
    }
    case "suspense": {
      const tie = r.result && r.result.tie;
      setScene("stage", r.final ? "The Grand Finale" : `Round ${r.n}`, tie ? "The judges are conferring... this is unprecedented." : "Drumroll, please...", false);
      body = [
        h("div", { class: "drum" }, "🥁"),
        tie ? h("div", { class: "title-l pink" }, "IT'S A TIE!") : null,
        h("div", { class: "title-l" }, tie ? "The judges will decide..." : r.final ? "Your runner-up is..." : "The couple leaving the ballroom is..."),
      ];
      break;
    }
    case "result": {
      const res = r.result, out = res.out, [a, b] = r.block;
      setScene("reveal", r.final ? "The Grand Finale" : `Round ${r.n}`,
        r.final ? `So close, ${out}! And that means our champion is...` : `So long, ${out}! You can still vote, so don't go far.`);
      body = [
        h("div", { class: "split" }, frame(out, "flip"),
          h("div", { class: "txt" },
            h("div", { class: "kicker" }, r.final ? "Runner-up" : "Eliminated"),
            h("div", { class: "title-xl pop", style: "font-size:4.6vw" }, couple(out).toUpperCase()),
            h("div", { class: "tally" }, "Votes to stay: ", h("b", {}, `${a} ${res.tally[a]}`), "  ·  ", h("b", {}, `${b} ${res.tally[b]}`), res.tie ? "  (the judges broke the tie)" : ""),
            h("div", { class: "judges" }, res.judges.map(j => h("div", { class: "judge card" },
              h("div", { class: "sc" }, j.score), h("div", { class: "jn" }, j.judge), h("div", { class: "jq" }, `"${j.quote}"`)))),
            r.final ? null : h("div", { class: "safe" }, h("b", {}, "SAFE: "), `${couple(res.survivor)} dance another day!`))),
      ];
      break;
    }
    case "finale": {
      const n = s.champion;
      setScene("stage", "", `Cue the confetti! ${n}, check your phone for your prize!`, false);
      body = [
        h("img", { class: "mirrorball", src: "img/mirrorball.png", alt: "" }),
        h("div", { class: "kicker" }, "Your Mirrorball champion is..."),
        h("div", { class: "split", style: "justify-content:center;max-width:70vw" }, frame(n, "flip"),
          h("div", { class: "txt" },
            h("div", { class: "title-xl pop", style: "font-size:6vw" }, n.toUpperCase()),
            h("div", { class: "sub" }, "& " + C(n).celeb),
            h("div", { class: "prize" }, `🏆 Winner of ${CFG.prizeText}`))),
      ];
      break;
    }
  }
  // Gold bar along the top that fills up until the screen moves on by itself
  if (s.autoAt && s.autoSeconds) {
    const elapsed = s.autoSeconds * 1000 - (s.autoAt - (Date.now() + clockSkew));
    body = [h("div", { class: "autobar" }, h("i", { style: `animation-duration:${s.autoSeconds}s;animation-delay:${-Math.max(0, elapsed)}ms` })), ...[body].flat()];
  }
  $("stage").replaceChildren(...[body].flat().filter(Boolean));
}
