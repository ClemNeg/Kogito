const K = 32;

// Paliers de difficulté par tranche d'ELO :
// 1: 0-500, 2: 500-1000, 3: 1000-1500, 4: 1500-2000, 5: >2000
const DIFFICULTY_BANDS = [500, 1000, 1500, 2000];

// Convertit difficulte (1-5) en ELO représentatif du palier (point médian de la tranche)
export function difficulteToElo(difficulte: number): number {
  const d = Math.max(1, Math.min(5, difficulte));
  const lower = d === 1 ? 0 : DIFFICULTY_BANDS[d - 2];
  return lower + 250;
}

// Convertit un ELO en score implicite de difficulté (1-5) selon les paliers ci-dessus
export function eloToImplicitScore(elo: number): number {
  const band = DIFFICULTY_BANDS.findIndex((max) => elo < max);
  return band === -1 ? 5 : band + 1;
}

// Poids de sélection d'une question selon l'écart entre sa difficulté et la cible
// offset 0 → 50, ±1 → 20, ±2 → 5, ≥3 → 0
export function getDifficultyWeight(questionDiff: number, targetDiff: number): number {
  const offset = Math.abs(questionDiff - targetDiff);
  if (offset === 0) return 50;
  if (offset === 1) return 20;
  if (offset === 2) return 5;
  if (offset === 3) return 2;
  return 1;
}

export function calculateElo(
  playerElo: number,
  questionDifficulty: number,
  isCorrect: boolean,
  timeRatio: number
): { newElo: number; delta: number } {
  const expected = 1 / (1 + Math.pow(10, (questionDifficulty - playerElo) / 400));
  // Bonus if answered quickly: correct fast = 1.0, correct slow = 0.5, wrong = 0
  const actual = isCorrect ? Math.min(1, 0.5 + timeRatio * 0.5) : 0;
  const delta = Math.round(K * (actual - expected));
  return {
    newElo: Math.max(100, playerElo + delta),
    delta,
  };
}
