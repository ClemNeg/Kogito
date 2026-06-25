import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { auth, db } from '../config/firebase';
import { CATEGORIES } from '../types';
import { getGuestProfile } from '../utils/guestProfile';
import { pickAndUploadAvatar } from '../utils/avatar';
import { StreakData, defaultStreak, getActiveStreak } from '../utils/streak';
import { purchaseKogitItem, KogitItem } from '../utils/kogits';
import { getEloLevel } from '../utils/eloLevels';
import Mascotte from '../components/Mascotte';
import LevelModal from '../components/LevelModal';
import KogitsInfoModal from '../components/KogitsInfoModal';
import PaywallScreen from './PaywallScreen';
import AuthScreen from './AuthScreen';

const CHART_SIZE = 280;
const CENTER = CHART_SIZE / 2;
const RADIUS = 95;
const LABEL_RADIUS = RADIUS + 22;
const N = CATEGORIES.length;

const SHORT_LABELS: Record<string, string> = {
  'Géographie': 'Géo',
  'Histoire': 'Hist.',
  'Sciences': 'Sci.',
  'Art': 'Art',
  'Littérature': 'Lit.',
  'Culture': 'Cult.',
  'Nature': 'Nat.',
  'Musique': 'Mus.',
};

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

const AVATAR_COLORS = ['#C2557D', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function eloToPercent(elo: number) {
  return Math.max(0.05, Math.min(1, (elo - 500) / 1000));
}

function axisPoint(level: number, index: number, r: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / N;
  return { x: CENTER + r * level * Math.cos(angle), y: CENTER + r * level * Math.sin(angle), angle };
}

function KiviatChart({ eloByCategory }: { eloByCategory: Record<string, number> }) {
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const gridPolygon = (level: number) =>
    CATEGORIES.map((_, i) => {
      const { x, y } = axisPoint(level, i, RADIUS);
      return `${x},${y}`;
    }).join(' ');

  const dataPolygon = CATEGORIES.map((cat, i) => {
    const { x, y } = axisPoint(eloToPercent(eloByCategory[cat] ?? 1000), i, RADIUS);
    return `${x},${y}`;
  }).join(' ');

  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE}>
      {gridLevels.map((level) => (
        <Polygon key={level} points={gridPolygon(level)} fill="none" stroke="#E5E7EB" strokeWidth={1} />
      ))}
      {CATEGORIES.map((_, i) => {
        const { x, y } = axisPoint(1, i, RADIUS);
        return <Line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#E5E7EB" strokeWidth={1} />;
      })}
      <Polygon points={dataPolygon} fill="rgba(194,85,125,0.15)" stroke="#C2557D" strokeWidth={2} />
      {CATEGORIES.map((cat, i) => {
        const { x, y } = axisPoint(eloToPercent(eloByCategory[cat] ?? 1000), i, RADIUS);
        return <Circle key={i} cx={x} cy={y} r={4} fill="#C2557D" />;
      })}
      {CATEGORIES.map((cat, i) => {
        const { x, y, angle } = axisPoint(1, i, LABEL_RADIUS);
        const cosA = Math.cos(angle);
        const anchor = cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle';
        return (
          <SvgText key={i} x={x} y={y} fill="#6B7280" fontSize={11} fontWeight="600"
            textAnchor={anchor} alignmentBaseline="middle">
            {SHORT_LABELS[cat] ?? cat}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { isPremium } = useSubscription();
  const [elo, setElo] = useState(1000);
  const [eloByCategory, setEloByCategory] = useState<Record<string, number>>(
    Object.fromEntries(CATEGORIES.map((c) => [c, 1000]))
  );
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData>(defaultStreak());
  const [coins, setCoins] = useState(0);
  const [bonusQuizQuestions, setBonusQuizQuestions] = useState(0);
  const [bonusFlashCards, setBonusFlashCards] = useState(0);
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL ?? null);

  useEffect(() => {
    setPhotoURL(user?.photoURL ?? null);
  }, [user?.uid]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [kogitsModalVisible, setKogitsModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      if (user.isAnonymous) {
        getGuestProfile()
          .then((guest) => {
            setElo(guest.elo);
            setEloByCategory(guest.eloByCategory);
            setStreak(guest.streak ?? defaultStreak());
            setCoins(guest.coins ?? 0);
            setBonusQuizQuestions(guest.bonusQuizQuestions ?? 0);
            setBonusFlashCards(guest.bonusFlashCards ?? 0);
          })
          .finally(() => setLoading(false));
        return;
      }
      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setElo(data.elo ?? 1000);
            setEloByCategory(data.eloByCategory ?? Object.fromEntries(CATEGORIES.map((c) => [c, 1000])));
            setStreak(data.streak ?? defaultStreak());
            setCoins(data.coins ?? 0);
            setBonusQuizQuestions(data.bonusQuizQuestions ?? 0);
            setBonusFlashCards(data.bonusFlashCards ?? 0);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [user])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C2557D" size="large" />
      </View>
    );
  }

  const displayName = user?.isAnonymous ? 'Anonyme' : (user?.displayName || user?.email?.split('@')[0] || 'Joueur');
  const color = avatarColor(displayName);

  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert('Email envoyé', `Un lien de réinitialisation a été envoyé à ${user.email}`);
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer l'email. Réessaie plus tard.");
    }
  };

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const handleChangeAvatar = async () => {
    if (!user || user.isAnonymous) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadAvatar(user.uid);
      if (url) {
        setPhotoURL(url);
        refreshUser();
      }
    } catch {
      Alert.alert('Erreur', "Impossible de changer la photo. Réessaie.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PaywallScreen visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
      <LevelModal visible={levelModalVisible} onClose={() => setLevelModalVisible(false)} currentLevel={getEloLevel(elo)} />
      <KogitsInfoModal
        visible={kogitsModalVisible}
        onClose={() => setKogitsModalVisible(false)}
        coins={coins}
        bonusQuizQuestions={bonusQuizQuestions}
        bonusFlashCards={bonusFlashCards}
        onPurchase={async (type: KogitItem) => {
          if (!user) return;
          const result = await purchaseKogitItem(type, user.uid, !!user.isAnonymous, {
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleChangeAvatar}
            activeOpacity={user?.isAnonymous ? 1 : 0.8}
            disabled={!!user?.isAnonymous}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: user?.isAnonymous ? '#9CA3AF' : color }]}>
                {user?.isAnonymous ? (
                  <Ionicons name="person" size={48} color="#FFFFFF" />
                ) : (
                  <Text style={styles.avatarLetter}>{displayName[0].toUpperCase()}</Text>
                )}
              </View>
            )}
            {!user?.isAnonymous && (
              <View style={styles.avatarEditBadge}>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="camera" size={14} color="#FFFFFF" />
                }
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{displayName}</Text>
          {!!user?.email && <Text style={styles.email}>{user.email}</Text>}
          <View style={styles.statsRow}>
            <View style={styles.eloBlock}>
              <Text style={styles.eloLabel}>ELO TOTAL</Text>
              <Text style={styles.eloValue}>{elo}</Text>
            </View>
            <View style={styles.statsDivider} />
            <TouchableOpacity style={styles.levelBlock} onPress={() => setLevelModalVisible(true)} activeOpacity={0.7}>
              <Mascotte level={getEloLevel(elo)} size="standard" />
              <Text style={styles.levelName}>{getEloLevel(elo).name}</Text>
            </TouchableOpacity>
          </View>

          {/* Séries & Pièces */}
          <View style={styles.streakRow}>
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakValue}>{getActiveStreak(streak)}</Text>
              <Text style={styles.streakLabel}>Série actuelle</Text>
              <Text style={styles.streakSub}>jour{getActiveStreak(streak) > 1 ? 's' : ''} consécutif{getActiveStreak(streak) > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>🏆</Text>
              <Text style={styles.streakValue}>{streak.best}</Text>
              <Text style={styles.streakLabel}>Meilleure série</Text>
              <Text style={styles.streakSub}>all-time</Text>
            </View>
            <TouchableOpacity style={[styles.streakCard, styles.coinsCard]} onPress={() => setKogitsModalVisible(true)} activeOpacity={0.75}>
              <Text style={styles.streakEmoji}>🪙</Text>
              <Text style={[styles.streakValue, styles.coinsValue]}>{coins}</Text>
              <Text style={styles.streakLabel}>Kogits</Text>
              <Text style={styles.streakSub}>à dépenser</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bannière compte invité */}
        {user?.isAnonymous && (
          <TouchableOpacity style={styles.guestBanner} onPress={() => setAuthVisible(true)} activeOpacity={0.85}>
            <View style={styles.guestBannerLeft}>
              <Ionicons name="person-add" size={20} color="#C2557D" />
              <View style={styles.guestBannerTexts}>
                <Text style={styles.guestBannerTitle}>Créer un compte</Text>
                <Text style={styles.guestBannerSub}>Sauvegarde ta progression et apparais au classement</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C2557D" />
          </TouchableOpacity>
        )}

        {/* Premium banner */}
        {isPremium ? (
          <View style={styles.premiumBadgeRow}>
            <Ionicons name="flash" size={16} color="#F59E0B" />
            <Text style={styles.premiumBadgeText}>Premium actif</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.premiumBanner} onPress={() => setPaywallVisible(true)} activeOpacity={0.85}>
            <View style={styles.premiumBannerLeft}>
              <Ionicons name="flash" size={20} color="#F59E0B" />
              <View>
                <Text style={styles.premiumBannerTitle}>Passer à Premium</Text>
                <Text style={styles.premiumBannerSub}>Questions illimitées & stats avancées</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Radar chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radar de compétences</Text>
          <View style={styles.chartWrap}>
            <KiviatChart eloByCategory={eloByCategory} />
          </View>
        </View>

        {/* Category list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ELO par catégorie</Text>
          {CATEGORIES.map((cat, i) => {
            const catElo = eloByCategory[cat] ?? 1000;
            const pct = eloToPercent(catElo);
            const icon = CATEGORY_ICONS[cat] ?? 'help-circle-outline';
            return (
              <View key={cat} style={[styles.catRow, i === CATEGORIES.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.catIcon}>
                  <Ionicons name={icon as any} size={18} color="#C2557D" />
                </View>
                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{cat}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { width: `${pct * 100}%` as any }]} />
                  </View>
                </View>
                <View style={styles.catRight}>
                  <Text style={styles.catElo}>{catElo}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                </View>
              </View>
            );
          })}
        </View>

        {/* Actions */}
        {!user?.isAnonymous && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleChangePassword} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryText}>Changer le mot de passe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={handleSignOut} activeOpacity={0.8}>
              <Text style={styles.btnDangerText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      <Modal visible={authVisible} animationType="none" transparent onRequestClose={() => setAuthVisible(false)}>
        <AuthScreen onClose={() => setAuthVisible(false)} initialMode="register" />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 40 },

  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C2557D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 42, fontWeight: '800' },
  name: { color: '#1F2937', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  email: { color: '#9CA3AF', fontSize: 13, marginBottom: 18 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  eloBlock: { flex: 1, alignItems: 'center' },
  eloLabel: { color: '#C2557D', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  eloValue: { color: '#1F2937', fontSize: 30, fontWeight: '800' },
  statsDivider: { width: 1, height: 64, backgroundColor: '#FBCFE8', marginHorizontal: 16 },
  levelBlock: { flex: 1, alignItems: 'center', gap: 6 },
  levelName: { color: '#C2557D', fontSize: 13, fontWeight: '700', textAlign: 'center' },

  streakRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 16,
  },
  streakCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  streakEmoji: { fontSize: 24, marginBottom: 4 },
  streakValue: { fontSize: 28, fontWeight: '900', color: '#1F2937' },
  streakLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  streakSub: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  coinsCard: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  coinsValue: { color: '#D97706' },

  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  guestBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  guestBannerTexts: { flex: 1 },
  guestBannerTitle: { color: '#9D3A66', fontSize: 15, fontWeight: '700' },
  guestBannerSub: { color: '#C2557D', fontSize: 12, marginTop: 2, flexShrink: 1 },

  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  premiumBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  premiumBannerTitle: { color: '#92400E', fontSize: 15, fontWeight: '700' },
  premiumBannerSub: { color: '#B45309', fontSize: 12, marginTop: 2 },
  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 4,
  },
  premiumBadgeText: { color: '#D97706', fontSize: 13, fontWeight: '700' },

  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  chartWrap: { alignItems: 'center', paddingBottom: 12 },

  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: { flex: 1, gap: 6 },
  catName: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  barTrack: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: { height: 4, backgroundColor: '#C2557D', borderRadius: 2 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catElo: { color: '#1F2937', fontSize: 14, fontWeight: '700' },

  actions: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  btnDanger: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDangerText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
