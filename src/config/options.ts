/**
 * ─────────────────────────────────────────────────────────────────────────
 *  RECON CONFIGURATOR OPTION SCHEMA — single source of truth
 * ─────────────────────────────────────────────────────────────────────────
 * Grounded where possible in programme material (see docs/spec-sources.md
 * for the fact table with quotes and file references):
 *  - Airframe: "Reconnaître Recon VTOL", ≤7 kg MTOW, 422 Wh Li-Po
 *    (6S 19000 mAh), 2500 charge cycles, 30+ camera options (EO/IR/thermal),
 *    QGroundControl autopilot.  [BlueSight deck]
 *  - Payloads defensible for THIS airframe: EO/IR/thermal gimbal (high
 *    confidence), stereo-vision photogrammetry (high), multispectral /
 *    hyperspectral water-quality survey (medium).
 *  - The acoustic bird-deterrent payload is NOT offered here: the Rocky
 *    Point documents put deterrence on a DJI Matrice 30/Dock 2, not the
 *    Recon. Do not re-add it without new source material.
 *
 * Anything still marked `placeholder: true` has NO authoritative source:
 * colourways, the extended energy fit, and every endurance/range/coverage
 * figure. The UI shows an UNVERIFIED flag while any remain. Replace
 * computeSpecs() with the microsite calculator formulas when available —
 * do not publish the placeholder numbers.
 */

import type { ConfigState, OptionGroup, SpecReadout } from "../configurator/types";

export const OPTION_GROUPS: OptionGroup[] = [
  {
    id: "colourway",
    label: "Airframe finish",
    choices: [
      {
        id: "survey-grey",
        label: "Survey grey",
        detail: "Low-glare matte, daylight ops",
        placeholder: true, // no colourway/finish options appear in any source
      },
      {
        id: "maritime-dark",
        label: "Maritime dark",
        detail: "Low-visibility over water",
        placeholder: true,
      },
    ],
  },
  {
    id: "payload",
    label: "Primary payload",
    choices: [
      {
        id: "eo-ir",
        label: "EO/IR gimbal",
        detail: "Stabilised electro-optical / thermal",
        // Sourced: "30+ camera options (EO/IR/thermal)" on the Recon spec line.
      },
      {
        id: "stereo-vision",
        label: "Stereo-vision survey",
        detail: "Dual-camera photogrammetry (biomass)",
        // Sourced: Rocky Point stereo-vision biomass programme.
      },
      {
        id: "multispectral",
        label: "Multispectral survey",
        detail: "Water-quality / vegetation index",
        placeholder: true, // attributed to generic UAVs, medium confidence
      },
    ],
  },
  {
    id: "endurance",
    label: "Energy fit",
    choices: [
      {
        id: "standard",
        label: "422 Wh pack",
        detail: "6S 19000 mAh Li-Po, 2500 cycles",
        // Sourced: BlueSight Recon spec line.
      },
      {
        id: "extended",
        label: "Extended pack",
        detail: "Long-endurance profile — unconfirmed",
        placeholder: true, // no second battery option appears in any source
      },
    ],
  },
];

export const DEFAULT_STATE: ConfigState = {
  colourway: "survey-grey",
  payload: "eo-ir",
  endurance: "standard",
};

export function isValidState(s: Partial<ConfigState>): s is ConfigState {
  return OPTION_GROUPS.every((g) => {
    const v = s[g.id];
    return typeof v === "string" && g.choices.some((c) => c.id === v);
  });
}

/* ── Spec model ─────────────────────────────────────────────────────────
   MTOW and standard-pack energy are sourced; endurance/range use
   PLACEHOLDER formulas structured like the microsite calculators so the
   real formulas can drop in (import them, do not reimplement). */

const BASE = {
  mtowKg: 7.0, // sourced: "≤7 kg MTOW"
  packWh: 422, // sourced: 422 Wh Li-Po
  enduranceMin: 90, // PLACEHOLDER — no Recon-specific figure exists
  cruiseKmh: 65, // PLACEHOLDER
};

const PAYLOAD_ENDURANCE_FACTOR: Record<string, number> = {
  "eo-ir": 0.92, // PLACEHOLDER
  "stereo-vision": 0.95, // PLACEHOLDER
  multispectral: 0.9, // PLACEHOLDER
};

const ENERGY_FIT: Record<string, { wh: number; factor: number; sourced: boolean }> = {
  standard: { wh: BASE.packWh, factor: 1, sourced: true },
  extended: { wh: 560, factor: 1.3, sourced: false }, // PLACEHOLDER
};

export function computeSpecs(state: ConfigState): SpecReadout[] {
  const pf = PAYLOAD_ENDURANCE_FACTOR[state.payload] ?? 1;
  const fit = ENERGY_FIT[state.endurance] ?? ENERGY_FIT.standard;

  const enduranceMin = Math.round(BASE.enduranceMin * pf * fit.factor);
  const rangeKm = Math.round((enduranceMin / 60) * BASE.cruiseKmh);

  return [
    { id: "endurance", label: "Endurance", value: String(enduranceMin), unit: "min", placeholder: true },
    { id: "range", label: "Range", value: String(rangeKm), unit: "km", placeholder: true },
    { id: "energy", label: "Energy", value: String(fit.wh), unit: "Wh", placeholder: !fit.sourced },
    { id: "mtow", label: "MTOW", value: "≤7.0", unit: "kg", placeholder: false },
  ];
}

export function hasPlaceholderData(): boolean {
  return OPTION_GROUPS.some((g) => g.choices.some((c) => c.placeholder));
}
