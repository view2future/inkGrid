import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

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
  };
};

export type CharSliceIndex = {
  name: string;
  total_images: number;
  total_chars: number;
  skipped_chunk?: { chunk_index: number; text: string };
  files: CharSliceIndexFile[];
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

function chunkWithHighlight(chunk: string, index: number) {
  const chars = Array.from(String(chunk || ''));
  if (!chars.length) return [] as Array<{ ch: string; active: boolean }>;
  return chars.map((ch, i) => ({ ch, active: i === index }));
}

export function MasterpieceCharAtlasCard({
  indexUrl,
  initialChar,
  onOpenInPage,
}: {
  indexUrl: string;
  initialChar?: string;
  onOpenInPage: (args: {
    pageIndex: number;
    cropBox: [number, number, number, number];
    label: string;
  }) => void;
}) {
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<CharSliceIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedChar, setSelectedChar] = useState('');
  const [selectedOccIdx, setSelectedOccIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const baseDir = useMemo(() => baseDirFromUrl(indexUrl), [indexUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.debug('[CharAtlas] loading index', { indexUrl });
        const res = await fetch(indexUrl);
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
    return map;
  }, [data]);

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
    const init = toChar(initialChar || query) || (topChars[0]?.char || '');
    if (!init) return;
    setSelectedChar((prev) => prev || init);
  }, [data, initialChar, query, topChars]);

  useEffect(() => {
    const ch = toChar(query);
    if (ch) {
      setSelectedChar(ch);
      setSelectedOccIdx(0);
    }
  }, [query]);

  const occurrences = useMemo(() => {
    const ch = String(selectedChar || '').trim();
    if (!ch) return [] as CharSliceIndexFile[];
    return byChar.get(ch) || [];
  }, [byChar, selectedChar]);

  const occIdx = clamp(selectedOccIdx, 0, Math.max(0, occurrences.length - 1));
  const selected = occurrences.length ? occurrences[occIdx] : null;

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
    const pageIndex = Math.max(0, Number(f?.source?.image_index || 1) - 1);
    const cropBox = f?.source?.crop_box;
    if (!cropBox || cropBox.length !== 4) return;
    onOpenInPage({
      pageIndex,
      cropBox,
      label: `${String(f.char || '').trim()} · 第${f.index}字`,
    });
  };

  const renderThumb = (f: CharSliceIndexFile, active: boolean, onClick: () => void) => {
    const src = baseDir + f.file;
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
      <div className="relative p-7 h-full flex flex-col min-h-0">
        <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">字库与定位</div>
            <div className="mt-3 text-2xl font-serif font-black tracking-wide text-stone-950">一字多形 · 回到原拓</div>
            <div className="mt-2 text-[12px] font-sans text-stone-600">
              {isLoading
                ? '正在加载字库…'
                : error
                  ? `加载失败：${error}（${indexUrl}）`
                  : `${stats.total || data?.total_chars || 0} 字 · ${stats.unique} 个不同字`}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setTab('search')}
              className={`h-10 px-4 rounded-full text-[10px] font-black tracking-[0.24em] border transition ${
                tab === 'search'
                  ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60'
                  : 'bg-white/55 text-stone-700 border-stone-200/70'
              }`}
            >
              <Search size={14} className="inline-block -mt-0.5 mr-2" />
              检索
            </button>
            <button
              onClick={() => {
                setTab('read');
                window.setTimeout(() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  el.scrollLeft = 0;
                }, 0);
              }}
              className={`h-10 px-4 rounded-full text-[10px] font-black tracking-[0.24em] border transition ${
                tab === 'read'
                  ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60'
                  : 'bg-white/55 text-stone-700 border-stone-200/70'
              }`}
            >
              <BookOpen size={14} className="inline-block -mt-0.5 mr-2" />
              通读
            </button>
          </div>
        </div>

        {tab === 'search' ? (
          <>
            <div className="relative mt-6 rounded-[1.75rem] bg-white/55 border border-stone-200/70 shadow-sm overflow-hidden">
              <div className="relative p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/80 border border-stone-200/80 flex items-center justify-center text-stone-700">
                  <Search size={18} />
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="输入一个字（建议从原文里拷贝）"
                  className="flex-1 bg-transparent outline-none text-[16px] font-sans text-stone-900 placeholder:text-stone-500"
                />
                <div className="shrink-0 text-[10px] font-mono text-stone-500 tracking-widest">
                  {selectedChar ? `「${selectedChar}」` : '—'}
                </div>
              </div>
            </div>

            {topChars.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {topChars.map((c) => (
                  <button
                    key={c.char}
                    onClick={() => {
                      setSelectedChar(c.char);
                      setSelectedOccIdx(0);
                    }}
                    className={`px-4 py-2 rounded-full text-[11px] font-black tracking-[0.22em] border transition ${
                      selectedChar === c.char
                        ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60'
                        : 'bg-white/55 text-stone-700 border-stone-200/70'
                    }`}
                  >
                    {c.char}
                    <span className={`ml-2 font-mono tracking-widest ${selectedChar === c.char ? 'text-[#F2E6CE]/90' : 'text-stone-500'}`}>
                      {c.count}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex-1 min-h-0 grid grid-cols-1 gap-4">
              <div className="rounded-[1.75rem] bg-white/65 border border-stone-200/70 overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">同字对照</div>
                    <div className="mt-2 text-[15px] font-sans text-stone-800 leading-relaxed">
                      {selectedChar ? (
                        <>
                          当前：<span className="font-black text-stone-950">{selectedChar}</span>
                          <span className="ml-3 text-stone-500">共 {occurrences.length} 处</span>
                        </>
                      ) : (
                        '输入或点选一个字'
                      )}
                    </div>
                    {selected ? (
                      <div className="mt-2 text-[12px] font-mono text-stone-500 tracking-widest">
                        第 {selected.source.image_index} 张 · 网格({selected.source.grid.col},{selected.source.grid.row}) · 第{selected.index}字
                      </div>
                    ) : null}
                  </div>

                  {selected ? (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedOccIdx((i) => Math.max(0, i - 1))}
                        disabled={occIdx <= 0}
                        className="w-10 h-10 rounded-full bg-white/70 border border-stone-200/70 flex items-center justify-center text-stone-700 disabled:opacity-35"
                        aria-label="Previous occurrence"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setSelectedOccIdx((i) => Math.min(occurrences.length - 1, i + 1))}
                        disabled={occIdx >= occurrences.length - 1}
                        className="w-10 h-10 rounded-full bg-white/70 border border-stone-200/70 flex items-center justify-center text-stone-700 disabled:opacity-35"
                        aria-label="Next occurrence"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {selected ? (
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <div className="w-full aspect-square rounded-[1.5rem] bg-white/70 border border-stone-200/70 overflow-hidden">
                          <img
                            src={baseDir + selected.file}
                            alt={selected.char}
                            className="w-full h-full object-contain grayscale contrast-150"
                            loading={IMG_LOADING}
                            decoding={IMG_DECODING}
                          />
                        </div>
                        <button
                          onClick={() => openInPage(selected)}
                          className="mt-3 w-full h-10 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[11px] font-black tracking-[0.22em] shadow-sm active:scale-95 transition"
                        >
                          原拓定位
                        </button>
                        <div className="mt-2 text-center text-[10px] font-sans text-stone-600">点开看上下文</div>
                      </div>

                      <div className="col-span-2">
                        <div className="grid grid-cols-3 gap-3">
                          {occurrences.slice(0, 18).map((f, i) =>
                            renderThumb(f, i === occIdx, () => {
                              setSelectedOccIdx(i);
                            })
                          )}
                        </div>
                        {occurrences.length > 18 ? (
                          <div className="mt-3 text-[11px] font-sans text-stone-500">只展示前 18 处；可用左右按钮逐处浏览。</div>
                        ) : null}
                      </div>
                    </div>

                    {selected.source?.chunk ? (
                      <div className="mt-5 rounded-[1.25rem] bg-white/60 border border-stone-200/70 p-4">
                        <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">语境（18字）</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {chunkWithHighlight(String(selected.source.chunk), Number(selected.source.pos_in_chunk || 0)).map((x, i) => (
                            <span
                              key={i}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-[16px] font-serif font-black border transition ${
                                x.active
                                  ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60 shadow-[0_14px_40px_rgba(139,0,0,0.22)]'
                                  : 'bg-white/70 text-stone-900 border-stone-200/70'
                              }`}
                            >
                              {x.ch}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-[11px] font-sans text-stone-600">提示：这 18 字对应同一张原拓的 3×6 网格。</div>
                      </div>
                    ) : null}

                    {data?.skipped_chunk?.text ? (
                      <div className="mt-5 rounded-[1.25rem] bg-stone-900/5 border border-stone-200/70 p-4">
                        <div className="text-[11px] font-black tracking-[0.35em] text-stone-500 underline decoration-[#8B0000]/25 underline-offset-4">提示</div>
                        <div className="mt-2 text-[13px] font-sans text-stone-700 leading-relaxed">
                          字库缺失一段（第 {data.skipped_chunk.chunk_index} 段）：
                          <span className="ml-2 font-serif font-semibold text-stone-900">{data.skipped_chunk.text}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="px-5 pb-6 text-[13px] font-sans text-stone-600">输入一个字，或点上面的常见字。</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex-1 min-h-0 rounded-[1.75rem] bg-white/65 border border-stone-200/70 overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b border-stone-200/70 bg-white/35 backdrop-blur-xl">
              <div className="text-[11px] font-black tracking-[0.4em] text-stone-500 uppercase underline decoration-[#8B0000]/25 underline-offset-4">碑阳通读</div>
              <div className="mt-2 text-[14px] font-sans text-stone-700 leading-relaxed">
                横向滑动浏览；点击任意字可定位到切图与原拓。
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-5 py-5">
              <div className="flex gap-4 min-w-max">
                {pages.map((p) => (
                  <div
                    key={p.pageIndex}
                    className="shrink-0 rounded-[1.5rem] bg-white/55 border border-stone-200/70 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="text-[10px] font-mono text-stone-500 tracking-widest">
                        第 {String(p.pageIndex).padStart(3, '0')} 张
                      </div>
                      <div className="text-[9px] font-mono text-stone-400 tracking-widest">{p.files.length}/18</div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((col) => (
                        <div key={col} className="flex flex-col gap-2">
                          {[0, 1, 2, 3, 4, 5].map((row) => {
                            const f = p.grid[row]?.[col] || null;
                            if (!f) {
                              return (
                                <div
                                  key={`${col}_${row}`}
                                  className="w-10 h-10 rounded-xl bg-stone-900/5 border border-stone-200/60"
                                />
                              );
                            }
                            const active = selected?.index === f.index;
                            return (
                              <button
                                key={f.index}
                                onClick={() => {
                                  setSelectedChar(String(f.char || '').trim());
                                  const list = byChar.get(String(f.char || '').trim()) || [];
                                  const nextIdx = list.findIndex((x) => x.index === f.index);
                                  setSelectedOccIdx(nextIdx >= 0 ? nextIdx : 0);
                                  openInPage(f);
                                }}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] font-serif font-black border transition active:scale-[0.99] ${
                                  active
                                    ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/60 shadow-[0_14px_40px_rgba(139,0,0,0.22)]'
                                    : 'bg-white/70 text-stone-900 border-stone-200/70'
                                }`}
                                aria-label={`Go to ${f.char} ${f.index}`}
                              >
                                {f.char}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-[10px] font-sans text-stone-600">从右列开始读（右→左）。</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 pb-5">
              <div className="text-[11px] font-sans text-stone-600">提示：通读模式点字会直接打开原拓定位。</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
