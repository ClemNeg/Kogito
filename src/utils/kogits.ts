import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { updateGuestCoins, updateGuestExtras } from './guestProfile';

export type KogitItem = 'quiz' | 'flashcard';

export interface KogitsState {
  coins: number;
  bonusQuizQuestions: number;
  bonusFlashCards: number;
}

export async function purchaseKogitItem(
  item: KogitItem,
  uid: string,
  isAnonymous: boolean,
  state: KogitsState,
): Promise<KogitsState | null> {
  if (state.coins < 1) return null;

  const next: KogitsState = {
    coins: state.coins - 1,
    bonusQuizQuestions: state.bonusQuizQuestions + (item === 'quiz' ? 5 : 0),
    bonusFlashCards: state.bonusFlashCards + (item === 'flashcard' ? 1 : 0),
  };

  if (isAnonymous) {
    await updateGuestCoins(next.coins);
    await updateGuestExtras(next.bonusQuizQuestions, next.bonusFlashCards);
  } else {
    await updateDoc(doc(db, 'users', uid), {
      coins: next.coins,
      bonusQuizQuestions: next.bonusQuizQuestions,
      bonusFlashCards: next.bonusFlashCards,
    });
  }

  return next;
}
