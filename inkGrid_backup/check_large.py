#!/usr/bin/env python3
import os
import pathlib

THRESHOLD = 30 * 1024 * 1024  # 30 MB
roots = [
    "processor/venv",
    "backend/models"
]

found = []
for root in roots:
    p = pathlib.Path(root)
    if not p.exists():
        continue
    for f in p.rglob("*"):
        if f.is_file():
            try:
                sz = f.stat().st_size
                if sz > THRESHOLD:
                    mb = sz / (1024*1024)
                    found.append(f"{f} ({mb:.2f} MB)")
            except OSError:
                pass

if found:
    print("⚠️  Local files >30MB found (should NOT be in git):")
    for line in found:
        print(f"  {line}")
else:
    print("✅ No local files >30MB found under processor/venv/ or backend/models/")