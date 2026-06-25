import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  arrayRemove, arrayUnion,
  collection, doc, documentId, getDoc, getDocs, query, limit, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Question } from '../types';
import { SEED_QUESTIONS } from '../data/questions';
import { getGuestProfile, toggleGuestSavedQuestion } from '../utils/guestProfile';
import { purchaseKogitItem, KogitItem } from '../utils/kogits';
import PaywallScreen from './PaywallScreen';
const FREE_FLASH_LIMIT = 5;

const CATEGORY_ICONS: Record<string, string> = {
  'Géographie': 'earth-outline',
  'Histoire': 'book-outline',
  'Sciences': 'flask-outline',
  'Art': 'color-palette-outline',
  'Littérature': 'library-outline',
  'Culture': 'bulb-outline',
  'Nature': 'leaf-outline',
  'Musique': 'musical-notes-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Géographie': '#3B82F6',
  'Histoire': '#8B5CF6',
  'Sciences': '#10B981',
  'Art': '#EC4899',
  'Littérature': '#F59E0B',
  'Culture': '#C2557D',
  'Nature': '#84CC16',
  'Musique': '#06B6D4',
};

const { width: SCREEN_W } = Dimensions.get('window');

function FlashCard({
  item, cardWidth, index, total, isSaved, onToggleSave,
}: {
  item: Question; cardWidth: number; index: number; total: number;
  isSaved: boolean; onToggleSave: () => void;
}) {
  const icon = CATEGORY_ICONS[item.theme] ?? 'help-circle-outline';
  const catColor = CATEGORY_COLORS[item.theme] ?? '#C2557D';
  const filledStars = item.difficulte;

  return (
    <View style={[styles.slide, { width: cardWidth }]}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.categoryChip, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
            <Ionicons name={icon as any} size={14} color={catColor} />
            <Text style={[styles.categoryLabel, { color: catColor }]}>{item.theme}</Text>
          </View>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Text key={i} style={[styles.star, i < filledStars && styles.starFilled]}>★</Text>
            ))}
          </View>
        </View>

        <View style={styles.face}>
          <View style={styles.bulbRow}>
            <Ionicons name="bulb-outline" size={28} color="#C2557D" />
            <Text style={styles.faceHint}>LE SAVIEZ-VOUS ?</Text>
          </View>
          <Text style={styles.explicText}>{item.explication}</Text>

          <View style={styles.cardFooterActions}>
            <TouchableOpacity onPress={onToggleSave} activeOpacity={0.7} style={styles.saveBtn}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? '#C2557D' : '#9CA3AF'}
              />
              <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextActive]}>
                {isSaved ? 'Sauvegardé' : 'Sauvegarder'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.flashShareBtn}
              activeOpacity={0.8}
              onPress={() => {
                Share.share({
                  message: `💡 Le saviez-vous ?\n\n${item.explication}\n\n— Kogito`,
                }).catch(console.error);
              }}
            >
              <Ionicons name="arrow-redo-outline" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardCounterText}>{index + 1} / {total}</Text>
        </View>
      </View>
    </View>
  );
}

function LockedCard({
  cardWidth, coins, onPremium, onUseKogit,
}: {
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
    <View style={[styles.slide, { width: cardWidth }]}>
      <View style={styles.card}>
        <View style={styles.lockedFace}>

          {/* Icône + titre */}
          <View style={styles.lockIconWrap}>
            <Ionicons name="lock-closed" size={32} color="#C2557D" />
          </View>
          <Text style={styles.lockedTitle}>Limite atteinte</Text>
          <Text style={styles.lockedSub}>
            Tu as consulté toutes tes révisions gratuites.{'\n'}Continue avec Premium ou un Kogit.
          </Text>

          {/* Bouton Premium — mis en avant */}
          <View style={styles.lockedPremiumWrap}>
            <View style={styles.lockedRecommendedBadge}>
              <Ionicons name="flash" size={10} color="#FFFFFF" />
              <Text style={styles.lockedRecommendedText}>RECOMMANDÉ</Text>
            </View>
            <TouchableOpacity style={styles.lockedPremiumBtn} onPress={onPremium} activeOpacity={0.85}>
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <View>
                <Text style={styles.lockedPremiumTitle}>Passer à Premium</Text>
                <Text style={styles.lockedPremiumSub}>Révisions illimitées</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={styles.lockedSeparator}>
            <View style={styles.lockedSepLine} />
            <Text style={styles.lockedSepText}>ou</Text>
            <View style={styles.lockedSepLine} />
          </View>

          {/* Bouton Kogit */}
          <TouchableOpacity
            style={[styles.lockedKogitBtn, !canUseKogit && styles.lockedKogitBtnDisabled]}
            onPress={handleKogit}
            disabled={!canUseKogit || buying}
            activeOpacity={0.8}
          >
            {buying ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <>
                <Text style={styles.lockedKogitEmoji}>🪙</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lockedKogitTitle, !canUseKogit && styles.lockedKogitTitleDisabled]}>
                    Utiliser 1 Kogit
                  </Text>
                  <Text style={[styles.lockedKogitSub, !canUseKogit && styles.lockedKogitSubDisabled]}>
                    {canUseKogit ? `+1 révision • ${coins} kogit${coins > 1 ? 's' : ''}` : 'Maintiens ta série pour en gagner !'}
                  </Text>
                </View>
                <Text style={[styles.lockedKogitCount, !canUseKogit && styles.lockedKogitCountDisabled]}>
                  {coins}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

type CardListItem = Question | { id: '__locked__' };

function CardList({
  cards,
  isPremium,
  savedIds,
  onToggleSave,
  freeLimit,
  coins,
  onPremium,
  onUseKogit,
}: {
  cards: Question[];
  isPremium: boolean;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  freeLimit: number;
  coins: number;
  onPremium: () => void;
  onUseKogit: () => Promise<void>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(SCREEN_W);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const listData: CardListItem[] = isPremium
    ? cards
    : [...cards.slice(0, freeLimit), { id: '__locked__' }];

  const displayTotal = isPremium ? cards.length : freeLimit;

  return (
    <>
      <FlatList
        data={listData}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={e => setCardWidth(e.nativeEvent.layout.width)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => {
          if (item.id === '__locked__') {
            return (
              <LockedCard
                cardWidth={cardWidth}
                coins={coins}
                onPremium={onPremium}
                onUseKogit={onUseKogit}
              />
            );
          }
          const q = item as Question;
          return (
            <FlashCard
              item={q}
              cardWidth={cardWidth}
              index={index}
              total={displayTotal}
              isSaved={savedIds.has(q.id)}
              onToggleSave={() => onToggleSave(q.id)}
            />
          );
        }}
      />

      <View style={styles.dotsRow}>
        {Array.from({ length: Math.min(listData.length, 12) }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === Math.min(activeIndex, 11) && styles.dotActive,
              !isPremium && i === freeLimit && styles.dotLocked,
            ]}
          />
        ))}
        {listData.length > 12 && <Text style={styles.dotsMore}>…</Text>}
      </View>
    </>
  );
}

function SavedCardModal({
  item,
  visible,
  onClose,
  isSaved,
  onToggleSave,
}: {
  item: Question | null;
  visible: boolean;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(500);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 28, stiffness: 280, useNativeDriver: true }),
      ]).start();
    } else {
      backdropAnim.setValue(0);
      slideAnim.setValue(500);
    }
  }, [visible]);

  if (!item) return null;
  const icon = CATEGORY_ICONS[item.theme] ?? 'help-circle-outline';
  const catColor = CATEGORY_COLORS[item.theme] ?? '#C2557D';
  const filledStars = item.difficulte;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Fond noir — fade indépendant */}
        <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]} />

        {/* Feuille — slide indépendant */}
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.modalHeader}>
            <View style={[styles.categoryChip, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
              <Ionicons name={icon as any} size={14} color={catColor} />
              <Text style={[styles.categoryLabel, { color: catColor }]}>{item.theme}</Text>
            </View>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Text key={i} style={[styles.star, i < filledStars && styles.starFilled]}>★</Text>
              ))}
            </View>
          </View>

          <View style={styles.modalAnswerBlock}>
            <Text style={styles.modalAnswerText}>
              {item.reponses_acceptees[0]}
            </Text>
          </View>

          <View style={styles.modalDivider} />

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.bulbRow}>
              <Ionicons name="bulb-outline" size={24} color="#C2557D" />
              <Text style={styles.faceHint}>LE SAVIEZ-VOUS ?</Text>
            </View>
            <Text style={styles.modalExplicText}>{item.explication}</Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.modalSaveBtn, isSaved && styles.modalSaveBtnActive]}
            onPress={onToggleSave}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isSaved ? '#FFFFFF' : '#C2557D'}
            />
            <Text style={[styles.modalSaveBtnText, isSaved && styles.modalSaveBtnTextActive]}>
              {isSaved ? 'Retirer des sauvegardés' : 'Sauvegarder'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SavedList({
  cards,
  savedIds,
  onToggleSave,
}: {
  cards: Question[];
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Question | null>(null);

  return (
    <>
      <FlatList
        data={cards}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.savedListContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const catColor = CATEGORY_COLORS[item.theme] ?? '#C2557D';
          const icon = CATEGORY_ICONS[item.theme] ?? 'help-circle-outline';
          const answer = item.reponses_acceptees[0] ?? '—';
          const filledStars = item.difficulte;
          return (
            <TouchableOpacity
              style={styles.savedRow}
              onPress={() => setSelected(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="bookmark" size={16} color="#C2557D" />
              <Text style={styles.savedRowAnswer} numberOfLines={1}>{answer}</Text>
              <View style={[styles.savedRowChip, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
                <Ionicons name={icon as any} size={11} color={catColor} />
                <Text style={[styles.savedRowChipText, { color: catColor }]}>{item.theme}</Text>
              </View>
              <View style={styles.savedRowStars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Text key={i} style={[styles.savedRowStar, i < filledStars && styles.savedRowStarFilled]}>★</Text>
                ))}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          );
        }}
      />
      <SavedCardModal
        item={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
        isSaved={selected !== null && savedIds.has(selected.id)}
        onToggleSave={() => {
          if (selected) onToggleSave(selected.id);
        }}
      />
    </>
  );
}

export default function FlashCardsScreen() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [discoverCards, setDiscoverCards] = useState<Question[]>([]);
  const [savedCards, setSavedCards] = useState<Question[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [bonusFlashCards, setBonusFlashCards] = useState(0);
  const [coins, setCoins] = useState(0);
  const [bonusQuizQuestions, setBonusQuizQuestions] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDiscover();
      if (user) loadSaved();
      loadSavedIds();
      loadBonusFlash();
    }, [user])
  );

  const loadBonusFlash = async () => {
    if (!user) return;
    try {
      if (user.isAnonymous) {
        const guest = await getGuestProfile();
        setBonusFlashCards(guest.bonusFlashCards ?? 0);
        setCoins(guest.coins ?? 0);
        setBonusQuizQuestions(guest.bonusQuizQuestions ?? 0);
      } else {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() ?? {};
        setBonusFlashCards(data.bonusFlashCards ?? 0);
        setCoins(data.coins ?? 0);
        setBonusQuizQuestions(data.bonusQuizQuestions ?? 0);
      }
    } catch {
      // ignore
    }
  };

  const loadDiscover = async () => {
    setLoadingDiscover(true);
    try {
      const snap = await getDocs(query(collection(db, 'questions'), limit(100)));
      let qs: Question[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
      if (qs.length === 0) qs = SEED_QUESTIONS.map((q, i) => ({ ...q, id: String(i) }));
      // shuffle
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
      setDiscoverCards(qs.filter(q => q.explication?.trim()));
    } catch {
      setDiscoverCards(
        SEED_QUESTIONS.filter(q => q.explication?.trim()).map((q, i) => ({ ...q, id: String(i) }))
      );
    } finally {
      setLoadingDiscover(false);
    }
  };

  const loadSavedIds = async () => {
    if (!user) return;
    try {
      let ids: string[];
      if (user.isAnonymous) {
        ids = (await getGuestProfile()).savedQuestionIds;
      } else {
        const snap = await getDoc(doc(db, 'users', user.uid));
        ids = snap.data()?.savedQuestionIds ?? [];
      }
      setSavedIds(new Set(ids));
    } catch {
      // ignore
    }
  };

  const toggleSave = async (questionId: string) => {
    if (!user) return;
    const isSaved = savedIds.has(questionId);
    const next = new Set(savedIds);
    if (isSaved) next.delete(questionId);
    else next.add(questionId);
    setSavedIds(next);
    try {
      if (user.isAnonymous) {
        await toggleGuestSavedQuestion(questionId, !isSaved);
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          savedQuestionIds: isSaved ? arrayRemove(questionId) : arrayUnion(questionId),
        });
      }
    } catch {
      setSavedIds(savedIds);
    }
  };

  const loadSaved = async () => {
    if (!user) return;
    setLoadingSaved(true);
    try {
      let ids: string[];
      if (user.isAnonymous) {
        ids = (await getGuestProfile()).savedQuestionIds;
      } else {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        ids = userSnap.data()?.savedQuestionIds ?? [];
      }
      if (ids.length === 0) {
        setSavedCards([]);
        return;
      }
      // Firestore 'in' supports max 30 items per query
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      const snaps = await Promise.all(
        chunks.map(chunk =>
          getDocs(query(collection(db, 'questions'), where(documentId(), 'in', chunk)))
        )
      );
      const qs = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
      setSavedCards(qs.filter(q => q.explication?.trim()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const loading = activeTab === 'discover' ? loadingDiscover : loadingSaved;
  const cards = activeTab === 'discover' ? discoverCards : savedCards;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PaywallScreen visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>RÉVISIONS</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shuffle-outline"
            size={16}
            color={activeTab === 'discover' ? '#C2557D' : '#9CA3AF'}
          />
          <Text style={[styles.tabLabel, activeTab === 'discover' && styles.tabLabelActive]}>
            Découverte
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => { setActiveTab('saved'); loadSaved(); }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="bookmark"
            size={16}
            color={activeTab === 'saved' ? '#C2557D' : '#9CA3AF'}
          />
          <Text style={[styles.tabLabel, activeTab === 'saved' && styles.tabLabelActive]}>
            Sauvegardés
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C2557D" size="large" />
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={activeTab === 'saved' ? 'bookmark-outline' : 'albums-outline'}
            size={48}
            color="#E5E7EB"
          />
          <Text style={styles.emptyText}>
            {activeTab === 'saved'
              ? 'Aucune carte sauvegardée'
              : 'Aucune carte disponible'}
          </Text>
          {activeTab === 'saved' && (
            <Text style={styles.emptyHint}>
              Appuie sur "Enregistrer" après une question pour sauvegarder son anecdote.
            </Text>
          )}
        </View>
      ) : activeTab === 'saved' ? (
        <SavedList
          cards={savedCards}
          savedIds={savedIds}
          onToggleSave={toggleSave}
        />
      ) : (
        <CardList
          cards={discoverCards}
          isPremium={isPremium}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          freeLimit={FREE_FLASH_LIMIT + bonusFlashCards}
          coins={coins}
          onPremium={() => setPaywallVisible(true)}
          onUseKogit={async () => {
            if (!user) return;
            const result = await purchaseKogitItem('flashcard', user.uid, !!user.isAnonymous, {
              coins,
              bonusQuizQuestions,
              bonusFlashCards,
            });
            if (result) {
              setCoins(result.coins);
              setBonusQuizQuestions(result.bonusQuizQuestions);
              setBonusFlashCards(result.bonusFlashCards);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2937', letterSpacing: 0.5 },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FDF2F8',
  },
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabLabelActive: { color: '#C2557D' },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cardCounterText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  saveBtnTextActive: {
    color: '#C2557D',
  },
  flashShareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },

  slide: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryLabel: { fontSize: 13, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 15, color: '#E5E7EB' },
  starFilled: { color: '#C2557D' },

  face: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  bulbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  faceHint: {
    color: '#C2557D',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  explicText: {
    color: '#374151',
    fontSize: 17,
    lineHeight: 28,
    textAlign: 'center',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  dotActive: { width: 18, backgroundColor: '#C2557D' },
  dotLocked: { backgroundColor: '#FBCFE8' },
  dotsMore: { color: '#9CA3AF', fontSize: 14, lineHeight: 14 },

  emptyText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptyHint: { color: '#D1D5DB', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  lockedFace: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 8,
  },
  lockIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FBCFE8',
    marginBottom: 4,
  },
  lockedTitle: { color: '#1F2937', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  lockedSub: { color: '#6B7280', fontSize: 15, textAlign: 'center', lineHeight: 24 },
  /* LockedCard — Premium */
  lockedPremiumWrap: { width: '100%', marginTop: 4 },
  lockedRecommendedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'center', marginBottom: -8, zIndex: 1,
  },
  lockedRecommendedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  lockedPremiumBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  lockedPremiumTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  lockedPremiumSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  /* LockedCard — Séparateur */
  lockedSeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%',
  },
  lockedSepLine: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
  lockedSepText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },

  /* LockedCard — Kogit */
  lockedKogitBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 14,
    backgroundColor: '#FFFBEB', paddingVertical: 12, paddingHorizontal: 14,
  },
  lockedKogitBtnDisabled: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  lockedKogitEmoji: { fontSize: 22 },
  lockedKogitTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  lockedKogitTitleDisabled: { color: '#9CA3AF' },
  lockedKogitSub: { fontSize: 12, color: '#B45309', marginTop: 1 },
  lockedKogitSubDisabled: { color: '#9CA3AF' },
  lockedKogitCount: {
    fontSize: 16, fontWeight: '900', color: '#D97706',
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  lockedKogitCountDisabled: { color: '#9CA3AF', backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },

  // SavedList
  savedListContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  savedRowAnswer: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937' },
  savedRowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  savedRowChipText: { fontSize: 11, fontWeight: '700' },
  savedRowStars: { flexDirection: 'row', gap: 1 },
  savedRowStar: { fontSize: 11, color: '#E5E7EB' },
  savedRowStarFilled: { color: '#C2557D' },

  // SavedCardModal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingBottom: 40,
    maxHeight: Dimensions.get('window').height * 0.78,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalAnswerBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalAnswerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 2,
    marginBottom: 6,
  },
  modalAnswerText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 24,
    marginBottom: 16,
  },
  modalBody: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
    paddingBottom: 24,
  },
  modalExplicText: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C2557D',
  },
  modalSaveBtnActive: {
    backgroundColor: '#C2557D',
    borderColor: '#C2557D',
  },
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C2557D',
  },
  modalSaveBtnTextActive: {
    color: '#FFFFFF',
  },
});
