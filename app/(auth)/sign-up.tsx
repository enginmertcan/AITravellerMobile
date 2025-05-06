import { StyleSheet, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignUp, useAuth } from '@clerk/clerk-expo';
import { router, Redirect } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function SignUpScreen() {
  const { isSignedIn } = useAuth();
  const { signUp, setActive } = useSignUp();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Kullanıcı zaten giriş yapmışsa, tabs'a yönlendir
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

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
          <ThemedText style={styles.title}>Hesap Oluştur</ThemedText>
          <ThemedText style={styles.subtitle}>
            AI Traveller'a hoş geldiniz
          </ThemedText>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ad"
              value={firstName}
              onChangeText={setFirstName}
              placeholderTextColor="#666"
            />
            <TextInput
              style={styles.input}
              placeholder="Soyad"
              value={lastName}
              onChangeText={setLastName}
              placeholderTextColor="#666"
            />
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
            style={[styles.button, styles.signUpButton]}
            onPress={onSignUp}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <ThemedText style={styles.signInText}>
              Zaten hesabınız var mı? Giriş yapın
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
  signUpButton: {
    backgroundColor: '#4c669f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signInLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  signInText: {
    color: '#4c669f',
    fontSize: 16,
  },
});