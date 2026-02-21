/**
 * 墨梯 InkLadder - 本地存储工具
 * 用于保存用户学习进度、答题记录、考试历史等
 */

export interface LearningProgress {
  lastVisit: string;
  completedQuestions: string[];           // 已学习题目 ID
  theoryScores: Record<string, number>;   // 理论题得分记录 { questionId: score }
  examHistory: ExamRecord[];
  bookmarks: string[];                    // 收藏题目 ID
  studyStreak: number;                    // 学习连续天数
}

export interface ExamRecord {
  id: string;
  level: 4 | 5 | 6 | 7 | 8;
  type: 'mock_exam';
  date: string;
  score: number;
  totalScore: number;
  duration: number;                       // 用时（秒）
  answers: ExamAnswer[];
}

export interface ExamAnswer {
  questionId: string;
  type: 'imitation' | 'creation' | 'theory';
  userAnswer?: string;                    // 理论题用户答案
  isCorrect?: boolean;
  score: number;
  maxScore: number;
}

export interface Bookmark {
  questionId: string;
  addedAt: string;
  notes?: string;
}

const STORAGE_KEY = 'inkLadder_progress_v1';

/**
 * 获取初始状态
 */
const getInitialState = (): LearningProgress => ({
  lastVisit: new Date().toISOString(),
  completedQuestions: [],
  theoryScores: {},
  examHistory: [],
  bookmarks: [],
  studyStreak: 0,
});

/**
 * 计算学习连续天数
 */
const calculateStudyStreak = (lastVisit: string, currentStreak: number): number => {
  const last = new Date(lastVisit);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return currentStreak; // 今天已经学习过
  } else if (diffDays === 1) {
    return currentStreak + 1; // 连续学习
  } else {
    return 1; // 中断，重新开始
  }
};

/**
 * 保存学习进度
 */
export const saveProgress = (progress: Partial<LearningProgress>): void => {
  try {
    const current = loadProgress();
    const updated: LearningProgress = {
      ...current,
      ...progress,
      lastVisit: new Date().toISOString(),
    };
    
    // 更新学习连续天数
    if (progress.lastVisit || progress.studyStreak) {
      updated.studyStreak = calculateStudyStreak(
        progress.lastVisit || current.lastVisit,
        progress.studyStreak || current.studyStreak
      );
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
};

/**
 * 加载学习进度
 */
export const loadProgress = (): LearningProgress => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load progress:', error);
  }
  return getInitialState();
};

/**
 * 标记题目为已完成
 */
export const markQuestionCompleted = (questionId: string): void => {
  const progress = loadProgress();
  if (!progress.completedQuestions.includes(questionId)) {
    saveProgress({
      completedQuestions: [...progress.completedQuestions, questionId],
    });
  }
};

/**
 * 保存理论题答题记录
 */
export const saveTheoryScore = (questionId: string, score: number): void => {
  const progress = loadProgress();
  saveProgress({
    theoryScores: {
      ...progress.theoryScores,
      [questionId]: score,
    },
  });
};

/**
 * 添加考试记录
 */
export const addExamRecord = (record: ExamRecord): void => {
  const progress = loadProgress();
  saveProgress({
    examHistory: [record, ...progress.examHistory].slice(0, 20), // 保留最近 20 条
  });
};

/**
 * 添加收藏
 */
export const addBookmark = (questionId: string, notes?: string): void => {
  const progress = loadProgress();
  if (!progress.bookmarks.includes(questionId)) {
    saveProgress({
      bookmarks: [...progress.bookmarks, questionId],
    });
  }
};

/**
 * 移除收藏
 */
export const removeBookmark = (questionId: string): void => {
  const progress = loadProgress();
  saveProgress({
    bookmarks: progress.bookmarks.filter(id => id !== questionId),
  });
};

/**
 * 检查是否已收藏
 */
export const isBookmarked = (questionId: string): boolean => {
  const progress = loadProgress();
  return progress.bookmarks.includes(questionId);
};

/**
 * 获取学习统计
 */
export const getStudyStats = () => {
  const progress = loadProgress();
  const theoryScores = Object.values(progress.theoryScores);
  
  return {
    totalQuestionsCompleted: progress.completedQuestions.length,
    totalTheoryQuestions: theoryScores.length,
    averageTheoryScore: theoryScores.length > 0 
      ? theoryScores.reduce((a, b) => a + b, 0) / theoryScores.length 
      : 0,
    totalExams: progress.examHistory.length,
    averageExamScore: progress.examHistory.length > 0
      ? progress.examHistory.reduce((a, r) => a + r.score, 0) / progress.examHistory.length
      : 0,
    studyStreak: progress.studyStreak,
    bookmarksCount: progress.bookmarks.length,
  };
};

/**
 * 清除所有数据
 */
export const clearProgress = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
