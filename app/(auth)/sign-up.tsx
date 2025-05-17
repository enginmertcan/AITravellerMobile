import { StyleSheet, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import * as React from 'react';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignUp, useSignIn, useAuth, useOAuth } from '@clerk/clerk-expo';
import { router, Redirect } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import Constants from 'expo-constants';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppStyles from '@/constants/AppStyles';
import * as Linking from 'expo-linking';

// Tamamen yeni bir yaklaşımla WebBrowser yapılandırması
WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  useWarmUpBrowser();
  const { isSignedIn, isLoaded } = useAuth();
  const { signUp, setActive } = useSignUp();
  const { signIn } = useSignIn();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? AppStyles.colors.dark : AppStyles.colors.light;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Kullanıcı zaten giriş yapmışsa, tabs'a yönlendir
  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  // CLERK DOKÜMANLARINDAKİ ÖNERİLEN YAKLAŞIM
  const REDIRECT_URL = Linking.createURL('oauth-callback');
  
  // Sadeleştirilmiş OAuth hook'ları
  const { startOAuthFlow: googleAuth } = useOAuth({ strategy: "oauth_google", redirectUrl: REDIRECT_URL });
  const { startOAuthFlow: githubAuth } = useOAuth({ strategy: "oauth_github", redirectUrl: REDIRECT_URL });
  const { startOAuthFlow: facebookAuth } = useOAuth({ strategy: "oauth_facebook", redirectUrl: REDIRECT_URL });

  // Basitleştirilmiş OAuth işleme fonksiyonu
  const handleOAuthSignIn = async (
    strategy: "oauth_google" | "oauth_github" | "oauth_facebook"
  ) => {
    try {
      setOauthLoading(true);
      
      // Doğru OAuth işleyicisini seç
      let authFunction;
      if (strategy === "oauth_google") {
        authFunction = googleAuth;
      } else if (strategy === "oauth_github") {
        authFunction = githubAuth;
      } else {
        authFunction = facebookAuth;
      }
      
      const strategyName = strategy === "oauth_google" 
        ? "Google" 
        : strategy === "oauth_github" 
          ? "GitHub" 
          : "Facebook";
      
      // Teknik olarak provider adını çıkar
      const providerName = strategy.replace('oauth_', '');
          
      console.log(`${strategyName} ile giriş başlatılıyor...`);
      console.log('Kullanılan redirect URL:', REDIRECT_URL);
      console.log('Provider:', providerName);
      
      // OAuth akışını başlat
      const result = await authFunction();
      
      // Sonucu kontrol et
      if (!result) {
        console.error("OAuth result is undefined");
        Alert.alert("Hata", `${strategyName} ile giriş yapılamadı. Sonuç alınamadı.`);
        return;
      }

      // Gerçek strateji bilgisini logla
      if (result.signIn?.firstFactorVerification?.strategy) {
        console.log("Doğrulanan strateji:", result.signIn.firstFactorVerification.strategy);
      }
      
      const { createdSessionId, setActive } = result;
      
      console.log("OAuth sonucu:", JSON.stringify(result, null, 2));
      
      if (createdSessionId && setActive) {
        // Oturumu etkinleştir
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      } else if (result.authSessionResult?.type === "success") {
        // URL'den oturum kimliği çıkarıp oauth-callback sayfasına yönlendir
        console.log(`OAuth callback sayfasına yönlendiriliyor...`);
        router.push({
          pathname: "/(auth)/oauth-callback",
          params: { 
            url: result.authSessionResult.url
          }
        });
      } else {
        console.error(`${strategyName} oturumu oluşturulamadı`);
        // Kullanıcı tarayıcıda işlemi tamamlamadıysa veya bir hata oluştuysa
        Alert.alert(
          "Bilgi", 
          `${strategyName} ile giriş işlemi tamamlanamadı. Tarayıcıda kimlik doğrulama işlemini tamamlayın veya tekrar deneyin.`,
          [
            { text: "Tamam", style: "default" }
          ]
        );
      }
    } catch (err: any) {
      console.error("OAuth error:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      
      let errorMessage = "Giriş yapılırken bir hata oluştu.";
      
      if (err && err.message) {
        errorMessage += "\n\n" + err.message;
      }
      
      if (err && err.errors && err.errors.length > 0) {
        errorMessage += "\n\n" + err.errors[0].message;
      }
      
      Alert.alert("Hata", errorMessage);
    } finally {
      setOauthLoading(false);
    }
  };

  const onSignUpWithGoogle = () => handleOAuthSignIn("oauth_google");
  const onSignUpWithGitHub = () => handleOAuthSignIn("oauth_github");
  const onSignUpWithFacebook = () => handleOAuthSignIn("oauth_facebook");

  const onSignUp = async () => {
    if (!signUp || !setActive) {
      Alert.alert('Hata', 'Kimlik doğrulama servisi başlatılamadı.');
      return;
    }

    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    try {
      setLoading(true);
      const result = await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      // Email doğrulama kodu gönderildi
      await result.prepareEmailAddressVerification({ strategy: "email_code" });

      // Doğrulama kodunu girmesi için kullanıcıyı yönlendir
      router.push({
        pathname: "/(auth)/verify-email",
        params: { email }
      });

    } catch (err: any) {
      Alert.alert(
        'Hata',
        err.errors?.[0]?.message || 'Kayıt olurken bir hata oluştu.'
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
              <MaterialCommunityIcons name="account-plus" size={36} color="#fff" />
            </View>
            <View style={styles.textContainer}>
              <ThemedText style={styles.title}>Hesap Oluştur</ThemedText>
              <ThemedText style={styles.subtitle}>
                AI Traveller'a hoş geldiniz
              </ThemedText>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.content, { backgroundColor: theme.card }]}>
          <ThemedText style={styles.formTitle}>Kayıt Ol</ThemedText>

          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="person-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Ad"
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="people-outline" size={22} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Soyad"
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor={theme.textMuted}
              />
            </View>

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
            style={[styles.button, styles.signUpButton]}
            onPress={onSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={22} color="#fff" style={styles.buttonIcon} />
                <ThemedText style={styles.buttonText}>
                  Kayıt Ol
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
            onPress={onSignUpWithGoogle}
          >
            <Ionicons name="logo-google" size={22} color="#fff" style={styles.buttonIcon} />
            <ThemedText style={styles.buttonText}>
              Google ile Devam Et
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.githubButton]}
            onPress={onSignUpWithGitHub}
          >
            <Ionicons name="logo-github" size={22} color="#fff" style={styles.buttonIcon} />
            <ThemedText style={styles.buttonText}>
              GitHub ile Devam Et
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.facebookButton]}
            onPress={onSignUpWithFacebook}
          >
            <Ionicons name="logo-facebook" size={22} color="#fff" style={styles.buttonIcon} />
            <ThemedText style={styles.buttonText}>
              Facebook ile Devam Et
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <ThemedText style={styles.signInText}>
              Zaten hesabınız var mı? <ThemedText style={styles.signInTextBold}>Giriş yapın</ThemedText>
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
  buttonIcon: {
    marginRight: 12,
  },
  signUpButton: {
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signInLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 16,
  },
  signInTextBold: {
    fontWeight: 'bold',
    color: '#4c669f',
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
  }
});