import React, { useState, useEffect } from 'react';
import level46Data from '../../data/grade-questions/level-4-6.json';
import level78Data from '../../data/grade-questions/level-7-8.json';
import theoryBank from '../../data/grade-questions/theory-bank.json';
import type { ImitationQuestion, CreationQuestion, TheoryQuestion } from '../../types/grade';
import type { ExamRecord, ExamAnswer } from '../../utils/gradeStorage';
import { addExamRecord } from '../../utils/gradeStorage';

interface ExamQuestions {
  imitation: ImitationQuestion[];
  creation: CreationQuestion[];
  theory: TheoryQuestion[];
}

const ExamPaper: React.FC = () => {
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [currentSection, setCurrentSection] = useState<'imitation' | 'creation' | 'theory'>('imitation');
  const [level, setLevel] = useState<'intermediate' | 'advanced'>('intermediate');

  const isAdvanced = level === 'advanced';
  const gradeData = isAdvanced ? level78Data : level46Data;
  const totalTime = isAdvanced ? 150 : 120; // minutes

  // Select exam questions (random or fixed)
  const [examQuestions, setExamQuestions] = useState<ExamQuestions>({
    imitation: [],
    creation: [],
    theory: [],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const levelParam = params.get('level') || 'intermediate';
    setLevel(levelParam as 'intermediate' | 'advanced');

    // Select random questions for the exam
    const data = levelParam === 'advanced' ? level78Data : level46Data;
    
    const imitationQuestions = data.imitation
      .sort(() => Math.random() - 0.5)
      .slice(0, levelParam === 'advanced' ? 2 : 1);
    
    const creationQuestions = data.creation
      .sort(() => Math.random() - 0.5)
      .slice(0, levelParam === 'advanced' ? 2 : 1);
    
    const theoryQuestions = theoryBank.mixed
      .sort(() => Math.random() - 0.5)
      .slice(0, levelParam === 'advanced' ? 10 : 6)
      .map((q) => ({ ...q, level: levelParam === 'advanced' ? 8 : 4 }));

    setExamQuestions({
      imitation: imitationQuestions as ImitationQuestion[],
      creation: creationQuestions as CreationQuestion[],
      theory: theoryQuestions as unknown as TheoryQuestion[],
    });
  }, []);

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (examStarted && !examFinished && currentTime < totalTime * 60) {
      interval = setInterval(() => {
        setCurrentTime((prev) => prev + 1);
      }, 1000);
    } else if (currentTime >= totalTime * 60) {
      handleSubmit();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [examStarted, examFinished, currentTime, totalTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    const remaining = totalTime * 60 - currentTime;
    return formatTime(remaining);
  };

  const isTimeRunningLow = (totalTime * 60 - currentTime) < 600; // Less than 10 minutes

  const handleStartExam = () => {
    setExamStarted(true);
    setCurrentTime(0);
    setAnswers([]);
  };

  const handleSubmit = () => {
    setExamFinished(true);
    
    // Calculate score
    const theoryAnswers = answers.filter((a) => a.type === 'theory');
    const theoryScore = theoryAnswers.reduce((sum, a) => sum + a.score, 0);
    
    // Imitation and creation are self-assessed (not scored automatically)
    const totalScore = theoryScore;
    const maxScore = examQuestions.theory.reduce((sum, q) => sum + q.score, 0);

    // Save exam record
    const record: ExamRecord = {
      id: `exam-${Date.now()}`,
      level: isAdvanced ? 8 : 4,
      type: 'mock_exam',
      date: new Date().toISOString(),
      score: totalScore,
      totalScore: maxScore,
      duration: currentTime,
      answers,
    };

    addExamRecord(record);
  };

  const handleTheoryAnswer = (questionId: string, isCorrect: boolean, score: number, maxScore: number) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      const newAnswer: ExamAnswer = {
        questionId,
        type: 'theory',
        isCorrect,
        score,
        maxScore,
      };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });
  };

  const handleSelfAssess = (questionId: string, type: 'imitation' | 'creation', score: number, maxScore: number) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      const newAnswer: ExamAnswer = {
        questionId,
        type,
        score,
        maxScore,
      };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });
  };

  const handleBackToHome = () => {
    window.location.href = '?mode=grade';
  };

  const handleRetry = () => {
    window.location.reload();
  };

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎓</div>
            <h1 className="text-3xl font-bold text-white mb-2">模拟考试</h1>
            <p className="text-zinc-400">
              {isAdvanced ? '8 级' : '4-6 级'}书法艺术考级模拟试卷
            </p>
          </div>

          <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/50 mb-6">
            <h2 className="text-white font-bold mb-4">考试说明</h2>
            <div className="space-y-3 text-zinc-300 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-amber-500">📋</span>
                <span>考试时间：<span className="text-white font-bold">{totalTime}分钟</span></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-500">📝</span>
                <span>临摹题：<span className="text-white">{examQuestions.imitation.length}道</span></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-500">✍️</span>
                <span>创作题：<span className="text-white">{examQuestions.creation.length}道</span></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-500">📖</span>
                <span>理论题：<span className="text-white">{examQuestions.theory.length}道</span></span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30 mb-6">
            <p className="text-amber-500 text-sm">
              ⚠️ 考试开始后计时器将持续运行，请确保有充足时间完成考试
            </p>
          </div>

          <button
            onClick={handleStartExam}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-4 px-6 
                       rounded-xl transition-colors text-lg"
          >
            开始考试
          </button>

          <button
            onClick={handleBackToHome}
            className="block w-full text-center text-zinc-400 hover:text-white mt-4 text-sm transition-colors"
          >
            返回墨梯首页
          </button>
        </div>
      </div>
    );
  }

  if (examFinished) {
    const theoryAnswers = answers.filter((a) => a.type === 'theory');
    const theoryScore = theoryAnswers.reduce((sum, a) => sum + a.score, 0);
    const theoryMaxScore = examQuestions.theory.reduce((sum, q) => sum + q.score, 0);
    const percentage = Math.round((theoryScore / theoryMaxScore) * 100);

    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-white mb-2">考试完成</h1>
            <p className="text-zinc-400">用时 {formatTime(currentTime)}</p>
          </div>

          <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/50 mb-6">
            <div className="text-center mb-6">
              <div className="text-6xl font-bold text-amber-500 mb-2">{percentage}%</div>
              <div className="text-zinc-400">
                理论题得分：{theoryScore} / {theoryMaxScore}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-zinc-700/50">
                <span className="text-zinc-400">临摹题</span>
                <span className="text-zinc-300">需线下自评</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700/50">
                <span className="text-zinc-400">创作题</span>
                <span className="text-zinc-300">需线下自评</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-400">理论题</span>
                <span className="text-emerald-500">{theoryScore}分</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50 mb-6">
            <h3 className="text-white font-bold mb-3">参考答案</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {examQuestions.theory.map((q, i) => {
                const answer = answers.find((a) => a.questionId === q.id);
                return (
                  <div key={q.id} className="text-sm">
                    <span className="text-zinc-500">{i + 1}.</span>
                    <span className={`ml-2 ${answer?.isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
                      {answer?.isCorrect ? '✓' : '✗'}
                    </span>
                    <span className="text-zinc-300 ml-2">{q.question}</span>
                    <span className="text-amber-500 ml-2">答案：{q.answer}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-medium py-3 px-4 
                         rounded-lg transition-colors"
            >
              再考一次
            </button>
            <button
              onClick={handleBackToHome}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-3 px-4 
                         rounded-lg transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // During exam
  const sections = [
    { id: 'imitation', name: '临摹', count: examQuestions.imitation.length, score: examQuestions.imitation.reduce((s, q) => s + q.score, 0) },
    { id: 'creation', name: '创作', count: examQuestions.creation.length, score: examQuestions.creation.reduce((s, q) => s + q.score, 0) },
    { id: 'theory', name: '理论', count: examQuestions.theory.length, score: examQuestions.theory.reduce((s, q) => s + q.score, 0) },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black">
      {/* Header - Timer */}
      <div className={`border-b backdrop-blur-sm sticky top-0 z-50 ${
        isTimeRunningLow 
          ? 'bg-red-900/80 border-red-800/50' 
          : 'bg-zinc-900/80 border-zinc-800/50'
      }`}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">模拟考试</h1>
              <p className="text-zinc-400 text-xs">
                {isAdvanced ? '8 级' : '4-6 级'}试卷
              </p>
            </div>
            <div className={`text-2xl font-mono font-bold ${
              isTimeRunningLow ? 'text-red-500 animate-pulse' : 'text-amber-500'
            }`}>
              {getRemainingTime()}
            </div>
            <button
              onClick={handleSubmit}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 
                         rounded-lg transition-colors"
            >
              交卷
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Section Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id as typeof currentSection)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                currentSection === section.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <span>{section.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                currentSection === section.id ? 'bg-black/20' : 'bg-zinc-700'
              }`}>
                {section.count}题 ({section.score}分)
              </span>
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {currentSection === 'imitation' && examQuestions.imitation.map((q, i) => (
            <div key={q.id} className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700/50">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded">
                  第{i + 1}题
                </span>
                <span className="text-zinc-400 text-sm">{q.score}分</span>
              </div>
              <h3 className="text-white font-bold mb-2">{q.title}</h3>
              <div className="bg-zinc-900/50 rounded-lg p-4 mb-4">
                <p className="text-zinc-300 whitespace-pre-line font-mono">{q.content}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
                <span>{q.charCount}字</span>
                <span>{q.timeLimit}分钟</span>
              </div>
              {/* Self-assessment */}
              <div className="flex gap-2">
                {[0.8, 0.6, 0.4, 0.2].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => handleSelfAssess(q.id, 'imitation', Math.round(q.score * ratio), q.score)}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-2 rounded transition-colors"
                  >
                    {Math.round(ratio * 100)}%
                  </button>
                ))}
              </div>
            </div>
          ))}

          {currentSection === 'creation' && examQuestions.creation.map((q, i) => (
            <div key={q.id} className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700/50">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded">
                  第{i + 1}题
                </span>
                <span className="text-zinc-400 text-sm">{q.score}分</span>
              </div>
              <h3 className="text-white font-bold mb-2">{q.title}</h3>
              <div className="bg-zinc-900/50 rounded-lg p-4 mb-4">
                <p className="text-zinc-300 whitespace-pre-line font-mono text-center">{q.content}</p>
                {q.author && <p className="text-zinc-500 text-sm text-right mt-2">— {q.author}</p>}
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
                <span>{q.charCount}字</span>
                <span>{q.timeLimit}分钟</span>
              </div>
              {/* Self-assessment */}
              <div className="flex gap-2">
                {[0.8, 0.6, 0.4, 0.2].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => handleSelfAssess(q.id, 'creation', Math.round(q.score * ratio), q.score)}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-2 rounded transition-colors"
                  >
                    {Math.round(ratio * 100)}%
                  </button>
                ))}
              </div>
            </div>
          ))}

          {currentSection === 'theory' && examQuestions.theory.map((q, i) => {
            const answer = answers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded">
                    第{i + 1}题
                  </span>
                  <span className="text-zinc-400 text-sm">{q.score}分</span>
                  {answer && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      answer.isCorrect 
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {answer.isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                <p className="text-white mb-4">{q.question}</p>
                {q.type === 'choice' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((option, j) => {
                      const isSelected = answer !== undefined;
                      const isCorrectAnswer = option === q.answer;
                      
                      let optionClass = 'bg-zinc-900/50 border-zinc-700/50';
                      if (answer) {
                        if (isCorrectAnswer) {
                          optionClass = 'bg-emerald-500/20 border-emerald-500/50';
                        } else if (option === answer.userAnswer && !answer.isCorrect) {
                          optionClass = 'bg-red-500/20 border-red-500/50';
                        }
                      }

                      return (
                        <button
                          key={j}
                          onClick={() => !answer && handleTheoryAnswer(
                            q.id, 
                            option === q.answer, 
                            option === q.answer ? q.score : 0,
                            q.score
                          )}
                          disabled={answer !== undefined}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${optionClass}`}
                        >
                          <span className="text-white text-sm">
                            <span className="text-amber-500 font-bold mr-2">{option.charAt(0)}</span>
                            {option.slice(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.type === 'fill_blank' && !answer && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="请输入答案"
                      className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-2 
                                 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          const isCorrect = input.value.trim() === q.answer;
                          handleTheoryAnswer(q.id, isCorrect, isCorrect ? q.score : 0, q.score);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.currentTarget.previousSibling as HTMLInputElement;
                        const isCorrect = input.value.trim() === q.answer;
                        handleTheoryAnswer(q.id, isCorrect, isCorrect ? q.score : 0, q.score);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg 
                                 font-medium text-sm transition-colors"
                    >
                      提交
                    </button>
                  </div>
                )}
                {answer && q.type === 'fill_blank' && (
                  <div className={`p-3 rounded-lg ${
                    answer.isCorrect 
                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'bg-red-500/20 border border-red-500/30'
                  }`}>
                    <div className="text-sm">
                      <span className="text-zinc-400">正确答案：</span>
                      <span className="text-white">{q.answer}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-12 rounded-xl 
                       transition-colors text-lg"
          >
            交卷
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamPaper;
