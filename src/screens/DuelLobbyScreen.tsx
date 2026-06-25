import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToDuel } from '../utils/duel';
import { DuelData } from '../types/duel';

export default function DuelLobbyScreen({ route, navigation }: { route: any; navigation: any }) {
  const { duelId, myUid } = route.params as { duelId: string; myUid: string };
  const [duel, setDuel] = useState<DuelData | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const unsub = subscribeToDuel(duelId, (data) => {
      setDuel(data);
      if (data.status === 'in_progress') {
        navigation.replace('DuelGame', { duelId, myUid });
      }
    });
    return unsub;
  }, [duelId]);

  const handleShare = async () => {
    if (!duel) return;
    try {
      await Share.share({ message: `Rejoins mon duel Kogito ! Code : ${duel.code}` });
    } catch {}
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.inner}>

        <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#6B7280" />
        </TouchableOpacity>

        {/* Animation d'attente */}
        <Animated.View style={[styles.waitIcon, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.waitEmoji}>⚔️</Text>
        </Animated.View>

        <Text style={styles.title}>En attente d'un adversaire</Text>
        <Text style={styles.subtitle}>Partage le code à ton ami pour qu'il rejoigne</Text>

        {/* Code */}
        {duel ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>CODE DU DUEL</Text>
            <Text style={styles.codeValue}>{duel.code}</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="arrow-redo-outline" size={18} color="#C2557D" />
              <Text style={styles.shareBtnText}>Partager</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator color="#C2557D" style={{ marginTop: 32 }} />
        )}

        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={16} color="#9CA3AF" />
          <Text style={styles.infoText}>Le duel démarre dès que ton adversaire rejoint</Text>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  inner: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 20 },

  backBtn: {
    position: 'absolute', top: 16, left: 16,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },

  waitIcon: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: '#FDF2F8', borderWidth: 2, borderColor: '#FBCFE8',
    justifyContent: 'center', alignItems: 'center',
  },
  waitEmoji: { fontSize: 44 },

  title: { fontSize: 24, fontWeight: '800', color: '#1F2937', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  codeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    alignItems: 'center', width: '100%', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  codeLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 42, fontWeight: '900', color: '#C2557D',
    letterSpacing: 8,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FBCFE8', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#FDF2F8',
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#C2557D' },

  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  infoText: { fontSize: 13, color: '#9CA3AF', flex: 1 },

  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
