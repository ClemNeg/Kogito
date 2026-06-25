import { Timestamp } from 'firebase/firestore';
import { Question } from './index';

export interface DuelAnswer {
  isCorrect: boolean;
  timeMs: number;
  forfeit?: boolean;
}

export interface DuelPlayer {
  uid: string;
  displayName: string;
  elo: number;
}

export interface DuelData {
  id: string;
  code: string;
  status: 'waiting' | 'in_progress' | 'finished';
  playerIds: string[];
  players: Record<string, DuelPlayer>;
  questions: Question[];
  currentQuestionIndex: number;
  questionStartedAt: Timestamp | null;
  answers: Record<string, DuelAnswer[]>;
  scores: Record<string, number>;
  winner: string | 'draw' | null;
  createdAt: Timestamp;
  finishedAt: Timestamp | null;
}
