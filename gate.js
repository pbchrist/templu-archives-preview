/** Templu gate: exterior landing → door → interior archives. */
const STORE = "templu-archives-entered-v1";
const ROOT = new URL("./", import.meta.url);

/** Source image size and doorway rect in source pixels. Updated when paintings land. */
export const EXTERIOR = {
  w: 2400,
  h: 1350,
  // Doorway dark rectangle (source guidance 447–475 × 357–428 on 1024×576 → ~45%, 68%)
  door: { x: 1047, y: 836, w: 66, h: 167 },
};

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function $(id) {
  return document.getElementById(id);
}

function coverLayout(viewW, viewH, imgW, imgH, focusX, focusY) {
  // focusX/Y: 0–1 point in the image to pin near viewport center on mobile
  const scale = Math.max(viewW / imgW, viewH / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  let left;
  let top;
  if (viewW <= 640) {
    // Center the doorway horizontally; keep a slight bias so stairs read
    left = viewW / 2 - focusX * dispW;
    top = viewH / 2 - focusY * dispH;
    // Clamp so we don't show empty edges when possible
    left = Math.min(0, Math.max(viewW - dispW, left));
    top = Math.min(0, Math.max(viewH - dispH, top));
  } else {
    left = (viewW - dispW) / 2;
    top = (viewH - dispH) / 2;
  }
  return { scale, left, top, dispW, dispH };
}

function layoutDoor() {
  const landing = $("landing");
  const paint = $("landing-paint");
  const door = $("door");
  if (!landing || !paint || !door) return;

  const rect = landing.getBoundingClientRect();
  const doorCx = (EXTERIOR.door.x + EXTERIOR.door.w / 2) / EXTERIOR.w;
  const doorCy = (EXTERIOR.door.y + EXTERIOR.door.h / 2) / EXTERIOR.h;
  const layout = coverLayout(rect.width, rect.height, EXTERIOR.w, EXTERIOR.h, doorCx, doorCy);

  paint.style.backgroundSize = `${layout.dispW}px ${layout.dispH}px`;
  paint.style.backgroundPosition = `${layout.left}px ${layout.top}px`;

  const x = layout.left + EXTERIOR.door.x * layout.scale;
  const y = layout.top + EXTERIOR.door.y * layout.scale;
  const w = Math.max(28, EXTERIOR.door.w * layout.scale);
  const h = Math.max(40, EXTERIOR.door.h * layout.scale);
  // Expand hit area slightly for touch
  const pad = Math.max(10, 14 * (layout.scale / (rect.width / EXTERIOR.w)));
  door.style.left = `${x - pad}px`;
  door.style.top = `${y - pad}px`;
  door.style.width = `${w + pad * 2}px`;
  door.style.height = `${h + pad * 2}px`;

  // Zoom origin for the transition (door center in landing coords)
  landing.style.setProperty("--zoom-x", `${x + w / 2}px`);
  landing.style.setProperty("--zoom-y", `${y + h / 2}px`);
}

/** Short wooden door creak via Web Audio (no external file). Only after user gesture. */
function playCreak() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const dur = 1.15;

    // Band-limited noise through a bandpass = woody scrape
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.97 + white * 0.03; // brownish
      const env = Math.sin((i / bufferSize) * Math.PI) ** 1.2;
      const scrape = Math.sin(i * 0.012) * 0.4 + Math.sin(i * 0.037) * 0.25;
      data[i] = (last * 0.7 + scrape * 0.3) * env * 0.55;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.55, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.05);
    src.onended = () => ctx.close().catch(() => {});
  } catch {
    /* audio optional */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enterArchives({ withSound = true } = {}) {
  const landing = $("landing");
  const veil = $("veil");
  const interior = $("interior");
  if (!landing || !veil || !interior) return;

  if (withSound && !reduceMotion()) playCreak();

  veil.hidden = false;
  veil.setAttribute("aria-hidden", "false");

  if (reduceMotion()) {
    landing.classList.add("is-leaving");
    veil.classList.add("is-black");
    await sleep(280);
  } else {
    landing.classList.add("is-zooming");
    await sleep(900);
    veil.classList.add("is-black");
    await sleep(900); // total ~1.8s into black
  }

  landing.hidden = true;
  landing.setAttribute("aria-hidden", "true");
  interior.hidden = false;
  interior.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-inside");
  sessionStorage.setItem(STORE, "1");

  await sleep(reduceMotion() ? 120 : 280);
  veil.classList.add("is-fading");
  await sleep(reduceMotion() ? 240 : 700);
  veil.classList.remove("is-black", "is-fading");
  veil.hidden = true;
  veil.setAttribute("aria-hidden", "true");
  landing.classList.remove("is-zooming", "is-leaving");

  // Focus first interior control
  $("return-door")?.focus();
}

function returnToDoor() {
  sessionStorage.removeItem(STORE);
  document.body.classList.remove("is-inside");
  $("interior").hidden = true;
  $("interior").setAttribute("aria-hidden", "true");
  $("landing").hidden = false;
  $("landing").setAttribute("aria-hidden", "false");
  layoutDoor();
  $("door")?.focus();
  window.scrollTo(0, 0);
}

function showInteriorImmediate() {
  $("landing").hidden = true;
  $("landing").setAttribute("aria-hidden", "true");
  $("interior").hidden = false;
  $("interior").setAttribute("aria-hidden", "false");
  document.body.classList.add("is-inside");
}

function bindGate() {
  $("door")?.addEventListener("click", () => enterArchives({ withSound: true }));
  $("return-door")?.addEventListener("click", () => returnToDoor());
  window.addEventListener("resize", layoutDoor);
  window.addEventListener("orientationchange", () => setTimeout(layoutDoor, 80));
}

export function updateExteriorMetrics(metrics) {
  if (metrics.w) EXTERIOR.w = metrics.w;
  if (metrics.h) EXTERIOR.h = metrics.h;
  if (metrics.door) Object.assign(EXTERIOR.door, metrics.door);
  layoutDoor();
}

bindGate();
if (sessionStorage.getItem(STORE) === "1") {
  showInteriorImmediate();
} else {
  layoutDoor();
  // Reflow once paints load
  const img = new Image();
  img.onload = () => {
    const nw = img.naturalWidth || EXTERIOR.w;
    const nh = img.naturalHeight || EXTERIOR.h;
    if (nw !== EXTERIOR.w || nh !== EXTERIOR.h) {
      const sx = nw / EXTERIOR.w;
      const sy = nh / EXTERIOR.h;
      EXTERIOR.door.x = Math.round(EXTERIOR.door.x * sx);
      EXTERIOR.door.y = Math.round(EXTERIOR.door.y * sy);
      EXTERIOR.door.w = Math.round(EXTERIOR.door.w * sx);
      EXTERIOR.door.h = Math.round(EXTERIOR.door.h * sy);
      EXTERIOR.w = nw;
      EXTERIOR.h = nh;
    }
    layoutDoor();
  };
  img.src = new URL("templu-exterior.webp", ROOT).href;
}

// Expose for debugging / hotspot recalibration
window.__templuGate = { layoutDoor, enterArchives, returnToDoor, updateExteriorMetrics, EXTERIOR };
