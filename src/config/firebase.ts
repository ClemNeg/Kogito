import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBO1JTex2ZC0gGhMZvxKTPFPFVV4fZzbKI',
  authDomain: 'quizi-870b9.firebaseapp.com',
  projectId: 'quizi-870b9',
  storageBucket: 'quizi-870b9.firebasestorage.app',
  messagingSenderId: '596160019981',
  appId: '1:596160019981:web:4244255ce44d8db6019f44',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
