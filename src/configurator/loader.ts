/**
 * Frame loading for the Path-B turntable viewer.
 *
 * Responsibilities:
 *  - fetch + createImageBitmap for off-main-thread decode, with an
 *    HTMLImageElement.decode() fallback where createImageBitmap is missing.
 *  - LRU cache of decoded frames keyed per combo/size/index; ImageBitmaps
 *    are close()d on eviction.
 *  - Low-res-first sequence strategy: the smallest manifest size loads as
 *    pass 0, then the target size as pass 1. Within each pass, frames load
 *    outward from the priority (current) azimuth index in both directions.
 *  - Cancellable via AbortController: starting a new sequence (combo
 *    switch) abandons all pending loads of the previous one.
 *  - Progress reporting (loaded/total plus distinct ready indices) via
 *    callback so the viewer can emit "sequenceready".
 *
 * Browser APIs are only touched inside functions, so this module is safe
 * to import during SSR.
 */

import type { ConfigState, FramesManifest } from "./types";
import { comboKey, frameUrl } from "./types";

export type DecodedFrame = ImageBitmap | HTMLImageElement;

export interface BestFrame {
  frame: DecodedFrame;
  /** Azimuth index actually served (may be a neighbour of the request). */
  index: number;
  /** Size key actually served (may be lower-res than requested). */
  size: string;
  /** True when the served azimuth index matches the requested index. */
  exactIndex: boolean;
}

export interface SequenceProgress {
  /** Completed load attempts (success or failure) for the active sequence. */
  loaded: number;
  /** Loads planned for the active sequence (already-cached frames excluded). */
  total: number;
  /** Distinct azimuth indices decoded at any size for the active combo. */
  indicesReady: number;
  frameCount: number;
  combo: string;
}

export interface FrameLoaderCallbacks {
  onProgress?: (progress: SequenceProgress) => void;
  /** A frame finished decoding and is now cached. */
  onFrame?: (index: number, size: string, combo: string) => void;
  /** First failure of the active sequence (aborts are not errors). */
  onError?: (message: string) => void;
}

export interface FrameLoaderOptions extends FrameLoaderCallbacks {
  /** Max decoded frames kept in memory. Default 120. */
  cacheCap?: number;
  /** Max in-flight fetches. Default 4. */
  concurrency?: number;
}

export interface FrameLoader {
  /**
   * Start (or restart) loading the sequence for a combo at the given target
   * size. Cancels any in-flight sequence first. Loads the smallest manifest
   * size across all frames, then upgrades to the target size, prioritising
   * frames nearest `priorityIndex` outward in both directions.
   */
  loadSequence(state: ConfigState, targetSize: string, priorityIndex: number): void;
  /** Re-centre the load order of pending frames around a new azimuth index. */
  setPriority(index: number): void;
  /**
   * Best decoded frame for a request: the exact index at the target size,
   * else the exact index at another size (largest first), else the nearest
   * neighbouring index outward at any size. Null when nothing is cached.
   */
  getBestFrame(state: ConfigState, index: number, targetSize: string): BestFrame | null;
  /** True when the exact azimuth index is decoded at any size for the combo. */
  hasExactFrame(state: ConfigState, index: number): boolean;
  /** Abort the active sequence's pending loads. Cache is retained. */
  cancel(): void;
  /** Cancel, close all cached ImageBitmaps, and drop the cache. */
  destroy(): void;
}

interface CacheEntry {
  frame: DecodedFrame;
  combo: string;
  size: string;
  index: number;
}

interface LoadTask {
  index: number;
  size: string;
  /** 0 = low-res pass, 1 = target-size pass. */
  pass: number;
  key: string;
  url: string;
}

interface ActiveSequence {
  combo: string;
  controller: AbortController;
  pending: LoadTask[];
  active: number;
  loaded: number;
  total: number;
  priority: number;
  errorReported: boolean;
  readyIndices: Set<number>;
}

const DEFAULT_CACHE_CAP = 120;
const DEFAULT_CONCURRENCY = 4;

function cacheKeyFor(combo: string, size: string, index: number): string {
  return `${combo}/${size}/${index}`;
}

function ringDistance(a: number, b: number, frameCount: number): number {
  const d = Math.abs(a - b) % frameCount;
  return Math.min(d, frameCount - d);
}

function normalizeIndex(index: number, frameCount: number): number {
  const i = Math.round(index) % frameCount;
  return i < 0 ? i + frameCount : i;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function abortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Aborted", "AbortError");
  }
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

function closeFrame(frame: DecodedFrame): void {
  if (typeof ImageBitmap !== "undefined" && frame instanceof ImageBitmap) {
    frame.close();
  }
}

/** Smallest manifest size wide enough for the device-pixel width, else the largest. */
export function pickSize(manifest: FramesManifest, deviceWidth: number): string {
  const sizes = manifest.sizes;
  if (sizes.length === 0) return "w640";
  let chosen = sizes[sizes.length - 1] as string;
  for (const size of sizes) {
    if ((manifest.sizeWidths[size] ?? 0) >= deviceWidth) {
      chosen = size;
      break;
    }
  }
  return chosen;
}

export function createFrameLoader(
  manifest: FramesManifest,
  opts: FrameLoaderOptions = {}
): FrameLoader {
  const cacheCap = Math.max(8, opts.cacheCap ?? DEFAULT_CACHE_CAP);
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const format = manifest.formats[0] ?? "webp";
  const frameCount = manifest.frameCount;

  /** Insertion order == recency order (oldest first). */
  const cache = new Map<string, CacheEntry>();
  let seq: ActiveSequence | null = null;
  let destroyed = false;

  function cacheGet(key: string): CacheEntry | undefined {
    const entry = cache.get(key);
    if (entry !== undefined) {
      // Refresh recency.
      cache.delete(key);
      cache.set(key, entry);
    }
    return entry;
  }

  function cachePut(key: string, entry: CacheEntry): void {
    const existing = cache.get(key);
    if (existing !== undefined) {
      cache.delete(key);
      if (existing.frame !== entry.frame) closeFrame(existing.frame);
    }
    cache.set(key, entry);
    while (cache.size > cacheCap) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined || oldestKey === key) break;
      const oldest = cache.get(oldestKey);
      cache.delete(oldestKey);
      if (oldest !== undefined) closeFrame(oldest.frame);
    }
  }

  function sizeOrder(targetSize: string): string[] {
    const others = manifest.sizes
      .filter((s) => s !== targetSize)
      .sort((a, b) => (manifest.sizeWidths[b] ?? 0) - (manifest.sizeWidths[a] ?? 0));
    return manifest.sizes.includes(targetSize) ? [targetSize, ...others] : [targetSize, ...others];
  }

  async function decodeViaElement(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
    if (typeof Image === "undefined") {
      throw new Error("No image decoding facility available in this environment");
    }
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    if (typeof img.decode === "function") {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
      });
    }
    if (signal.aborted) throw abortError();
    return img;
  }

  async function decodeFrame(url: string, signal: AbortSignal): Promise<DecodedFrame> {
    if (typeof createImageBitmap === "function" && typeof fetch === "function") {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      const blob = await res.blob();
      if (signal.aborted) throw abortError();
      return await createImageBitmap(blob);
    }
    return await decodeViaElement(url, signal);
  }

  function emitProgress(s: ActiveSequence): void {
    opts.onProgress?.({
      loaded: s.loaded,
      total: s.total,
      indicesReady: s.readyIndices.size,
      frameCount,
      combo: s.combo,
    });
  }

  function takeNextTask(s: ActiveSequence): LoadTask | null {
    if (s.pending.length === 0) return null;
    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < s.pending.length; i++) {
      const task = s.pending[i] as LoadTask;
      const score =
        task.pass * (frameCount + 1) + ringDistance(task.index, s.priority, frameCount);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const [task] = s.pending.splice(bestIdx, 1);
    return task ?? null;
  }

  function pump(): void {
    const s = seq;
    if (s === null || destroyed || s.controller.signal.aborted) return;
    while (s.active < concurrency) {
      const task = takeNextTask(s);
      if (task === null) break;
      // A lower-res pass may have raced a target-size fetch of the same key
      // (never happens with distinct sizes, but stay safe on skips).
      if (cache.has(task.key)) {
        s.loaded += 1;
        emitProgress(s);
        continue;
      }
      s.active += 1;
      void runTask(s, task);
    }
  }

  async function runTask(s: ActiveSequence, task: LoadTask): Promise<void> {
    const signal = s.controller.signal;
    try {
      const frame = await decodeFrame(task.url, signal);
      if (destroyed || signal.aborted) {
        closeFrame(frame);
      } else {
        cachePut(task.key, {
          frame,
          combo: s.combo,
          size: task.size,
          index: task.index,
        });
        s.readyIndices.add(task.index);
        opts.onFrame?.(task.index, task.size, s.combo);
      }
    } catch (err) {
      if (!destroyed && !signal.aborted && !isAbortError(err) && !s.errorReported) {
        s.errorReported = true;
        const message = err instanceof Error ? err.message : String(err);
        opts.onError?.(`Frame load failed: ${message}`);
      }
    } finally {
      if (seq === s && !signal.aborted && !destroyed) {
        s.active -= 1;
        s.loaded += 1;
        emitProgress(s);
        pump();
      }
    }
  }

  function loadSequence(state: ConfigState, targetSize: string, priorityIndex: number): void {
    if (destroyed || frameCount <= 0) return;
    cancel();

    const combo = comboKey(state);
    const target = manifest.sizes.includes(targetSize)
      ? targetSize
      : (manifest.sizes[manifest.sizes.length - 1] ?? targetSize);
    const low = manifest.sizes[0] ?? target;
    const passSizes = low === target ? [target] : [low, target];

    const s: ActiveSequence = {
      combo,
      controller: new AbortController(),
      pending: [],
      active: 0,
      loaded: 0,
      total: 0,
      priority: normalizeIndex(priorityIndex, frameCount),
      errorReported: false,
      readyIndices: new Set<number>(),
    };

    // Frames already decoded from an earlier visit count as ready.
    for (const entry of cache.values()) {
      if (entry.combo === combo) s.readyIndices.add(entry.index);
    }

    for (let pass = 0; pass < passSizes.length; pass++) {
      const size = passSizes[pass] as string;
      for (let index = 0; index < frameCount; index++) {
        const key = cacheKeyFor(combo, size, index);
        if (cache.has(key)) continue;
        s.pending.push({
          index,
          size,
          pass,
          key,
          url: frameUrl(state, size, index, format),
        });
      }
    }
    s.total = s.pending.length;

    seq = s;
    emitProgress(s);
    pump();
  }

  function setPriority(index: number): void {
    if (seq !== null && frameCount > 0) {
      seq.priority = normalizeIndex(index, frameCount);
    }
  }

  function getBestFrame(
    state: ConfigState,
    index: number,
    targetSize: string
  ): BestFrame | null {
    if (frameCount <= 0) return null;
    const combo = comboKey(state);
    const idx = normalizeIndex(index, frameCount);
    const sizes = sizeOrder(targetSize);

    for (const size of sizes) {
      const entry = cacheGet(cacheKeyFor(combo, size, idx));
      if (entry !== undefined) {
        return { frame: entry.frame, index: idx, size, exactIndex: true };
      }
    }
    const maxOffset = Math.floor(frameCount / 2);
    for (let d = 1; d <= maxOffset; d++) {
      for (const off of [d, -d]) {
        const neighbour = normalizeIndex(idx + off, frameCount);
        if (neighbour === idx) continue;
        for (const size of sizes) {
          const entry = cacheGet(cacheKeyFor(combo, size, neighbour));
          if (entry !== undefined) {
            return { frame: entry.frame, index: neighbour, size, exactIndex: false };
          }
        }
      }
    }
    return null;
  }

  function hasExactFrame(state: ConfigState, index: number): boolean {
    if (frameCount <= 0) return false;
    const combo = comboKey(state);
    const idx = normalizeIndex(index, frameCount);
    for (const size of manifest.sizes) {
      if (cache.has(cacheKeyFor(combo, size, idx))) return true;
    }
    return false;
  }

  function cancel(): void {
    if (seq !== null) {
      seq.controller.abort();
      seq.pending.length = 0;
      seq = null;
    }
  }

  function destroy(): void {
    if (destroyed) return;
    cancel();
    destroyed = true;
    for (const entry of cache.values()) closeFrame(entry.frame);
    cache.clear();
  }

  return { loadSequence, setPriority, getBestFrame, hasExactFrame, cancel, destroy };
}
