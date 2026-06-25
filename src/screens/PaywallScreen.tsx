import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';

const PERKS = [
  { icon: 'infinite', label: 'Questions illimitées' },
  { icon: 'flash', label: 'Accès à toutes les catégories' },
  { icon: 'trophy', label: 'Classement complet' },
  { icon: 'stats-chart', label: 'Statistiques avancées' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PaywallScreen({ visible, onClose }: Props) {
  const { purchasePremium, restorePurchases } = useSubscription();
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);

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

  const handleBuy = async () => {
    setBuying(true);
    const success = await purchasePremium();
    setBuying(false);
    if (success) onClose();
  };

  const handleRestore = async () => {
    setRestoring(true);
    const success = await restorePurchases();
    setRestoring(false);
    if (success) onClose();
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.iconWrap}>
            <Ionicons name="flash" size={36} color="#C2557D" />
          </View>
          <Text style={styles.title}>Kogito Premium</Text>
          <Text style={styles.sub}>Débloquez tout le contenu sans limite.</Text>

          {/* Perks */}
          <View style={styles.perks}>
            {PERKS.map(({ icon, label }) => (
              <View key={label} style={styles.perk}>
                <Ionicons name={icon as any} size={18} color="#C2557D" />
                <Text style={styles.perkText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.buyBtn, buying && styles.btnDisabled]}
            onPress={handleBuy}
            disabled={buying || restoring}
            activeOpacity={0.85}
          >
            {buying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buyText}>S'abonner</Text>
            )}
          </TouchableOpacity>

          {/* Restore */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={buying || restoring}
          >
            {restoring ? (
              <ActivityIndicator color="#C2557D" size="small" />
            ) : (
              <Text style={styles.restoreText}>Restaurer les achats</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            Abonnement mensuel renouvelé automatiquement. Annulable à tout moment.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FDF2F8',
    borderWidth: 2,
    borderColor: '#FBCFE8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#1F2937',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  sub: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  perks: {
    width: '100%',
    gap: 10,
    marginBottom: 28,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  perkText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '500',
  },
  buyBtn: {
    width: '100%',
    backgroundColor: '#C2557D',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  buyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreBtn: {
    paddingVertical: 10,
    marginBottom: 16,
  },
  restoreText: {
    color: '#C2557D',
    fontSize: 14,
    fontWeight: '600',
  },
  legal: {
    color: '#9CA3AF',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
