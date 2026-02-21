import React, { useState, useEffect } from 'react';
import theory300Data from '../../data/grade-questions/level-7-8-theory-300.json';
import type { TheoryQuestion } from '../../types/grade';
import { saveTheoryScore } from '../../utils/gradeStorage';

interface CategoryInfo {
  id: string;
  name: string;
  count: number;
  color: string;
}

const AdvancedTheoryQuiz: React.FC = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categoryQuestions, setCategoryQuestions] = useState<TheoryQuestion[]>([]);

  // 分类信息
  const categories: CategoryInfo[] = [
    { id: 'all', name: '全部', count: 0, color: 'from-amber-500 to-orange-500' },
    { id: 'history', name: '书法史', count: 100, color: 'from-red-500 to-rose-500' },
    { id: 'scripts', name: '书体知识', count: 80, color: 'from-blue-500 to-cyan-500' },
    { id: 'masters', name: '名家名作', count: 70, color: 'from-purple-500 to-pink-500' },
    { id: 'tools', name: '文房四宝', count: 30, color: 'from-emerald-500 to-teal-500' },
    { id: 'aesthetics', name: '书法美学', count: 20, color: 'from-yellow-500 to-amber-500' },
  ];

  // 加载题目
  useEffect(() => {
    const allQuestions = theory300Data.questions as unknown as TheoryQuestion[];
    
    if (selectedCategory === 'all') {
      // 随机打乱所有题目
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      setCategoryQuestions(shuffled.slice(0, 50)); // 每次练习 50 题
    } else {
      // 按分类筛选
      const filtered = allQuestions.filter((q) => q.category === selectedCategory);
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      setCategoryQuestions(shuffled);
    }
    
    // 重置状态
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnsweredCount(0);
    setSelectedAnswer('');
    setAnswered(false);
    setIsCorrect(false);
    setShowExplanation(false);
  }, [selectedCategory]);

  const currentQuestion = categoryQuestions[currentQuestionIndex];

  const handleSubmit = () => {
    if (!selectedAnswer || answered || !currentQuestion) return;
    
    const correct = selectedAnswer === currentQuestion.answer;
    setIsCorrect(correct);
    setAnswered(true);
    setShowExplanation(true);
    
    if (correct) {
      setScore((prev) => prev + currentQuestion.score);
    }
    setAnsweredCount((prev) => prev + 1);
    saveTheoryScore(currentQuestion.id, correct ? currentQuestion.score : 0);
  };

  const handleNext = () => {
    setSelectedAnswer('');
    setAnswered(false);
    setIsCorrect(false);
    setShowExplanation(false);
    
    if (currentQuestionIndex < categoryQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // 完成所有题目，重新开始
      setCurrentQuestionIndex(0);
      setScore(0);
      setAnsweredCount(0);
    }
  };

  const handleBackToHome = () => {
    window.location.href = '?mode=grade';
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  // 键盘支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !answered && selectedAnswer) {
        handleSubmit();
      }
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (answered) handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnswer, answered]);

  // 计算进度百分比
  const progressPercentage = categoryQuestions.length > 0 
    ? ((currentQuestionIndex + 1) / categoryQuestions.length) * 100 
    : 0;

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-zinc-400">题目加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header - 精简版 */}
      <div className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-zinc-900/90">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <button onClick={handleBackToHome} className="text-zinc-400 hover:text-white transition-colors p-2 -ml-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">7-8 级</span>
              <span className="text-amber-500 text-sm font-bold">{score}分</span>
            </div>
            
            <div className="w-9" /> {/* 占位保持居中 */}
          </div>
          
          {/* 进度条 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              {currentQuestionIndex + 1}/{categoryQuestions.length}
            </span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Selection */}
      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {cat.name} {cat.id !== 'all' && `(${cat.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 pb-32">
        {/* 题型标签 */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            currentQuestion.type === 'choice' 
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {currentQuestion.type === 'choice' ? '选择题' : '填空题'}
          </span>
          <span className="text-xs text-zinc-500">{currentQuestion.score}分</span>
          <span className="text-xs text-zinc-600 ml-auto">
            {categories.find(c => c.id === currentQuestion.category)?.name || '未知'}
          </span>
        </div>

        {/* 题目 */}
        <div className="mb-6">
          <p className="text-white text-lg sm:text-xl leading-relaxed font-medium">
            {currentQuestion.question}
          </p>
        </div>

        {/* 选择题选项 */}
        {currentQuestion.type === 'choice' && currentQuestion.options && (
          <div className="space-y-2.5 mb-6">
            {currentQuestion.options.map((option, i) => {
              const optionLetter = option.charAt(0);
              const isSelected = selectedAnswer === option;
              const isCorrectAnswer = option === currentQuestion.answer;
              
              let optionClass = 'bg-zinc-800/50 border-zinc-700/50 active:border-amber-500/50';
              if (answered) {
                if (isCorrectAnswer) {
                  optionClass = 'bg-emerald-500/15 border-emerald-500/50';
                } else if (isSelected && !isCorrect) {
                  optionClass = 'bg-red-500/15 border-red-500/50';
                }
              } else if (isSelected) {
                optionClass = 'bg-amber-500/15 border-amber-500/50';
              }

              return (
                <button
                  key={i}
                  onClick={() => !answered && setSelectedAnswer(option)}
                  disabled={answered}
                  className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.98] ${optionClass}`}
                >
                  <span className="text-white text-base">
                    <span className="text-amber-500 font-bold mr-3">{optionLetter}</span>
                    {option.slice(2)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 填空题输入 */}
        {currentQuestion.type === 'fill_blank' && (
          <div className="mb-6">
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              disabled={answered}
              placeholder="请输入答案"
              autoFocus
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-4 
                         text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 
                         text-base transition-all"
            />
          </div>
        )}
      </div>

      {/* Bottom Action Bar - 固定在底部 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          {!answered ? (
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-4 px-4 
                           rounded-xl transition-colors text-base"
              >
                跳过
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedAnswer}
                className="flex-[2] bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-600
                           text-black font-bold py-4 px-4 rounded-xl transition-all text-base
                           active:scale-[0.98] shadow-lg shadow-amber-500/20 disabled:shadow-none"
              >
                提交答案
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 结果反馈 */}
              <div className={`p-4 rounded-xl ${
                isCorrect 
                  ? 'bg-emerald-500/15 border border-emerald-500/30'
                  : 'bg-red-500/15 border border-red-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{isCorrect ? '✓' : '✗'}</span>
                  <div>
                    <div className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isCorrect ? '回答正确' : '回答错误'}
                    </div>
                    {!isCorrect && (
                      <div className="text-sm text-zinc-400 mt-0.5">
                        正确答案：<span className="text-white">{currentQuestion.answer}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 解析 */}
              {showExplanation && (
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-500">💡</span>
                    <span className="text-amber-400 font-medium text-sm">解析</span>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* 下一题按钮 */}
              <button
                onClick={handleNext}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-4 px-4 
                           rounded-xl transition-all text-base active:scale-[0.98] shadow-lg shadow-amber-500/20"
              >
                {currentQuestionIndex < categoryQuestions.length - 1 ? '下一题' : '完成练习'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedTheoryQuiz;
