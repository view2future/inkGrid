# Untracked Inventory (Local)

This repo currently has a mix of:

- **Code/docs/scripts** that should be tracked in git.
- **Local stele assets / intermediate outputs** that can be very large and are usually better kept local (or managed via git-lfs / external storage).

The list below is generated from `git status --porcelain` + `du -sh`.

## Items

| Path | Type | Size | Recommendation |
| --- | --- | --- | --- |
| `doc/workbench/` | dir | 8.0K | Track (requirements/spec) |
| `frontend/src/components/GuideAnnotator.tsx` | file | 16K | Track (source code) |
| `frontend/src/components/workbench/` | dir | 56K | Track (source code) |
| `scripts/extract_nikuanzan_chars.py` | file | 24K | Track (utility script) |
| `scripts/jiuchenggong/` | dir | 80K | Track (utility scripts) |
| `scripts/qianhouchibifu/` | dir | 44K | Track (utility scripts) |
| `steles/3-kaishu/1-jiuchenggongliquanming/` | dir | 203M | Consider local-only or git-lfs |
| `steles/3-kaishu/3-nikuanzan/` | dir | 1.6G | Consider local-only or git-lfs |
| `steles/3-kaishu/4-qianhouchibifu/` | dir | 23M | OK to track if needed |
| `steles/4-xingshu/1-lantingjixu/兰亭集序-完整.jpg` | file | 477K | OK to track if needed |
| `steles/4-xingshu/2-jizhiwengao/` | dir | 85M | Consider local-only or git-lfs |

## Suggested workflow

1) **Track code/docs/scripts first** (safe, small, and collaborative).

2) For large `steles/**` additions:
   - If they are required for day-to-day development by multiple people, use **git-lfs**.
   - If they are your personal local dataset, keep them **untracked** and document how to obtain them.

3) If you want, we can add a separate `.gitignore` section (or a `steles/.gitignore`) to prevent accidentally committing multi-GB assets.
