import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { CATEGORIES } from '../types';
import { getGuestProfile, clearGuestProfile } from '../utils/guestProfile';

const MAX_SHEET_HEIGHT = Dimensions.get('window').height * 0.92;

interface Props {
  onClose?: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthScreen({ onClose, initialMode = 'login' }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 28, stiffness: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    if (!email || !password || (mode === 'register' && (!displayName || !confirmPassword))) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const guest = await getGuestProfile();
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName });
        await setDoc(doc(db, 'users', user.uid), {
          displayName,
          email,
          elo: guest.elo,
          eloByCategory: guest.eloByCategory,
          savedQuestionIds: guest.savedQuestionIds,
          uid: user.uid,
        });
        await clearGuestProfile();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose?.();
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/invalid-credential':     'Email ou mot de passe incorrect.',
        'auth/wrong-password':         'Mot de passe incorrect.',
        'auth/user-not-found':         'Aucun compte associé à cet email.',
        'auth/invalid-email':          'Adresse email invalide.',
        'auth/email-already-in-use':   'Cette adresse email est déjà utilisée.',
        'auth/weak-password':          'Le mot de passe doit contenir au moins 6 caractères.',
        'auth/too-many-requests':      'Trop de tentatives échouées. Réessaie dans quelques minutes.',
        'auth/network-request-failed': 'Pas de connexion réseau.',
      };
      Alert.alert('Erreur', messages[err.code] ?? 'Une erreur est survenue. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavWrapper}
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="person" size={32} color="#C2557D" />
            </View>
            <Text style={styles.title}>Kogito</Text>
            <Text style={styles.sub}>
              {mode === 'login' ? 'Connecte-toi pour jouer' : 'Crée ton compte'}
            </Text>

            {mode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Pseudo"
                placeholderTextColor="#9CA3AF"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="none"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {mode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Confirmer le mot de passe"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
              <Text style={styles.toggleText}>
                {mode === 'login'
                  ? "Pas encore de compte ? S'inscrire"
                  : 'Déjà un compte ? Se connecter'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
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
  kavWrapper: {
    width: '100%',
  },
  sheet: {
    width: '100%',
    maxHeight: MAX_SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  sheetContent: {
    alignItems: 'center',
    padding: 28,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FBCFE8',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  button: {
    backgroundColor: '#C2557D',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    width: '100%',
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  toggleText: { color: '#C2557D', textAlign: 'center', fontSize: 14, fontWeight: '600' },
});
