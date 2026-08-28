/**
 * Deep-linkable configurator state <-> URL query string.
 *
 * Produces stable query strings like:
 *   ?colourway=survey-grey&payload=eo-ir&endurance=standard&az=12
 * (az omitted when 0) so sales can send a specific build.
 *
 * Reads are pure; writes go through history.replaceState and are debounced
 * (~250ms, trailing) so drag-driven azimuth updates do not thrash history.
 * All browser APIs are guarded, so the module is safe to import during SSR
 * (URLSearchParams exists in Node, so parsing also works server-side).
 */

import type { ConfigState } from "./types";
import { OPTION_GROUPS, isValidState } from "../config/options";

const WRITE_DEBOUNCE_MS = 250;

/**
 * Parse a ConfigState from a query string ("?a=b" or "a=b"). Unknown or
 * invalid values fall back per-field; the result is always a valid state
 * (per isValidState), else a copy of the fallback.
 */
export function parseStateFromUrl(search: string, fallback: ConfigState): ConfigState {
  const params = new URLSearchParams(search);
  const candidate: ConfigState = { ...fallback };
  for (const group of OPTION_GROUPS) {
    const value = params.get(group.id);
    if (value !== null && group.choices.some((c) => c.id === value)) {
      candidate[group.id] = value;
    }
  }
  return isValidState(candidate) ? candidate : { ...fallback };
}

/**
 * Parse the optional "az" azimuth index from a query string. Returns 0 when
 * absent or invalid. When frameCount is provided the index is wrapped into
 * [0, frameCount).
 */
export function parseAzimuthFromUrl(search: string, frameCount?: number): number {
  const raw = new URLSearchParams(search).get("az");
  if (raw === null || raw === "") return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) return 0;
  if (typeof frameCount === "number" && frameCount > 0) {
    return value % frameCount;
  }
  return value;
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: { state: ConfigState; az: number } | null = null;

function applyWrite(): void {
  writeTimer = null;
  const write = pendingWrite;
  pendingWrite = null;
  if (write === null) return;
  if (
    typeof window === "undefined" ||
    typeof window.history === "undefined" ||
    typeof window.location === "undefined"
  ) {
    return;
  }
  const parts = [
    `colourway=${encodeURIComponent(write.state.colourway)}`,
    `payload=${encodeURIComponent(write.state.payload)}`,
    `endurance=${encodeURIComponent(write.state.endurance)}`,
  ];
  const az = Number.isFinite(write.az) ? Math.max(0, Math.round(write.az)) : 0;
  if (az !== 0) parts.push(`az=${az}`);
  const url = `${window.location.pathname}?${parts.join("&")}${window.location.hash}`;
  try {
    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* replaceState can throw under aggressive rate limiting; the next
       debounced write will retry with fresh state. */
  }
}

/**
 * Serialise the configuration (and azimuth index; omitted when 0) into the
 * current URL via history.replaceState. Calls are debounced internally
 * (~250ms trailing), so it is safe to call on every drag frame.
 * No-op during SSR.
 */
export function writeStateToUrl(state: ConfigState, az: number): void {
  if (typeof window === "undefined" || typeof window.history === "undefined") return;
  pendingWrite = { state: { ...state }, az };
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(applyWrite, WRITE_DEBOUNCE_MS);
}

/** Flush any pending debounced write immediately (e.g. on pagehide). */
export function flushStateToUrl(): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    applyWrite();
  }
}
