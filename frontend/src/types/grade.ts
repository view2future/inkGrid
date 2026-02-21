/**
 * 墨梯 InkLadder - 类型定义
 */

export type ScriptType = 'kaishu' | 'lishu' | 'zhuan' | 'xingshu' | 'caoshu' | 'xingcao';

export type QuestionType = 'imitation' | 'creation' | 'theory';

export type TheoryQuestionType = 'choice' | 'fill_blank' | 'matching' | 'short_answer';

export interface ImitationQuestion {
  id: string;
  level: number;
  script: ScriptType;
  scriptName: string;
  title: string;
  referenceImage?: string;
  content: string;
  charCount: number;
  requirements: string[];
  score: number;
  timeLimit: number; // minutes
}

export interface CreationQuestion {
  id: string;
  level: number;
  type: string;
  typeName: string;
  title: string;
  content: string;
  author?: string;
  source?: string;
  charCount: number;
  format: string[];
  requirements: string[];
  score: number;
  timeLimit: number; // minutes
}

export interface TheoryQuestion {
  id: string;
  level?: number;
  category?: string;
  type: TheoryQuestionType;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  score: number;
  difficulty?: string;
}

export interface TheoryCategory {
  id: string;
  name: string;
  questions: TheoryQuestion[];
}

export interface TheoryBank {
  name: string;
  description: string;
  categories: TheoryCategory[];
  mixed: TheoryQuestion[];
}

export interface GradeData {
  level: string;
  levelName: string;
  description: string;
  imitation: ImitationQuestion[];
  creation: CreationQuestion[];
  theory: TheoryQuestion[];
}
