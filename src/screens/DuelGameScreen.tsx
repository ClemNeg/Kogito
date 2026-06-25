import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { subscribeToDuel, submitDuelAnswer, forceAdvanceDuel, QUESTION_TIME } from '../utils/duel';
import { isAnswerCorrect } from '../utils/matching';
import { getEloLevel } from '../utils/eloLevels';
import { DuelData, DuelAnswer } from '../types/duel';

const AVATAR_COLORS = ['#C2557D', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function MiniTimer({ timeLeft }: { timeLeft: number }) {
  const R = 16;
  const C = 20;
  const elapsed = 1 - timeLeft / QUESTION_TIME;
  const isLow = timeLeft <= 5;
  const color = isLow ? '#EF4444' : '#C2557D';
  const angle = -Math.PI / 2 + elapsed * 2 * Math.PI;
  const sx = C + R * Math.cos(-Math.PI / 2);
  const sy = C + R * Math.sin(-Math.PI / 2);
  const ex = C + R * Math.cos(angle);
  const ey = C + R * Math.sin(angle);
  const largeArc = elapsed > 0.5 ? 1 : 0;
  const arcPath = elapsed > 0.005
    ? `M ${sx} ${sy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}`
    : '';

  return (
    <View style={styles.timerWrap}>
      <Svg width={40} height={40}>
        <Circle cx={C} cy={C} r={R} fill="#F9FAFB" stroke="#E5E7EB" strokeWidth={2} />
        {arcPath ? <Path d={arcPath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" /> : null}
      </Svg>
      <Text style={[styles.timerText, isLow && styles.timerTextLow]}>{Math.ceil(timeLeft)}</Text>
    </View>
  );
}

export default function DuelGameScreen({ route, navigation }: { route: any; navigation: any }) {
const { duelId, myUid } = route.params as { duelId: string; myUid: string };
  const [duel, setDuel] = useState<DuelData | null>(null);
  const duelRef = useRef<DuelData | null>(null);

  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [inputValue, setInputValue] = useState('');
  const [answered, setAnswered] = useState(false);
  const [myResult, setMyResult] = useState<boolean | null>(null);
  const answeredRef = useRef(false);
  const forceAdvanceCalledRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to duel
  useEffect(() => {
    const unsub = subscribeToDuel(duelId, (data) => {
      setDuel(data);
      duelRef.current = data;
      if (data.status === 'finished') {
        navigation.replace('DuelResult', { duelId, myUid });
      }
    });
    return unsub;
  }, [duelId]);

  const opponentUid = duel?.playerIds.find(id => id !== myUid) ?? '';
  const opponentUidRef = useRef('');
  useEffect(() => { opponentUidRef.current = opponentUid; }, [opponentUid]);

  // Reset state & start timer when question changes
  const questionStartedAtMs = duel?.questionStartedAt
    ? (duel.questionStartedAt as any).toMillis?.() ?? null
    : null;

  useEffect(() => {
    if (!questionStartedAtMs || duel?.status !== 'in_progress') return;

    answeredRef.current = false;
    forceAdvanceCalledRef.current = false;
    setAnswered(false);
    setMyResult(null);
    setInputValue('');

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - questionStartedAtMs) / 1000;
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current!);
        const opp = opponentUidRef.current;
        const current = duelRef.current;
        if (!current || !opp) return;

        const idx = current.currentQuestionIndex;
        const myAnswers = current.answers?.[myUid] ?? [];
        const iAnswered = myAnswers.length > idx;

        if (!iAnswered && !answeredRef.current) {
          // Auto-submit forfeit
          handleSubmit('', true);
        } else if (iAnswered) {
          // I answered but opponent didn't — force advance
          if (!forceAdvanceCalledRef.current) {
            forceAdvanceCalledRef.current = true;
            forceAdvanceDuel(duelId, myUid, opp).catch(console.error);
          }
        }
      }
    }, 100);

    setTimeout(() => inputRef.current?.focus(), 200);

    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [questionStartedAtMs, duel?.currentQuestionIndex]);

  const handleSubmit = async (text: string, isForfeit = false) => {
    if (answeredRef.current) return;
    answeredRef.current = true;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    inputRef.current?.blur();
    setAnswered(true);

    const current = duelRef.current;
    if (!current) return;

    const startMs = (current.questionStartedAt as any)?.toMillis?.() ?? Date.now();
    const timeMs = isForfeit ? QUESTION_TIME * 1000 : Date.now() - startMs;
    const question = current.questions[current.currentQuestionIndex];
    const isCorrect = isForfeit ? false : isAnswerCorrect(text, question.reponses_acceptees);

    setMyResult(isCorrect);

    try {
      await submitDuelAnswer(duelId, myUid, opponentUidRef.current, isCorrect, timeMs);
    } catch (e) {
      console.error(e);
    }
  };

  if (!duel || duel.status === 'waiting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C2557D" size="large" />
      </View>
    );
  }

  const idx = duel.currentQuestionIndex;
  const question = duel.questions[idx];
  const me = duel.players[myUid];
  const opponent = duel.players[opponentUid];
  const myScore = duel.scores?.[myUid] ?? 0;
  const oppScore = duel.scores?.[opponentUid] ?? 0;
  const oppAnswers: DuelAnswer[] = duel.answers?.[opponentUid] ?? [];
  const opponentAnsweredCurrent = oppAnswers.length > idx;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        {/* Moi */}
        <View style={styles.playerSide}>
          <View style={[styles.avatar, { backgroundColor: avatarColor(me?.displayName ?? '') }]}>
            <Text style={styles.avatarText}>{(me?.displayName?.[0] ?? '?').toUpperCase()}</Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>{me?.displayName ?? 'Moi'}</Text>
            <Text style={styles.playerElo}>
              {getEloLevel(me?.elo ?? 1000).name} · {me?.elo ?? 1000} ELO
            </Text>
          </View>
          <Text style={styles.playerScore}>{myScore}</Text>
        </View>

        {/* Timer + question counter */}
        <View style={styles.centerBlock}>
          <MiniTimer timeLeft={timeLeft} />
          <Text style={styles.questionCounter}>{idx + 1} / {duel.questions.length}</Text>
        </View>

        {/* Adversaire */}
        <View style={[styles.playerSide, styles.playerSideRight]}>
          <Text style={styles.playerScore}>{oppScore}</Text>
          <View style={[styles.playerInfo, { alignItems: 'flex-end' }]}>
            <Text style={styles.playerName} numberOfLines={1}>{opponent?.displayName ?? '...'}</Text>
            <Text style={styles.playerElo}>
              {opponent ? `${getEloLevel(opponent.elo).name} · ${opponent.elo} ELO` : ''}
            </Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: avatarColor(opponent?.displayName ?? '') }]}>
            <Text style={styles.avatarText}>{(opponent?.displayName?.[0] ?? '?').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Statut adversaire */}
      <View style={styles.oppStatus}>
        {opponentAnsweredCurrent ? (
          <>
            <View style={styles.oppStatusDot} />
            <Text style={styles.oppStatusText}>Adversaire a répondu ✓</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={styles.oppStatusText}>Adversaire réfléchit...</Text>
          </>
        )}
      </View>

      {/* Carte question */}
      <ScrollView
        style={styles.questionScroll}
        contentContainerStyle={styles.questionScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>QUESTION {idx + 1}</Text>
          <Text style={styles.questionText}>{question?.question}</Text>
        </View>

        {/* Résultat */}
        {answered && myResult !== null && (
          <View style={[styles.resultRow, myResult ? styles.resultCorrect : styles.resultWrong]}>
            <View style={[styles.resultIcon, myResult ? styles.resultIconCorrect : styles.resultIconWrong]}>
              <Ionicons name={myResult ? 'checkmark' : 'close'} size={20} color={myResult ? '#10B981' : '#EF4444'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, myResult ? styles.resultTitleCorrect : styles.resultTitleWrong]}>
                {myResult ? 'Bonne réponse !' : 'Mauvaise réponse'}
              </Text>
              {!myResult && question?.reponses_acceptees?.[0] && (
                <Text style={styles.resultAnswer}>
                  Réponse : <Text style={{ fontWeight: '700' }}>{question.reponses_acceptees[0]}</Text>
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Zone réponse — juste sous la question */}
        {!answered && (
          <TouchableOpacity
            style={styles.answerCard}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={1}
          >
            <TextInput
              ref={inputRef}
              style={styles.answerInput}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Ta réponse..."
              placeholderTextColor="#C4C9D4"
              returnKeyType="done"
              onSubmitEditing={() => handleSubmit(inputValue)}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!answered}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => handleSubmit(inputValue)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {answered && (
          <View style={styles.waitNextBox}>
            <ActivityIndicator size="small" color="#9CA3AF" />
            <Text style={styles.waitNextText}>
              {opponentAnsweredCurrent ? 'Passage à la prochaine question...' : 'En attente de l\'adversaire...'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F4F8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  playerSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerSideRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  playerElo: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 1 },
  playerScore: { fontSize: 20, fontWeight: '900', color: '#C2557D' },

  centerBlock: { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  timerWrap: { position: 'relative', width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  timerText: { position: 'absolute', fontSize: 11, fontWeight: '800', color: '#374151' },
  timerTextLow: { color: '#EF4444' },
  questionCounter: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  oppStatus: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 8,
  },
  oppStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  oppStatusText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  questionScroll: { flex: 1 },
  questionScrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },

  questionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  questionLabel: {
    fontSize: 11, fontWeight: '800', color: '#9CA3AF',
    letterSpacing: 1.5, textAlign: 'center', marginBottom: 14,
  },
  questionText: {
    fontSize: 20, fontWeight: '700', color: '#1F2937',
    lineHeight: 30, textAlign: 'center',
  },

  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  resultCorrect: { backgroundColor: '#F0FDF4' },
  resultWrong: { backgroundColor: '#FFF5F5' },
  resultIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  resultIconCorrect: { backgroundColor: '#DCFCE7' },
  resultIconWrong: { backgroundColor: '#FEE2E2' },
  resultTitle: { fontSize: 15, fontWeight: '800' },
  resultTitleCorrect: { color: '#10B981' },
  resultTitleWrong: { color: '#EF4444' },
  resultAnswer: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },

  waitNextBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  waitNextText: { fontSize: 13, color: '#9CA3AF' },

  answerCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 16,
    paddingHorizontal: 18, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  answerInput: { flex: 1, color: '#1F2937', fontSize: 16, paddingVertical: 14 },
  submitBtn: {
    backgroundColor: '#C2557D', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
});
