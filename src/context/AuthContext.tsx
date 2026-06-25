import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, refreshUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // Pas de session : on ouvre une session anonyme (technique, sans compte ni profil Firestore)
      // pour ne jamais bloquer l'utilisateur sur l'écran de connexion au premier lancement.
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error(err);
          setUser(null);
          setLoading(false);
        }
        return; // onAuthStateChanged sera redéclenché avec le nouvel utilisateur anonyme
      }

      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshUser = () => {
    if (auth.currentUser) setUser({ ...auth.currentUser });
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
