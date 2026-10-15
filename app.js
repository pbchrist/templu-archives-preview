const STORE = "templu-archives-marks-v1";

const state = {
  glyphs: [],
  byId: new Map(),
  leaves: [],
  say: {},
  loom: null,
  marks: null,
  desk: null,
  mode: "key",
  slate: [],
};

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

async function load() {
  const [glyphsFile, leaves, say, loom] = await Promise.all([
    fetch("/glyphs.json").then((res) => res.json()),
    fetch("/leaves/index.json").then((res) => res.json()),
    fetch("/utterances.json").then((res) => res.json()),
    fetch("/loom.json").then((res) => res.json()),
  ]);
  state.glyphs = glyphsFile.glyphs;
  state.byId = new Map(glyphsFile.glyphs.map((glyph) => [glyph.id, glyph]));
  state.leaves = leaves;
  state.say = say;
  state.loom = loom;
  state.markLength = glyphsFile.markLength;
  state.codeLengths = glyphsFile.codeLengths;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && Array.isArray(saved.glyphs) && saved.glyphs.every((id) => state.byId.has(id))) {
      state.marks = saved;
    }
  } catch {
    state.marks = null;
  }
}

function glyphHtml(id, label) {
  const glyph = state.byId.get(id);
  if (!glyph) return "";
  const described = label ? glyph.svg.replace("aria-hidden=\"true\"", `role="img" aria-label="${esc(glyph.label)}"`) : glyph.svg;
  return described;
}

function renderKeyboard() {
  $("keyboard").innerHTML = state.glyphs.map((glyph) => `
    <button type="button" class="claw" data-claw="${esc(glyph.id)}" aria-label="${esc(glyph.label)}" aria-pressed="false">
      ${glyph.svg}
    </button>
  `).join("");
}

function renderSlate() {
  const limit = state.mode === "key" ? state.markLength : Math.max(...state.codeLengths);
  const items = [];
  for (let i = 0; i < limit; i += 1) {
    const id = state.slate[i];
    items.push(id
      ? `<li class="mark">${glyphHtml(id, true)}</li>`
      : `<li class="mark" aria-hidden="true"></li>`);
  }
  $("slate").innerHTML = items.join("");
  for (const button of $("keyboard").querySelectorAll("[data-claw]")) {
    button.setAttribute("aria-pressed", state.slate.includes(button.dataset.claw) ? "true" : "false");
  }
}

function renderHeld() {
  if (!state.marks) {
    $("held").innerHTML = `<p>No six marks rest on this desk yet.</p>`;
    return;
  }
  const marks = state.marks.glyphs.map((id) => `<li class="mark">${glyphHtml(id, true)}</li>`).join("");
  const beads = state.desk
    ? `<p>Furbidden Voyd beads ${state.desk.branches.fv}. Divergent Path beads ${state.desk.branches.dp}. Wellspring beads ${state.desk.branches.wi}. Jeweled Oculory beads ${state.desk.branches.jo}.</p>`
    : "";
  $("held").innerHTML = `<p>The marks on this desk.</p><ol class="slate">${marks}</ol>${beads}`;
}

function bead(stream, n, walked) {
  if (!walked) return `<span class="disc" role="img" aria-label="Unwalked bead ${n}"></span>`;
  return `<span class="bead" data-stream="${esc(stream)}" role="img" aria-label="Walked bead ${n}">${n}</span>`;
}

function renderLoom() {
  const branches = state.desk?.branches || { fv: 0, dp: 0, wi: 0, jo: 0 };
  const both = branches.fv >= 1 && branches.dp >= 1;
  const streamHtml = state.loom.streams.map((stream) => {
    const beads = state.loom.beads.map((n) => bead(stream.id, n, branches[stream.id] >= n)).join("");
    const sequelBeads = bead(stream.sequel.id, 1, branches[stream.sequel.id] >= 1);
    return `
      <div class="stream">
        <p class="stream-title">${esc(stream.title)}</p>
        <div class="beads">${beads}</div>
        <p class="sequel">${esc(stream.sequel.title)} ${sequelBeads}</p>
        <p class="flavor"><span class="ph">PLACEHOLDER for Patrick.</span> The thread is named. No leaf has been pressed for it.</p>
      </div>`;
  }).join("");
  $("loom").innerHTML = `
    <div class="loom-root">
      <p class="stream-title">${esc(state.loom.root.title)}</p>
      <div class="beads">${bead("root", 1, branches.fv >= 1 || branches.dp >= 1)}</div>
    </div>
    ${streamHtml}
    <p class="loop" ${both ? "" : "hidden"}>A thread runs back from one telling toward the other.</p>
  `;
}

function doorHtml(leaf) {
  return `
    <button type="button" class="door" data-leaf="${esc(leaf.id)}" data-enter="${esc(leaf.enter)}">
      <span class="kind" aria-hidden="true"></span>
      <span>
        <strong>${esc(leaf.title)}</strong><br>
        <small>${esc(leaf.place || "")}</small>
      </span>
    </button>`;
}

function renderFloor() {
  const order = { open: 0, closed: 1, vault: 2 };
  const leaves = [...state.leaves].sort((a, b) => (order[a.enter] - order[b.enter]) || a.title.localeCompare(b.title));
  const groups = { open: [], closed: [], vault: [] };
  for (const leaf of leaves) groups[leaf.enter].push(doorHtml(leaf));
  const vault = groups.vault.length
    ? `<div class="vault-row">
        <p class="kicker">Bottom floor of the Templu Archives</p>
        ${groups.vault.join("")}
        <p class="vault-note">The vault sits on the bottom floor. It does not open.</p>
      </div>`
    : "";
  $("floor").innerHTML = `
    <div class="alcoves">${groups.open.join("")}</div>
    <div class="shut-row">${groups.closed.join("")}</div>
    ${vault}`;
}

function flavorParagraph(text) {
  return `<p class="flavor"><span class="ph">PLACEHOLDER for Patrick.</span> ${esc(text)}</p>`;
}

function blocksHtml(blocks) {
  return (blocks || []).map((block) => {
    if (block.kind === "quote") return `<blockquote class="quote">${esc(block.text)}</blockquote>`;
    if (block.kind === "flavor") return flavorParagraph(block.text);
    return `<p class="fact">${esc(block.text)}</p>`;
  }).join("");
}

function decoyIds(sectionId) {
  let hash = 2166136261;
  const seed = `seal:${sectionId}`;
  for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const ids = [];
  for (let i = 0; i < 24; i += 1) {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    ids.push(state.glyphs[(hash >>> 0) % state.glyphs.length].id);
  }
  return ids;
}

function sealedHtml(sectionId) {
  const claws = decoyIds(sectionId).map((id) => state.byId.get(id).svg).join("");
  return `<div class="sealed" role="img" aria-label="A stretch of claw-script. It cannot be read.">${claws}</div>`;
}

function renderLeaf(leaf) {
  const article = $("leaf");
  article.hidden = false;
  article.classList.remove("is-open", "is-shut", "is-vault");
  if (leaf.enter === "vault") {
    article.classList.add("is-vault");
    article.innerHTML = `
      <div class="vault-chamber">
        <p class="kicker">Bottom floor of the Templu Archives</p>
        <div class="vault-face" aria-hidden="true"></div>
        <h2>${esc(leaf.title)}</h2>
        <p class="place">${esc(leaf.place || "")}</p>
        <p>${esc(leaf.utterance || state.say.vault)}</p>
      </div>`;
    article.scrollIntoView({ block: "start" });
    return;
  }
  if (leaf.enter === "closed") {
    article.classList.add("is-shut");
    article.innerHTML = `
      <div class="shut">
        <p class="kicker">Templu Archives</p>
        <h2>${esc(leaf.title)}</h2>
        <p>${esc(leaf.utterance || state.say.timestream)}</p>
      </div>`;
    article.scrollIntoView({ block: "start" });
    return;
  }
  article.classList.add("is-open");
  const sections = (leaf.sections || []).map((section) => {
    if (section.sealed) return `<section>${sealedHtml(section.id)}</section>`;
    return `<section>
      ${section.heading ? `<h3>${esc(section.heading)}</h3>` : ""}
      ${blocksHtml(section.blocks)}
    </section>`;
  }).join("");
  article.innerHTML = `
    <p class="kicker">A leaf of the Templu Archives</p>
    <h2>${esc(leaf.title)}</h2>
    <p class="place">${esc(leaf.place || "")}</p>
    ${sections}`;
  article.scrollIntoView({ block: "start" });
}

async function post(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data };
}

function marksPayload() {
  if (!state.marks) return {};
  return { version: state.marks.version, glyphs: state.marks.glyphs };
}

function remember(version, glyphs, desk) {
  state.marks = { version, glyphs };
  state.desk = desk || state.desk;
  localStorage.setItem(STORE, JSON.stringify(state.marks));
  renderHeld();
  renderLoom();
}

async function openLeaf(id) {
  const known = state.leaves.find((leaf) => leaf.id === id);
  if (!known) return;
  if (known.enter === "vault" && !state.marks) {
    renderLeaf({ ...known, utterance: state.say.vault });
    return;
  }
  try {
    const { data } = await post("/api/leaf", { id, ...marksPayload() });
    if (data.state) state.desk = data.state;
    renderHeld();
    renderLoom();
    if (!data.title) {
      $("marks-utter").textContent = data.utterance || state.say.unheard;
      if (known.enter === "open") {
        const local = await fetch(`/leaves/${id}.json`).then((res) => res.json());
        renderLeaf(local);
      }
      return;
    }
    renderLeaf(data);
  } catch {
    if (known.enter === "open") {
      const local = await fetch(`/leaves/${id}.json`).then((res) => res.json());
      renderLeaf(local);
      return;
    }
    renderLeaf({ ...known, enter: known.enter === "vault" ? "vault" : "closed" });
  }
}

function slateLimit() {
  return state.mode === "key" ? state.markLength : Math.max(...state.codeLengths);
}

function pushClaw(id) {
  if (state.slate.length >= slateLimit()) return;
  state.slate.push(id);
  renderSlate();
}

async function offer() {
  const utter = $("marks-utter");
  if (state.mode === "key") {
    if (state.slate.length !== state.markLength) {
      utter.textContent = state.say.needSix;
      return;
    }
    const { data } = await post("/api/marks/read", { version: 1, glyphs: state.slate });
    utter.textContent = data.utterance || "";
    if (data.state) remember(1, [...state.slate], data.state);
    return;
  }
  if (!state.codeLengths.includes(state.slate.length)) {
    utter.textContent = state.say.needShort;
    return;
  }
  const { data } = await post("/api/marks/press", {
    ...marksPayload(),
    codeVersion: 1,
    code: state.slate,
  });
  utter.textContent = data.utterance || "";
  if (data.glyphs && data.state) remember(data.version, data.glyphs, data.state);
}

async function cutNew() {
  const { data } = await post("/api/marks", {});
  $("marks-utter").textContent = data.utterance || "";
  if (data.glyphs) {
    remember(data.version, data.glyphs, data.state);
    state.slate = [];
    renderSlate();
  }
}

function bind() {
  $("keyboard").addEventListener("click", (event) => {
    const button = event.target.closest("[data-claw]");
    if (!button) return;
    pushClaw(button.dataset.claw);
  });
  $("lift").addEventListener("click", () => {
    state.slate.pop();
    renderSlate();
  });
  $("sweep").addEventListener("click", () => {
    state.slate = [];
    renderSlate();
  });
  $("offer").addEventListener("click", () => { offer(); });
  $("cut").addEventListener("click", () => { cutNew(); });
  $("mode-key").addEventListener("click", () => setMode("key"));
  $("mode-slip").addEventListener("click", () => setMode("slip"));
  $("floor").addEventListener("click", (event) => {
    const door = event.target.closest("[data-leaf]");
    if (door) openLeaf(door.dataset.leaf);
  });
  $("seek-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = $("seek-q").value.trim();
    const { data } = await post("/api/seek", { q, ...marksPayload() });
    if (data.state) {
      state.desk = data.state;
      renderHeld();
      renderLoom();
    }
    const results = data.results || [];
    $("seek-out").innerHTML = results.length
      ? results.map((result) => `
          <button type="button" data-leaf="${esc(result.id)}">
            <strong>${esc(result.title)}</strong>
            ${result.snippet ? `<p>${esc(result.snippet)}</p>` : `<p>${esc(result.place || "")}</p>`}
          </button>`).join("")
      : `<p>${esc(data.utterance || state.say.seekEmpty)}</p>`;
  });
  $("seek-out").addEventListener("click", (event) => {
    const button = event.target.closest("[data-leaf]");
    if (button) openLeaf(button.dataset.leaf);
  });
}

function setMode(mode) {
  state.mode = mode;
  state.slate = [];
  $("mode-key").setAttribute("aria-pressed", mode === "key" ? "true" : "false");
  $("mode-slip").setAttribute("aria-pressed", mode === "slip" ? "true" : "false");
  renderSlate();
}

async function refreshDesk() {
  if (!state.marks) return;
  const { data } = await post("/api/marks/read", state.marks);
  if (data.state) state.desk = data.state;
}

await load();
renderKeyboard();
renderSlate();
renderFloor();
bind();
await refreshDesk();
renderHeld();
renderLoom();
