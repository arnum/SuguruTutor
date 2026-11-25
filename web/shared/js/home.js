// The home screen: continue, the daily puzzle and shortcuts.

function thumbSvg(p, ents, px = 64) {
  const S = 10,
    w = p.cols * S,
    h = p.rows * S;
  let thick = "",
    dots = "";
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++) {
      const i = r * p.cols + c;
      if (c + 1 < p.cols && p.region[i] !== p.region[i + 1]) thick += `M${(c + 1) * S} ${r * S}V${(r + 1) * S}`;
      if (r + 1 < p.rows && p.region[i] !== p.region[i + p.cols]) thick += `M${c * S} ${(r + 1) * S}H${(c + 1) * S}`;
      if (p.givens[i]) dots += `<rect x="${c * S + 3}" y="${r * S + 3}" width="4" height="4" rx="1" fill="var(--ink)"/>`;
      else if (ents && ents[i]) dots += `<circle cx="${c * S + 5}" cy="${r * S + 5}" r="2.3" fill="var(--indigo)"/>`;
    }
  return (
    `<svg viewBox="-2 -2 ${w + 4} ${h + 4}" width="${px}" height="${px}" preserveAspectRatio="xMidYMid meet">` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="var(--paper)"/>${dots}<path d="${thick}" stroke="var(--ink)" stroke-width="1.3" fill="none"/>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="var(--ink)" stroke-width="2"/></svg>`
  );
}
function dailySpec(d = new Date()) {
  const [r, c, l] = DAILY[d.getDay()],
    key = dayKey(d);
  let h = 2166136261;
  for (const ch of APP.id + "-daily:" + key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return { rows: r, cols: c, level: l, seed: h % 1000000000, key };
}
function renderHome() {
  const now = new Date(),
    ds = dailySpec(now);
  $("dailyDow").textContent = DOW[now.getDay()];
  $("dailyDay").textContent = now.getDate();
  $("dailyTitle").textContent = BAND[ds.level] + " · " + ds.cols + "×" + ds.rows;
  const cl = campLine();
  $("campTitle").textContent = cl.title;
  $("campSub").textContent = cl.sub;
  const tl = trialLine();
  $("trialTitle").textContent = tl.title;
  $("trialSub").textContent = tl.sub;
  const done = games.find((g) => g.daily === ds.key && g.solved);
  const st = streaks();
  const going = P && meta && meta.daily === ds.key && !solved;
  $("dailySub").innerHTML = done
    ? `<span class="badge ok">✓ ${tr("Solved in {time}", { time: fmt(done.ms) })}</span>` +
      (st.current > 1 ? " &nbsp;" + tr("{n} days in a row", { n: st.current }) : "")
    : going
      ? tr("In progress") + " · " + fmt(elapsed())
      : tr("A new puzzle every day, the same for everyone") +
        (st.current ? " · " + (st.current === 1 ? tr("1 day in a row") : tr("{n} days in a row", { n: st.current })) : "");
  const cont = P && !solved && meta && !(meta.daily === ds.key);
  $("contCard").hidden = !cont;
  if (cont) {
    const empty = P.givens.filter((g) => !g).length,
      filled = entries.filter(Boolean).length;
    $("contThumb").innerHTML = thumbSvg(P, entries);
    $("contTitle").textContent = BAND[pBand(P)] + " " + levelValue(P) + " · " + P.cols + "×" + P.rows;
    $("contSub").textContent =
      fmt(elapsed()) +
      " · " +
      Math.round((100 * filled) / Math.max(1, empty)) +
      " % " +
      tr("filled in") +
      (meta.hints ? " · " + (meta.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: meta.hints })) : "");
  }
  const n = games.filter((g) => g.solved).length;
  let focus = "";
  try {
    const fd = withScope("main", focusData);
    if (fd.base) {
      const w = fd.rows.filter((f) => f.score < -0.25 && focusReasons(f, true).length).sort((a, b) => a.score - b.score)[0];
      if (w) focus = tr("Focus: {tech}", { tech: LEVEL_TECH[w.L] });
    }
  } catch (e) {}
  $("homeStatsSub").textContent = n
    ? focus || tr("{n} solved", { n }) + (st.current ? " · " + tr("{n} in a row", { n: st.current }) : "")
    : tr("No games yet");
  $("installCard").hidden = !(IOS && !STANDALONE && !FRAMED && !settings.installHidden);
  $("homeGuest").textContent = GUEST ? tr("End guest mode") : tr("Let someone else play (guest mode)");
  // practice shows up once you have played a game
  if (games.length) renderPracticeCard();
  else $("practiceSlot").innerHTML = "";
}
$("installX").onclick = () => {
  settings.installHidden = true;
  saveSettings();
  $("installCard").hidden = true;
};
$("homeNew").onclick = () => go("new");
$("homeStats").onclick = () => go("stats");
$("homeSettings").onclick = () => go("settings");
if ($("homeGuide")) $("homeGuide").onclick = () => openGuide(null);
$("contCard").onclick = () => go("game");
$("dailyCard").onclick = () => startDaily();
$("campCard").onclick = () => go("camp");
$("trialCard").onclick = () => go("trial");
$("codeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("codeInput").value;
  if (!text.trim()) {
    $("codeInput").focus();
    return;
  }
  replaceGame(() => {
    if (importCode(text)) $("codeInput").value = "";
  });
});

// ---------- Guest mode (the storage side is in core.js): the switch on the home screen and the band on every screen.
// Switching reloads the app, so every screen, curve and statistic is built again from the right person's data.
function startGuest() {
  confirmSheet({
    title: tr("Let someone else play?"),
    text: tr("In guest mode, games do not count in your statistics, curve, practice or days in a row, and they are not kept. Your game in progress waits until guest mode ends."),
    ok: tr("Start guest mode"),
    onOk: () => {
      saveCurrent();
      wipeGuest();
      store.set("guest", { on: true, last: Date.now() });
      location.reload();
    },
  });
}
function endGuest() {
  confirmSheet({
    title: tr("End guest mode?"),
    text: tr("The guest's games are not kept. Your own game in progress and your statistics come back."),
    ok: tr("End guest mode"),
    onOk: () => {
      GUEST = false; // so leaving the page does not note the guest's time again
      wipeGuest();
      store.del("guest");
      location.reload();
    },
  });
}
if (GUEST) {
  document.body.classList.add("guest");
  document.body.insertAdjacentHTML("beforeend", `<button type="button" class="guestband" id="guestBand">${tr("Guest mode · tap to end")}</button>`);
  $("guestBand").onclick = endGuest;
  guestTouch();
  setInterval(() => document.visibilityState === "visible" && guestTouch(), 60000);
  // back after a long time away: start again, which ends guest mode (core.js)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") return guestTouch();
    const st = store.get("guest", null);
    if (st && Date.now() - (st.last || 0) > GUEST_AWAY) {
      GUEST = false; // keep the old time, so the start sees the time away and ends guest mode
      location.reload();
    }
  });
}
$("homeGuest").onclick = () => (GUEST ? endGuest() : startGuest());
