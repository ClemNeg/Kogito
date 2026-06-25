import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { getEloLevel } from '../utils/eloLevels';

const { height: SCREEN_H } = Dimensions.get('window');
const SMALL = SCREEN_H < 700; // ex: iPhone SE, petits Android
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toggleGuestSavedQuestion } from '../utils/guestProfile';
import { Question } from '../types';
import { calculateElo, difficulteToElo } from '../utils/elo';
import { isAnswerCorrect } from '../utils/matching';

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

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

const CLOCK_R = SMALL ? 26 : 34;
const CLOCK_SIZE = SMALL ? 60 : 80;

function ClockTimer({ timeLeft, totalTime, answered }: { timeLeft: number; totalTime: number; answered: boolean }) {
  const elapsed = 1 - timeLeft / totalTime; // 0 → 1 au fil du temps
  const isLow = timeLeft <= 5 && !answered;
  const arcColor = isLow ? '#EF4444' : '#C2557D';

  const C = CLOCK_SIZE / 2;
  const minR = CLOCK_R * 0.65; // rayon aiguille minutes
  const hourR = CLOCK_R * 0.42; // rayon aiguille heures

  // Aiguille des minutes : tourne dans le sens horaire depuis 12h
  const handAngle = -Math.PI / 2 + elapsed * 2 * Math.PI;
  const mx = C + minR * Math.cos(handAngle);
  const my = C + minR * Math.sin(handAngle);

  // Aiguille des heures : fixe à ~10h
  const hAngle = (-Math.PI / 2) - Math.PI / 3;
  const hx = C + hourR * Math.cos(hAngle);
  const hy = C + hourR * Math.sin(hAngle);

  // Arc sens horaire depuis 12h
  const sx = C + CLOCK_R * Math.cos(-Math.PI / 2);
  const sy = C + CLOCK_R * Math.sin(-Math.PI / 2);
  const ex = C + CLOCK_R * Math.cos(handAngle);
  const ey = C + CLOCK_R * Math.sin(handAngle);
  const largeArc = elapsed > 0.5 ? 1 : 0;
  const arcPath = elapsed > 0.005
    ? `M ${sx} ${sy} A ${CLOCK_R} ${CLOCK_R} 0 ${largeArc} 1 ${ex} ${ey}`
    : '';

  return (
    <Svg width={CLOCK_SIZE} height={CLOCK_SIZE}>
      <Circle cx={C} cy={C} r={CLOCK_R} fill="#FFFFFF" stroke="#E5E7EB" strokeWidth={2} />
      {arcPath ? (
        <Path d={arcPath} fill="none" stroke={arcColor} strokeWidth={SMALL ? 3 : 4} strokeLinecap="round" />
      ) : null}
      <Line x1={C} y1={C} x2={hx} y2={hy} stroke="#374151" strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={C} y1={C} x2={mx} y2={my} stroke="#1F2937" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={C} cy={C} r={3} fill="#1F2937" />
    </Svg>
  );
}

interface Props {
  question: Question;
  isActive: boolean;
  userElo: number;
  displayName: string;
  userId?: string;
  isAnonymous?: boolean;
  cardHeight: number;
  cardWidth: number;
  onAnswer: (isCorrect: boolean, timeRatio: number) => void;
}

export default function QuizCard({ question, isActive, userElo, displayName, userId, isAnonymous, cardHeight, cardWidth, onAnswer }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [eloDelta, setEloDelta] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [timeLeft, setTimeLeft] = useState(question.time);
  const startTimeRef = useRef(0);
  const answeredRef = useRef(false);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const reset = () => {
    answeredRef.current = false;
    setInputValue('');
    setAnswered(false);
    setCorrect(null);
    setEloDelta(null);
    setTimeLeft(question.time);
    timerAnim.setValue(1);
  };

  useEffect(() => {
    if (isActive) {
      reset();
      startTimeRef.current = Date.now();
      animationRef.current = Animated.timing(timerAnim, {
        toValue: 0,
        duration: question.time * 1000,
        useNativeDriver: false,
      });
      animationRef.current.start(({ finished }) => {
        if (finished) submitAnswer('');
      });
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const remaining = Math.max(0, question.time - elapsed);
        setTimeLeft(remaining);
        if (remaining === 0) clearInterval(intervalRef.current!);
      }, 100);
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      animationRef.current?.stop();
      clearInterval(intervalRef.current!);
      inputRef.current?.blur();
    }
    return () => {
      animationRef.current?.stop();
      clearInterval(intervalRef.current!);
    };
  }, [isActive]);

  const submitAnswer = (text: string) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    animationRef.current?.stop();
    clearInterval(intervalRef.current!);
    inputRef.current?.blur();

    const isCorrect = isAnswerCorrect(text, question.reponses_acceptees);
    setCorrect(isCorrect);

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const timeRatio = Math.max(0, 1 - elapsed / question.time);
    const difficulty = difficulteToElo(question.difficulte);
    const { delta } = calculateElo(userElo, difficulty, isCorrect, timeRatio);
    setEloDelta(delta);
    onAnswer(isCorrect, timeRatio);
  };

  const filledStars = question.difficulte;
  const categoryIcon = CATEGORY_ICONS[question.theme] ?? 'help-circle-outline';
  const name = isAnonymous ? 'Anonyme' : displayName;
  const color = avatarColor(name);
  const initials = (name?.[0] ?? '?').toUpperCase();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { height: cardHeight, width: cardWidth }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >

      {/* Carte question avec flèches par-dessus */}
      <View style={[styles.cardWrapper, answered && styles.cardWrapperExpanded]}>
        <View style={[styles.questionCard, answered && styles.questionCardExpanded]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.cardScroll}
          >
          <Text style={styles.questionLabel}>QUESTION:</Text>
          <Text style={styles.questionText}>
            {question.question}
          </Text>

          {/* Infos toujours visibles */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Difficulty</Text>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Text key={i} style={[styles.star, i < filledStars && styles.starFilled]}>★</Text>
                ))}
              </View>
              <Text style={styles.diffNum}>{filledStars}/5</Text>
            </View>
            <ClockTimer timeLeft={timeLeft} totalTime={question.time} answered={answered} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Category</Text>
              <Ionicons name={categoryIcon as any} size={30} color="#6B7280" />
            </View>
          </View>

        {/* Résultat (dans la carte) */}
        {answered && correct !== null && (
          <View style={styles.resultScroll}>

            {/* Séparateur avec flèches */}
            <View style={styles.dividerRow}>
              <Ionicons name="chevron-back" size={20} color="#D1D5DB" />
              <View style={styles.dividerLine} />
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>

            {/* Statut */}
            <View style={[styles.statusRow, correct ? styles.statusCorrect : styles.statusWrong]}>
              <View style={[styles.statusIcon, correct ? styles.statusIconCorrect : styles.statusIconWrong]}>
                <Ionicons
                  name={correct ? 'checkmark' : 'close'}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.statusText}>
                <Text style={[styles.statusTitle, correct ? styles.statusTitleCorrect : styles.statusTitleWrong]}>
                  {correct ? 'Bonne réponse !' : 'Mauvaise réponse'}
                </Text>
                {!correct && (
                  <Text style={styles.correctAnswerText}>
                    Réponse : <Text style={styles.correctAnswerValue}>{question.reponses_acceptees[0]}</Text>
                  </Text>
                )}
              </View>
              {eloDelta !== null && (
                <View style={[styles.eloDeltaBadge, { backgroundColor: eloDelta >= 0 ? '#10B981' : '#EF4444' }]}>
                  <Text style={styles.eloDeltaText}>
                    {eloDelta >= 0 ? '+' : ''}{eloDelta}
                  </Text>
                  <Text style={styles.eloDeltaLabel}>ELO</Text>
                </View>
              )}
            </View>

            {/* Explication */}
            {question.explication ? (
              <View style={styles.explicBox}>
                <View style={styles.explicHeader}>
                  <Ionicons name="bulb-outline" size={16} color="#6B7280" />
                  <Text style={styles.explicLabel}>Le saviez-vous ?</Text>
                </View>
                <Text style={styles.explicText}>{question.explication}</Text>

                {/* Boutons action */}
                <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.saveBtn, saved && styles.saveBtnActive]}
                  onPress={() => {
                    const next = !saved;
                    setSaved(next);
                    if (isAnonymous) {
                      toggleGuestSavedQuestion(question.id, next).catch(console.error);
                    } else if (userId) {
                      updateDoc(doc(db, 'users', userId), {
                        savedQuestionIds: next ? arrayUnion(question.id) : arrayRemove(question.id),
                      }).catch(console.error);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={17}
                    color={saved ? '#FFFFFF' : '#C2557D'}
                  />
                  <Text style={[styles.saveBtnText, saved && styles.saveBtnTextActive]}>
                    {saved ? 'Enregistré' : 'Enregistrer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => {
                    const lines = [
                      `🎯 ${question.question}`,
                      `✓ ${question.reponses_acceptees[0]}`,
                    ];
                    if (question.explication) lines.push(`\n💡 ${question.explication}`);
                    lines.push('\n— Kogito');
                    Share.share({ message: lines.join('\n') }).catch(console.error);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-redo-outline" size={17} color="#6B7280" />
                </TouchableOpacity>
                </View>
              </View>
            ) : null}

          </View>
        )}
          </ScrollView>
        </View>
        {!answered && (
          <>
            <View style={styles.arrowLeft} pointerEvents="none">
              <Ionicons name="chevron-back" size={22} color="#C4C9D4" />
            </View>
            <View style={styles.arrowRight} pointerEvents="none">
              <Ionicons name="chevron-forward" size={22} color="#C4C9D4" />
            </View>
          </>
        )}
      </View>

      {/* Zone de réponse (cachée après réponse) */}
      {!answered && (
        <TouchableOpacity style={styles.answerCard} onPress={() => inputRef.current?.focus()} activeOpacity={1}>
          <TextInput
            ref={inputRef}
            style={styles.answerInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Your Answer Here..."
            placeholderTextColor="#C4C9D4"
            returnKeyType="done"
            onSubmitEditing={() => submitAnswer(inputValue)}
            editable={!answered}
            autoCorrect={false}
            autoCapitalize="none"
            multiline={false}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={() => submitAnswer(inputValue)} activeOpacity={0.8}>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F2F4F8',
    paddingHorizontal: 20,
    paddingTop: SMALL ? 8 : 12,
    paddingBottom: SMALL ? 10 : 16,
  },

  // Joueur
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingVertical: SMALL ? 7 : 10,
    paddingHorizontal: 18,
    marginBottom: SMALL ? 10 : 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  playerAvatar: {
    width: SMALL ? 30 : 38,
    height: SMALL ? 30 : 38,
    borderRadius: SMALL ? 15 : 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitial: { color: '#FFFFFF', fontSize: SMALL ? 12 : 15, fontWeight: '800' },
  playerLabel: { color: '#6B7280', fontSize: SMALL ? 12 : 14 },
  playerName: { color: '#1F2937', fontWeight: '700' },
  playerElo: { color: '#1F2937', fontWeight: '700' },
  coinPill: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  coinPillText: { fontSize: SMALL ? 11 : 12, fontWeight: '800', color: '#D97706' },

  cardWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  cardWrapperExpanded: {
    flex: 1,
  },

  arrowLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    transform: [{ translateY: -11 }],
    zIndex: 10,
  },
  arrowRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: [{ translateY: -11 }],
    zIndex: 10,
  },

  // Carte question
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  questionCardExpanded: {
    flex: 1,
  },
  cardScroll: {
    paddingHorizontal: SMALL ? 16 : 24,
    paddingTop: SMALL ? 14 : 22,
    paddingBottom: SMALL ? 14 : 20,
  },
  questionLabel: {
    color: '#1F2937',
    fontSize: SMALL ? 12 : 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: SMALL ? 8 : 14,
  },
  questionText: {
    color: '#1F2937',
    fontSize: SMALL ? 17 : 20,
    fontWeight: '700',
    lineHeight: SMALL ? 24 : 30,
    textAlign: 'center',
    marginBottom: SMALL ? 14 : 22,
  },
  // Info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoItem: { alignItems: 'center', gap: 6, flex: 1 },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starsRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 16, color: '#E5E7EB' },
  starFilled: { color: '#C2557D' },
  diffNum: { color: '#6B7280', fontSize: 12, fontWeight: '700' },

  // Résultat (dans la carte)
  resultScroll: { marginTop: 12 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: -16,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderLeftWidth: 5,
  },
  statusCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderLeftColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  statusWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderLeftColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  statusIconCorrect: { backgroundColor: '#10B981', shadowColor: '#10B981' },
  statusIconWrong: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },

  statusText: { flex: 1 },
  statusTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  statusTitleCorrect: { color: '#059669' },
  statusTitleWrong: { color: '#DC2626' },
  correctAnswerText: { color: '#9CA3AF', fontSize: 13, marginTop: 3 },
  correctAnswerValue: { color: '#6B7280', fontWeight: '700' },

  eloDeltaBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  eloDeltaText: { fontSize: 20, fontWeight: '800', lineHeight: 24, color: '#FFFFFF' },
  eloDeltaLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#FFFFFF' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: '#C2557D',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  saveBtnActive: {
    backgroundColor: '#C2557D',
    borderColor: '#C2557D',
  },
  saveBtnText: { color: '#C2557D', fontSize: 14, fontWeight: '600' },
  saveBtnTextActive: { color: '#FFFFFF' },
  shareBtn: {
    width: 38, height: 38, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center', alignItems: 'center',
  },

  explicBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  explicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  explicLabel: { color: '#374151', fontSize: 13, fontWeight: '700' },
  explicText: { color: '#6B7280', fontSize: 14, lineHeight: 22 },

  // Zone réponse
  answerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  answerInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: 16,
    paddingVertical: 14,
  },
  submitBtn: {
    backgroundColor: '#C2557D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

});
