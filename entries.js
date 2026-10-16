const base = new URL(".", import.meta.url);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cats = ["People", "Places", "Things"];
let entries = [], cur = "People";
const root = document.getElementById("codex");
function seal() {
  const ids = ["03","07","11","02","14","09"];
  return `<p class="codex-seal" aria-label="Sealed">${ids.map((n) => `<img src="${new URL(`glyphs/claw-${n}.svg`, base)}" alt="" width="34" height="34">`).join("")}</p>`;
}
function render() {
  const list = entries.filter((e) => e.cat === cur);
  root.querySelector(".codex-tabs").innerHTML = cats.map((c) => `<button type="button" data-cat="${c}" aria-pressed="${c === cur}">${c}</button>`).join("");
  root.querySelector(".codex-list").innerHTML = list.map((e) => `<li><button type="button" data-id="${e.id}">${esc(e.title)}</button></li>`).join("");
}
function show(id) {
  const e = entries.find((x) => x.id === id);
  const art = root.querySelector(".codex-entry");
  art.hidden = false;
  art.innerHTML = `<p class="kicker">${esc(e.cat)}</p><h3>${esc(e.title)}</h3>${e.text.map((t) => `<p>${esc(t)}</p>`).join("")}${e.sealed ? seal() : ""}`;
  art.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
root.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.cat) { cur = b.dataset.cat; render(); }
  if (b.dataset.id) show(b.dataset.id);
});
fetch(new URL("entries.json", base)).then((r) => r.json()).then((d) => { entries = d; render(); });
