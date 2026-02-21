import React, { useState, useEffect } from 'react';
import { loadProgress, getStudyStats } from '../../utils/gradeStorage';

interface GradeLevel {
  id: string;
  name: string;
  levels: string;
  description: string;
  icon: string;
  color: string;
  questionCount: number;
}

const gradeLevels: GradeLevel[] = [
  {
    id: 'intermediate',
    name: '中级',
    levels: '4-6 级',
    description: '熟练掌握一种主要书体，能够背临经典碑帖，初步掌握章法布局',
    icon: '🎯',
    color: 'from-amber-500 to-orange-600',
    questionCount: 21,
  },
  {
    id: 'advanced',
    name: '高级',
    levels: '7-8 级',
    description: '精通一种书体，兼善其他书体，临摹形神兼备，创作能力较强',
    icon: '🏆',
    color: 'from-red-600 to-rose-700',
    questionCount: 29,
  },
];

const QuickStats: React.FC = () => {
  const stats = getStudyStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
        <div className="text-2xl font-bold text-amber-500">{stats.totalQuestionsCompleted}</div>
        <div className="text-xs text-zinc-400 mt-1">已学题目</div>
      </div>
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
        <div className="text-2xl font-bold text-emerald-500">{stats.totalTheoryQuestions}</div>
        <div className="text-xs text-zinc-400 mt-1">理论答题</div>
      </div>
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
        <div className="text-2xl font-bold text-blue-500">{stats.totalExams}</div>
        <div className="text-xs text-zinc-400 mt-1">模拟考试</div>
      </div>
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
        <div className="text-2xl font-bold text-purple-500">{stats.studyStreak}</div>
        <div className="text-xs text-zinc-400 mt-1">连续学习天数</div>
      </div>
    </div>
  );
};

const GradeCard: React.FC<{ grade: GradeLevel }> = ({ grade }) => {
  const handleClick = () => {
    if (grade.id === 'advanced') {
      // 高级阶段直接跳转到理论答题
      window.location.href = '?mode=grade-theory-advanced';
    } else {
      window.location.href = `?mode=grade-${grade.id}`;
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br ${grade.color} p-6 
                 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/20 cursor-pointer"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-12 -translate-x-12" />
      
      <div className="relative z-10">
        <div className="text-4xl mb-3">{grade.icon}</div>
        <h3 className="text-2xl font-bold text-white mb-1">{grade.name}</h3>
        <div className="text-white/80 text-sm mb-4">{grade.levels}</div>
        <p className="text-white/70 text-sm leading-relaxed mb-4">{grade.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-xs">{grade.questionCount} 道题目</span>
          <span className="text-white text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            开始学习
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
};

const FeatureSection: React.FC = () => {
  const features = [
    {
      icon: '📖',
      title: '临摹训练',
      description: '经典碑帖高精展示，对比学习',
      mode: 'grade-imitation',
    },
    {
      icon: '✍️',
      title: '创作训练',
      description: '诗词名句，章法布局练习',
      mode: 'grade-creation',
    },
    {
      icon: '📝',
      title: '理论答题',
      description: '书法史、书体知识、名家名作',
      mode: 'grade-theory',
    },
    {
      icon: '🎓',
      title: '模拟考试',
      description: '完整试卷，计时模拟',
      mode: 'grade-exam',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {features.map((feature) => (
        <a
          key={feature.title}
          href={`?mode=${feature.mode}`}
          className="bg-zinc-800/30 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50
                     transition-all duration-200 hover:bg-zinc-800/50 hover:border-amber-500/30"
        >
          <div className="text-3xl mb-2">{feature.icon}</div>
          <h4 className="text-white font-medium mb-1">{feature.title}</h4>
          <p className="text-zinc-400 text-xs">{feature.description}</p>
        </a>
      ))}
    </div>
  );
};

const GradeHome: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleBackToHome = () => {
    window.location.href = '/';
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header */}
      <div className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-zinc-900/80">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">墨梯 InkLadder</h1>
              <p className="text-zinc-400 text-sm">书法考级实训平台</p>
            </div>
            <button
              onClick={handleBackToHome}
              className="text-zinc-400 hover:text-white transition-colors text-sm"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <QuickStats />

        {/* Grade Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">选择等级</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {gradeLevels.map((grade) => (
              <GradeCard key={grade.id} grade={grade} />
            ))}
          </div>
        </div>

        {/* Quick Features */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">快速入口</h2>
          <FeatureSection />
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/50">
          <h3 className="text-lg font-bold text-white mb-3">📋 考试说明</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-zinc-300">
            <div>
              <h4 className="font-medium text-amber-500 mb-2">中级 (4-6 级)</h4>
              <ul className="space-y-1 text-zinc-400">
                <li>• 临摹：20-30 字经典碑帖选段</li>
                <li>• 创作：绝句、经典名句 (20-28 字)</li>
                <li>• 理论：基础书体知识</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-red-500 mb-2">高级 (7-8 级)</h4>
              <ul className="space-y-1 text-zinc-400">
                <li>• 临摹：40-80 字进阶碑帖 (含篆书/行草)</li>
                <li>• 创作：律诗、宋词、古文节选 (40-80 字)</li>
                <li>• 理论：书法史、美学、鉴赏</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Advanced Theory Quiz Entry */}
        <div className="mt-6">
          <a
            href="?mode=grade-theory-advanced"
            className="block bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-sm rounded-xl p-5 border border-red-500/30 hover:border-red-500/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <h3 className="text-white font-bold text-lg">7-8 级理论专项练习</h3>
                  <p className="text-zinc-400 text-xs mt-0.5">精选 12 道高级理论题，强化训练</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default GradeHome;
