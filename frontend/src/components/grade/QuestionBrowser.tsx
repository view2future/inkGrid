import React, { useState, useEffect } from 'react';
import level46Data from '../../data/grade-questions/level-4-6.json';
import level78Data from '../../data/grade-questions/level-7-8.json';
import type { GradeData, ImitationQuestion, CreationQuestion } from '../../types/grade';
import { markQuestionCompleted, isBookmarked, addBookmark, removeBookmark } from '../../utils/gradeStorage';

interface QuestionCardProps {
  question: ImitationQuestion | CreationQuestion;
  type: 'imitation' | 'creation';
  onComplete: (id: string) => void;
}

const scriptIcons: Record<string, string> = {
  kaishu: '楷',
  lishu: '隶',
  zhuan: '篆',
  xingshu: '行',
  caoshu: '草',
  xingcao: '行草',
};

const QuestionCard: React.FC<QuestionCardProps> = ({ question, type, onComplete }) => {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(question.id));
  }, [question.id]);

  const handleBookmark = () => {
    if (bookmarked) {
      removeBookmark(question.id);
    } else {
      addBookmark(question.id);
    }
    setBookmarked(!bookmarked);
  };

  const handleComplete = () => {
    onComplete(question.id);
  };

  const handleViewDetail = () => {
    const params = new URLSearchParams(window.location.search);
    const level = params.get('mode')?.includes('advanced') ? 'advanced' : 'intermediate';
    window.location.href = `?mode=grade-question-${type}-${question.id}&level=${level}`;
  };

  return (
    <div className="bg-zinc-800/30 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50 hover:border-amber-500/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/20 text-amber-500 text-xs font-bold px-2 py-1 rounded">
            {question.level}级
          </span>
          {'script' in question && (
            <span className="bg-zinc-700 text-zinc-300 text-xs font-bold px-2 py-1 rounded">
              {scriptIcons[question.script] || question.script}
            </span>
          )}
          {'type' in question && (
            <span className="bg-zinc-700 text-zinc-300 text-xs font-bold px-2 py-1 rounded">
              {question.typeName}
            </span>
          )}
        </div>
        <button
          onClick={handleBookmark}
          className={`text-lg transition-colors ${
            bookmarked ? 'text-amber-500' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          {bookmarked ? '★' : '☆'}
        </button>
      </div>

      <h3 className="text-white font-bold mb-2">{question.title}</h3>

      <div className="bg-zinc-900/50 rounded-lg p-3 mb-3">
        <p className="text-zinc-300 text-sm whitespace-pre-line font-mono">
          {question.content}
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
        <span>{question.charCount}字</span>
        <span>{question.timeLimit}分钟</span>
        <span>{question.score}分</span>
      </div>

      <div className="mb-4">
        <div className="text-xs text-zinc-500 mb-1">要求：</div>
        <div className="flex flex-wrap gap-1">
          {question.requirements.map((req, i) => (
            <span key={i} className="text-xs bg-zinc-700/50 text-zinc-400 px-2 py-0.5 rounded">
              {req}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleViewDetail}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          查看详情
        </button>
        <button
          onClick={handleComplete}
          className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          已学习
        </button>
      </div>
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
      active
        ? 'bg-amber-500 text-black'
        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
    }`}
  >
    {children}
    {count !== undefined && (
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        active ? 'bg-black/20' : 'bg-zinc-700'
      }`}>
        {count}
      </span>
    )}
  </button>
);

const QuestionBrowser: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'imitation' | 'creation'>('imitation');
  const [scriptFilter, setScriptFilter] = useState<string>('all');
  const [level, setLevel] = useState<'intermediate' | 'advanced'>('intermediate');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || '';
    if (mode.includes('advanced')) {
      setLevel('advanced');
    }
  }, []);

  const gradeData = (level === 'advanced' ? level78Data : level46Data) as GradeData;

  const imitationQuestions = gradeData.imitation.filter((q) =>
    scriptFilter === 'all' ? true : q.script === scriptFilter
  );

  const creationQuestions = gradeData.creation;

  const scripts = Array.from(new Set(gradeData.imitation.map((q) => q.script)));

  const handleComplete = (id: string) => {
    markQuestionCompleted(id);
  };

  const handleBack = () => {
    window.location.href = `?mode=grade-${level}`;
  };

  const handleExam = () => {
    window.location.href = `?mode=grade-exam-${level}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header */}
      <div className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-zinc-900/80">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className="text-zinc-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {gradeData.levelName}题库
                </h1>
                <p className="text-zinc-400 text-xs">{gradeData.description}</p>
              </div>
            </div>
            <button
              onClick={handleExam}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              模拟考试
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <TabButton
            active={activeTab === 'imitation'}
            onClick={() => setActiveTab('imitation')}
            count={gradeData.imitation.length}
          >
            临摹训练
          </TabButton>
          <TabButton
            active={activeTab === 'creation'}
            onClick={() => setActiveTab('creation')}
            count={gradeData.creation.length}
          >
            创作训练
          </TabButton>
        </div>

        {/* Script Filter (only for imitation) */}
        {activeTab === 'imitation' && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setScriptFilter('all')}
              className={`text-sm px-3 py-1.5 rounded transition-colors ${
                scriptFilter === 'all'
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              全部
            </button>
            {scripts.map((script) => (
              <button
                key={script}
                onClick={() => setScriptFilter(script)}
                className={`text-sm px-3 py-1.5 rounded transition-colors ${
                  scriptFilter === script
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {scriptIcons[script]}
              </button>
            ))}
          </div>
        )}

        {/* Question Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'imitation'
            ? imitationQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  type="imitation"
                  onComplete={handleComplete}
                />
              ))
            : creationQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  type="creation"
                  onComplete={handleComplete}
                />
              ))}
        </div>

        {/* Empty State */}
        {((activeTab === 'imitation' && imitationQuestions.length === 0) ||
          (activeTab === 'creation' && creationQuestions.length === 0)) && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-zinc-400">暂无题目</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBrowser;
