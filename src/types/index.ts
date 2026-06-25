export interface Question {
  id: string;
  theme: string;
  difficulte: number;
  question: string;
  reponses_acceptees: string[];
  explication: string;
  time: number;
}

import { StreakData } from '../utils/streak';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  elo: number;
  eloByCategory: Record<string, number>;
  photoURL?: string;
  streak?: StreakData;
  coins?: number;
}

export const CATEGORIES = [
  'Géographie',
  'Histoire',
  'Sciences',
  'Art',
  'Littérature',
  'Culture',
  'Nature',
  'Musique',
];
