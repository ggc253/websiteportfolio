#!/usr/bin/env python3
"""
build.py — G.G. Cooper Portfolio Builder
=========================================

Run this script any time you add, remove, or reorder projects.
It reads your content/ folder and regenerates data.json.

After running, commit and push to GitHub — your site updates automatically.

USAGE
-----
  python build.py

FOLDER STRUCTURE
----------------
  content/
    Edit/
      01_project-name.txt      ← video entry (number prefix = order)
      02_another-project.txt
    Directing/
      01_film-title.txt
    Photos/
      01_photo-title.jpg       ← image file (jpg, jpeg, png, webp)
      01_photo-title.txt       ← optional metadata for that photo
    about.txt                  ← about page content

VIDEO .TXT FORMAT
-----------------
  title: My Project Title
  vimeo_id: 123456789
  description: A short description of this piece.
  client: Brand or Director Name
  year: 2024

PHOTO .TXT FORMAT (optional, same base name as the image)
-----------------
  title: Series Title
  description: A photo series about something.
  year: 2024

ABOUT.TXT FORMAT
----------------
  quote: The opening quote shown large at the top.
  bio: Your biography. Can span multiple lines —
    just indent continuation lines with two spaces.
  email: gg@grahamcooper.co
  vimeo: https://vimeo.com/yourprofile
  youtube: https://youtube.com/@yourchannel
  instagram: https://instagram.com/yourhandle
"""

import json
import os
import shutil
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ---- CONFIGURATION ----

CONTENT_DIR   = Path("content")
OUTPUT_JSON   = Path("data.json")
PHOTOS_OUT    = Path("photos")          # Where photo images are copied for the web
FETCH_THUMBS  = True                    # Set False to skip Vimeo thumbnail fetching

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


# ---- PARSING ----

def parse_txt(filepath: Path) -> dict:
    """
    Parse a simple key: value file.
    Multi-line values are supported by indenting continuation lines with spaces.

      bio: First line
        continuation of bio on second line
        third line
    """
    result = {}
    current_key = None
    current_lines = []

    def flush():
        if current_key is not None:
            result[current_key] = "\n".join(current_lines).strip()

    try:
        with open(filepath, encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.rstrip("\n")

                # Lines starting with spaces/tabs are continuations
                if current_key and (line.startswith(("  ", "\t")) or line == ""):
                    current_lines.append(line.strip())
                    continue

                # New key: value pair
                if ":" in line:
                    flush()
                    key, _, value = line.partition(":")
                    current_key = key.strip().lower()
                    current_lines = [value.strip()]
                # Lines starting with # are comments
                elif line.startswith("#"):
                    continue

        flush()
    except OSError as e:
        print(f"  ⚠  Could not read {filepath}: {e}")

    return result


def filename_to_title(stem: str) -> str:
    """Convert a filename stem like '01_my-project-name' to 'My Project Name'."""
    # Strip leading number prefix (e.g. "01_" or "1-")
    parts = stem.split("_", 1)
    if len(parts) == 2 and parts[0].isdigit():
        stem = parts[1]
    else:
        parts = stem.split("-", 1)
        if len(parts) == 2 and parts[0].isdigit():
            stem = parts[1]

    return stem.replace("-", " ").replace("_", " ").title()


# ---- VIMEO THUMBNAILS ----

_thumb_cache = {}

def fetch_vimeo_thumbnail(vimeo_id: str) -> str:
    """
    Fetch the thumbnail URL for a Vimeo video via the oEmbed API.
    Falls back to vumbnail.com if the API is unavailable.
    """
    if not vimeo_id or not FETCH_THUMBS:
        return ""

    if vimeo_id in _thumb_cache:
        return _thumb_cache[vimeo_id]

    fallback = f"https://vumbnail.com/{vimeo_id}.jpg"
    try:
        url = f"https://vimeo.com/api/oembed.json?url=https://vimeo.com/{vimeo_id}&width=800"
        req = urllib.request.Request(url, headers={"User-Agent": "portfolio-builder/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
            thumb = data.get("thumbnail_url", fallback)
            # Upgrade to a larger thumbnail if possible
            thumb = thumb.replace("_295x166", "_640x360").replace("_100x75", "_640x360")
            _thumb_cache[vimeo_id] = thumb
            return thumb
    except Exception as e:
        print(f"    Could not fetch thumbnail for {vimeo_id}: {e}")
        _thumb_cache[vimeo_id] = fallback
        return fallback


# ---- SECTION PROCESSORS ----

def process_video_folder(folder: Path) -> list:
    """Read all .txt files from a folder, sorted by filename."""
    if not folder.exists():
        return []

    txt_files = sorted(folder.glob("*.txt"))
    entries = []

    for txt_file in txt_files:
        data = parse_txt(txt_file)

        # Fall back to filename-derived title
        if not data.get("title"):
            data["title"] = filename_to_title(txt_file.stem)

        # Fetch thumbnail
        vimeo_id = data.get("vimeo_id", "").strip()
        if vimeo_id:
            print(f"    Fetching thumbnail for '{data['title']}' ({vimeo_id})…", end=" ", flush=True)
            data["thumbnail"] = fetch_vimeo_thumbnail(vimeo_id)
            print("done" if data["thumbnail"] else "skipped")
        else:
            data["thumbnail"] = ""

        entries.append(data)
        print(f"  ✓  {data['title']}")

    return entries


def process_photos_folder(folder: Path) -> list:
    """
    Read image files from folder (sorted by filename).
    For each image, look for a matching .txt file with metadata.
    Copies images into the photos/ output directory.
    """
    if not folder.exists():
        return []

    # Collect all image files
    image_files = []
    for ext in IMAGE_EXTS:
        image_files.extend(folder.glob(f"*{ext}"))
        image_files.extend(folder.glob(f"*{ext.upper()}"))
    image_files = sorted(set(image_files))

    if not image_files:
        return []

    # Ensure output directory exists
    PHOTOS_OUT.mkdir(exist_ok=True)

    entries = []
    for img in image_files:
        # Copy to web-accessible location
        dest = PHOTOS_OUT / img.name
        shutil.copy2(img, dest)

        # Load metadata if available
        meta_file = img.with_suffix(".txt")
        data = parse_txt(meta_file) if meta_file.exists() else {}

        if not data.get("title"):
            data["title"] = filename_to_title(img.stem)

        data["src"] = f"photos/{img.name}"
        entries.append(data)
        print(f"  ✓  {data['title']}  →  {dest}")

    return entries


def process_about(about_file: Path) -> dict:
    if not about_file.exists():
        print("  ⚠  content/about.txt not found — using empty defaults.")
        return {}
    data = parse_txt(about_file)
    print(f"  ✓  About page loaded")
    return data


# ---- MAIN ----

def main():
    print()
    print("=" * 52)
    print("  G.G. COOPER — Portfolio Builder")
    print("=" * 52)
    print()

    # Make sure we're running from the right directory
    if not CONTENT_DIR.exists():
        print("ERROR: 'content/' folder not found.")
        print("Make sure you're running this script from your website folder.")
        sys.exit(1)

    output = {}

    print("Edit:")
    output["edit"] = process_video_folder(CONTENT_DIR / "Edit")
    if not output["edit"]:
        print("  (no entries)")

    print()
    print("Directing:")
    output["directing"] = process_video_folder(CONTENT_DIR / "Directing")
    if not output["directing"]:
        print("  (no entries)")

    print()
    print("Photos:")
    output["photos"] = process_photos_folder(CONTENT_DIR / "Photos")
    if not output["photos"]:
        print("  (no photos — drop .jpg files into content/Photos/ to add them)")

    print()
    print("About:")
    output["about"] = process_about(CONTENT_DIR / "about.txt")

    # Write output
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 52)
    print(f"  ✅  data.json generated!")
    print(f"      Edit:      {len(output['edit'])} project(s)")
    print(f"      Directing: {len(output['directing'])} project(s)")
    print(f"      Photos:    {len(output['photos'])} photo(s)")
    print()
    print("  Next steps:")
    print("  1. Review data.json to make sure everything looks right")
    print("  2. git add -A && git commit -m 'Update content'")
    print("  3. git push  →  your site updates automatically!")
    print("=" * 52)
    print()


if __name__ == "__main__":
    main()
