import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Question } from '../types';
import { SEED_QUESTIONS } from '../data/questions';
import { createDuel, findDuelByCode, joinDuel } from '../utils/duel';
import { getGuestProfile } from '../utils/guestProfile';
import { getDoc, doc } from 'firebase/firestore';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DuelHomeScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'questions'), limit(50)));
      let qs: Question[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
      if (qs.length === 0) qs = SEED_QUESTIONS.map((q, i) => ({ ...q, id: String(i) }));
      setQuestions(shuffle(qs));
    } catch {
      setQuestions(shuffle(SEED_QUESTIONS.map((q, i) => ({ ...q, id: String(i) }))));
    }
  };

  const getMyProfile = async () => {
    if (!user) throw new Error('Non connecté');
    if (user.isAnonymous) {
      const guest = await getGuestProfile();
      return { uid: user.uid, displayName: 'Anonyme', elo: guest.elo };
    }
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.data() ?? {};
    return {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Joueur',
      elo: data.elo ?? 1000,
    };
  };

  const handleCreate = async () => {
    if (!user || questions.length < 5) return;
    setError(null);
    setCreating(true);
    try {
      const me = await getMyProfile();
      const duelId = await createDuel(me, shuffle(questions).slice(0, 5));
      navigation.navigate('DuelLobby', { duelId, myUid: user.uid });
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!user || code.trim().length < 4) return;
    setError(null);
    setJoining(true);
    try {
      const me = await getMyProfile();
      const duelId = await findDuelByCode(code.trim());
      if (!duelId) {
        setError('Code introuvable ou duel déjà commencé');
        return;
      }
      await joinDuel(duelId, me);
      navigation.navigate('DuelGame', { duelId, myUid: user.uid });
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la connexion');
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>

          {/* Header */}
          <View style={styles.headerWrap}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerEmoji}>⚔️</Text>
            </View>
            <Text style={styles.title}>Duels</Text>
            <Text style={styles.subtitle}>Défie un ami en temps réel</Text>
          </View>

          {/* Rejoindre */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="enter-outline" size={24} color="#C2557D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Rejoindre un duel</Text>
                <Text style={styles.cardDesc}>Entre le code reçu de ton ami</Text>
              </View>
            </View>
            <View style={styles.joinRow}>
              <TextInput
                ref={inputRef}
                style={styles.codeInput}
                value={code}
                onChangeText={t => { setCode(t.toUpperCase()); setError(null); }}
                placeholder="CODE"
                placeholderTextColor="#D1D5DB"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                returnKeyType="go"
                onSubmitEditing={handleJoin}
              />
              <TouchableOpacity
                style={[styles.joinBtn, (joining || code.trim().length < 4) && styles.btnDisabled]}
                onPress={handleJoin}
                disabled={joining || code.trim().length < 4}
                activeOpacity={0.85}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Séparateur */}
          <View style={styles.separator}>
            <View style={styles.sepLine} />
            <Text style={styles.sepText}>ou</Text>
            <View style={styles.sepLine} />
          </View>

          {/* Créer */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="add-circle-outline" size={24} color="#C2557D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Créer un duel</Text>
                <Text style={styles.cardDesc}>Génère un code à partager à ton adversaire</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.createBtn, (creating || questions.length < 5) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={creating || questions.length < 5}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                  <Text style={styles.createBtnText}>Créer un duel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={15} color="#9CA3AF" />
            <Text style={styles.infoText}>5 questions • 30 secondes par question • Timer commun</Text>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 16 },

  headerWrap: { alignItems: 'center', marginBottom: 8 },
  headerIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FDF2F8', borderWidth: 1.5, borderColor: '#FBCFE8',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  headerEmoji: { fontSize: 34 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, gap: 16,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#FDF2F8', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FBCFE8',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#9CA3AF' },

  createBtn: {
    backgroundColor: '#C2557D', borderRadius: 14,
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#C2557D', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  separator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sepLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  sepText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },

  joinRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 18, paddingVertical: 14,
    fontSize: 20, fontWeight: '800', color: '#1F2937',
    letterSpacing: 4, textAlign: 'center',
  },
  joinBtn: {
    width: 52, backgroundColor: '#C2557D', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 14, color: '#EF4444', fontWeight: '600' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  infoText: { fontSize: 12, color: '#9CA3AF' },
});
