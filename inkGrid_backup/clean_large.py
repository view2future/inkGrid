#!/usr/bin/env python3
# clean_large.py — Ignore and untrack files > 30MB
import os
import sys
import subprocess
import pathlib

THRESHOLD = 30 * 1024 * 1024  # 30 MB in bytes
GITIGNORE = ".gitignore"
repo_root = pathlib.Path(__file__).parent.resolve()

# Step 1: Get all tracked files
try:
    result = subprocess.run(
        ["git", "ls-files"], cwd=repo_root, text=True, capture_output=True, check=True
    )
    tracked_files = result.stdout.strip().splitlines()
except Exception as e:
    print(f"❌ Error getting tracked files: {e}", file=sys.stderr)
    sys.exit(1)

large_files = []
for rel_path in tracked_files:
    full_path = repo_root / rel_path
    if full_path.is_file():
        try:
            size = full_path.stat().st_size
            if size > THRESHOLD:
                large_files.append(rel_path)
        except OSError:
            continue

if not large_files:
    print("✅ No tracked files > 30MB found.")
    sys.exit(0)

print(f"🔍 Found {len(large_files)} tracked files > 30MB:")
for f in large_files:
    size_mb = os.path.getsize(repo_root / f) / (1024 * 1024)
    print(f"  {f} ({size_mb:.2f} MB)")

# Step 2: Append to .gitignore (avoid duplicates)
gitignore_lines = set()
if os.path.exists(GITIGNORE):
    with open(GITIGNORE, "r") as f:
        gitignore_lines = {line.strip() for line in f}

# Add entries: exact path + !path (to override any prior !rules)
new_entries = set()
for f in large_files:
    new_entries.add(f)           # ignore the file
    new_entries.add(f"!{f}")     # ensure no !rule overrides it later

gitignore_lines.update(new_entries)

with open(GITIGNORE, "w") as f:
    f.write("\n".join(sorted(gitignore_lines)) + "\n")

print(f"✅ Updated {GITIGNORE} with {len(new_entries)} entries.")

# Step 3: git rm --cached
if large_files:
    try:
        subprocess.run(
            ["git", "rm", "-r", "--cached"] + large_files,
            cwd=repo_root,
            check=True,
            text=True,
            capture_output=True
        )
        print(f"✅ Removed {len(large_files)} files from Git index.")
    except subprocess.CalledProcessError as e:
        print(f"❌ git rm failed: {e.stderr}", file=sys.stderr)
        sys.exit(1)

print("\n🎉 Cleanup complete. Run:")
print("  git status")
print("  git commit -m 'chore: ignore files > 30MB'")
print("  git push origin main")