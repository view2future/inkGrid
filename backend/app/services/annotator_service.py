import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class AnnotatorPaths:
    stele_dir: Path
    annotator_dir: Path
    overrides_path: Path


class AnnotatorService:
    def __init__(self, base_dir: str, steles_dir: str):
        self.base_dir = Path(base_dir)
        self.steles_dir = Path(steles_dir)

    def _resolve_stele_dir(self, stele_rel_path: str) -> AnnotatorPaths:
        rel = str(stele_rel_path or "").strip().lstrip("/")
        if not rel:
            raise ValueError("Empty stele path")

        stele_dir = (self.steles_dir / rel).resolve()
        if not str(stele_dir).startswith(str(self.steles_dir.resolve()) + os.sep):
            raise ValueError("Invalid stele path")
        if not stele_dir.exists() or not stele_dir.is_dir():
            raise FileNotFoundError(f"Stele dir not found: {stele_dir}")

        annotator_dir = stele_dir / "annotator"
        overrides_path = annotator_dir / "overrides.json"
        return AnnotatorPaths(
            stele_dir=stele_dir,
            annotator_dir=annotator_dir,
            overrides_path=overrides_path,
        )

    def get_overrides(self, stele_rel_path: str) -> Dict[str, Any]:
        paths = self._resolve_stele_dir(stele_rel_path)
        if paths.overrides_path.exists():
            return json.loads(paths.overrides_path.read_text(encoding="utf-8"))
        return {"version": 1, "crop_overrides": {}}

    def save_overrides(self, stele_rel_path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        paths = self._resolve_stele_dir(stele_rel_path)
        paths.annotator_dir.mkdir(parents=True, exist_ok=True)

        # Keep schema minimal.
        out = {
            "version": 1,
            "crop_overrides": payload.get("crop_overrides") or {},
        }
        paths.overrides_path.write_text(
            json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return out

    def apply_overrides(
        self,
        stele_rel_path: str,
        *,
        dataset_dir: str,
        only_files: Optional[list[str]] = None,
        run_qa: bool = True,
    ) -> Dict[str, Any]:
        paths = self._resolve_stele_dir(stele_rel_path)
        if not dataset_dir:
            raise ValueError("Missing dataset_dir")

        ds = (paths.stele_dir / dataset_dir).resolve()
        if not str(ds).startswith(str(paths.stele_dir) + os.sep):
            raise ValueError("Invalid dataset_dir")
        if not ds.exists():
            raise FileNotFoundError(f"Dataset dir not found: {ds}")

        if not paths.overrides_path.exists():
            raise FileNotFoundError("No overrides.json saved")

        cmd = [
            "python3",
            str((self.base_dir / "scripts" / "apply_crop_overrides.py").resolve()),
            "--dataset-dir",
            str(ds),
            "--source-dir",
            str(paths.stele_dir),
            "--overrides",
            str(paths.overrides_path),
        ]
        if only_files:
            cmd += ["--only-files", ",".join(only_files)]

        subprocess.check_call(cmd)

        if run_qa:
            qa_cmd = [
                "python3",
                str((self.base_dir / "scripts" / "qa_char_crops.py").resolve()),
                "--dataset-dir",
                str(ds),
                "--source-dir",
                str(paths.stele_dir),
                "--top",
                "120",
            ]
            subprocess.check_call(qa_cmd)

        return {
            "dataset_dir": str(ds),
            "overrides": str(paths.overrides_path),
            "qa_report": str(ds / "qa_report.json"),
            "qa_summary": str(ds / "qa_summary.md"),
        }

    def list_datasets(self, stele_rel_path: str) -> Dict[str, Any]:
        paths = self._resolve_stele_dir(stele_rel_path)

        def sort_key(name: str) -> tuple[int, str]:
            # Prefer *_v<number> ordering, then lexical.
            try:
                parts = name.rsplit("_v", 1)
                if len(parts) == 2 and parts[1].isdigit():
                    return (int(parts[1]), name)
            except Exception:
                pass
            return (10**9, name)

        datasets: list[str] = []
        for p in paths.stele_dir.iterdir():
            if not p.is_dir():
                continue
            if (p / "index.json").exists():
                datasets.append(p.name)

        datasets.sort(key=sort_key)
        return {
            "stele": str(stele_rel_path),
            "datasets": datasets,
        }
