import { useState, useMemo } from 'react';
import { BookOpen, Eye, EyeOff, Columns, AlignLeft } from 'lucide-react';

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

  // 将原文按段落分割
  const paragraphs = useMemo(() => {
    if (!originalText) return [];
    return originalText.split(/\n\n+/).filter(p => p.trim());
  }, [originalText]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="absolute inset-x-0 bottom-0 top-20 bg-[#FDFBF7] rounded-t-3xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部控制栏 */}
        <div className="shrink-0 px-4 py-3 border-b border-stone-200 bg-white/80">
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
              <Eye size={14} />
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          {viewMode === 'side-by-side' && (
            <div className="flex flex-col lg:flex-row h-full">
              {/* 左侧：原文 */}
              <div className="flex-1 p-4 border-b lg:border-b-0 lg:border-r border-stone-200 bg-white/50">
                <div className="sticky top-0 mb-3 pb-2 border-b border-stone-200 bg-white/80 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-stone-700">原文</h4>
                    <span className="text-xs text-stone-500">
                      {interpretation?.script_type} · {interpretation?.dynasty}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  {paragraphs.map((paragraph, index) => (
                    <p
                      key={index}
                      className="text-base leading-loose text-stone-800 font-serif text-justify-zh"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              {/* 右侧：释义 */}
              <div className="flex-1 p-4 bg-[#FDFBF7]">
                <div className="sticky top-0 mb-3 pb-2 border-b border-stone-200 bg-[#FDFBF7]/80 backdrop-blur">
                  <h4 className="text-sm font-bold text-stone-700">现代释义</h4>
                </div>
                
                {interpretation && (
                  <div className="space-y-4">
                    {/* 基本信息 */}
                    <div className="p-3 bg-white/60 rounded-lg border border-stone-200">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-stone-500">作者：</span>
                          <span className="font-medium text-stone-800">{interpretation.author}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">朝代：</span>
                          <span className="font-medium text-stone-800">{interpretation.dynasty}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-stone-500">书体：</span>
                          <span className="font-medium text-stone-800">{interpretation.script_type}</span>
                        </div>
                      </div>
                    </div>

                    {/* 创作背景 */}
                    <div className="bg-white/60 rounded-lg border border-stone-200 overflow-hidden">
                      <button
                        onClick={() => toggleSection('background')}
                        className="w-full px-3 py-2 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition"
                      >
                        <span className="text-sm font-bold text-stone-700">创作背景</span>
                        {expandedSections.background ? (
                          <EyeOff size={16} className="text-stone-500" />
                        ) : (
                          <Eye size={16} className="text-stone-500" />
                        )}
                      </button>
                      {expandedSections.background && (
                        <div className="p-3 text-sm leading-relaxed text-stone-600">
                          {interpretation.background}
                        </div>
                      )}
                    </div>

                    {/* 名句赏析 */}
                    <div className="bg-white/60 rounded-lg border border-stone-200 overflow-hidden">
                      <button
                        onClick={() => toggleSection('highlights')}
                        className="w-full px-3 py-2 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition"
                      >
                        <span className="text-sm font-bold text-stone-700">名句赏析</span>
                        {expandedSections.highlights ? (
                          <EyeOff size={16} className="text-stone-500" />
                        ) : (
                          <Eye size={16} className="text-stone-500" />
                        )}
                      </button>
                      {expandedSections.highlights && (
                        <div className="p-3 space-y-2">
                          {interpretation.highlights.map((highlight, index) => (
                            <div key={index} className="text-sm leading-relaxed text-stone-600 pl-3 border-l-2 border-[#8B0000]/30">
                              {highlight}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 全文释义 */}
                    <div className="bg-white/60 rounded-lg border border-stone-200 overflow-hidden">
                      <button
                        onClick={() => toggleSection('fullInterpretation')}
                        className="w-full px-3 py-2 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition"
                      >
                        <span className="text-sm font-bold text-stone-700">全文释义</span>
                        {expandedSections.fullInterpretation ? (
                          <EyeOff size={16} className="text-stone-500" />
                        ) : (
                          <Eye size={16} className="text-stone-500" />
                        )}
                      </button>
                      {expandedSections.fullInterpretation && (
                        <div className="p-3 text-sm leading-relaxed text-stone-600 whitespace-pre-line">
                          {interpretation.full_interpretation}
                        </div>
                      )}
                    </div>

                    {/* 临写指导 */}
                    <div className="bg-white/60 rounded-lg border border-stone-200 overflow-hidden">
                      <button
                        onClick={() => toggleSection('writingGuide')}
                        className="w-full px-3 py-2 flex items-center justify-between bg-stone-50 hover:bg-stone-100 transition"
                      >
                        <span className="text-sm font-bold text-stone-700">临写指导</span>
                        {expandedSections.writingGuide ? (
                          <EyeOff size={16} className="text-stone-500" />
                        ) : (
                          <Eye size={16} className="text-stone-500" />
                        )}
                      </button>
                      {expandedSections.writingGuide && (
                        <div className="p-3 text-sm leading-relaxed text-stone-600">
                          {interpretation.writing_guide}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                      className="text-lg leading-loose text-stone-800 font-serif text-center"
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
              <div className="max-w-2xl mx-auto space-y-4">
                {interpretation && (
                  <>
                    {/* 基本信息 */}
                    <div className="p-4 bg-white/60 rounded-lg border border-stone-200">
                      <h4 className="text-lg font-bold text-stone-800 font-serif mb-3">{interpretation.title}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-stone-500">作者：</span>
                          <span className="font-medium text-stone-800">{interpretation.author}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">朝代：</span>
                          <span className="font-medium text-stone-800">{interpretation.dynasty}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">书体：</span>
                          <span className="font-medium text-stone-800">{interpretation.script_type}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">简介：</span>
                          <span className="font-medium text-stone-800">{interpretation.summary}</span>
                        </div>
                      </div>
                    </div>

                    {/* 创作背景 */}
                    <div className="p-4 bg-white/60 rounded-lg border border-stone-200">
                      <h5 className="text-sm font-bold text-stone-700 mb-2 flex items-center gap-2">
                        <BookOpen size={16} />
                        创作背景
                      </h5>
                      <p className="text-sm leading-relaxed text-stone-600">
                        {interpretation.background}
                      </p>
                    </div>

                    {/* 名句赏析 */}
                    <div className="p-4 bg-white/60 rounded-lg border border-stone-200">
                      <h5 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
                        <Eye size={16} />
                        名句赏析
                      </h5>
                      <div className="space-y-2">
                        {interpretation.highlights.map((highlight, index) => (
                          <div key={index} className="text-sm leading-relaxed text-stone-600 pl-3 border-l-2 border-[#8B0000]/30">
                            {highlight}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 全文释义 */}
                    <div className="p-4 bg-white/60 rounded-lg border border-stone-200">
                      <h5 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
                        <AlignLeft size={16} />
                        全文释义
                      </h5>
                      <p className="text-sm leading-relaxed text-stone-600 whitespace-pre-line">
                        {interpretation.full_interpretation}
                      </p>
                    </div>

                    {/* 临写指导 */}
                    <div className="p-4 bg-[#8B0000]/5 rounded-lg border border-[#8B0000]/20">
                      <h5 className="text-sm font-bold text-[#8B0000] mb-2 flex items-center gap-2">
                        <BookOpen size={16} />
                        临写指导
                      </h5>
                      <p className="text-sm leading-relaxed text-stone-600">
                        {interpretation.writing_guide}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
