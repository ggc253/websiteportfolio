#!/usr/bin/env python3
"""
build.py — G.G. Cooper Portfolio Builder
=========================================

Run this any time you add, remove, or reorder content.
It reads your content/ folder and regenerates data.json.

After running:
  git add -A && git commit -m "Update content" && git push

FOLDER STRUCTURE
----------------
  content/
    Commercial/        ← the three categories the homepage opens on
      01_project.txt
    Narrative/
      01_film.txt
    Documentary/
      01_doc.txt
    (Featured/, Edit/, Directing/ are the old pages — no longer shown)
    Photos/            ← Drop .jpg / .png files here
      01_title.jpg
      01_title.txt     ← optional metadata for the photo
    about.txt          ← About page content

VIDEO .TXT FILE FORMAT
----------------------
  title: Project Title
  youtube_id: dQw4w9WgXcQ
  description: Short description of this piece.
  client: Brand or collaborator name
  year: 2024

  To find your YouTube video ID:
  Go to the video on YouTube → look at the URL:
  https://www.youtube.com/watch?v=dQw4w9WgXcQ
                                   ^^^^^^^^^^^
                               This part is the ID

PHOTO .TXT FILE FORMAT (optional, same base name as image)
----------------------------------------------------------
  title: Series Title
  description: A photo series about...
  year: 2024

ABOUT.TXT FORMAT
----------------
  quote: Your opening quote shown large.
  bio: Your biography here.
    Indent continuation lines with two spaces.
  email: gg@grahamcooper.co
  youtube: https://youtube.com/@yourchannel
  instagram: https://instagram.com/yourhandle
  vimeo: https://vimeo.com/yourprofile
"""

import json
import os
import shutil
import sys
import time
from pathlib import Path

CONTENT_DIR  = Path("content")
OUTPUT_JSON  = Path("data.json")
PHOTOS_OUT   = Path("photos")
THUMBS_OUT   = Path("thumbs")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def copy_custom_thumbnails() -> None:
    """Copy any image files sitting alongside video .txt files (in Featured/
    Edit/Directing) into thumbs/ so they can be served and referenced via a
    `thumbnail: thumbs/filename.png` line in the matching .txt file."""
    copied = []
    for folder in (CONTENT_DIR / "Commercial", CONTENT_DIR / "Narrative", CONTENT_DIR / "Documentary",
                   CONTENT_DIR / "Featured", CONTENT_DIR / "Edit", CONTENT_DIR / "Directing",
                   CONTENT_DIR / "Sinkhole", CONTENT_DIR / "Spring", CONTENT_DIR / "Creeker"):
        if not folder.exists():
            continue
        images = []
        for ext in IMAGE_EXTS:
            images.extend(folder.glob(f"*{ext}"))
            images.extend(folder.glob(f"*{ext.upper()}"))
        for img in sorted(set(images)):
            THUMBS_OUT.mkdir(exist_ok=True)
            dst = THUMBS_OUT / img.name
            # Skip unchanged files (same size) — avoids rewriting synced files
            if dst.exists() and dst.stat().st_size == img.stat().st_size:
                continue
            for attempt in range(5):
                try:
                    shutil.copy2(img, dst)
                    copied.append(img.name)
                    break
                except OSError:
                    time.sleep(1)
            else:
                print(f"  ⚠  Could not copy {img.name} (file locked) — try again")
    if copied:
        print("\nCustom thumbnails copied to thumbs/:")
        for name in copied:
            print(f"  ✓  {name}")


# ---- PARSING ----

def parse_txt(filepath: Path) -> dict:
    """Parse a key: value text file. Indented lines continue the previous value."""
    result = {}
    current_key = None
    current_lines = []

    def flush():
        if current_key is not None:
            result[current_key] = "\n".join(current_lines).strip()

    try:
        with open(filepath, encoding="utf-8") as f:
            for raw in f:
                line = raw.rstrip("\n")
                if line.startswith("#"):
                    continue
                if current_key and (line.startswith(("  ", "\t")) or line == ""):
                    current_lines.append(line.strip())
                    continue
                if ":" in line:
                    flush()
                    key, _, value = line.partition(":")
                    current_key = key.strip().lower().replace(" ", "_")
                    current_lines = [value.strip()]
        flush()
    except OSError as e:
        print(f"  ⚠  Could not read {filepath}: {e}")

    return result


def filename_to_title(stem: str) -> str:
    """'01_my-project-name' → 'My Project Name'"""
    parts = stem.split("_", 1)
    if len(parts) == 2 and parts[0].isdigit():
        stem = parts[1]
    return stem.replace("-", " ").replace("_", " ").title()


# ---- THUMBNAIL ----

def get_thumbnail(data: dict) -> str:
    """Return a thumbnail URL for a video entry."""
    if data.get("youtube_id"):
        return f"https://img.youtube.com/vi/{data['youtube_id']}/hqdefault.jpg"
    if data.get("vimeo_id"):
        return f"https://vumbnail.com/{data['vimeo_id']}.jpg"
    return ""


# ---- SECTION PROCESSORS ----

def process_video_folder(folder: Path, label: str) -> list:
    if not folder.exists():
        return []

    txt_files = sorted(folder.glob("*.txt"))
    entries = []

    for f in txt_files:
        data = parse_txt(f)
        if not data.get("title"):
            data["title"] = filename_to_title(f.stem)
        if not data.get("thumbnail"):
            data["thumbnail"] = get_thumbnail(data)
        entries.append(data)
        vid_id = data.get("youtube_id") or data.get("vimeo_id") or "—"
        print(f"  ✓  {data['title']}  (id: {vid_id})")

    return entries


def process_photos_folder(folder: Path) -> list:
    if not folder.exists():
        return []

    image_files = []
    for ext in IMAGE_EXTS:
        image_files.extend(folder.glob(f"*{ext}"))
        image_files.extend(folder.glob(f"*{ext.upper()}"))
    image_files = sorted(set(image_files))

    if not image_files:
        return []

    PHOTOS_OUT.mkdir(exist_ok=True)
    entries = []

    for img in image_files:
        dest = PHOTOS_OUT / img.name
        shutil.copy2(img, dest)
        meta_file = img.with_suffix(".txt")
        data = parse_txt(meta_file) if meta_file.exists() else {}
        if not data.get("title"):
            data["title"] = filename_to_title(img.stem)
        data["src"] = f"photos/{img.name}"
        entries.append(data)
        print(f"  ✓  {data['title']}")

    return entries


def process_about(about_file: Path) -> dict:
    if not about_file.exists():
        print("  ⚠  content/about.txt not found — using defaults.")
        return {}
    data = parse_txt(about_file)
    print(f"  ✓  About page loaded")
    return data


def youtube_id_from(value: str) -> str:
    """Accept a full YouTube link (youtu.be/…, watch?v=…) or a bare ID."""
    import re
    value = value.strip()
    m = re.search(r"(?:youtu\.be/|[?&]v=|/embed/|/shorts/)([A-Za-z0-9_-]{11})", value)
    return m.group(1) if m else value.split("?")[0]


def parse_year_lines(text: str) -> list:
    """Lines like  2022 — https://youtu.be/ID  (optionally  — thumbs/file.png)."""
    items = []
    for line in text.splitlines():
        parts = [p.strip() for p in line.replace("–", "—").split("—") if p.strip()]
        if len(parts) < 2 or not parts[0][:4].isdigit():
            continue
        t = {"year": int(parts[0][:4]), "youtube_id": youtube_id_from(parts[1])}
        if len(parts) > 2:
            t["thumbnail"] = parts[2]
        items.append(t)
        print(f"  ✓  {t['year']}  (id: {t['youtube_id']})")
    if not items:
        print("  (none yet)")
    return sorted(items, key=lambda t: t["year"])


def process_yearly(path: Path, list_key: str) -> dict:
    """A page made of one video per year (Spring trailers, Creeker Days)."""
    if not path.exists():
        return {}
    data = parse_txt(path)
    data[list_key] = parse_year_lines(data.get(list_key, ""))
    return data


def process_spring(spring_file: Path) -> dict:
    return process_yearly(spring_file, "trailers")


# ---- MAIN ----

def main():
    print()
    print("=" * 54)
    print("  G.G. COOPER — Portfolio Builder")
    print("=" * 54)

    if not CONTENT_DIR.exists():
        print("ERROR: 'content/' folder not found.")
        print("Run this script from your website folder.")
        sys.exit(1)

    output = {}

    copy_custom_thumbnails()

    # The three categories the homepage opens on
    for key, folder in (("commercial", "Commercial"), ("narrative", "Narrative"), ("documentary", "Documentary")):
        print(f"\n{folder}:")
        output[key] = process_video_folder(CONTENT_DIR / folder, folder)
        if not output[key]:
            print("  (no entries yet)")

    # Older folders (no longer shown on the site; kept until you delete them)
    print("\nFeatured (old homepage — not shown):")
    output["featured"] = process_video_folder(CONTENT_DIR / "Featured", "Featured")
    if not output["featured"]:
        print("  (no entries yet)")

    print("\nEdit:")
    output["edit"] = process_video_folder(CONTENT_DIR / "Edit", "Edit")
    if not output["edit"]:
        print("  (no entries yet)")

    print("\nDirecting:")
    output["directing"] = process_video_folder(CONTENT_DIR / "Directing", "Directing")
    if not output["directing"]:
        print("  (no entries yet)")

    print("\nPhotos:")
    output["photos"] = process_photos_folder(CONTENT_DIR / "Photos")
    if not output["photos"]:
        print("  (no photos yet — drop .jpg files into content/Photos/)")

    print("\nAbout:")
    output["about"] = process_about(CONTENT_DIR / "about.txt")

    print("\nSinkhole:")
    sinkhole_file = CONTENT_DIR / "sinkhole.txt"
    output["sinkhole"] = parse_txt(sinkhole_file) if sinkhole_file.exists() else {}
    if output["sinkhole"]:
        state = "published" if output["sinkhole"].get("published", "").lower() == "yes" else "hidden (preview only)"
        print(f"  ✓  Sinkhole page loaded — {state}")

    print("\nOne Afternoon in Spring:")
    output["spring"] = process_spring(CONTENT_DIR / "spring.txt")

    print("\nCreeker Day:")
    output["creeker"] = process_yearly(CONTENT_DIR / "creeker.txt", "videos")

    # Write to a temp file, then swap it in (avoids sync-lock errors on data.json)
    tmp = OUTPUT_JSON.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    for attempt in range(5):
        try:
            os.replace(tmp, OUTPUT_JSON)
            break
        except OSError:
            time.sleep(1)
    else:
        print("  ⚠  Could not replace data.json (file locked) — run build again")
        sys.exit(1)

    print()
    print("=" * 54)
    print(f"  ✅  data.json generated!")
    print(f"      Commercial:  {len(output['commercial'])} video(s)")
    print(f"      Narrative:   {len(output['narrative'])} video(s)")
    print(f"      Documentary: {len(output['documentary'])} video(s)")
    print()
    print("  To publish:")
    print("  git add -A && git commit -m 'Update content' && git push")
    print("=" * 54)
    print()


if __name__ == "__main__":
    main()
