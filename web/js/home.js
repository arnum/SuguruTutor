// Forsiden: fortsæt, dagens opgave og genveje.

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
  for (const ch of "suguru-daily:" + key) {
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
  const done = games.find((g) => g.daily === ds.key && g.solved);
  const st = streaks();
  const going = P && meta && meta.daily === ds.key && !solved;
  $("dailySub").innerHTML = done
    ? `<span class="badge ok">✓ ${tr("Løst på {tid}", { tid: fmt(done.ms) })}</span>` +
      (st.current > 1 ? " &nbsp;" + tr("{n} dage i træk", { n: st.current }) : "")
    : going
      ? tr("I gang") + " · " + fmt(elapsed())
      : tr("Ny opgave hver dag, samme for alle") +
        (st.current ? " · " + (st.current === 1 ? tr("1 dag i træk") : tr("{n} dage i træk", { n: st.current })) : "");
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
      tr("udfyldt") +
      (meta.hints ? " · " + (meta.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: meta.hints })) : "");
  }
  const n = games.filter((g) => g.solved).length;
  let focus = "";
  try {
    const fd = focusData();
    if (fd.base) {
      const w = fd.rows.filter((f) => f.score < -0.25 && focusReasons(f, true).length).sort((a, b) => a.score - b.score)[0];
      if (w) focus = tr("Fokus: {tech}", { tech: LEVEL_TECH[w.L] });
    }
  } catch (e) {}
  $("homeStatsSub").textContent = n
    ? focus || tr("{n} løst", { n }) + (st.current ? " · " + tr("{n} i træk", { n: st.current }) : "")
    : tr("Ingen spil endnu");
  $("installCard").hidden = !(IOS && !STANDALONE && !FRAMED && !settings.installHidden);
}
$("installX").onclick = () => {
  settings.installHidden = true;
  saveSettings();
  $("installCard").hidden = true;
};
$("homeNew").onclick = () => go("new");
$("homeStats").onclick = () => go("stats");
$("homeSettings").onclick = () => go("settings");
$("homeGuide").onclick = () => openGuide(null);
$("contCard").onclick = () => go("game");
$("dailyCard").onclick = () => startDaily();
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
