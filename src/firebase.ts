import {initializeApp} from 'firebase/app';
import {initializeAuth, getReactNativePersistence} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import {getStorage} from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config do projeto: ai-studio-applet-webapp-91ce3
const firebaseConfig = {
  projectId: 'ai-studio-applet-webapp-91ce3',
  appId: '1:811737645595:web:15713b0e1aeca0053baebe',
  apiKey: 'AIzaSyAzs1U2O77Jxz6fD0IDpQjlyh_SA8XdL0M',
  authDomain: 'ai-studio-applet-webapp-91ce3.firebaseapp.com',
  storageBucket: 'ai-studio-applet-webapp-91ce3.firebasestorage.app',
  messagingSenderId: '811737645595',
};

// ID do banco Firestore customizado
const FIRESTORE_DATABASE_ID = 'ai-studio-17c1e69d-5bc9-4943-b15e-b17fa5fd8f58';

const app = initializeApp(firebaseConfig);

// Auth com persistência nativa (AsyncStorage em vez de localStorage)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore com database ID customizado
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

export const storage = getStorage(app);
