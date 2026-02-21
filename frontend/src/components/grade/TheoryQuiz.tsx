import React, { useState, useEffect } from 'react';
import theoryBank from '../../data/grade-questions/theory-bank.json';
import type { TheoryQuestion, TheoryCategory } from '../../types/grade';
import { saveTheoryScore } from '../../utils/gradeStorage';

interface CategoryCardProps {
  category: TheoryCategory;
  onSelect: (categoryId: string) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(category.id)}
      className="bg-zinc-800/30 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50 
                 hover:border-amber-500/30 hover:bg-zinc-800/50 transition-all text-left w-full"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-bold text-lg">{category.name}</h3>
        <span className="text-amber-500 text-sm font-medium">{category.questions.length}题</span>
      </div>
      <p className="text-zinc-400 text-sm">点击开始练习</p>
    </button>
  );
};

interface QuizCardProps {
  question: TheoryQuestion;
  onAnswer: (questionId: string, isCorrect: boolean, score: number) => void;
  onNext: () => void;
  showAnswer: boolean;
}

const QuizCard: React.FC<QuizCardProps> = ({ question, onAnswer, onNext, showAnswer }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const isChoice = question.type === 'choice';
  const isFillBlank = question.type === 'fill_blank';

  const handleChoiceSelect = (option: string) => {
    if (answered) return;
    setSelectedAnswer(option);
  };

  const handleSubmitChoice = () => {
    if (!selectedAnswer || answered) return;
    
    const correct = selectedAnswer === question.answer;
    setIsCorrect(correct);
    setAnswered(true);
    onAnswer(question.id, correct, correct ? question.score : 0);
    saveTheoryScore(question.id, correct ? question.score : 0);
  };

  const handleFillBlankSubmit = () => {
    if (!selectedAnswer || answered) return;
    
    const correct = selectedAnswer.trim() === question.answer;
    setIsCorrect(correct);
    setAnswered(true);
    onAnswer(question.id, correct, correct ? question.score : 0);
    saveTheoryScore(question.id, correct ? question.score : 0);
  };

  const handleNext = () => {
    setSelectedAnswer('');
    setAnswered(false);
    setIsCorrect(false);
    onNext();
  };

  return (
    <div className="bg-zinc-800/30 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-zinc-700/50">
      {/* Question Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${
            question.type === 'choice' 
              ? 'bg-blue-500/20 text-blue-500'
              : 'bg-emerald-500/20 text-emerald-500'
          }`}>
            {question.type === 'choice' ? '选择题' : '填空题'}
          </span>
          <span className="text-zinc-500 text-xs">{question.score}分</span>
        </div>
      </div>

      {/* Question */}
      <div className="mb-4 sm:mb-6">
        <p className="text-white text-base sm:text-lg leading-relaxed">{question.question}</p>
      </div>

      {/* Options (for choice questions) */}
      {isChoice && question.options && (
        <div className="space-y-2 mb-4 sm:mb-6">
          {question.options.map((option, i) => {
            const optionLetter = option.charAt(0);
            const isSelected = selectedAnswer === option;
            const isCorrectAnswer = option === question.answer;
            
            let optionClass = 'bg-zinc-900/50 border-zinc-700/50 hover:border-amber-500/30';
            if (answered) {
              if (isCorrectAnswer) {
                optionClass = 'bg-emerald-500/20 border-emerald-500/50';
              } else if (isSelected && !isCorrect) {
                optionClass = 'bg-red-500/20 border-red-500/50';
              }
            } else if (isSelected) {
              optionClass = 'bg-amber-500/20 border-amber-500/50';
            }

            return (
              <button
                key={i}
                onClick={() => handleChoiceSelect(option)}
                disabled={answered}
                className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-all text-sm sm:text-base ${optionClass}`}
              >
                <span className="text-white">
                  <span className="text-amber-500 font-bold mr-2">{optionLetter}</span>
                  {option.slice(2)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input (for fill blank questions) */}
      {isFillBlank && (
        <div className="mb-4 sm:mb-6">
          <input
            type="text"
            value={selectedAnswer}
            onChange={(e) => setSelectedAnswer(e.target.value)}
            disabled={answered}
            placeholder="请输入答案"
            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 
                       text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 text-base"
          />
        </div>
      )}

      {/* Submit Button */}
      {!answered && (
        <button
          onClick={isChoice ? handleSubmitChoice : handleFillBlankSubmit}
          disabled={!selectedAnswer}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500
                     text-black font-medium py-3 px-4 rounded-lg transition-colors text-base"
        >
          提交答案
        </button>
      )}

      {/* Answer Feedback */}
      {answered && (
        <div className="space-y-3 sm:space-y-4">
          <div className={`p-3 sm:p-4 rounded-lg ${
            isCorrect 
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{isCorrect ? '✓' : '✗'}</span>
              <span className={`font-bold text-sm sm:text-base ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
                {isCorrect ? '回答正确' : '回答错误'}
              </span>
            </div>
            {!isCorrect && (
              <div className="text-sm">
                <span className="text-zinc-400">正确答案：</span>
                <span className="text-white">{question.answer}</span>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="bg-zinc-900/50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-500">💡</span>
              <span className="text-amber-500 font-medium text-sm">解析</span>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">{question.explanation}</p>
          </div>

          <button
            onClick={handleNext}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-3 px-4 
                       rounded-lg transition-colors text-base"
          >
            下一题
          </button>
        </div>
      )}
    </div>
  );
};

const TheoryQuiz: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  const categories = theoryBank.categories.map((c) => ({
    ...c,
    questions: c.questions.map((q) => ({ ...q, level: 4 })),
  })) as unknown as TheoryCategory[];
  
  const mixedQuestions = theoryBank.mixed.map((q) => ({
    ...q,
    level: 4,
  })) as unknown as TheoryQuestion[];

  const currentCategory = categories.find((c) => c.id === selectedCategory);
  const questions = selectedCategory 
    ? currentCategory?.questions || []
    : mixedQuestions;

  const currentQuestion = questions[currentQuestionIndex];

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnsweredCount(0);
  };

  const handleAnswer = (questionId: string, isCorrect: boolean, points: number) => {
    if (isCorrect) {
      setScore((prev) => prev + points);
    }
    setAnsweredCount((prev) => prev + 1);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Completed all questions
      setSelectedCategory(null);
      setCurrentQuestionIndex(0);
      setScore(0);
      setAnsweredCount(0);
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnsweredCount(0);
  };

  const handleBackToHome = () => {
    window.location.href = '?mode=grade';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header */}
      <div className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-zinc-900/80">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={handleBackToHome} className="text-zinc-400 hover:text-white transition-colors p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">理论答题</h1>
                <p className="text-zinc-400 text-xs hidden sm:block">书法史 · 书体知识 · 名家名作 · 文房四宝</p>
              </div>
            </div>
            {selectedCategory && (
              <button
                onClick={handleBackToCategories}
                className="text-zinc-400 hover:text-white text-xs sm:text-sm transition-colors px-3 py-1.5 bg-zinc-800 rounded-lg"
              >
                返回分类
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        {!selectedCategory ? (
          <>
            {/* Category Selection */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-white font-bold mb-4 text-base sm:text-lg">选择分类</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onSelect={handleCategorySelect}
                  />
                ))}
              </div>
            </div>

            {/* Mixed Practice */}
            <div>
              <h2 className="text-white font-bold mb-4 text-base sm:text-lg">综合练习</h2>
              <button
                onClick={() => handleCategorySelect('mixed')}
                className="w-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 
                           backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-purple-500/30 
                           hover:border-purple-500/50 transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold text-base sm:text-lg">🔀 混合练习</h3>
                    <p className="text-zinc-400 text-xs sm:text-sm">随机题目，全面复习</p>
                  </div>
                  <span className="text-purple-500 text-xs sm:text-sm font-medium">
                    {mixedQuestions.length}题
                  </span>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-xs sm:text-sm">
                  进度：{currentQuestionIndex + 1} / {questions.length}
                </span>
                <span className="text-amber-500 text-sm sm:text-base font-bold">
                  得分：{score}分
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Quiz Card */}
            {currentQuestion && (
              <QuizCard
                key={currentQuestion.id}
                question={currentQuestion}
                onAnswer={handleAnswer}
                onNext={handleNext}
                showAnswer={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TheoryQuiz;
