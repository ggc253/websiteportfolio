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
    Featured/          ← 4 videos shown on the homepage
      01_best-work.txt
      02_second-best.txt
      03_third.txt
      04_fourth.txt
    Edit/              ← All your editing work
      01_project.txt
    Directing/         ← All your directing work
      01_film.txt
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
from pathlib import Path

CONTENT_DIR  = Path("content")
OUTPUT_JSON  = Path("data.json")
PHOTOS_OUT   = Path("photos")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


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

    print("\nFeatured (Homepage):")
    output["featured"] = process_video_folder(CONTENT_DIR / "Featured", "Featured")
    if len(output["featured"]) > 4:
        print(f"  ⚠  Only first 4 featured videos will show on the homepage.")
        output["featured"] = output["featured"][:4]
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

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 54)
    print(f"  ✅  data.json generated!")
    print(f"      Featured:  {len(output['featured'])} / 4 videos")
    print(f"      Edit:      {len(output['edit'])} project(s)")
    print(f"      Directing: {len(output['directing'])} project(s)")
    print(f"      Photos:    {len(output['photos'])} photo(s)")
    print()
    print("  To publish:")
    print("  git add -A && git commit -m 'Update content' && git push")
    print("=" * 54)
    print()


if __name__ == "__main__":
    main()
