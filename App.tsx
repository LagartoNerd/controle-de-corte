import React, {useState, useEffect} from 'react';
import {View, ActivityIndicator, StyleSheet, StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {onAuthStateChanged, User} from 'firebase/auth';
import {doc, getDoc, setDoc, onSnapshot, updateDoc} from 'firebase/firestore';
import {auth, db} from './src/firebase';
import {UserProfile} from './src/types';
import {AppNavigator, linking} from './src/navigation/AppNavigator';
import {Colors} from './src/theme';
import {initAdMob, AppOpenAd} from './src/components/AdMob';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAdMob();
  }, []);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          await setDoc(userRef, {
            id: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || '',
            role: fbUser.email === 'bitcoinc3@gmail.com' ? 'admin' : 'user',
            plan: 'free',
            isBlocked: false,
            hasUsedTrial: false,
            createdAt: new Date().toISOString(),
          });
        } else {
          const d = snap.data();
          if (fbUser.email === 'bitcoinc3@gmail.com' && d.role !== 'admin') {
            await setDoc(userRef, {...d, role: 'admin'}, {merge: true});
          }
        }

        unsubProfile = onSnapshot(userRef, docSnap => {
          const handleSnapshot = async () => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;

              if (data.trialStartDate && data.trialPlan) {
                const diffDays = Math.ceil(
                  Math.abs(new Date().getTime() - new Date(data.trialStartDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                if (diffDays > 15) {
                  await updateDoc(userRef, {
                    plan: data.trialPlan,
                    trialStartDate: null,
                    trialPlan: null,
                    updatedAt: new Date().toISOString(),
                  });

                  Toast.show({
                    type: 'success',
                    text1: 'Assinatura ativada',
                    text2: `Plano ${data.trialPlan} ativado automaticamente.`,
                  });
                }
              }

              setProfile(data);
            }
          };

          handleSnapshot().catch(error => {
            console.error('Erro ao processar perfil:', error);
          });
        });

        setUser(fbUser);
      } else {
        setUser(null);
        setProfile(null);
        if (unsubProfile) unsubProfile();
      }

      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={Colors.zinc900} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      {user && <AppOpenAd profile={profile} />}
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <AppNavigator user={user} profile={profile} />
        </NavigationContainer>
      </SafeAreaProvider>
      <Toast />
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
