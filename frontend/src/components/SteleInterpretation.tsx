import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Columns, AlignLeft, Quote, ScrollText } from 'lucide-react';

export interface InterpretationData {
  title: string;
  author: string;
  dynasty: string;
  script_type: string;
  summary: string;
  background: string;
  highlights: string[];
  full_interpretation: string;
  writing_guide: string;
}

interface SteleInterpretationProps {
  interpretation: InterpretationData | null;
  originalText: string;
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'original' | 'interpretation' | 'side-by-side';

type Chapter = { title: string; paragraphs: string[] };

function splitParagraphs(text: string) {
  return String(text || '')
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseChapters(text: string): Chapter[] {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Split by 【...】 markers (kept as headings).
  const parts = lines.split(/(?=【[^】]+】)/g).map((p) => p.trim()).filter(Boolean);

  const out: Chapter[] = [];
  for (const p of parts) {
    const m = p.match(/^【([^】]+)】\s*/);
    const title = m ? m[1].trim() : '释义';
    const body = m ? p.slice(m[0].length) : p;
    const paras = splitParagraphs(body);
    out.push({ title, paragraphs: paras.length ? paras : [body.trim()] });
  }
  // If no headings, fallback to a single chapter.
  if (!out.length) return [{ title: '释义', paragraphs: splitParagraphs(raw) }];
  return out;
}

function TocPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full bg-white/65 border border-stone-200/80 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-stone-700 active:scale-[0.98] transition"
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-1.5 h-5 rounded-full bg-[#8B0000]/80" />
      <h5 className="text-[12px] font-black tracking-[0.24em] text-stone-800 uppercase">{children}</h5>
    </div>
  );
}

function QuoteBlock({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white/60 border border-[#8B0000]/15 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[#8B0000]">
        <Quote size={14} />
        <div className="text-[10px] font-black tracking-[0.22em]">名句</div>
      </div>
      <div className="mt-2 text-[14px] leading-[1.95] text-stone-800 font-serif tracking-[0.08em] text-justify-zh">
        「{text}」
      </div>
    </div>
  );
}

export function SteleInterpretation({ 
  interpretation, 
  originalText, 
  isOpen, 
  onClose 
}: SteleInterpretationProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [expandedSections, setExpandedSections] = useState<{
    background: boolean;
    highlights: boolean;
    fullInterpretation: boolean;
    writingGuide: boolean;
  }>({
    background: true,
    highlights: true,
    fullInterpretation: true,
    writingGuide: false
  });

  const paragraphs = useMemo(() => splitParagraphs(originalText), [originalText]);

  const chapters = useMemo(() => {
    return interpretation?.full_interpretation ? parseChapters(interpretation.full_interpretation) : [];
  }, [interpretation?.full_interpretation]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const refOriginal = useRef<HTMLDivElement | null>(null);
  const refBackground = useRef<HTMLDivElement | null>(null);
  const refHighlights = useRef<HTMLDivElement | null>(null);
  const refFull = useRef<HTMLDivElement | null>(null);
  const refGuide = useRef<HTMLDivElement | null>(null);

  const scrollToRef = (ref: { current: HTMLDivElement | null }) => {
    const root = scrollRef.current;
    const el = ref.current;
    if (!root || !el) return;
    const top = el.offsetTop - 12;
    root.scrollTo({ top, behavior: 'smooth' });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (!isOpen) return;
    // When switching tabs, reset scroll to top.
    const root = scrollRef.current;
    if (!root) return;
    root.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [viewMode, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/85 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="absolute inset-x-0 bottom-0 top-20 bg-[#FDFBF7] rounded-t-3xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部控制栏 */}
        <div className="shrink-0 px-4 py-3 border-b border-stone-200 bg-white/85">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#8B0000]" />
              <h3 className="text-lg font-serif font-bold text-stone-900">
                {interpretation?.title || '碑帖详情'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition"
            >
              <span className="text-xl text-stone-600">×</span>
            </button>
          </div>

          {/* 视图模式切换 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('original')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                viewMode === 'original'
                  ? 'bg-[#8B0000] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <AlignLeft size={14} />
              原文
            </button>
            <button
              onClick={() => setViewMode('interpretation')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                viewMode === 'interpretation'
                  ? 'bg-[#8B0000] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <ScrollText size={14} />
              释义
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                viewMode === 'side-by-side'
                  ? 'bg-[#8B0000] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Columns size={14} />
              对照
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {viewMode === 'side-by-side' && (
            <div className="px-4 py-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <TocPill label="原文" onClick={() => scrollToRef(refOriginal)} />
                <TocPill label="背景" onClick={() => scrollToRef(refBackground)} />
                <TocPill label="名句" onClick={() => scrollToRef(refHighlights)} />
                <TocPill label="释义" onClick={() => scrollToRef(refFull)} />
                <TocPill label="临写" onClick={() => scrollToRef(refGuide)} />
              </div>

              <div className="mt-4 space-y-8">
                <div ref={refOriginal}>
                  <SectionTitle>原文</SectionTitle>
                  <div className="mt-3 space-y-5">
                    {paragraphs.map((paragraph, index) => (
                      <p
                        key={index}
                        className="text-[16px] leading-[2.05] tracking-[0.06em] text-stone-800 font-serif text-justify-zh indent-[2em]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                {interpretation ? (
                  <>
                    <div ref={refBackground}>
                      <SectionTitle>背景</SectionTitle>
                      <div className="mt-3 rounded-[1.25rem] bg-white/60 border border-stone-200/80 p-4">
                        <div className="text-[12px] text-stone-800 leading-[1.9] font-sans">
                          <span className="inline-block rounded-full bg-[#8B0000]/10 border border-[#8B0000]/20 px-2 py-0.5 text-[11px] font-black tracking-[0.14em] text-[#8B0000]">
                            {interpretation.dynasty}
                          </span>
                          <span className="mx-2 text-stone-400">·</span>
                          <span className="font-black">{interpretation.author}</span>
                          <span className="mx-2 text-stone-400">·</span>
                          <span className="font-black">{interpretation.script_type}</span>
                        </div>
                        {interpretation.summary ? (
                          <div className="mt-3 text-[13px] leading-[1.9] text-stone-700 font-sans">
                            {interpretation.summary}
                          </div>
                        ) : null}
                        <div className="mt-4 text-[14px] leading-[1.95] text-stone-800 font-sans">
                          {interpretation.background}
                        </div>
                      </div>
                    </div>

                    <div ref={refHighlights}>
                      <SectionTitle>名句</SectionTitle>
                      <div className="mt-3 space-y-3">
                        {interpretation.highlights.map((h, i) => (
                          <QuoteBlock key={i} text={h} />
                        ))}
                      </div>
                    </div>

                    <div ref={refFull}>
                      <SectionTitle>现代释义</SectionTitle>
                      <div className="mt-3 space-y-6">
                        {chapters.map((c, i) => (
                          <div key={`${c.title}_${i}`} className="rounded-[1.25rem] bg-white/55 border border-stone-200/80 p-4">
                            <div className="text-[11px] font-black tracking-[0.22em] text-[#8B0000]">
                              【{c.title}】
                            </div>
                            <div className="mt-3 space-y-4">
                              {c.paragraphs.map((p, pi) => (
                                <p
                                  key={pi}
                                  className="text-[14px] leading-[1.95] text-stone-800 font-sans text-justify-zh indent-[2em]"
                                >
                                  {p}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div ref={refGuide}>
                      <div className="flex items-center justify-between">
                        <SectionTitle>临写</SectionTitle>
                        <button
                          type="button"
                          onClick={() => toggleSection('writingGuide')}
                          className="rounded-full bg-white/65 border border-stone-200/80 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-stone-700"
                        >
                          {expandedSections.writingGuide ? (
                            <span className="inline-flex items-center gap-1">收起 <ChevronUp size={14} /></span>
                          ) : (
                            <span className="inline-flex items-center gap-1">展开 <ChevronDown size={14} /></span>
                          )}
                        </button>
                      </div>
                      {expandedSections.writingGuide ? (
                        <div className="mt-3 rounded-[1.25rem] bg-[#8B0000]/6 border border-[#8B0000]/15 p-4">
                          <div className="text-[14px] leading-[1.95] text-stone-800 font-sans">{interpretation.writing_guide}</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-[12px] text-stone-500 font-sans">建议先读背景与名句，再回到原帖临摹要点。</div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {viewMode === 'original' && (
            <div className="p-4 h-full overflow-y-auto">
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 pb-3 border-b border-stone-200">
                  <h4 className="text-lg font-bold text-stone-800 font-serif">{interpretation?.title}</h4>
                  <p className="text-sm text-stone-500 mt-1">
                    {interpretation?.dynasty} · {interpretation?.author} · {interpretation?.script_type}
                  </p>
                </div>
                <div className="space-y-6">
                  {paragraphs.map((paragraph, index) => (
                    <p 
                      key={index}
                      className="text-[16px] leading-[2.05] tracking-[0.06em] text-stone-800 font-serif text-justify-zh indent-[2em]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'interpretation' && (
            <div className="p-4 h-full overflow-y-auto">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <TocPill label="背景" onClick={() => scrollToRef(refBackground)} />
                  <TocPill label="名句" onClick={() => scrollToRef(refHighlights)} />
                  <TocPill label="释义" onClick={() => scrollToRef(refFull)} />
                  <TocPill label="临写" onClick={() => scrollToRef(refGuide)} />
                </div>
                {interpretation ? (
                  <>
                    <div ref={refBackground}>
                      <SectionTitle>背景</SectionTitle>
                      <div className="mt-3 rounded-[1.25rem] bg-white/60 border border-stone-200/80 p-4">
                        <div className="text-[12px] text-stone-800 leading-[1.9] font-sans">
                          <span className="inline-block rounded-full bg-[#8B0000]/10 border border-[#8B0000]/20 px-2 py-0.5 text-[11px] font-black tracking-[0.14em] text-[#8B0000]">
                            {interpretation.dynasty}
                          </span>
                          <span className="mx-2 text-stone-400">·</span>
                          <span className="font-black">{interpretation.author}</span>
                          <span className="mx-2 text-stone-400">·</span>
                          <span className="font-black">{interpretation.script_type}</span>
                        </div>
                        {interpretation.summary ? (
                          <div className="mt-3 text-[13px] leading-[1.9] text-stone-700 font-sans">
                            {interpretation.summary}
                          </div>
                        ) : null}
                        <div className="mt-4 text-[14px] leading-[1.95] text-stone-800 font-sans">
                          {interpretation.background}
                        </div>
                      </div>
                    </div>

                    <div ref={refHighlights}>
                      <SectionTitle>名句</SectionTitle>
                      <div className="mt-3 space-y-3">
                        {interpretation.highlights.map((h, i) => (
                          <QuoteBlock key={i} text={h} />
                        ))}
                      </div>
                    </div>

                    <div ref={refFull}>
                      <SectionTitle>现代释义</SectionTitle>
                      <div className="mt-3 space-y-6">
                        {chapters.map((c, i) => (
                          <div key={`${c.title}_${i}`} className="rounded-[1.25rem] bg-white/55 border border-stone-200/80 p-4">
                            <div className="text-[11px] font-black tracking-[0.22em] text-[#8B0000]">
                              【{c.title}】
                            </div>
                            <div className="mt-3 space-y-4">
                              {c.paragraphs.map((p, pi) => (
                                <p
                                  key={pi}
                                  className="text-[14px] leading-[1.95] text-stone-800 font-sans text-justify-zh indent-[2em]"
                                >
                                  {p}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div ref={refGuide}>
                      <div className="flex items-center justify-between">
                        <SectionTitle>临写</SectionTitle>
                        <button
                          type="button"
                          onClick={() => toggleSection('writingGuide')}
                          className="rounded-full bg-white/65 border border-stone-200/80 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-stone-700"
                        >
                          {expandedSections.writingGuide ? (
                            <span className="inline-flex items-center gap-1">收起 <ChevronUp size={14} /></span>
                          ) : (
                            <span className="inline-flex items-center gap-1">展开 <ChevronDown size={14} /></span>
                          )}
                        </button>
                      </div>
                      {expandedSections.writingGuide ? (
                        <div className="mt-3 rounded-[1.25rem] bg-[#8B0000]/6 border border-[#8B0000]/15 p-4">
                          <div className="text-[14px] leading-[1.95] text-stone-800 font-sans">{interpretation.writing_guide}</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-[12px] text-stone-500 font-sans">建议先读背景与名句，再回到原帖临摹要点。</div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
