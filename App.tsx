import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import AuthScreen from './src/screens/AuthScreen';
import FeedScreen from './src/screens/FeedScreen';
import FlashCardsScreen from './src/screens/FlashCardsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DuelHomeScreen from './src/screens/DuelHomeScreen';
import DuelLobbyScreen from './src/screens/DuelLobbyScreen';
import DuelGameScreen from './src/screens/DuelGameScreen';
import DuelResultScreen from './src/screens/DuelResultScreen';
import StreakWelcomeModal from './src/components/StreakWelcomeModal';
import { getGuestProfile } from './src/utils/guestProfile';
import { defaultStreak, getActiveStreak } from './src/utils/streak';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const DuelStack = createNativeStackNavigator();

function getActiveRoute(route: any): string {
  if (!route?.state) return route?.name ?? '';
  const nested = route.state.routes[route.state.index ?? 0];
  return getActiveRoute(nested);
}

const DUEL_FULLSCREEN = ['DuelLobby', 'DuelGame', 'DuelResult'];

function DuelNavigator() {
  return (
    <DuelStack.Navigator screenOptions={{ headerShown: false }}>
      <DuelStack.Screen name="DuelHome" component={DuelHomeScreen} />
      <DuelStack.Screen name="DuelLobby" component={DuelLobbyScreen} />
      <DuelStack.Screen name="DuelGame" component={DuelGameScreen} />
      <DuelStack.Screen name="DuelResult" component={DuelResultScreen} />
    </DuelStack.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const [streakWelcome, setStreakWelcome] = useState<{ current: number; best: number } | null>(null);

  const tabBarStyle = {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F3F4F6',
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  };

  // Vérification légère (sans toucher aux questions) pour afficher la série à CHAQUE
  // ouverture de l'app : au lancement à froid, et à chaque retour au premier plan.
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const showStreak = async () => {
      if (!user) return;

      let streak = defaultStreak();
      if (user.isAnonymous) {
        const guest = await getGuestProfile();
        streak = guest.streak ?? defaultStreak();
      } else {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) streak = userDoc.data().streak ?? defaultStreak();
      }

      setStreakWelcome({ current: getActiveStreak(streak), best: streak.best });
    };

    showStreak();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        showStreak();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [user?.uid]);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle,
          tabBarActiveTintColor: '#C2557D',
          tabBarInactiveTintColor: '#9CA3AF',
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Feed"
          component={FeedScreen}
          options={{
            tabBarLabel: 'Quiz',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flash" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Duels"
          component={DuelNavigator}
          options={({ route }) => ({
            tabBarLabel: 'Duels',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flash-outline" size={size} color={color} />
            ),
            tabBarStyle: DUEL_FULLSCREEN.includes(getActiveRoute(route))
              ? { display: 'none' }
              : tabBarStyle,
          })}
        />
        <Tab.Screen
          name="FlashCards"
          component={FlashCardsScreen}
          options={{
            tabBarLabel: 'Révisions',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="albums-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Leaderboard"
          component={LeaderboardScreen}
          options={{
            tabBarLabel: 'Classement',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {streakWelcome && (
        <StreakWelcomeModal
          visible={true}
          streakCount={streakWelcome.current}
          bestCount={streakWelcome.best}
          onClose={() => setStreakWelcome(null)}
        />
      )}
    </>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator color="#F59E0B" size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SubscriptionProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
