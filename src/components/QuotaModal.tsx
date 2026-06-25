import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  coins: number;
  onPremium: () => void;
  onUseKogit: () => Promise<void>;
  onClose: () => void;
}

export default function QuotaModal({ visible, coins, onPremium, onUseKogit, onClose }: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [buying, setBuying] = useState(false);

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
      Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleKogit = async () => {
    if (coins < 1 || buying) return;
    setBuying(true);
    try {
      await onUseKogit();
      handleClose();
    } finally {
      setBuying(false);
    }
  };

  const canUseKogit = coins >= 1;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          {/* Icône limite */}
          <View style={styles.topIcon}>
            <Ionicons name="lock-closed" size={28} color="#C2557D" />
          </View>

          <Text style={styles.title}>Limite atteinte</Text>
          <Text style={styles.subtitle}>
            Tu as utilisé toutes tes questions gratuites.{'\n'}
            Continue avec Premium ou un Kogit.
          </Text>

          {/* Bouton Premium — mis en avant */}
          <View style={styles.premiumWrapper}>
            <View style={styles.recommendedBadge}>
              <Ionicons name="flash" size={11} color="#FFFFFF" />
              <Text style={styles.recommendedText}>RECOMMANDÉ</Text>
            </View>
            <TouchableOpacity style={styles.premiumBtn} onPress={onPremium} activeOpacity={0.85}>
              <View style={styles.premiumBtnInner}>
                <Ionicons name="flash" size={22} color="#FFFFFF" />
                <View>
                  <Text style={styles.premiumBtnTitle}>Passer à Premium</Text>
                  <Text style={styles.premiumBtnSub}>Questions illimitées & stats avancées</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Bouton Kogit */}
          <TouchableOpacity
            style={[styles.kogitBtn, !canUseKogit && styles.kogitBtnDisabled]}
            onPress={handleKogit}
            disabled={!canUseKogit || buying}
            activeOpacity={0.8}
          >
            {buying ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <>
                <Text style={styles.kogitEmoji}>🪙</Text>
                <View style={styles.kogitBtnText}>
                  <Text style={[styles.kogitBtnTitle, !canUseKogit && styles.kogitBtnTitleDisabled]}>
                    Utiliser 1 Kogit
                  </Text>
                  <Text style={[styles.kogitBtnSub, !canUseKogit && styles.kogitBtnSubDisabled]}>
                    {canUseKogit
                      ? `+5 questions • Solde : ${coins} kogit${coins > 1 ? 's' : ''}`
                      : 'Maintiens ta série pour en gagner !'}
                  </Text>
                </View>
                <View style={[styles.kogitBalance, !canUseKogit && styles.kogitBalanceDisabled]}>
                  <Text style={[styles.kogitBalanceText, !canUseKogit && styles.kogitBalanceTextDisabled]}>
                    {coins}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} activeOpacity={0.6} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Plus tard</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },

  topIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#FDF2F8', borderWidth: 1.5, borderColor: '#FBCFE8',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  subtitle: {
    fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 24,
  },

  /* Premium */
  premiumWrapper: { width: '100%', marginBottom: 4 },
  recommendedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'center', marginBottom: -8, zIndex: 1,
  },
  recommendedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  premiumBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  premiumBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  premiumBtnTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  premiumBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  /* Séparateur */
  separator: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', marginVertical: 16,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
  separatorText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },

  /* Kogit */
  kogitBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 16,
    backgroundColor: '#FFFBEB', paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 8,
  },
  kogitBtnDisabled: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  kogitEmoji: { fontSize: 24 },
  kogitBtnText: { flex: 1 },
  kogitBtnTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  kogitBtnTitleDisabled: { color: '#9CA3AF' },
  kogitBtnSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  kogitBtnSubDisabled: { color: '#9CA3AF' },
  kogitBalance: {
    backgroundColor: '#FEF3C7', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  kogitBalanceDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  kogitBalanceText: { fontSize: 15, fontWeight: '900', color: '#D97706' },
  kogitBalanceTextDisabled: { color: '#9CA3AF' },

  cancelBtn: { marginTop: 6, paddingVertical: 8 },
  cancelText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
});
