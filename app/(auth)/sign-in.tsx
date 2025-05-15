import { StyleSheet, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, StatusBar } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { router, Redirect } from 'expo-router';
import { useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import Constants from 'expo-constants';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppStyles from '@/constants/AppStyles';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const { isSignedIn } = useAuth();
  const { signIn, setActive } = useSignIn();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? AppStyles.colors.dark : AppStyles.colors.light;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Kullanıcı zaten giriş yapmışsa, tabs'a yönlendir
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  const onSignInWithGoogle = async () => {
    if (!signIn || !setActive) {
      Alert.alert('Hata', 'Kimlik doğrulama servisi başlatılamadı.');
      return;
    }

    try {
      const redirectUrl = `${Constants.expoConfig?.scheme}://oauth-native-callback`;

      const completeSignIn = await signIn.create({
        strategy: "oauth_google",
        redirectUrl,
      });

      // Tip dönüşümü ile güvenli erişim
      const authUrl = (completeSignIn as any).firstFactorVerification?.verificationUrl ||
                     (completeSignIn as any).url ||
                     (completeSignIn as any).authorizeUrl;

      if (!authUrl) {
        throw new Error('Authentication URL not found');
      }

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl
      );

      if (result.type === 'success') {
        const { createdSessionId } = completeSignIn;
        if (createdSessionId) {
          await setActive({ session: createdSessionId });
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      Alert.alert('Hata', 'Google ile giriş yapılırken bir hata oluştu.');
    }
  };

  const onSignInWithEmail = async () => {
    if (!signIn || !setActive) {
      Alert.alert('Hata', 'Kimlik doğrulama servisi başlatılamadı.');
      return;
    }

    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen email ve şifrenizi girin.');
      return;
    }

    try {
      setLoading(true);
      const completeSignIn = await signIn.create({
        identifier: email,
        password,
      });

      if (completeSignIn.createdSessionId) {
        await setActive({ session: completeSignIn.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Email sign in error:', err);
      Alert.alert(
        'Hata',
        err.errors?.[0]?.message || 'Giriş yapılırken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#4c669f', '#3b5998', '#192f6a']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="airplane" size={36} color="#fff" />
            </View>
            <View style={styles.textContainer}>
              <ThemedText style={styles.title}>AI Traveller</ThemedText>
              <ThemedText style={styles.subtitle}>
                Yapay zeka destekli seyahat planlayıcınız
              </ThemedText>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <ThemedText style={styles.formTitle}>Giriş Yap</ThemedText>

          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="mail-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="E-posta"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="lock-closed-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={theme.textMuted}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.emailButton]}
            onPress={onSignInWithEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={22} color="#fff" style={styles.buttonIcon} />
                <ThemedText style={styles.buttonText}>
                  Giriş Yap
                </ThemedText>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textMuted }]}>veya</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={onSignInWithGoogle}
          >
            <Ionicons name="logo-google" size={22} color="#fff" style={styles.buttonIcon} />
            <ThemedText style={styles.buttonText}>
              Google ile Giriş Yap
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signUpLink}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <ThemedText style={styles.signUpText}>
              Hesabınız yok mu? <ThemedText style={styles.signUpTextBold}>Hemen kaydolun</ThemedText>
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    padding: 24,
    paddingTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emailButton: {
    backgroundColor: '#4c669f',
  },
  googleButton: {
    backgroundColor: '#db4437',
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  signUpLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  signUpText: {
    fontSize: 16,
  },
  signUpTextBold: {
    fontWeight: 'bold',
    color: '#4c669f',
  }
});