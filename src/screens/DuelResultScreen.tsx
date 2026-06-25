import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { subscribeToDuel } from '../utils/duel';
import { getEloLevel } from '../utils/eloLevels';
import { DuelData, DuelAnswer } from '../types/duel';

const AVATAR_COLORS = ['#C2557D', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function DuelResultScreen({ route, navigation }: { route: any; navigation: any }) {
  const { duelId, myUid } = route.params as { duelId: string; myUid: string };
  const [duel, setDuel] = useState<DuelData | null>(null);

  useEffect(() => {
    const unsub = subscribeToDuel(duelId, setDuel);
    return unsub;
  }, [duelId]);

  if (!duel) return null;

  const opponentUid = duel.playerIds.find(id => id !== myUid) ?? '';
  const me = duel.players[myUid];
  const opponent = duel.players[opponentUid];
  const myScore = duel.scores?.[myUid] ?? 0;
  const oppScore = duel.scores?.[opponentUid] ?? 0;
  const winner = duel.winner;
  const iWon = winner === myUid;
  const isDraw = winner === 'draw';

  const myAnswers: DuelAnswer[] = duel.answers?.[myUid] ?? [];
  const oppAnswers: DuelAnswer[] = duel.answers?.[opponentUid] ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Résultat global */}
        <View style={styles.resultHeader}>
          <Text style={styles.resultEmoji}>
            {isDraw ? '🤝' : iWon ? '🏆' : '😔'}
          </Text>
          <Text style={styles.resultTitle}>
            {isDraw ? 'Égalité !' : iWon ? 'Victoire !' : 'Défaite'}
          </Text>
          <Text style={styles.resultSub}>
            {isDraw ? 'Vous avez fait le même score' : iWon ? 'Tu as battu ton adversaire !' : `${opponent?.displayName ?? 'Adversaire'} a gagné`}
          </Text>
        </View>

        {/* Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreSide}>
            <View style={[styles.scoreAvatar, { backgroundColor: avatarColor(me?.displayName ?? '') }]}>
              <Text style={styles.scoreAvatarText}>{(me?.displayName?.[0] ?? '?').toUpperCase()}</Text>
            </View>
            <Text style={styles.scoreName} numberOfLines={1}>{me?.displayName ?? 'Moi'}</Text>
            <Text style={styles.scoreLevel}>
              {getEloLevel(me?.elo ?? 1000).name}
            </Text>
            <Text style={styles.scoreElo}>{me?.elo ?? 1000} ELO</Text>
            <Text style={[styles.scoreValue, iWon && styles.scoreValueWinner]}>{myScore}</Text>
          </View>

          <View style={styles.scoreDivider}>
            <Text style={styles.scoreVs}>vs</Text>
          </View>

          <View style={[styles.scoreSide, styles.scoreSideRight]}>
            <View style={[styles.scoreAvatar, { backgroundColor: avatarColor(opponent?.displayName ?? '') }]}>
              <Text style={styles.scoreAvatarText}>{(opponent?.displayName?.[0] ?? '?').toUpperCase()}</Text>
            </View>
            <Text style={styles.scoreName} numberOfLines={1}>{opponent?.displayName ?? 'Adversaire'}</Text>
            <Text style={styles.scoreLevel}>
              {opponent ? getEloLevel(opponent.elo).name : ''}
            </Text>
            <Text style={styles.scoreElo}>{opponent?.elo ?? '—'} ELO</Text>
            <Text style={[styles.scoreValue, !iWon && !isDraw && styles.scoreValueWinner]}>{oppScore}</Text>
          </View>
        </View>

        {/* Détail par question */}
        <Text style={styles.sectionTitle}>DÉTAIL DES QUESTIONS</Text>

        {duel.questions.map((q, i) => {
          const myA = myAnswers[i];
          const oppA = oppAnswers[i];
          return (
            <View key={q.id} style={styles.questionRow}>
              <View style={styles.questionRowHeader}>
                <Text style={styles.questionRowNum}>Q{i + 1}</Text>
                <Text style={styles.questionRowText} numberOfLines={2}>{q.question}</Text>
              </View>
              <Text style={styles.correctAnswer}>✓ {q.reponses_acceptees[0]}</Text>
              <View style={styles.answersRow}>
                <View style={[styles.answerBadge, myA?.isCorrect ? styles.answerBadgeCorrect : styles.answerBadgeWrong]}>
                  <Ionicons
                    name={myA?.isCorrect ? 'checkmark' : myA?.forfeit ? 'time-outline' : 'close'}
                    size={12}
                    color={myA?.isCorrect ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[styles.answerBadgeText, myA?.isCorrect ? styles.answerBadgeTextCorrect : styles.answerBadgeTextWrong]}>
                    {me?.displayName ?? 'Moi'} {myA ? `(${(myA.timeMs / 1000).toFixed(1)}s)` : '—'}
                  </Text>
                </View>
                <View style={[styles.answerBadge, oppA?.isCorrect ? styles.answerBadgeCorrect : styles.answerBadgeWrong]}>
                  <Ionicons
                    name={oppA?.isCorrect ? 'checkmark' : oppA?.forfeit ? 'time-outline' : 'close'}
                    size={12}
                    color={oppA?.isCorrect ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[styles.answerBadgeText, oppA?.isCorrect ? styles.answerBadgeTextCorrect : styles.answerBadgeTextWrong]}>
                    {opponent?.displayName ?? 'Adversaire'} {oppA ? `(${(oppA.timeMs / 1000).toFixed(1)}s)` : '—'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Actions */}
        <TouchableOpacity
          style={styles.replayBtn}
          onPress={() => navigation.navigate('DuelHome')}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.replayBtnText}>Nouveau duel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.navigate('DuelHome')}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>Fermer</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 16 },

  resultHeader: { alignItems: 'center', gap: 8, marginBottom: 4 },
  resultEmoji: { fontSize: 56 },
  resultTitle: { fontSize: 32, fontWeight: '900', color: '#1F2937' },
  resultSub: { fontSize: 15, color: '#6B7280', textAlign: 'center' },

  scoreCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  scoreSide: { flex: 1, alignItems: 'center', gap: 8 },
  scoreSideRight: {},
  scoreAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  scoreName: { fontSize: 13, fontWeight: '700', color: '#1F2937', maxWidth: 90, textAlign: 'center' },
  scoreLevel: { fontSize: 12, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  scoreElo: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  scoreValue: { fontSize: 40, fontWeight: '900', color: '#9CA3AF' },
  scoreValueWinner: { color: '#C2557D' },
  scoreDivider: { paddingHorizontal: 16 },
  scoreVs: { fontSize: 16, fontWeight: '700', color: '#D1D5DB' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 2, textTransform: 'uppercase',
  },

  questionRow: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  questionRowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  questionRowNum: {
    fontSize: 11, fontWeight: '800', color: '#C2557D',
    backgroundColor: '#FDF2F8', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  questionRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 20 },
  correctAnswer: { fontSize: 13, color: '#10B981', fontWeight: '600' },

  answersRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  answerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1,
  },
  answerBadgeCorrect: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  answerBadgeWrong: { backgroundColor: '#FFF5F5', borderColor: '#FECACA' },
  answerBadgeText: { fontSize: 12, fontWeight: '600' },
  answerBadgeTextCorrect: { color: '#10B981' },
  answerBadgeTextWrong: { color: '#EF4444' },

  replayBtn: {
    backgroundColor: '#C2557D', borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#C2557D', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    marginTop: 8,
  },
  replayBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  closeBtn: { alignItems: 'center', paddingVertical: 8 },
  closeBtnText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
