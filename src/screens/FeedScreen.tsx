import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, getDocs, getDoc, updateDoc, writeBatch,
  query, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import QuizCard from '../components/QuizCard';
import PaywallScreen from './PaywallScreen';
import AuthScreen from './AuthScreen';
import { Question, CATEGORIES } from '../types';
import { calculateElo, difficulteToElo, eloToImplicitScore, getDifficultyWeight } from '../utils/elo';
import { SEED_QUESTIONS } from '../data/questions';
import { getGuestProfile, updateGuestElo, persistGuestStreak, updateGuestCoins } from '../utils/guestProfile';
import { getEloLevel } from '../utils/eloLevels';
import { StreakData, defaultStreak, computeStreakUpdate, getActiveStreak } from '../utils/streak';
import { purchaseKogitItem, KogitItem } from '../utils/kogits';
import Mascotte from '../components/Mascotte';
import LevelModal from '../components/LevelModal';
import LevelUpModal from '../components/LevelUpModal';
import StreakModal from '../components/StreakModal';
import KogitsInfoModal from '../components/KogitsInfoModal';

const FREE_QUESTION_LIMIT = 5;

const BATCH_SIZE = 5;

const { width: SCREEN_W } = Dimensions.get('window');
const PC_SCALE = Math.max(1, Math.min(SCREEN_W / 390, 1.8));

const AVATAR_COLORS = ['#C2557D', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function weightedShuffle(questions: Question[], userElo: number): Question[] {
  const target = eloToImplicitScore(userElo);
  return [...questions]
    .map(q => {
      const w = getDifficultyWeight(q.difficulte, target);
      const key = w > 0 ? Math.pow(Math.random(), 1 / w) : -Math.random();
      return { q, key };
    })
    .sort((a, b) => b.key - a.key)
    .map(x => x.q);
}

type QuizListItem = Question | { id: '__locked__' };

function LockedQuizCard({
  cardHeight, cardWidth, coins, onPremium, onUseKogit,
}: {
  cardHeight: number;
  cardWidth: number;
  coins: number;
  onPremium: () => void;
  onUseKogit: () => Promise<void>;
}) {
  const [buying, setBuying] = useState(false);
  const canUseKogit = coins >= 1;

  const handleKogit = async () => {
    if (!canUseKogit || buying) return;
    setBuying(true);
    try { await onUseKogit(); } finally { setBuying(false); }
  };

  return (
    <View style={{ width: cardWidth, height: cardHeight, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F5F5' }}>
      <View style={styles.lockedQuizCard}>

        <View style={styles.lockedQuizIconWrap}>
          <Ionicons name="lock-closed" size={32} color="#C2557D" />
        </View>
        <Text style={styles.lockedQuizTitle}>Limite atteinte</Text>
        <Text style={styles.lockedQuizSub}>
          Tu as répondu à toutes tes questions gratuites.{'\n'}Continue avec Premium ou un Kogit.
        </Text>

        <View style={styles.lockedQuizPremiumWrap}>
          <View style={styles.lockedQuizRecommendedBadge}>
            <Ionicons name="flash" size={10} color="#FFFFFF" />
            <Text style={styles.lockedQuizRecommendedText}>RECOMMANDÉ</Text>
          </View>
          <TouchableOpacity style={styles.lockedQuizPremiumBtn} onPress={onPremium} activeOpacity={0.85}>
            <Ionicons name="flash" size={18} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedQuizPremiumTitle}>Passer à Premium</Text>
              <Text style={styles.lockedQuizPremiumSub}>Questions illimitées</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={styles.lockedQuizSeparator}>
          <View style={styles.lockedQuizSepLine} />
          <Text style={styles.lockedQuizSepText}>ou</Text>
          <View style={styles.lockedQuizSepLine} />
        </View>

        <TouchableOpacity
          style={[styles.lockedQuizKogitBtn, !canUseKogit && styles.lockedQuizKogitBtnDisabled]}
          onPress={handleKogit}
          disabled={!canUseKogit || buying}
          activeOpacity={0.8}
        >
          {buying ? (
            <ActivityIndicator size="small" color="#D97706" />
          ) : (
            <>
              <Text style={styles.lockedQuizKogitEmoji}>🪙</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lockedQuizKogitTitle, !canUseKogit && styles.lockedQuizKogitTitleDisabled]}>
                  Utiliser 1 Kogit
                </Text>
                <Text style={[styles.lockedQuizKogitSub, !canUseKogit && styles.lockedQuizKogitSubDisabled]}>
                  {canUseKogit ? `+5 questions • ${coins} kogit${coins > 1 ? 's' : ''}` : 'Maintiens ta série pour en gagner !'}
                </Text>
              </View>
              <Text style={[styles.lockedQuizKogitCount, !canUseKogit && styles.lockedQuizKogitCountDisabled]}>
                {coins}
              </Text>
            </>
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userElo, setUserElo] = useState(1000);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listHeight, setListHeight] = useState(Dimensions.get('window').height);
  const [listWidth, setListWidth] = useState(Dimensions.get('window').width);
  const [canScroll, setCanScroll] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: ReturnType<typeof getEloLevel>; newLevel: ReturnType<typeof getEloLevel> } | null>(null);
  const [streakModalCount, setStreakModalCount] = useState<number | null>(null);
  const [streak, setStreak] = useState<StreakData>(defaultStreak());
  const streakRef = useRef<StreakData>(defaultStreak());
  const [coins, setCoins] = useState(0);
  const coinsRef = useRef(0);
  const [bonusQuizQuestions, setBonusQuizQuestions] = useState(0);
  const bonusQuizQuestionsRef = useRef(0);
  const [bonusFlashCards, setBonusFlashCards] = useState(0);
  const coinNotifAnim = useRef(new Animated.Value(0)).current;
  const [coinNotifVisible, setCoinNotifVisible] = useState(false);
  const [kogitsModalVisible, setKogitsModalVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const userEloRef = useRef(1000);
  const userEloByCategoryRef = useRef<Record<string, number>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, 1000]))
  );
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const allQuestionsRef = useRef<Question[]>([]);
  const poolRef = useRef<Question[]>([]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setStarted(false);
      };
    }, [])
  );

  useEffect(() => {
    loadData();
  }, []);

  // Charger le prochain batch quand il reste 2 questions
  useEffect(() => {
    if (hasMoreRef.current && questions.length - activeIndex <= 2) {
      loadNextBatch();
    }
  }, [activeIndex, questions.length]);

  const loadData = async () => {
    if (!user) return;
    try {
      let elo = 1000;
      if (user.isAnonymous) {
        const guest = await getGuestProfile();
        elo = guest.elo;
        userEloByCategoryRef.current = guest.eloByCategory;
        streakRef.current = guest.streak ?? defaultStreak();
        setStreak(streakRef.current);
        coinsRef.current = guest.coins ?? 0;
        setCoins(coinsRef.current);
        bonusQuizQuestionsRef.current = guest.bonusQuizQuestions ?? 0;
        setBonusQuizQuestions(bonusQuizQuestionsRef.current);
        setBonusFlashCards(guest.bonusFlashCards ?? 0);
      } else {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          elo = data.elo ?? 1000;
          userEloByCategoryRef.current = data.eloByCategory ?? Object.fromEntries(CATEGORIES.map((c) => [c, 1000]));
          streakRef.current = data.streak ?? defaultStreak();
          setStreak(streakRef.current);
          coinsRef.current = data.coins ?? 0;
          setCoins(coinsRef.current);
          bonusQuizQuestionsRef.current = data.bonusQuizQuestions ?? 0;
          setBonusQuizQuestions(bonusQuizQuestionsRef.current);
          setBonusFlashCards(data.bonusFlashCards ?? 0);
        }
      }

      // Vérifier si la collection est vide pour le seeding
      const countSnap = await getDocs(query(collection(db, 'questions'), limit(1)));
      if (countSnap.empty) {
        const batch = writeBatch(db);
        SEED_QUESTIONS.forEach((q) => {
          const ref = doc(collection(db, 'questions'));
          batch.set(ref, q);
        });
        await batch.commit();
      }

      setUserElo(elo);
      userEloRef.current = elo;

      const snap = await getDocs(collection(db, 'questions'));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
      allQuestionsRef.current = all;

      const shuffled = weightedShuffle(all, elo);
      poolRef.current = shuffled.slice(BATCH_SIZE);
      setQuestions(shuffled.slice(0, BATCH_SIZE));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadNextBatch = async () => {
    if (loadingMoreRef.current || !user) return;
    loadingMoreRef.current = true;
    try {
      if (poolRef.current.length === 0 && allQuestionsRef.current.length > 0) {
        // Toutes les questions ont été vues dans cette session : on recommence
        // un nouveau tirage mélangé plutôt que de bloquer le défilement.
        poolRef.current = weightedShuffle(allQuestionsRef.current, userEloRef.current);
      }
      const next = poolRef.current.splice(0, BATCH_SIZE);
      if (next.length > 0) {
        setQuestions(prev => [...prev, ...next]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const handleAnswer = async (question: Question, isCorrect: boolean, timeRatio: number) => {
    if (!user) return;
    setCanScroll(true);

    const prevLevel = getEloLevel(userEloRef.current);
    const difficulty = difficulteToElo(question.difficulte);
    const { newElo: newGeneralElo } = calculateElo(userEloRef.current, difficulty, isCorrect, timeRatio);
    const currentCatElo = userEloByCategoryRef.current[question.theme] ?? 1000;
    const { newElo: newCatElo } = calculateElo(currentCatElo, difficulty, isCorrect, timeRatio);

    userEloRef.current = newGeneralElo;
    userEloByCategoryRef.current = { ...userEloByCategoryRef.current, [question.theme]: newCatElo };
    setUserElo(newGeneralElo);

    const nextLevel = getEloLevel(newGeneralElo);
    if (nextLevel.id !== prevLevel.id) {
      setLevelUpData({ oldLevel: prevLevel, newLevel: nextLevel });
    }

    setQuestions(prev => {
      const done = prev.slice(0, activeIndex + 1);
      const remaining = prev.slice(activeIndex + 1);
      return [...done, ...weightedShuffle(remaining, newGeneralElo)];
    });

    const { updated: updatedStreak, dayValidated, coinsEarned } = computeStreakUpdate(streakRef.current);
    streakRef.current = updatedStreak;
    setStreak(updatedStreak);

    if (dayValidated) {
      setStreakModalCount(updatedStreak.current);
    }

    if (coinsEarned > 0) {
      const newCoins = coinsRef.current + coinsEarned;
      coinsRef.current = newCoins;
      setCoins(newCoins);
      setCoinNotifVisible(true);
      coinNotifAnim.setValue(0);
      Animated.sequence([
        Animated.timing(coinNotifAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(coinNotifAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setCoinNotifVisible(false));
    }

    try {
      if (user.isAnonymous) {
        await updateGuestElo(newGeneralElo, userEloByCategoryRef.current);
        await persistGuestStreak(updatedStreak);
        if (coinsEarned > 0) await updateGuestCoins(coinsRef.current);
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          elo: newGeneralElo,
          [`eloByCategory.${question.theme}`]: newCatElo,
          streak: updatedStreak,
          ...(coinsEarned > 0 && { coins: coinsRef.current }),
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
        setCanScroll(false);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F59E0B" size="large" />
      </View>
    );
  }

  if (!started) {
    const displayName = user?.isAnonymous ? 'Anonyme' : (user?.displayName || user?.email?.split('@')[0] || 'Joueur');
    const color = avatarColor(displayName);
    return (
      <SafeAreaView style={styles.startContainer} edges={['top']}>
        {/* Encart joueur */}
        <View style={styles.playerCard}>
          <View style={styles.playerCardLeft}>
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={{
                  width: Math.round(48 * PC_SCALE),
                  height: Math.round(48 * PC_SCALE),
                  borderRadius: Math.round(24 * PC_SCALE),
                }}
              />
            ) : (
              <View style={[styles.playerCardAvatar, {
                backgroundColor: user?.isAnonymous ? '#9CA3AF' : color,
                width: Math.round(48 * PC_SCALE),
                height: Math.round(48 * PC_SCALE),
                borderRadius: Math.round(24 * PC_SCALE),
              }]}>
                {user?.isAnonymous ? (
                  <Ionicons name="person" size={Math.round(22 * PC_SCALE)} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.playerCardAvatarText, { fontSize: Math.round(20 * PC_SCALE) }]}>
                    {displayName[0].toUpperCase()}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.playerCardInfo}>
              <View style={styles.playerCardNameRow}>
                <Text style={[styles.playerCardName, { fontSize: Math.round(19 * PC_SCALE) }]}>{displayName}</Text>
                <TouchableOpacity style={styles.coinBadge} onPress={() => setKogitsModalVisible(true)} activeOpacity={0.7}>
                  <Text style={styles.coinEmoji}>🪙</Text>
                  <Text style={[styles.coinText, { fontSize: Math.round(12 * PC_SCALE) }]}>{coins}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.playerCardEloRow, { fontSize: Math.round(15 * PC_SCALE) }]}>
                ELO <Text style={[styles.playerCardEloVal, { fontSize: Math.round(17 * PC_SCALE) }]}>{userElo}</Text>
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.playerCardLevelBlock} onPress={() => setLevelModalVisible(true)} activeOpacity={0.7}>
            <Mascotte level={getEloLevel(userElo)} size={PC_SCALE >= 1.25 ? 'standard' : 'compact'} />
            <Text style={[styles.playerCardLevel, { fontSize: Math.round(13 * PC_SCALE) }]}>
              {getEloLevel(userElo).name}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.startCard}>
          <Text style={styles.startTitle}>Prêt à jouer ?</Text>
          <Text style={styles.startSub}>
            Des questions de culture générale t'attendent.{'\n'}Réponds le plus vite possible pour gagner plus de points !
          </Text>
          <View style={styles.startInfoRow}>
            <View style={styles.startInfoItem}>
              <Ionicons name="time-outline" size={18} color="#C2557D" />
              <Text style={styles.startInfoText} numberOfLines={1}>30s par question</Text>
            </View>
            <View style={styles.startInfoItem}>
              <Ionicons name="star-outline" size={18} color="#C2557D" />
              <Text style={styles.startInfoText} numberOfLines={1}>Gagne de l'ELO</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={() => setStarted(true)} activeOpacity={0.85}>
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.startBtnText}>Commencer le quiz</Text>
          </TouchableOpacity>

          {user?.isAnonymous && (
            <TouchableOpacity style={styles.guestBanner} onPress={() => setAuthVisible(true)} activeOpacity={0.85}>
              <View style={styles.guestBannerLeft}>
                <Ionicons name="person-add" size={20} color="#C2557D" />
                <Text style={styles.guestBannerTitle}>Créer un compte</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C2557D" />
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={authVisible} animationType="none" transparent onRequestClose={() => setAuthVisible(false)}>
          <AuthScreen onClose={() => setAuthVisible(false)} initialMode="register" />
        </Modal>
        <LevelModal
          visible={levelModalVisible}
          onClose={() => setLevelModalVisible(false)}
          currentLevel={getEloLevel(userElo)}
        />
      </SafeAreaView>
    );
  }

  const displayNameGame = user?.isAnonymous ? 'Anonyme' : (user?.displayName || user?.email?.split('@')[0] || 'Joueur');
  const colorGame = avatarColor(displayNameGame);

  const freeLimit = FREE_QUESTION_LIMIT + bonusQuizQuestions;
  const listData: QuizListItem[] = isPremium
    ? questions
    : [...questions.slice(0, freeLimit), { id: '__locked__' }];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />

      {/* Header joueur fixe */}
      <View style={styles.gameHeader}>
        {user?.photoURL ? (
          <Image source={{ uri: user.photoURL }} style={styles.gameAvatar} />
        ) : (
          <View style={[styles.gameAvatar, styles.gameAvatarLetterWrap,
            { backgroundColor: user?.isAnonymous ? '#9CA3AF' : colorGame }]}>
            {user?.isAnonymous
              ? <Ionicons name="person" size={16} color="#FFFFFF" />
              : <Text style={styles.gameAvatarLetter}>{displayNameGame[0].toUpperCase()}</Text>
            }
          </View>
        )}
        <Text style={styles.gamePlayerLabel}>
          <Text style={styles.gamePlayerName}>{displayNameGame}</Text>
          {'  |  '}
          Elo: <Text style={styles.gamePlayerElo}>{userElo}</Text>
          {'  '}{getEloLevel(userElo).emoji}
        </Text>
        <TouchableOpacity style={styles.gameCoinPill} onPress={() => setKogitsModalVisible(true)} activeOpacity={0.75}>
          <Text style={styles.gameCoinPillText}>🪙 {coins}</Text>
        </TouchableOpacity>
      </View>

      <KogitsInfoModal
        visible={kogitsModalVisible}
        onClose={() => setKogitsModalVisible(false)}
        coins={coins}
        bonusQuizQuestions={bonusQuizQuestions}
        bonusFlashCards={bonusFlashCards}
        onPurchase={async (type: KogitItem) => {
          if (!user) return;
          const result = await purchaseKogitItem(type, user.uid, !!user.isAnonymous, {
            coins: coinsRef.current,
            bonusQuizQuestions: bonusQuizQuestionsRef.current,
            bonusFlashCards,
          });
          if (result) {
            coinsRef.current = result.coins;
            setCoins(result.coins);
            bonusQuizQuestionsRef.current = result.bonusQuizQuestions;
            setBonusQuizQuestions(result.bonusQuizQuestions);
            setBonusFlashCards(result.bonusFlashCards);
          }
        }}
      />

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        extraData={{ userElo, bonusQuizQuestions, isPremium }}
        horizontal
        onLayout={(e) => {
          setListHeight(e.nativeEvent.layout.height);
          setListWidth(e.nativeEvent.layout.width);
        }}
        renderItem={({ item, index }) => {
          if (item.id === '__locked__') {
            return (
              <LockedQuizCard
                cardHeight={listHeight}
                cardWidth={listWidth}
                coins={coins}
                onPremium={() => setPaywallVisible(true)}
                onUseKogit={async () => {
                  if (!user) return;
                  const result = await purchaseKogitItem('quiz', user.uid, !!user.isAnonymous, {
                    coins: coinsRef.current,
                    bonusQuizQuestions: bonusQuizQuestionsRef.current,
                    bonusFlashCards,
                  });
                  if (result) {
                    coinsRef.current = result.coins;
                    setCoins(result.coins);
                    bonusQuizQuestionsRef.current = result.bonusQuizQuestions;
                    setBonusQuizQuestions(result.bonusQuizQuestions);
                    setBonusFlashCards(result.bonusFlashCards);
                    setCanScroll(true);
                  }
                }}
              />
            );
          }
          const q = item as Question;
          return (
            <QuizCard
              question={q}
              isActive={index === activeIndex}
              userElo={userElo}
              displayName={user?.displayName || user?.email?.split('@')[0] || 'Joueur'}
              userId={user?.uid}
              isAnonymous={user?.isAnonymous}
              cardHeight={listHeight}
              cardWidth={listWidth}
              onAnswer={(isCorrect, timeRatio) => handleAnswer(q, isCorrect, timeRatio)}
            />
          );
        }}
        pagingEnabled
        scrollEnabled={canScroll}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListFooterComponent={
          <View style={[styles.endCard, { width: listWidth, height: listHeight }]}>
            {hasMoreRef.current ? (
              <ActivityIndicator color="#F59E0B" />
            ) : (
              <>
                <Text style={styles.endTitle}>Tu as tout vu !</Text>
                <Text style={styles.endSub}>Reviens demain pour de nouvelles questions</Text>
              </>
            )}
          </View>
        }
      />

      {streakModalCount !== null && (
        <StreakModal
          visible={true}
          streakCount={streakModalCount}
          onClose={() => setStreakModalCount(null)}
        />
      )}

      {coinNotifVisible && (
        <Animated.View style={[styles.coinNotif, {
          opacity: coinNotifAnim,
          transform: [{ translateY: coinNotifAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}>
          <Text style={styles.coinNotifText}>🪙 +1 kogit !</Text>
        </Animated.View>
      )}

      {levelUpData && (
        <LevelUpModal
          visible={true}
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          onClose={() => setLevelUpData(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  startContainer: {
    flex: 1,
    backgroundColor: '#F2F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  startCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  playerCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCardAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  playerCardInfo: { alignItems: 'flex-start' },
  playerCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  playerCardName: { color: '#1F2937', fontSize: 19, fontWeight: '700' },
  playerCardEloRow: { color: '#9CA3AF', fontSize: 15 },
  playerCardEloVal: { color: '#1F2937', fontWeight: '800', fontSize: 17 },
  playerCardLevelBlock: { alignItems: 'center', gap: 2 },
  playerCardLevel: { color: '#F9A8C9', fontSize: 13, fontWeight: '600' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  streakFire: { fontSize: 11 },
  streakText: { fontSize: 12, fontWeight: '700', color: '#EA580C' },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinEmoji: { fontSize: 11 },
  coinText: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  coinNotif: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  coinNotifText: { fontSize: 17, fontWeight: '800', color: '#D97706' },
  startTitle: {
    color: '#1F2937',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  startSub: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  startInfoRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 32,
  },
  startInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  startInfoText: {
    color: '#C2557D',
    fontSize: 12,
    fontWeight: '600',
  },
  startBtn: {
    backgroundColor: '#C2557D',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  guestBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  guestBannerTitle: { color: '#9D3A66', fontSize: 15, fontWeight: '700' },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gameAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  gameAvatarLetterWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameAvatarLetter: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  gamePlayerLabel: { color: '#6B7280', fontSize: 13 },
  gamePlayerName: { color: '#1F2937', fontWeight: '700' },
  gamePlayerElo: { color: '#1F2937', fontWeight: '700' },
  gameCoinPill: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  gameCoinPillText: { fontSize: 12, fontWeight: '800', color: '#D97706' },
  endCard: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    gap: 12,
  },
  endTitle: { color: '#1F2937', fontSize: 24, fontWeight: '700' },
  endSub: { color: '#6B7280', fontSize: 16 },

  /* LockedQuizCard */
  lockedQuizCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lockedQuizIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FDF2F8', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FBCFE8', marginBottom: 4,
  },
  lockedQuizTitle: { color: '#1F2937', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  lockedQuizSub: { color: '#6B7280', fontSize: 15, textAlign: 'center', lineHeight: 24 },

  lockedQuizPremiumWrap: { width: '100%' },
  lockedQuizRecommendedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'center', marginBottom: -8, zIndex: 1,
  },
  lockedQuizRecommendedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  lockedQuizPremiumBtn: {
    backgroundColor: '#F59E0B', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
  },
  lockedQuizPremiumTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  lockedQuizPremiumSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  lockedQuizSeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
  },
  lockedQuizSepLine: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
  lockedQuizSepText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },

  lockedQuizKogitBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 14,
    backgroundColor: '#FFFBEB', paddingVertical: 12, paddingHorizontal: 14,
  },
  lockedQuizKogitBtnDisabled: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  lockedQuizKogitEmoji: { fontSize: 22 },
  lockedQuizKogitTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  lockedQuizKogitTitleDisabled: { color: '#9CA3AF' },
  lockedQuizKogitSub: { fontSize: 12, color: '#B45309', marginTop: 1 },
  lockedQuizKogitSubDisabled: { color: '#9CA3AF' },
  lockedQuizKogitCount: {
    fontSize: 16, fontWeight: '900', color: '#D97706',
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  lockedQuizKogitCountDisabled: { color: '#9CA3AF', backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
});
