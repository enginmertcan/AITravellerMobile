import { StyleSheet, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, StatusBar } from 'react-native';
import * as React from 'react';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignIn, useAuth, useOAuth } from '@clerk/clerk-expo';
import { router, Redirect } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import Constants from 'expo-constants';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppStyles from '@/constants/AppStyles';
import * as Linking from 'expo-linking';

type OAuthProvider = 'google' | 'github' | 'facebook';
type OAuthStrategy = `oauth_${OAuthProvider}`;

// Tarayıcı oturumunu temizle
WebBrowser.maybeCompleteAuthSession();

// Custom hook to handle OAuth sign-in
const useOAuthSignIn = (strategy: OAuthStrategy) => {
  const [loading, setLoading] = useState(false);
  const redirectUrl = Linking.createURL('oauth-callback');
  
  const { startOAuthFlow } = useOAuth({ 
    strategy,
    redirectUrl,
  });

  const signIn = useCallback(async () => {
    try {
      setLoading(true);
      // Provider adını strateji adından çıkar (oauth_google -> google)
      const providerName = strategy.replace('oauth_', '');
      console.log(`${strategy} ile giriş başlatılıyor... (redirectUrl: ${redirectUrl})`);
      
      // OAuth akışını başlat
      const result = await startOAuthFlow();
      
      console.log('OAuth sonucu:', JSON.stringify(result, null, 2));
      
      // Gerçek strateji bilgisini logla
      if (result.signIn?.firstFactorVerification?.strategy) {
        console.log("Doğrulanan strateji:", result.signIn.firstFactorVerification.strategy);
      }
      
      const { createdSessionId, setActive } = result;
      
      if (createdSessionId && setActive) {
        console.log('Oturum etkinleştiriliyor:', createdSessionId);
        await setActive({ session: createdSessionId });
        router.replace('/(tabs)');
      } else if (result.authSessionResult?.type === "success") {
        // Oluşturulan OAuth yönlendirme URL'sini doğrudan işle
        const url = result.authSessionResult.url;
        
        // OAuth callback sayfasına yönlendir, parametreleri işlemesi için
        console.log(`OAuth callback sayfasına yönlendiriliyor...`);
        router.push({
          pathname: "/(auth)/oauth-callback",
          params: { 
            url: url
          }
        });
      } else {
        console.warn("OAuth akışı sırasında beklenen oturum oluşturulamadı:", result.authSessionResult?.type);
        throw new Error("Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      console.error(`${strategy} OAuth error:`, err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [strategy, startOAuthFlow]);

  return { signIn, loading };
};

export default function SignInScreen() {
  useWarmUpBrowser();
  const { signIn, setActive } = useSignIn();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? AppStyles.colors.dark : AppStyles.colors.light;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { isSignedIn, isLoaded } = useAuth();
  
  // Authentication errors
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Kullanıcı zaten giriş yapmışsa, tabs'a yönlendir
  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  // Initialize OAuth sign-in handlers
  const { signIn: googleSignIn, loading: googleLoading } = useOAuthSignIn('oauth_google');
  const { signIn: githubSignIn, loading: githubLoading } = useOAuthSignIn('oauth_github');
  const { signIn: facebookSignIn, loading: facebookLoading } = useOAuthSignIn('oauth_facebook');

  // Handle OAuth sign in with Google
  const handleGoogleSignIn = useCallback(async () => {
    try {
      setAuthError(null);
      await googleSignIn();
    } catch (err: any) {
      setAuthError(err.message || 'Google ile giriş yapılırken bir hata oluştu');
      console.error('Google sign in error:', err);
      Alert.alert('Hata', 'Google ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }, [googleSignIn]);

  // Handle OAuth sign in with GitHub
  const handleGithubSignIn = useCallback(async () => {
    try {
      setAuthError(null);
      await githubSignIn();
    } catch (err) {
      setAuthError('GitHub ile giriş yapılırken bir hata oluştu');
      Alert.alert('Hata', 'GitHub ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }, [githubSignIn]);

  // Handle OAuth sign in with Facebook
  const handleFacebookSignIn = useCallback(async () => {
    try {
      setAuthError(null);
      await facebookSignIn();
    } catch (err) {
      setAuthError('Facebook ile giriş yapılırken bir hata oluştu');
      Alert.alert('Hata', 'Facebook ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }, [facebookSignIn]);
  
  // Combine loading states
  const loading = googleLoading || githubLoading || facebookLoading || emailLoading;

  // OAuth buton işlevleri

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
      setEmailLoading(true);
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
      setEmailLoading(false);
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
            style={[styles.button, { backgroundColor: '#4c669f' }]}
            onPress={onSignInWithEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.buttonText}>
                Giriş Yap
              </ThemedText>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textMuted }]}>veya</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity 
            style={[styles.socialButton, { backgroundColor: theme.card }]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Image 
              source={require('@/assets/images/google-logo.png')} 
              style={styles.socialIcon} 
            />
            <ThemedText style={[styles.socialButtonText, { color: theme.text }]}>
              Google ile Giriş Yap
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.socialButton, { backgroundColor: theme.card }]}
            onPress={handleGithubSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-github" size={24} color={theme.text} style={styles.socialIcon} />
            <ThemedText style={[styles.socialButtonText, { color: theme.text }]}>
              GitHub ile Giriş Yap
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.socialButton, { backgroundColor: theme.card }]}
            onPress={handleFacebookSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-facebook" size={24} color="#1877F2" style={styles.socialIcon} />
            <ThemedText style={[styles.socialButtonText, { color: theme.text }]}>
              Facebook ile Giriş Yap
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
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  socialIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emailButton: {
    backgroundColor: '#4c669f',
  },
  googleButton: {
    backgroundColor: '#db4437',
  },
  githubButton: {
    backgroundColor: '#333',
  },
  facebookButton: {
    backgroundColor: '#3b5998',
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