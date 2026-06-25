import {
  collection, doc, getDocs, query, limit,
  setDoc, runTransaction, onSnapshot,
  serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Question } from '../types';
import { DuelData, DuelAnswer, DuelPlayer } from '../types/duel';

const QUESTION_TIME = 30; // seconds per question
const FORCE_ADVANCE_MS = (QUESTION_TIME + 5) * 1000; // 35s

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export { QUESTION_TIME };

export async function createDuel(player: DuelPlayer, questions: Question[]): Promise<string> {
  const code = generateCode();
  const duelRef = doc(collection(db, 'duels'));
  await setDoc(duelRef, {
    code,
    status: 'waiting',
    playerIds: [player.uid],
    players: { [player.uid]: player },
    questions: questions.slice(0, 5),
    currentQuestionIndex: 0,
    questionStartedAt: null,
    answers: { [player.uid]: [] },
    scores: { [player.uid]: 0 },
    winner: null,
    createdAt: serverTimestamp(),
    finishedAt: null,
  });
  return duelRef.id;
}

export async function joinDuel(duelId: string, player: DuelPlayer): Promise<void> {
  const duelRef = doc(db, 'duels', duelId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(duelRef);
    if (!snap.exists()) throw new Error('Duel introuvable');
    const data = snap.data() as DuelData;
    if (data.status !== 'waiting') throw new Error('Ce duel a déjà commencé');
    if (data.playerIds.includes(player.uid)) throw new Error('Déjà dans ce duel');
    tx.update(duelRef, {
      status: 'in_progress',
      playerIds: [...data.playerIds, player.uid],
      [`players.${player.uid}`]: player,
      [`answers.${player.uid}`]: [],
      [`scores.${player.uid}`]: 0,
      questionStartedAt: serverTimestamp(),
    });
  });
}

export async function findDuelByCode(code: string): Promise<string | null> {
  const snap = await getDocs(
    query(
      collection(db, 'duels'),
      where('code', '==', code.toUpperCase()),
      where('status', '==', 'waiting'),
      limit(1),
    )
  );
  if (snap.empty) return null;
  return snap.docs[0].id;
}

export async function submitDuelAnswer(
  duelId: string,
  myUid: string,
  opponentUid: string,
  isCorrect: boolean,
  timeMs: number,
): Promise<void> {
  const duelRef = doc(db, 'duels', duelId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(duelRef);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    if (data.status !== 'in_progress') return;

    const idx: number = data.currentQuestionIndex;
    const myAnswers: DuelAnswer[] = data.answers?.[myUid] ?? [];
    if (myAnswers.length > idx) return; // already answered

    const newMyAnswers = [...myAnswers, { isCorrect, timeMs }];
    const opponentAnswers: DuelAnswer[] = data.answers?.[opponentUid] ?? [];
    const opponentAnswered = opponentAnswers.length > idx;
    const startMs: number = data.questionStartedAt?.toMillis?.() ?? Date.now();
    const shouldAdvance = opponentAnswered || (Date.now() - startMs) >= FORCE_ADVANCE_MS;

    const updates: Record<string, any> = { [`answers.${myUid}`]: newMyAnswers };

    if (shouldAdvance) {
      const nextIdx = idx + 1;
      if (nextIdx >= (data.questions?.length ?? 5)) {
        const myScore = newMyAnswers.filter((a: DuelAnswer) => a.isCorrect).length;
        const oppScore = opponentAnswers.filter((a: DuelAnswer) => a.isCorrect).length;
        updates.status = 'finished';
        updates.finishedAt = serverTimestamp();
        updates[`scores.${myUid}`] = myScore;
        updates[`scores.${opponentUid}`] = oppScore;
        updates.winner = myScore > oppScore ? myUid : oppScore > myScore ? opponentUid : 'draw';
      } else {
        updates.currentQuestionIndex = nextIdx;
        updates.questionStartedAt = serverTimestamp();
      }
    }

    tx.update(duelRef, updates);
  });
}

export async function forceAdvanceDuel(
  duelId: string,
  myUid: string,
  opponentUid: string,
): Promise<void> {
  const duelRef = doc(db, 'duels', duelId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(duelRef);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    if (data.status !== 'in_progress') return;

    const idx: number = data.currentQuestionIndex;
    const startMs: number = data.questionStartedAt?.toMillis?.() ?? Date.now();
    if (Date.now() - startMs < FORCE_ADVANCE_MS) return; // not stale

    const myAnswers: DuelAnswer[] = data.answers?.[myUid] ?? [];
    const opponentAnswers: DuelAnswer[] = data.answers?.[opponentUid] ?? [];
    const iAnswered = myAnswers.length > idx;
    const oppAnswered = opponentAnswers.length > idx;
    if (iAnswered && oppAnswered) return; // both already answered, race condition

    const updates: Record<string, any> = {};
    const newMyAnswers = iAnswered ? myAnswers : [...myAnswers, { isCorrect: false, timeMs: FORCE_ADVANCE_MS, forfeit: true }];
    const newOppAnswers = oppAnswered ? opponentAnswers : [...opponentAnswers, { isCorrect: false, timeMs: FORCE_ADVANCE_MS, forfeit: true }];

    if (!iAnswered) updates[`answers.${myUid}`] = newMyAnswers;
    if (!oppAnswered) updates[`answers.${opponentUid}`] = newOppAnswers;

    const nextIdx = idx + 1;
    if (nextIdx >= (data.questions?.length ?? 5)) {
      const myScore = newMyAnswers.filter((a: DuelAnswer) => a.isCorrect).length;
      const oppScore = newOppAnswers.filter((a: DuelAnswer) => a.isCorrect).length;
      updates.status = 'finished';
      updates.finishedAt = serverTimestamp();
      updates[`scores.${myUid}`] = myScore;
      updates[`scores.${opponentUid}`] = oppScore;
      updates.winner = myScore > oppScore ? myUid : oppScore > myScore ? opponentUid : 'draw';
    } else {
      updates.currentQuestionIndex = nextIdx;
      updates.questionStartedAt = serverTimestamp();
    }

    tx.update(duelRef, updates);
  });
}

export function subscribeToDuel(
  duelId: string,
  onData: (duel: DuelData) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'duels', duelId),
    (snap) => { if (snap.exists()) onData({ id: snap.id, ...snap.data() } as DuelData); },
    onError,
  );
}
