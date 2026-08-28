# Recon configurator — source-of-truth research log

Compiled 2026-08-28 by the spec-research agent from five Google Drive programme documents
(AeroNation / BlueSight / Rocky Point). Purpose: establish which configurator options, payload
names, and performance figures can be defended from real programme material, and which must
remain placeholder in `src/config/options.ts`.

Source key:

| Key | File | Drive fileId | Type |
|---|---|---|---|
| **BS-1** | "AeroNation Drones - BlueSight" | `1CJBEty9IFtKO1pohyHlgEyhESbaK0V17s5cqsMc4zCY` | Slides |
| **BS-2** | "BlueSight Research Program-0202" | `1iIRp9vFtP4KSZehkkMjCaI70-Q_tN4v1PlSraBneLvU` | Slides |
| **RP-1** | "AeroNation_RockyPoint_Drone_Bird_Deterrent_Proposal (2)" | `1o1-px6X0X1cBq8emvSnn4THZJ0P6TeHejHZXpdUllzA` | Doc |
| **RP-2** | "Drones-as-a-Service for Rocky Point Aquaculture" | `1WPuavC_JPHOOiCr-_DOrsk18AbmK3nVHiruetj6OcRU` | Slides |
| **RP-3** | "Drone Integration for Rocky Point Aquaculture" (Strategic Dossier) | `1_hCD1SJCvXXAAS_uDvDBKd9UuNu5Udp_WrM38t22c2U` | Doc |

The slide export carries no slide numbers; references below quote the slide's headline text instead.

---

## 1. Confirmed facts

### 1.1 Airframe identity

| Fact | Value | Source | Quote / reference |
|---|---|---|---|
| Product name | **Reconnaître Recon VTOL** | BS-1 | Slide "Technology: Maritime VTOL Drone Platforms — Reconnaître Recon VTOL — Australian-Made Autonomous Drone Fleet": "BlueSight's preferred platform — the Australian-made Reconnaître Recon VTOL" |
| Airframe class | Fixed-wing VTOL | BS-1 | Same slide, spec line: "Specifications: Fixed-wing VTOL" |
| Origin / positioning | Australian-made, Australian sovereign supply chain | BS-1 | "AUSTRALIAN-MADE \| BLUESIGHT PREFERRED"; "The Australian sovereign supply chain provides strategic advantages for local deployment and CASA compliance." |
| Fleet product | **Recon Hive System** | BS-1 | "Recon Hive System — 24/7 AUTONOMOUS COVERAGE. Up to 16 drones per hive. Solar-powered self-sustaining base station. Autonomous scheduled patrol missions. 30-min rapid charge (2C rate)." |
| Fleet hardware in DaaS | "Reconnaître Recon VTOL fleet" | BS-2 | Slide "Drones-as-a-Service: Commercial Model", Included in Every Tier: "All drone hardware (Reconnaître Recon VTOL fleet) and field crew" |
| Manufacturer branding | "AeroNation — Australian-manufactured drones, AI-powered detection, built for the Great Australian Bight." | BS-2 | Closing slide |

No other AeroNation airframe variant is named anywhere. The other platforms on the BS-1 slide
(AeroVironment JUMP 20-X — 13 hr / 185 km / 30 lb payload; Tekever AR3 EVO — 16 hr;
High Eye Airboxer) are explicitly **"Benchmark Platforms"** — competitors, not Recon variants.
Do not surface their figures as Recon specs.

### 1.2 Hard airframe/energy specifications (the only line of real numbers)

All from one spec line on BS-1, slide "Technology: Maritime VTOL Drone Platforms":

> "Specifications: Fixed-wing VTOL | ≤7kg MTOW | 422Wh Li-Po (6S 19000mAh) | 30+ camera options (EO/IR/thermal) | QGroundControl autopilot"
> "Key Features: Carbon fibre props (AU 3D-printed) | 2000 W/kg battery power density | 2,500 charge cycles (1C rate) | Collision-avoidance sensors"

| Fact | Value | Source | Caveat |
|---|---|---|---|
| MTOW | **≤ 7 kg** | BS-1 | Stated as a ceiling, not a per-configuration figure |
| Battery | **422 Wh Li-Po, 6S 19000 mAh** | BS-1 | Single pack named; no "extended pack" exists in any source |
| Battery power density | 2000 W/kg | BS-1 | Marketing prose; W/kg is discharge power density, not energy density — quote verbatim if used, do not derive endurance from it |
| Battery cycle life | 2,500 charge cycles at 1C | BS-1 | — |
| Rapid charge | 30 min at 2C (in Hive) | BS-1 | Attributed to Recon Hive System, useful for sortie-chaining math |
| Camera options | "30+ camera options (EO/IR/thermal)" | BS-1 | Count only — no individual camera model, mass, or spec named |
| Autopilot | QGroundControl | BS-1 | — |
| Props | Carbon fibre, Australian 3D-printed | BS-1 | — |
| Safety | Collision-avoidance sensors | BS-1 | — |
| Hive capacity | Up to 16 drones per hive; solar-powered base station | BS-1 | — |

### 1.3 Endurance — treat with care

| Fact | Value | Source | Caveat |
|---|---|---|---|
| Endurance claim | "3–16 hour endurance (VTOL platforms)" | BS-1, slides "The Solution" and "Autonomous Aerial Intelligence" | **This is a claim about the VTOL platform class, not the Recon.** The 16 hr top end matches the Tekever AR3 EVO benchmark on the platforms slide. A ≤7 kg MTOW airframe on a single 422 Wh pack cannot plausibly reach 16 hr. No Recon-specific endurance figure exists in any source. |
| Manned-aircraft baseline | "4–6 hour maximum flight time" (spotter planes) | BS-1 | Comparison figure for calculators, not a drone spec |

### 1.4 Payload / sensor configurations named in programme material

| Payload / module | Detail | Source | Caveat |
|---|---|---|---|
| EO/IR/thermal camera | "30+ camera options (EO/IR/thermal)" | BS-1 | Attributed directly to the Recon spec line — strongest payload fact we have |
| Stereo-vision photogrammetry (dual camera) | "Dual-camera payload captures synchronized images for 3D measurement… sub-centimeter precision" | BS-1 (Use Case 2), BS-2 (RP2: "Stereo-vision photogrammetry (sub-cm precision per NOAA APH-22)") | Sub-cm precision is validated by the NOAA APH-22 study (a hexacopter), cited as precedent — not a measured Recon result |
| Edge AI compute | "Models run on NVIDIA Jetson hardware mounted directly on the drone… NVIDIA Jetson Orin platform provides up to 275 TOPS" | BS-1 (Use Case 1; Technology Landscape) | Jetson Orin named as the platform choice; 275 TOPS is NVIDIA's module ceiling, not a Recon payload spec |
| Comms | "Results streamed to vessel bridge display via 4G/LTE with Iridium satellite backup" | BS-1 (Use Case 1) | — |
| Current sensors | "Drone-mounted current sensors capture real-time velocity and direction" | BS-2 (RP7) | RP7 is a proposed research program, not shipped hardware |
| Multispectral sensor | "UAVs equipped with hyperspectral (up to 276-band) and multispectral sensors conduct routine surveys" | RP-2 (Use Case 2) | Attributed to generic "UAVs" in the Rocky Point DaaS, not the Recon by name |
| Hyperspectral sensor | "up to 276-band" | RP-2 | Same caveat |
| Thermal IR (night ops) | "Thermal infrared sensing enables dusk, dawn, and night-time coverage" | RP-2 (Use Case 1) | — |
| Loudspeaker / acoustic deterrent | "loudspeaker payloads for distress calls" | RP-1 (§5.1) | **The recommended bird-deterrent architecture in RP-1 is DJI hardware ("DJI Dock 2 + Matrice 30T"), not the Recon.** RP-3 likewise specifies DJI Matrice 30 "with loudspeaker/spotlight payloads". An acoustic-deterrent option on the Recon is an extrapolation, not a sourced configuration. |
| Spotlight payload | "loudspeaker/spotlight payloads" | RP-3 (Year 2, Action 1) | Same DJI caveat |

No source gives a **payload mass** for any module, and no source describes a **payload swap
mechanism** (rail, bay, quick-release, hot-swap) on the Recon.

### 1.5 Fleet / sortie / economics figures (calculator inputs)

| Fact | Value | Source | Quote |
|---|---|---|---|
| Drones per vessel | 3–5 | BS-1 (Use Case 5), BS-2 (RP5) | "3–5 drones per vessel operating autonomously in coordinated search patterns" |
| Drones per hive | Up to 16 | BS-1 | "Up to 16 drones per hive" |
| Rapid recharge | 30 min (2C) | BS-1 | "30-min rapid charge (2C rate)" |
| Coverage multiplier | "3-5x Coverage Area Increase per Vessel" | BS-1 (The Opportunity) | Marketing stat tile — no absolute km²/sortie anywhere |
| Spotter plane cost | $1,500–$3,000+/hr | BS-1, BS-2 | "Manned spotter aircraft cost $1,500–$3,000+ per hour to operate" |
| Season spotting cost per quota holder | $200K–$400K | BS-1, BS-2 | "A single season can cost $200K–$400K per quota holder in spotting fees alone" |
| DaaS price (BS-1) | ~$120K/season | BS-1 | "Drone-as-a-Service at ~$120K/season delivers the same capability" |
| DaaS tiers (BS-2) | ~$110K Co-Investigator / ~$260K Lead Holder / ~$600K Full Program | BS-2 | Slide "Drones-as-a-Service: Commercial Model" |
| DaaS range (BS-2 exec summary) | "$110K–$210K research-grade alternative" | BS-2 | **Inconsistent with the tier slide ($260K/$600K) and with BS-1 ($120K).** Do not hard-code any single DaaS price. |
| Cost reduction claim | 60–70% vs manned aircraft | BS-1 | Marketing headline stat |
| AI detection accuracy | ">95% accuracy" / ">95% target accuracy (mAP)" | BS-1, BS-2 | Explicitly a **target**, not a measured result |
| Biomass estimation error | "<5% error vs. actual catch weight" | BS-1, BS-2 | Target |
| Water-quality model accuracy | "R² values exceeding 0.90 for key parameters" | RP-2 | Target |
| Bird deterrence effectiveness | "70–99% reduction in bird presence" | RP-1 (exec summary) | From third-party Australian case studies (Sensorem/CBH etc.), not AeroNation flights |
| Deterrence radius | "approximately 50–100 metres" | RP-1 (§4.2) | NSW vineyard trials, drone-generic |
| Stock-loss target | "<1% bird-related losses" | RP-1 (§7) | Rocky Point programme target |
| Rocky Point DaaS | AUD $2,000,000 / 3 years / 2 use cases | RP-2 | Slide "Executive Overview" |
| Water-quality parameters | chlorophyll-a, turbidity, total nitrogen, dissolved oxygen indicators, total phosphorus proxies | RP-2 | Slide "Water Quality Monitoring: Technical Precision" |
| SBT season | December–March, Great Australian Bight | BS-1 | Mission-context for sortie planning |

### 1.6 Colour / finish and 3D-asset references

**Nothing.** No source mentions airframe colourways, finishes, paint, livery, materials beyond
"carbon fibre props", nor any 3D model, CAD, render, or turntable asset. (BS-1/BS-2 slide exports
contain several image-only slides whose contents do not come through as text — if the decks'
images include Recon renders, they are not verifiable from this extraction; the known imagery
remains the Drive photo/PSD set listed in the build brief.)

---

## 2. Recommended configurator option schema (defensible subset)

The honest, source-backed configurator is **one airframe, a payload selector, one battery, and a
deployment/fleet context** — not a colour-and-trim car configurator.

### Group: Airframe
- **Reconnaître Recon VTOL** (single choice, fixed). Sub-copy defensible verbatim: "Fixed-wing
  VTOL · ≤7 kg MTOW · Australian-made". Do not offer variants; none exist in the sources.

### Group: Mission payload (drives spec deltas and mesh/frame swap)
Defensible choices, with confidence:
1. **EO/IR/thermal gimbal** — HIGH confidence (named on the Recon spec line itself:
   "30+ camera options (EO/IR/thermal)"). Use-case copy: school detection & species ID (RP1).
2. **Stereo-vision photogrammetry (dual camera)** — HIGH confidence (BS-1 Use Case 2, BS-2 RP2).
   Use-case copy: biomass estimation, "targets <5% error vs. catch weight".
3. **Multispectral / hyperspectral survey** — MEDIUM confidence (RP-2 water-quality use case;
   attributed to "UAVs", not the Recon by name). Use-case copy: chlorophyll-a, turbidity, TN,
   DO indicators; "target accuracy: R² > 0.90".
4. **Acoustic bird-deterrent module (loudspeaker)** — LOW confidence on this airframe. The
   deterrent programme material specifies DJI Matrice 30/30T hardware. If included, label it
   "programme capability" and keep numbers (70–99% reduction, 50–100 m radius) attributed to
   the case-study sources, or omit from the Recon configurator entirely.
5. **Current-sensing module (RP7)** — LOW confidence; a proposed research payload only.

Recommended: ship options 1–3; hold 4–5 behind a "programme roadmap" note or omit.
**No payload masses exist** — the `massKg` modifiers in `options.ts` must stay placeholder.

### Group: Energy
- **422 Wh Li-Po (6S 19000 mAh)** — single confirmed pack. Detail copy defensible verbatim:
  "2,500 charge cycles (1C) · 30-min rapid charge (2C in Hive)".
- The current `standard`/`extended` pack split has **no source basis**; either collapse to one
  choice or keep `extended` flagged placeholder.

### Group: Deployment / fleet context (feeds calculators, not geometry)
- **Single aircraft** (baseline)
- **Vessel detachment — 3–5 aircraft** (BS-1 Use Case 5 / BS-2 RP5)
- **Recon Hive — up to 16 aircraft**, solar base station, autonomous scheduled patrols, 30-min
  rapid charge (BS-1)

### Group: Avionics/comms (fixed, display-only "loadout" rows — all sourced)
- QGroundControl autopilot; NVIDIA Jetson (Orin) edge AI; 4G/LTE + Iridium backup datalink;
  collision-avoidance sensors; carbon-fibre AU 3D-printed props.

### Spec readout guidance
- **MTOW**: show "≤ 7 kg" as a ceiling. Computing MTOW as base + payload masses is not possible
  from sources (no component masses); either display the static ceiling or keep the computed
  figure flagged placeholder.
- **Endurance**: no Recon figure exists. Either display "3–16 h (VTOL class)" with explicit
  class attribution, or keep the minutes readout placeholder until the microsite calculator
  constants are confirmed. Do not present 16 h as a Recon number.
- **Range / coverage per sortie**: nothing absolute in any source (only "3-5x coverage increase
  per vessel"). Must stay placeholder / derived from microsite calculator formulas.
- **Cruise speed**: absent from all sources. Placeholder.
- Calculator constants that ARE sourced: spotter $1,500–$3,000/hr; $200K–$400K/season;
  spotter 4–6 hr max flight time; 3–5 drones/vessel; 16/hive; 30-min recharge; Dec–Mar season.
  These cover the DaaS-vs-spotter-plane economics calculator well; DaaS price itself is
  internally inconsistent ($110K / $120K / $210K / $260K / $600K across decks) — parameterise it.

---

## 3. Gaps — must remain placeholder or be confirmed elsewhere

- **Recon-specific endurance (minutes/hours)** — only the class-level "3–16 hour" claim exists.
- **Cruise speed** — no figure anywhere.
- **Range (km)** — no figure (185 km on the slide belongs to the JUMP 20-X benchmark).
- **Wingspan / dimensions** — no figure anywhere.
- **Coverage rate (km²/sortie, ha/hr)** — only the relative "3-5x" claim.
- **Payload masses and payload-vs-endurance derating** — nothing; all `PAYLOAD_MODIFIERS` and
  `ENDURANCE_MODIFIERS` values in `src/config/options.ts` remain invented.
- **Payload swap mechanism** (bay, rail, hot-swap) — never described.
- **Individual camera/sensor models for the "30+ camera options"** — none named for the Recon.
- **Battery options beyond the single 422 Wh pack** — no extended pack exists.
- **Landing-gear or airframe variants** — none.
- **Colourways / finishes** — zero references; both current colourway choices are invented.
- **3D model / CAD / turntable assets** — zero references in these five sources.
- **Recon unit price** — never stated; only DaaS subscription figures (inconsistent).
- **Microsite calculator formulas** — not in these sources; must come from the microsite codebase
  itself per the build brief.

---

## 4. Files read / failed

| # | File | fileId | Result |
|---|---|---|---|
| 1 | AeroNation Drones - BlueSight (Slides) | `1CJBEty9IFtKO1pohyHlgEyhESbaK0V17s5cqsMc4zCY` | READ OK via `mcp__Google_Drive__read_file_content` — full text export; several image-only slides export as blank (image contents unverifiable) |
| 2 | BlueSight Research Program-0202 (Slides) | `1iIRp9vFtP4KSZehkkMjCaI70-Q_tN4v1PlSraBneLvU` | READ OK — same tool; same image-slide caveat |
| 3 | AeroNation_RockyPoint_Drone_Bird_Deterrent_Proposal (2) (Doc) | `1o1-px6X0X1cBq8emvSnn4THZJ0P6TeHejHZXpdUllzA` | READ OK |
| 4 | Drones-as-a-Service for Rocky Point Aquaculture (Slides) | `1WPuavC_JPHOOiCr-_DOrsk18AbmK3nVHiruetj6OcRU` | READ OK |
| 5 | Drone Integration for Rocky Point Aquaculture (Doc) | `1_hCD1SJCvXXAAS_uDvDBKd9UuNu5Udp_WrM38t22c2U` | READ OK — Recon not mentioned; hardware named is DJI/Deep Trekker (useful as negative evidence for the deterrent-payload caveat) |

No failures. `mcp__Google_Drive__download_file_content` was not needed.
