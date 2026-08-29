"use client";

import { useEffect, useRef } from "react";

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54,
  22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
];

const PAPER = [0, 0, 0];
const INK = [242, 242, 242];

// Bottom-right of the source frame, in video space, where generators drop
// their watermark. Measured on techfrien.mp4: a static bright cluster at
// u 0.899–0.918, v 0.820–0.854. Fully dark inside the core, feathered out
// from the outer bound so the corner falls away instead of showing an edge.
const MARK_U0 = 0.8;
const MARK_U1 = 0.87;
const MARK_V0 = 0.73;
const MARK_V1 = 0.8;
const MARK_INV_U = 1 / (MARK_U1 - MARK_U0);
const MARK_INV_V = 1 / (MARK_V1 - MARK_V0);
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// The colour looks share one grid so moving between them costs nothing.
const COLOR_COLS = 144;
const COLOR_CELL = 7;
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LOOK = {
  default: {
    cols: 169,
    cell: 5,
    black: 0.14,
    gain: 0.4,
    contrast: 0.98,
    letterCut: 0.83,
    grain: 0,
    color: false,
    minSpan: 0,
  },
  // A logo, not a scene: it has to be whole or it is nothing. On a portrait
  // phone cover samples the middle quarter of the frame and slices both arms
  // off the mark. minSpan holds at least 40% of the source width in shot and
  // letterboxes rather than cropping past it — full contain was worse, it
  // fits the whole 16:9 frame into a tall screen and leaves the mark tiny.
  // cell 8 rather than 16 because the canvas is displayed at cols x dot size
  // either way — at 16 it rendered 2880px wide into a 1440px box and threw
  // three of every four pixels away, taking the Bayer pattern with them.
  techfrien: {
    cols: 180,
    cell: 8,
    black: 0.1,
    gain: 1,
    contrast: 0.54,
    letterCut: 1.01,
    grain: 0,
    color: false,
    minSpan: 0.4,
  },
  // The colour looks. Dots take their hue from the frame, so the grid
  // stays coarse enough for each dot to read as a colour, and the tone
  // curve runs hotter — a dot has to be lit to have a hue at all.
  // (Above 1, contrast lifts midtones: the curve is pow(v, 1/contrast).)
  flower: {
    cols: COLOR_COLS,
    cell: COLOR_CELL,
    black: 0.03,
    gain: 1.25,
    contrast: 1.2,
    letterCut: 1.01,
    grain: 0,
    color: true,
    minSpan: 0,
  },
  // A bright, busy frame needs the opposite treatment to the flower: lift
  // the black point and pull the gain back, or every cell lights and the
  // image collapses into a wall of dots with nowhere for type to sit.
  van: {
    cols: COLOR_COLS,
    cell: COLOR_CELL,
    black: 0.2,
    gain: 0.72,
    contrast: 0.92,
    letterCut: 1.01,
    grain: 0,
    color: true,
    minSpan: 0,
  },
  contact: {
    cols: COLOR_COLS,
    cell: COLOR_CELL,
    black: 0.08,
    gain: 1.05,
    contrast: 1.1,
    letterCut: 1.01,
    grain: 0,
    color: true,
    minSpan: 0,
  },
};

// Smallest a dot is allowed to get, in CSS px. Holding the desktop dot size
// (~8.5px) all the way down put only 46 dots across a 390px phone, which is
// too few for the clip to read as anything — it went soft and blocky. Letting
// the dot halve on a phone roughly doubles the detail and still lands well
// above the point where the grid stops looking like a grid.
const MIN_DOT = 4.5;

// Which window owns the mid-view line, or null if we are between windows.
// Returning null rather than guessing is the point: the caller holds the
// last clip instead of switching to something that has no video behind it.
// The two case windows are bare .stage divs inside the article that carries
// the id, so the id is resolved the same way for the mid-view test and for
// the prefetch observer below.
function stageId(el: HTMLElement) {
  return el.id || el.closest<HTMLElement>("[data-section]")?.id || "home";
}

function stageInView() {
  const midView = window.innerHeight * 0.42;
  const stages = document.querySelectorAll<HTMLElement>(".stage");
  for (const el of stages) {
    const r = el.getBoundingClientRect();
    if (r.top <= midView && r.bottom >= midView) {
      return stageId(el);
    }
  }
  return null;
}

export function DitherStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const workVideoRef = useRef<HTMLVideoElement>(null);
  const techfrienVideoRef = useRef<HTMLVideoElement>(null);
  const flowerVideoRef = useRef<HTMLVideoElement>(null);
  const vanVideoRef = useRef<HTMLVideoElement>(null);
  const contactVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stage = canvasRef.current;
    const homeVideo = videoRef.current;
    const workVideo = workVideoRef.current;
    const techfrienVideo = techfrienVideoRef.current;
    const flowerVideo = flowerVideoRef.current;
    const vanVideo = vanVideoRef.current;
    const contactVideo = contactVideoRef.current;
    if (!stage) return;
    const ctx = stage.getContext("2d", { alpha: false });
    if (!ctx) return;

    const sample = document.createElement("canvas");
    const sctx = sample.getContext("2d", { alpha: false, willReadFrequently: true });
    const grab = document.createElement("canvas");
    const gctx = grab.getContext("2d", { alpha: false, willReadFrequently: true });
    const bake = document.createElement("canvas");
    const bctx = bake.getContext("2d", { willReadFrequently: true });
    if (!sctx || !bctx || !gctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { ...LOOK.default };
    let lookKey: keyof typeof LOOK = "default";

    const GRAIN = new Float32Array(8192);
    {
      let s = 987654321 >>> 0;
      for (let i = 0; i < GRAIN.length; i++) {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        GRAIN[i] = s / 4294967296 - 0.5;
      }
    }

    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let cellPx = 0;
    let lum = new Float32Array(0);
    let colR = new Float32Array(0);
    let colG = new Float32Array(0);
    let colB = new Float32Array(0);
    let cellChar = new Int32Array(0);
    let colOf = new Int32Array(0);
    let subX = new Int32Array(0);
    let rowOf = new Int32Array(0);
    let subY = new Int32Array(0);
    let frame: ImageData | null = null;
    let atlas = new Uint8Array(0);
    let atlasCov = new Float32Array(0);
    let atlasCount = 0;
    let raf = 0;
    let running = true;
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let grabPx: Uint8ClampedArray | null = null;
    let grabW = 0;
    let grabH = 0;
    let lastStage = "home";
    let hasVideoFrame = false;
    let hover = 1;

    // Baking 36 glyphs costs 36 getImageData calls, so it is done once per
    // distinct cell size and kept. Looks that share a cell reuse the bake.
    const atlasCache = new Map<number, { atlas: typeof atlas; cov: typeof atlasCov }>();

    const buildAtlas = () => {
      const cell = cellPx;
      atlasCount = CHARSET.length;
      const cached = atlasCache.get(cell);
      if (cached) {
        atlas = cached.atlas;
        atlasCov = cached.cov;
        return;
      }
      atlas = new Uint8Array(atlasCount * cell * cell);
      atlasCov = new Float32Array(atlasCount);
      bake.width = cell;
      bake.height = cell;
      const font = `${Math.round(cell * 1.15)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      for (let g = 0; g < atlasCount; g++) {
        bctx.fillStyle = "#000";
        bctx.fillRect(0, 0, cell, cell);
        bctx.font = font;
        bctx.fillStyle = "#fff";
        bctx.textBaseline = "alphabetic";
        bctx.textAlign = "center";
        bctx.fillText(CHARSET[g], cell / 2, Math.round(cell * 0.84));
        const px = bctx.getImageData(0, 0, cell, cell).data;
        const base = g * cell * cell;
        const n = cell * cell;
        let lit = 0;
        for (let i = 0; i < n; i++) {
          const bit = px[i * 4] > 110 ? 1 : 0;
          atlas[base + i] = bit;
          lit += bit;
        }
        atlasCov[g] = Math.min(0.92, Math.max(0.04, lit / n));
      }
      atlasCache.set(cell, { atlas, cov: atlasCov });
    };

    const resize = () => {
      const vw = Math.max(1, window.innerWidth);
      // Each look's cols was tuned against REF_W. Holding cols fixed as the
      // viewport narrows shrank every dot with it: on a 390px phone the grid
      // ran at ~2 display px per cell, so the dither aliased into noise while
      // the canvas still cost twice the pixels the screen could show. cols now
      // follows the viewport, floored at MIN_DOT so a phone keeps enough dots
      // to read, and capped at the tuned value so desktop is exactly as it was.
      cols = Math.max(24, Math.min(state.cols, Math.round(vw / MIN_DOT)));
      // And the cell follows cols, so the canvas lands near 1:1 with the
      // viewport. Wider than that and we pay for pixels the screen throws
      // away point-sampling back down — which is what cost techfrien 4x.
      const cell = Math.max(3, Math.min(state.cell, Math.floor(vw / cols)));
      cellPx = cell;
      const aspect = window.innerHeight / vw;
      rows = Math.max(4, Math.round(cols * aspect));
      W = cols * cell;
      H = rows * cell;
      stage.width = W;
      stage.height = H;
      stage.style.width = `${window.innerWidth}px`;
      stage.style.height = `${window.innerHeight}px`;
      sample.width = cols;
      sample.height = rows;
      sctx.imageSmoothingEnabled = true;
      lum = new Float32Array(cols * rows);
      colR = new Float32Array(cols * rows);
      colG = new Float32Array(cols * rows);
      colB = new Float32Array(cols * rows);
      cellChar = new Int32Array(cols * rows);
      frame = ctx.createImageData(W, H);
      colOf = new Int32Array(W);
      subX = new Int32Array(W);
      for (let x = 0; x < W; x++) {
        colOf[x] = (x / cell) | 0;
        subX[x] = x % cell;
      }
      rowOf = new Int32Array(H);
      subY = new Int32Array(H);
      for (let y = 0; y < H; y++) {
        rowOf[y] = (y / cell) | 0;
        subY[y] = y % cell;
      }
      buildAtlas();
    };

    const applyLook = (key: keyof typeof LOOK) => {
      if (key === lookKey) return;
      const look = LOOK[key];
      const gridChanged = state.cols !== look.cols || state.cell !== look.cell;
      Object.assign(state, look);
      lookKey = key;
      if (gridChanged) resize();
    };

    const invRot = (x: number, y: number, z: number, yaw: number, pitch: number) => {
      const cy = Math.cos(-yaw);
      const sy = Math.sin(-yaw);
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const cp = Math.cos(-pitch);
      const sp = Math.sin(-pitch);
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp] as const;
    };

    const sampleLum = (u: number, v: number) => {
      if (!grabPx || u < 0 || v < 0 || u > 1 || v > 1) return 0;
      const x = u * (grabW - 1);
      const y = v * (grabH - 1);
      const x0 = x | 0;
      const y0 = y | 0;
      const x1 = Math.min(x0 + 1, grabW - 1);
      const y1 = Math.min(y0 + 1, grabH - 1);
      const fx = x - x0;
      const fy = y - y0;
      const at = (ix: number, iy: number) => {
        const o = (iy * grabW + ix) << 2;
        return (grabPx![o] * 0.2126 + grabPx![o + 1] * 0.7152 + grabPx![o + 2] * 0.0722) / 255;
      };
      const a = at(x0, y0);
      const b = at(x1, y0);
      const c = at(x0, y1);
      const d = at(x1, y1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };

    // Colour path: one bilinear pass over all three channels, leaving the
    // result in sR/sG/sB and returning luma so the threshold is unchanged.
    let sR = 0;
    let sG = 0;
    let sB = 0;
    const sampleRGB = (u: number, v: number) => {
      if (!grabPx || u < 0 || v < 0 || u > 1 || v > 1) {
        sR = sG = sB = 0;
        return 0;
      }
      const x = u * (grabW - 1);
      const y = v * (grabH - 1);
      const x0 = x | 0;
      const y0 = y | 0;
      const x1 = Math.min(x0 + 1, grabW - 1);
      const y1 = Math.min(y0 + 1, grabH - 1);
      const fx = x - x0;
      const fy = y - y0;
      const oA = (y0 * grabW + x0) << 2;
      const oB = (y0 * grabW + x1) << 2;
      const oC = (y1 * grabW + x0) << 2;
      const oD = (y1 * grabW + x1) << 2;
      const px = grabPx;
      const mix = (k: number) => {
        const a = px[oA + k];
        const b = px[oB + k];
        const c = px[oC + k];
        const d = px[oD + k];
        return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) / 255;
      };
      sR = mix(0);
      sG = mix(1);
      sB = mix(2);
      return sR * 0.2126 + sG * 0.7152 + sB * 0.0722;
    };

    const readVideo = (src: HTMLVideoElement | null, yaw: number, pitch: number) => {
      if (!src || src.readyState < 2) return false;
      const vw = src.videoWidth;
      const vh = src.videoHeight;
      if (!vw || !vh) return false;
      // Only cols samples across ever get read, so grabbing much more than
      // that is wasted decode and a wasted copy. Two times the grid leaves
      // the bilinear sampler headroom; 720 was ~16x oversampled.
      const maxW = Math.min(vw, cols * 2);
      const gs = Math.min(1, maxW / vw);
      const gw = Math.max(2, Math.round(vw * gs));
      const gh = Math.max(2, Math.round(vh * gs));
      if (grab.width !== gw || grab.height !== gh) {
        grab.width = gw;
        grab.height = gh;
      }
      gctx.drawImage(src, 0, 0, gw, gh);
      try {
        grabPx = gctx.getImageData(0, 0, gw, gh).data;
      } catch {
        return false;
      }
      grabW = gw;
      grabH = gh;

      const F = 3.8;
      const ca = cols / Math.max(1, rows);
      const va = vw / vh;
      // The ray origin does not depend on x or y, so it is hoisted out of the
      // inner loop — it was being recomputed once per cell, tens of thousands
      // of times a frame, for the same answer.
      const [ox, oy, oz] = invRot(0, 0, -F, yaw, pitch);
      for (let y = 0; y < rows; y++) {
        const sy = (y / (rows - 1)) * 2 - 1;
        for (let x = 0; x < cols; x++) {
          const sx = (x / (cols - 1)) * 2 - 1;
          const [dx, dy, dz] = invRot(sx, sy, F, yaw, pitch);
          if (Math.abs(dz) < 1e-5) {
            lum[y * cols + x] = 0;
            continue;
          }
          const tHit = -oz / dz;
          const hx = ox + dx * tHit;
          const hy = oy + dy * tHit;
          let u = (hx + 1) * 0.5 + mx * 0.018;
          let v = (hy + 1) * 0.5 + my * 0.012;
          // Cover, expressed as the fraction of the source each axis keeps,
          // so a zoom ceiling can be applied to both at once and the aspect
          // survives it. minSpan 0 is plain cover.
          let wu = ca > va ? 1 : ca / va;
          let wv = ca > va ? va / ca : 1;
          if (wu < state.minSpan) {
            const g = state.minSpan / wu;
            wu *= g;
            wv *= g;
          }
          u = (u - 0.5) * wu + 0.5;
          v = (v - 0.5) * wv + 0.5;
          const ci = y * cols + x;
          const lit = state.color ? sampleRGB(u, v) : sampleLum(u, v);
          if (state.color) {
            colR[ci] = sR;
            colG[ci] = sG;
            colB[ci] = sB;
          }
          // Generator watermarks sit in the bottom-right of the source frame.
          // Masked in video space, not screen space, so it stays on the mark
          // whatever the viewport aspect does — and feathered, so the corner
          // just falls dark instead of showing a pasted-on rectangle.
          let keep = 1;
          if (u > MARK_U0 && v > MARK_V0) {
            const ku = smooth((u - MARK_U0) * MARK_INV_U);
            const kv = smooth((v - MARK_V0) * MARK_INV_V);
            keep = 1 - (ku < kv ? ku : kv);
          }
          lum[ci] = lit * keep * (0.92 + 0.08 * Math.max(0.7, Math.min(1.12, 2 - tHit)));
        }
      }
      return true;
    };

    // ---- CLIP FETCHING -------------------------------------------------
    // Only the hero clip ships with a src. The other five carry data-src and
    // are fetched when their window comes within reach, so the first screen
    // is not competing for bandwidth with ~7MB of video it will not show for
    // another four screens.
    const clips = [homeVideo, workVideo, techfrienVideo, flowerVideo, vanVideo, contactVideo];
    const ensureLoaded = (v: HTMLVideoElement | null | undefined) => {
      if (!v) return;
      const src = v.dataset.src;
      if (!src) return;
      delete v.dataset.src;
      v.src = src;
    };

    const clipOf: Record<string, HTMLVideoElement | null> = {
      home: homeVideo,
      vinkura: workVideo,
      techfrien: techfrienVideo,
      skills: flowerVideo,
      contact: contactVideo,
      library: vanVideo,
    };
    // Two viewports of lead time: enough for the clip to decode before the
    // window arrives, without pulling all six down at once.
    const near = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) ensureLoaded(clipOf[stageId(e.target as HTMLElement)]);
        }
      },
      { rootMargin: "200% 0px" }
    );
    document.querySelectorAll<HTMLElement>(".stage").forEach((el) => near.observe(el));

    // Once the page has gone quiet, pull the rest down in scroll order so a
    // fast scroll still lands on a decoded frame. One at a time, and never
    // held up by a single clip that stalls.
    const warmOrder = [workVideo, techfrienVideo, flowerVideo, contactVideo, vanVideo];
    let warmAt = 0;
    let warmTimer = 0;
    const warmNext = () => {
      if (!running || warmAt >= warmOrder.length) return;
      const v = warmOrder[warmAt++];
      if (!v || !v.dataset.src) return warmNext();
      let moved = false;
      const step = () => {
        if (moved) return;
        moved = true;
        v.removeEventListener("canplaythrough", step);
        window.clearTimeout(warmTimer);
        warmTimer = window.setTimeout(warmNext, 150);
      };
      v.addEventListener("canplaythrough", step);
      warmTimer = window.setTimeout(step, 8000);
      ensureLoaded(v);
    };
    const startWarm = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => warmNext(), { timeout: 2000 });
      } else {
        warmTimer = window.setTimeout(warmNext, 600);
      }
    };
    if (document.readyState === "complete") startWarm();
    else window.addEventListener("load", startWarm, { once: true });
    // --------------------------------------------------------------------

    const draw = (nowMs: number) => {
      if (!frame) return;
      // Sticky: between windows we keep showing the last one's clip. The
      // strip of stage still on screen stays live instead of dropping to
      // the procedural field for a frame, which read as a glitch.
      const inView = stageInView();
      if (inView) lastStage = inView;
      const id = lastStage;
      const onFlower = id === "skills";
      const onVan = id === "library";
      const onContact = id === "contact";
      const onTechfrien = id === "techfrien";
      const onVinkura = id === "vinkura";
      applyLook(
        onFlower
          ? "flower"
          : onVan
            ? "van"
            : onContact
              ? "contact"
              : onTechfrien
                ? "techfrien"
                : "default"
      );
      if (!frame) return;
      const ease = reduced ? 1 : 0.04;
      mx += (tx - mx) * ease;
      my += (ty - my) * ease;
      // Parallax belongs to the hero window only, and is eased in and out —
      // flipping it would snap the plane as you scroll off the hero.
      hover += ((inView === "home" ? 1 : 0) - hover) * (reduced ? 1 : 0.06);
      const yaw = reduced ? 0 : mx * 0.16 * hover;
      const pitch = reduced ? 0 : -my * 0.1 * hover;
      // The window owns exactly one clip: play it, hold the other five, and
      // give the parallax to the hero alone. This is also the only place a
      // clip is played, so a clip that finishes loading off-screen stays put
      // instead of decoding behind an opaque section.
      const active = onContact
        ? contactVideo
        : onVan
          ? vanVideo
          : onFlower
            ? flowerVideo
            : onTechfrien
              ? techfrienVideo
              : onVinkura
                ? workVideo
                : homeVideo;
      for (const v of clips) if (v && v !== active && !v.paused) v.pause();
      // Landing on a window whose clip has not been fetched yet — a jump
      // straight to an anchor — starts it here rather than showing nothing.
      ensureLoaded(active);
      active?.play().catch(() => {});
      const isHero = active === homeVideo;
      const got = readVideo(active, isHero ? yaw : 0, isHero ? pitch : 0);

      // Nothing else ever draws here. A clip that is not decoded yet holds
      // whatever the grid already has — the first frame of all, black — and
      // the canvas only fades in once there is real video to show. The
      // procedural field used to fill this gap and read as a glitch.
      if (got && !hasVideoFrame) {
        hasVideoFrame = true;
        stage.classList.add("live");
      }

      const black = state.black;
      const span = 1 / Math.max(0.02, 1 - black);
      const gain = state.gain;
      const invContrast = 1 / state.contrast;
      for (let i = 0; i < lum.length; i++) {
        const v = (lum[i] - black) * span * gain;
        lum[i] = v <= 0 ? 0 : Math.min(1, Math.pow(v, invContrast));
      }

      const cut = state.letterCut;
      let k = 0;
      for (let i = 0; i < lum.length; i++) {
        cellChar[i] = lum[i] >= cut ? k++ % atlasCount : -1;
      }

      const cell = cellPx;
      const glyphArea = cell * cell;
      const grain = state.grain;
      const color = state.color;
      const gShift = ((nowMs * 0.35) | 0) * 4;
      const d = frame.data;
      let p = 0;
      for (let y = 0; y < H; y++) {
        const lrow = rowOf[y] * cols;
        const brow = (y & 7) << 3;
        const gy = subY[y] * cell;
        for (let x = 0; x < W; x++) {
          const ci = lrow + colOf[x];
          const v = lum[ci];
          const g = cellChar[ci];
          const thr = BAYER[brow + (x & 7)];
          let on: boolean;
          if (g >= 0) {
            const cov = atlasCov[g];
            const bit = atlas[g * glyphArea + gy + subX[x]];
            const level = v >= cov ? (bit ? 1 : (v - cov) / (1 - cov)) : bit ? v / cov : 0;
            on = level >= 1 || level * 64 > thr;
          } else {
            on = v * 64 > thr;
          }
          if (on && color) {
            // Density already carries brightness, so a dot is drawn at full
            // value or a dark pixel would light a dot you cannot see. Hue is
            // kept; near-grey cells fall back to ink rather than guessing.
            let r = colR[ci];
            let g = colG[ci];
            let b = colB[ci];
            const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
            const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
            if (mx > 0.004) {
              const inv = 1 / mx;
              r *= inv;
              g *= inv;
              b *= inv;
            }
            const t = Math.min(1, (mx > 0 ? (mx - mn) / mx : 0) * 2.2);
            const u = 1 - t;
            d[p] = r * 255 * t + INK[0] * u;
            d[p + 1] = g * 255 * t + INK[1] * u;
            d[p + 2] = b * 255 * t + INK[2] * u;
          } else if (on) {
            d[p] = INK[0];
            d[p + 1] = INK[1];
            d[p + 2] = INK[2];
          } else if (grain) {
            const n = GRAIN[(p + gShift) & 8191] * grain;
            d[p] = PAPER[0] + n;
            d[p + 1] = PAPER[1] + n;
            d[p + 2] = PAPER[2] + n;
          } else {
            d[p] = PAPER[0];
            d[p + 1] = PAPER[1];
            d[p + 2] = PAPER[2];
          }
          d[p + 3] = 255;
          p += 4;
        }
      }
      ctx.putImageData(frame, 0, 0);
    };

    let held = false;
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      // No window on screen means the layer is faded out, so every cell of
      // this would be painted behind opaque black. Hold the clips too —
      // nothing is reading their frames.
      if (document.documentElement.dataset.stage === "off") {
        if (!held) {
          held = true;
          for (const v of clips) if (v && !v.paused) v.pause();
        }
        return;
      }
      held = false;
      draw(now);
    };

    const onPointer = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 120);
    };

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        for (const v of clips) if (v && !v.paused) v.pause();
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    void document.fonts?.ready?.then(buildAtlas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(warmTimer);
      near.disconnect();
      window.removeEventListener("load", startWarm);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div id="bg" aria-hidden="true">
      <video ref={videoRef} src="/bg/home.mp4" muted loop playsInline autoPlay preload="auto" />
      <video ref={workVideoRef} data-src="/bg/vinkura.mp4" muted loop playsInline preload="auto" />
      <video ref={techfrienVideoRef} data-src="/bg/techfrien.mp4" muted loop playsInline preload="auto" />
      <video ref={flowerVideoRef} data-src="/bg/flower.mp4" muted loop playsInline preload="auto" />
      <video ref={vanVideoRef} data-src="/bg/van.mp4" muted loop playsInline preload="auto" />
      <video ref={contactVideoRef} data-src="/bg/contact.mp4" muted loop playsInline preload="auto" />
      <canvas ref={canvasRef} />
    </div>
  );
}
