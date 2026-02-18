import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import QRCode from 'qrcode';

import { extractGoldLine, getKeywords, highlightText, splitLeadSentence } from '../utils/readingEnhance';

const IS_NATIVE_ANDROID = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const IMG_LOADING: 'eager' | 'lazy' = IS_NATIVE_ANDROID ? 'eager' : 'lazy';
const IMG_DECODING: 'async' | 'auto' = IS_NATIVE_ANDROID ? 'auto' : 'async';
import { MasterpieceCharAtlasCard } from './MasterpieceCharAtlas';

export type MasterpieceStele = {
  id: string;
  name: string;
  aliases: string[];
  script_type: string;
  author: string;
  dynasty: string;
  year: string;
  type: string;
  location: string;
  total_chars: number;
  content: string;
  description: string;
  story?: string;
  knowledge_id?: string;
  assets?: {
    cover?: string;
    pages?:
      | string[]
      | {
          pattern: string;
          start: number;
          end: number;
          pad?: number;
        };
    pagesThumb?:
      | string[]
      | {
          pattern: string;
          start: number;
          end: number;
          pad?: number;
        };
    practice?: Array<{ char: string; hint: string; image: string }>;
    charIndex?: string;
    charText?: string;
  };
};

type SteleKnowledge = {
  id: string;
  name: string;
  dynasty: string;
  author: string;
  script_type: string;
  history: string;
  technique: string;
  appreciation: string;
  legacy: string;
  location: string;
};

type ScriptKind = 'all' | '篆书' | '隶书' | '楷书' | '行书' | '草书';

const DEFAULT_LEVEL8_LIST = [
  'zhuan_003',
  'zhuan_001',
  'zhuan_018',
  'li_001',
  'li_002',
  'li_003',
  'kai_001',
  'kai_006',
  'kai_007',
  'xing_001',
  'xing_002',
  'xing_003',
  'xing_005',
  'cao_001',
  'cao_002',
  'cao_003',
  'cao_004',
];

type StudyPaths = {
  level8?: {
    label?: string;
    mustLearn?: string[];
    byScript?: Record<string, string[]>;
  };
};

function useLevel8Path() {
  const [label, setLabel] = useState('8级路径');
  const [list, setList] = useState<string[]>(DEFAULT_LEVEL8_LIST);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/data/study_paths.json');
        const json = (await res.json()) as StudyPaths;
        const next = Array.isArray(json?.level8?.mustLearn) ? json.level8!.mustLearn!.filter(Boolean).map(String) : null;
        const nextLabel = String(json?.level8?.label || '').trim();
        if (cancelled) return;
        if (next && next.length) setList(next);
        if (nextLabel) setLabel(nextLabel);
      } catch {
        // fallback to defaults
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useMemo(() => new Set(list), [list]);
  return { label, list, set };
}

type StudyProgress = {
  lastIndex: number;
  totalCards: number;
  updatedAt: number;
  completedAt?: number;
};

type StudyProgressStore = Record<string, StudyProgress>;

const PROGRESS_KEY = 'inkgrid_study_progress_v1';

function loadProgressStore(): StudyProgressStore {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as StudyProgressStore;
  } catch {
    return {};
  }
}

function saveProgressStore(store: StudyProgressStore) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function getProgressFor(id: string) {
  const store = loadProgressStore();
  return store[id] || null;
}

function upsertProgress(id: string, patch: Partial<StudyProgress> & { totalCards: number }) {
  const store = loadProgressStore();
  const prev = store[id];
  const next: StudyProgress = {
    lastIndex: typeof patch.lastIndex === 'number' ? patch.lastIndex : prev?.lastIndex || 0,
    totalCards: patch.totalCards,
    updatedAt: Date.now(),
    completedAt: patch.completedAt ?? prev?.completedAt,
  };
  store[id] = next;
  saveProgressStore(store);
  return next;
}

function markCompleted(id: string, totalCards: number) {
  return upsertProgress(id, { totalCards, lastIndex: Math.max(0, totalCards - 1), completedAt: Date.now() });
}

function normalizeNameKey(input: string) {
  return String(input || '')
    .trim()
    .replace(/[\s·・．。.,，、:：;；()（）\[\]【】《》“”"'‘’]/g, '')
    .toLowerCase();
}

function formatAuthor(author: string) {
  const a = String(author || '').trim();
  if (!a) return '作者不可考';
  if (a === '不可考' || a === '未知' || a === '不详') return '作者不可考';
  if (a.includes('不可考')) return '作者不可考';
  return a;
}

const KNOWLEDGE_ID_OVERRIDES: Record<string, string> = {
  // steles.json uses zhuan_003 for "峄山刻石";
  // stele_knowledge.json uses zhuan_001 for "嶧山刻石".
  zhuan_003: 'zhuan_001',
  // steles.json uses zhuan_001 for "泰山刻石"; knowledge uses zhuan_002.
  zhuan_001: 'zhuan_002',
  // steles.json uses kai_007 for "柳公权玄秘塔碑"; knowledge uses kai_003.
  kai_007: 'kai_003',
};

function pickLines(text: string, maxLines: number) {
  const t = String(text || '').trim();
  if (!t) return [] as string[];
  const parts = t
    .replace(/\s+/g, ' ')
    .split(/[。；;！!？?]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return [t.slice(0, 60)];
  return parts.slice(0, Math.max(1, maxLines));
}

function pickQuote(text: string, maxLen = 64) {
  const t = String(text || '').replace(/\s+/g, '').trim();
  if (!t) return '';
  const stop = ['。', '；', '！', '？'];
  let cut = -1;
  for (const s of stop) {
    const idx = t.indexOf(s);
    if (idx >= 12 && (cut === -1 || idx < cut)) cut = idx;
  }
  const raw = cut >= 0 ? t.slice(0, Math.min(cut + 1, maxLen + 1)) : t.slice(0, maxLen);
  return raw;
}

function buildExcerpt(text: string, maxLen: number) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const punct = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('；'));
  if (punct > Math.floor(maxLen * 0.5)) return slice.slice(0, punct + 1);
  return slice;
}

function baseDirFromUrl(url: string) {
  const parts = String(url || '').split('?')[0].split('#')[0].split('/');
  if (parts.length <= 1) return '/';
  parts.pop();
  return parts.join('/') + '/';
}

type SteleAppreciation = {
  id: string;
  name: string;
  summary: string;
  points: Array<{ tag: string; text: string }>;
  practiceTips: string[];
  sources: {
    museum: { title: string; url: string; kind: string };
    publication: { title: string; url: string; kind: string };
  };
};

type CaoquanPointEvidence = {
  version: number;
  steleId: string;
  steleName: string;
  nPerPoint: number;
  points: Record<string, { tag: string; char: string; glyphIds: number[] }>;
};

function CaoquanKnowledgeCard({
  charIndexUrl,
  stele,
  initialOpenPoint,
  onOpenInPage,
}: {
  charIndexUrl: string;
  stele: MasterpieceStele;
  initialOpenPoint?: number;
  onOpenInPage: (args: { pageIndex: number; cropBox: [number, number, number, number]; label: string }) => void;
}) {
  const [app, setApp] = useState<SteleAppreciation | null>(null);
  const [evidence, setEvidence] = useState<CaoquanPointEvidence | null>(null);
  const [indexData, setIndexData] = useState<null | { files: Array<{ index: number; char: string; file: string; source: any }> }>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPoint, setOpenPoint] = useState<number | null>(null);
  const [sharePoint, setSharePoint] = useState<number | null>(null);
  const [shareQrUrl, setShareQrUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const baseDir = useMemo(() => baseDirFromUrl(charIndexUrl), [charIndexUrl]);
  const evidenceUrl = useMemo(() => baseDir + 'point_evidence.json', [baseDir]);
  const keywords = useMemo(() => getKeywords(stele.script_type), [stele.script_type]);

  const byGlyphId = useMemo(() => {
    const map = new Map<number, any>();
    for (const f of indexData?.files || []) {
      map.set(Number(f.index), f);
    }
    return map;
  }, [indexData]);

  const goldLine = useMemo(() => {
    return extractGoldLine({ summary: app?.summary || null, firstPointText: app?.points?.[0]?.text || null });
  }, [app?.summary, app?.points]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      try {
        const [appRes, evRes, idxRes] = await Promise.all([
          fetch('/data/stele_appreciations.json'),
          fetch(evidenceUrl),
          fetch(charIndexUrl),
        ]);
        if (!appRes.ok) throw new Error(`appreciations HTTP ${appRes.status}`);
        if (!evRes.ok) throw new Error(`evidence HTTP ${evRes.status}`);
        if (!idxRes.ok) throw new Error(`index HTTP ${idxRes.status}`);
        const appJson = await appRes.json();
        const items = appJson?.items || [];
        const found = items.find((x: any) => String(x?.id) === String(stele.id)) || null;
        const evJson = (await evRes.json()) as CaoquanPointEvidence;
        const idxJson = await idxRes.json();
        if (cancelled) return;
        setApp(found);
        setEvidence(evJson);
        setIndexData(idxJson);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setApp(null);
        setEvidence(null);
        setIndexData(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [charIndexUrl, evidenceUrl, stele.id]);

  useEffect(() => {
    if (sharePoint === null) return;
    const url = buildShareUrl(sharePoint);
    if (!url) return;
    let cancelled = false;
    const run = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#0a0a0a', light: '#00000000' } });
        if (cancelled) return;
        setShareQrUrl(dataUrl);
      } catch {
        if (cancelled) return;
        setShareQrUrl(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePoint]);

  useEffect(() => {
    if (typeof initialOpenPoint !== 'number') return;
    setOpenPoint(initialOpenPoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stele.id]);

  const buildShareUrl = (pointIndex: number) => {
    try {
      const u = new URL(window.location.origin + '/');
      u.searchParams.set('inkflow', '1');
      u.searchParams.set('page', 'study_deck');
      u.searchParams.set('steleId', 'li_001');
      u.searchParams.set('card', 'knowledge');
      u.searchParams.set('point', String(pointIndex));
      return u.toString();
    } catch {
      return '';
    }
  };

  const points = app?.points?.slice(0, 10) || [];
  const pointEvidence = evidence?.points || {};

  return (
    <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
      <div className="relative p-7">
        <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
        <div className="relative">
          <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">知识点 · 证据</div>
          <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">要点落到原拓</div>

          {error ? (
            <div className="mt-6 rounded-[1.5rem] bg-white/70 border border-stone-200/70 p-5 text-[12px] font-sans text-stone-700">
              加载失败：{error}
            </div>
          ) : null}

          {goldLine ? (
            <div className="mt-6 rounded-[1.75rem] bg-white/70 border border-stone-200/70 p-6">
              <div className="text-[10px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">金句</div>
              <div className="mt-3 text-[15px] font-serif font-semibold text-stone-900 leading-[2.0] tracking-[0.12em] text-justify-zh">
                「{goldLine}」
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-[1.75rem] bg-white/70 border border-stone-200/70 p-6">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">十条要点</div>
              <div className="text-[10px] font-mono text-stone-500 tracking-widest">{points.length}/10</div>
            </div>

            <div className="mt-4 divide-y divide-stone-200/70">
              {points.map((p, i) => {
                const split = splitLeadSentence(p.text);
                const lead = split.lead;
                const rest = split.rest;
                const ev = pointEvidence[String(i)] || null;
                const hasEv = Boolean(ev?.glyphIds?.length);
                return (
                  <div key={i} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-mono text-stone-500 tracking-widest">{String(i + 1).padStart(2, '0')}</div>
                          <div className="px-2 py-1 rounded-full bg-white border border-stone-200/70 text-[10px] font-black tracking-[0.18em] text-stone-700">
                            {p.tag}
                          </div>
                        </div>
                        <div className="mt-2 text-[13px] font-sans text-stone-800 leading-relaxed">
                          {lead ? (
                            <span className="font-semibold text-stone-900">
                              {highlightText(lead, keywords)}
                              {rest ? ' ' : ''}
                            </span>
                          ) : null}
                          {rest ? <span className={lead ? 'text-stone-700' : ''}>{highlightText(rest, keywords)}</span> : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!hasEv}
                        onClick={() => setOpenPoint(i)}
                        className="shrink-0 h-10 px-4 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[10px] font-black tracking-[0.18em] shadow-sm disabled:opacity-35"
                      >
                        看例
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSharePoint(i);
                          setShareQrUrl(null);
                          setShareCopied(false);
                        }}
                        className="shrink-0 h-10 px-3 rounded-[1.25rem] bg-white/70 border border-stone-200/70 text-stone-800 text-[10px] font-black tracking-[0.18em] shadow-sm"
                      >
                        分享
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {app?.sources ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={app.sources.museum.url}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-4 rounded-full bg-white/70 border border-stone-200/70 text-stone-800 text-[10px] font-black tracking-[0.18em] flex items-center justify-center shadow-sm"
              >
                馆站来源
              </a>
              <a
                href={app.sources.publication.url}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-4 rounded-full bg-white/70 border border-stone-200/70 text-stone-800 text-[10px] font-black tracking-[0.18em] flex items-center justify-center shadow-sm"
              >
                出版物/研究
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {openPoint !== null ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[420] bg-black/60 backdrop-blur-md flex items-end justify-center"
            onClick={() => setOpenPoint(null)}
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
                <div className="text-[12px] font-black tracking-[0.18em] text-stone-900">看例</div>
                <button
                  type="button"
                  onClick={() => setOpenPoint(null)}
                  className="w-9 h-9 rounded-full bg-white/70 border border-stone-200/70 text-stone-700 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {(() => {
                  const ev = pointEvidence[String(openPoint)] || null;
                  const glyphIds = ev?.glyphIds || [];
                  const items = glyphIds.map((gid) => byGlyphId.get(Number(gid)) || null).filter(Boolean);
                  return items.map((f: any) => (
                    <button
                      key={String(f.index)}
                      type="button"
                      onClick={() => {
                        const pageIndex = Math.max(0, Number(f?.source?.image_index || 1) - 1);
                        const cropBox = f?.source?.crop_box as [number, number, number, number];
                        onOpenInPage({ pageIndex, cropBox, label: `${String(f.char || '').trim()} · 第${Number(f.index)}字` });
                        setOpenPoint(null);
                      }}
                      className="aspect-square rounded-xl overflow-hidden border border-stone-200/70 bg-white/70"
                    >
                      <img src={baseDir + String(f.file)} alt={String(f.char || '')} className="w-full h-full object-contain grayscale contrast-150" />
                    </button>
                  ));
                })()}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {sharePoint !== null ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[421] bg-black/60 backdrop-blur-md flex items-end justify-center"
            onClick={() => setSharePoint(null)}
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
                <div className="text-[12px] font-black tracking-[0.18em] text-stone-900">分享要点</div>
                <button
                  type="button"
                  onClick={() => setSharePoint(null)}
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
                      <div className="text-[11px] font-sans text-stone-500">生成二维码…</div>
                    )}
                  </div>
                  <div className="mt-3 text-[10px] font-mono text-stone-500 tracking-widest">扫码直达</div>
                </div>
                <div className="rounded-[1.5rem] bg-white/70 border border-stone-200/70 p-4">
                  <div className="text-[10px] font-black tracking-[0.22em] text-stone-600">链接</div>
                  <div className="mt-3 text-[10px] font-mono text-stone-600 break-all">{buildShareUrl(sharePoint)}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = buildShareUrl(sharePoint);
                      if (!url) return;
                      try {
                        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
                        setShareCopied(true);
                        window.setTimeout(() => setShareCopied(false), 1200);
                      } catch {
                        // ignore
                      }
                    }}
                    className="mt-4 w-full h-10 rounded-[1.25rem] bg-[#8B0000] text-[#F2E6CE] font-black tracking-[0.18em] text-[11px] flex items-center justify-center"
                  >
                    {shareCopied ? '已复制' : '复制链接'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function getSteleCover(stele: MasterpieceStele) {
  const cover = String(stele.assets?.cover || '').trim();
  if (cover) return cover;
  if (stele.id === 'li_001' || stele.name.includes('曹全')) return '/steles/2-lishu/1-caoquanbei/caoquanbei-001.jpg';
  if (stele.name.includes('峄山')) return '/steles/1-zhuanshu/1-yishankeshi/yishan.jpg';
  return null as string | null;
}

function hasSteleAssets(stele: MasterpieceStele) {
  const assets = stele.assets || {};
  const cover = String(assets.cover || '').trim();
  const pages = expandPagesValue((assets as any).pages);
  const thumbs = expandPagesValue((assets as any).pagesThumb);
  return Boolean(cover) || Boolean(pages.length) || Boolean(thumbs.length);
}

function expandPagesValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value && typeof value === 'object') {
    const pattern = String((value as any).pattern || '').trim();
    const start = Number((value as any).start);
    const end = Number((value as any).end);
    const pad = Number.isFinite(Number((value as any).pad)) ? Number((value as any).pad) : 0;
    if (!pattern || !Number.isFinite(start) || !Number.isFinite(end)) return [] as string[];
    const out: string[] = [];
    const step = start <= end ? 1 : -1;
    for (let n = start; step > 0 ? n <= end : n >= end; n += step) {
      const s = pad > 0 ? String(n).padStart(pad, '0') : String(n);
      out.push(pattern.replace('{n}', s));
    }
    return out;
  }
  return [] as string[];
}

function expandStelePages(stele: MasterpieceStele) {
  return expandPagesValue(stele.assets?.pages);
}

function getStelePages(stele: MasterpieceStele) {
  const fromAssets = expandStelePages(stele);
  if (fromAssets.length) return fromAssets;
  if (stele.id === 'li_001' || stele.name.includes('曹全')) {
    const count = 47;
    return Array.from({ length: count }, (_, i) => `/steles/2-lishu/1-caoquanbei/caoquanbei-${String(i + 1).padStart(3, '0')}.jpg`);
  }
  if (stele.name.includes('峄山')) return ['/steles/1-zhuanshu/1-yishankeshi/yishan.jpg', '/steles/1-zhuanshu/1-yishankeshi/yishan2.jpg'];
  return [] as string[];
}

function getStelePageThumbs(stele: MasterpieceStele) {
  const thumbs = expandPagesValue(stele.assets?.pagesThumb);
  if (thumbs.length) return thumbs;
  return getStelePages(stele);
}

function getSteleCharIndexUrl(stele: MasterpieceStele) {
  const explicit = String(stele.assets?.charIndex || '').trim();
  if (explicit) return explicit;
  if (stele.id === 'li_001' || stele.name.includes('曹全')) return '/steles/2-lishu/1-caoquanbei/chars_yang/index.json';
  return null as string | null;
}

function getPracticeChars(stele: MasterpieceStele) {
  const fromAssets = stele.assets?.practice;
  if (Array.isArray(fromAssets) && fromAssets.length) {
    return fromAssets
      .filter((x) => x && x.image)
      .slice(0, 6)
      .map((x) => ({ char: String(x.char || '').trim(), hint: String(x.hint || '').trim(), image: String(x.image) }));
  }
  if (stele.id === 'li_001' || stele.name.includes('曹全')) {
    return [
      { char: '曹', hint: '秀逸不轻浮', image: '/steles/2-lishu/1-caoquanbei/chars_yang/caoquanbei_yang_0043_U66F9.png' },
      { char: '全', hint: '波磔舒展', image: '/steles/2-lishu/1-caoquanbei/chars_yang/caoquanbei_yang_0003_U5168.png' },
      { char: '國', hint: '横画主导', image: '/steles/2-lishu/1-caoquanbei/chars_yang/caoquanbei_yang_0044_U570B.png' },
    ];
  }
  if (stele.name.includes('峄山')) {
    return [
      { char: '皇', hint: '中锋圆转', image: '/steles/extracted_by_grid/char_0001.png' },
      { char: '帝', hint: '匀净如铁线', image: '/steles/extracted_by_grid/char_0002.png' },
      { char: '立', hint: '结体对称', image: '/steles/extracted_by_grid/char_0003.png' },
    ];
  }
  return [] as Array<{ char: string; hint: string; image: string }>;
}

function checklistByScript(scriptType: string) {
  const k = String(scriptType || '').trim();
  if (k.includes('篆')) {
    return ['线条匀净：粗细几乎一致', '中锋圆转：不偏不侧', '结体对称：重心稳定', '转折含蓄：不生硬折角', '行气整饬：字距与纵势统一'];
  }
  if (k.includes('隶')) {
    return ['横画主导：一波三折见功', '蚕头雁尾：起收有法度', '波磔不躁：舒展而不散', '结体扁平：左右开张', '气息书卷：雅而不弱'];
  }
  if (k.includes('行')) {
    return ['连断得当：不粘不碎', '节奏分明：快慢虚实有层次', '行气贯通：欹正相生', '笔意内敛：不漂不滑', '结构稳：欹侧有根'];
  }
  if (k.includes('草')) {
    return ['势先于形：一气贯穿', '连带自然：呼应有来有去', '提按节奏：枯润有致', '结体取势：不拘小法', '收束清楚：最后一笔要落地'];
  }
  return ['起收分明：点画有交代', '横竖有度：不板不软', '结构稳定：重心不漂', '呼应到位：点画相顾', '章法清楚：疏密有呼吸'];
}

function useSteleKnowledge() {
  const [items, setItems] = useState<SteleKnowledge[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/data/stele_knowledge.json');
        const json = await res.json();
        const list = (json?.steles || []).filter(Boolean) as SteleKnowledge[];
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, SteleKnowledge>();
    for (const k of items) {
      if (k?.id) map.set(String(k.id), k);
    }
    return map;
  }, [items]);

  const byName = useMemo(() => {
    const map = new Map<string, SteleKnowledge>();
    for (const k of items) {
      const key = normalizeNameKey(k?.name || '');
      if (!key) continue;
      if (!map.has(key)) map.set(key, k);
    }
    return map;
  }, [items]);

  const find = useMemo(() => {
    return (stele: MasterpieceStele | null) => {
      if (!stele) return null;

      const explicit = String((stele as any).knowledge_id || '').trim();
      if (explicit) {
        const hit = byId.get(explicit);
        if (hit) return hit;
      }

      const overrideId = KNOWLEDGE_ID_OVERRIDES[String(stele.id)] || '';
      if (overrideId) {
        const hit = byId.get(overrideId);
        if (hit) return hit;
      }

      const byIdHit = byId.get(String(stele.id));
      if (byIdHit) return byIdHit;
      const byNameHit = byName.get(normalizeNameKey(stele.name));
      return byNameHit || null;
    };
  }, [byId, byName]);

  return { items, find };
}

export function MobileMasterpieceStudyHub({
  steles,
  onOpenYishanAppreciation,
  onSelect,
}: {
  steles: MasterpieceStele[];
  onOpenYishanAppreciation?: () => void;
  onSelect: (stele: MasterpieceStele, opts?: { initialCardId?: string; restoreLastPosition?: boolean }) => void;
}) {
  const level8 = useLevel8Path();
  const [progressStore, setProgressStore] = useState<StudyProgressStore>({});
  const [query, setQuery] = useState('');
  const [script, setScript] = useState<ScriptKind>('all');
  const [onlyReady, setOnlyReady] = useState(false);
  const [onlyMustLearn, setOnlyMustLearn] = useState(false);
  const [progressFilter, setProgressFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [dynasty, setDynasty] = useState('');
  const [author, setAuthor] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'recommended' | 'recent' | 'name'>('default');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [authorQuery, setAuthorQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setProgressStore(loadProgressStore());
  }, []);

  const baseIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < steles.length; i += 1) {
      map.set(String(steles[i]?.id), i);
    }
    return map;
  }, [steles]);

  const tokens = useMemo(() => {
    return query
      .trim()
      .split(/\s+/)
      .map((t) => normalizeNameKey(t))
      .filter(Boolean);
  }, [query]);

  const searchActive =
    tokens.length > 0 ||
    script !== 'all' ||
    onlyReady ||
    onlyMustLearn ||
    progressFilter !== 'all' ||
    Boolean(dynasty.trim()) ||
    Boolean(author.trim());

  const filtered = useMemo(() => {
    let list = steles;

    if (script !== 'all') {
      list = list.filter((s) => String(s.script_type || '').trim() === script);
    }

    if (dynasty.trim()) {
      list = list.filter((s) => String(s.dynasty || '').trim() === dynasty.trim());
    }

    if (author.trim()) {
      list = list.filter((s) => String(s.author || '').trim() === author.trim());
    }

    if (onlyReady) {
      list = list.filter((s) => hasSteleAssets(s));
    }

    if (onlyMustLearn) {
      list = list.filter((s) => level8.set.has(String(s.id)));
    }

    if (progressFilter !== 'all') {
      list = list.filter((s) => {
        const p = progressStore[String(s.id)];
        if (progressFilter === 'completed') return Boolean(p?.completedAt);
        if (progressFilter === 'in_progress') return Boolean(p) && !p?.completedAt;
        return true;
      });
    }

    if (tokens.length) {
      list = list.filter((s) => {
        const aliases = Array.isArray(s.aliases) ? s.aliases.join(' ') : '';
        const hay = normalizeNameKey(
          `${s.name} ${aliases} ${s.author} ${s.dynasty} ${s.script_type} ${s.location} ${s.year} ${s.type}`
        );
        return tokens.every((t) => hay.includes(t));
      });
    }

    if (sortMode === 'name') {
      const next = [...list];
      next.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
      return next;
    }

    if (sortMode === 'recent') {
      const next = [...list];
      next.sort((a, b) => {
        const pa = progressStore[String(a.id)];
        const pb = progressStore[String(b.id)];
        const ta = pa?.updatedAt || 0;
        const tb = pb?.updatedAt || 0;
        if (tb !== ta) return tb - ta;
        const ia = baseIndexById.get(String(a.id)) ?? 0;
        const ib = baseIndexById.get(String(b.id)) ?? 0;
        return ia - ib;
      });
      return next;
    }

    if (sortMode === 'recommended') {
      const next = [...list];
      next.sort((a, b) => {
        const pa = progressStore[String(a.id)];
        const pb = progressStore[String(b.id)];
        const aLearning = Boolean(pa) && !pa?.completedAt;
        const bLearning = Boolean(pb) && !pb?.completedAt;
        if (aLearning !== bLearning) return aLearning ? -1 : 1;

        const aMust = level8.set.has(String(a.id));
        const bMust = level8.set.has(String(b.id));
        if (aMust !== bMust) return aMust ? -1 : 1;

        const aReady = hasSteleAssets(a);
        const bReady = hasSteleAssets(b);
        if (aReady !== bReady) return aReady ? -1 : 1;

        const ta = pa?.updatedAt || 0;
        const tb = pb?.updatedAt || 0;
        if (tb !== ta) return tb - ta;

        const ia = baseIndexById.get(String(a.id)) ?? 0;
        const ib = baseIndexById.get(String(b.id)) ?? 0;
        return ia - ib;
      });
      return next;
    }

    return list;
  }, [
    steles,
    script,
    dynasty,
    author,
    onlyReady,
    onlyMustLearn,
    progressFilter,
    tokens,
    sortMode,
    progressStore,
    baseIndexById,
    level8.set,
  ]);

  const mustLearn = useMemo(() => {
    const byId = new Map(steles.map((s) => [String(s.id), s]));
    const ordered = level8.list
      .map((id) => byId.get(String(id)) || null)
      .filter(Boolean) as MasterpieceStele[];

    // Safety: ensure the two flagships always exist.
    const yishan = steles.find((s) => String(s.id) === 'zhuan_003' || s.name.includes('峄山'));
    const caoquan = steles.find((s) => String(s.id) === 'li_001' || s.name.includes('曹全'));
    const addIfMissing = (s: MasterpieceStele | undefined) => {
      if (!s) return;
      if (ordered.some((x) => String(x.id) === String(s.id))) return;
      ordered.unshift(s);
    };
    addIfMissing(caoquan);
    addIfMissing(yishan);
    return ordered;
  }, [steles, level8.list]);

  const flagships = useMemo(() => {
    const yishan = steles.find((s) => String(s.id) === 'zhuan_003' || s.name.includes('峄山')) || null;
    const caoquan = steles.find((s) => String(s.id) === 'li_001' || s.name.includes('曹全')) || null;
    return { yishan, caoquan };
  }, [steles]);

  const caoquanProgress = useMemo(() => {
    const s = flagships.caoquan;
    if (!s) return null;
    return progressStore[String(s.id)] || null;
  }, [flagships.caoquan, progressStore]);

  const caoquanPct = useMemo(() => {
    const p = caoquanProgress;
    if (!p || !p.totalCards) return 0;
    return Math.min(1, Math.max(0, (Number(p.lastIndex) + 1) / Number(p.totalCards)));
  }, [caoquanProgress]);

  const pathStats = useMemo(() => {
    const total = mustLearn.length;
    let done = 0;
    for (const s of mustLearn) {
      const p = progressStore[String(s.id)];
      if (p?.completedAt) done += 1;
    }
    const pct = total > 0 ? done / total : 0;
    const next = mustLearn.find((s) => !progressStore[String(s.id)]?.completedAt) || null;
    return { total, done, pct, next };
  }, [mustLearn, progressStore]);

  const continues = useMemo(() => {
    const entries = Object.entries(progressStore)
      .map(([id, p]) => ({ id, p }))
      .filter((x) => !!x.id && !!x.p && typeof x.p.updatedAt === 'number');
    entries.sort((a, b) => (b.p.updatedAt || 0) - (a.p.updatedAt || 0));
    const byId = new Map(steles.map((s) => [String(s.id), s]));
    return entries
      .map((e) => ({ stele: byId.get(e.id) || null, p: e.p }))
      .filter((x) => !!x.stele)
      .slice(0, 6) as Array<{ stele: MasterpieceStele; p: StudyProgress }>;
  }, [progressStore, steles]);

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of steles) {
      const k = String(s.script_type || '').trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const get = (k: ScriptKind) => (k === 'all' ? steles.length : counts.get(k) || 0);
    return [
      { id: 'all' as const, label: '全部', count: get('all') },
      { id: '篆书' as const, label: '篆书', count: get('篆书') },
      { id: '隶书' as const, label: '隶书', count: get('隶书') },
      { id: '楷书' as const, label: '楷书', count: get('楷书') },
      { id: '行书' as const, label: '行书', count: get('行书') },
      { id: '草书' as const, label: '草书', count: get('草书') },
    ].filter((c) => c.id === 'all' || c.count > 0);
  }, [steles]);

  const resetAllFilters = () => {
    setQuery('');
    setScript('all');
    setOnlyReady(false);
    setOnlyMustLearn(false);
    setProgressFilter('all');
    setDynasty('');
    setAuthor('');
    setSortMode('default');
    setAuthorQuery('');
  };

  const dynastyOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of steles) {
      const k = String(s.dynasty || '').trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.label.localeCompare(b.label, 'zh-Hans-CN')));
  }, [steles]);

  const authorOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of steles) {
      const k = String(s.author || '').trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.label.localeCompare(b.label, 'zh-Hans-CN')));
  }, [steles]);

  const filteredAuthorOptions = useMemo(() => {
    const q = normalizeNameKey(authorQuery);
    if (!q) return authorOptions;
    return authorOptions.filter((opt) => normalizeNameKey(opt.label).includes(q));
  }, [authorOptions, authorQuery]);

  const renderRow = (s: MasterpieceStele, variant: 'must' | 'list' | 'continue') => {
    const cover = getSteleCover(s);
    const isMust = variant === 'must' || level8.set.has(String(s.id));
    const ready = hasSteleAssets(s);
    const p = progressStore[String(s.id)] || null;
    const pct = p && p.totalCards > 0 ? Math.min(1, Math.max(0, (p.lastIndex + 1) / p.totalCards)) : 0;
    return (
      <button
        key={s.id}
        onClick={() => onSelect(s, { restoreLastPosition: true })}
        className="w-full text-left rounded-[1.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-[0_22px_70px_rgba(0,0,0,0.10)] overflow-hidden active:scale-[0.995] transition"
      >
        <div className="relative p-5 flex items-start gap-4">
          <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
          <div className="relative shrink-0 w-14 h-14 rounded-2xl overflow-hidden border border-stone-200/80 bg-stone-100">
            {cover ? (
              <img src={cover} alt={s.name} className="absolute inset-0 w-full h-full object-cover grayscale contrast-125" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-stone-700 font-serif font-black text-sm">帖</div>
            )}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[14px] font-serif font-black tracking-wide text-stone-900 leading-snug break-words">{s.name}</div>
              {isMust ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#8B0000]/10 text-[#8B0000] border border-[#8B0000]/20 px-2 py-0.5 text-[9px] font-black tracking-[0.2em]">
                  <Star size={10} />
                  必学
                </span>
              ) : null}
              {!ready ? (
                <span className="shrink-0 inline-flex items-center rounded-full bg-stone-900/5 text-stone-600 border border-stone-200/70 px-2 py-0.5 text-[9px] font-black tracking-[0.2em]">
                  待上传
                </span>
              ) : null}
              {p?.completedAt ? (
                <span className="shrink-0 inline-flex items-center rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 px-2 py-0.5 text-[9px] font-black tracking-[0.2em]">
                  已完成
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[10px] font-mono text-stone-500 tracking-widest truncate">
              {s.dynasty} · {formatAuthor(s.author)} · {s.script_type}
            </div>
            <div className="mt-2 text-[11px] font-serif text-stone-600 leading-relaxed line-clamp-2">
              {s.description || '从这帖开始，慢慢看懂一门书体。'}
            </div>

            {p ? (
              <div className="mt-3">
                <div className="h-[3px] rounded-full bg-stone-900/5 overflow-hidden">
                  <div className="h-full bg-[#8B0000]/60" style={{ width: `${Math.round(pct * 100)}%` }} />
                </div>
                <div className="mt-2 text-[9px] font-mono text-stone-500 tracking-widest">进度 {Math.round(pct * 100)}%</div>
              </div>
            ) : null}
          </div>
          <div className="relative shrink-0 w-10 h-10 rounded-full bg-white/70 border border-stone-200/80 text-stone-700 flex items-center justify-center shadow-sm">
            <ChevronRight size={18} />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="h-full overflow-y-auto px-5 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
            <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">学习路径</span>
          </div>
          <h2 className="text-3xl font-serif font-black tracking-[0.35em] pl-[0.35em] text-stone-900">名帖学习卡</h2>
          <p className="text-sm font-serif text-stone-600 leading-relaxed tracking-wide">把一帖拆成一组卡片：看懂背景、抓住技法、带着任务去临。</p>
        </div>

        {flagships.yishan || flagships.caoquan ? (
          <div className="mt-6 rounded-[2rem] bg-white/55 border border-stone-200/70 shadow-[0_22px_70px_rgba(0,0,0,0.10)] overflow-hidden">
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase">标杆体验</div>
                  <div className="text-[10px] font-mono text-stone-500 tracking-widest">2 入口</div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {flagships.yishan ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenYishanAppreciation) onOpenYishanAppreciation();
                        else onSelect(flagships.yishan!);
                      }}
                      className="h-12 rounded-[1.25rem] bg-white/70 border border-stone-200/80 text-stone-800 font-black tracking-[0.18em] shadow-sm active:scale-[0.99] transition flex items-center justify-between px-5"
                    >
                      <span>嶧山刻石 · 长卷观赏</span>
                      <span className="text-[10px] font-mono text-stone-500 tracking-widest">鉴赏</span>
                    </button>
                  ) : null}

                  {flagships.caoquan ? (
                    <button
                      type="button"
                      onClick={() => onSelect(flagships.caoquan!, { restoreLastPosition: true })}
                      className="h-12 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] font-black tracking-[0.16em] shadow-[0_18px_45px_rgba(139,0,0,0.22)] active:scale-[0.99] transition flex items-center justify-between px-5"
                    >
                      <span>曹全碑 · 学习闭环</span>
                      <span className="text-[10px] font-mono text-[#F2E6CE]/85 tracking-widest">
                        {caoquanProgress ? `继续 · ${Math.round(caoquanPct * 100)}%` : '开始'}
                      </span>
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 text-[11px] font-serif text-stone-600 leading-relaxed">推荐从「曹全碑」开始：同字多例 → 原拓定位 → 看语境。</div>
              </div>
            </div>
          </div>
        ) : null}

        {pathStats.total ? (
          <div className="mt-6 rounded-[2rem] bg-white/55 border border-stone-200/70 shadow-[0_22px_70px_rgba(0,0,0,0.10)] overflow-hidden">
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="relative">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase">{level8.label}</div>
                    <div className="mt-2 text-xl font-serif font-black tracking-wide text-stone-900">学习进度</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-stone-500 tracking-widest">{pathStats.done}/{pathStats.total}</div>
                    <div className="mt-1 text-[10px] font-serif text-stone-600 tracking-wide">已完成</div>
                  </div>
                </div>

                <div className="mt-4 h-2 rounded-full bg-stone-900/5 overflow-hidden">
                  <div className="h-full bg-[#8B0000]/60" style={{ width: `${Math.round(pathStats.pct * 100)}%` }} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-serif text-stone-600 leading-relaxed">
                    {pathStats.next ? `下一帖：${pathStats.next.name}` : '你已完成全部必学名帖。'}
                  </div>
                  {pathStats.next ? (
                    <button
                      onClick={() => onSelect(pathStats.next!, { restoreLastPosition: true })}
                      className="shrink-0 h-10 px-5 rounded-full bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[10px] font-black tracking-[0.28em] shadow-[0_14px_40px_rgba(139,0,0,0.22)] active:scale-95 transition"
                    >
                      继续
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-[1.75rem] bg-white/55 border border-stone-200/70 shadow-sm overflow-hidden">
          <div className="relative p-4">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
            <div className="relative flex items-center gap-3">
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="w-10 h-10 rounded-2xl bg-white/80 border border-stone-200/80 flex items-center justify-center text-stone-700 active:scale-95 transition"
                aria-label="Search"
              >
                <Search size={18} />
              </button>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索：作品 / 书家 / 朝代 / 现藏"
                className="flex-1 bg-transparent outline-none text-[12px] font-serif tracking-wide text-stone-800 placeholder:text-stone-500"
              />
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="w-9 h-9 rounded-full hover:bg-black/5 text-stone-500 flex items-center justify-center"
                  aria-label="Clear"
                >
                  <X size={16} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="w-10 h-10 rounded-2xl bg-white/80 border border-stone-200/80 flex items-center justify-center text-stone-700 active:scale-95 transition"
                aria-label="Advanced search"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = script === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setScript(c.id)}
                className={`px-4 py-2 rounded-full text-[10px] font-black tracking-[0.28em] transition border ${
                  active
                    ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60 shadow-[0_12px_30px_rgba(139,0,0,0.25)]'
                    : 'bg-white/55 text-stone-700 border-stone-200/70'
                }`}
              >
                {c.label}
                <span className={`ml-2 font-mono tracking-widest ${active ? 'text-[#F2E6CE]/90' : 'text-stone-500'}`}>{c.count}</span>
              </button>
            );
          })}
        </div>

        {searchActive || sortMode !== 'default' ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {script !== 'all' ? (
              <button
                type="button"
                onClick={() => setScript('all')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#8B0000]/10 text-[#8B0000] border border-[#8B0000]/20 text-[10px] font-black tracking-[0.18em]"
              >
                书体·{script}
                <X size={12} />
              </button>
            ) : null}

            {dynasty.trim() ? (
              <button
                type="button"
                onClick={() => setDynasty('')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.18em]"
              >
                朝代·{dynasty.trim()}
                <X size={12} />
              </button>
            ) : null}

            {author.trim() ? (
              <button
                type="button"
                onClick={() => setAuthor('')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.18em]"
              >
                书家·{author.trim()}
                <X size={12} />
              </button>
            ) : null}

            {progressFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setProgressFilter('all')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.18em]"
              >
                {progressFilter === 'completed' ? '已完成' : '学习中'}
                <X size={12} />
              </button>
            ) : null}

            {onlyReady ? (
              <button
                type="button"
                onClick={() => setOnlyReady(false)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.18em]"
              >
                已上传
                <X size={12} />
              </button>
            ) : null}

            {onlyMustLearn ? (
              <button
                type="button"
                onClick={() => setOnlyMustLearn(false)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.18em]"
              >
                必学
                <X size={12} />
              </button>
            ) : null}

            {sortMode !== 'default' ? (
              <button
                type="button"
                onClick={() => setSortMode('default')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/5 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.18em]"
              >
                {sortMode === 'recent' ? '最近学习' : sortMode === 'name' ? '作品名' : '推荐'}
                <X size={12} />
              </button>
            ) : null}

            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/55 text-stone-700 border border-stone-200/70 text-[10px] font-black tracking-[0.28em]"
            >
              清空
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setOnlyReady((v) => !v)}
            className={`h-10 px-5 rounded-full text-[10px] font-black tracking-[0.28em] border transition ${
              onlyReady
                ? 'bg-stone-900 text-white border-stone-900 shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                : 'bg-white/55 text-stone-700 border-stone-200/70'
            }`}
          >
            {onlyReady ? '显示全部' : '只看已上传'}
          </button>
          <div className="text-[10px] font-mono text-stone-500 tracking-widest">{onlyReady ? 'READY' : 'ALL'}</div>
        </div>

        {!searchActive && continues.length ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-end justify-between px-1">
              <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase">继续学习</div>
              <button
                onClick={() => setProgressStore(loadProgressStore())}
                className="text-[10px] font-mono text-stone-500 tracking-widest"
              >
                刷新
              </button>
            </div>
            <div className="space-y-3">{continues.map((x) => renderRow(x.stele, 'continue'))}</div>
          </div>
        ) : null}

        {!searchActive && mustLearn.length ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-end justify-between px-1">
              <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase">{level8.label} · 必学</div>
              <div className="text-[10px] font-mono text-stone-500 tracking-widest">{mustLearn.length} 帖</div>
            </div>
            <div className="space-y-3">{mustLearn.map((s) => renderRow(s, 'must'))}</div>
          </div>
        ) : null}

        <div className="mt-10 space-y-4">
          <div className="flex items-end justify-between px-1">
            <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase">
              {searchActive ? '筛选结果' : '全部名帖'}
            </div>
            <div className="text-[10px] font-mono text-stone-500 tracking-widest">
              {filtered.length}{searchActive ? ` / ${steles.length}` : ''} 帖
            </div>
          </div>
          {filtered.length ? (
            <div className="space-y-3">{filtered.map((s) => renderRow(s, 'list'))}</div>
          ) : (
            <div className="py-14 text-center rounded-[1.75rem] bg-white/55 border border-stone-200/70 shadow-sm">
              <p className="text-sm font-serif text-stone-600 tracking-wide">未找到匹配内容</p>
              <p className="mt-2 text-[10px] font-serif text-stone-500 tracking-[0.3em] opacity-70">试试换个关键词或清空筛选</p>
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-[10px] font-serif text-stone-500 tracking-[0.35em] opacity-70 pb-10">
          先看懂一帖，再去临一行
        </div>

        <AnimatePresence>
          {showAdvanced ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[360] bg-black/60"
              onClick={() => setShowAdvanced(false)}
            >
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="absolute left-0 right-0 bottom-0 rounded-t-[2rem] bg-[#F6F1E7] border-t border-white/40 shadow-[0_-40px_120px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                    <span className="text-[11px] font-black tracking-[0.6em] pl-[0.6em] text-stone-800">高级搜索</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/70 flex items-center justify-center text-stone-700 shadow-sm"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[72vh] overflow-y-auto">
                  <div className="space-y-6 pb-6">
                    <div>
                      <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase px-1">排序</div>
                      <div className="mt-3 flex bg-white/55 border border-stone-200/80 rounded-full p-1 shadow-sm">
                        {(
                          [
                            { id: 'default' as const, label: '默认' },
                            { id: 'recommended' as const, label: '推荐' },
                            { id: 'recent' as const, label: '最近' },
                            { id: 'name' as const, label: '作品名' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSortMode(opt.id)}
                            className={`flex-1 px-3 py-2 rounded-full text-[11px] font-black tracking-[0.18em] transition ${
                              sortMode === opt.id ? 'bg-[#111827] text-[#F2E6CE]' : 'text-stone-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase px-1">书体</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chips.map((c) => {
                          const active = script === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setScript(c.id)}
                              className={`px-4 py-2 rounded-full text-[10px] font-black tracking-[0.28em] transition border ${
                                active
                                  ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60 shadow-[0_12px_30px_rgba(139,0,0,0.25)]'
                                  : 'bg-white/55 text-stone-700 border-stone-200/70'
                              }`}
                            >
                              {c.label}
                              <span className={`ml-2 font-mono tracking-widest ${active ? 'text-[#F2E6CE]/90' : 'text-stone-500'}`}>{c.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase px-1">朝代</div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          onClick={() => setDynasty('')}
                          className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                            !dynasty.trim() ? 'bg-[#111827] text-[#F2E6CE] border-[#111827]/40' : 'bg-white/70 text-stone-700 border-stone-200/80'
                          }`}
                        >
                          不限
                        </button>
                        {dynastyOptions.map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setDynasty(opt.label)}
                            className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                              dynasty.trim() === opt.label
                                ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/50'
                                : 'bg-white/70 text-stone-700 border-stone-200/80'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className="ml-2 text-[10px] font-mono opacity-70">{opt.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between px-1">
                        <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase">书家</div>
                        <div className="text-[10px] font-mono text-stone-500 tracking-widest">{filteredAuthorOptions.length}</div>
                      </div>
                      <div className="mt-3 rounded-[1.25rem] bg-white/70 border border-stone-200/80 shadow-sm px-4 py-3 flex items-center gap-3">
                        <Search size={16} className="text-stone-500" />
                        <input
                          value={authorQuery}
                          onChange={(e) => setAuthorQuery(e.target.value)}
                          placeholder="筛书家…"
                          className="flex-1 bg-transparent border-none outline-none text-sm font-serif text-stone-800 placeholder-stone-400 tracking-wide"
                        />
                        {authorQuery.trim() ? (
                          <button
                            type="button"
                            onClick={() => setAuthorQuery('')}
                            className="w-8 h-8 rounded-full hover:bg-black/5 text-stone-500 flex items-center justify-center"
                            aria-label="Clear"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                        <button
                          type="button"
                          onClick={() => setAuthor('')}
                          className={`px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                            !author.trim() ? 'bg-[#111827] text-[#F2E6CE] border-[#111827]/40' : 'bg-white/70 text-stone-700 border-stone-200/80'
                          }`}
                        >
                          不限
                        </button>
                        {filteredAuthorOptions.map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setAuthor(opt.label)}
                            className={`px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                              author.trim() === opt.label
                                ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/50'
                                : 'bg-white/70 text-stone-700 border-stone-200/80'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className="ml-2 text-[10px] font-mono opacity-70">{opt.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase px-1">进度</div>
                      <div className="mt-3 flex gap-2">
                        {(
                          [
                            { id: 'all' as const, label: '不限' },
                            { id: 'in_progress' as const, label: '学习中' },
                            { id: 'completed' as const, label: '已完成' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setProgressFilter(opt.id)}
                            className={`px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                              progressFilter === opt.id
                                ? 'bg-[#111827] text-[#F2E6CE] border-[#111827]/40'
                                : 'bg-white/70 text-stone-700 border-stone-200/80'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOnlyReady((v) => !v)}
                        className={`h-11 rounded-[1.25rem] text-[10px] font-black tracking-[0.28em] border shadow-sm transition ${
                          onlyReady
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white/55 text-stone-700 border-stone-200/70'
                        }`}
                      >
                        {onlyReady ? '已开启：只看已上传' : '只看已上传'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlyMustLearn((v) => !v)}
                        className={`h-11 rounded-[1.25rem] text-[10px] font-black tracking-[0.28em] border shadow-sm transition ${
                          onlyMustLearn
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white/55 text-stone-700 border-stone-200/70'
                        }`}
                      >
                        {onlyMustLearn ? '已开启：只看必学' : '只看必学'}
                      </button>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="flex-1 h-11 rounded-full bg-white/70 border border-stone-200/80 text-stone-700 text-[10px] font-black tracking-[0.28em] shadow-sm"
                      >
                        清空
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(false)}
                        className="flex-1 h-11 rounded-full bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[10px] font-black tracking-[0.28em] shadow-[0_14px_40px_rgba(139,0,0,0.22)]"
                      >
                        完成
                      </button>
                    </div>
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

export function MobileMasterpieceStudyDeck({
  stele,
  initialCardId,
  restoreLastPosition,
  entryKey,
  initialAtlasChar,
  initialAtlasGlyphId,
  initialKnowledgePoint,
  onDone,
}: {
  stele: MasterpieceStele;
  initialCardId?: string;
  restoreLastPosition?: boolean;
  entryKey?: number;
  initialAtlasChar?: string;
  initialAtlasGlyphId?: number;
  initialKnowledgePoint?: number;
  onDone?: () => void;
}) {
  const { find } = useSteleKnowledge();
  const knowledge = find(stele);

  const cover = getSteleCover(stele);
  const pages = useMemo(() => getStelePages(stele), [stele]);
  const pageThumbs = useMemo(() => getStelePageThumbs(stele), [stele]);
  const practice = useMemo(() => getPracticeChars(stele), [stele]);
  const charIndexUrl = useMemo(() => getSteleCharIndexUrl(stele), [stele]);

  const doneTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current);
    };
  }, []);

  type ViewerHighlight = {
    cropBox: [number, number, number, number];
    label: string;
  };
  const [viewer, setViewer] = useState<null | { index: number; highlight?: ViewerHighlight | null }>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerNaturalSize, setViewerNaturalSize] = useState<null | { w: number; h: number }>(null);
  const viewerBoxRef = useRef<HTMLDivElement | null>(null);
  const [viewerBoxSize, setViewerBoxSize] = useState<null | { w: number; h: number }>(null);
  useEffect(() => {
    setViewer(null);
    setViewerError(null);
    setViewerNaturalSize(null);
    setViewerBoxSize(null);
  }, [stele.id]);

  useEffect(() => {
    const el = viewerBoxRef.current;
    if (!el) return;

    const update = () => {
      setViewerBoxSize({ w: el.clientWidth, h: el.clientHeight });
    };
    update();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [viewer?.index]);

  const highlightRect = useMemo(() => {
    const h = viewer?.highlight;
    if (!viewer || !h) return null;
    if (!viewerNaturalSize || !viewerBoxSize) return null;

    const [x1, y1, x2, y2] = h.cropBox;
    const naturalW = viewerNaturalSize.w;
    const naturalH = viewerNaturalSize.h;
    const boxW = viewerBoxSize.w;
    const boxH = viewerBoxSize.h;
    if (!naturalW || !naturalH || !boxW || !boxH) return null;

    const scale = Math.min(boxW / naturalW, boxH / naturalH);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;
    const offsetX = (boxW - drawW) / 2;
    const offsetY = (boxH - drawH) / 2;
    const left = offsetX + x1 * scale;
    const top = offsetY + y1 * scale;
    const width = Math.max(0, (x2 - x1) * scale);
    const height = Math.max(0, (y2 - y1) * scale);

    return { left, top, width, height };
  }, [viewer, viewer?.highlight, viewerNaturalSize, viewerBoxSize]);

  type ConfettiParticle = {
    id: string;
    left: number;
    size: number;
    delay: number;
    duration: number;
    rotate: number;
    drift: number;
    color: string;
    shape: 'square' | 'circle' | 'diamond';
  };

  const [celebration, setCelebration] = useState<null | { key: string; particles: ConfettiParticle[] }>(null);

  const originalText = String(stele.content || '').trim();
  const quoteSource = originalText || knowledge?.history || knowledge?.appreciation || '';
  const excerptSource = originalText || knowledge?.history || knowledge?.technique || knowledge?.appreciation || '';
  const quote = pickQuote(quoteSource, 70);
  const excerpt = buildExcerpt(excerptSource, 820);
  const technique = pickLines(knowledge?.technique || '', 3);
  const appreciation = pickLines(knowledge?.appreciation || '', 2);
  const history = knowledge?.history || '';
  const legacy = knowledge?.legacy || '';
  const checklist = checklistByScript(stele.script_type);

  const cards = useMemo(() => {
    const list: Array<{ id: string; title: string; render: () => ReactNode }> = [];

    const ready = hasSteleAssets(stele);

    list.push({
      id: 'cover',
      title: '封面',
      render: () => (
        <div className="relative h-full overflow-hidden rounded-[2.25rem] border border-stone-200/70 bg-white/50 shadow-[0_30px_120px_rgba(0,0,0,0.18)]">
          {cover ? (
            <>
              <div className="absolute inset-0">
              <img src={cover} alt={stele.name} className="w-full h-full object-cover grayscale contrast-125" loading={IMG_LOADING} decoding={IMG_DECODING} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/55 to-[#F1E8DA]" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-[#F1E8DA]" />
          )}

          <div className="absolute inset-0 opacity-[0.10] bg-[url('/noise.png')]" />
          <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />

          <div className="relative h-full p-7 flex flex-col">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-stone-200/80 px-4 py-2 w-fit">
              <span className="text-[11px] font-black tracking-[0.4em] pl-[0.4em] text-stone-700">名帖学习卡</span>
              <span className="text-[10px] font-mono text-stone-500 tracking-widest">8级路径</span>
            </div>

            <div className="mt-auto">
              <div className="text-4xl font-serif font-black tracking-[0.25em] pl-[0.25em] text-stone-950 leading-tight">{stele.name}</div>
              <div className="mt-3 text-[13px] font-sans font-medium text-stone-700 tracking-wide">
                {stele.dynasty} · {formatAuthor(stele.author)} · {stele.script_type}
              </div>
              <div className="mt-5 text-[15px] font-sans text-stone-800 leading-relaxed">{stele.description || '先看懂，再去临。'}</div>
              {quote ? (
                <div className="mt-6 rounded-[1.25rem] bg-white/60 border border-stone-200/70 p-4">
                  <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">摘句</div>
                  <div className="mt-2 text-[16px] font-serif font-semibold text-stone-950 leading-relaxed">“{quote}”</div>
                </div>
              ) : null}

              {!ready ? (
                <div className="mt-4 rounded-[1.25rem] bg-stone-900/5 border border-stone-200/70 p-4">
                  <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">提示</div>
                  <div className="mt-2 text-[14px] font-sans text-stone-700 leading-relaxed">
                    这帖还没上传原帖图片；当前卡片先读背景与技法。上传后会自动出现「原拓」与缩略预览。
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ),
    });

    list.push({
      id: 'about',
      title: '导读',
      render: () => (
        <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="relative p-7">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
            <div className="relative">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">三分钟读懂</div>
              <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">{stele.name}</div>
              <div className="mt-2 text-[12px] font-mono text-stone-500 tracking-widest">{stele.dynasty} · {formatAuthor(stele.author)} · {stele.year || '—'} · {stele.location}</div>
              <div className="mt-6 space-y-5">
                <div className="rounded-[1.5rem] bg-white/60 border border-stone-200/70 p-5">
                  <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">一句话</div>
                  <div className="mt-2 text-[16px] font-sans font-medium text-stone-800 leading-relaxed">{stele.description || '先看气韵，再读背景，再抓技法。'}</div>
                </div>
                {history ? (
                  <div className="rounded-[1.5rem] bg-white/60 border border-stone-200/70 p-5">
                    <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">背景</div>
                    <div className="mt-2 text-[16px] font-sans text-stone-800 leading-relaxed">{history}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ),
    });

    list.push({
      id: 'technique',
      title: '技法',
      render: () => (
        <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="relative p-7">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
            <div className="relative">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">技法要点</div>
              <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">三条就够</div>
              <div className="mt-7 space-y-3">
                {(technique.length ? technique : ['先看起收，再看提按，最后看结体。']).map((t, i) => (
                  <div key={i} className="rounded-[1.5rem] bg-white/65 border border-stone-200/70 p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#8B0000]/10 border border-[#8B0000]/15 text-[#8B0000] flex items-center justify-center text-[12px] font-black">{i + 1}</div>
                      <div className="text-[16px] font-sans text-stone-900 leading-relaxed">{t}</div>
                    </div>
                  </div>
                ))}
              </div>
              {knowledge?.technique ? (
                <div className="mt-6 text-[12px] font-sans text-stone-600 leading-relaxed">来自「书法知识库」：{knowledge.name}</div>
              ) : null}
            </div>
          </div>
        </div>
      ),
    });

    list.push({
      id: 'aesthetic',
      title: '气质',
      render: () => (
        <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="relative p-7">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
            <div className="relative">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">审美与气韵</div>
              <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">如何看出“好”</div>
              <div className="mt-7 space-y-4">
                {(appreciation.length ? appreciation : ['先看字势，再看用笔的收放，最后看章法的呼吸。']).map((t, i) => (
                  <div key={i} className="rounded-[1.75rem] bg-white/65 border border-stone-200/70 p-6">
                    <div className="text-[16px] font-sans text-stone-900 leading-relaxed">{t}</div>
                  </div>
                ))}
                {legacy ? (
                  <div className="rounded-[1.75rem] bg-white/65 border border-stone-200/70 p-6">
                    <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">传承</div>
                    <div className="mt-2 text-[15px] font-sans text-stone-800 leading-relaxed">{legacy}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ),
    });

    list.push({
      id: 'excerpt',
      title: '节选',
      render: () => (
        <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="relative p-7 h-full flex flex-col min-h-0">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
            <div className="relative">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">{originalText ? '原文节选' : '札记摘录'}</div>
              <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">读一段就够</div>
            </div>

            <div className="relative mt-5 flex-1 min-h-0 rounded-[1.75rem] bg-white/65 border border-stone-200/70 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <div className="border-l-4 border-[#8B0000]/20 pl-4 text-[16px] font-sans text-stone-800 leading-[2.05] tracking-[0.02em] text-justify-zh whitespace-pre-wrap">
                  {excerpt || (originalText ? '暂无原文。' : '暂无摘录。')}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[12px] font-sans text-stone-600 leading-relaxed">
              提示：先读懂意思，再回看字势与转折。
            </div>
          </div>
        </div>
      ),
    });

    if (pages.length) {
      list.push({
          id: 'pages',
          title: '原拓',
          render: () => (
            <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
              <div className="relative p-7">
                <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
                <div className="relative">
                <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">原拓浏览</div>
                <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">看“全帖气”</div>
                <div className="mt-6 rounded-[1.75rem] bg-white/65 border border-stone-200/70 p-5">
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {(pageThumbs.length ? pageThumbs : pages).map((src, i) => (
                      <button
                        key={src}
                        onClick={() => {
                          const pageSrc = pages[i] || src;
                          console.debug('[MasterpieceStudy] open stele page', {
                            steleId: String(stele.id),
                            steleName: String(stele.name || ''),
                            pageIndex: i,
                            thumbSrc: src,
                            pageSrc,
                          });
                          setViewerNaturalSize(null);
                          setViewerError(null);
                          setViewer({ index: i, highlight: null });
                        }}
                        className="shrink-0 w-20 h-28 rounded-2xl overflow-hidden border border-stone-200/80 bg-white active:scale-[0.99] transition"
                        aria-label={`Open page ${i + 1}`}
                      >
                      <img
                        src={src}
                        alt="page"
                        className="w-full h-full object-contain grayscale contrast-150"
                        loading={IMG_LOADING}
                        decoding={IMG_DECODING}
                        onError={() => {
                          console.error('[MasterpieceStudy] page thumb load failed', {
                            steleId: String(stele.id),
                            steleName: String(stele.name || ''),
                            thumbSrc: src,
                            pageSrc: pages[i] || null,
                          });
                        }}
                      />
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-[12px] font-sans text-stone-600">本帖共 {pages.length} 张，横向滑动做快速扫读。</div>
                </div>
              </div>
            </div>
          </div>
        ),
      });
    }

    if (charIndexUrl) {
      list.push({
        id: 'atlas',
        title: '字库',
        render: () => (
          <MasterpieceCharAtlasCard
            indexUrl={charIndexUrl}
            initialChar={initialAtlasChar || (stele.id === 'li_001' ? '曹' : undefined)}
            initialGlyphId={initialAtlasGlyphId}
            onOpenInPage={({ pageIndex, cropBox, label }) => {
              console.debug('[MasterpieceStudy] open stele page from atlas', {
                steleId: String(stele.id),
                steleName: String(stele.name || ''),
                pageIndex,
                cropBox,
                label,
                pageSrc: pages[pageIndex] || null,
              });
              setViewerNaturalSize(null);
              setViewerError(null);
              setViewer({ index: pageIndex, highlight: { cropBox, label } });
            }}
          />
        ),
      });

      if (stele.id === 'li_001') {
        list.push({
          id: 'knowledge',
          title: '证据',
          render: () => (
            <CaoquanKnowledgeCard
              stele={stele}
              charIndexUrl={charIndexUrl}
              initialOpenPoint={initialKnowledgePoint}
              onOpenInPage={({ pageIndex, cropBox, label }) => {
                setViewerNaturalSize(null);
                setViewerError(null);
                setViewer({ index: pageIndex, highlight: { cropBox, label } });
              }}
            />
          ),
        });
      }
    }

    if (practice.length) {
      list.push({
          id: 'practice',
          title: '任务',
          render: () => (
            <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
              <div className="relative p-7">
              <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="relative">
                <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">今日临摹任务</div>
                <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">临三字</div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {practice.slice(0, 3).map((p) => (
                    <div key={p.char} className="rounded-[1.5rem] bg-white/70 border border-stone-200/70 overflow-hidden">
                      <div className="relative w-full aspect-square bg-stone-100">
                        <img src={p.image} alt={p.char} className="absolute inset-0 w-full h-full object-contain grayscale contrast-150" />
                      </div>
                      <div className="p-3">
                        <div className="text-[18px] font-serif font-black text-stone-950 tracking-wide">{p.char}</div>
                        <div className="mt-1 text-[12px] font-sans text-stone-600 leading-relaxed">{p.hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-[1.5rem] bg-white/65 border border-stone-200/70 p-5">
                  <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">做法</div>
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-[#8B0000]/10 border border-[#8B0000]/15 text-[#8B0000] flex items-center justify-center text-[12px] font-black">1</div>
                      <div className="text-[15px] font-sans text-stone-800 leading-relaxed">
                        <span className="font-black text-[#8B0000] underline decoration-[#8B0000]/25 underline-offset-4">慢写一遍</span>
                        <span className="ml-2">只看</span>
                        <span className="ml-2 font-black text-stone-900">起收</span>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-stone-900/5 border border-stone-200/80 text-stone-700 flex items-center justify-center text-[12px] font-black">2</div>
                      <div className="text-[15px] font-sans text-stone-800 leading-relaxed">
                        <span className="font-black text-stone-900">正常写三遍</span>
                        <span className="ml-2">找</span>
                        <span className="ml-2 font-black text-[#8B0000]">节奏</span>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-stone-900/5 border border-stone-200/80 text-stone-700 flex items-center justify-center text-[12px] font-black">3</div>
                      <div className="text-[15px] font-sans text-stone-800 leading-relaxed">
                        <span className="font-black text-stone-900">放大一遍</span>
                        <span className="ml-2">追求</span>
                        <span className="ml-2 font-black text-[#8B0000]">气</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      });
    }

    list.push({
      id: 'check',
      title: '自检',
      render: () => (
        <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="relative p-7">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
            <div className="relative">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">8级自检清单</div>
              <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">写完看这五条</div>
              <div className="mt-6 space-y-3">
                {checklist.slice(0, 5).map((t, i) => {
                  const raw = String(t || '').trim();
                  const idx = raw.includes('：') ? raw.indexOf('：') : raw.includes(':') ? raw.indexOf(':') : -1;
                  const head = idx >= 0 ? raw.slice(0, idx).trim() : raw;
                  const tail = idx >= 0 ? raw.slice(idx + 1).trim() : '';
                  return (
                    <div key={i} className="rounded-[1.5rem] bg-white/65 border border-stone-200/70 p-5 flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-stone-900/5 border border-stone-200/80 flex items-center justify-center text-[12px] font-black text-stone-700">
                        {i + 1}
                      </div>
                      <div className="text-[15px] font-sans text-stone-800 leading-relaxed">
                        <span className="font-black text-stone-950 underline decoration-[#8B0000]/25 underline-offset-4">{head}</span>
                        {tail ? <span className="text-stone-700">：{tail}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 text-[12px] font-sans text-stone-600 leading-relaxed">小技巧：每次只盯一条改，进步最快。</div>
            </div>
          </div>
        </div>
      ),
    });

    list.push({
      id: 'done',
      title: '完成',
      render: () => (
        <div className="min-h-full rounded-[2.25rem] border border-stone-200/70 bg-white/60 shadow-[0_30px_120px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="relative p-7 h-full flex flex-col">
            <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="relative">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">今日完成</div>
              <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">把这一帖记住</div>
              <div className="mt-6 space-y-3">
                <div className="rounded-[1.75rem] bg-white/65 border border-stone-200/70 p-6">
                  <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">一句话复述</div>
                  <div className="mt-2 text-[16px] font-sans font-medium text-stone-900 leading-relaxed">{knowledge?.appreciation || stele.description || '看懂气韵，写出节奏。'}</div>
                </div>
                <div className="rounded-[1.75rem] bg-white/65 border border-stone-200/70 p-6">
                  <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">明日继续</div>
                  <div className="mt-2 text-[15px] font-sans text-stone-800 leading-relaxed">
                    挑 1 个字反复写 <span className="font-black text-stone-950">20</span> 遍：只改
                    <span className="ml-2 font-black text-[#8B0000] underline decoration-[#8B0000]/25 underline-offset-4">起收</span>。
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto relative">
              <button
                onClick={() => {
                  if (celebration) return;
                  markCompleted(String(stele.id), list.length);
                  const now = Date.now();
                  const colors = ['#C02C38', '#8B0000', '#D4AF37', '#F2E6CE'];
                  const shapes: Array<'square' | 'circle' | 'diamond'> = ['diamond', 'square', 'circle'];
                  const particles: ConfettiParticle[] = Array.from({ length: 34 }, (_, i) => {
                    const left = Math.random() * 100;
                    const size = 8 + Math.random() * 10;
                    const delay = Math.random() * 0.2;
                    const duration = 1.0 + Math.random() * 0.7;
                    const rotate = (Math.random() - 0.5) * 720;
                    const drift = (Math.random() - 0.5) * 140;
                    const color = colors[i % colors.length];
                    const shape = shapes[i % shapes.length];
                    return {
                      id: `${now}_${i}`,
                      left,
                      size,
                      delay,
                      duration,
                      rotate,
                      drift,
                      color,
                      shape,
                    };
                  });

                  setCelebration({ key: String(now), particles });
                  if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current);
                  doneTimerRef.current = window.setTimeout(() => {
                    if (onDone) onDone();
                    else setCelebration(null);
                  }, 1750);
                }}
                disabled={!!celebration}
                className="w-full h-12 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] font-black tracking-[0.25em] text-[12px] shadow-xl active:scale-95 transition disabled:opacity-60"
              >
                {celebration ? '已打卡' : '打卡完成'}
              </button>
              <div className="mt-3 text-center text-[11px] font-sans text-stone-600 tracking-wide opacity-90">完成会记录在“继续学习”里</div>
            </div>
          </div>
        </div>
      ),
    });

    return list;
  }, [
    cover,
    stele,
    knowledge,
    pages.length,
    practice.length,
    charIndexUrl,
    quote,
    excerpt,
    technique.join('|'),
    appreciation.join('|'),
    history,
    legacy,
    checklist.join('|'),
    celebration?.key,
    onDone,
  ]);

  const [index, setIndex] = useState(0);
  const didInitRef = useRef<number | null>(null);
  useEffect(() => {
    if (!cards.length) return;
    const k = typeof entryKey === 'number' ? entryKey : 0;
    if (didInitRef.current === k) return;

    let nextIndex = 0;
    let reason: 'default' | 'initialCardId' | 'restoreLastPosition' = 'default';

    if (initialCardId) {
      const i = cards.findIndex((c) => c.id === initialCardId);
      if (i >= 0) {
        nextIndex = i;
        reason = 'initialCardId';
      }
    } else if (restoreLastPosition) {
      const p = getProgressFor(String(stele.id));
      if (p && typeof p.lastIndex === 'number') {
        nextIndex = Math.max(0, Math.min(cards.length - 1, p.lastIndex));
        reason = 'restoreLastPosition';
      }
    }

    console.debug('[MasterpieceStudy] init deck index', {
      steleId: String(stele.id),
      steleName: String(stele.name || ''),
      entryKey: k,
      reason,
      nextIndex,
      initialCardId: initialCardId || null,
      restoreLastPosition: Boolean(restoreLastPosition),
      savedLastIndex: getProgressFor(String(stele.id))?.lastIndex ?? null,
      totalCards: cards.length,
    });

    setIndex(nextIndex);
    didInitRef.current = k;
  }, [stele.id, cards.length, initialCardId, restoreLastPosition, entryKey]);

  // Persist position.
  useEffect(() => {
    if (!cards.length) return;
    upsertProgress(String(stele.id), { totalCards: cards.length, lastIndex: index });
  }, [stele.id, cards.length, index]);

  const canPrev = index > 0;
  const canNext = index < cards.length - 1;

  return (
    <div className="h-full overflow-hidden px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto h-full flex flex-col">
        <div className="flex items-center justify-between px-1">
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-stone-500 tracking-widest truncate">
              {stele.dynasty} · {formatAuthor(stele.author)} · {stele.script_type}
            </div>
            <div className="mt-1 text-[14px] font-serif font-black text-stone-900 tracking-wide truncate">{stele.name}</div>
          </div>
          <div className="text-[11px] font-mono text-stone-500 tracking-widest">
            {String(index + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
          </div>
        </div>

        <div className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <AnimatePresence mode="wait">
            <motion.div
              key={cards[index]?.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="min-h-full"
            >
              {cards[index]?.render()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={() => canPrev && setIndex((i) => Math.max(0, i - 1))}
            disabled={!canPrev}
            className="flex-1 h-12 rounded-[1.25rem] bg-white/55 border border-stone-200/70 text-stone-800 font-black tracking-[0.25em] text-[12px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <ChevronLeft size={18} /> 上一张
          </button>
          <button
            onClick={() => canNext && setIndex((i) => Math.min(cards.length - 1, i + 1))}
            disabled={!canNext}
            className="flex-1 h-12 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] font-black tracking-[0.25em] text-[12px] flex items-center justify-center gap-2 shadow-xl disabled:opacity-40"
          >
            下一张 <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {viewer && pages.length ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[380] bg-black/90 backdrop-blur-2xl"
            onClick={() => {
              setViewer(null);
              setViewerError(null);
              setViewerNaturalSize(null);
              setViewerBoxSize(null);
            }}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="absolute inset-x-0 top-[max(env(safe-area-inset-top),32px)] bottom-[env(safe-area-inset-bottom)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-black tracking-[0.18em] text-[#F2E6CE] truncate">{stele.name}</div>
                  <div className="mt-1 text-[10px] font-mono text-stone-400 tracking-widest">第 {viewer.index + 1} / {pages.length} 张</div>
                  {viewer.highlight?.label ? (
                    <div className="mt-2 text-[12px] font-sans text-[#F2E6CE]/90 leading-relaxed">
                      定位：<span className="font-black">{viewer.highlight.label}</span>
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    setViewer(null);
                    setViewerError(null);
                    setViewerNaturalSize(null);
                    setViewerBoxSize(null);
                  }}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-stone-200"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 px-5 pb-5">
                <div className="h-full rounded-[1.75rem] bg-black/30 border border-white/10 overflow-hidden">
                  <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit>
                    <TransformComponent
                      wrapperStyle={{ width: '100%', height: '100%' }}
                      contentStyle={{ width: '100%', height: '100%' }}
                    >
                      <div ref={viewerBoxRef} className="relative w-full h-full">
                        <img
                          src={pages[viewer.index]}
                          alt="page"
                          className="w-full h-full object-contain"
                          draggable={false}
                          loading={IMG_LOADING}
                          decoding={IMG_DECODING}
                          onLoad={(e) => {
                            const w = e.currentTarget.naturalWidth;
                            const h = e.currentTarget.naturalHeight;
                            if (w > 0 && h > 0) setViewerNaturalSize({ w, h });
                            console.debug('[MasterpieceStudy] stele page loaded', {
                              steleId: String(stele.id),
                              steleName: String(stele.name || ''),
                              pageIndex: viewer.index,
                              pageSrc: pages[viewer.index] || null,
                              natural: { w, h },
                              box: viewerBoxSize,
                            });
                          }}
                          onError={() => {
                            const pageSrc = pages[viewer.index] || '';
                            console.error('[MasterpieceStudy] stele page load failed', {
                              steleId: String(stele.id),
                              steleName: String(stele.name || ''),
                              pageIndex: viewer.index,
                              pageSrc,
                            });
                            setViewerError(pageSrc || 'unknown');
                          }}
                        />

                        {viewerError ? (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="max-w-[92%] rounded-[1.5rem] bg-black/60 border border-white/15 px-5 py-4 text-center shadow-2xl">
                              <div className="text-[12px] font-black tracking-[0.25em] text-[#F2E6CE]">图片加载失败</div>
                              <div className="mt-2 text-[10px] font-mono tracking-widest text-stone-200/80 break-all">{viewerError}</div>
                              <div className="mt-2 text-[11px] font-sans text-stone-200/80">打开 F12 → Console 查看详细日志与 URL。</div>
                            </div>
                          </div>
                        ) : null}

                        {viewer.highlight && highlightRect ? (
                          <motion.div
                            className="absolute rounded-2xl border-2 border-[#C02C38] bg-[#C02C38]/10 shadow-[0_20px_70px_rgba(192,44,56,0.25)]"
                            style={{
                              left: `${highlightRect.left}px`,
                              top: `${highlightRect.top}px`,
                              width: `${highlightRect.width}px`,
                              height: `${highlightRect.height}px`,
                            }}
                            initial={{ opacity: 0.35 }}
                            animate={{ opacity: [0.35, 1, 0.35] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        ) : null}
                      </div>
                    </TransformComponent>
                  </TransformWrapper>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setViewerNaturalSize(null);
                    setViewerError(null);
                    setViewer((v) => {
                      if (!v) return v;
                      const nextIndex = Math.max(0, v.index - 1);
                      return { index: nextIndex, highlight: null };
                    });
                  }}
                  disabled={viewer.index <= 0}
                  className="flex-1 h-12 rounded-[1.25rem] bg-white/10 border border-white/10 text-stone-100 font-black tracking-[0.25em] text-[12px] flex items-center justify-center gap-2 disabled:opacity-35"
                >
                  <ChevronLeft size={18} /> 上一张
                </button>
                <button
                  onClick={() => {
                    setViewerNaturalSize(null);
                    setViewerError(null);
                    setViewer((v) => {
                      if (!v) return v;
                      const nextIndex = Math.min(pages.length - 1, v.index + 1);
                      return { index: nextIndex, highlight: null };
                    });
                  }}
                  disabled={viewer.index >= pages.length - 1}
                  className="flex-1 h-12 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] font-black tracking-[0.25em] text-[12px] flex items-center justify-center gap-2 shadow-xl disabled:opacity-35"
                >
                  下一张 <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {celebration ? (
          <motion.div
            key={celebration.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[420] pointer-events-none overflow-hidden"
          >
            {celebration.particles.map((p) => {
              const baseRotate = p.shape === 'diamond' ? 45 : 0;
              const radius = p.shape === 'circle' ? 9999 : 6;
              return (
                <motion.span
                  key={p.id}
                  className="absolute top-0"
                  style={{
                    left: `${p.left}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: p.color,
                    borderRadius: `${radius}px`,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.10)',
                  }}
                  initial={{ y: -60, x: 0, opacity: 0, rotate: baseRotate }}
                  animate={{ y: '110%', x: p.drift, opacity: [0, 1, 1, 0], rotate: baseRotate + p.rotate }}
                  transition={{ delay: p.delay, duration: p.duration, ease: 'easeOut' }}
                />
              );
            })}

            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="rounded-[1.75rem] bg-white/85 border border-stone-200/70 px-7 py-6 shadow-[0_40px_120px_rgba(0,0,0,0.28)]"
              >
                <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase">打卡成功</div>
                <div className="mt-2 text-2xl font-serif font-black tracking-wide text-stone-950">已完成</div>
                <div className="mt-2 text-[12px] font-sans text-stone-700 leading-relaxed">回到列表继续下一帖。</div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
