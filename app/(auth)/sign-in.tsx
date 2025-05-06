import { StyleSheet, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { router, Redirect } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const { isSignedIn } = useAuth();
  const { signIn, setActive } = useSignIn();

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
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#4c669f', '#3b5998', '#192f6a']}
          style={styles.header}
        >
          <ThemedText style={styles.title}>AI Traveller</ThemedText>
          <ThemedText style={styles.subtitle}>
            Yapay zeka destekli seyahat planlayıcınız
          </ThemedText>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#666"
            />
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#666"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.emailButton]}
            onPress={onSignInWithEmail}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? 'Giriş yapılıyor...' : 'E-posta ile Giriş Yap'}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>veya</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={onSignInWithGoogle}
          >
            <Ionicons name="logo-google" size={24} color="#fff" style={styles.buttonIcon} />
            <ThemedText style={styles.buttonText}>
              Google ile Giriş Yap
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signUpLink}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <ThemedText style={styles.signUpText}>
              Hesabınız yok mu? Hemen kaydolun
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
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 32,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -20,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#666',
  },
  signUpLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  signUpText: {
    color: '#4c669f',
    fontSize: 16,
  }
});