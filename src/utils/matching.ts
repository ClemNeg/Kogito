const STOP_WORDS = new Set(['de', 'du', 'la', 'le', 'les', 'd', 'l', 'un', 'une', 'des', 'en', 'au', 'aux', 'et', 'a']);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['\-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(s: string): string {
  return normalize(s).replace(/\s/g, '');
}

function significantWords(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function matchesSingle(userAnswer: string, accepted: string): boolean {
  const userC = compact(userAnswer);
  const acceptedC = compact(accepted);

  if (userC === acceptedC) return true;
  if (userC.length >= 4 && acceptedC.includes(userC)) return true;
  if (acceptedC.length >= 4 && userC.includes(acceptedC)) return true;

  const userSig = significantWords(userAnswer);
  const acceptedSig = significantWords(accepted);
  if (userSig.length > 0 && userSig.every((w) => acceptedSig.includes(w))) return true;

  return false;
}

export function isAnswerCorrect(userAnswer: string, reponses_acceptees: string[]): boolean {
  if (!userAnswer.trim()) return false;
  return reponses_acceptees.some((accepted) => matchesSingle(userAnswer, accepted));
}
