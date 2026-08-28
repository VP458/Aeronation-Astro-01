#!/usr/bin/env bash
#
# ingest-assets.sh — pull the Reconnaître Recon reference photography from
# Google Drive onto a LOCAL machine.
#
# WHY LOCAL: the cloud (Claude Code Remote) session that authored this script
# has a network policy that blocks drive.google.com downloads entirely — only
# Drive MCP *metadata* was reachable there. Every filename/ID/byte-size in
# assets/reference/MANIFEST.md is metadata-verified, but nobody has looked at
# the pixels yet. Run this on your laptop.
#
# WHAT IT DOES:
#   1. Downloads the Drive folders (studio JPG frames, PNG mirrors, Additional/
#      frames, proposal composites) and the named single files (hero banner,
#      287 MB layered PSD master, clean render, aerials, carousel, 70 MB
#      portrait frame 8927) into assets/reference/drive/ (git-ignored).
#   2. Deletes macOS junk: `._*` resource forks (4096-byte, confirmed present)
#      and `.DS_Store`.
#   3. Dedupes by (filename, size) across the parallel Drive folders, keeping
#      the first copy — the same web assets are mirrored in 3–4 folders.
#   4. Prints an inventory (filename, bytes, sha256[0:12]) and emits one stub
#      row per image into assets/reference/CATALOGUE-TODO.csv for the visual
#      catalogue pass (azimuth / elevation / framing / background per frame).
#
# FOLLOW-UP (the actual point — ~10 minutes):
#   - Eyeball each frame (thumbnail grid) and fill the empty catalogue columns
#     in assets/reference/MANIFEST.md, using CATALOGUE-TODO.csv as the worksheet.
#   - Decide whether any frame run is a systematic turntable (constant
#     elevation, regular azimuth steps). If YES, say so loudly in MANIFEST.md —
#     it flips the Path B placeholder strategy from synthetic sequence to real
#     pseudo-turntable ordering.
#
# REQUIREMENTS:
#   python3 + gdown  (pip install gdown)
#   Files must be link-shared or otherwise fetchable by gdown; if Drive returns
#   permission errors (they're owned by emily@virtualplayground.com.au), use
#   rclone instead with an authenticated Drive remote, e.g.:
#     rclone copy "gdrive:Drone images/JPG" assets/reference/drive/drone-images-jpg
#     rclone copy "gdrive:Drone images/PNG" assets/reference/drive/drone-images-png
#     rclone copy "gdrive:Drone images/Additional" assets/reference/drive/drone-images-additional
#     rclone copy "gdrive:original proposal images" assets/reference/drive/proposal-images
#   ...then re-run this script; downloads are skipped for files already on disk
#   and the post-processing/inventory steps still run.
#   NOTE: gdown --folder caps at 50 files per folder (we pass --remaining-ok so
#   it takes the first 50 instead of aborting). proposal-images may exceed that
#   once resource forks are counted — rclone is the safe path for that folder.
#
# FLAGS:
#   --no-psd   skip the two layered PSDs (Full-Width master is 287 MB).
#
# SAFETY: set -euo pipefail; all writes and deletes are confined to
# assets/reference/ inside this repo; idempotent — re-runs skip existing
# downloads, junk-deletion and dedupe are no-ops the second time, and an
# existing CATALOGUE-TODO.csv is never overwritten (delete it to regenerate).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REF_DIR="${REPO_ROOT}/assets/reference"
DRIVE_DIR="${REF_DIR}/drive"
CSV_PATH="${REF_DIR}/CATALOGUE-TODO.csv"

NO_PSD=0
for arg in "$@"; do
  case "${arg}" in
    --no-psd) NO_PSD=1 ;;
    -h|--help) grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: ${arg} (supported: --no-psd)" >&2; exit 2 ;;
  esac
done

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found" >&2; exit 1; }
if ! command -v gdown >/dev/null 2>&1 && ! python3 -m gdown --help >/dev/null 2>&1; then
  echo "ERROR: gdown not found. Install with: python3 -m pip install gdown" >&2
  echo "(or use the rclone alternative documented in this script's header," >&2
  echo " then re-run for post-processing + inventory only)" >&2
  exit 1
fi
gdown_cmd() { if command -v gdown >/dev/null 2>&1; then gdown "$@"; else python3 -m gdown "$@"; fi; }

mkdir -p "${DRIVE_DIR}/proposal-images" \
         "${DRIVE_DIR}/drone-images-jpg" \
         "${DRIVE_DIR}/drone-images-png" \
         "${DRIVE_DIR}/drone-images-additional" \
         "${DRIVE_DIR}/singles"

# ---------------------------------------------------------------- folders ----
download_folder() {
  local folder_id="$1" dest="$2" label="$3"
  echo "==> Folder: ${label} -> ${dest}"
  # --continue skips files already fully downloaded (idempotent re-runs);
  # --remaining-ok tolerates gdown's 50-files-per-folder cap.
  if ! gdown_cmd --folder "https://drive.google.com/drive/folders/${folder_id}" \
        -O "${dest}" --continue --remaining-ok; then
    echo "WARN: gdown failed for ${label} (permissions? >50 files?)." >&2
    echo "      Fall back to rclone for this folder — see script header." >&2
  fi
}

download_folder "1qjpGDoQpRo6LC1xcHh9YH2bj8o_6NhEq" "${DRIVE_DIR}/proposal-images"          "original proposal images (composited web assets)"
download_folder "1inwHlFzVefgKW2F-zv3kyYdYv4djpjXh" "${DRIVE_DIR}/drone-images-jpg"         "Drone images / JPG (30 frames, Dec 2021 shoot)"
download_folder "1hvGHrGRzFCL13OJmApLKU-_jqTWZe3hW" "${DRIVE_DIR}/drone-images-png"         "Drone images / PNG (mirrors + unique 8872_2)"
download_folder "1k6GJavVb761gkb67JIQdJgRb6J-9pkFY" "${DRIVE_DIR}/drone-images-additional"  "Drone images / Additional (21 NEW frames 8988-9050)"

# ---------------------------------------------------------------- singles ----
download_file() {
  local file_id="$1" out_name="$2" label="$3"
  local out_path="${DRIVE_DIR}/singles/${out_name}"
  if [ -s "${out_path}" ]; then
    echo "==> Single: ${out_name} already present, skipping"
    return 0
  fi
  echo "==> Single: ${label} -> ${out_path}"
  if ! gdown_cmd "https://drive.google.com/uc?id=${file_id}" -O "${out_path}"; then
    echo "WARN: gdown failed for ${out_name} (id ${file_id}) — try rclone/manual download." >&2
    rm -f "${out_path}"
  fi
}

download_file "1hN3pZ7ShyXpH6L7jy1IH6FbqFIstZTpi" "Reconnaitre-Product-Drone-Full-Width.png" "current hero banner"
download_file "18wlC8vilHZs1-8YhbVTMihV0ScOAmKhJ" "Reconnaitre-Product-Drone.png"            "highest-res clean product render"
download_file "1lxZ8TlmezbjQ1e_3lfArWBMmh3uqhzar" "rec-drone_aerial.png"                     "in-flight composite"
download_file "1VwUjJSDtgAOq9H9pZQlXtCuRXno70OUm" "rec-drone_aerial02.png"                   "in-flight composite variant"
download_file "1qB40txRW4RhJG_5_p4GpZChKDylvpZLM" "rec-drone-carousel-desktop-01.png"        "existing carousel framing (match this crop)"
download_file "1qgBe4oQI8KnoiDHL_Vf1-dMeRROwSLsc" "Reconnaitre-Product-Portrait-Drone-Dec-2021-8927.jpg" "portrait hero frame 8927 (70 MB full-res)"

if [ "${NO_PSD}" -eq 1 ]; then
  echo "==> --no-psd: skipping layered PSDs (Full-Width master is 287 MB)"
else
  echo "==> NOTE: Reconnaitre-Product-Drone-Full-Width.psd is 287 MB. Pass --no-psd to skip PSDs."
  download_file "1V0zG-mksOsvEiIbgryL5JKb2bMZlOS3w" "Reconnaitre-Product-Drone-Full-Width.psd" "287 MB layered master (airframe/shadow/background plates)"
  download_file "1mdZTbXg4c62kyvN6aNqdpvNGJWC6HUpL" "rec-drone_aerial.psd"                     "layered aerial composite"
fi

# Not downloaded automatically: "1. Finals (1).zip" (690 MB original delivery,
# id 1i4ltAfP8GEEvWP5KFLPheLeeANrLlQDV). Pull it manually only if the folder
# exports above look lossy or incomplete.

# ---------------------------------------------- post-process: junk removal ---
echo "==> Removing macOS resource forks (._*) and .DS_Store under ${DRIVE_DIR}"
find "${DRIVE_DIR}" -name '._*' -type f -delete
find "${DRIVE_DIR}" -name '.DS_Store' -type f -delete

# -------------------------------------------------- dedupe (filename,size) ---
echo "==> Deduping by (filename, size) across parallel folders (keep first copy)"
python3 - "${DRIVE_DIR}" <<'PYEOF'
import os, sys
root = os.path.realpath(sys.argv[1])
seen = {}
removed = 0
paths = []
for dirpath, _dirs, files in os.walk(root):
    for name in files:
        paths.append(os.path.join(dirpath, name))
for path in sorted(paths):  # deterministic: keep lexicographically-first copy
    real = os.path.realpath(path)
    if not real.startswith(root + os.sep):
        continue  # never touch anything outside assets/reference/drive/
    key = (os.path.basename(real), os.path.getsize(real))
    if key in seen:
        os.remove(real)
        removed += 1
        print(f"  dup removed: {os.path.relpath(real, root)} (kept {os.path.relpath(seen[key], root)})")
    else:
        seen[key] = real
print(f"  dedupe done: {removed} duplicate(s) removed, {len(seen)} unique file(s) kept")
PYEOF

# --------------------------------------------- inventory + catalogue stubs ---
echo "==> Inventory + catalogue stubs"
python3 - "${DRIVE_DIR}" "${CSV_PATH}" <<'PYEOF'
import csv, hashlib, os, sys
root, csv_path = os.path.realpath(sys.argv[1]), sys.argv[2]
IMG_EXT = {".jpg", ".jpeg", ".png"}

rows = []
for dirpath, _dirs, files in os.walk(root):
    for name in files:
        path = os.path.join(dirpath, name)
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        rows.append((os.path.relpath(path, root), os.path.getsize(path), h.hexdigest()[:12]))

rows.sort()
w = max((len(r[0]) for r in rows), default=8)
print(f"\n  {'file':<{w}}  {'bytes':>12}  sha256[:12]")
for rel, size, digest in rows:
    print(f"  {rel:<{w}}  {size:>12}  {digest}")
print(f"  total: {len(rows)} file(s)")

if os.path.exists(csv_path):
    print(f"\n  {csv_path} already exists — NOT overwriting (delete it to regenerate).")
else:
    img_rows = [r for r in rows if os.path.splitext(r[0])[1].lower() in IMG_EXT]
    with open(csv_path, "w", newline="") as f:
        wcsv = csv.writer(f)
        wcsv.writerow(["relpath", "filename", "bytes", "sha256_12",
                       "azimuth_deg", "elevation_deg",
                       "framing(full/detail/portrait)", "background", "notes"])
        for rel, size, digest in img_rows:
            wcsv.writerow([rel, os.path.basename(rel), size, digest, "", "", "", "", ""])
    print(f"\n  wrote {len(img_rows)} stub row(s) to {csv_path}")
    print("  -> fill azimuth/elevation/framing/background while eyeballing each frame,")
    print("     then copy the values into assets/reference/MANIFEST.md and decide:")
    print("     systematic turntable subset or not (MANIFEST.md section 6 — be loud).")
PYEOF

echo "==> Done. Next: the visual catalogue pass (see MANIFEST.md section 7)."
