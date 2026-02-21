import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import level46Data from '../../data/grade-questions/level-4-6.json';
import level78Data from '../../data/grade-questions/level-7-8.json';
import theoryBank from '../../data/grade-questions/theory-bank.json';
import type { GradeData, TheoryQuestion } from '../../types/grade';
import {
  ensureExamIslandPermission,
  startExamIsland,
  stopExamIsland,
  updateExamIsland,
} from '../../native/examIsland';

type ExamLevel = 'intermediate' | 'advanced';
type Stage = 'home' | 'exam' | 'result' | 'review';

type ChoiceQuestion = TheoryQuestion & { type: 'choice'; options: string[] };

type Response = {
  selected: string;
  correct: boolean;
  score: number;
};

type StoredExam = {
  v: 1;
  level: ExamLevel;
  startedAt: number;
  questionIds: string[];
  index: number;
  responses: Record<string, Response>;
};

const STORAGE_KEY = 'inkgrid_inkladder_mobile_exam_v1';
const RECENT_KEY = 'inkgrid_inkladder_recent_questions_v1';

function isChoiceQuestion(q: TheoryQuestion): q is ChoiceQuestion {
  return q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0;
}

function optionLetter(option: string): string {
  return String(option || '').trim().slice(0, 1);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}

function pickExamCount(level: ExamLevel): number {
  void level;
  return 20;
}

function titleLabel(level: ExamLevel) {
  return level === 'advanced' ? '高级 · 7-8 级' : '中级 · 4-6 级';
}

function inkgridExamDeepLink(level: ExamLevel) {
  const params = new URLSearchParams();
  params.set('mode', 'grade');
  params.set('level', level);
  params.set('resume', '1');
  return `inkgrid://inkflow?${params.toString()}`;
}

function safeLoadStoredExam(): StoredExam | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const v = (parsed as any).v;
    if (v !== 1) return null;
    return parsed as StoredExam;
  } catch {
    return null;
  }
}

function safeSaveStoredExam(exam: StoredExam | null) {
  try {
    if (!exam) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(exam));
  } catch {
    // ignore
  }
}

function loadRecent(level: ExamLevel): string[] {
  try {
    const raw = window.localStorage.getItem(`${RECENT_KEY}_${level}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string' && x.trim()).slice(0, 400);
  } catch {
    return [];
  }
}

function saveRecent(level: ExamLevel, ids: string[]) {
  try {
    window.localStorage.setItem(`${RECENT_KEY}_${level}`, JSON.stringify(ids.slice(0, 400)));
  } catch {
    // ignore
  }
}

function bankDifficulty(raw: any): 'easy' | 'medium' | 'hard' {
  const d = String(raw?.difficulty || '').toLowerCase();
  if (d === 'hard') return 'hard';
  if (d === 'medium') return 'medium';
  return 'easy';
}

function normalizeBankChoice(raw: any, level: ExamLevel): ChoiceQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type !== 'choice') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  const q = String(raw.question || '').trim();
  const options = Array.isArray(raw.options) ? raw.options.filter(Boolean).map(String) : [];
  const answer = String(raw.answer || '').trim();
  const explanation = String(raw.explanation || '').trim();
  const score = typeof raw.score === 'number' ? raw.score : 2;
  if (!q || !options.length || !answer) return null;
  return {
    id: `bank_${id}`,
    level: level === 'advanced' ? 8 : 4,
    type: 'choice',
    question: q,
    options,
    answer,
    explanation,
    score,
  };
}

function buildChoicePool(level: ExamLevel): ChoiceQuestion[] {
  const data = (level === 'advanced' ? level78Data : level46Data) as unknown as GradeData;
  const fromGrade = (data.theory || []).filter(isChoiceQuestion);

  const bankAll = [] as any[];
  for (const c of (theoryBank as any)?.categories || []) {
    if (c && Array.isArray(c.questions)) bankAll.push(...c.questions);
  }
  if (Array.isArray((theoryBank as any)?.mixed)) bankAll.push(...(theoryBank as any).mixed);

  const bankFiltered = bankAll.filter((q) => {
    if (!q || q.type !== 'choice') return false;
    const d = bankDifficulty(q);
    if (level === 'advanced') return d === 'medium' || d === 'hard';
    return d === 'easy' || d === 'medium';
  });

  const fromBank = bankFiltered.map((q) => normalizeBankChoice(q, level)).filter(Boolean) as ChoiceQuestion[];

  const m = new Map<string, ChoiceQuestion>();
  for (const q of [...fromGrade, ...fromBank]) {
    if (!m.has(q.id)) m.set(q.id, q);
  }
  return Array.from(m.values());
}

export default function MobileChoiceExam() {
  const initialLevel = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = String(params.get('mode') || '').toLowerCase();
    const levelParam = String(params.get('level') || '').toLowerCase();
    if (mode.includes('intermediate')) return 'intermediate' as const;
    if (mode.includes('advanced')) return 'advanced' as const;
    if (levelParam === 'intermediate') return 'intermediate' as const;
    if (levelParam === 'advanced') return 'advanced' as const;
    return 'advanced' as const;
  }, []);

  const resumeRequested = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('resume') === '1';
  }, []);

  const [level, setLevel] = useState<ExamLevel>(initialLevel);
  const [stage, setStage] = useState<Stage>('home');
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [answered, setAnswered] = useState(false);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const startedAtRef = useRef<number>(0);
  const lastIslandUpdateAtRef = useRef<number>(0);

  const questionMap = useMemo(() => {
    const m = new Map<string, ChoiceQuestion>();
    for (const q of buildChoicePool(level)) {
      m.set(q.id, q);
    }
    return m;
  }, [level]);

  const questions = useMemo(() => {
    return questionIds.map((id) => questionMap.get(id)).filter(Boolean) as ChoiceQuestion[];
  }, [questionIds, questionMap]);

  const total = questions.length;
  const current = questions[index] ?? null;
  const currentResponse = current ? responses[current.id] || null : null;

  const score = useMemo(() => {
    return Object.values(responses).reduce((sum, r) => sum + (r.score || 0), 0);
  }, [responses]);

  const correctCount = useMemo(() => {
    return Object.values(responses).filter((r) => r.correct).length;
  }, [responses]);

  const wrongQuestions = useMemo(() => {
    return questions.filter((q) => {
      const r = responses[q.id];
      return r && !r.correct;
    });
  }, [questions, responses]);

  const progressPct = total > 0 ? Math.round(((Math.min(index, total - 1) + 1) / total) * 100) : 0;

  useEffect(() => {
    document.documentElement.style.backgroundColor = '#F6F1E7';
    void ensureExamIslandPermission();
  }, []);

  useEffect(() => {
    if (!resumeRequested) return;
    const stored = safeLoadStoredExam();
    if (!stored) return;

    setLevel(stored.level);
    startedAtRef.current = stored.startedAt;
    setQuestionIds(stored.questionIds);
    setIndex(Math.max(0, Math.min(stored.index, Math.max(0, stored.questionIds.length - 1))));
    setResponses(stored.responses || {});
    setStage('exam');
  }, [resumeRequested]);

  useEffect(() => {
    if (stage !== 'exam') return;
    const stored: StoredExam = {
      v: 1,
      level,
      startedAt: startedAtRef.current,
      questionIds,
      index,
      responses,
    };
    safeSaveStoredExam(stored);
  }, [stage, level, questionIds, index, responses]);

  useEffect(() => {
    if (stage !== 'exam') return;
    if (!current) return;

    const deepLinkUrl = inkgridExamDeepLink(level);
    const subtitle = `${index + 1}/${total} · ${score}分`;
    const now = Date.now();
    const shouldUpdate = now - lastIslandUpdateAtRef.current > 700;
    if (!shouldUpdate) return;
    lastIslandUpdateAtRef.current = now;

    void updateExamIsland({
      title: `墨梯 · ${level === 'advanced' ? '7-8' : '4-6'}`,
      subtitle,
      deepLinkUrl,
      progress: index + 1,
      progressMax: total,
      startedAt: startedAtRef.current,
    });
  }, [stage, level, index, total, score, current]);

  useEffect(() => {
    if (stage === 'home') {
      void stopExamIsland();
      safeSaveStoredExam(null);
    }
  }, [stage]);

  const resetForNewExam = (nextLevel: ExamLevel, ids: string[]) => {
    setLevel(nextLevel);
    setQuestionIds(ids);
    setIndex(0);
    setSelected('');
    setAnswered(false);
    setResponses({});
  };

  const startExam = async (nextLevel: ExamLevel) => {
    const pool = buildChoicePool(nextLevel);
    const want = pickExamCount(nextLevel);
    const poolIds = pool.map((q) => q.id);

    const recent = loadRecent(nextLevel);
    const recentSet = new Set(recent);
    const freshIds = poolIds.filter((id) => !recentSet.has(id));
    const picked = shuffle(freshIds).slice(0, want);
    if (picked.length < want) {
      const fallback = poolIds.filter((id) => !picked.includes(id));
      picked.push(...shuffle(fallback).slice(0, want - picked.length));
    }

    const nextRecent = [...picked, ...recent.filter((id) => !picked.includes(id))].slice(0, 120);
    saveRecent(nextLevel, nextRecent);

    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    resetForNewExam(nextLevel, picked);
    setStage('exam');

    const deepLinkUrl = inkgridExamDeepLink(nextLevel);
    await startExamIsland({
      title: `墨梯 · ${nextLevel === 'advanced' ? '7-8' : '4-6'}`,
      subtitle: `1/${picked.length} · 0分`,
      deepLinkUrl,
      progress: 1,
      progressMax: picked.length,
      startedAt,
    });
  };

  const exitToInkGrid = async () => {
    safeSaveStoredExam(null);
    await stopExamIsland();
    window.location.href = '/';
  };

  const exitToHome = async () => {
    safeSaveStoredExam(null);
    await stopExamIsland();
    setStage('home');
  };

  const submit = () => {
    if (!current) return;
    if (!selected || answered) return;
    const correct = selected === String(current.answer || '').trim();
    const scoreDelta = correct ? current.score || 0 : 0;
    const nextResponses: Record<string, Response> = {
      ...responses,
      [current.id]: { selected, correct, score: scoreDelta },
    };
    setResponses(nextResponses);
    setAnswered(true);
  };

  const goNext = () => {
    if (!answered) return;
    if (index >= total - 1) {
      setStage('result');
      void stopExamIsland();
      safeSaveStoredExam(null);
      return;
    }
    setIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (index <= 0) return;
    setIndex((i) => Math.max(0, i - 1));
  };

  useEffect(() => {
    if (stage !== 'exam') return;
    if (!current) {
      setSelected('');
      setAnswered(false);
      return;
    }
    const r = responses[current.id];
    if (r) {
      setSelected(r.selected);
      setAnswered(true);
    } else {
      setSelected('');
      setAnswered(false);
    }
  }, [stage, current?.id, responses]);

  const kTitleLabel = titleLabel(level);
  const accuracyPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <div className="absolute inset-0 opacity-[0.14] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-transparent to-[#F1E8DA]" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="px-5 pt-[max(env(safe-area-inset-top),24px)] pb-3 flex items-center justify-between border-b border-stone-200/70 bg-white/50 backdrop-blur-md">
          <button
            onClick={() => {
              if (stage === 'exam' || stage === 'review' || stage === 'result') {
                void exitToHome();
                return;
              }
              void exitToInkGrid();
            }}
            className="w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-stone-200/80 flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-black tracking-[0.18em] text-stone-900">墨梯</span>
            <span className="text-[10px] font-serif tracking-[0.14em] text-stone-500 mt-1">
              {stage === 'home' ? '选择题考试' : kTitleLabel}
            </span>
          </div>

          <button
            onClick={() => void exitToInkGrid()}
            className="w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-stone-200/80 flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition"
            aria-label="Close"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {stage === 'home' ? (
          <div className="flex-1 px-5 pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="max-w-xl mx-auto">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                  <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">墨梯</span>
                </div>
                <h2 className="text-2xl font-serif font-black tracking-[0.32em] pl-[0.32em] text-stone-900">理论选择题</h2>
                <p className="text-[12px] font-serif text-stone-600 leading-relaxed tracking-wide">默认高级 7-8 级；可切换中级 4-6 级。</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLevel('advanced')}
                  className={`rounded-[1.6rem] p-4 border shadow-sm text-left transition active:scale-[0.985] ${
                    level === 'advanced'
                      ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/40 shadow-[0_18px_45px_rgba(139,0,0,0.18)]'
                      : 'bg-white/60 text-stone-900 border-stone-200/70'
                  }`}
                >
                  <div className="text-[10px] font-black tracking-[0.5em] pl-[0.5em] opacity-90">高级</div>
                  <div className="mt-2 text-[15px] font-serif font-black tracking-wide">7-8 级</div>
                  <div className={`mt-2 text-[11px] font-serif leading-relaxed ${level === 'advanced' ? 'text-[#F2E6CE]/85' : 'text-stone-600'}`}>20 题 · 约 6 分钟</div>
                </button>

                <button
                  onClick={() => setLevel('intermediate')}
                  className={`rounded-[1.6rem] p-4 border shadow-sm text-left transition active:scale-[0.985] ${
                    level === 'intermediate'
                      ? 'bg-[#0a0a0b] text-[#F2E6CE] border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.25)]'
                      : 'bg-white/60 text-stone-900 border-stone-200/70'
                  }`}
                >
                  <div className="text-[10px] font-black tracking-[0.5em] pl-[0.5em] opacity-90">中级</div>
                  <div className="mt-2 text-[15px] font-serif font-black tracking-wide">4-6 级</div>
                  <div className={`mt-2 text-[11px] font-serif leading-relaxed ${level === 'intermediate' ? 'text-[#F2E6CE]/85' : 'text-stone-600'}`}>20 题 · 约 6 分钟</div>
                </button>
              </div>

              <button
                onClick={() => void startExam(level)}
                className="mt-5 w-full rounded-[1.75rem] bg-emerald-700 text-[#F2E6CE] shadow-[0_25px_60px_rgba(0,100,0,0.18)] border border-emerald-600/60 px-6 py-5 active:scale-[0.985] transition"
              >
                <div className="flex flex-col items-center text-center">
                  <span className="text-[13px] font-black tracking-[0.35em]">开始考试</span>
                  <span className="mt-1 text-[10px] opacity-90 tracking-[0.12em] font-serif">单题聚焦 · 自动判分 · 可回看错题</span>
                </div>
              </button>

              <div className="mt-3 text-center text-[10px] font-serif text-stone-500 tracking-[0.35em] opacity-75">一屏只做一件事</div>
            </div>
          </div>
        ) : stage === 'result' ? (
          <div className="flex-1 px-5 pt-10 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="max-w-xl mx-auto">
              <div className="rounded-[2rem] bg-white/65 backdrop-blur-md border border-stone-200/70 shadow-[0_18px_55px_rgba(0,0,0,0.10)] p-6">
                <div className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">考试完成</div>
                <div className="mt-3 text-2xl font-serif font-black tracking-[0.22em] text-stone-900">{kTitleLabel}</div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-[1.25rem] bg-white/70 border border-stone-200/80 p-4">
                    <div className="text-[10px] font-black tracking-[0.35em] text-stone-500">得分</div>
                    <div className="mt-2 text-2xl font-mono font-black text-[#8B0000]">{score}</div>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/70 border border-stone-200/80 p-4">
                    <div className="text-[10px] font-black tracking-[0.35em] text-stone-500">正确率</div>
                    <div className="mt-2 text-2xl font-mono font-black text-emerald-700">{accuracyPct}%</div>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/70 border border-stone-200/80 p-4">
                    <div className="text-[10px] font-black tracking-[0.35em] text-stone-500">错题</div>
                    <div className="mt-2 text-2xl font-mono font-black text-stone-800">{wrongQuestions.length}</div>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => void startExam(level)}
                    className="flex-1 rounded-[1.25rem] bg-[#8B0000] text-[#F2E6CE] border border-[#8B0000]/50 py-3 font-black tracking-[0.18em] active:scale-[0.985] transition"
                  >
                    再考一次
                  </button>
                  <button
                    onClick={() => setStage('review')}
                    disabled={wrongQuestions.length === 0}
                    className="flex-1 rounded-[1.25rem] bg-white/70 text-stone-800 border border-stone-200/80 py-3 font-black tracking-[0.18em] active:scale-[0.985] transition disabled:opacity-40"
                  >
                    复盘错题
                  </button>
                </div>
              </div>

              <button
                onClick={() => void exitToHome()}
                className="mt-4 w-full rounded-[1.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 py-4 text-stone-700 font-black tracking-[0.28em] active:scale-[0.985] transition"
              >
                返回墨梯
              </button>
            </div>
          </div>
        ) : stage === 'review' ? (
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="max-w-xl mx-auto space-y-3">
              <div className="rounded-[1.75rem] bg-white/65 backdrop-blur-md border border-stone-200/70 shadow-[0_18px_55px_rgba(0,0,0,0.10)] p-5">
                <div className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">错题复盘</div>
                <div className="mt-2 text-[13px] font-serif font-black text-stone-900 tracking-wide">{kTitleLabel}</div>
                <div className="mt-2 text-[11px] font-serif text-stone-600 tracking-wide">共 {wrongQuestions.length} 题</div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => {
                      const ids = wrongQuestions.map((q) => q.id);
                      startedAtRef.current = Date.now();
                      resetForNewExam(level, ids);
                      setStage('exam');
                      void startExamIsland({
                        title: `墨梯 · ${level === 'advanced' ? '7-8' : '4-6'}`,
                        subtitle: `1/${ids.length} · 0分`,
                        deepLinkUrl: inkgridExamDeepLink(level),
                        progress: 1,
                        progressMax: ids.length,
                        startedAt: startedAtRef.current,
                      });
                    }}
                    disabled={wrongQuestions.length === 0}
                    className="flex-1 rounded-[1.25rem] bg-emerald-700 text-[#F2E6CE] border border-emerald-600/60 py-3 font-black tracking-[0.18em] active:scale-[0.985] transition disabled:opacity-40"
                  >
                    再练错题
                  </button>
                  <button
                    onClick={() => void exitToHome()}
                    className="flex-1 rounded-[1.25rem] bg-white/70 text-stone-800 border border-stone-200/80 py-3 font-black tracking-[0.18em] active:scale-[0.985] transition"
                  >
                    返回
                  </button>
                </div>
              </div>

              {wrongQuestions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-[1.75rem] bg-white/65 backdrop-blur-md border border-stone-200/70 shadow-[0_18px_55px_rgba(0,0,0,0.08)] p-5"
                >
                  <div className="text-[14px] font-serif font-black text-stone-900 leading-relaxed tracking-wide">{q.question}</div>
                  <div className="mt-3 text-[12px] font-mono text-[#8B0000] tracking-widest">答案 {q.answer}</div>
                  <div className="mt-2 text-[12px] font-serif text-stone-600 leading-relaxed tracking-wide">{q.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <div className="max-w-xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-serif text-stone-600 tracking-wide">进度 {Math.min(index + 1, total)}/{total || 0}</div>
                  <div className="text-[11px] font-mono text-[#8B0000] tracking-widest">{score} 分</div>
                </div>
                <div className="mt-3 h-2 bg-white/70 rounded-full overflow-hidden border border-stone-200/70">
                  <div className="h-full bg-gradient-to-r from-[#8B0000] to-amber-600 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>

            <div className="flex-1 px-5 pt-6 pb-40">
              <div className="max-w-xl mx-auto">
                {current ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-[2rem] bg-white/65 backdrop-blur-md border border-stone-200/70 shadow-[0_18px_55px_rgba(0,0,0,0.10)] p-6"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-[0.35em] text-stone-600">选择题</span>
                        <span className="text-[10px] font-mono text-stone-500">{current.score} 分</span>
                      </div>

                      <div className="mt-4 text-[18px] font-serif font-black text-stone-900 leading-relaxed tracking-wide">{current.question}</div>

                      <div className="mt-5 space-y-3">
                        {current.options.map((opt, i) => {
                          const letter = optionLetter(opt);
                          const isSelected = selected === letter;
                          const isAnswered = Boolean(currentResponse);
                          const isRight = isAnswered && letter === current.answer;
                          const isWrong = isAnswered && isSelected && !currentResponse?.correct;

                          const base = 'bg-white/75 border-stone-200/90 text-stone-900';
                          const selectedCls = 'bg-amber-500/20 border-amber-600/60 text-stone-950';
                          const rightCls = 'bg-emerald-500/16 border-emerald-600/55 text-stone-950';
                          const wrongCls = 'bg-red-500/14 border-red-600/50 text-stone-950';

                          const cls = isRight ? rightCls : isWrong ? wrongCls : isSelected ? selectedCls : base;

                          const badgeBase = 'w-7 h-7 rounded-full border flex items-center justify-center font-mono font-black';
                          const badgeCls = isRight
                            ? 'bg-emerald-500/18 border-emerald-600/50 text-emerald-800'
                            : isWrong
                              ? 'bg-red-500/18 border-red-600/45 text-red-800'
                              : isSelected
                                ? 'bg-amber-500/22 border-amber-600/55 text-[#8B0000]'
                                : 'bg-white/85 border-stone-200/80 text-[#8B0000]';

                          return (
                            <button
                              key={`${current.id}_${i}`}
                              onClick={() => {
                                if (isAnswered) return;
                                setSelected(letter);
                              }}
                              disabled={isAnswered}
                              className={`w-full text-left rounded-[1.25rem] border p-4 transition active:scale-[0.985] ${cls}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`${badgeBase} ${badgeCls}`}>
                                  {letter}
                                </div>
                                <div className="flex-1 text-[14px] font-serif font-medium leading-relaxed tracking-wide">
                                  {opt.slice(2).trim()}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {currentResponse ? (
                        <div className="mt-5 rounded-[1.25rem] bg-white/70 border border-stone-200/70 p-4">
                          <div className={`font-black tracking-[0.18em] ${currentResponse.correct ? 'text-emerald-700' : 'text-red-700'}`}>
                            {currentResponse.correct ? '回答正确' : `回答错误 · 正确答案 ${current.answer}`}
                          </div>
                          <div className="mt-2 text-[12px] font-serif text-stone-600 leading-relaxed tracking-wide">{current.explanation}</div>
                        </div>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="rounded-[2rem] bg-white/65 backdrop-blur-md border border-stone-200/70 p-6 text-center text-stone-600">题目加载中…</div>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/60 backdrop-blur-md border-t border-stone-200/70">
              <div className="max-w-xl mx-auto flex gap-3">
                <button
                  onClick={goPrev}
                  disabled={index <= 0}
                  className="flex-1 rounded-[1.25rem] bg-white/70 border border-stone-200/80 py-4 text-stone-700 font-black tracking-[0.18em] active:scale-[0.985] transition disabled:opacity-40"
                >
                  上一题
                </button>

                {!answered ? (
                  <button
                    onClick={submit}
                    disabled={!selected}
                    className="flex-[2] rounded-[1.25rem] bg-[#8B0000] text-[#F2E6CE] border border-[#8B0000]/50 py-4 font-black tracking-[0.18em] active:scale-[0.985] transition disabled:opacity-40"
                  >
                    提交
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    className="flex-[2] rounded-[1.25rem] bg-emerald-700 text-[#F2E6CE] border border-emerald-600/60 py-4 font-black tracking-[0.22em] active:scale-[0.985] transition"
                  >
                    {index < total - 1 ? '下一题' : '查看成绩'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
