import React, { useState, useEffect } from 'react';
import level46Data from '../../data/grade-questions/level-4-6.json';
import level78Data from '../../data/grade-questions/level-7-8.json';
import type { ImitationQuestion } from '../../types/grade';
import { markQuestionCompleted, isBookmarked, addBookmark, removeBookmark } from '../../utils/gradeStorage';

const scriptIcons: Record<string, string> = {
  kaishu: '楷书',
  lishu: '隶书',
  zhuan: '篆书',
  xingshu: '行书',
  caoshu: '草书',
  xingcao: '行草',
};

const ImitationQuestionDetail: React.FC = () => {
  const [question, setQuestion] = useState<ImitationQuestion | null>(null);
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
      ...(level46Data.imitation as ImitationQuestion[]),
      ...(level78Data.imitation as ImitationQuestion[]),
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
    // Find next question
    const allQuestions = level === 'advanced' 
      ? level78Data.imitation 
      : level46Data.imitation;
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
                  {question.level}级 · {scriptIcons[question.script]} · 临摹
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
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Reference Image */}
          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span className="text-amber-500">📜</span>
              原帖参考
            </h3>
            {question.referenceImage ? (
              <div className="aspect-[3/4] bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src={question.referenceImage}
                  alt={question.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-[3/4] bg-zinc-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-zinc-500">
                  <div className="text-4xl mb-2">🖼️</div>
                  <p className="text-sm">暂无原帖图片</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Question Details */}
          <div className="space-y-4">
            {/* Content */}
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <span className="text-amber-500">📝</span>
                临摹内容
              </h3>
              <div className="bg-zinc-900/50 rounded-lg p-4">
                <p className="text-zinc-300 whitespace-pre-line font-mono text-lg leading-relaxed">
                  {question.content}
                </p>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                <span>共 {question.charCount} 字</span>
                <span>建议 {question.timeLimit} 分钟</span>
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
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

            {/* Tips */}
            <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
              <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                <span>💡</span>
                练习提示
              </h3>
              <ul className="text-zinc-300 text-sm space-y-1">
                <li>• 先观察原帖的整体章法和字距行距</li>
                <li>• 注意每个字的结构特点和笔画特征</li>
                <li>• 保持书写速度均匀，不要过快或过慢</li>
                <li>• 写完后对比原帖，找出差距</li>
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

export default ImitationQuestionDetail;
