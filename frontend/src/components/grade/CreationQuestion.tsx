import React, { useState, useEffect } from 'react';
import level46Data from '../../data/grade-questions/level-4-6.json';
import level78Data from '../../data/grade-questions/level-7-8.json';
import type { CreationQuestion } from '../../types/grade';
import { markQuestionCompleted, isBookmarked, addBookmark, removeBookmark } from '../../utils/gradeStorage';

const formatIcons: Record<string, string> = {
  '条幅': '📜',
  '横幅': '🖼️',
  '中堂': '🏮',
  '斗方': '□',
  '对联': '🀃',
};

const CreationQuestionDetail: React.FC = () => {
  const [question, setQuestion] = useState<CreationQuestion | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [level, setLevel] = useState('intermediate');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const questionId = params.get('questionId');
    const levelParam = params.get('level') || 'intermediate';
    setLevel(levelParam);

    // Search in both level data
    const allQuestions = [
      ...(level46Data.creation as CreationQuestion[]),
      ...(level78Data.creation as CreationQuestion[]),
    ];
    const found = allQuestions.find((q) => q.id === questionId);
    setQuestion(found || null);

    if (found) {
      setBookmarked(isBookmarked(found.id));
    }
  }, []);

  const handleBookmark = () => {
    if (!question) return;
    if (bookmarked) {
      removeBookmark(question.id);
    } else {
      addBookmark(question.id);
    }
    setBookmarked(!bookmarked);
  };

  const handleComplete = () => {
    if (!question) return;
    markQuestionCompleted(question.id);
    setMarkedComplete(true);
  };

  const handleBack = () => {
    window.location.href = `?mode=grade-${level}`;
  };

  const handleNext = () => {
    const allQuestions = level === 'advanced' 
      ? level78Data.creation 
      : level46Data.creation;
    const currentIndex = allQuestions.findIndex((q) => q.id === question?.id);
    const nextQuestion = allQuestions[(currentIndex + 1) % allQuestions.length];
    
    const params = new URLSearchParams(window.location.search);
    params.set('questionId', nextQuestion.id);
    window.location.search = params.toString();
  };

  if (!question) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-zinc-400">题目未找到</p>
          <button
            onClick={handleBack}
            className="mt-4 inline-block bg-amber-500 hover:bg-amber-600 text-black font-medium py-2 px-4 rounded-lg transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header */}
      <div className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-zinc-900/80">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="text-zinc-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">{question.title}</h1>
                <p className="text-zinc-400 text-xs">
                  {question.level}级 · {question.typeName} · 创作
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBookmark}
                className={`text-xl transition-colors ${
                  bookmarked ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {bookmarked ? '★' : '☆'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Content Display */}
          <div className="lg:col-span-2 space-y-4">
            {/* Creation Content */}
            <div className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">✍️</span>
                创作内容
              </h3>
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-lg p-6">
                <p className="text-zinc-100 whitespace-pre-line font-mono text-xl leading-loose text-center">
                  {question.content}
                </p>
                {question.author && (
                  <p className="text-zinc-400 text-sm text-right mt-4">
                    — {question.author}
                  </p>
                )}
                {question.source && (
                  <p className="text-zinc-400 text-sm text-right mt-1">
                    出自《{question.source}》
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                <span>共 {question.charCount} 字</span>
                <span>建议 {question.timeLimit} 分钟</span>
              </div>
            </div>

            {/* Format Options */}
            <div className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">📐</span>
                推荐格式
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {question.format.map((fmt, i) => (
                  <div
                    key={i}
                    className="bg-zinc-900/50 rounded-lg p-3 text-center border border-zinc-700/50"
                  >
                    <div className="text-2xl mb-1">{formatIcons[fmt] || '📄'}</div>
                    <div className="text-zinc-300 text-sm">{fmt}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">✓</span>
                评分要求
              </h3>
              <div className="space-y-2">
                {question.requirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span className="text-zinc-300 text-sm">{req}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Info & Tips */}
          <div className="space-y-4">
            {/* Score Info */}
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">📊</span>
                考试信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-zinc-500 text-xs mb-1">本题分值</div>
                  <div className="text-2xl font-bold text-amber-500">{question.score}分</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">建议时间</div>
                  <div className="text-2xl font-bold text-emerald-500">{question.timeLimit}分钟</div>
                </div>
              </div>
            </div>

            {/* Layout Tips */}
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">📐</span>
                章法建议
              </h3>
              <ul className="text-zinc-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>正文居中或偏上，留出落款空间</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>字距均匀，行距清晰</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>四周留白适当，不要过满</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>落款字体略小于正文</span>
                </li>
              </ul>
            </div>

            {/* Signature Tips */}
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">🖋️</span>
                落款规范
              </h3>
              <ul className="text-zinc-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>时间：可用干支纪年（如丙午年）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>名号：姓名或字号</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>地点：可选（如书于 XX 斋）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>钤印：1-3 方，位置得当</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleComplete}
                disabled={markedComplete}
                className={`flex-1 font-medium py-3 px-4 rounded-lg transition-all ${
                  markedComplete
                    ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50'
                    : 'bg-amber-500 hover:bg-amber-600 text-black'
                }`}
              >
                {markedComplete ? '✓ 已标记为已学习' : '标记为已学习'}
              </button>
              <button
                onClick={handleNext}
                className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                下一题
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreationQuestionDetail;
