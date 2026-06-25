export interface StreakData {
  current: number;       // série consécutive en cours (jours)
  best: number;          // meilleure série all-time
  lastValidDate: string; // dernière date où 5 questions ont été répondues (YYYY-MM-DD)
  todayDate: string;     // date en cours de comptage
  todayCount: number;    // questions répondues sur todayDate
}

export function defaultStreak(): StreakData {
  return { current: 0, best: 0, lastValidDate: '', todayDate: '', todayCount: 0 };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr(): string { return toDateStr(new Date()); }

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

/**
 * Appelée à chaque réponse. Retourne la série mise à jour, si le jour vient d'être validé,
 * et le nombre de pièces gagnées (1 tous les 3 jours consécutifs validés).
 */
export function computeStreakUpdate(streak: StreakData): {
  updated: StreakData;
  dayValidated: boolean;
  coinsEarned: number;
} {
  const today = getTodayStr();
  const yesterday = getYesterdayStr();

  const isSameDay = streak.todayDate === today;
  const todayDate = today;
  const todayCount = isSameDay ? streak.todayCount + 1 : 1;

  // Jour déjà validé aujourd'hui → on incrémente juste le compteur
  if (streak.lastValidDate === today) {
    return { updated: { ...streak, todayDate, todayCount }, dayValidated: false, coinsEarned: 0 };
  }

  // Pas encore atteint 5 questions
  if (todayCount < 5) {
    return { updated: { ...streak, todayDate, todayCount }, dayValidated: false, coinsEarned: 0 };
  }

  // 5ème question du jour — série validée !
  const current = streak.lastValidDate === yesterday ? streak.current + 1 : 1;
  const best = Math.max(streak.best, current);
  const coinsEarned = current % 3 === 0 ? 1 : 0;

  return {
    updated: { current, best, lastValidDate: today, todayDate, todayCount },
    dayValidated: true,
    coinsEarned,
  };
}

/**
 * Retourne la série active (0 si aucune activité hier ou aujourd'hui).
 */
export function getActiveStreak(streak: StreakData): number {
  const today = getTodayStr();
  const yesterday = getYesterdayStr();
  if (streak.lastValidDate === today || streak.lastValidDate === yesterday) {
    return streak.current;
  }
  return 0;
}
