import React, { useEffect, useMemo, useRef, useState } from 'react';

type QaEntry = {
  index: number;
  char: string;
  file: string;
  score: number;
  flags: string[];
  suggestions?: string[];
  source: {
    image: string;
    crop_box: [number, number, number, number];
    safe_column_box?: [number, number, number, number] | null;
    line_index?: number | null;
    pos_in_line?: number | null;
  };
  metrics?: Record<string, unknown>;
};

type QaReport = {
  entries: QaEntry[];
};

type Overrides = {
  version: number;
  crop_overrides: Record<
    string,
    {
      crop_box: [number, number, number, number];
      note?: string;
    }
  >;
};

const TOKEN_KEY = 'inkgrid_admin_token';

function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers || {});
  const token = getToken();
  if (token) headers.set('X-Inkgrid-Admin-Token', token);
  return fetch(path, { ...opts, headers });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function CropPreview({
  src,
  cropBox,
  label,
}: {
  src: string;
  cropBox: [number, number, number, number];
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    imgRef.current = img;
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const [x0, y0, x1, y1] = cropBox;
      const w = Math.max(1, x1 - x0);
      const h = Math.max(1, y1 - y0);

      const maxSide = 420;
      const scale = Math.min(maxSide / w, maxSide / h);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      canvas.width = cw;
      canvas.height = ch;
      ctx.clearRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x0, y0, w, h, 0, 0, cw, ch);
    };
  }, [src, cropBox]);

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-xs text-white/70">{label}</div>
      <canvas ref={canvasRef} className="mt-2 block max-w-full rounded bg-black" />
    </div>
  );
}

export function SteleAnnotator() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const stelePath = params.get('stele') || '4-xingshu/1-lantingjixu';
  const [datasetDir, setDatasetDir] = useState(
    params.get('dataset') || 'chars_shenlong_v21',
  );

  const [datasets, setDatasets] = useState<string[]>([]);

  const [report, setReport] = useState<QaReport | null>(null);
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editBox, setEditBox] = useState<[number, number, number, number] | null>(
    null,
  );

  const qaUrl = `/steles/${stelePath}/${datasetDir}/qa_report.json`;

  function updateUrl(nextDataset: string) {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('mode', 'annotator');
      u.searchParams.set('stele', stelePath);
      u.searchParams.set('dataset', nextDataset);
      window.history.replaceState({}, '', u.toString());
    } catch {
      // ignore
    }
  }

  async function loadAll() {
    setErr(null);
    const r = await fetch(`${qaUrl}?ts=${Date.now()}`);
    if (!r.ok) throw new Error(`Failed to load QA report: ${r.status}`);
    const qa = (await r.json()) as QaReport;
    setReport(qa);
    const o = await apiFetch(`/api/annotator/overrides/${stelePath}`);
    if (!o.ok) throw new Error(`Failed to load overrides: ${o.status}`);
    const ov = (await o.json()) as Overrides;
    setOverrides(ov);

    if (!selectedFile && qa.entries.length) {
      setSelectedFile(qa.entries[0].file);
    }
  }

  useEffect(() => {
    loadAll().catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await apiFetch(`/api/annotator/datasets/${stelePath}`);
        if (!r.ok) throw new Error(`Failed to list datasets: ${r.status}`);
        const json = (await r.json()) as { datasets?: string[] };
        if (cancelled) return;
        const list = Array.isArray(json.datasets) ? json.datasets : [];
        setDatasets(list);
      } catch {
        if (cancelled) return;
        setDatasets([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [stelePath]);

  const entries = report?.entries || [];
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return entries;
    return entries.filter((e) => {
      return (
        e.file.includes(q) ||
        e.char.includes(q) ||
        e.flags?.some((f) => f.includes(q))
      );
    });
  }, [entries, search]);

  const selected = useMemo(() => {
    if (!selectedFile) return null;
    return entries.find((e) => e.file === selectedFile) || null;
  }, [entries, selectedFile]);

  useEffect(() => {
    if (!selected) return;
    const ov = overrides?.crop_overrides?.[selected.file];
    setEditBox(ov?.crop_box || selected.source.crop_box);
  }, [selected, overrides]);

  function adjustBox(delta: Partial<{ x0: number; y0: number; x1: number; y1: number }>) {
    if (!selected || !editBox) return;
    const [x0, y0, x1, y1] = editBox;
    const safe = selected.source.safe_column_box;
    const minX = safe ? safe[0] : -1e9;
    const maxX = safe ? safe[2] : 1e9;

    let nx0 = x0 + (delta.x0 || 0);
    let ny0 = y0 + (delta.y0 || 0);
    let nx1 = x1 + (delta.x1 || 0);
    let ny1 = y1 + (delta.y1 || 0);

    nx0 = clamp(nx0, minX, nx1 - 1);
    nx1 = clamp(nx1, nx0 + 1, maxX);
    ny0 = Math.max(0, Math.min(ny0, ny1 - 1));
    ny1 = Math.max(ny0 + 1, ny1);
    setEditBox([Math.round(nx0), Math.round(ny0), Math.round(nx1), Math.round(ny1)]);
  }

  function applySuggestion(s: string, step: number) {
    if (!selected || !editBox) return;
    if (s === 'expand_left') adjustBox({ x0: -step });
    else if (s === 'expand_right') adjustBox({ x1: step });
    else if (s === 'expand_top') adjustBox({ y0: -step });
    else if (s === 'expand_bottom') adjustBox({ y1: step });
  }

  async function saveOverride() {
    if (!selected || !editBox) return;
    if (!overrides) return;
    setBusy('save');
    setErr(null);
    try {
      const next: Overrides = {
        version: 1,
        crop_overrides: {
          ...(overrides.crop_overrides || {}),
          [selected.file]: {
            crop_box: editBox,
          },
        },
      };
      const r = await apiFetch(`/api/annotator/overrides/${stelePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!r.ok) throw new Error(`Save failed: ${r.status}`);
      const saved = (await r.json()) as Overrides;
      setOverrides(saved);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function applyOverride() {
    if (!selected) return;
    setBusy('apply');
    setErr(null);
    try {
      const r = await apiFetch(`/api/annotator/apply/${stelePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_dir: datasetDir,
          only_files: [selected.file],
          run_qa: true,
        }),
      });
      if (!r.ok) throw new Error(`Apply failed: ${r.status}`);
      await loadAll();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  if (err) {
    return (
      <div className="min-h-screen bg-[#070707] text-white p-6">
        <div className="text-red-300">{err}</div>
      </div>
    );
  }

  if (!report || !overrides) {
    return (
      <div className="min-h-screen bg-[#070707] text-white p-6">Loading...</div>
    );
  }

  const outBase = `/steles/${stelePath}/${datasetDir}`;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-sm text-white/70">Stele</div>
          <div className="font-mono text-sm">{stelePath}</div>
          <div className="mt-1 text-sm text-white/70">Dataset</div>
          <div className="mt-1 flex items-center gap-2">
            <select
              value={datasetDir}
              onChange={(e) => {
                const next = e.target.value;
                setDatasetDir(next);
                updateUrl(next);
              }}
              className="rounded bg-white/5 border border-white/10 px-2 py-1 text-sm font-mono"
            >
              {(datasets.length ? datasets : [datasetDir]).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search file/flag/char"
            className="w-[260px] rounded bg-white/5 border border-white/10 px-3 py-2 text-sm"
          />
          <button
            onClick={() => loadAll().catch((e) => setErr(String(e)))}
            className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            Reload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-0">
        <div className="h-[calc(100vh-73px)] overflow-auto border-r border-white/10">
          {filtered.map((e) => {
            const active = e.file === selectedFile;
            return (
              <button
                key={e.file}
                onClick={() => setSelectedFile(e.file)}
                className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 ${
                  active ? 'bg-white/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-white/80">{e.file}</div>
                  <div className="text-xs text-white/60">{e.score.toFixed(1)}</div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="text-base font-serif font-black">{e.char}</div>
                  <div className="text-xs text-white/60">#{String(e.index).padStart(4, '0')}</div>
                </div>
                <div className="mt-1 text-[11px] text-white/50 line-clamp-2">
                  {(e.flags || []).join(', ')}
                </div>
              </button>
            );
          })}
        </div>

        <div className="h-[calc(100vh-73px)] overflow-auto p-6">
          {!selected || !editBox ? (
            <div className="text-white/60">Select an entry</div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs text-white/70">{selected.file}</div>
                      <div className="mt-1 text-2xl font-serif font-black">{selected.char}</div>
                  <div className="mt-1 text-xs text-white/60">flags: {(selected.flags || []).join(', ')}</div>
                  <div className="mt-1 text-xs text-white/60">suggest: {(selected.suggestions || []).join(', ') || '-'}</div>
                    </div>
                    <img
                      src={`${outBase}/${selected.file}`}
                      className="w-32 h-32 rounded bg-black object-contain"
                      alt={selected.file}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                    {(['x0', 'y0', 'x1', 'y1'] as const).map((k, i) => (
                      <div key={k}>
                        <div className="text-white/60">{k}</div>
                        <input
                          value={editBox[i]}
                          onChange={(ev) => {
                            const v = Number(ev.target.value);
                            if (!Number.isFinite(v)) return;
                            const next = [...editBox] as [number, number, number, number];
                            next[i] = Math.round(v);
                            setEditBox(next);
                          }}
                          className="mt-1 w-full rounded bg-white/5 border border-white/10 px-2 py-1 font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(selected.suggestions || []).filter((s) => s.startsWith('expand_')).length ? (
                      <>
                        {(selected.suggestions || [])
                          .filter((s) => s.startsWith('expand_'))
                          .slice(0, 6)
                          .map((s) => (
                            <button
                              key={s}
                              onClick={() => applySuggestion(s, 14)}
                              className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                            >
                              {s.replace('expand_', 'Expand ') }
                            </button>
                          ))}
                      </>
                    ) : null}
                    <button
                      onClick={() => adjustBox({ y0: -10 })}
                      className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                    >
                      Expand Top
                    </button>
                    <button
                      onClick={() => adjustBox({ y1: 10 })}
                      className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                    >
                      Expand Bottom
                    </button>
                    <button
                      onClick={() => adjustBox({ x0: -10 })}
                      className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                    >
                      Expand Left
                    </button>
                    <button
                      onClick={() => adjustBox({ x1: 10 })}
                      className="rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                    >
                      Expand Right
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      disabled={busy === 'save' || busy === 'apply'}
                      onClick={() => saveOverride()}
                      className="rounded bg-amber-500/20 border border-amber-400/30 px-3 py-2 text-sm hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      {busy === 'save' ? 'Saving...' : 'Save Override'}
                    </button>
                    <button
                      disabled={busy === 'save' || busy === 'apply'}
                      onClick={() => applyOverride()}
                      className="rounded bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      {busy === 'apply' ? 'Applying...' : 'Apply + Re-QA'}
                    </button>
                  </div>
                </div>

                <CropPreview
                  src={`/steles/${stelePath}/${selected.source.image}`}
                  cropBox={editBox}
                  label="Source crop preview"
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <div className="text-sm text-white/70">Info</div>
                  <div className="mt-2 font-mono text-xs text-white/70">
                    <div>page: {selected.source.image}</div>
                    <div>
                      safe_column_box: {selected.source.safe_column_box ? selected.source.safe_column_box.join(',') : '-'}
                    </div>
                    <div>
                      line/pos: {String(selected.source.line_index ?? '-')}/{String(selected.source.pos_in_line ?? '-')}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <div className="text-sm text-white/70">How to use</div>
                  <div className="mt-2 text-sm text-white/60 leading-relaxed">
                    Edit `crop_box` in page pixels, save override, then apply to re-render the PNG and regenerate QA.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
