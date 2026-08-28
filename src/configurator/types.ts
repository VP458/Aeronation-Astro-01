/**
 * Shared contract for the Recon configurator.
 *
 * The state model is renderer-agnostic by design: today it drives a
 * pre-rendered frame-sequence viewer (Path B); when real geometry lands,
 * a Three.js renderer implements the same TurntableViewer interface and
 * nothing above it changes.
 */

/** One selected value per option group. Keys match OptionGroup ids. */
export interface ConfigState {
  colourway: string;
  payload: string;
  endurance: string;
}

export interface OptionChoice {
  id: string;
  /** Operator-facing label, instrument-panel voice. */
  label: string;
  /** One line shown when the choice is active. */
  detail?: string;
  /** True until the value is confirmed against real programme material. */
  placeholder?: boolean;
}

export interface OptionGroup {
  id: keyof ConfigState;
  /** Panel legend, names what the operator controls. */
  label: string;
  choices: OptionChoice[];
}

/** Computed spec readout line. */
export interface SpecReadout {
  id: string;
  label: string;
  value: string;
  unit: string;
  placeholder: boolean;
}

/**
 * Frame sequences live at:
 *   /frames/{colourway}/{payload}/{endurance}/{size}/{nnn}.webp
 * where nnn is zero-padded 3-digit azimuth index (000..frameCount-1)
 * and size is one of manifest.sizes ("w1280" etc).
 * A manifest at /frames/manifest.json describes what exists.
 */
export interface FramesManifest {
  frameCount: number;
  /** e.g. ["w640", "w1280"] — ascending. Directory names under each combo. */
  sizes: string[];
  /** Pixel width for each size key. */
  sizeWidths: Record<string, number>;
  /** File formats present, in preference order, e.g. ["webp"]. */
  formats: string[];
  /** Combos actually rendered, as "colourway/payload/endurance" strings. */
  combos: string[];
  /** True while sequences are generated placeholders, not product renders. */
  placeholder: boolean;
}

export function frameUrl(
  state: ConfigState,
  size: string,
  index: number,
  format = "webp"
): string {
  const n = String(index).padStart(3, "0");
  return `/frames/${state.colourway}/${state.payload}/${state.endurance}/${size}/${n}.${format}`;
}

export function comboKey(state: ConfigState): string {
  return `${state.colourway}/${state.payload}/${state.endurance}`;
}

export type ViewerEvent = "interact" | "framechange" | "sequenceready" | "error";

export interface TurntableViewerOptions {
  manifest: FramesManifest;
  initialState: ConfigState;
  /** Start azimuth index. Default 0. */
  initialIndex?: number;
  /** Degrees per second of idle auto-rotate; 0 disables. Stops on first interaction. */
  autoRotate?: number;
  /** Honoured automatically, but overridable for tests. */
  reducedMotion?: boolean;
}

export interface TurntableViewer {
  setConfig(state: ConfigState): void;
  setIndex(index: number): void;
  getIndex(): number;
  /** Frame count comes from the manifest; exposed for keyboard step logic. */
  frameCount(): number;
  on(event: ViewerEvent, cb: (detail?: unknown) => void): () => void;
  destroy(): void;
}
