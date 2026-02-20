from __future__ import annotations

import json
import os
import re
import threading
import time
import zipfile
from html.parser import HTMLParser
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import subprocess
from pypinyin import lazy_pinyin
import httpx


def _slugify_pinyin(name: str) -> str:
    raw = "".join(lazy_pinyin(str(name or "").strip()))
    raw = raw.lower().strip()
    out = []
    prev_dash = False
    for ch in raw:
        ok = ("a" <= ch <= "z") or ("0" <= ch <= "9")
        if ok:
            out.append(ch)
            prev_dash = False
            continue
        if not prev_dash:
            out.append("-")
            prev_dash = True
    slug = "".join(out).strip("-")
    return slug or "stele"


@dataclass(frozen=True)
class ProjectPaths:
    stele_dir: Path
    pages_raw_dir: Path
    workbench_dir: Path
    project_json: Path
    pages_json: Path
    alignment_json: Path
    jobs_dir: Path


class WorkbenchService:
    def __init__(self, base_dir: str, steles_dir: str, *, workbench_root: str | None = None):
        self.base_dir = Path(base_dir)
        self.steles_dir = Path(steles_dir)

        # Prefer external workbench root (keeps repo clean).
        # Layout:
        #   <root>/projects/<slug>/{pages_raw,workbench,datasets}
        # Fallback (legacy): <steles_dir>/unknown/<slug>
        env_root = str(workbench_root or os.environ.get("INKGRID_WORKBENCH_ROOT") or "").strip()
        if env_root:
            self.workbench_root = Path(env_root).expanduser().resolve()
            self.projects_root = (self.workbench_root / "projects").resolve()
        else:
            # Backward compatible default.
            self.workbench_root = self.steles_dir.resolve()
            self.projects_root = (self.steles_dir / "unknown").resolve()

        self.search_endpoint = str(os.environ.get("INKGRID_SEARCH_ENDPOINT") or "").strip()

    def _http_client(self) -> httpx.Client:
        return httpx.Client(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
            },
        )

    def _baidu_search(self, query: str) -> list[dict]:
        """Best-effort HTML scraping for Baidu search results.

        Returns a list of {title,url,snippet}.
        """

        q = str(query or "").strip()
        if not q:
            return []

        url = "https://www.baidu.com/s"
        with self._http_client() as client:
            r = client.get(url, params={"wd": q})
            r.raise_for_status()
            html = r.text

        # Extremely lightweight extraction.
        # Prefer direct http(s) links in the HTML.
        blocks = re.split(r"<div[^>]+class=\"result\"", html)
        out: list[dict] = []
        for b in blocks[1:]:
            if len(out) >= 15:
                break
            m = re.search(r"<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)</a>", b, flags=re.S)
            if not m:
                continue
            href = m.group(1)
            title_html = m.group(2)
            title = re.sub(r"<[^>]+>", "", title_html)
            title = re.sub(r"\s+", " ", title).strip()

            # Snippet often in <div class="c-abstract">...
            sm = re.search(r"c-abstract[^>]*>(.*?)</div>", b, flags=re.S)
            snippet = ""
            if sm:
                snippet = re.sub(r"<[^>]+>", "", sm.group(1))
                snippet = re.sub(r"\s+", " ", snippet).strip()

            if not href:
                continue
            if href.startswith("/"):
                href = "https://www.baidu.com" + href
            out.append({"title": title, "url": href, "snippet": snippet})

        return out

    class _TextExtractor(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self._buf: list[str] = []
            self._skip_depth = 0

        def handle_starttag(self, tag: str, attrs) -> None:  # type: ignore[override]
            if tag in {"script", "style", "noscript"}:
                self._skip_depth += 1

        def handle_endtag(self, tag: str) -> None:  # type: ignore[override]
            if tag in {"script", "style", "noscript"} and self._skip_depth > 0:
                self._skip_depth -= 1

        def handle_data(self, data: str) -> None:
            if not data:
                return
            if self._skip_depth > 0:
                return
            self._buf.append(data)

        def text(self) -> str:
            return "\n".join(self._buf)

    def _extract_text_from_html(self, html: str) -> str:
        p = self._TextExtractor()
        try:
            p.feed(html)
        except Exception:
            pass
        raw = p.text()
        raw = raw.replace("\u00a0", " ")
        raw = re.sub(r"\r", "\n", raw)
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        raw = raw.strip()
        return raw

    def _normalize_chinese_text(self, text: str) -> str:
        # Keep mostly CJK + common punctuation, collapse whitespace.
        t = str(text or "")
        t = re.sub(r"[\t ]+", " ", t)
        t = re.sub(r"\n{3,}", "\n\n", t)
        t = t.strip()
        return t

    def _filter_cjk_chars(self, text: str) -> str:
        """Keep only CJK ideographs (best-effort).

        This is intentionally conservative for V1: it helps convert noisy web page
        extractions into a sequence that can be aligned to a fixed grid.
        """

        t = str(text or "")
        # Unified ideographs + Ext-A + compatibility.
        chars = re.findall(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]", t)
        return "".join(chars)

    def _compute_total_cells(self, stele_slug: str) -> int:
        paths = self._resolve_project_dir(stele_slug)
        if not paths.project_json.exists():
            raise FileNotFoundError("Missing project.json")

        project = json.loads(paths.project_json.read_text(encoding="utf-8"))
        grid = project.get("grid") or {}
        default_cols = int(grid.get("cols") or 0)
        default_rows = int(grid.get("rows") or 0)
        if default_cols <= 0 or default_rows <= 0:
            raise ValueError("Invalid default grid")

        pages = {"pages": []}
        if paths.pages_json.exists():
            try:
                pages = json.loads(paths.pages_json.read_text(encoding="utf-8"))
            except Exception:
                pages = {"pages": []}

        total = 0
        for p in pages.get("pages") or []:
            override = (p or {}).get("override") if isinstance(p, dict) else None
            cols = int((override or {}).get("cols") or default_cols)
            rows = int((override or {}).get("rows") or default_rows)
            if cols <= 0 or rows <= 0:
                cols, rows = default_cols, default_rows
            total += int(cols * rows)
        return int(total)

    def _fetch_page_text(self, url: str) -> str:
        u = str(url or "").strip()
        if not u:
            return ""
        with self._http_client() as client:
            r = client.get(u)
            r.raise_for_status()
            html = r.text
        text = self._extract_text_from_html(html)
        return self._normalize_chinese_text(text)

    def _resolve_project_dir(self, stele_slug: str) -> ProjectPaths:
        slug = str(stele_slug or "").strip().lstrip("/")
        if not slug:
            raise ValueError("Empty stele_slug")

        stele_dir = (self.projects_root / slug).resolve()
        if not str(stele_dir).startswith(str(self.projects_root.resolve()) + os.sep):
            raise ValueError("Invalid stele_slug")

        pages_raw_dir = stele_dir / "pages_raw"
        workbench_dir = stele_dir / "workbench"
        return ProjectPaths(
            stele_dir=stele_dir,
            pages_raw_dir=pages_raw_dir,
            workbench_dir=workbench_dir,
            project_json=workbench_dir / "project.json",
            pages_json=workbench_dir / "pages.json",
            alignment_json=workbench_dir / "alignment.json",
            jobs_dir=workbench_dir / "jobs",
        )

    def list_projects(self) -> Dict[str, Any]:
        base = self.projects_root
        out: list[dict] = []
        if not base.exists():
            return {"projects": []}

        for p in sorted(base.iterdir()):
            if not p.is_dir():
                continue
            proj = p / "workbench" / "project.json"
            if not proj.exists():
                continue
            try:
                data = json.loads(proj.read_text(encoding="utf-8"))
            except Exception:
                continue
            out.append(
                {
                    "slug": p.name,
                    "name": data.get("name"),
                    "direction": data.get("direction"),
                    "grid": data.get("grid"),
                    "latest_dataset": data.get("latest_dataset"),
                    "created_at": data.get("created_at"),
                }
            )
        return {"projects": out}

    def get_project(self, stele_slug: str) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        if not paths.project_json.exists():
            raise FileNotFoundError("Missing project.json")

        project = json.loads(paths.project_json.read_text(encoding="utf-8"))

        pages = {"version": 1, "pages": []}
        if paths.pages_json.exists():
            try:
                pages = json.loads(paths.pages_json.read_text(encoding="utf-8"))
            except Exception:
                pages = {"version": 1, "pages": []}

        datasets_dir = (paths.stele_dir / "datasets").resolve()
        datasets = []
        if datasets_dir.exists():
            for p in datasets_dir.iterdir():
                if p.is_dir() and (p / "index.json").exists():
                    datasets.append(p.name)
        datasets.sort()

        jobs = []
        if paths.jobs_dir.exists():
            for p in sorted(paths.jobs_dir.glob("*.json"), key=lambda x: x.name, reverse=True):
                try:
                    jobs.append(json.loads(p.read_text(encoding="utf-8")))
                except Exception:
                    continue

        return {
            "project": project,
            "pages": pages.get("pages") or [],
            "datasets": datasets,
            "jobs": jobs,
        }

    def update_project(self, stele_slug: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        if not paths.project_json.exists():
            raise FileNotFoundError("Missing project.json")

        project = json.loads(paths.project_json.read_text(encoding="utf-8"))
        if "direction" in payload:
            project["direction"] = str(payload.get("direction") or "").strip() or project.get(
                "direction"
            )
        if "grid" in payload and isinstance(payload.get("grid"), dict):
            g = payload.get("grid") or {}
            cols = int(g.get("cols") or 0)
            rows = int(g.get("rows") or 0)
            if cols > 0 and rows > 0:
                project["grid"] = {"cols": cols, "rows": rows}

        if "models" in payload and isinstance(payload.get("models"), dict):
            m = payload.get("models") or {}
            project.setdefault("models", {})
            if isinstance(project.get("models"), dict):
                for k in ("detector_best", "classifier_best", "classifier_classes_json"):
                    if k in m:
                        v = m.get(k)
                        project["models"][k] = (str(v).strip() if v is not None else None) or None
        project["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        paths.project_json.write_text(
            json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return {"project": project}

    def create_project(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValueError("Missing project name")

        direction = str(payload.get("direction") or "vertical_rtl").strip()
        grid_cols = int(payload.get("grid_cols") or 0)
        grid_rows = int(payload.get("grid_rows") or 0)
        if grid_cols <= 0 or grid_rows <= 0:
            raise ValueError("grid_cols and grid_rows must be > 0")

        slug = str(payload.get("slug") or "").strip()
        if not slug:
            slug = _slugify_pinyin(name)

        paths = self._resolve_project_dir(slug)
        paths.workbench_dir.mkdir(parents=True, exist_ok=True)
        paths.pages_raw_dir.mkdir(parents=True, exist_ok=True)
        paths.jobs_dir.mkdir(parents=True, exist_ok=True)

        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        project = {
            "version": 1,
            "name": name,
            "slug": slug,
            "script_type": "unknown",
            "direction": direction,
            "grid": {"cols": grid_cols, "rows": grid_rows},
            "created_at": now,
            "latest_dataset": None,
            "models": {
                "detector_best": None,
                "classifier_best": None,
                "classifier_classes_json": None,
            },
            "text": {
                "status": "unknown",
                "selected_source_url": None,
                "confidence": None,
            },
        }
        paths.project_json.write_text(
            json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        if not paths.pages_json.exists():
            paths.pages_json.write_text(
                json.dumps({"version": 1, "pages": []}, ensure_ascii=False, indent=2)
                + "\n",
                encoding="utf-8",
            )
        if not paths.alignment_json.exists():
            paths.alignment_json.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "text_trad": "",
                        "text_simp": "",
                        "cells": [],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

        return {"project": project}

    def get_alignment(self, stele_slug: str) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        if not paths.alignment_json.exists():
            return {"version": 1, "text_trad": "", "text_simp": "", "cells": []}
        return json.loads(paths.alignment_json.read_text(encoding="utf-8"))

    def fetch_text_candidates(self, stele_slug: str) -> Dict[str, Any]:
        """Fetch text candidates by stele name using a configurable search endpoint.

        Env:
        - INKGRID_SEARCH_ENDPOINT: HTTP endpoint that accepts `q` and returns JSON.

        Expected response (flexible):
        - {"results": [{"title":..., "url":..., "snippet":...}, ...]}
        - or {"items": [...]} / list[...] (best-effort)
        """

        paths = self._resolve_project_dir(stele_slug)
        if not paths.project_json.exists():
            raise FileNotFoundError("Missing project.json")
        project = json.loads(paths.project_json.read_text(encoding="utf-8"))
        name = str(project.get("name") or "").strip()
        if not name:
            raise ValueError("Missing project name")

        cleaned: list[dict] = []

        if self.search_endpoint:
            with self._http_client() as client:
                r = client.get(self.search_endpoint, params={"q": name})
                r.raise_for_status()
                data = r.json()

            results = []
            if isinstance(data, dict):
                raw = data.get("results") or data.get("items") or data.get("data")
                if isinstance(raw, list):
                    results = raw
            elif isinstance(data, list):
                results = data

            for it in results[:25]:
                if not isinstance(it, dict):
                    continue
                url = str(it.get("url") or it.get("link") or "").strip()
                title = str(it.get("title") or it.get("name") or "").strip()
                snippet = str(it.get("snippet") or it.get("desc") or it.get("summary") or "").strip()
                if not url and not title and not snippet:
                    continue
                cleaned.append({"title": title, "url": url, "snippet": snippet})
        else:
            cleaned = self._baidu_search(name)

        # Fetch best-effort page text for the top candidates.
        for it in cleaned[:3]:
            url = str(it.get("url") or "").strip()
            if not url:
                continue
            try:
                it["text_trad"] = self._fetch_page_text(url)[:20000]
            except Exception:
                it["text_trad"] = ""

        out = {
            "version": 1,
            "query": name,
            "endpoint": self.search_endpoint or "baidu",
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "results": cleaned,
        }
        (paths.workbench_dir / "text_candidates.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return out

    def save_alignment_text(self, stele_slug: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        paths.workbench_dir.mkdir(parents=True, exist_ok=True)

        text_trad_raw = str(payload.get("text_trad") or "")
        text_trad = self._filter_cjk_chars(text_trad_raw)
        text_simp = str(payload.get("text_simp") or "")
        out = {
            "version": 1,
            "text_trad_raw": text_trad_raw,
            "text_trad": text_trad,
            "text_simp": text_simp,
            "cells": payload.get("cells") or [],
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        paths.alignment_json.write_text(
            json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return out

    def add_pages(self, stele_slug: str, filenames: list[str]) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        paths.pages_raw_dir.mkdir(parents=True, exist_ok=True)
        paths.workbench_dir.mkdir(parents=True, exist_ok=True)

        pages_path = paths.pages_json
        pages = {"version": 1, "pages": []}
        if pages_path.exists():
            try:
                pages = json.loads(pages_path.read_text(encoding="utf-8"))
            except Exception:
                pages = {"version": 1, "pages": []}

        cur = list(pages.get("pages") or [])
        for fn in filenames:
            cur.append(
                {
                    "image": fn,
                    "override": None,
                    "layout": None,
                }
            )
        pages["pages"] = cur
        pages_path.write_text(
            json.dumps(pages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return {"pages": cur}

    def delete_page(self, stele_slug: str, image_name: str) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        name = str(image_name or "").strip()
        if not name:
            raise ValueError("Empty page name")

        img_path = (paths.pages_raw_dir / name).resolve()
        if not str(img_path).startswith(str(paths.pages_raw_dir.resolve()) + os.sep):
            raise ValueError("Invalid page name")
        if img_path.exists():
            img_path.unlink()

        pages = {"version": 1, "pages": []}
        if paths.pages_json.exists():
            try:
                pages = json.loads(paths.pages_json.read_text(encoding="utf-8"))
            except Exception:
                pages = {"version": 1, "pages": []}
        kept = [p for p in (pages.get("pages") or []) if str((p or {}).get("image")) != name]
        pages["pages"] = kept
        paths.pages_json.write_text(
            json.dumps(pages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return {"pages": kept}

    def update_pages(self, stele_slug: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Update page order and per-page overrides.

        Payload:
        - pages: list of page entries with {image, override?}
        """

        paths = self._resolve_project_dir(stele_slug)
        pages_path = paths.pages_json
        cur = {"version": 1, "pages": []}
        if pages_path.exists():
            try:
                cur = json.loads(pages_path.read_text(encoding="utf-8"))
            except Exception:
                cur = {"version": 1, "pages": []}

        incoming = payload.get("pages")
        if not isinstance(incoming, list):
            raise ValueError("pages must be a list")

        # Only allow images that exist in pages_raw.
        existing = {p.name for p in paths.pages_raw_dir.iterdir() if p.is_file()}
        out_pages: list[dict] = []
        for e in incoming:
            if not isinstance(e, dict):
                continue
            img = str(e.get("image") or "").strip()
            if not img or img not in existing:
                continue
            override = e.get("override")
            if override is not None and not isinstance(override, dict):
                override = None

            layout = e.get("layout")
            if layout is not None and not isinstance(layout, dict):
                layout = None

            out_pages.append({"image": img, "override": override, "layout": layout})

        # Append any existing pages not mentioned.
        mentioned = {p["image"] for p in out_pages}
        for img in sorted(existing):
            if img in mentioned:
                continue
            out_pages.append({"image": img, "override": None, "layout": None})

        cur["pages"] = out_pages
        pages_path.write_text(
            json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return {"pages": out_pages}

    def _next_dataset_dir(self, paths: ProjectPaths, prefix: str = "chars_workbench") -> str:
        base = (paths.stele_dir / "datasets").resolve()
        base.mkdir(parents=True, exist_ok=True)
        existing = []
        for p in base.iterdir():
            if not p.is_dir():
                continue
            name = p.name
            if not name.startswith(prefix + "_v"):
                continue
            try:
                v = int(name.split("_v", 1)[1])
            except Exception:
                continue
            existing.append(v)
        nxt = (max(existing) + 1) if existing else 1
        return f"{prefix}_v{nxt}"

    def create_job(self, stele_slug: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_type = str(payload.get("type") or "").strip()
        if job_type not in {
            "auto_annotate",
            "export_dataset",
            "preview_page",
            "ml_refine_dataset",
            "ml_align_and_split",
            "apply_crop_overrides",
        }:
            raise ValueError("Unsupported job type")

        paths = self._resolve_project_dir(stele_slug)
        if not paths.project_json.exists():
            raise FileNotFoundError("Missing project.json")

        project = json.loads(paths.project_json.read_text(encoding="utf-8"))
        grid = project.get("grid") or {}
        cols = int(grid.get("cols") or 0)
        rows = int(grid.get("rows") or 0)
        direction = str(project.get("direction") or "vertical_rtl")
        if cols <= 0 or rows <= 0:
            raise ValueError("Invalid grid in project.json")

        if job_type == "preview_page":
            page_image = str(payload.get("page") or "").strip()
            if not page_image:
                raise ValueError("Missing page image for preview_page")
            dataset_dir = "workbench_preview"
            out_dir = (paths.workbench_dir / "preview" / page_image).resolve()
            out_dir.mkdir(parents=True, exist_ok=True)
        elif job_type == "apply_crop_overrides":
            ds = str(payload.get("dataset_dir") or "").strip()
            if not ds:
                raise ValueError("Missing dataset_dir for apply_crop_overrides")
            dataset_dir = ds
            out_dir = (paths.stele_dir / "datasets" / ds).resolve()
            if not out_dir.exists():
                raise FileNotFoundError("Dataset dir not found")
        else:
            dataset_dir = self._next_dataset_dir(paths)
            out_dir = (paths.stele_dir / "datasets" / dataset_dir).resolve()
            out_dir.mkdir(parents=True, exist_ok=True)

        job_id = time.strftime("%Y%m%d_%H%M%S")
        job_path = paths.jobs_dir / f"{job_id}.json"
        job = {
            "id": job_id,
            "type": job_type,
            "status": "queued",
            "stage": "queued",
            "progress": 0,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "stele_slug": stele_slug,
            "outputs": {
                "dataset_dir": dataset_dir,
                "dataset_path": str(out_dir),
                "zip_path": None,
                "zip_url": None,
            },
            "log_tail": "",
        }
        job_path.write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        def run() -> None:
            try:
                if job_type == "preview_page":
                    self._run_job_preview_page(
                        stele_slug,
                        job_path=job_path,
                        out_dir=out_dir,
                        page=str(payload.get("page") or ""),
                        cols=cols,
                        rows=rows,
                        direction=direction,
                    )
                elif job_type in {"auto_annotate", "export_dataset"}:
                    self._run_job_build_dataset(
                        stele_slug,
                        job_path=job_path,
                        out_dir=out_dir,
                        cols=cols,
                        rows=rows,
                        direction=direction,
                    )
                elif job_type == "ml_refine_dataset":
                    self._run_job_ml_refine_dataset(
                        stele_slug,
                        job_path=job_path,
                        out_dir=out_dir,
                        cols=cols,
                        rows=rows,
                        direction=direction,
                        payload=payload,
                    )
                elif job_type == "ml_align_and_split":
                    self._run_job_ml_align_and_split(
                        stele_slug,
                        job_path=job_path,
                        out_dir=out_dir,
                        cols=cols,
                        rows=rows,
                        direction=direction,
                        payload=payload,
                    )
                elif job_type == "apply_crop_overrides":
                    self._run_job_apply_crop_overrides(
                        stele_slug,
                        job_path=job_path,
                        dataset_dir=dataset_dir,
                        dataset_path=out_dir,
                    )
            except Exception as e:
                self._update_job(job_path, status="fail", stage="fail", log_tail=str(e))

        t = threading.Thread(target=run, daemon=True)
        t.start()

        return {"job": job}

    def get_job(self, stele_slug: str, job_id: str) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        job_path = paths.jobs_dir / f"{job_id}.json"
        if not job_path.exists():
            raise FileNotFoundError("Job not found")
        return json.loads(job_path.read_text(encoding="utf-8"))

    def list_jobs(self, stele_slug: str) -> Dict[str, Any]:
        paths = self._resolve_project_dir(stele_slug)
        jobs: list[dict] = []
        if paths.jobs_dir.exists():
            for p in sorted(paths.jobs_dir.glob("*.json"), key=lambda x: x.name, reverse=True):
                try:
                    jobs.append(json.loads(p.read_text(encoding="utf-8")))
                except Exception:
                    continue
        return {"jobs": jobs}

    def _update_job(
        self,
        job_path: Path,
        *,
        status: Optional[str] = None,
        stage: Optional[str] = None,
        progress: Optional[int] = None,
        log_tail: Optional[str] = None,
        outputs: Optional[dict] = None,
    ) -> None:
        cur = {}
        if job_path.exists():
            cur = json.loads(job_path.read_text(encoding="utf-8"))
        if status is not None:
            cur["status"] = status
        if stage is not None:
            cur["stage"] = stage
        if progress is not None:
            cur["progress"] = int(progress)
        if log_tail is not None:
            cur["log_tail"] = str(log_tail)
        if outputs is not None:
            cur["outputs"] = outputs
        cur["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        job_path.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _run_job_build_dataset(
        self,
        stele_slug: str,
        *,
        job_path: Path,
        out_dir: Path,
        cols: int,
        rows: int,
        direction: str,
    ) -> None:
        self._update_job(job_path, status="running", stage="start", progress=1)

        # V1 auto-annotate: fetch text candidates and auto-fill alignment.json
        # if it is currently empty. This keeps the one-click flow smooth.
        try:
            cur_job = json.loads(job_path.read_text(encoding="utf-8"))
            job_type = str(cur_job.get("type") or "")
        except Exception:
            job_type = ""

        if job_type == "auto_annotate":
            self._update_job(job_path, stage="fetch_text", progress=6)
            try:
                candidates = self.fetch_text_candidates(stele_slug)
                results = list(candidates.get("results") or [])
                best_text = ""
                best_url = None
                for it in results:
                    if not isinstance(it, dict):
                        continue
                    t = str(it.get("text_trad") or "")
                    if len(t) > len(best_text):
                        best_text = t
                        best_url = it.get("url")

                self._update_job(job_path, stage="normalize_text", progress=10)
                filtered = self._filter_cjk_chars(best_text)
                total_cells = 0
                try:
                    total_cells = self._compute_total_cells(stele_slug)
                except Exception:
                    total_cells = 0

                if filtered and total_cells:
                    if len(filtered) > total_cells:
                        filtered = filtered[:total_cells]

                    self.save_alignment_text(
                        stele_slug,
                        {
                            "text_trad": filtered,
                            "text_simp": "",
                            "cells": [],
                        },
                    )

                    # Update project metadata.
                    paths = self._resolve_project_dir(stele_slug)
                    try:
                        proj = json.loads(paths.project_json.read_text(encoding="utf-8"))
                        proj.setdefault("text", {})
                        proj["text"]["status"] = "auto" if len(filtered) == total_cells else "partial"
                        proj["text"]["selected_source_url"] = str(best_url or "") or None
                        proj["text"]["confidence"] = None
                        paths.project_json.write_text(
                            json.dumps(proj, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8",
                        )
                    except Exception:
                        pass

                    if len(filtered) != total_cells:
                        self._update_job(
                            job_path,
                            log_tail=(
                                str(json.loads(job_path.read_text(encoding="utf-8")).get("log_tail") or "")
                                + "\n"
                                + f"[text] filtered_len={len(filtered)} total_cells={total_cells} (mismatch)"
                            ).strip()[-6000:],
                        )
            except Exception:
                # Don't block dataset build.
                pass

        # Run a script so logic stays reusable.
        script = (self.base_dir / "scripts" / "workbench_build_dataset.py").resolve()
        if not script.exists():
            raise FileNotFoundError(f"Missing script: {script}")

        self._update_job(job_path, stage="layout", progress=18)

        paths = self._resolve_project_dir(stele_slug)
        cmd = [
            "python3",
            str(script),
            "--stele-slug",
            stele_slug,
            "--stele-dir",
            str(paths.stele_dir),
            "--pages-dir",
            str(paths.pages_raw_dir),
            "--out-dir",
            str(out_dir),
            "--direction",
            direction,
            "--cols",
            str(int(cols)),
            "--rows",
            str(int(rows)),
            "--job-file",
            str(job_path),
        ]

        p = subprocess.Popen(
            cmd,
            cwd=str(self.base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        tail_lines: list[str] = []
        assert p.stdout is not None
        for line in p.stdout:
            tail_lines.append(line.rstrip("\n"))
            tail_lines = tail_lines[-80:]
            self._update_job(job_path, log_tail="\n".join(tail_lines))

        rc = p.wait()
        if rc != 0:
            raise RuntimeError(f"workbench_build_dataset failed with rc={rc}")

        # Zip for download.
        zip_path = out_dir.parent / f"{out_dir.name}.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for fp in sorted(out_dir.rglob("*")):
                if fp.is_dir():
                    continue
                z.write(fp, arcname=str(out_dir.name + "/" + str(fp.relative_to(out_dir))))

        outputs = json.loads(job_path.read_text(encoding="utf-8")).get("outputs") or {}
        outputs["zip_path"] = str(zip_path)

        outputs["zip_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}.zip")
        outputs["dataset_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{out_dir.name}"
        outputs["index_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}/index.json")
        outputs["qa_summary_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}/qa_summary.md")
        outputs["overlays_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{out_dir.name}/overlays"

        # Update project latest_dataset pointer.
        try:
            paths = self._resolve_project_dir(stele_slug)
            proj = json.loads(paths.project_json.read_text(encoding="utf-8"))
            proj["latest_dataset"] = {
                "name": str(out_dir.name),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            paths.project_json.write_text(
                json.dumps(proj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        except Exception:
            pass

        self._update_job(job_path, status="success", stage="done", progress=100, outputs=outputs)

    def _workbench_file_url(self, stele_slug: str, rel_path: str) -> str:
        p = str(rel_path or "").lstrip("/")
        return f"/api/workbench/projects/{stele_slug}/files/{p}"

    def _run_job_ml_refine_dataset(
        self,
        stele_slug: str,
        *,
        job_path: Path,
        out_dir: Path,
        cols: int,
        rows: int,
        direction: str,
        payload: Dict[str, Any],
    ) -> None:
        """Run detector -> refine crops -> QA -> pick top200."""

        self._update_job(job_path, status="running", stage="ml_start", progress=1)

        paths = self._resolve_project_dir(stele_slug)
        proj = json.loads(paths.project_json.read_text(encoding="utf-8"))
        models = proj.get("models") if isinstance(proj.get("models"), dict) else {}
        detector = str(payload.get("detector_model") or models.get("detector_best") or "").strip()
        if not detector:
            raise ValueError("Missing detector_model (configure project.models.detector_best or pass in payload)")

        self._ensure_ultralytics(job_path)

        exports_dir = (paths.workbench_dir / "ml" / "exports").resolve()
        exports_dir.mkdir(parents=True, exist_ok=True)
        dets_path = exports_dir / f"dets_{job_path.stem}.json"

        # 1) predict
        self._update_job(job_path, stage="ml_predict", progress=10)
        cmd_pred = [
            "python3",
            str((self.base_dir / "scripts" / "ml_yolo_predict_pages.py").resolve()),
            "--model",
            detector,
            "--pages-dir",
            str(paths.pages_raw_dir),
            "--glob",
            "page_*.{jpg,jpeg,png,webp}",
            "--out",
            str(dets_path),
        ]
        self._run_cmd(job_path, cmd_pred)

        # 2) refine
        self._update_job(job_path, stage="ml_refine", progress=45)
        cmd_ref = [
            "python3",
            str((self.base_dir / "scripts" / "ml_refine_crops_with_detector.py").resolve()),
            "--stele-slug",
            stele_slug,
            "--stele-dir",
            str(paths.stele_dir),
            "--pages-dir",
            str(paths.pages_raw_dir),
            "--detections-json",
            str(dets_path),
            "--out-dir",
            str(out_dir),
            "--direction",
            str(direction),
            "--cols",
            str(int(cols)),
            "--rows",
            str(int(rows)),
            "--alignment-text",
            str(paths.alignment_json),
            "--run-qa",
        ]
        self._run_cmd(job_path, cmd_ref)

        # 3) pick candidates
        self._update_job(job_path, stage="ml_pick_gold", progress=85)
        gold_csv = out_dir / "gold_candidates_top200.csv"
        qa_report = out_dir / "qa_report.json"
        if qa_report.exists():
            cmd_pick = [
                "python3",
                str((self.base_dir / "scripts" / "ml_pick_gold_candidates.py").resolve()),
                "--qa-report",
                str(qa_report),
                "--out",
                str(gold_csv),
                "--top",
                "200",
            ]
            self._run_cmd(job_path, cmd_pick)

        # zip
        self._update_job(job_path, stage="zip", progress=92)
        zip_path = out_dir.parent / f"{out_dir.name}.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for fp in sorted(out_dir.rglob("*")):
                if fp.is_dir():
                    continue
                z.write(fp, arcname=str(out_dir.name + "/" + str(fp.relative_to(out_dir))))

        outputs = json.loads(job_path.read_text(encoding="utf-8")).get("outputs") or {}
        outputs["zip_path"] = str(zip_path)
        outputs["zip_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}.zip")
        outputs["dataset_dir"] = out_dir.name
        outputs["dataset_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{out_dir.name}"
        outputs["index_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}/index.json")
        outputs["qa_summary_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}/qa_summary.md")
        outputs["overlays_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{out_dir.name}/overlays"
        if gold_csv.exists():
            outputs["gold_candidates_url"] = self._workbench_file_url(
                stele_slug, f"datasets/{out_dir.name}/gold_candidates_top200.csv"
            )
        else:
            outputs["gold_candidates_url"] = None

        # Update project latest_dataset pointer.
        try:
            proj["latest_dataset"] = {"name": str(out_dir.name), "created_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
            paths.project_json.write_text(json.dumps(proj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except Exception:
            pass

        self._update_job(job_path, status="success", stage="done", progress=100, outputs=outputs)

    def _run_job_ml_align_and_split(
        self,
        stele_slug: str,
        *,
        job_path: Path,
        out_dir: Path,
        cols: int,
        rows: int,
        direction: str,
        payload: Dict[str, Any],
    ) -> None:
        """Run det -> sequence -> (optional cls) -> align -> split-build."""

        self._update_job(job_path, status="running", stage="align_start", progress=1)
        paths = self._resolve_project_dir(stele_slug)
        proj = json.loads(paths.project_json.read_text(encoding="utf-8"))
        models = proj.get("models") if isinstance(proj.get("models"), dict) else {}

        detector = str(payload.get("detector_model") or models.get("detector_best") or "").strip()
        if not detector:
            raise ValueError("Missing detector_model")

        self._ensure_ultralytics(job_path)

        classifier = str(payload.get("classifier_model") or models.get("classifier_best") or "").strip()
        classes_json = str(payload.get("classifier_classes_json") or models.get("classifier_classes_json") or "").strip()

        exports_dir = (paths.workbench_dir / "ml" / "exports").resolve()
        exports_dir.mkdir(parents=True, exist_ok=True)
        dets_path = exports_dir / f"dets_{job_path.stem}.json"
        seq_path = exports_dir / f"seq_{job_path.stem}.json"
        preds_path = exports_dir / f"preds_{job_path.stem}.json"
        aligned_path = exports_dir / f"aligned_{job_path.stem}.json"

        # predict
        self._update_job(job_path, stage="align_predict", progress=10)
        cmd_pred = [
            "python3",
            str((self.base_dir / "scripts" / "ml_yolo_predict_pages.py").resolve()),
            "--model",
            detector,
            "--pages-dir",
            str(paths.pages_raw_dir),
            "--glob",
            "page_*.{jpg,jpeg,png,webp}",
            "--out",
            str(dets_path),
        ]
        self._run_cmd(job_path, cmd_pred)

        # build seq + filter
        self._update_job(job_path, stage="align_sequence", progress=25)
        cmd_seq = [
            "python3",
            str((self.base_dir / "scripts" / "ml_build_detection_sequence.py").resolve()),
            "--stele-dir",
            str(paths.stele_dir),
            "--pages-dir",
            str(paths.pages_raw_dir),
            "--detections-json",
            str(dets_path),
            "--out",
            str(seq_path),
            "--direction",
            str(direction),
            "--cols",
            str(int(cols)),
            "--rows",
            str(int(rows)),
        ]
        self._run_cmd(job_path, cmd_seq)

        # classify (optional)
        pred_arg: list[str] = []
        if classifier and classes_json:
            self._update_job(job_path, stage="align_classify", progress=40)
            cmd_cls = [
                "python3",
                str((self.base_dir / "scripts" / "ml_yolo_classify_detections.py").resolve()),
                "--model",
                classifier,
                "--detections-seq",
                str(seq_path),
                "--stele-dir",
                str(paths.pages_raw_dir),
                "--classes-json",
                classes_json,
                "--out",
                str(preds_path),
            ]
            self._run_cmd(job_path, cmd_cls)
            pred_arg = ["--pred-json", str(preds_path)]

        # align
        self._update_job(job_path, stage="align_dp", progress=60)
        text = ""
        if paths.alignment_json.exists():
            try:
                a = json.loads(paths.alignment_json.read_text(encoding="utf-8"))
                text = str(a.get("text_trad") or "").strip()
            except Exception:
                text = ""
        cmd_align = [
            "python3",
            str((self.base_dir / "scripts" / "ml_align_sequence.py").resolve()),
            "--text",
            text,
            "--detections-json",
            str(seq_path),
            "--out",
            str(aligned_path),
        ] + pred_arg
        self._run_cmd(job_path, cmd_align)

        # split-build
        self._update_job(job_path, stage="align_build", progress=78)
        cmd_build = [
            "python3",
            str((self.base_dir / "scripts" / "ml_split_and_build_dataset.py").resolve()),
            "--stele-dir",
            str(paths.pages_raw_dir),
            "--stele-slug",
            stele_slug,
            "--detections-seq",
            str(seq_path),
            "--alignment-json",
            str(aligned_path),
            "--out-dir",
            str(out_dir),
            "--direction",
            str(direction),
        ]
        self._run_cmd(job_path, cmd_build)

        # QA
        self._update_job(job_path, stage="qa", progress=90)
        try:
            qa_script = (self.base_dir / "scripts" / "qa_char_crops.py").resolve()
            subprocess.check_call(
                [
                    "python3",
                    str(qa_script),
                    "--dataset-dir",
                    str(out_dir),
                    "--source-dir",
                    str(paths.pages_raw_dir),
                    "--top",
                    "120",
                ]
            )
        except Exception:
            pass

        # zip
        zip_path = out_dir.parent / f"{out_dir.name}.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for fp in sorted(out_dir.rglob("*")):
                if fp.is_dir():
                    continue
                z.write(fp, arcname=str(out_dir.name + "/" + str(fp.relative_to(out_dir))))

        outputs = json.loads(job_path.read_text(encoding="utf-8")).get("outputs") or {}
        outputs["zip_path"] = str(zip_path)
        outputs["zip_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}.zip")
        outputs["dataset_dir"] = out_dir.name
        outputs["dataset_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{out_dir.name}"
        outputs["index_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}/index.json")
        outputs["qa_summary_url"] = self._workbench_file_url(stele_slug, f"datasets/{out_dir.name}/qa_summary.md")
        outputs["overlays_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{out_dir.name}/overlays"
        outputs["aligned_url"] = self._workbench_file_url(stele_slug, str(aligned_path.relative_to(paths.stele_dir)))

        try:
            proj["latest_dataset"] = {"name": str(out_dir.name), "created_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
            paths.project_json.write_text(json.dumps(proj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except Exception:
            pass

        self._update_job(job_path, status="success", stage="done", progress=100, outputs=outputs)

    def _run_cmd(self, job_path: Path, cmd: list[str]) -> None:
        """Run a subprocess and stream stdout into job log_tail."""
        p = subprocess.Popen(
            cmd,
            cwd=str(self.base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        tail_lines: list[str] = []
        assert p.stdout is not None
        for line in p.stdout:
            tail_lines.append(line.rstrip("\n"))
            tail_lines = tail_lines[-120:]
            self._update_job(job_path, log_tail="\n".join(tail_lines))
        rc = p.wait()
        if rc != 0:
            raise RuntimeError(f"Command failed rc={rc}: {' '.join(cmd[:3])}")

    def _run_job_apply_crop_overrides(
        self,
        stele_slug: str,
        *,
        job_path: Path,
        dataset_dir: str,
        dataset_path: Path,
    ) -> None:
        """Apply crop overrides to an existing dataset, rerun QA and refresh top200."""

        self._update_job(job_path, status="running", stage="apply_overrides", progress=5)
        paths = self._resolve_project_dir(stele_slug)

        overrides_path = (dataset_path / "crop_overrides.json").resolve()
        if not overrides_path.exists():
            raise FileNotFoundError("Missing crop_overrides.json in dataset")

        cmd_apply = [
            "python3",
            str((self.base_dir / "scripts" / "apply_crop_overrides.py").resolve()),
            "--dataset-dir",
            str(dataset_path),
            "--source-dir",
            str(paths.stele_dir),
            "--overrides",
            str(overrides_path),
        ]
        self._run_cmd(job_path, cmd_apply)

        # QA
        self._update_job(job_path, stage="qa", progress=70)
        try:
            qa_script = (self.base_dir / "scripts" / "qa_char_crops.py").resolve()
            subprocess.check_call(
                [
                    "python3",
                    str(qa_script),
                    "--dataset-dir",
                    str(dataset_path),
                    "--source-dir",
                    str(paths.stele_dir),
                    "--top",
                    "120",
                ]
            )
        except Exception:
            pass

        # top200
        self._update_job(job_path, stage="pick_top200", progress=85)
        qa_report = dataset_path / "qa_report.json"
        gold_csv = dataset_path / "gold_candidates_top200.csv"
        if qa_report.exists():
            cmd_pick = [
                "python3",
                str((self.base_dir / "scripts" / "ml_pick_gold_candidates.py").resolve()),
                "--qa-report",
                str(qa_report),
                "--out",
                str(gold_csv),
                "--top",
                "200",
            ]
            self._run_cmd(job_path, cmd_pick)

        # zip
        self._update_job(job_path, stage="zip", progress=92)
        zip_path = dataset_path.parent / f"{dataset_path.name}.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for fp in sorted(dataset_path.rglob("*")):
                if fp.is_dir():
                    continue
                z.write(fp, arcname=str(dataset_path.name + "/" + str(fp.relative_to(dataset_path))))

        outputs = json.loads(job_path.read_text(encoding="utf-8")).get("outputs") or {}
        outputs["dataset_dir"] = str(dataset_dir)
        outputs["zip_path"] = str(zip_path)
        outputs["zip_url"] = self._workbench_file_url(stele_slug, f"datasets/{dataset_path.name}.zip")
        outputs["index_url"] = self._workbench_file_url(stele_slug, f"datasets/{dataset_path.name}/index.json")
        outputs["qa_summary_url"] = self._workbench_file_url(stele_slug, f"datasets/{dataset_path.name}/qa_summary.md")
        outputs["overlays_url"] = f"/api/workbench/projects/{stele_slug}/list?path=datasets/{dataset_path.name}/overlays"
        outputs["gold_candidates_url"] = self._workbench_file_url(
            stele_slug, f"datasets/{dataset_path.name}/gold_candidates_top200.csv"
        )
        self._update_job(job_path, status="success", stage="done", progress=100, outputs=outputs)

    def _ensure_ultralytics(self, job_path: Path) -> None:
        """Fail fast with a clear message when ultralytics isn't installed."""
        try:
            import ultralytics  # type: ignore

            _ = ultralytics
            return
        except Exception as e:
            self._update_job(
                job_path,
                log_tail=(
                    "Missing dependency: ultralytics.\n"
                    "Install on this machine (venv) with:\n"
                    "  python3 -m pip install -U ultralytics\n"
                    f"Import error: {e}"
                ),
            )
            raise

    def _run_job_preview_page(
        self,
        stele_slug: str,
        *,
        job_path: Path,
        out_dir: Path,
        page: str,
        cols: int,
        rows: int,
        direction: str,
    ) -> None:
        self._update_job(job_path, status="running", stage="preview", progress=1)

        script = (self.base_dir / "scripts" / "workbench_preview_page.py").resolve()
        if not script.exists():
            raise FileNotFoundError(f"Missing script: {script}")

        paths = self._resolve_project_dir(stele_slug)
        cmd = [
            "python3",
            str(script),
            "--stele-slug",
            stele_slug,
            "--stele-dir",
            str(paths.stele_dir),
            "--pages-dir",
            str(paths.pages_raw_dir),
            "--page",
            str(page),
            "--out-dir",
            str(out_dir),
            "--direction",
            direction,
            "--cols",
            str(int(cols)),
            "--rows",
            str(int(rows)),
            "--job-file",
            str(job_path),
        ]

        p = subprocess.Popen(
            cmd,
            cwd=str(self.base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        tail_lines: list[str] = []
        assert p.stdout is not None
        for line in p.stdout:
            tail_lines.append(line.rstrip("\n"))
            tail_lines = tail_lines[-80:]
            self._update_job(job_path, log_tail="\n".join(tail_lines))

        rc = p.wait()
        if rc != 0:
            raise RuntimeError(f"workbench_preview_page failed with rc={rc}")

        outputs = json.loads(job_path.read_text(encoding="utf-8")).get("outputs") or {}
        # Under workbench dir: workbench/preview/<page>/...
        rel_base = f"workbench/preview/{out_dir.name}"
        outputs["preview_url"] = f"/api/workbench/projects/{stele_slug}/list?path={rel_base}"
        outputs["cells_url"] = self._workbench_file_url(stele_slug, f"{rel_base}/cells.json")
        outputs["grid_png_url"] = self._workbench_file_url(stele_slug, f"{rel_base}/overlays/page_grid.png")
        outputs["crop_png_url"] = self._workbench_file_url(stele_slug, f"{rel_base}/overlays/page_crop.png")

        self._update_job(job_path, status="success", stage="done", progress=100, outputs=outputs)
