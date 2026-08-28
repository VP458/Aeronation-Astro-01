/**
 * Path-B turntable viewer: renders a pre-rendered frame sequence to a 2D
 * canvas and implements the renderer-agnostic TurntableViewer contract.
 *
 * - Drag horizontally to rotate (pointer capture, touch-action: pan-y so
 *   vertical page scroll survives on mobile); ~one full revolution per
 *   1.5 canvas widths; momentum on release with gentle friction.
 * - Keyboard on the canvas: ArrowLeft/ArrowRight step one frame, Home
 *   resets to frame 0.
 * - Auto-rotate until first interaction; disabled under reduced motion.
 * - setConfig cross-fades old -> new frame over ~180ms (skipped under
 *   reduced motion), keeping the current azimuth index and cancelling the
 *   previous combo's pending loads.
 * - While the target frame is not decoded, the nearest available lower-res
 *   or neighbouring frame is drawn instead - the canvas never blanks.
 *
 * Browser APIs are only touched inside createTurntableViewer, so the module
 * is safe to import during SSR.
 */

import type {
  ConfigState,
  TurntableViewer,
  TurntableViewerOptions,
  ViewerEvent,
} from "./types";
import { comboKey } from "./types";
import { createFrameLoader, pickSize, type DecodedFrame } from "./loader";

/** Canvas widths dragged for one full revolution. */
const WIDTHS_PER_REVOLUTION = 1.5;
/** Cross-fade duration for config swaps, ms. */
const FADE_MS = 180;
/** Inertia friction factor per 60fps-normalised tick. */
const FRICTION = 0.93;
/** Velocity caps/thresholds, frames per ms. */
const MAX_FLING_VELOCITY = 0.06;
const MIN_FLING_VELOCITY = 0.0025;
const STOP_VELOCITY = 0.0005;
/** Fraction of frames decoded before "sequenceready" fires. */
const READY_FRACTION = 0.25;
/** Debounce for target-size upgrades triggered by resize, ms. */
const RESIZE_RELOAD_MS = 200;
/** Max DPR honoured for the backing store. */
const MAX_DPR = 2;

function frameWidth(frame: DecodedFrame): number {
  return "naturalWidth" in frame ? frame.naturalWidth : frame.width;
}

function frameHeight(frame: DecodedFrame): number {
  return "naturalHeight" in frame ? frame.naturalHeight : frame.height;
}

export function createTurntableViewer(
  canvas: HTMLCanvasElement,
  opts: TurntableViewerOptions
): TurntableViewer {
  const maybeCtx = canvas.getContext("2d");
  if (maybeCtx === null) {
    throw new Error("Turntable viewer requires a 2D canvas context");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;
  const manifest = opts.manifest;
  const frames = Math.max(1, manifest.frameCount);

  const reducedMotion =
    opts.reducedMotion ??
    (typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ── Event emitter ─────────────────────────────────────────────────── */

  const listeners = new Map<ViewerEvent, Set<(detail?: unknown) => void>>();

  function on(event: ViewerEvent, cb: (detail?: unknown) => void): () => void {
    let set = listeners.get(event);
    if (set === undefined) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(cb);
    return () => {
      listeners.get(event)?.delete(cb);
    };
  }

  function emit(event: ViewerEvent, detail?: unknown): void {
    const set = listeners.get(event);
    if (set === undefined) return;
    for (const cb of [...set]) cb(detail);
  }

  /* ── State ─────────────────────────────────────────────────────────── */

  let state: ConfigState = { ...opts.initialState };
  /** Combo we are switching to; frames of `state` keep drawing meanwhile. */
  let pending: ConfigState | null = null;
  /** Continuous azimuth position in frame units, wrapped to [0, frames). */
  let pos = wrap(opts.initialIndex ?? 0);
  let lastEmittedIndex = -1;
  let destroyed = false;
  let dirty = true;
  let interacted = false;
  let autoRotateDps = reducedMotion ? 0 : Math.max(0, opts.autoRotate ?? 0);

  let cssWidth = 0;
  let targetSize = "";
  let sizeInitialised = false;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  let dragging = false;
  let dragPointerId = -1;
  let dragLastX = 0;
  let dragLastT = 0;
  let dragVelocity = 0; // frames per ms, smoothed
  let inertiaVelocity = 0; // frames per ms

  let fade: { snapshot: HTMLCanvasElement; start: number } | null = null;
  const readyEmitted = new Set<string>();

  function wrap(p: number): number {
    const w = ((p % frames) + frames) % frames;
    return w;
  }

  function currentIndex(): number {
    return Math.round(pos) % frames;
  }

  /* ── Loader ────────────────────────────────────────────────────────── */

  const loader = createFrameLoader(manifest, {
    onFrame: () => {
      dirty = true;
    },
    onProgress: (p) => {
      if (
        !readyEmitted.has(p.combo) &&
        p.frameCount > 0 &&
        p.indicesReady >= Math.ceil(p.frameCount * READY_FRACTION)
      ) {
        readyEmitted.add(p.combo);
        emit("sequenceready", {
          combo: p.combo,
          indicesReady: p.indicesReady,
          frameCount: p.frameCount,
        });
      }
    },
    onError: (message) => {
      emit("error", { message });
    },
  });

  /* ── Sizing ────────────────────────────────────────────────────────── */

  function updateSize(): void {
    const dpr = Math.min(
      typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1,
      MAX_DPR
    );
    cssWidth = canvas.clientWidth || canvas.width;
    const cssHeight = canvas.clientHeight || canvas.height;
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      dirty = true;
    }
    const next = pickSize(manifest, w);
    if (next !== targetSize) {
      targetSize = next;
      if (sizeInitialised) scheduleReload();
    }
  }

  function scheduleReload(): void {
    if (reloadTimer !== null) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      if (destroyed) return;
      loader.loadSequence(pending ?? state, targetSize, currentIndex());
    }, RESIZE_RELOAD_MS);
  }

  let resizeObserver: ResizeObserver | null = null;
  let windowResizeHandler: (() => void) | null = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(canvas);
  } else if (typeof window !== "undefined") {
    windowResizeHandler = () => updateSize();
    window.addEventListener("resize", windowResizeHandler);
  }

  /* ── Input ─────────────────────────────────────────────────────────── */

  canvas.style.touchAction = "pan-y";
  canvas.style.cursor = "grab";

  function markInteract(): void {
    if (!interacted) {
      interacted = true;
      autoRotateDps = 0; // stops permanently
    }
    emit("interact");
  }

  function onPointerDown(e: PointerEvent): void {
    if (!e.isPrimary) return;
    markInteract();
    dragging = true;
    dragPointerId = e.pointerId;
    dragLastX = e.clientX;
    dragLastT = e.timeStamp;
    dragVelocity = 0;
    inertiaVelocity = 0;
    canvas.style.cursor = "grabbing";
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture unavailable; drag still works while pointer stays over canvas */
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== dragPointerId) return;
    const dx = e.clientX - dragLastX;
    const dt = Math.max(1, e.timeStamp - dragLastT);
    dragLastX = e.clientX;
    dragLastT = e.timeStamp;
    const width = Math.max(1, cssWidth);
    const framesDelta = (-dx / (WIDTHS_PER_REVOLUTION * width)) * frames;
    pos = wrap(pos + framesDelta);
    dragVelocity = dragVelocity * 0.7 + (framesDelta / dt) * 0.3;
    dirty = true;
  }

  function endDrag(e: PointerEvent): void {
    if (!dragging || e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = -1;
    canvas.style.cursor = "grab";
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (reducedMotion) {
      pos = wrap(Math.round(pos));
      dirty = true;
      return;
    }
    const v = Math.max(-MAX_FLING_VELOCITY, Math.min(MAX_FLING_VELOCITY, dragVelocity));
    if (Math.abs(v) >= MIN_FLING_VELOCITY) {
      inertiaVelocity = v;
    } else {
      // Displayed frame is round(pos), so snapping the position to the
      // nearest integer never visibly jumps.
      pos = wrap(Math.round(pos));
      dirty = true;
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
        stepFrame(-1);
        break;
      case "ArrowRight":
        stepFrame(1);
        break;
      case "Home":
        inertiaVelocity = 0;
        pos = 0;
        dirty = true;
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      markInteract();
    }
  }

  function stepFrame(delta: number): void {
    inertiaVelocity = 0;
    pos = wrap(Math.round(pos) + delta);
    dirty = true;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("keydown", onKeyDown);

  /* ── Rendering ─────────────────────────────────────────────────────── */

  function drawContain(frame: DecodedFrame): void {
    const fw = frameWidth(frame);
    const fh = frameHeight(frame);
    if (fw <= 0 || fh <= 0) return;
    const w = canvas.width;
    const h = canvas.height;
    const scale = Math.min(w / fw, h / fh);
    const dw = fw * scale;
    const dh = fh * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function render(now: number): void {
    const idx = currentIndex();
    const best = loader.getBestFrame(state, idx, targetSize);
    const w = canvas.width;
    const h = canvas.height;

    if (fade !== null) {
      const t = Math.min(1, (now - fade.start) / FADE_MS);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fade.snapshot, 0, 0, w, h);
      if (best !== null) {
        ctx.globalAlpha = t;
        drawContain(best.frame);
        ctx.globalAlpha = 1;
      }
      if (t >= 1) fade = null;
      return;
    }

    // Nothing decoded yet for this combo: keep whatever is on the canvas
    // (or its transparent initial state) rather than flashing black.
    if (best === null) return;

    ctx.clearRect(0, 0, w, h);
    drawContain(best.frame);
  }

  function emitFrameChangeIfNeeded(): void {
    const idx = currentIndex();
    if (idx !== lastEmittedIndex) {
      lastEmittedIndex = idx;
      loader.setPriority(idx);
      emit("framechange", idx);
    }
  }

  /* ── Config swaps ──────────────────────────────────────────────────── */

  function beginSwap(now: number): void {
    if (pending === null) return;
    if (!reducedMotion && canvas.width > 0 && canvas.height > 0 && typeof document !== "undefined") {
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const sctx = snapshot.getContext("2d");
      if (sctx !== null) {
        sctx.drawImage(canvas, 0, 0);
        fade = { snapshot, start: now };
      }
    }
    state = pending;
    pending = null;
    dirty = true;
  }

  function setConfig(next: ConfigState): void {
    if (destroyed) return;
    const key = comboKey(next);
    if (key === comboKey(pending ?? state)) {
      // comboKey covers every ConfigState field, so this is the same state.
      return;
    }
    if (!manifest.combos.includes(key)) {
      emit("error", {
        message: `Configuration unavailable: no frame sequence rendered for ${key}`,
      });
      return;
    }
    pending = { ...next };
    // Cancels the previous combo's in-flight loads and starts the new one,
    // prioritised at the current azimuth so the cross-fade can begin ASAP.
    loader.loadSequence(pending, targetSize, currentIndex());
    dirty = true;
  }

  /* ── Main loop ─────────────────────────────────────────────────────── */

  let raf = 0;
  let lastTick = 0;

  function tick(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(tick);
    const dt = lastTick > 0 ? Math.min(100, now - lastTick) : 16.7;
    lastTick = now;

    if (autoRotateDps > 0 && !dragging && !interacted && !reducedMotion) {
      pos = wrap(pos + (autoRotateDps / 360) * frames * (dt / 1000));
      dirty = true;
    }

    if (inertiaVelocity !== 0 && !dragging) {
      pos = wrap(pos + inertiaVelocity * dt);
      inertiaVelocity *= Math.pow(FRICTION, dt / 16.667);
      if (Math.abs(inertiaVelocity) < STOP_VELOCITY) {
        inertiaVelocity = 0;
        pos = wrap(Math.round(pos)); // invisible snap: displayed frame unchanged
      }
      dirty = true;
    }

    if (pending !== null && loader.hasExactFrame(pending, currentIndex())) {
      beginSwap(now);
    }

    if (fade !== null) dirty = true;

    emitFrameChangeIfNeeded();

    if (dirty) {
      dirty = false;
      render(now);
    }
  }

  /* ── Init ──────────────────────────────────────────────────────────── */

  updateSize();
  sizeInitialised = true;

  const initialCombo = comboKey(state);
  if (manifest.combos.includes(initialCombo)) {
    loader.loadSequence(state, targetSize, currentIndex());
  } else {
    // Defer so callers subscribing right after create still hear it.
    queueMicrotask(() => {
      if (!destroyed) {
        emit("error", {
          message: `Configuration unavailable: no frame sequence rendered for ${initialCombo}`,
        });
      }
    });
  }

  raf = requestAnimationFrame(tick);

  /* ── Public interface ──────────────────────────────────────────────── */

  return {
    setConfig,

    setIndex(index: number): void {
      if (destroyed) return;
      inertiaVelocity = 0;
      pos = wrap(Math.round(index));
      dirty = true;
    },

    getIndex(): number {
      return currentIndex();
    },

    frameCount(): number {
      return manifest.frameCount;
    },

    on,

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      if (reloadTimer !== null) clearTimeout(reloadTimer);
      resizeObserver?.disconnect();
      if (windowResizeHandler !== null && typeof window !== "undefined") {
        window.removeEventListener("resize", windowResizeHandler);
      }
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("keydown", onKeyDown);
      loader.destroy();
      listeners.clear();
      fade = null;
    },
  };
}
