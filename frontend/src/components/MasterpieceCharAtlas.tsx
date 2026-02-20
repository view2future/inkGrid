import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Copy, QrCode, Search, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import QRCode from 'qrcode';
import { getShareBaseUrls } from '../utils/shareBase';

const IS_NATIVE_ANDROID = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const IMG_LOADING: 'eager' | 'lazy' = IS_NATIVE_ANDROID ? 'eager' : 'lazy';
const IMG_DECODING: 'async' | 'auto' = IS_NATIVE_ANDROID ? 'auto' : 'async';

export type CharSliceIndexFile = {
  index: number;
  char: string;
  codepoint: string;
  file: string;
  source: {
    image: string;
    image_index: number;
    chunk: string;
    pos_in_chunk: number;
    grid: { col: number; row: number };
    crop_box: [number, number, number, number];
    ocr_guess?: string;
    ocr_score?: number;
    align_gold_index?: number;
    body_v3_source?: string;
  };
};

export type CharSliceIndex = {
  name: string;
  total_images: number;
  total_chars: number;
  skipped_chunk?: { chunk_index: number; text: string };
  note?: string;
  gold_text?: string;
  alignment?: { matched?: number; missing?: number; extras?: number; missing_positions?: number[] };
  files: CharSliceIndexFile[];
};

type CharAnalysis = {
  version: number;
  by_char: Record<
    string,
    {
      count: number;
      glyphIds: number[];
      similar: Record<string, number[]>;
      clusters: Array<{ id: number; members: number[]; rep: number }>;
    }
  >;
};

type Tab = 'search' | 'read';

function toChar(input: string) {
  const t = String(input || '').trim();
  if (!t) return '';
  return Array.from(t)[0] || '';
}

function baseDirFromUrl(url: string) {
  const parts = String(url || '').split('?')[0].split('#')[0].split('/');
  if (parts.length <= 1) return '/';
  parts.pop();
  return parts.join('/') + '/';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function splitIntoColumns<T>(items: T[], rowsPerCol: number) {
  const rows = Math.max(8, Math.min(40, Math.floor(rowsPerCol || 18)));
  const cols: T[][] = [];
  for (let i = 0; i < items.length; i += rows) cols.push(items.slice(i, i + rows));
  return cols;
}

function normalizeOcrToken(input: string) {
  const ch = toChar(input);
  const map: Record<string, string> = {
    '縦': '纵',
    '後': '后',
    '賦': '赋',
    '與': '与',
    '蘇': '苏',
    '鶴': '鹤',
    '烏': '乌',
    '顧': '顾',
    '耶': '邪',
    '俛': '俯',
    '悟': '寤',
    '翩': '蹁',
    '返': '反',
  };
  return map[ch] || ch;
}

function ocrCompatible(expectedChar: string, ocrGuess: string) {
  const exp = normalizeOcrToken(expectedChar);
  const ocr = normalizeOcrToken(ocrGuess);
  // Common OCR confusion in this stele.
  if (exp === '予' && ocr === '余') return true;
  return exp === ocr;
}

function chunkWithHighlight(chunk: string, index: number) {
  const chars = Array.from(String(chunk || ''));
  if (!chars.length) return [] as Array<{ ch: string; active: boolean }>;
  return chars.map((ch, i) => ({ ch, active: i === index }));
}

export function MasterpieceCharAtlasCard({
  indexUrl,
  initialChar,
  initialGlyphId,
  onOpenInPage,
}: {
  indexUrl: string;
  initialChar?: string;
  initialGlyphId?: number;
  onOpenInPage: (args: {
    pageIndex: number;
    cropBox: [number, number, number, number];
    label: string;
  }) => void;
}) {
  const debugEnabled = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQuery = qs.get('charatlas_debug') === '1' || qs.get('inkgrid_charatlas_debug') === '1';
      const fromStorage = Boolean(window.localStorage.getItem('inkgrid_charatlas_debug'));
      return fromQuery || fromStorage;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    console.log('[CharAtlas] debugEnabled', {
      debugEnabled,
      hint: 'set localStorage inkgrid_charatlas_debug=1 or add ?charatlas_debug=1',
    });
  }, [debugEnabled]);

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<CharSliceIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedChar, setSelectedChar] = useState('');
  const [selectedOccIdx, setSelectedOccIdx] = useState(0);
  const [occView, setOccView] = useState<'grid' | 'similar' | 'clusters'>('grid');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [similarOrder, setSimilarOrder] = useState<number[] | null>(null);
  const [clusters, setClusters] = useState<Array<{ id: number; members: number[]; rep: number }> | null>(null);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);

  const [offlineAnalysis, setOfflineAnalysis] = useState<CharAnalysis | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareQrUrl, setShareQrUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const selectChar = (next: string) => {
    const ch = toChar(next);
    if (!ch) return;
    setSelectedChar(ch);
    setSelectedOccIdx(0);
    setOccView('grid');
    setSimilarOrder(null);
    setClusters(null);
    setActiveCluster(null);
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const baseDir = useMemo(() => baseDirFromUrl(indexUrl), [indexUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(baseDir + 'analysis.json');
        // analysis.json is optional; 404 should be silent.
        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as CharAnalysis;
        if (cancelled) return;
        setOfflineAnalysis(json);
      } catch {
        if (cancelled) return;
        setOfflineAnalysis(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [baseDir]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.debug('[CharAtlas] loading index', { indexUrl });
        // Cache-busting query params can break some native asset servers.
        const urlForFetch = IS_NATIVE_ANDROID
          ? indexUrl
          : indexUrl + (indexUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
        const res = await fetch(urlForFetch, { cache: 'no-store' });
        if (!res.ok) {
          let detail = '';
          try {
            detail = (await res.text()).slice(0, 200);
          } catch {
            // ignore
          }
          throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
        }
        const json = (await res.json()) as CharSliceIndex;
        if (cancelled) return;
        setData(json);
        console.debug('[CharAtlas] index loaded', {
          indexUrl,
          name: json?.name,
          totalChars: json?.total_chars,
          files: json?.files?.length,
        });
        if (debugEnabled && json?.files?.length) {
          console.log(
            '[CharAtlas DEBUG] index摘要:',
            {
              first: json.files.slice(0, 5).map((f) => ({ idx: f.index, char: f.char, file: f.file })),
              last: json.files.slice(-5).map((f) => ({ idx: f.index, char: f.char, file: f.file })),
            }
          );
          console.log('[CharAtlas DEBUG] index元信息:', {
            indexUrl,
            baseDir,
            name: json?.name,
            note: (json as any)?.note,
            alignment: (json as any)?.alignment,
          });
          const zhiCount = json.files.filter((f) => f.char === '之').length;
          const erCount = json.files.filter((f) => f.char === '而').length;
          const ruCount = json.files.filter((f) => f.char === '如').length;
          console.log('[CharAtlas DEBUG] 关键字统计:', { '之': zhiCount, '而': erCount, '如': ruCount });
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'failed to load');
        setData(null);
        console.error('[CharAtlas] failed to load index', { indexUrl, error: msg });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [indexUrl]);

  const byChar = useMemo(() => {
    const map = new Map<string, CharSliceIndexFile[]>();
    for (const f of data?.files || []) {
      const ch = String(f?.char || '').trim();
      if (!ch) continue;
      const list = map.get(ch);
      if (list) list.push(f);
      else map.set(ch, [f]);
    }
    if (debugEnabled) {
      console.log('[CharAtlas DEBUG] byChar分组统计:', {
        '之': map.get('之')?.length || 0,
        '而': map.get('而')?.length || 0,
        '如': map.get('如')?.length || 0,
        '总唯一字符': map.size,
      });
      const items = Array.from(map.entries()).map(([char, list]) => ({ char, count: list.length }));
      items.sort((a, b) => b.count - a.count);
      console.log('[CharAtlas DEBUG] 前10高频字:', items.slice(0, 10).map((x) => `${x.char}:${x.count}`).join(', '));
    }
    return map;
  }, [data, debugEnabled]);

  const stats = useMemo(() => {
    const total = data?.files?.length || 0;
    const unique = byChar.size;
    return { total, unique };
  }, [data, byChar]);

  const topChars = useMemo(() => {
    const items = Array.from(byChar.entries()).map(([char, list]) => ({ char, count: list.length }));
    items.sort((a, b) => b.count - a.count);
    return items.slice(0, 18);
  }, [byChar]);

  useEffect(() => {
    if (!data) return;
    const explicit = toChar(initialChar || query);
    const preferZhi = (byChar.get('之') || []).length ? '之' : '';
    const init = explicit || preferZhi || (topChars[0]?.char || '');
    if (!init) return;
    setSelectedChar((prev) => prev || init);
  }, [data, initialChar, query, topChars, byChar]);

  // Only sync from query when user types in the input box (not from button clicks)
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    const ch = toChar(newQuery);
    if (ch) {
      setSelectedChar(ch);
      setSelectedOccIdx(0);
    }
  };

  const occurrences = useMemo(() => {
    const ch = String(selectedChar || '').trim();
    if (!ch) return [] as CharSliceIndexFile[];
    const result = byChar.get(ch) || [];
    if (debugEnabled && ch && result.length > 0) {
      const withOcr = result
        .map((f) => {
          const src = (f as any)?.source || {};
          const ocr = toChar(src.ocr_guess || '');
          const score = Number(src.ocr_score || 0);
          return {
            index: f.index,
            char: f.char,
            file: f.file,
            page: src.image_index,
            grid: src.grid,
            ocr,
            score,
            align_gold_index: src.align_gold_index,
            body_v3_source: src.body_v3_source,
            body_v4_source: src.body_v4_source,
            body_v5_source: src.body_v5_source,
            body_v6_source: src.body_v6_source,
            body_v7_source: src.body_v7_source,
            body_v8_source: src.body_v8_source,
            body_v9_source: src.body_v9_source,
            body_v10_source: src.body_v10_source,
            body_v11_source: src.body_v11_source,
            body_v12_source: src.body_v12_source,
            body_v13_source: src.body_v13_source,
          };
        })
        .filter((x) => x.ocr);
      const mismatch = withOcr.filter((x) => {
        // For recropped slots, OCR metadata no longer matches the new image.
        if (
          x.body_v4_source ||
          x.body_v5_source ||
          x.body_v6_source ||
          x.body_v7_source ||
          x.body_v8_source ||
          x.body_v9_source ||
          x.body_v10_source ||
          x.body_v11_source
          || x.body_v12_source
          || x.body_v13_source
        )
          return false;
        return !ocrCompatible(ch, x.ocr);
      });
      console.log(
        `[CharAtlas DEBUG] 选中字"${ch}"，找到${result.length}个（含OCR=${withOcr.length}，OCR不符=${mismatch.length}）`,
        {
          sample: withOcr.slice(0, 12),
          mismatch: mismatch.slice(0, 20),
        }
      );
      const v4 = withOcr.filter((x) => x.body_v4_source).length;
      if (v4) console.log('[CharAtlas DEBUG] recrop slots in this char:', { char: ch, count: v4 });
    }
    return result;
  }, [byChar, selectedChar, debugEnabled]);

  const occIdx = clamp(selectedOccIdx, 0, Math.max(0, occurrences.length - 1));
  const selected = occurrences.length ? occurrences[occIdx] : null;

  const occGridRef = useRef<HTMLDivElement | null>(null);
  // Autoplay: cycle through occurrences, 1.5s each.
  useEffect(() => {
    if (tab !== 'search') return;
    if (occView !== 'grid') return;
    if (!selectedChar) return;
    if (occurrences.length < 2) return;
    const timer = window.setInterval(() => {
      setSelectedOccIdx((i) => (i + 1) % occurrences.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [tab, occView, selectedChar, occurrences.length]);

  useEffect(() => {
    if (tab !== 'search') return;
    if (!selectedChar) return;
    const el = occGridRef.current;
    if (!el) return;
    const target = el.querySelector(`[data-occ-idx="${occIdx}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [tab, selectedChar, occIdx]);

  const didApplyInitialGlyphRef = useRef(false);
  useEffect(() => {
    didApplyInitialGlyphRef.current = false;
  }, [selectedChar]);

  useEffect(() => {
    if (!data) return;
    if (!selectedChar) return;
    if (typeof initialGlyphId !== 'number') return;
    if (didApplyInitialGlyphRef.current) return;
    const i = occurrences.findIndex((f) => Number(f.index) === Number(initialGlyphId));
    if (i >= 0) {
      setSelectedOccIdx(i);
      didApplyInitialGlyphRef.current = true;
    }
  }, [data, selectedChar, initialGlyphId, occurrences]);

  useEffect(() => {
    if (occIdx !== selectedOccIdx) setSelectedOccIdx(occIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occIdx]);

  const pages = useMemo(() => {
    const map = new Map<number, CharSliceIndexFile[]>();
    for (const f of data?.files || []) {
      const idx = Number(f?.source?.image_index || 0);
      if (!Number.isFinite(idx) || idx <= 0) continue;
      const list = map.get(idx);
      if (list) list.push(f);
      else map.set(idx, [f]);
    }
    const ordered = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([pageIndex, files]) => {
        const grid: Array<Array<CharSliceIndexFile | null>> = Array.from({ length: 6 }, () => [null, null, null]);
        for (const f of files) {
          const col = Number(f?.source?.grid?.col);
          const row = Number(f?.source?.grid?.row);
          if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
          if (row < 0 || row > 5) continue;
          if (col < 0 || col > 2) continue;
          grid[row][col] = f;
        }
        return { pageIndex, files, grid };
      });
    return ordered;
  }, [data]);

  const openInPage = (f: CharSliceIndexFile) => {
    if (debugEnabled) {
      const src = (f as any)?.source || {};
      const ocr = toChar(src.ocr_guess || '');
      const score = Number(src.ocr_score || 0);
      console.log('[CharAtlas DEBUG] 点击字形:', {
        selectedChar,
        index: f.index,
        labeledChar: f.char,
        file: f.file,
        page: src.image_index,
        image: src.image,
        grid: src.grid,
        crop_box: src.crop_box,
        ocr_guess: ocr,
        ocr_score: score,
        align_gold_index: src.align_gold_index,
        body_v3_source: src.body_v3_source,
        body_v4_source: src.body_v4_source,
        body_v5_source: src.body_v5_source,
        body_v6_source: src.body_v6_source,
        body_v7_source: src.body_v7_source,
        body_v8_source: src.body_v8_source,
        body_v9_source: src.body_v9_source,
        body_v10_source: src.body_v10_source,
        body_v11_source: src.body_v11_source,
        body_v12_source: src.body_v12_source,
        body_v13_source: src.body_v13_source,
      });
    }
    const pageIndex = Math.max(0, Number(f?.source?.image_index || 1) - 1);
    const cropBox = f?.source?.crop_box;
    if (!cropBox || cropBox.length !== 4) return;
    onOpenInPage({
      pageIndex,
      cropBox,
      label: `${String(f.char || '').trim()} · 第${f.index}字`,
    });
  };

  // --- analysis (similarity + clustering) ---
  const featureCacheRef = useRef<Map<string, Float32Array>>(new Map());
  const analyzeTokenRef = useRef(0);

  const featureKey = (f: CharSliceIndexFile) => `${baseDir}${f.file}`;

  const computeFeature = async (src: string): Promise<Float32Array> => {
    const cached = featureCacheRef.current.get(src);
    if (cached) return cached;

    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    await img.decode();

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas ctx missing');

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const v = new Float32Array(size * size);
    let sum = 0;
    for (let i = 0; i < size * size; i++) {
      const r = data[i * 4 + 0] || 0;
      const g = data[i * 4 + 1] || 0;
      const b = data[i * 4 + 2] || 0;
      const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      v[i] = y;
      sum += y;
    }
    const mean = sum / v.length;
    let varSum = 0;
    for (let i = 0; i < v.length; i++) {
      const d = v[i] - mean;
      varSum += d * d;
    }
    const std = Math.sqrt(varSum / v.length) || 1;
    for (let i = 0; i < v.length; i++) v[i] = (v[i] - mean) / std;

    featureCacheRef.current.set(src, v);
    return v;
  };

  const dist = (a: Float32Array, b: Float32Array) => {
    let s = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  };

  const runSimilarity = async () => {
    if (!selected || occurrences.length < 2) return;

    const offline = offlineAnalysis?.by_char?.[String(selectedChar || '').trim()];
    if (offline) {
      const list = offline.similar?.[String(selected.index)] || null;
      if (list && list.length) {
        const occOrder = list
          .map((gid) => occurrences.findIndex((f) => Number(f.index) === Number(gid)))
          .filter((i) => i >= 0);
        setSimilarOrder(occOrder);
        return;
      }
    }

    const token = ++analyzeTokenRef.current;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setSimilarOrder(null);
    try {
      const src0 = featureKey(selected);
      const f0 = await computeFeature(src0);
      const scores: Array<{ i: number; d: number }> = [];
      for (let i = 0; i < occurrences.length; i++) {
        const src = featureKey(occurrences[i]);
        const fi = await computeFeature(src);
        scores.push({ i, d: dist(f0, fi) });
        // yield
        if (i % 4 === 0) await new Promise((r) => window.setTimeout(r, 0));
      }
      if (token !== analyzeTokenRef.current) return;
      scores.sort((a, b) => a.d - b.d);
      setSimilarOrder(scores.map((x) => x.i));
    } catch (e) {
      if (token !== analyzeTokenRef.current) return;
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === analyzeTokenRef.current) setIsAnalyzing(false);
    }
  };

  const runClustering = async () => {
    if (occurrences.length < 2) return;

    const offline = offlineAnalysis?.by_char?.[String(selectedChar || '').trim()];
    if (offline?.clusters?.length) {
      const mapped = offline.clusters
        .map((g) => ({
          id: Number(g.id),
          members: (g.members || [])
            .map((gid) => occurrences.findIndex((f) => Number(f.index) === Number(gid)))
            .filter((i) => i >= 0),
          rep: occurrences.findIndex((f) => Number(f.index) === Number(g.rep)),
        }))
        .filter((g) => g.members.length);
      setClusters(mapped);
      setActiveCluster(mapped[0]?.id ?? null);
      return;
    }

    const token = ++analyzeTokenRef.current;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setClusters(null);
    setActiveCluster(null);
    try {
      const feats: Float32Array[] = [];
      for (let i = 0; i < occurrences.length; i++) {
        feats[i] = await computeFeature(featureKey(occurrences[i]));
        if (i % 4 === 0) await new Promise((r) => window.setTimeout(r, 0));
      }
      if (token !== analyzeTokenRef.current) return;

      const n = occurrences.length;
      const k = clamp(Math.round(Math.sqrt(n / 2)), 2, 5);

      // init centroids (deterministic: take evenly spaced)
      const centroids: Float32Array[] = [];
      for (let c = 0; c < k; c++) centroids.push(feats[Math.floor((c * (n - 1)) / Math.max(1, k - 1))]);

      let assign = new Array<number>(n).fill(0);
      for (let iter = 0; iter < 10; iter++) {
        // assign
        for (let i = 0; i < n; i++) {
          let best = 0;
          let bestD = Number.POSITIVE_INFINITY;
          for (let c = 0; c < k; c++) {
            const d0 = dist(feats[i], centroids[c]);
            if (d0 < bestD) {
              bestD = d0;
              best = c;
            }
          }
          assign[i] = best;
        }

        // recompute centroids
        const sums: Float32Array[] = Array.from({ length: k }, () => new Float32Array(feats[0].length));
        const counts = new Array<number>(k).fill(0);
        for (let i = 0; i < n; i++) {
          const c = assign[i];
          counts[c]++;
          const s = sums[c];
          const f = feats[i];
          for (let j = 0; j < s.length; j++) s[j] += f[j];
        }
        for (let c = 0; c < k; c++) {
          if (!counts[c]) continue;
          const s = sums[c];
          for (let j = 0; j < s.length; j++) s[j] /= counts[c];
          centroids[c] = s;
        }
      }

      // build clusters and choose representative
      const groups: Array<{ id: number; members: number[]; rep: number }> = [];
      for (let c = 0; c < k; c++) {
        const members: number[] = [];
        for (let i = 0; i < n; i++) if (assign[i] === c) members.push(i);
        if (!members.length) continue;
        let rep = members[0];
        let repD = Number.POSITIVE_INFINITY;
        for (const i of members) {
          const d0 = dist(feats[i], centroids[c]);
          if (d0 < repD) {
            repD = d0;
            rep = i;
          }
        }
        groups.push({ id: c, members, rep });
      }
      groups.sort((a, b) => b.members.length - a.members.length);
      if (token !== analyzeTokenRef.current) return;
      setClusters(groups);
      setActiveCluster(groups[0]?.id ?? null);
    } catch (e) {
      if (token !== analyzeTokenRef.current) return;
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === analyzeTokenRef.current) setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // reset analysis results when selection changes
    analyzeTokenRef.current++;
    setIsAnalyzing(false);
    setAnalysisError(null);
    setSimilarOrder(null);
    setClusters(null);
    setActiveCluster(null);
  }, [selectedChar]);

  useEffect(() => {
    if (occView === 'similar') void runSimilarity();
    if (occView === 'clusters') void runClustering();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occView, occIdx]);

  // --- share ---
  const shareUrl = useMemo(() => {
    if (!selectedChar) return null;
    try {
      const base = getShareBaseUrls().prod;
      const u = new URL(base + '/');
      u.searchParams.set('inkflow', '1');
      u.searchParams.set('page', 'study_deck');
      u.searchParams.set('steleId', 'li_001');
      u.searchParams.set('card', 'atlas');
      u.searchParams.set('char', selectedChar);
      if (selected?.index != null) u.searchParams.set('glyphId', String(selected.index));
      return u.toString();
    } catch {
      return null;
    }
  }, [selectedChar, selected?.index]);

  const shareUrls = useMemo(() => {
    const base = getShareBaseUrls();
    if (!selectedChar) return { prod: '', local: '' };
    const build = (baseUrl: string) => {
      if (!baseUrl) return '';
      try {
        const u = new URL(baseUrl + '/');
        u.searchParams.set('inkflow', '1');
        u.searchParams.set('page', 'study_deck');
        u.searchParams.set('steleId', 'li_001');
        u.searchParams.set('card', 'atlas');
        u.searchParams.set('char', selectedChar);
        if (selected?.index != null) u.searchParams.set('glyphId', String(selected.index));
        return u.toString();
      } catch {
        return '';
      }
    };
    return { prod: build(base.prod), local: base.local ? build(base.local) : '' };
  }, [selectedChar, selected?.index]);

  useEffect(() => {
    if (!shareOpen) return;
    if (!shareUrl) return;
    let cancelled = false;
    const run = async () => {
      try {
        const url = await QRCode.toDataURL(shareUrl, { margin: 1, width: 320, color: { dark: '#0a0a0a', light: '#00000000' } });
        if (cancelled) return;
        setShareQrUrl(url);
      } catch {
        if (cancelled) return;
        setShareQrUrl(null);
      }
    };
    setShareQrUrl(null);
    setShareCopied(false);
    void run();
    return () => {
      cancelled = true;
    };
  }, [shareOpen, shareUrl]);

  const copyShareUrl = async () => {
    const url = shareUrls.prod;
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const renderThumb = (f: CharSliceIndexFile, active: boolean, onClick: () => void) => {
    const src = baseDir + f.file;
    if (debugEnabled && f.char === '之' && f.index <= 10) {
      console.log(`[CharAtlas DEBUG] thumb: char="${f.char}", index=${f.index}, src="${src}"`);
    }
    return (
      <button
        key={f.index}
        onClick={onClick}
        className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition active:scale-[0.99] ${
          active ? 'border-[#8B0000]/40 bg-[#8B0000]/5 shadow-sm' : 'border-stone-200/70 bg-white/60'
        }`}
        aria-label={`Select ${f.char} (${f.index})`}
      >
        <img
          src={src}
          alt={f.char}
          className="absolute inset-0 w-full h-full object-contain grayscale contrast-150"
          loading={IMG_LOADING}
          decoding={IMG_DECODING}
          onError={() => {
            console.error('[CharAtlas] thumb load failed', {
              indexUrl,
              src,
              file: f.file,
              char: f.char,
              index: f.index,
            });
          }}
        />
        <div className="absolute inset-0 ring-1 ring-black/5" />
      </button>
    );
  };

  return (
    <div className="h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
      <div className="relative h-full flex flex-col min-h-0">
        {/* 顶部标题区 */}
        <div className="relative px-6 pt-6 pb-4 bg-white/40 border-b border-stone-100 shrink-0">
          <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
          <div className="relative">
            <div className="text-[11px] font-black tracking-[0.4em] text-stone-400 uppercase">字库与定位</div>
            <div className="mt-1 text-xl font-serif font-black text-stone-900 tracking-wide">一字多形</div>
            <div className="mt-1 text-[11px] font-mono text-stone-500">
              {isLoading ? '加载中…' : error ? '加载失败' : `共 ${stats.total || 0} 字 · ${stats.unique} 种`}
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="relative flex gap-2 px-6 py-3 bg-white/30 border-b border-stone-100 shrink-0">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 h-10 rounded-xl text-[12px] font-black tracking-[0.2em] transition ${
              tab === 'search'
                ? 'bg-[#8B0000] text-[#F2E6CE] shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Search size={14} />
              检索
            </span>
          </button>
          <button
            onClick={() => {
              setTab('read');
              window.setTimeout(() => {
                const el = scrollRef.current;
                if (el) el.scrollLeft = 0;
              }, 0);
            }}
            className={`flex-1 h-10 rounded-xl text-[12px] font-black tracking-[0.2em] transition ${
              tab === 'read'
                ? 'bg-[#8B0000] text-[#F2E6CE] shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <BookOpen size={14} />
              通读
            </span>
          </button>
        </div>

        {/* 内容区 */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
          
          {tab === 'search' ? (
            <div className="relative h-full flex flex-col p-5 overflow-y-auto">
              {/* 搜索框 */}
              <div className="relative rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden shrink-0">
                <div className="flex items-center px-4 py-3">
                  <Search size={18} className="text-stone-400 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="输入一个字查找"
                    className="flex-1 px-3 bg-transparent outline-none text-[15px] text-stone-900 placeholder:text-stone-400"
                  />
                  {selectedChar && (
                    <button
                      onClick={() => handleQueryChange('')}
                      className="shrink-0 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* 热门字 */}
              {topChars.length > 0 && (
                <div className="mt-4 shrink-0">
                  <div className="text-[10px] font-black tracking-[0.3em] text-stone-400 mb-2">热门</div>
                  <div className="flex flex-wrap gap-2" style={{ position: 'relative', zIndex: 10 }}>
                    {topChars.map((c) => (
                      <button
                        key={c.char}
                        type="button"
                        onClick={() => selectChar(c.char)}
                        className={`px-3 py-1.5 rounded-lg text-[13px] font-black border transition cursor-pointer ${
                          selectedChar === c.char
                            ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {c.char}
                        <span className="ml-1.5 text-[10px] opacity-70">×{c.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 当前选中字详情 */}
              {selectedChar && occurrences.length > 0 && selected && (
                <div className="mt-5 flex-1 min-h-0">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-[10px] font-black tracking-[0.3em] text-stone-400">
                      「{selectedChar}」· {occurrences.length} 种写法
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOccView('grid')}
                        className={`h-8 px-3 rounded-full text-[10px] font-black tracking-[0.18em] border transition ${
                          occView === 'grid'
                            ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60'
                            : 'bg-white/70 text-stone-700 border-stone-200/70'
                        }`}
                      >
                        多例
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareOpen(true)}
                        className="h-8 w-8 rounded-full bg-white/70 border border-stone-200/70 text-stone-700 flex items-center justify-center"
                        aria-label="Share"
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 h-[calc(100%-2rem)] min-h-[200px]">
                    {/* 左侧大图 */}
                    <div className="w-32 shrink-0 flex flex-col gap-2">
                      <div className="aspect-square rounded-xl bg-white border border-stone-200 overflow-hidden">
                        <img
                          src={baseDir + selected.file}
                          alt={selected.char}
                          className="w-full h-full object-contain"
                          loading={IMG_LOADING}
                          decoding={IMG_DECODING}
                        />
                      </div>
                      <button
                        onClick={() => openInPage(selected)}
                        className="h-9 rounded-lg bg-[#8B0000] text-[#F2E6CE] text-[11px] font-black tracking-wider shadow-sm active:scale-[0.98] transition"
                      >
                        查看原拓
                      </button>
                    </div>

                    {/* 右侧网格 */}
                    <div ref={occGridRef} className="flex-1 min-w-0 overflow-y-auto">
                      {isAnalyzing ? (
                        <div className="text-[12px] text-stone-500">正在分析写法…</div>
                      ) : analysisError ? (
                        <div className="text-[12px] text-stone-500">分析失败：{analysisError}</div>
                      ) : occView === 'clusters' && clusters ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {clusters.map((g, idx) => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => setActiveCluster(g.id)}
                                className={`h-8 px-3 rounded-full text-[10px] font-black tracking-[0.18em] border transition ${
                                  activeCluster === g.id
                                    ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60'
                                    : 'bg-white/70 text-stone-700 border-stone-200/70'
                                }`}
                              >
                                组{idx + 1} · {g.members.length}
                              </button>
                            ))}
                          </div>
                           <div className="mt-3 grid grid-cols-4 gap-2">
                             {(() => {
                               const g = clusters.find((x) => x.id === activeCluster) || clusters[0];
                               const list = g ? g.members : [];
                               return list.map((i) => {
                                 const f = occurrences[i];
                                 const active = i === occIdx;
                                 return (
                                   <button
                                     key={f.index}
                                     onClick={() => setSelectedOccIdx(i)}
                                     data-occ-idx={i}
                                     className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                                       active ? 'border-[#8B0000] shadow-md' : 'border-stone-200 hover:border-stone-300'
                                     }`}
                                   >
                                     <img src={baseDir + f.file} alt={f.char} className="w-full h-full object-contain" loading={IMG_LOADING} />
                                   </button>
                                 );
                               });
                             })()}
                           </div>
                        </>
                      ) : occView === 'similar' && similarOrder ? (
                        <div className="grid grid-cols-4 gap-2">
                          {similarOrder.map((i) => {
                            const f = occurrences[i];
                            const active = i === occIdx;
                            return (
                              <button
                                key={f.index}
                                onClick={() => setSelectedOccIdx(i)}
                                data-occ-idx={i}
                                className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                                  active ? 'border-[#8B0000] shadow-md' : 'border-stone-200 hover:border-stone-300'
                                }`}
                              >
                                <img src={baseDir + f.file} alt={f.char} className="w-full h-full object-contain" loading={IMG_LOADING} />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {occurrences.map((f, i) => (
                            <button
                              key={f.index}
                              onClick={() => setSelectedOccIdx(i)}
                              data-occ-idx={i}
                              className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                                i === occIdx ? 'border-[#8B0000] shadow-md' : 'border-stone-200 hover:border-stone-300'
                              }`}
                            >
                              <img src={baseDir + f.file} alt={f.char} className="w-full h-full object-contain" loading={IMG_LOADING} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!selectedChar && (
                <div className="mt-8 text-center text-stone-400 text-sm">
                  输入或点选上方热门字
                </div>
              )}
            </div>
          ) : (
            /* 通读模式 */
            <div className="relative h-full flex flex-col">
              <div className="px-5 py-3 bg-white/50 border-b border-stone-100 shrink-0">
                <div className="text-[11px] font-black tracking-[0.3em] text-stone-500">碑阳通读</div>
                <div className="text-[12px] text-stone-600 mt-1">共 {pages.length} 页 · 点击任意字查看原拓</div>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                <div className="flex gap-4 min-w-max">
                  {pages.map((p) => (
                    <div
                      key={p.pageIndex}
                      className="shrink-0 w-28 rounded-xl bg-white border border-stone-200 p-2 shadow-sm"
                    >
                      <div className="text-[10px] font-mono text-stone-500 text-center mb-2">
                        第 {String(p.pageIndex + 1).padStart(3, '0')} 页
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2].map((col) => (
                          <div key={col} className="flex flex-col gap-1">
                            {[0, 1, 2, 3, 4, 5].map((row) => {
                              const f = p.grid[row]?.[col];
                              return f ? (
                                 <button
                                   key={`g-${f.index}`}
                                   onClick={() => {
                                     selectChar(String(f.char));
                                     const list = byChar.get(String(f.char)) || [];
                                     const idx = list.findIndex((x) => x.index === f.index);
                                     setSelectedOccIdx(idx >= 0 ? idx : 0);
                                     openInPage(f);
                                   }}
                                   className="relative w-full aspect-square rounded overflow-hidden bg-white border border-stone-200/70 hover:border-stone-300/80 shadow-sm"
                                 >
                                  <img
                                    src={baseDir + f.file}
                                    alt={String(f.char || '').trim()}
                                    className="absolute inset-0 w-full h-full object-contain grayscale contrast-150"
                                    loading={IMG_LOADING}
                                    decoding={IMG_DECODING}
                                  />
                                  <div className="absolute inset-0 ring-1 ring-black/5" />
                                </button>
                              ) : (
                                <div key={`e-${row}`} className="w-full aspect-square" />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {shareOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[450] bg-black/60 backdrop-blur-md flex items-end justify-center"
              onClick={() => setShareOpen(false)}
            >
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="w-full max-w-md rounded-t-[2rem] bg-[#F6F1E7] border-t border-stone-200/70 p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-black tracking-[0.22em] text-stone-800">分享「{selectedChar}」多例</div>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    className="w-9 h-9 rounded-full bg-white/70 border border-stone-200/70 text-stone-700 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] bg-white/70 border border-stone-200/70 p-4 flex flex-col items-center justify-center">
                    <div className="w-full aspect-square rounded-2xl bg-white border border-stone-200/70 flex items-center justify-center overflow-hidden">
                      {shareQrUrl ? (
                        <img src={shareQrUrl} alt="qr" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-[11px] font-sans text-stone-500 flex items-center gap-2">
                          <QrCode size={16} /> 生成二维码…
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-[10px] font-mono text-stone-500 tracking-widest">扫码直达</div>
                  </div>
                  <div className="rounded-[1.5rem] bg-white/70 border border-stone-200/70 p-4">
                    <div className="text-[10px] font-black tracking-[0.22em] text-stone-600">链接</div>
                    <div className="mt-3 text-[10px] font-mono text-stone-600 break-all">
                      {shareUrls.prod || '—'}
                    </div>
                    <button
                      type="button"
                      onClick={copyShareUrl}
                      className="mt-4 w-full h-10 rounded-[1.25rem] bg-[#8B0000] text-[#F2E6CE] font-black tracking-[0.18em] text-[11px] flex items-center justify-center gap-2"
                    >
                      <Copy size={14} /> {shareCopied ? '已复制' : '复制链接'}
                    </button>
                    {shareUrls.local ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrls.local);
                          } catch {
                            // ignore
                          }
                        }}
                        className="mt-2 w-full h-10 rounded-[1.25rem] bg-white/70 border border-stone-200/70 text-stone-800 font-black tracking-[0.18em] text-[11px] flex items-center justify-center"
                      >
                        复制本地链接
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!shareUrl) return;
                        const nav: any = navigator;
                        if (!nav?.share) return;
                        try {
                          await nav.share({ title: `曹全碑 · ${selectedChar}`, text: `曹全碑「${selectedChar}」多例 · 原拓定位`, url: shareUrl });
                        } catch {
                          // ignore
                        }
                      }}
                      className="mt-2 w-full h-10 rounded-[1.25rem] bg-white/70 border border-stone-200/70 text-stone-800 font-black tracking-[0.18em] text-[11px] flex items-center justify-center gap-2"
                    >
                      <Share2 size={14} /> 系统分享
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
