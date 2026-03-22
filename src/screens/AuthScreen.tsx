import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {auth} from '../firebase';
import {Colors, Radius, Spacing} from '../theme';

GoogleSignin.configure({
  webClientId: '811737645595-fpa5kks1r45j7i90a4rv4s2aq5um6rj3.apps.googleusercontent.com',
  offlineAccess: true,
});

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim()) {
      return setError('Informe seu e-mail.');
    }
    if (!isReset && !password.trim()) {
      return setError('Informe sua senha.');
    }
    setLoading(true);
    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        Toast.show({type: 'success', text1: 'E-mail de recuperação enviado!'});
        setIsReset(false);
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(
        userInfo.data?.idToken ?? '',
      );
      await signInWithCredential(auth, googleCredential);
    } catch (err: any) {
      setError('Erro ao entrar com Google. Tente novamente.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>C</Text>
            </View>
            <Text style={styles.appName}>Controle de Corte</Text>
            <Text style={styles.tagline}>
              {isReset
                ? 'Recuperar senha'
                : isLogin
                ? 'Bem-vindo de volta'
                : 'Crie sua conta'}
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputRow}>
              <Icon name="email-outline" size={20} color={Colors.zinc400} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={Colors.zinc400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {!isReset && (
              <>
                <Text style={[styles.label, {marginTop: Spacing.lg}]}>Senha</Text>
                <View style={styles.inputRow}>
                  <Icon name="lock-outline" size={20} color={Colors.zinc400} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.zinc400}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}>
                    <Icon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={Colors.zinc400}
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Icon
                    name={isReset ? 'key' : isLogin ? 'login' : 'account-plus'}
                    size={20}
                    color={Colors.white}
                  />
                  <Text style={styles.primaryBtnText}>
                    {isReset ? 'Enviar Link' : isLogin ? 'Entrar' : 'Cadastrar'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}>
              <Icon name="google" size={20} color="#EA4335" />
              <Text style={styles.googleText}>Entrar com Google</Text>
            </TouchableOpacity>

            <View style={styles.links}>
              {!isReset && (
                <TouchableOpacity onPress={() => setIsReset(true)}>
                  <Text style={styles.linkText}>Esqueceu a senha?</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  setIsLogin(!isLogin);
                  setIsReset(false);
                  setError('');
                }}>
                <Text style={styles.linkText}>
                  {isReset
                    ? 'Voltar para o login'
                    : isLogin
                    ? 'Não tem uma conta? Cadastre-se'
                    : 'Já tem uma conta? Entre'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'E-mail já cadastrado.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use ao menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    default:
      return 'Erro inesperado. Tente novamente.';
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: Spacing.xxl,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  header: {alignItems: 'center', marginBottom: Spacing.xxl},
  logoBox: {
    width: 56,
    height: 56,
    backgroundColor: Colors.zinc900,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {color: Colors.white, fontSize: 24, fontWeight: '800'},
  appName: {fontSize: 22, fontWeight: '800', color: Colors.zinc900, letterSpacing: -0.5},
  tagline: {fontSize: 14, color: Colors.zinc500, marginTop: 4},
  form: {},
  label: {fontSize: 13, fontWeight: '600', color: Colors.zinc700, marginBottom: 6},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.zinc50,
    borderWidth: 1,
    borderColor: Colors.zinc200,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
  },
  inputIcon: {marginRight: 8},
  input: {flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.zinc900},
  eyeBtn: {padding: 4},
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    marginTop: Spacing.md,
  },
  errorText: {color: Colors.red600, fontSize: 13},
  primaryBtn: {
    backgroundColor: Colors.zinc900,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xl,
  },
  primaryBtnText: {color: Colors.white, fontWeight: '700', fontSize: 15},
  googleBtn: {
    borderWidth: 1,
    borderColor: Colors.zinc200,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  googleText: {fontWeight: '600', color: Colors.zinc700, fontSize: 14},
  links: {alignItems: 'center', gap: 12, marginTop: Spacing.xl},
  linkText: {fontSize: 13, color: Colors.zinc500, fontWeight: '600'},
});
