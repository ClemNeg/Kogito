import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KogitItem } from '../utils/kogits';

const FREE_QUESTION_LIMIT = 5;
const FREE_FLASH_LIMIT = 5;

interface Props {
  visible: boolean;
  onClose: () => void;
  coins: number;
  bonusQuizQuestions: number;
  bonusFlashCards: number;
  onPurchase: (type: KogitItem) => Promise<void>;
}

export default function KogitsInfoModal({
  visible, onClose, coins, bonusQuizQuestions, bonusFlashCards, onPurchase,
}: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [purchasing, setPurchasing] = useState<KogitItem | null>(null);

  useEffect(() => {
    if (visible) {
      backdropAnim.setValue(0);
      slideAnim.setValue(500);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 28, stiffness: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleBuy = async (type: KogitItem) => {
    if (coins < 1 || purchasing) return;
    setPurchasing(type);
    try {
      await onPurchase(type);
    } finally {
      setPurchasing(null);
    }
  };

  const canBuy = coins >= 1;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerEmoji}>🪙</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Kogits</Text>
              <Text style={styles.subtitle}>La monnaie de Kogito</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Balance */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceEmoji}>🪙</Text>
            <Text style={styles.balanceValue}>{coins}</Text>
            <Text style={styles.balanceLabel}>kogit{coins > 1 ? 's' : ''} disponible{coins > 1 ? 's' : ''}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* Gagner */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comment en gagner ?</Text>

              <View style={styles.stepCard}>
                <View style={styles.stepIcon}><Text style={styles.stepEmoji}>📝</Text></View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>5 questions par jour</Text>
                  <Text style={styles.stepDesc}>Réponds à 5 questions en une journée pour valider une journée de série.</Text>
                </View>
              </View>

              <View style={styles.arrow}>
                <Ionicons name="arrow-down" size={16} color="#D1D5DB" />
              </View>

              <View style={styles.stepCard}>
                <View style={styles.stepIcon}><Text style={styles.stepEmoji}>🔥</Text></View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>Série consécutive</Text>
                  <Text style={styles.stepDesc}>Enchaîne les journées sans interruption pour construire ta série.</Text>
                </View>
              </View>

              <View style={styles.arrow}>
                <Ionicons name="arrow-down" size={16} color="#D1D5DB" />
              </View>

              <View style={[styles.stepCard, styles.rewardCard]}>
                <View style={[styles.stepIcon, styles.rewardIcon]}><Text style={styles.stepEmoji}>🪙</Text></View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, styles.rewardTitle]}>+1 Kogit toutes les 3 séries</Text>
                  <Text style={styles.stepDesc}>Chaque fois que ta série atteint un multiple de 3, tu gagnes 1 Kogit.</Text>
                </View>
              </View>

              <View style={styles.exampleRow}>
                {[1, 2, 3, 4, 5, 6].map((day) => (
                  <View key={day} style={[styles.dayDot, day % 3 === 0 && styles.dayDotReward]}>
                    <Text style={[styles.dayDotText, day % 3 === 0 && styles.dayDotTextReward]}>
                      {day % 3 === 0 ? '🪙' : day}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.exampleLabel}>Exemple : J3 et J6 donnent chacun 1 Kogit</Text>
            </View>

            {/* Dépenser */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Boutique</Text>

              {/* Item quiz */}
              <View style={styles.shopItem}>
                <View style={styles.shopItemIcon}>
                  <Text style={styles.shopItemEmoji}>🎯</Text>
                </View>
                <View style={styles.shopItemInfo}>
                  <Text style={styles.shopItemTitle}>5 questions de quiz supplémentaires</Text>
                  <Text style={styles.shopItemSub}>
                    Limite actuelle : {FREE_QUESTION_LIMIT + bonusQuizQuestions} questions
                    {bonusQuizQuestions > 0 && (
                      <Text style={styles.shopItemBonus}> (+{bonusQuizQuestions} débloquées)</Text>
                    )}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.buyBtn, !canBuy && styles.buyBtnDisabled]}
                  onPress={() => handleBuy('quiz')}
                  disabled={!canBuy || purchasing !== null}
                  activeOpacity={0.75}
                >
                  {purchasing === 'quiz' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.buyBtnText, !canBuy && styles.buyBtnTextDisabled]}>
                      🪙 1
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Item flashcard */}
              <View style={[styles.shopItem, { borderBottomWidth: 0 }]}>
                <View style={styles.shopItemIcon}>
                  <Text style={styles.shopItemEmoji}>📚</Text>
                </View>
                <View style={styles.shopItemInfo}>
                  <Text style={styles.shopItemTitle}>1 révision supplémentaire</Text>
                  <Text style={styles.shopItemSub}>
                    Cartes libres : {FREE_FLASH_LIMIT + bonusFlashCards}
                    {bonusFlashCards > 0 && (
                      <Text style={styles.shopItemBonus}> (+{bonusFlashCards} débloquée{bonusFlashCards > 1 ? 's' : ''})</Text>
                    )}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.buyBtn, !canBuy && styles.buyBtnDisabled]}
                  onPress={() => handleBuy('flashcard')}
                  disabled={!canBuy || purchasing !== null}
                  activeOpacity={0.75}
                >
                  {purchasing === 'flashcard' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.buyBtnText, !canBuy && styles.buyBtnTextDisabled]}>
                      🪙 1
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {!canBuy && (
                <View style={styles.noCoinsHint}>
                  <Ionicons name="information-circle-outline" size={15} color="#9CA3AF" />
                  <Text style={styles.noCoinsText}>
                    Pas assez de Kogits — continue ta série pour en gagner !
                  </Text>
                </View>
              )}
            </View>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingBottom: 32,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 12,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  headerEmoji: { fontSize: 22 },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },

  balanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, backgroundColor: '#FFFBEB', borderRadius: 16,
    paddingVertical: 14, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 4,
  },
  balanceEmoji: { fontSize: 22 },
  balanceValue: { fontSize: 28, fontWeight: '900', color: '#D97706' },
  balanceLabel: { fontSize: 14, color: '#92400E', fontWeight: '600' },

  scrollContent: { paddingBottom: 8 },

  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14,
  },

  stepCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  stepIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  stepEmoji: { fontSize: 18 },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 3 },
  stepDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  rewardCard: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  rewardIcon: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  rewardTitle: { color: '#D97706' },

  arrow: { alignItems: 'center', paddingVertical: 4 },

  exampleRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  dayDot: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  dayDotReward: { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#FCD34D' },
  dayDotText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  dayDotTextReward: { fontSize: 14 },
  exampleLabel: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 8 },

  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  shopItemIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  shopItemEmoji: { fontSize: 22 },
  shopItemInfo: { flex: 1 },
  shopItemTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 3 },
  shopItemSub: { fontSize: 12, color: '#9CA3AF' },
  shopItemBonus: { color: '#D97706', fontWeight: '700' },

  buyBtn: {
    backgroundColor: '#D97706',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnDisabled: { backgroundColor: '#F3F4F6' },
  buyBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  buyBtnTextDisabled: { color: '#9CA3AF' },

  noCoinsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  noCoinsText: { flex: 1, fontSize: 12, color: '#9CA3AF', lineHeight: 17 },
});
