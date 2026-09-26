// ---- stable per-phone identity ----
function getToken() {
  let t = null;
  try { t = localStorage.getItem("dwts_token"); } catch (e) {}
  if (!t) {
    t = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
    try { localStorage.setItem("dwts_token", t); } catch (e) {}
  }
  return t;
}
const TOKEN = getToken();
const socket = io({ auth: { role: "player", token: TOKEN } });
let CFG = null, ST = null, lastKey = "", draft = "", switching = false, clockSkew = 0, flash = "";
// "Host or contestant?" is asked once per phone; a phone that already has a name skips it
let role = "";
try { role = localStorage.getItem("dwts_role") || ""; } catch (e) {}
function setRole(v) { role = v; try { localStorage.setItem("dwts_role", v); } catch (e) {} render(true); }

const app = document.getElementById("app");
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v; else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "disabled") { if (v) el.disabled = true; }
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const C = n => CFG.couples.find(c => c.name === n);
const couple = n => `${n} & ${C(n).short}`;
const card = (...kids) => h("div", { class: "pcard" }, ...kids);

fetch("/api/config").then(r => r.json()).then(c => { CFG = c; render(true); });
socket.on("state", s => { ST = s; clockSkew = s.now - Date.now(); render(); });
socket.on("tick", t => { clockSkew = t - Date.now(); });
socket.on("connect", () => render(true));
socket.on("disconnect", () => { app.replaceChildren(card(h("p", { class: "center" }, "Reconnecting to the ballroom…"))); lastKey = ""; });

setInterval(() => {
  document.querySelectorAll("[data-deadline]").forEach(el => {
    const left = Math.max(0, Math.ceil((+el.dataset.deadline - (Date.now() + clockSkew)) / 1000));
    el.textContent = left > 0 ? `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "⏱ Time's up!";
  });
}, 250);

function partnerCard(me) {
  const c = C(me);
  return card(h("div", { class: "partner" }, h("img", { src: `img/${c.img}.jpg`, alt: c.celeb }),
    h("div", {}, h("div", { class: "small" }, "Your celebrity partner"), h("h2", { style: "font-size:22px;margin:2px 0" }, c.celeb), h("div", { class: "small", style: "font-style:italic" }, c.why))));
}

function render(force) {
  if (!CFG || !ST) return;
  const s = ST, r = s.round, you = s.you, me = you && you.name;
  const key = JSON.stringify([role, s.phase, s.introStep, me, switching, flash, (!me || switching) ? s.joined : 0, r && [r.n, r.block, r.assign, r.performIdx, !!r.result], you && [you.myVote, you.myAnswer, you.hasPrize], s.remaining.length, s.champion]);
  if (!force && key === lastKey) return;
  lastKey = key;

  // ---- host or contestant? ----
  if (!me && role !== "player") {
    if (role === "host" && CFG.hostKeyRequired) {
      const pw = h("input", { type: "password", placeholder: "Host password", autocomplete: "off" });
      const go = () => { if (pw.value.trim()) location.href = "/host?key=" + encodeURIComponent(pw.value.trim()); };
      pw.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      app.replaceChildren(card(h("h2", {}, "Host login"), h("p", {}, "Enter the host password to open the big-screen view."), pw,
        h("button", { class: "bigbtn", onclick: go }, "Open the host screen"),
        h("button", { class: "linkish", onclick: () => setRole("") }, "← Back")));
      setTimeout(() => pw.focus(), 50);
      return;
    }
    app.replaceChildren(card(h("h2", {}, "Welcome to the ballroom! 🪩"), h("p", {}, "Which one are you?"),
      h("button", { class: "rolebtn main", onclick: () => setRole("player") }, "💃 I'm a contestant", h("small", {}, "Pick your name, pitch your routines, and vote")),
      h("button", { class: "rolebtn", onclick: () => CFG.hostKeyRequired ? setRole("host") : (location.href = "/host") }, "🎤 I'm the host", h("small", {}, "Open the big-screen view for the TV"))));
    return;
  }

  // ---- pick your name ----
  if (!me || switching) {
    app.replaceChildren(
      card(h("h2", {}, "Who are you?"), h("p", {}, "Tap your name to join the show."),
        flash ? h("p", { class: "pink" }, flash) : null,
        h("div", { class: "namebtns" }, CFG.couples.map(c => {
          const taken = s.joined.includes(c.name) && c.name !== me;
          return h("button", { class: c.name === me ? "me" : "", disabled: taken, onclick: () => join(c.name) }, c.name);
        }))),
      h("p", { class: "small center" }, "Name greyed out but it's you? Ask the host to free it up."),
      me ? null : h("p", { class: "center" }, h("button", { class: "linkish", onclick: () => setRole("") }, "← Actually, I'm the host")));
    return;
  }

  const out = !s.remaining.includes(me) && s.phase !== "lobby";
  const onBlock = r && r.block.includes(me) && ["block", "perform", "vote", "suspense", "result"].includes(s.phase);
  const views = [];
  const hello = h("p", { class: "small center" }, `Playing as ${me} · `, h("button", { class: "linkish", style: "margin:0", onclick: () => { switching = true; render(true); } }, "not you?"));

  switch (s.phase) {
    case "lobby":
    case "rules":
      views.push(card(h("h2", {}, `You're in, ${me}! 💃`), h("p", {}, "Eyes on the big screen. The show is about to start."),
        h("p", {}, `🏆 The last couple standing wins ${CFG.prizeText}.`)));
      break;
    case "intro": {
      const myIdx = CFG.couples.findIndex(c => c.name === me);
      if (s.introStep >= 2 * myIdx + 1) views.push(partnerCard(me));
      else views.push(card(h("h2", {}, "Who's your partner?"), h("p", {}, "AI cast you with a celebrity partner. Watch the big screen for your reveal...")));
      break;
    }
    case "cast":
    case "roundIntro":
      views.push(partnerCard(me));
      views.push(card(out ? h("p", {}, "You've been eliminated, but you still get a vote every round! 🗳️") : h("p", {}, "You're still in the competition. Fingers crossed you're not on the chopping block...")));
      break;
    case "block":
      if (r.block.includes(me)) {
        const a = r.assign[me];
        views.push(card(
          h("div", { class: "kicker", style: "font-size:12px" }, "You're on the chopping block!"),
          h("h2", {}, couple(me)),
          h("div", { class: "assign" },
            h("div", {}, h("div", { class: "l" }, "YOUR DANCE"), h("div", { class: "v" }, a.dance)),
            h("div", {}, h("div", { class: "l" }, "YOUR SONG"), h("div", { class: "v" }, `"${a.song}"`), h("div", { class: "a" }, a.artist))),
          h("p", { style: "font-weight:700" }, r.prompt),
          (() => { const ta = h("textarea", { maxlength: "220", placeholder: "Sell it! The funnier the better..." }); ta.value = draft || you.myAnswer || ""; ta.addEventListener("input", e => draft = e.target.value); return ta; })(),
          h("div", { class: "ptimer", "data-deadline": r.deadline || "" }),
          h("button", { class: "bigbtn pink", onclick: submitAnswer }, you.myAnswer ? "Update my routine" : "Submit my routine"),
          you.myAnswer ? h("p", { class: "small center" }, "✔ Submitted! You can still edit until your opponent finishes. Then the show goes on!") : null));
      } else {
        views.push(card(h("h2", {}, "Rehearsals are underway"), h("p", {}, `${r.block.join(" and ")} are writing their routines. Get ready to vote!`)));
      }
      break;
    case "perform":
      views.push(card(h("h2", {}, "Eyes on the stage! 👀"), h("p", {}, "The performances are on the big screen.")));
      break;
    case "vote":
      if (r.block.includes(me)) {
        views.push(card(h("h2", {}, "The audience is voting..."), h("p", {}, "You're on the chopping block. Smile for the cameras and look innocent. 😇")));
      } else {
        views.push(card(h("h2", {}, r.final ? "Who's the runner-up?" : "Who should go home?"),
          h("p", { class: "small" }, r.final ? "Vote to ELIMINATE one couple. The other wins the Mirrorball!" : "Tap the couple you want to ELIMINATE. You can change your vote until time's up."),
          h("div", { class: "ptimer", "data-deadline": r.deadline || "" })));
        r.block.forEach(n => {
          const a = r.assign[n];
          views.push(h("button", { class: "votebtn" + (you.myVote === n ? " sel" : ""), onclick: () => vote(n) },
            h("img", { src: `img/${C(n).img}.jpg`, alt: "" }),
            h("div", {}, h("div", { class: "n" }, (you.myVote === n ? "❌ " : "") + couple(n)), h("div", { class: "d" }, `${a.dance} · "${a.song}"`),
              h("div", { class: "q" }, (r.answers && r.answers[n]) || "(speechless)"))));
        });
        if (you.myVote) views.push(h("p", { class: "center small" }, `Your vote: eliminate ${you.myVote}`));
      }
      break;
    case "suspense":
      views.push(card(h("h2", { class: "center" }, "🥁 Drumroll..."), h("p", { class: "center" }, "Look at the big screen!")));
      break;
    case "result": {
      const res = r.result;
      if (res && res.out === me) views.push(card(h("h2", {}, r.final ? "So close! 🥈" : "You've been eliminated 💔"), h("p", {}, r.final ? "Runner-up! Still iconic." : "But you're not done: you still get to vote in every round.")));
      else if (res && res.survivor === me) views.push(card(h("h2", {}, "You're SAFE! 🎉"), h("p", {}, "You live to dance another day.")));
      else if (res) views.push(card(h("h2", {}, `${res.out} is out!`), h("p", {}, "Watch the big screen for the judges' comments.")));
      break;
    }
    case "finale":
      if (s.champion === me) {
        views.push(card(h("h2", { class: "center" }, "🏆 YOU WON THE MIRRORBALL! 🏆"),
          h("p", { class: "center" }, `Congratulations, ${me}! You won ${CFG.prizeText}.`),
          you.hasPrize ? [h("img", { class: "prizeimg", src: `/prize?token=${encodeURIComponent(TOKEN)}`, alt: "Your prize QR code" }),
            h("p", { class: "center", style: "font-weight:900" }, "📸 Screenshot this QR code now!")] : h("p", { class: "center small" }, "See the host to claim your prize.")));
      } else {
        views.push(card(h("h2", { class: "center" }, `${s.champion} wins! 🪩`), h("p", { class: "center" }, "Thanks for playing! Now go get the bride a drink.")));
      }
      break;
  }
  if (flash) views.push(h("p", { class: "center pink" }, flash));
  views.push(hello);
  app.replaceChildren(...views);
}

function join(name) {
  socket.emit("join", name, res => {
    flash = res && res.ok ? "" : (res && res.msg) || "Couldn't join";
    if (res && res.ok) switching = false;
    render(true);
  });
}
function submitAnswer() {
  const text = (draft || (ST.you && ST.you.myAnswer) || "").trim();
  if (!text) { flash = "Write something first!"; render(true); setTimeout(() => { flash = ""; render(true); }, 2000); return; }
  socket.emit("answer", text, res => { flash = res && res.ok ? "" : (res && res.msg) || "Couldn't submit"; render(true); });
}
function vote(n) {
  socket.emit("vote", n, res => { flash = res && res.ok ? "" : (res && res.msg) || "Couldn't vote"; render(true); });
}
