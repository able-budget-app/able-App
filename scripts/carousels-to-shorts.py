#!/usr/bin/env python3
"""
Convert carousel PNG slides into vertical 1080x1920 MP4s for YouTube Shorts
(and reuse on Reels / TikTok if needed).

Reads:
  marketing-footage/social-export/carousels/{ID}_{slug}/01.png 02.png ...

Writes:
  marketing-footage/social-export/youtube-shorts/{ID}_{slug}.mp4

Each slide is shown for --duration seconds (default 3.0). Non-9:16 slides are
center-padded with black to fit the 1080x1920 frame so single + carousel formats
both work without distortion. Output includes a silent AAC audio track so
YouTube and TikTok accept the upload cleanly.

Usage:
  python3 scripts/carousels-to-shorts.py                  # everything
  python3 scripts/carousels-to-shorts.py --only C50,C100  # specific carousels
  python3 scripts/carousels-to-shorts.py --duration 2.5   # 2.5s per slide
  python3 scripts/carousels-to-shorts.py --force          # re-render existing

Requires:
  ffmpeg in PATH (already used by export-social.py + record-clips.py).

Run scripts/export-social.py --carousels first to produce the PNG slides.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAROUSELS_DIR = ROOT / "marketing-footage" / "social-export" / "carousels"
SHORTS_DIR    = ROOT / "marketing-footage" / "social-export" / "youtube-shorts"

OUT_W, OUT_H = 1080, 1920
FPS = 30


def carousel_id_from_folder(name: str) -> str:
    """Folder name format is {ID}_{slug}; ID is everything before the first underscore."""
    return name.split("_", 1)[0]


def find_carousels(only: set[str] | None) -> list[Path]:
    if not CAROUSELS_DIR.exists():
        return []
    folders = []
    for f in sorted(CAROUSELS_DIR.iterdir()):
        if not f.is_dir():
            continue
        if only and carousel_id_from_folder(f.name) not in only:
            continue
        # Has at least one PNG?
        if not list(f.glob("*.png")):
            continue
        folders.append(f)
    return folders


def slides_in(folder: Path) -> list[Path]:
    return sorted(folder.glob("*.png"))


def build_short(folder: Path, out_path: Path, duration_sec: float, force: bool) -> bool:
    """Concatenate slides into a 1080x1920 MP4. Returns True if rendered."""
    if out_path.exists() and not force:
        return False

    slides = slides_in(folder)
    if not slides:
        return False

    SHORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Build a temp concat list file. ffmpeg concat-demuxer needs:
    #   file '/abs/path/01.png'
    #   duration 3.0
    #   file '/abs/path/02.png'
    #   duration 3.0
    #   ...
    #   file '/abs/path/LAST.png'   # repeated, no duration — quirk of concat
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        for slide in slides:
            f.write(f"file '{slide.resolve()}'\n")
            f.write(f"duration {duration_sec:.3f}\n")
        # Concat demuxer requires the last file repeated without a duration.
        f.write(f"file '{slides[-1].resolve()}'\n")
        list_path = Path(f.name)

    # Video filter: scale to fit 1080x1920 keeping aspect, pad black, force 30fps.
    vf = (
        f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=decrease,"
        f"pad={OUT_W}:{OUT_H}:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"setsar=1,fps={FPS}"
    )

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(list_path),
        # Silent audio track (YouTube + TikTok prefer A/V).
        "-f", "lavfi",
        "-i", f"anullsrc=channel_layout=stereo:sample_rate=44100",
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-r", str(FPS),
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",  # cap audio to video length
        "-movflags", "+faststart",  # better streaming
        str(out_path),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        print(f"  [error] {folder.name}: {e.stderr.decode(errors='ignore')[:500]}", file=sys.stderr)
        return False
    finally:
        list_path.unlink(missing_ok=True)
    return True


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--only", default="", help="comma-separated carousel IDs (e.g. C50,C100,PC1)")
    p.add_argument("--duration", type=float, default=3.0, help="seconds per slide (default 3.0)")
    p.add_argument("--force", action="store_true", help="re-render existing MP4s")
    args = p.parse_args()

    only = set(x.strip() for x in args.only.split(",") if x.strip()) if args.only else None
    folders = find_carousels(only)
    if not folders:
        print("No carousel folders found. Run scripts/export-social.py --carousels first.", file=sys.stderr)
        return 1

    rendered = skipped = 0
    for folder in folders:
        out = SHORTS_DIR / f"{folder.name}.mp4"
        n_slides = len(slides_in(folder))
        total_sec = n_slides * args.duration
        if build_short(folder, out, args.duration, args.force):
            print(f"  [short] {out.name}  ({n_slides} slides · {total_sec:.1f}s)")
            rendered += 1
        else:
            if out.exists():
                print(f"  [skip]  {out.name}  (exists; --force to re-render)")
                skipped += 1
            else:
                print(f"  [warn]  {folder.name}: no slides found")

    print(f"\nDone. Rendered {rendered}, skipped {skipped}.")
    print(f"Output: {SHORTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
