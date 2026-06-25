import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.82;
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { EloLevel, ELO_LEVELS, getEloLevel } from '../utils/eloLevels';
import Mascotte from './Mascotte';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentLevel: EloLevel;
}

export default function LevelModal({ visible, onClose, currentLevel }: Props) {
  const [percents, setPercents] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<EloLevel>(currentLevel);

  useEffect(() => {
    if (!visible) return;
    setSelectedLevel(currentLevel);
    setLoading(true);
    const fetchStats = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(500)));
        const total = snap.docs.length;
        if (total === 0) { setPercents({}); return; }
        const counts: Record<number, number> = {};
        ELO_LEVELS.forEach(l => { counts[l.id] = 0; });
        snap.docs.forEach(d => {
          const elo = (d.data().elo as number) ?? 1000;
          const lvl = getEloLevel(elo);
          counts[lvl.id] = (counts[lvl.id] ?? 0) + 1;
        });
        const result: Record<number, number> = {};
        ELO_LEVELS.forEach(l => {
          result[l.id] = Math.round((counts[l.id] / total) * 100);
        });
        setPercents(result);
      } catch {
        setPercents({});
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Palier affiché */}
          <View style={styles.currentBlock}>
            <Mascotte level={selectedLevel} size="medium" />
            <Text style={styles.currentName}>{selectedLevel.name}</Text>
            <Text style={styles.currentRange}>
              {selectedLevel.elo_min} – {selectedLevel.elo_max} ELO
            </Text>
            {loading ? (
              <ActivityIndicator color="#C2557D" style={{ marginTop: 10 }} />
            ) : percents[selectedLevel.id] !== undefined ? (
              <View style={styles.statBadge}>
                <Text style={styles.statText}>
                  {percents[selectedLevel.id]}% des joueurs inscrits sont à ce palier
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.separator} />

          {/* Liste de tous les paliers */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {ELO_LEVELS.map(level => {
              const isActive = level.id === currentLevel.id;
              const isSelected = level.id === selectedLevel.id;
              return (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.row, isActive && styles.rowActive, isSelected && !isActive && styles.rowSelected]}
                  onPress={() => setSelectedLevel(level)}
                  activeOpacity={0.7}
                >
                  <Mascotte level={level} size="small" />
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, isActive && styles.rowNameActive]}>
                      {level.name}
                    </Text>
                    <Text style={styles.rowRange}>
                      {level.elo_min} – {level.elo_max} ELO
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color="#C2557D" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 28,
    paddingBottom: 40,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  currentBlock: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  currentName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 14,
    marginBottom: 4,
  },
  currentRange: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  statBadge: {
    backgroundColor: '#FDF2F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FBCFE8',
    marginTop: 4,
  },
  statText: {
    color: '#C2557D',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  rowActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  rowSelected: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  rowNameActive: { color: '#C2557D', fontWeight: '700' },
  rowRange: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});
