import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Project = {
  slug: string;
  name: string;
  direction?: string;
  grid?: { cols: number; rows: number };
  latest_dataset?: any;
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
  };
  log_tail?: string;
};

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
    }
    setPages(Array.isArray(json.pages) ? json.pages : []);
    setJobs(Array.isArray(json.jobs) ? (json.jobs as any) : []);
    setDatasets(Array.isArray(json.datasets) ? json.datasets : []);

    // best-effort load alignment text
    try {
      const rr = await apiFetch(`/steles/unknown/${slug}/workbench/alignment.json?ts=${Date.now()}`);
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
  }, [selected, previewJob]);

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
  }, [selected, job]);

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
                    <a
                      href={`/?mode=annotator&stele=unknown/${selected.slug}&dataset=${encodeURIComponent(
                        job?.outputs?.dataset_dir || datasets[datasets.length - 1] || 'chars_workbench_v1',
                      )}`}
                      className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15"
                    >
                      Open Annotator
                    </a>
                  </div>
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
                              {previewJob.outputs?.overlays_url ? (
                                <img
                                  src={`${previewJob.outputs.overlays_url}/page_grid.png?ts=${Date.now()}`}
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
                        href={`/?mode=annotator&stele=unknown/${selected.slug}&dataset=${encodeURIComponent(d)}`}
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
    </div>
  );
}
