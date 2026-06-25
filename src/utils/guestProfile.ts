import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORIES } from '../types';
import { StreakData, defaultStreak } from './streak';

const STORAGE_KEY = 'guestProfile';

export interface GuestProfile {
  elo: number;
  eloByCategory: Record<string, number>;
  savedQuestionIds: string[];
  streak: StreakData;
  coins: number;
  bonusQuizQuestions: number;
  bonusFlashCards: number;
}

function defaultGuestProfile(): GuestProfile {
  return {
    elo: 1000,
    eloByCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 1000])),
    savedQuestionIds: [],
    streak: defaultStreak(),
    coins: 0,
    bonusQuizQuestions: 0,
    bonusFlashCards: 0,
  };
}

export async function getGuestProfile(): Promise<GuestProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultGuestProfile();
    return { ...defaultGuestProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultGuestProfile();
  }
}

async function persistGuestProfile(profile: GuestProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function updateGuestElo(elo: number, eloByCategory: Record<string, number>): Promise<void> {
  const profile = await getGuestProfile();
  await persistGuestProfile({ ...profile, elo, eloByCategory });
}

export async function persistGuestStreak(streak: StreakData): Promise<void> {
  const profile = await getGuestProfile();
  await persistGuestProfile({ ...profile, streak });
}

export async function updateGuestCoins(coins: number): Promise<void> {
  const profile = await getGuestProfile();
  await persistGuestProfile({ ...profile, coins });
}

export async function updateGuestExtras(bonusQuizQuestions: number, bonusFlashCards: number): Promise<void> {
  const profile = await getGuestProfile();
  await persistGuestProfile({ ...profile, bonusQuizQuestions, bonusFlashCards });
}

export async function toggleGuestSavedQuestion(questionId: string, saved: boolean): Promise<void> {
  const profile = await getGuestProfile();
  const ids = new Set(profile.savedQuestionIds);
  if (saved) ids.add(questionId);
  else ids.delete(questionId);
  await persistGuestProfile({ ...profile, savedQuestionIds: Array.from(ids) });
}

export async function clearGuestProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error(err);
  }
}
