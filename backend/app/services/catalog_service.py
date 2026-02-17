import json
import os
from typing import Any, Dict, List, Optional


def _read_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _normalize_key(value: str) -> str:
    # Minimal normalization (keep ASCII; avoid heavy deps)
    return (
        str(value or "")
        .strip()
        .replace(" ", "")
        .replace("·", "")
        .replace("・", "")
        .replace("（", "(")
        .replace("）", ")")
        .lower()
    )


class CatalogService:
    """Serve masterpieces + knowledge from JSON (dev) or built dist (prod)."""

    # Known id mismatches between steles.json and stele_knowledge.json
    _KNOWLEDGE_ID_OVERRIDES: Dict[str, str] = {
        # steles.json: zhuan_003 == 峄山刻石; knowledge: zhuan_001 == 嶧山刻石
        "zhuan_003": "zhuan_001",
        # steles.json: zhuan_001 == 泰山刻石; knowledge: zhuan_002 == 泰山刻石
        "zhuan_001": "zhuan_002",
        # steles.json: kai_007 == 柳公权玄秘塔碑; knowledge: kai_003 == 玄秘塔碑
        "kai_007": "kai_003",
    }

    def __init__(self, base_dir: str, frontend_dist_dir: str):
        self.base_dir = base_dir
        self.frontend_dist_dir = frontend_dist_dir

        self._steles: List[Dict[str, Any]] = []
        self._steles_by_id: Dict[str, Dict[str, Any]] = {}
        self._knowledge: List[Dict[str, Any]] = []
        self._knowledge_by_id: Dict[str, Dict[str, Any]] = {}
        self._knowledge_by_name_key: Dict[str, Dict[str, Any]] = {}

        self._load()

    def _candidate_paths(self) -> Dict[str, List[str]]:
        # Prefer source data in dev; fallback to built dist in production.
        src_data = os.path.join(self.base_dir, "frontend", "public", "data")
        dist_data = os.path.join(self.frontend_dist_dir, "data")
        return {
            "steles": [
                os.path.join(src_data, "steles.json"),
                os.path.join(dist_data, "steles.json"),
            ],
            "knowledge": [
                os.path.join(src_data, "stele_knowledge.json"),
                os.path.join(dist_data, "stele_knowledge.json"),
            ],
        }

    def _pick_first_existing(self, paths: List[str]) -> Optional[str]:
        for p in paths:
            if p and os.path.exists(p):
                return p
        return None

    def _load(self) -> None:
        candidates = self._candidate_paths()

        steles_path = self._pick_first_existing(candidates["steles"])
        knowledge_path = self._pick_first_existing(candidates["knowledge"])

        if steles_path:
            raw = _read_json(steles_path)
            self._steles = list(raw.get("steles", []) or [])
        else:
            self._steles = []

        if knowledge_path:
            raw = _read_json(knowledge_path)
            self._knowledge = list(raw.get("steles", []) or [])
        else:
            self._knowledge = []

        self._steles_by_id = {}
        for s in self._steles:
            sid = str(s.get("id") or "").strip()
            if not sid:
                continue
            if sid not in self._steles_by_id:
                self._steles_by_id[sid] = s

        self._knowledge_by_id = {}
        self._knowledge_by_name_key = {}
        for k in self._knowledge:
            kid = str(k.get("id") or "").strip()
            if kid and kid not in self._knowledge_by_id:
                self._knowledge_by_id[kid] = k
            name_key = _normalize_key(str(k.get("name") or ""))
            if name_key and name_key not in self._knowledge_by_name_key:
                self._knowledge_by_name_key[name_key] = k

    def list_masterpieces(
        self, script_type: Optional[str] = None, q: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        script_type = (script_type or "").strip()
        qn = (q or "").strip().lower()

        out: List[Dict[str, Any]] = []
        for s in self._steles:
            if script_type and str(s.get("script_type") or "") != script_type:
                continue

            if qn:
                hay = " ".join(
                    [
                        str(s.get("name") or ""),
                        str(s.get("author") or ""),
                        str(s.get("dynasty") or ""),
                        str(s.get("script_type") or ""),
                        str(s.get("location") or ""),
                    ]
                ).lower()
                if qn not in hay:
                    continue

            # Metadata only
            out.append(
                {
                    "id": s.get("id"),
                    "name": s.get("name"),
                    "aliases": s.get("aliases") or [],
                    "script_type": s.get("script_type"),
                    "author": s.get("author"),
                    "dynasty": s.get("dynasty"),
                    "year": s.get("year"),
                    "type": s.get("type"),
                    "location": s.get("location"),
                    "total_chars": s.get("total_chars"),
                    "description": s.get("description"),
                    "knowledge_id": s.get("knowledge_id"),
                    "assets": s.get("assets"),
                }
            )

        return out

    def get_masterpiece(self, sid: str) -> Optional[Dict[str, Any]]:
        s = self._steles_by_id.get(str(sid))
        if not s:
            return None
        # Return full stele, including content.
        return dict(s)

    def get_knowledge_for_masterpiece(self, sid: str) -> Optional[Dict[str, Any]]:
        s = self._steles_by_id.get(str(sid))
        if not s:
            return None

        explicit = str(s.get("knowledge_id") or "").strip()
        if explicit:
            hit = self._knowledge_by_id.get(explicit)
            if hit:
                return dict(hit)

        override = self._KNOWLEDGE_ID_OVERRIDES.get(str(sid))
        if override:
            hit = self._knowledge_by_id.get(override)
            if hit:
                return dict(hit)

        hit = self._knowledge_by_id.get(str(sid))
        if hit:
            return dict(hit)

        # Fallback: name key
        name_key = _normalize_key(str(s.get("name") or ""))
        if name_key:
            hit = self._knowledge_by_name_key.get(name_key)
            if hit:
                return dict(hit)

        return None
