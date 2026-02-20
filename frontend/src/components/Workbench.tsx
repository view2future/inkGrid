import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppActive } from '../utils/useAppActive';

type Project = {
  slug: string;
  name: string;
  direction?: string;
  grid?: { cols: number; rows: number };
  latest_dataset?: any;
  models?: {
    detector_best?: string | null;
    classifier_best?: string | null;
    classifier_classes_json?: string | null;
  };
  created_at?: string;
};

type PageEntry = {
  image: string;
  override?: { direction?: string; cols?: number; rows?: number } | null;
};

type Job = {
  id: string;
  status: string;
  stage: string;
  progress: number;
  outputs?: {
    dataset_dir?: string;
    zip_path?: string;
    zip_url?: string;
    dataset_url?: string;
    qa_summary_url?: string;
    overlays_url?: string;
    gold_candidates_url?: string;
    aligned_url?: string;
    grid_png_url?: string;
    crop_png_url?: string;
  };
  log_tail?: string;
};

type GoldRow = {
  rank: number;
  score: number;
  flags: string;
  suggestions: string;
  index: number;
  char: string;
  file: string;
  page: string;
  crop_box: number[] | null;
};

type CropOverrides = {
  version?: number;
  crop_overrides: Record<string, { crop_box: number[]; note?: string }>;
};

function applySuggestion(box: number[], suggestion: string, stepPx: number) {
  const s = String(suggestion || '').trim();
  const step = Math.max(1, Math.round(stepPx));
  if (s === 'expand_left') return [box[0] - step, box[1], box[2], box[3]];
  if (s === 'expand_right') return [box[0], box[1], box[2] + step, box[3]];
  if (s === 'expand_top') return [box[0], box[1] - step, box[2], box[3]];
  if (s === 'expand_bottom') return [box[0], box[1], box[2], box[3] + step];
  if (s === 'recenter') return box;
  return box;
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseGoldCsv(text: string): GoldRow[] {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const header = parseCsvLine(lines[0]).map((s) => s.trim());
  const idx = (name: string) => header.indexOf(name);
  const iRank = idx('rank');
  const iScore = idx('score');
  const iFlags = idx('flags');
  const iSug = idx('suggestions');
  const iIndex = idx('index');
  const iChar = idx('char');
  const iFile = idx('file');
  const iPage = idx('page');
  const iCrop = idx('crop_box');
  const out: GoldRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const cropRaw = cols[iCrop] || '';
    let crop: number[] | null = null;
    try {
      const v = JSON.parse(cropRaw);
      if (Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number')) crop = v;
    } catch {
      crop = null;
    }
    out.push({
      rank: Number(cols[iRank] || 0),
      score: Number(cols[iScore] || 0),
      flags: String(cols[iFlags] || ''),
      suggestions: String(cols[iSug] || ''),
      index: Number(cols[iIndex] || 0),
      char: String(cols[iChar] || ''),
      file: String(cols[iFile] || ''),
      page: String(cols[iPage] || ''),
      crop_box: crop,
    });
  }
  return out;
}

function clampNum(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

type TextCandidates = {
  query?: string;
  endpoint?: string | null;
  warning?: string;
  results?: { title?: string; url?: string; snippet?: string; text_trad?: string }[];
};

const TOKEN_KEY = 'inkgrid_admin_token';

function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function setToken(v: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, v);
  } catch {
    // ignore
  }
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('X-Inkgrid-Admin-Token', token);
  return fetch(path, { ...opts, headers });
}

export function Workbench() {
  const isAppActive = useAppActive();
  const [token, setTokenState] = useState(getToken());
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<'vertical_rtl' | 'horizontal_ltr'>('vertical_rtl');
  const [cols, setCols] = useState(14);
  const [rows, setRows] = useState(24);
  const [job, setJob] = useState<Job | null>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [textCandidates, setTextCandidates] = useState<TextCandidates | null>(null);
  const [textTrad, setTextTrad] = useState('');
  const [detectorModel, setDetectorModel] = useState('');
  const [classifierModel, setClassifierModel] = useState('');
  const [classifierClassesJson, setClassifierClassesJson] = useState('');
  const [applyDataset, setApplyDataset] = useState('');

  const [goldRows, setGoldRows] = useState<GoldRow[]>([]);
  const [goldDataset, setGoldDataset] = useState('');
  const [overrides, setOverrides] = useState<CropOverrides>({ crop_overrides: {} });
  const [activeGold, setActiveGold] = useState<GoldRow | null>(null);
  const [editBox, setEditBox] = useState<number[] | null>(null);
  const [nudgeStep, setNudgeStep] = useState(6);

  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const [pageView, setPageView] = useState<{ cw: number; ch: number; nw: number; nh: number } | null>(null);

  const pageImgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [editorPage, setEditorPage] = useState<PageEntry | null>(null);
  const [editorImg, setEditorImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<null | {
    kind: 'pan' | 'col' | 'row';
    index: number;
    lane?: number;
    startClientX: number;
    startClientY: number;
    startVal: number;
  }>(null);

  const [layout, setLayout] = useState<any>(null);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const [activeLane, setActiveLane] = useState(0);

  const [editDirection, setEditDirection] = useState<'vertical_rtl' | 'horizontal_ltr'>('vertical_rtl');
  const [editCols, setEditCols] = useState(14);
  const [editRows, setEditRows] = useState(24);

  const totalCells = useMemo(() => {
    if (!selected) return 0;
    const defCols = editCols;
    const defRows = editRows;
    let total = 0;
    for (const p of pages) {
      const cols = Number(p.override?.cols) || defCols;
      const rows = Number(p.override?.rows) || defRows;
      if (cols > 0 && rows > 0) total += cols * rows;
    }
    return total;
  }, [selected, pages, editCols, editRows]);

  const canUse = useMemo(() => {
    // PC-only guard
    return window.innerWidth >= 1000;
  }, []);

  async function loadProjects() {
    setErr(null);
    const r = await apiFetch('/api/workbench/projects');
    if (!r.ok) throw new Error(`List projects failed: ${r.status}`);
    const json = (await r.json()) as { projects?: Project[] };
    setProjects(Array.isArray(json.projects) ? json.projects : []);
  }

  async function loadProjectDetail(slug: string) {
    const r = await apiFetch(`/api/workbench/projects/${slug}`);
    if (!r.ok) throw new Error(`Get project failed: ${r.status}`);
    const json = (await r.json()) as {
      project?: any;
      pages?: PageEntry[];
      jobs?: Job[];
      datasets?: string[];
    };
    const p = json.project;
    if (p) {
      setEditDirection((p.direction || 'vertical_rtl') as any);
      setEditCols(Number(p.grid?.cols) || 14);
      setEditRows(Number(p.grid?.rows) || 24);
      setDetectorModel(String(p.models?.detector_best || ''));
      setClassifierModel(String(p.models?.classifier_best || ''));
      setClassifierClassesJson(String(p.models?.classifier_classes_json || ''));
    }
    setPages(Array.isArray(json.pages) ? json.pages : []);
    setJobs(Array.isArray(json.jobs) ? (json.jobs as any) : []);
    setDatasets(Array.isArray(json.datasets) ? json.datasets : []);

    // load alignment text
    try {
      const rr = await apiFetch(`/api/workbench/projects/${slug}/alignment`);
      if (rr.ok) {
        const a = (await rr.json()) as any;
        setTextTrad(String(a.text_trad || ''));
      }
    } catch {
      // ignore
    }

    // If editor is open, refresh its page/layout.
    if (editorPage) {
      const next = (Array.isArray(json.pages) ? json.pages : []).find((x: any) => x?.image === editorPage.image);
      if (next) {
        setEditorPage(next);
        setLayout((next as any).layout || null);
      }
    }
  }

  async function fetchText() {
    if (!selected) return;
    setBusy('fetch_text');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/text/fetch`, { method: 'POST' });
      if (!r.ok) throw new Error(`Fetch text failed: ${r.status}`);
      const json = (await r.json()) as TextCandidates;
      setTextCandidates(json);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveAlignmentText() {
    if (!selected) return;
    setBusy('save_text');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/alignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text_trad: textTrad, text_simp: '' }),
      });
      if (!r.ok) throw new Error(`Save alignment failed: ${r.status}`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!canUse) return;
    loadProjects().catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canUse]);

  async function createProject() {
    setBusy('create');
    setErr(null);
    try {
      const r = await apiFetch('/api/workbench/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          direction,
          grid_cols: cols,
          grid_rows: rows,
        }),
      });
      if (!r.ok) throw new Error(`Create failed: ${r.status}`);
      await loadProjects();
      setName('');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function uploadPages(files: FileList | null) {
    if (!selected) return;
    if (!files || !files.length) return;
    setBusy('upload');
    setErr(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/pages`, {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function deletePage(image: string) {
    if (!selected) return;
    setBusy('delete_page');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/pages/${encodeURIComponent(image)}`, {
        method: 'DELETE',
      });
      if (!r.ok) throw new Error(`Delete page failed: ${r.status}`);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveProjectSettings() {
    if (!selected) return;
    setBusy('save_project');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: editDirection,
          grid: { cols: editCols, rows: editRows },
          models: {
            detector_best: detectorModel.trim() || null,
            classifier_best: classifierModel.trim() || null,
            classifier_classes_json: classifierClassesJson.trim() || null,
          },
        }),
      });
      if (!r.ok) throw new Error(`Save project failed: ${r.status}`);
      await loadProjects();
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function savePages(nextPages: PageEntry[]) {
    if (!selected) return;
    setBusy('save_pages');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/pages/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: nextPages }),
      });
      if (!r.ok) throw new Error(`Save pages failed: ${r.status}`);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runPreview(page: string) {
    if (!selected) return;
    setBusy('preview');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'preview_page', page }),
      });
      if (!r.ok) throw new Error(`Preview job failed: ${r.status}`);
      const json = (await r.json()) as { job?: Job };
      setPreviewJob(json.job || null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!selected || !previewJob) return;
    if (previewJob.status === 'success' || previewJob.status === 'fail') return;
    if (!isAppActive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs/${previewJob.id}`);
        if (!r.ok) return;
        const json = (await r.json()) as Job;
        if (cancelled) return;
        setPreviewJob(json);
        if (json.status === 'success') {
          await loadProjectDetail(selected.slug);
        }
      } catch {
        // ignore
      }
    };
    const t = window.setInterval(() => void tick(), 900);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [selected, previewJob, isAppActive]);

  function openEditor(p: PageEntry) {
    setEditorPage(p);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setLayout((p as any).layout || null);
    setEditorImg(null);
    setPreviewJob(null);
    setActiveLane(0);
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function setBoundary(arr: number[], idx: number, nextVal: number, minGap = 8) {
    if (idx <= 0 || idx >= arr.length - 1) return arr;
    const lo = arr[idx - 1] + minGap;
    const hi = arr[idx + 1] - minGap;
    const v = clamp(nextVal, lo, hi);
    const out = arr.slice();
    out[idx] = v;
    return out;
  }

  async function persistLayoutAndPreview(pageImage: string, nextLayout: any) {
    if (!selected) return;
    const nextPages = pages.map((p) => (p.image === pageImage ? { ...p, layout: nextLayout } : p));
    await savePages(nextPages);
    await runPreview(pageImage);
  }

  async function startJob() {
    if (!selected) return;
    setBusy('job');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'auto_annotate' }),
      });
      if (!r.ok) throw new Error(`Create job failed: ${r.status}`);
      const json = (await r.json()) as { job?: Job };
      setJob(json.job || null);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function startMlRefineJob() {
    if (!selected) return;
    setBusy('ml_refine');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ml_refine_dataset',
          detector_model: detectorModel.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(`ML refine job failed: ${r.status}`);
      const json = (await r.json()) as { job?: Job };
      setJob(json.job || null);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function startMlAlignSplitJob() {
    if (!selected) return;
    setBusy('ml_align');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ml_align_and_split',
          detector_model: detectorModel.trim() || null,
          classifier_model: classifierModel.trim() || null,
          classifier_classes_json: classifierClassesJson.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(`ML align/split job failed: ${r.status}`);
      const json = (await r.json()) as { job?: Job };
      setJob(json.job || null);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function startApplyOverridesJob() {
    if (!selected) return;
    const ds = applyDataset.trim() || job?.outputs?.dataset_dir || datasets[datasets.length - 1] || '';
    if (!ds) {
      setErr('Missing dataset_dir for apply overrides');
      return;
    }
    setBusy('apply_overrides');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'apply_crop_overrides', dataset_dir: ds }),
      });
      if (!r.ok) throw new Error(`Apply overrides job failed: ${r.status}`);
      const json = (await r.json()) as { job?: Job };
      setJob(json.job || null);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  function effectiveDatasetDir() {
    return (
      goldDataset.trim() ||
      applyDataset.trim() ||
      job?.outputs?.dataset_dir ||
      datasets[datasets.length - 1] ||
      ''
    );
  }

  async function loadOverrides(ds: string) {
    if (!selected) return;
    const r = await apiFetch(`/api/workbench/projects/${selected.slug}/datasets/${encodeURIComponent(ds)}/overrides`);
    if (!r.ok) throw new Error(`Load overrides failed: ${r.status}`);
    const json = (await r.json()) as any;
    setOverrides({ crop_overrides: json?.crop_overrides || {} });
  }

  async function saveOverrides(ds: string) {
    if (!selected) return;
    const r = await apiFetch(`/api/workbench/projects/${selected.slug}/datasets/${encodeURIComponent(ds)}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_overrides: overrides.crop_overrides || {} }),
    });
    if (!r.ok) throw new Error(`Save overrides failed: ${r.status}`);
  }

  async function loadTop200(ds: string) {
    if (!selected) return;
    setBusy('load_top200');
    setErr(null);
    try {
      const url = `/api/workbench/projects/${selected.slug}/files/datasets/${encodeURIComponent(ds)}/gold_candidates_top200.csv?ts=${Date.now()}`;
      const r = await apiFetch(url);
      if (!r.ok) throw new Error(`Load top200 failed: ${r.status}`);
      const text = await r.text();
      const rows = parseGoldCsv(text);
      setGoldRows(rows);
      await loadOverrides(ds);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  function openGoldEditor(row: GoldRow) {
    setActiveGold(row);
    const ov = overrides.crop_overrides?.[row.file]?.crop_box;
    setEditBox(Array.isArray(ov) && ov.length === 4 ? ov.slice() : row.crop_box ? row.crop_box.slice() : null);
    setPageView(null);
  }

  function navGold(delta: number) {
    if (!activeGold) return;
    const idx = goldRows.findIndex((r) => r.file === activeGold.file);
    if (idx < 0) return;
    const next = goldRows[idx + delta];
    if (next) openGoldEditor(next);
  }

  function updateEditBox(next: number[] | null) {
    if (!activeGold) return;
    if (!next || next.length !== 4) return;
    setEditBox(next);
    setOverrides((prev) => {
      const cur = prev.crop_overrides || {};
      return {
        crop_overrides: {
          ...cur,
          [activeGold.file]: { crop_box: next.slice() },
        },
      };
    });
  }

  function nudge(dx0: number, dy0: number, dx1: number, dy1: number) {
    if (!editBox) return;
    updateEditBox([editBox[0] + dx0, editBox[1] + dy0, editBox[2] + dx1, editBox[3] + dy1]);
  }

  function nudgeBySuggestion(s: string) {
    if (!editBox) return;
    const next = applySuggestion(editBox, s, nudgeStep);
    updateEditBox(next);
  }

  function applyAllSuggestions() {
    if (!activeGold || !editBox) return;
    const parts = String(activeGold.suggestions || '')
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!parts.length) return;
    let cur = editBox.slice();
    for (const s of parts) cur = applySuggestion(cur, s, nudgeStep);
    updateEditBox(cur);
  }

  useEffect(() => {
    if (!activeGold || !editBox) return;
    const img = pageImgRef.current;
    const cvs = previewCanvasRef.current;
    if (!img || !cvs) return;
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const size = 256;
    const pad = 18;
    cvs.width = size;
    cvs.height = size;
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, size, size);

    const [x0, y0, x1, y1] = editBox;
    const cw = Math.max(1, x1 - x0);
    const ch = Math.max(1, y1 - y0);
    const maxW = size - pad * 2;
    const maxH = size - pad * 2;
    const scale = Math.min(maxW / cw, maxH / ch);
    const dw = Math.max(1, Math.round(cw * scale));
    const dh = Math.max(1, Math.round(ch * scale));
    const dx = Math.floor((size - dw) / 2);
    const dy = Math.floor((size - dh) / 2);
    try {
      ctx.imageSmoothingEnabled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).imageSmoothingQuality = 'high';
    } catch {
      // ignore
    }
    try {
      ctx.drawImage(img, x0, y0, cw, ch, dx, dy, dw, dh);
    } catch {
      // ignore
    }
  }, [activeGold?.file, editBox?.[0], editBox?.[1], editBox?.[2], editBox?.[3]]);

  async function startExportJob() {
    if (!selected) return;
    setBusy('job');
    setErr(null);
    try {
      const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'export_dataset' }),
      });
      if (!r.ok) throw new Error(`Create export job failed: ${r.status}`);
      const json = (await r.json()) as { job?: Job };
      setJob(json.job || null);
      await loadProjectDetail(selected.slug);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!selected || !job) return;
    if (job.status === 'success' || job.status === 'fail') return;
    if (!isAppActive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await apiFetch(`/api/workbench/projects/${selected.slug}/jobs/${job.id}`);
        if (!r.ok) return;
        const json = (await r.json()) as Job;
        if (cancelled) return;
        setJob(json);
      } catch {
        // ignore
      }
    };
    const t = window.setInterval(() => void tick(), 900);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [selected, job, isAppActive]);

  useEffect(() => {
    if (!selected) return;
    loadProjectDetail(selected.slug).catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.slug]);

  if (!canUse) {
    return (
      <div className="min-h-screen bg-[#070707] text-white p-8">
        <div className="text-white/80">`墨阵·工坊` 仅支持 PC Web 端使用。</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-sm text-white/70">InkGrid</div>
          <div className="text-xl font-black tracking-wide">墨阵·工坊</div>
          <div className="text-xs text-white/50 mt-1">PC-only internal workbench</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={token}
            onChange={(e) => {
              const v = e.target.value;
              setTokenState(v);
              setToken(v);
            }}
            placeholder="admin token"
            className="w-[280px] rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={() => loadProjects().catch((e) => setErr(String(e)))}
            className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            Reload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[360px_1fr]">
        <div className="h-[calc(100vh-73px)] overflow-auto border-r border-white/10">
          <div className="p-4 border-b border-white/10">
            <div className="text-xs text-white/60">New Project</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="碑帖名"
                className="col-span-2 rounded bg-white/5 border border-white/10 px-3 py-2 text-sm"
              />
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="rounded bg-white/5 border border-white/10 px-2 py-2 text-sm font-mono"
              >
                <option value="vertical_rtl">vertical_rtl</option>
                <option value="horizontal_ltr">horizontal_ltr</option>
              </select>
              <input
                value={cols}
                onChange={(e) => setCols(Number(e.target.value) || 0)}
                type="number"
                min={1}
                placeholder="cols"
                className="rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
              />
              <input
                value={rows}
                onChange={(e) => setRows(Number(e.target.value) || 0)}
                type="number"
                min={1}
                placeholder="rows"
                className="rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
              />
              <button
                disabled={busy === 'create' || !name.trim()}
                onClick={() => void createProject()}
                className="col-span-2 rounded bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {busy === 'create' ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>

          {projects.map((p) => {
            const active = selected?.slug === p.slug;
            return (
              <button
                key={p.slug}
                onClick={() => {
                  setSelected(p);
                  setJob(null);
                  setPages([]);
                  setJobs([]);
                  setDatasets([]);
                }}
                className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 ${
                  active ? 'bg-white/10' : ''
                }`}
              >
                <div className="font-black tracking-wide">{p.name}</div>
                <div className="mt-1 text-xs text-white/60 font-mono">{p.slug}</div>
                <div className="mt-1 text-xs text-white/50">
                  {p.direction || '-'} · {p.grid?.cols || '-'}x{p.grid?.rows || '-'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="h-[calc(100vh-73px)] overflow-auto p-6">
          {err ? <div className="text-red-300 mb-4">{err}</div> : null}

          {!selected ? (
            <div className="text-white/60">Select a project</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Project</div>
                    <div className="text-2xl font-black tracking-wide">{selected.name}</div>
                    <div className="mt-1 text-xs text-white/50 font-mono">
                      {selected.slug} · {selected.direction} · {selected.grid?.cols}x{selected.grid?.rows}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm cursor-pointer hover:bg-white/15">
                      Upload pages
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => void uploadPages(e.target.files)}
                      />
                    </label>
                    <button
                      disabled={busy === 'job'}
                      onClick={() => void startJob()}
                      className="rounded bg-amber-500/20 border border-amber-400/30 px-3 py-2 text-sm hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      {busy === 'job' ? 'Starting...' : 'Run Auto Annotate'}
                    </button>

                    <button
                      disabled={busy === 'ml_refine'}
                      onClick={() => void startMlRefineJob()}
                      className="rounded bg-emerald-500/15 border border-emerald-400/30 px-3 py-2 text-sm hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {busy === 'ml_refine' ? 'Running...' : 'ML Refine Dataset'}
                    </button>

                    <button
                      disabled={busy === 'ml_align'}
                      onClick={() => void startMlAlignSplitJob()}
                      className="rounded bg-purple-500/15 border border-purple-400/30 px-3 py-2 text-sm hover:bg-purple-500/20 disabled:opacity-50"
                    >
                      {busy === 'ml_align' ? 'Running...' : 'ML Align + Split'}
                    </button>
                    <a
                      href={`/api/workbench/projects/${selected.slug}/list?path=datasets/${encodeURIComponent(
                        job?.outputs?.dataset_dir || datasets[datasets.length - 1] || 'chars_workbench_v1',
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15"
                    >
                      Browse Dataset
                    </a>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="col-span-3 text-xs text-white/60">Models (local paths)</div>
                  <input
                    value={detectorModel}
                    onChange={(e) => setDetectorModel(e.target.value)}
                    placeholder="detector best.pt (e.g. ~/InkGridWorkbench/models/detectors/.../best.pt)"
                    className="col-span-3 rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                  />
                  <input
                    value={classifierModel}
                    onChange={(e) => setClassifierModel(e.target.value)}
                    placeholder="classifier best.pt (optional)"
                    className="col-span-3 rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                  />
                  <input
                    value={classifierClassesJson}
                    onChange={(e) => setClassifierClassesJson(e.target.value)}
                    placeholder="classifier classes.json (optional)"
                    className="col-span-3 rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                  />
                  <button
                    disabled={busy === 'save_project'}
                    onClick={() => void saveProjectSettings()}
                    className="col-span-3 rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    {busy === 'save_project' ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="col-span-3 text-xs text-white/60">Crop Overrides</div>
                  <input
                    value={applyDataset}
                    onChange={(e) => setApplyDataset(e.target.value)}
                    placeholder="dataset_dir to apply overrides (defaults to latest)"
                    className="col-span-2 rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                  />
                  <button
                    disabled={busy === 'apply_overrides'}
                    onClick={() => void startApplyOverridesJob()}
                    className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    {busy === 'apply_overrides' ? 'Applying...' : 'Apply Overrides'}
                  </button>
                </div>

                <div className="mt-4 rounded border border-white/10 bg-black/40 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/60">Top200 Review</div>
                      <div className="text-[11px] text-white/40 font-mono">
                        Fix clipping cases fast; saves to crop_overrides.json
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={goldDataset}
                        onChange={(e) => setGoldDataset(e.target.value)}
                        placeholder="dataset_dir"
                        className="w-[220px] rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                      />
                      <button
                        disabled={busy === 'load_top200'}
                        onClick={() => {
                          const ds = effectiveDatasetDir();
                          if (ds) void loadTop200(ds);
                        }}
                        className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                      >
                        {busy === 'load_top200' ? 'Loading...' : 'Load Top200'}
                      </button>
                      <button
                        onClick={() => {
                          const ds = effectiveDatasetDir();
                          if (!ds) return;
                          setBusy('save_overrides');
                          void saveOverrides(ds)
                            .catch((e) => setErr(String(e)))
                            .finally(() => setBusy(null));
                        }}
                        disabled={busy === 'save_overrides'}
                        className="rounded bg-amber-500/15 border border-amber-400/30 px-3 py-2 text-sm hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {busy === 'save_overrides' ? 'Saving...' : 'Save Overrides'}
                      </button>
                    </div>
                  </div>

                  {goldRows.length ? (
                    <div className="mt-3 grid grid-cols-[1fr_260px] gap-3">
                      <div className="max-h-[360px] overflow-auto rounded border border-white/10">
                        {goldRows.map((r) => (
                          <button
                            key={`${r.rank}_${r.file}`}
                            onClick={() => openGoldEditor(r)}
                            className={
                              'w-full text-left px-3 py-2 border-b border-white/5 hover:bg-white/5 ' +
                              (activeGold?.file === r.file ? 'bg-white/10' : '')
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-mono text-xs text-white/70">
                                #{r.rank} · {r.char || '?'} · {r.file}
                              </div>
                              <div className="font-mono text-[11px] text-white/40">{r.score.toFixed(1)}</div>
                            </div>
                            <div className="mt-1 text-[11px] text-white/50 font-mono truncate">
                              {r.flags} {r.suggestions ? `· ${r.suggestions}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="rounded border border-white/10 bg-black/30 p-3">
                        <div className="text-xs text-white/60">Quick Fix</div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button onClick={() => nudge(-6, 0, 0, 0)} className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs">
                            expand_left
                          </button>
                          <button onClick={() => nudge(0, 0, 6, 0)} className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs">
                            expand_right
                          </button>
                          <button onClick={() => nudge(0, -6, 0, 0)} className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs">
                            expand_top
                          </button>
                          <button onClick={() => nudge(0, 0, 0, 6)} className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs">
                            expand_bottom
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-white/40 font-mono">
                          Tip: Save Overrides → Apply Overrides
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-white/50">No top200 loaded yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Text / Alignment (V1)</div>
                    <div className="text-xs text-white/40">
                      Paste text_trad (length should equal total cells).
                    </div>
                  </div>
                  <button
                    disabled={busy === 'fetch_text'}
                    onClick={() => void fetchText()}
                    className="rounded bg-cyan-500/20 border border-cyan-400/30 px-3 py-2 text-sm"
                  >
                    {busy === 'fetch_text' ? 'Fetching...' : 'Search Text'}
                  </button>
                </div>

                {textCandidates ? (
                  <div className="mt-3 text-xs text-white/60">
                    <div className="font-mono">query: {textCandidates.query || '-'}</div>
                    {textCandidates.warning ? (
                      <div className="text-amber-300 mt-1">{textCandidates.warning}</div>
                    ) : null}
                    {Array.isArray(textCandidates.results) && textCandidates.results.length ? (
                      <div className="mt-2 max-h-[180px] overflow-auto rounded border border-white/10 bg-black/40">
                        {textCandidates.results.slice(0, 10).map((it, idx) => (
                          <div key={idx} className="px-3 py-2 border-b border-white/5">
                            <div className="text-white/80">{it.title || '(untitled)'}</div>
                            {it.url ? (
                              <a className="text-cyan-300 font-mono" href={it.url} target="_blank" rel="noreferrer">
                                {it.url}
                              </a>
                            ) : null}
                            {it.snippet ? <div className="text-white/50 mt-1">{it.snippet}</div> : null}
                            {it.text_trad ? (
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="text-white/40 text-[11px] truncate">
                                  extracted len={it.text_trad.length}
                                </div>
                                <button
                                  onClick={() => setTextTrad(it.text_trad || '')}
                                  className="rounded bg-white/10 border border-white/10 px-2 py-1 text-[11px] hover:bg-white/15"
                                >
                                  Use
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <textarea
                  value={textTrad}
                  onChange={(e) => setTextTrad(e.target.value)}
                  placeholder="text_trad..."
                  className="mt-3 w-full h-[160px] rounded bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-white/50">
                    len={textTrad.length} · cells={totalCells || '-'}
                    {totalCells && textTrad.length && textTrad.length !== totalCells ? (
                      <span className="text-amber-300"> · mismatch</span>
                    ) : null}
                  </div>
                  <button
                    disabled={busy === 'save_text'}
                    onClick={() => void saveAlignmentText()}
                    className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    {busy === 'save_text' ? 'Saving...' : 'Save Text'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="text-xs text-white/60">Project Settings</div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <select
                    value={editDirection}
                    onChange={(e) => setEditDirection(e.target.value as any)}
                    className="rounded bg-white/5 border border-white/10 px-2 py-2 text-sm font-mono"
                  >
                    <option value="vertical_rtl">vertical_rtl</option>
                    <option value="horizontal_ltr">horizontal_ltr</option>
                  </select>
                  <input
                    value={editCols}
                    onChange={(e) => setEditCols(Number(e.target.value) || 0)}
                    type="number"
                    min={1}
                    className="rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                  />
                  <input
                    value={editRows}
                    onChange={(e) => setEditRows(Number(e.target.value) || 0)}
                    type="number"
                    min={1}
                    className="rounded bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono"
                  />
                  <button
                    disabled={busy === 'save_project'}
                    onClick={() => void saveProjectSettings()}
                    className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    {busy === 'save_project' ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <div className="mt-2 text-xs text-white/50">
                  Default grid; per-page override below.
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Pages</div>
                    <div className="text-xs text-white/40">Per-page override supported</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {pages.map((p, i) => {
                    const src = `/steles/unknown/${selected.slug}/pages_raw/${p.image}`;
                    return (
                      <div key={p.image} className="rounded border border-white/10 bg-black/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-mono text-white/70 truncate">{p.image}</div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditor(p)}
                              className="rounded bg-cyan-500/15 border border-cyan-400/25 px-2 py-1 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              disabled={busy === 'save_pages' || i === 0}
                              onClick={() => {
                                const next = pages.slice();
                                const t = next[i - 1];
                                next[i - 1] = next[i];
                                next[i] = t;
                                void savePages(next);
                              }}
                              className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              disabled={busy === 'save_pages' || i === pages.length - 1}
                              onClick={() => {
                                const next = pages.slice();
                                const t = next[i + 1];
                                next[i + 1] = next[i];
                                next[i] = t;
                                void savePages(next);
                              }}
                              className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              disabled={busy === 'delete_page'}
                              onClick={() => void deletePage(p.image)}
                              className="rounded bg-red-500/20 border border-red-400/30 px-2 py-1 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <img src={src} className="mt-2 w-full rounded bg-black" />

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <select
                            value={(p.override?.direction as any) || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = pages.map((x) =>
                                x.image === p.image
                                  ? {
                                      ...x,
                                      override: {
                                        ...(x.override || {}),
                                        direction: v || undefined,
                                      },
                                    }
                                  : x,
                              );
                              void savePages(next);
                            }}
                            className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono"
                          >
                            <option value="">(default)</option>
                            <option value="vertical_rtl">vertical_rtl</option>
                            <option value="horizontal_ltr">horizontal_ltr</option>
                          </select>
                          <input
                            value={p.override?.cols ?? ''}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const next = pages.map((x) =>
                                x.image === p.image
                                  ? {
                                      ...x,
                                      override: { ...(x.override || {}), cols: v || undefined },
                                    }
                                  : x,
                              );
                              void savePages(next);
                            }}
                            type="number"
                            min={1}
                            placeholder="cols"
                            className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono"
                          />
                          <input
                            value={p.override?.rows ?? ''}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const next = pages.map((x) =>
                                x.image === p.image
                                  ? {
                                      ...x,
                                      override: { ...(x.override || {}), rows: v || undefined },
                                    }
                                  : x,
                              );
                              void savePages(next);
                            }}
                            type="number"
                            min={1}
                            placeholder="rows"
                            className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence>
                {editorPage ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/70"
                  >
                    <div className="absolute inset-6 rounded-xl border border-white/10 bg-[#070707] shadow-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-white/50">Page Editor</div>
                          <div className="font-mono text-sm text-white/80">{editorPage.image}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (!selected) return;
                              runPreview(editorPage.image);
                            }}
                            className="rounded bg-amber-500/20 border border-amber-400/30 px-3 py-2 text-sm"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => {
                              void startExportJob();
                            }}
                            className="rounded bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm"
                          >
                            Confirm Export
                          </button>
                          <button
                            onClick={() => {
                              setEditorPage(null);
                            }}
                            className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_360px] h-[calc(100%-65px)]">
                        <div className="relative bg-black overflow-hidden">
                          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                            <div className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs font-mono">
                              zoom={zoom.toFixed(2)}
                            </div>
                            <button
                              onClick={() => setZoom((z) => clamp(z * 1.1, 0.25, 4))}
                              className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs"
                            >
                              +
                            </button>
                            <button
                              onClick={() => setZoom((z) => clamp(z / 1.1, 0.25, 4))}
                              className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs"
                            >
                              -
                            </button>
                            <button
                              onClick={() => {
                                setZoom(1.0);
                                setPan({ x: 0, y: 0 });
                              }}
                              className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs"
                            >
                              Reset
                            </button>
                          </div>

                          <div
                            className="absolute inset-0"
                            onWheel={(e) => {
                              e.preventDefault();
                              const delta = e.deltaY;
                              setZoom((z) => clamp(delta > 0 ? z / 1.08 : z * 1.08, 0.25, 4));
                            }}
                            onMouseDown={(e) => {
                              // start pan if clicking background
                              if ((e.target as any).dataset?.kind) return;
                              setDrag({
                                kind: 'pan',
                                index: -1,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                startVal: 0,
                              });
                            }}
                            onMouseMove={(e) => {
                              if (!drag) return;
                              if (drag.kind === 'pan' && drag.index === -1) {
                                setPan((p) => ({
                                  x: p.x + (e.clientX - drag.startClientX),
                                  y: p.y + (e.clientY - drag.startClientY),
                                }));
                                setDrag({ ...drag, startClientX: e.clientX, startClientY: e.clientY });
                                return;
                              }

                              if (!editorImg) return;
                              if (!layout) return;
                              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                              const x = (e.clientX - rect.left - pan.x) / zoom;
                              const y = (e.clientY - rect.top - pan.y) / zoom;

                              if (drag.kind === 'col') {
                                if (layout.direction === 'vertical_rtl') {
                                  const bounds = Array.isArray(layout.col_bounds) ? layout.col_bounds.map(Number) : null;
                                  if (!bounds) return;
                                  const next = { ...layout, col_bounds: setBoundary(bounds, drag.index, x) };
                                  setLayout(next);
                                } else {
                                  const colsByRow = Array.isArray(layout.col_bounds_by_row)
                                    ? layout.col_bounds_by_row.map((r: any) => (Array.isArray(r) ? r.map(Number) : r))
                                    : null;
                                  if (!colsByRow) return;
                                  const lane = Number(drag.lane || 0);
                                  const cb = colsByRow[lane];
                                  colsByRow[lane] = setBoundary(cb, drag.index, x);
                                  const next = { ...layout, col_bounds_by_row: colsByRow };
                                  setLayout(next);
                                }
                              } else if (drag.kind === 'row') {
                                if (layout.direction === 'vertical_rtl') {
                                  const rowsByCol = Array.isArray(layout.row_bounds_by_col)
                                    ? layout.row_bounds_by_col.map((r: any) => (Array.isArray(r) ? r.map(Number) : r))
                                    : null;
                                  if (!rowsByCol) return;
                                  const lane = Number(drag.lane || 0);
                                  const rb = rowsByCol[lane];
                                  rowsByCol[lane] = setBoundary(rb, drag.index, y);
                                  const next = { ...layout, row_bounds_by_col: rowsByCol };
                                  setLayout(next);
                                } else {
                                  const bounds = Array.isArray(layout.row_bounds) ? layout.row_bounds.map(Number) : null;
                                  if (!bounds) return;
                                  const next = { ...layout, row_bounds: setBoundary(bounds, drag.index, y) };
                                  setLayout(next);
                                }
                              }
                            }}
                            onMouseUp={() => {
                              if (!drag) return;
                              if (drag.kind === 'pan') {
                                setDrag(null);
                                return;
                              }
                              const pageImage = editorPage.image;
                              const nextLayout = layout;
                              setDrag(null);
                              if (nextLayout) {
                                void persistLayoutAndPreview(pageImage, nextLayout);
                              }
                            }}
                          >
                            <div
                              className="absolute top-0 left-0"
                              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}
                            >
                              <img
                                src={`/steles/unknown/${selected?.slug}/pages_raw/${editorPage.image}`}
                                onLoad={(e) => setEditorImg(e.currentTarget)}
                                className="block select-none"
                                draggable={false}
                              />
                              {editorImg ? (
                                <svg
                                  width={editorImg.naturalWidth}
                                  height={editorImg.naturalHeight}
                                  className="absolute top-0 left-0"
                                >
                                  {layout?.direction === 'vertical_rtl' && Array.isArray(layout?.col_bounds)
                                    ? layout.col_bounds.map((v: any) => Number(v)).slice(1, -1).map((x: number, i: number) => (
                                        <g key={`col-${i}`}>
                                          <line
                                            x1={x}
                                            y1={0}
                                            x2={x}
                                            y2={editorImg.naturalHeight}
                                            stroke="rgba(0,200,255,0.9)"
                                            strokeWidth={2}
                                          />
                                          <line
                                            data-kind="col"
                                            x1={x}
                                            y1={0}
                                            x2={x}
                                            y2={editorImg.naturalHeight}
                                            stroke="rgba(0,0,0,0)"
                                            strokeWidth={14}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              const rect = (e.currentTarget.ownerSVGElement as any).getBoundingClientRect();
                                              const localX = (e.clientX - rect.left) / zoom;
                                              setDrag({
                                                kind: 'col',
                                                index: i + 1,
                                                startClientX: e.clientX,
                                                startClientY: e.clientY,
                                                startVal: localX,
                                              });
                                            }}
                                          />
                                        </g>
                                      ))
                                    : null}

                                  {layout?.direction === 'horizontal_ltr' && Array.isArray(layout?.row_bounds)
                                    ? layout.row_bounds
                                        .map((v: any) => Number(v))
                                        .slice(1, -1)
                                        .map((y: number, i: number) => (
                                          <g key={`hr-${i}`}>
                                            <line
                                              x1={0}
                                              y1={y}
                                              x2={editorImg.naturalWidth}
                                              y2={y}
                                              stroke="rgba(0,200,255,0.9)"
                                              strokeWidth={2}
                                            />
                                            <line
                                              data-kind="row"
                                              x1={0}
                                              y1={y}
                                              x2={editorImg.naturalWidth}
                                              y2={y}
                                              stroke="rgba(0,0,0,0)"
                                              strokeWidth={14}
                                              onMouseDown={(e) => {
                                                e.stopPropagation();
                                                const rect = (e.currentTarget.ownerSVGElement as any).getBoundingClientRect();
                                                const localY = (e.clientY - rect.top) / zoom;
                                                setDrag({
                                                  kind: 'row',
                                                  index: i + 1,
                                                  startClientX: e.clientX,
                                                  startClientY: e.clientY,
                                                  startVal: localY,
                                                });
                                              }}
                                            />
                                          </g>
                                        ))
                                    : null}

                                  {layout?.direction === 'vertical_rtl' && Array.isArray(layout?.col_bounds) && Array.isArray(layout?.row_bounds_by_col)
                                    ? (() => {
                                        const cb = layout.col_bounds.map((v: any) => Number(v));
                                        const col = clamp(activeLane, 0, cb.length - 2);
                                        const x0 = cb[col];
                                        const x1 = cb[col + 1];
                                        const rowsArr = Array.isArray(layout.row_bounds_by_col[col]) ? layout.row_bounds_by_col[col].map((v: any) => Number(v)) : [];
                                        return rowsArr.slice(1, -1).map((y: number, j: number) => (
                                          <g key={`row-${col}-${j}`}>
                                            <line x1={x0} y1={y} x2={x1} y2={y} stroke="rgba(0,200,255,0.9)" strokeWidth={2} />
                                            <line
                                              data-kind="row"
                                              x1={x0}
                                              y1={y}
                                              x2={x1}
                                              y2={y}
                                              stroke="rgba(0,0,0,0)"
                                              strokeWidth={14}
                                              onMouseDown={(e) => {
                                                e.stopPropagation();
                                                const rect = (e.currentTarget.ownerSVGElement as any).getBoundingClientRect();
                                                const localY = (e.clientY - rect.top) / zoom;
                                                setDrag({
                                                  kind: 'row',
                                                  index: j + 1,
                                                  lane: col,
                                                  startClientX: e.clientX,
                                                  startClientY: e.clientY,
                                                  startVal: localY,
                                                });
                                              }}
                                            />
                                          </g>
                                        ));
                                      })()
                                    : null}

                                  {layout?.direction === 'horizontal_ltr' && Array.isArray(layout?.row_bounds) && Array.isArray(layout?.col_bounds_by_row)
                                    ? (() => {
                                        const rb = layout.row_bounds.map((v: any) => Number(v));
                                        const lane = clamp(activeLane, 0, rb.length - 2);
                                        const y0 = rb[lane];
                                        const y1 = rb[lane + 1];
                                        const colsArr = Array.isArray(layout.col_bounds_by_row[lane])
                                          ? layout.col_bounds_by_row[lane].map((v: any) => Number(v))
                                          : [];
                                        return colsArr.slice(1, -1).map((x: number, j: number) => (
                                          <g key={`hc-${lane}-${j}`}>
                                            <line x1={x} y1={y0} x2={x} y2={y1} stroke="rgba(0,200,255,0.9)" strokeWidth={2} />
                                            <line
                                              data-kind="col"
                                              x1={x}
                                              y1={y0}
                                              x2={x}
                                              y2={y1}
                                              stroke="rgba(0,0,0,0)"
                                              strokeWidth={14}
                                              onMouseDown={(e) => {
                                                e.stopPropagation();
                                                const rect = (e.currentTarget.ownerSVGElement as any).getBoundingClientRect();
                                                const localX = (e.clientX - rect.left) / zoom;
                                                setDrag({
                                                  kind: 'col',
                                                  index: j + 1,
                                                  lane,
                                                  startClientX: e.clientX,
                                                  startClientY: e.clientY,
                                                  startVal: localX,
                                                });
                                              }}
                                            />
                                          </g>
                                        ));
                                      })()
                                    : null}
                                </svg>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="border-l border-white/10 bg-black/30 p-4 overflow-auto">
                          <div className="text-xs text-white/60">Inspector</div>
                          <div className="mt-2 text-xs text-white/50">
                            Click Preview to auto-compute layout. Drag lines, release to recompute.
                          </div>
                          {layout?.direction === 'vertical_rtl' && Array.isArray(layout?.col_bounds) ? (
                            <div className="mt-3">
                              <div className="text-xs text-white/60">Active Column</div>
                              <input
                                type="range"
                                min={0}
                                max={Math.max(0, Number(layout.col_bounds.length) - 2)}
                                value={activeLane}
                                onChange={(e) => setActiveLane(Number(e.target.value) || 0)}
                                className="w-full"
                              />
                              <div className="text-xs text-white/40 font-mono">col={activeLane}</div>
                            </div>
                          ) : null}

                          {layout?.direction === 'horizontal_ltr' && Array.isArray(layout?.row_bounds) ? (
                            <div className="mt-3">
                              <div className="text-xs text-white/60">Active Row</div>
                              <input
                                type="range"
                                min={0}
                                max={Math.max(0, Number(layout.row_bounds.length) - 2)}
                                value={activeLane}
                                onChange={(e) => setActiveLane(Number(e.target.value) || 0)}
                                className="w-full"
                              />
                              <div className="text-xs text-white/40 font-mono">row={activeLane}</div>
                            </div>
                          ) : null}
                          {previewJob ? (
                            <div className="mt-3 rounded border border-white/10 bg-black/40 p-3">
                              <div className="text-xs text-white/50">preview job</div>
                              <div className="font-mono text-xs">{previewJob.status} · {previewJob.stage} · {previewJob.progress}%</div>
                              {previewJob.outputs?.grid_png_url ? (
                                <img
                                  src={`${previewJob.outputs.grid_png_url}?ts=${Date.now()}`}
                                  className="mt-2 w-full rounded bg-black"
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="text-xs text-white/60">Datasets</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {datasets.length ? (
                    datasets.map((d) => (
                      <a
                        key={d}
                        href={`/api/workbench/projects/${selected.slug}/list?path=datasets/${encodeURIComponent(d)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs font-mono hover:bg-white/15"
                      >
                        {d}
                      </a>
                    ))
                  ) : (
                    <div className="text-xs text-white/50">No datasets yet</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="text-xs text-white/60">Jobs</div>
                <div className="mt-2 space-y-2">
                  {jobs.length ? (
                    jobs.slice(0, 12).map((j) => (
                      <div key={j.id} className="rounded border border-white/10 bg-black/40 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-xs text-white/70">{j.id}</div>
                          <div className="text-xs text-white/50">
                            {j.status} · {j.stage} · {j.progress}%
                          </div>
                        </div>
                        {j.outputs?.zip_url ? (
                          <div className="mt-2">
                            <a
                              href={j.outputs.zip_url}
                              className="rounded bg-emerald-500/20 border border-emerald-400/30 px-2 py-1 text-xs"
                            >
                              Download ZIP
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-white/50">No jobs yet</div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {job ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="rounded-lg border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/60">Job</div>
                        <div className="font-mono text-sm">{job.id}</div>
                        <div className="mt-1 text-xs text-white/50">
                          {job.status} · {job.stage} · {job.progress}%
                        </div>
                      </div>
                      {job.outputs?.zip_url ? (
                        <a
                          href={job.outputs.zip_url}
                          className="rounded bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm"
                        >
                          Download ZIP
                        </a>
                      ) : null}
                    </div>
                    {job.outputs?.dataset_url ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {job.outputs.qa_summary_url ? (
                          <a
                            href={job.outputs.qa_summary_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs font-mono"
                          >
                            qa_summary
                          </a>
                        ) : null}

                        {job.outputs.gold_candidates_url ? (
                          <a
                            href={job.outputs.gold_candidates_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs font-mono"
                          >
                            top200.csv
                          </a>
                        ) : null}

                        {job.outputs.aligned_url ? (
                          <a
                            href={job.outputs.aligned_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs font-mono"
                          >
                            aligned.json
                          </a>
                        ) : null}
                        {job.outputs.overlays_url ? (
                          <a
                            href={job.outputs.overlays_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs font-mono"
                          >
                            overlays
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {job.log_tail ? (
                      <pre className="mt-3 max-h-[320px] overflow-auto text-xs text-white/70 whitespace-pre-wrap font-mono bg-black/40 border border-white/10 rounded p-3">
                        {job.log_tail}
                      </pre>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && activeGold && editBox ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/80"
            onClick={() => {
              setActiveGold(null);
              setEditBox(null);
            }}
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="absolute left-1/2 top-1/2 w-[min(1100px,96vw)] h-[min(760px,92vh)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#0B0B0B] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-white/50 font-mono truncate">
                    {activeGold.page} · {activeGold.file}
                  </div>
                  <div className="text-lg font-black tracking-wide">
                    {activeGold.char || '?'}
                    <span className="text-xs text-white/40 font-mono ml-2">idx={activeGold.index}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navGold(-1)}
                    className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => navGold(1)}
                    className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => {
                      const ds = effectiveDatasetDir();
                      if (!ds) return;
                      setBusy('save_overrides');
                      void saveOverrides(ds)
                        .catch((e) => setErr(String(e)))
                        .finally(() => setBusy(null));
                    }}
                    className="rounded bg-amber-500/15 border border-amber-400/30 px-3 py-2 text-sm"
                  >
                    Save Override
                  </button>
                  <button
                    onClick={() => {
                      setActiveGold(null);
                      setEditBox(null);
                    }}
                    className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_360px] h-[calc(100%-54px)]">
                <div ref={pageBoxRef} className="relative bg-black">
                  <img
                    src={`/api/workbench/projects/${selected.slug}/files/${String(activeGold.page || '').replace(/^\/+/, '')}?ts=${Date.now()}`}
                    className="absolute inset-0 w-full h-full object-contain"
                    alt={activeGold.page}
                    ref={pageImgRef}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      const nw = img.naturalWidth || 0;
                      const nh = img.naturalHeight || 0;
                      const box = pageBoxRef.current?.getBoundingClientRect();
                      if (!box || !nw || !nh) return;
                      setPageView({ cw: box.width, ch: box.height, nw, nh });
                    }}
                  />

                  {/* Visual crop box overlay */}
                  {pageView ? (
                    (() => {
                      const scale = Math.min(pageView.cw / pageView.nw, pageView.ch / pageView.nh);
                      const dw = pageView.nw * scale;
                      const dh = pageView.nh * scale;
                      const ox = (pageView.cw - dw) / 2;
                      const oy = (pageView.ch - dh) / 2;
                      const x0 = ox + editBox[0] * scale;
                      const y0 = oy + editBox[1] * scale;
                      const w = Math.max(1, (editBox[2] - editBox[0]) * scale);
                      const h = Math.max(1, (editBox[3] - editBox[1]) * scale);
                      return (
                        <div className="absolute inset-0 pointer-events-none">
                          <div
                            className="absolute rounded border-2 border-amber-400/80 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
                            style={{ left: x0, top: y0, width: w, height: h }}
                          />
                        </div>
                      );
                    })()
                  ) : null}
                </div>

                <div className="p-4 border-l border-white/10 bg-[#0B0B0B] overflow-auto">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/60">preview</div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-white/40 font-mono">step</div>
                      <input
                        value={String(nudgeStep)}
                        onChange={(e) => setNudgeStep(Number(e.target.value) || 6)}
                        className="w-[64px] rounded bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded border border-white/10 bg-black/30 p-2">
                      <div className="text-[10px] text-white/40 font-mono">current</div>
                      <img
                        src={`/api/workbench/projects/${selected.slug}/files/datasets/${encodeURIComponent(
                          effectiveDatasetDir(),
                        )}/${encodeURIComponent(activeGold.file)}?ts=${Date.now()}`}
                        className="mt-2 w-full rounded bg-black"
                      />
                    </div>
                    <div className="rounded border border-white/10 bg-black/30 p-2">
                      <div className="text-[10px] text-white/40 font-mono">edited (live)</div>
                      <canvas ref={previewCanvasRef} className="mt-2 w-full rounded bg-black" />
                    </div>
                  </div>

                  <div className="text-xs text-white/60">crop_box</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['x0', 'y0', 'x1', 'y1'] as const).map((k, i) => (
                      <label key={k} className="text-[11px] text-white/50 font-mono">
                        {k}
                        <input
                          value={String(editBox[i] ?? '')}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isFinite(v)) return;
                            const next = editBox.slice();
                            next[i] = Math.round(v);
                            // keep ordering
                            next[2] = Math.max(next[2], next[0] + 1);
                            next[3] = Math.max(next[3], next[1] + 1);
                            updateEditBox(next);
                          }}
                          className="mt-1 w-full rounded bg-white/5 border border-white/10 px-2 py-2 text-sm text-white"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 text-xs text-white/60">nudge</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => nudge(-nudgeStep, 0, 0, 0)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      left +6
                    </button>
                    <button
                      onClick={() => nudge(0, 0, nudgeStep, 0)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      right +6
                    </button>
                    <button
                      onClick={() => nudge(0, -nudgeStep, 0, 0)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      top +6
                    </button>
                    <button
                      onClick={() => nudge(0, 0, 0, nudgeStep)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      bottom +6
                    </button>
                    <button
                      onClick={() => nudge(nudgeStep, 0, 0, 0)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      x0 -6
                    </button>
                    <button
                      onClick={() => nudge(0, 0, -nudgeStep, 0)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      x1 -6
                    </button>
                    <button
                      onClick={() => nudge(0, nudgeStep, 0, 0)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      y0 -6
                    </button>
                    <button
                      onClick={() => nudge(0, 0, 0, -nudgeStep)}
                      className="rounded bg-white/10 border border-white/10 px-2 py-2 text-xs"
                    >
                      y1 -6
                    </button>
                  </div>

                  {activeGold.suggestions ? (
                    <div className="mt-4 rounded border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/60">suggestions</div>
                        <button
                          onClick={() => applyAllSuggestions()}
                          className="rounded bg-emerald-500/15 border border-emerald-400/30 px-2 py-1 text-xs"
                        >
                          apply all
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {String(activeGold.suggestions)
                          .split('|')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((s) => (
                            <button
                              key={s}
                              onClick={() => nudgeBySuggestion(s)}
                              className="rounded bg-white/10 border border-white/10 px-2 py-1 text-[11px] font-mono"
                            >
                              {s}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 text-[11px] text-white/40 font-mono">
                    After saving overrides, run “Apply Overrides” to re-render + QA.
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
