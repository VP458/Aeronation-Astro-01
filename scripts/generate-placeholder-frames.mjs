/**
 * generate-placeholder-frames.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER turntable frame generator for the Recon configurator (Path B).
 *
 * No real geometry or turntable renders exist yet, so this script draws a
 * deliberately schematic, instrument-grade wireframe of a *generic* VTOL
 * fixed-wing survey airframe (it is intentionally NOT a likeness of the
 * product) and rasterises 36 azimuth steps per option combination so the
 * scrubbing interaction can be evaluated. Every frame carries a visible
 * "PLACEHOLDER SEQUENCE" label. Delete public/frames and re-run when real
 * renders land.
 *
 * Output layout (matches src/configurator/types.ts frameUrl()):
 *   public/frames/{colourway}/{payload}/{endurance}/{size}/{nnn}.webp
 *   public/frames/manifest.json          (FramesManifest)
 *
 * Deterministic and re-runnable: cleans public/frames first, touches
 * nothing outside it.
 *
 * Usage: npm run frames:placeholder
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/* ── Contract constants (keep in sync with src/config/options.ts) ─────── */

const COLOURWAYS = ["survey-grey", "maritime-dark"];
const PAYLOADS = ["eo-ir", "multispectral", "deterrent"];
const ENDURANCES = ["standard", "extended"];

const FRAME_COUNT = 36; // 10° azimuth steps
const SIZES = { w640: [640, 360], w1280: [1280, 720] };
const WEBP_QUALITY = 78;
const ELEVATION_DEG = 18;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES_DIR = join(ROOT, "public", "frames");

/* ── Colour schemes ───────────────────────────────────────────────────── */

const SCHEMES = {
  "survey-grey": {
    line: "#c8d0d8", // light grey structure
    accent: "#4fd6e8", // cyan instrumentation
    shadow: "#0a1218",
    label: "#93a1ad",
  },
  "maritime-dark": {
    line: "#8fa3b8", // navy-slate structure
    accent: "#e8a33d", // amber instrumentation
    shadow: "#05090e",
    label: "#7c8ea0",
  },
};

/* ── 3D primitives ────────────────────────────────────────────────────────
 * Coordinate system: x forward (nose +x), y right (span), z up. Metres.
 * A "poly" is { pts: [[x,y,z],...], cls, closed? } where cls picks stroke
 * style: "base" (structure), "thin" (formers/ribs), "accent" (rotors,
 * payload, config-dependent kit — drawn in the scheme accent colour).
 * ──────────────────────────────────────────────────────────────────────── */

function circle3(cx, cy, cz, r, plane, n = 36) {
  // plane: "z" horizontal (rotor discs), "x" vertical y-z (prop, pod rims)
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (plane === "z") pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz]);
    else pts.push([cx, cy + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

function box3(x0, x1, y0, y1, z0, z1) {
  // 12 edges of an axis-aligned wireframe box, as polylines
  const c = (x, y, z) => [x, y, z];
  const p = [
    c(x0, y0, z0), c(x1, y0, z0), c(x1, y1, z0), c(x0, y1, z0),
    c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1),
  ];
  return [
    { pts: [p[0], p[1], p[2], p[3]], closed: true },
    { pts: [p[4], p[5], p[6], p[7]], closed: true },
    { pts: [p[0], p[4]] },
    { pts: [p[1], p[5]] },
    { pts: [p[2], p[6]] },
    { pts: [p[3], p[7]] },
  ];
}

/* ── Airframe model ───────────────────────────────────────────────────── */

function buildAirframe(payload, endurance) {
  const polys = [];
  const add = (pts, cls, closed = false) => polys.push({ pts, cls, closed });

  /* Fuselage — slender pod, ~1.55 m, elliptical formers + 4 longerons */
  const stations = [
    // [x, half-width(y), half-height(z)]
    [0.78, 0.0, 0.0], // nose point
    [0.62, 0.045, 0.05],
    [0.35, 0.062, 0.072],
    [0.0, 0.066, 0.076],
    [-0.35, 0.056, 0.062],
    [-0.62, 0.038, 0.045],
    [-0.78, 0.014, 0.02], // tail cap
  ];
  // formers (skip the nose point)
  for (const [x, hw, hh] of stations.slice(1)) {
    add(circleEllipse(x, hw, hh), "thin", true);
  }
  // longerons: top, bottom, left, right
  for (const [dy, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    add(stations.map(([x, hw, hh]) => [x, dy * hw, dz * hh]), "base");
  }

  /* High straight wing — 2.5 m span, slight tip taper, shoulder-mounted */
  const zw = 0.095;
  const wing = {
    rootLE: 0.17, rootTE: -0.14, tipLE: 0.12, tipTE: -0.09,
    tipY: 1.25, tipZ: zw + 0.02,
  };
  add([[wing.tipLE, -wing.tipY, wing.tipZ], [wing.rootLE, 0, zw], [wing.tipLE, wing.tipY, wing.tipZ]], "base"); // leading edge
  add([[wing.tipTE, -wing.tipY, wing.tipZ], [wing.rootTE, 0, zw], [wing.tipTE, wing.tipY, wing.tipZ]], "base"); // trailing edge
  add([[wing.tipLE, -wing.tipY, wing.tipZ], [wing.tipTE, -wing.tipY, wing.tipZ]], "base"); // tips
  add([[wing.tipLE, wing.tipY, wing.tipZ], [wing.tipTE, wing.tipY, wing.tipZ]], "base");
  for (const y of [-0.85, -0.42, 0, 0.42, 0.85]) {
    // rib chord lines, interpolated
    const t = Math.abs(y) / wing.tipY;
    const le = wing.rootLE + (wing.tipLE - wing.rootLE) * t;
    const te = wing.rootTE + (wing.tipTE - wing.rootTE) * t;
    const z = zw + 0.02 * t;
    add([[le, y, z], [te, y, z]], "thin");
  }

  /* Twin tail booms — slender rectangles in the x-z plane at y = ±0.42 */
  const boomY = 0.42;
  for (const s of [-1, 1]) {
    const y = s * boomY;
    add(
      [[0.55, y, 0.048], [-1.05, y, 0.038], [-1.05, y, -0.002], [0.55, y, -0.002]],
      "base",
      true
    );
  }

  /* Inverted-V tail — panels from each boom end to a shared upper apex */
  const apexLE = [-1.04, 0, 0.40];
  const apexTE = [-1.19, 0, 0.40];
  for (const s of [-1, 1]) {
    const y = s * boomY;
    add([[-0.92, y, 0.02], apexLE, apexTE, [-1.05, y, 0.02]], "base", true);
  }
  add([apexLE, apexTE], "thin");

  /* Four lift rotors on the booms — thin discs + hub ticks */
  const rotorR = 0.24;
  for (const [rx, ry] of [
    [0.42, boomY], [0.42, -boomY], [-0.72, boomY], [-0.72, -boomY],
  ]) {
    add(circle3(rx, ry, 0.075, rotorR, "z"), "accent", true);
    add(circle3(rx, ry, 0.075, rotorR * 0.16, "z", 12), "accent", true); // hub
    add([[rx, ry, 0.048], [rx, ry, 0.075]], "thin"); // motor mast
  }

  /* Pusher propeller at the tail — disc in the y-z plane + spinner */
  add(circle3(-0.82, 0, 0.0, 0.19, "x"), "accent", true);
  add([[-0.78, 0, 0], [-0.88, 0, 0]], "accent");

  /* Payload fits (accent — these are what the toggles change) */
  if (payload === "eo-ir") {
    // spherical gimbal under the nose: equator + meridian + mount
    const g = [0.5, 0, -0.16];
    add(circle3(g[0], g[1], g[2], 0.09, "z"), "accent", true);
    add(circle3(g[0], g[1], g[2], 0.09, "x"), "accent", true);
    add([[0.5, 0, -0.058], [0.5, 0, -0.07]], "accent"); // mount stub
    add([[0.56, 0, -0.19], [0.62, 0, -0.21]], "accent"); // lens boresight tick
  } else if (payload === "multispectral") {
    // flat rectangular sensor bar under the wing centre
    for (const e of box3(-0.10, 0.10, -0.20, 0.20, -0.145, -0.095)) {
      add(e.pts, "accent", e.closed);
    }
    add([[0.0, -0.14, -0.095], [0.0, -0.14, -0.062]], "accent"); // struts
    add([[0.0, 0.14, -0.095], [0.0, 0.14, -0.062]], "accent");
  } else if (payload === "deterrent") {
    // acoustic pod with a forward-flaring horn under the fuselage
    add(circle3(0.10, 0, -0.13, 0.05, "x", 20), "accent", true); // pod aft rim
    add(circle3(0.30, 0, -0.13, 0.05, "x", 20), "accent", true); // pod fore rim
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const dy = 0.05 * Math.cos(a);
      const dz = 0.05 * Math.sin(a);
      add([[0.10, dy, -0.13 + dz], [0.30, dy, -0.13 + dz]], "accent"); // pod walls
    }
    add(circle3(0.44, 0, -0.14, 0.088, "x", 24), "accent", true); // horn mouth
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      add(
        [
          [0.30, 0.05 * Math.cos(a), -0.13 + 0.05 * Math.sin(a)],
          [0.44, 0.088 * Math.cos(a), -0.14 + 0.088 * Math.sin(a)],
        ],
        "accent"
      ); // horn flare
    }
    add([[0.20, 0, -0.08], [0.20, 0, -0.062]], "accent"); // mount strut
  }

  /* Energy fit — belly pack under the fuselage centre.
     standard: slim conformal pack; extended: visibly longer and deeper. */
  if (endurance === "extended") {
    for (const e of box3(-0.34, 0.34, -0.085, 0.085, -0.195, -0.07)) {
      add(e.pts, "accent", e.closed);
    }
    // cell division ribs
    add([[0.0, -0.085, -0.195], [0.0, -0.085, -0.07]], "thin");
    add([[0.0, 0.085, -0.195], [0.0, 0.085, -0.07]], "thin");
  } else {
    for (const e of box3(-0.17, 0.17, -0.07, 0.07, -0.115, -0.07)) {
      add(e.pts, "accent", e.closed);
    }
  }

  return polys;

  function circleEllipse(x, hw, hh, n = 16) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([x, hw * Math.cos(a), hh * Math.sin(a)]);
    }
    return pts;
  }
}

/* ── Projection ───────────────────────────────────────────────────────────
 * Orthographic turntable camera: azimuth az around +z, elevation el.
 *   right = (-sin az,  cos az, 0)
 *   up    = (-cos az·sin el, -sin az·sin el, cos el)
 * ──────────────────────────────────────────────────────────────────────── */

function makeProjector(azDeg, elDeg, scale, cx, cy) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  const sinA = Math.sin(az), cosA = Math.cos(az);
  const sinE = Math.sin(el), cosE = Math.cos(el);
  return ([x, y, z]) => {
    const sx = -x * sinA + y * cosA;
    const sy = -x * cosA * sinE - y * sinA * sinE + z * cosE;
    return [cx + sx * scale, cy - sy * scale];
  };
}

const fmt = (n) => (Math.round(n * 100) / 100).toString();

function polyPath(pts2, closed) {
  let d = `M${fmt(pts2[0][0])} ${fmt(pts2[0][1])}`;
  for (let i = 1; i < pts2.length; i++) d += `L${fmt(pts2[i][0])} ${fmt(pts2[i][1])}`;
  return closed ? d + "Z" : d;
}

/* ── Frame SVG ────────────────────────────────────────────────────────── */

const W = 1280, H = 720;
const SCALE = 320;
const CX = W / 2, CY = 348;
const GROUND_Z = -0.38;
const RING_R = 1.48;

function frameSvg(polys, azDeg, scheme) {
  const proj = makeProjector(azDeg, ELEVATION_DEG, SCALE, CX, CY);
  const sinE = Math.sin((ELEVATION_DEG * Math.PI) / 180);

  // paths grouped per style class so strokes are set once
  const groups = { base: [], thin: [], accent: [] };
  for (const p of polys) groups[p.cls].push(polyPath(p.pts.map(proj), p.closed));

  // ground shadow: soft ellipse under the airframe (ground plane circle
  // projects to an ellipse with ry = rx·sin(el))
  const [gx, gy] = proj([0, 0, GROUND_Z]);
  const shRx = 0.98 * SCALE;
  const shRy = shRx * sinE;

  // azimuth ring: dotted ground-plane circle, ellipse under orthographic
  const ringRx = RING_R * SCALE;
  const ringRy = ringRx * sinE;
  // heading tick: fixed to the airframe (world +x), rotates on screen
  const tickA = proj([RING_R, 0, GROUND_Z]);
  const tickB = proj([RING_R + 0.14, 0, GROUND_Z]);
  // cardinal dots every 90° for instrument feel
  const cardinals = [90, 180, 270].map((d) => {
    const a = (d * Math.PI) / 180;
    return proj([RING_R * Math.cos(a), RING_R * Math.sin(a), GROUND_Z]);
  });

  const azLabel = String(Math.round(azDeg) % 360).padStart(3, "0");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<radialGradient id="sh" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="${scheme.shadow}" stop-opacity="0.55"/>
<stop offset="55%" stop-color="${scheme.shadow}" stop-opacity="0.28"/>
<stop offset="100%" stop-color="${scheme.shadow}" stop-opacity="0"/>
</radialGradient>
</defs>
<ellipse cx="${fmt(gx)}" cy="${fmt(gy)}" rx="${fmt(shRx)}" ry="${fmt(shRy)}" fill="url(#sh)"/>
<ellipse cx="${fmt(gx)}" cy="${fmt(gy)}" rx="${fmt(ringRx)}" ry="${fmt(ringRy)}" fill="none" stroke="${scheme.accent}" stroke-width="1.1" stroke-opacity="0.45" stroke-dasharray="1.5 7"/>
${cardinals.map(([x, y]) => `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="2.4" fill="${scheme.accent}" fill-opacity="0.5"/>`).join("\n")}
<path d="M${fmt(tickA[0])} ${fmt(tickA[1])}L${fmt(tickB[0])} ${fmt(tickB[1])}" stroke="${scheme.accent}" stroke-width="2.6" stroke-opacity="0.9" stroke-linecap="round"/>
<circle cx="${fmt(tickA[0])}" cy="${fmt(tickA[1])}" r="3.4" fill="none" stroke="${scheme.accent}" stroke-width="1.2" stroke-opacity="0.9"/>
<g fill="none" stroke="${scheme.accent}" stroke-width="4.5" stroke-opacity="0.16" stroke-linejoin="round" stroke-linecap="round">
${groups.accent.map((d) => `<path d="${d}"/>`).join("\n")}
</g>
<g fill="none" stroke="${scheme.line}" stroke-width="1" stroke-opacity="0.5" stroke-linejoin="round">
${groups.thin.map((d) => `<path d="${d}"/>`).join("\n")}
</g>
<g fill="none" stroke="${scheme.line}" stroke-width="2" stroke-opacity="0.92" stroke-linejoin="round" stroke-linecap="round">
${groups.base.map((d) => `<path d="${d}"/>`).join("\n")}
</g>
<g fill="none" stroke="${scheme.accent}" stroke-width="1.5" stroke-opacity="0.95" stroke-linejoin="round" stroke-linecap="round">
${groups.accent.map((d) => `<path d="${d}"/>`).join("\n")}
</g>
<g font-family="DejaVu Sans Mono, monospace" font-size="17" letter-spacing="4">
<text x="${W / 2}" y="${H - 22}" text-anchor="middle" fill="${scheme.label}" fill-opacity="0.85">PLACEHOLDER SEQUENCE</text>
<text x="${W - 30}" y="${H - 22}" text-anchor="end" fill="${scheme.accent}" fill-opacity="0.8" letter-spacing="2">AZ ${azLabel}°</text>
</g>
</svg>`;
}

/* ── Generation ───────────────────────────────────────────────────────── */

async function main() {
  console.log("Cleaning", FRAMES_DIR);
  // Safety: only ever remove the fixed public/frames path inside the repo.
  await rm(FRAMES_DIR, { recursive: true, force: true });

  const combos = [];
  for (const c of COLOURWAYS)
    for (const p of PAYLOADS)
      for (const e of ENDURANCES) combos.push([c, p, e]);

  const jobs = [];
  for (const [colourway, payload, endurance] of combos) {
    const polys = buildAirframe(payload, endurance);
    const scheme = SCHEMES[colourway];
    for (const size of Object.keys(SIZES)) {
      await mkdir(join(FRAMES_DIR, colourway, payload, endurance, size), {
        recursive: true,
      });
    }
    for (let i = 0; i < FRAME_COUNT; i++) {
      jobs.push({ colourway, payload, endurance, polys, scheme, i });
    }
  }

  let done = 0;
  const CONCURRENCY = 8;
  async function worker() {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const { colourway, payload, endurance, polys, scheme, i } = job;
      const svg = Buffer.from(
        frameSvg(polys, i * (360 / FRAME_COUNT), scheme)
      );
      const nnn = String(i).padStart(3, "0");
      const big = sharp(svg); // rendered at native 1280×720
      const bigBuf = await big
        .webp({ quality: WEBP_QUALITY, effort: 5 })
        .toBuffer();
      const smallBuf = await sharp(svg)
        .resize(SIZES.w640[0], SIZES.w640[1])
        .webp({ quality: WEBP_QUALITY, effort: 5 })
        .toBuffer();
      await writeFile(
        join(FRAMES_DIR, colourway, payload, endurance, "w1280", `${nnn}.webp`),
        bigBuf
      );
      await writeFile(
        join(FRAMES_DIR, colourway, payload, endurance, "w640", `${nnn}.webp`),
        smallBuf
      );
      done += 2;
      if (done % 144 === 0) console.log(`  ${done}/864 frames written`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  /* Manifest — conforms to FramesManifest in src/configurator/types.ts */
  const manifest = {
    frameCount: FRAME_COUNT,
    sizes: ["w640", "w1280"],
    sizeWidths: { w640: 640, w1280: 1280 },
    formats: ["webp"],
    combos: combos.map((c) => c.join("/")),
    placeholder: true,
  };
  await writeFile(
    join(FRAMES_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  console.log(`Done: ${done} frames + manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
