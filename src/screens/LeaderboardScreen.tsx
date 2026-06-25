import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import AuthScreen from './AuthScreen';
import { getEloLevel } from '../utils/eloLevels';
import { CATEGORIES, UserProfile } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  Géographie: 'earth-outline',
  Histoire: 'book-outline',
  Sciences: 'flask-outline',
  Art: 'color-palette-outline',
  Littérature: 'library-outline',
  Culture: 'bulb-outline',
  Nature: 'leaf-outline',
  Musique: 'musical-notes-outline',
};


const AVATAR_COLORS = ['#C2557D', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

const TABS = ['Général', ...CATEGORIES];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Général');
  const [search, setSearch] = useState('');
  const [authVisible, setAuthVisible] = useState(false);

  const load = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('elo', 'desc'), limit(200));
      const snap = await getDocs(q);
      setPlayers(snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user?.isAnonymous) {
        setLoading(false);
        return;
      }
      setLoading(true);
      load();
    }, [user?.isAnonymous])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const getSorted = () => {
    if (activeTab === 'Général') return [...players].sort((a, b) => b.elo - a.elo);
    return [...players].sort((a, b) => {
      const eloA = a.eloByCategory?.[activeTab] ?? 1000;
      const eloB = b.eloByCategory?.[activeTab] ?? 1000;
      return eloB - eloA;
    });
  };

  const getElo = (p: UserProfile) =>
    activeTab === 'Général' ? p.elo : (p.eloByCategory?.[activeTab] ?? 1000);

  const sorted = getSorted();
  const myRank = sorted.findIndex((p) => p.uid === user?.uid) + 1;
  const me = sorted.find((p) => p.uid === user?.uid);
  const filtered = search.trim()
    ? sorted.filter((p) => p.displayName?.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  if (user?.isAnonymous) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="trophy-outline" size={40} color="#C2557D" />
          </View>
          <Text style={styles.lockedTitle}>Classement réservé aux comptes</Text>
          <Text style={styles.lockedSub}>
            Crée un compte gratuitement pour apparaître dans le classement et comparer ton ELO avec les autres joueurs.
          </Text>
          <TouchableOpacity style={styles.lockedBtn} onPress={() => setAuthVisible(true)} activeOpacity={0.85}>
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <Text style={styles.lockedBtnText}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
        <Modal visible={authVisible} animationType="none" transparent onRequestClose={() => setAuthVisible(false)}>
          <AuthScreen onClose={() => setAuthVisible(false)} initialMode="register" />
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>LEADERBOARD</Text>
        {me && (
          <View style={styles.myRankBadge}>
            <Text style={styles.myRankText}>#{myRank} · {getElo(me)} ELO</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un joueur..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* Category chips */}
      <View style={styles.chipRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const icon = tab === 'Général' ? 'trophy-outline' : CATEGORY_ICONS[tab];
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Ionicons name={icon as any} size={13} color={isActive ? '#FFFFFF' : '#6B7280'} />
              <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C2557D" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {search.trim() ? 'Aucun joueur trouvé.' : 'Aucun joueur pour l\'instant.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uid + activeTab}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C2557D" />
          }
          renderItem={({ item }) => {
            const rank = sorted.indexOf(item) + 1;
            const isMe = item.uid === user?.uid;
            const level = getEloLevel(getElo(item));
            const initials = (item.displayName ?? '?')[0].toUpperCase();
            const color = avatarColor(item.displayName ?? '');
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <Text style={styles.rankNum}>
                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                </Text>
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: color }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.nameBlock}>
                  <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                    {item.displayName}{isMe ? ' (moi)' : ''}
                  </Text>
                  <Text style={styles.levelLabel}>{level.name}</Text>
                </View>
                <Text style={[styles.elo, isMe && styles.eloMe]}>{getElo(item)}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2937', letterSpacing: 0.5 },
  myRankBadge: {
    backgroundColor: '#FDF2F8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  myRankText: { color: '#C2557D', fontSize: 13, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: '#1F2937',
    paddingVertical: 11,
    fontSize: 15,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#C2557D',
    borderColor: '#C2557D',
  },
  chipLabel: { color: '#6B7280', fontSize: 12, fontWeight: '600', marginLeft: 5 },
  chipLabelActive: { color: '#FFFFFF' },

  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  rowMe: {
    borderColor: '#FBCFE8',
    backgroundColor: '#FEF0F6',
  },
  rankNum: { fontSize: 15, fontWeight: '700', color: '#6B7280', width: 36, textAlign: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nameBlock: { flex: 1 },
  name: { color: '#1F2937', fontSize: 15, fontWeight: '500' },
  nameMe: { color: '#C2557D', fontWeight: '700' },
  levelLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 1 },
  elo: { color: '#1F2937', fontSize: 16, fontWeight: '800' },
  eloMe: { color: '#C2557D' },
  emptyText: { color: '#9CA3AF', fontSize: 15 },

  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FBCFE8',
  },
  lockedTitle: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  lockedSub: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C2557D',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lockedBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
