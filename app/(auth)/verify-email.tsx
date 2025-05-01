import { StyleSheet, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useSignUp } from '@clerk/clerk-expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

export default function VerifyEmailScreen() {
  const { signUp, setActive } = useSignUp();
  const { email } = useLocalSearchParams();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    if (!code) {
      Alert.alert('Hata', 'Lütfen doğrulama kodunu girin.');
      return;
    }

    try {
      setLoading(true);

      const completeSignUp = await signUp?.attemptEmailAddressVerification({
        code,
      });

      await setActive({ session: completeSignUp.createdSessionId });
      // Navigasyon işlemini setTimeout içinde yaparak, bileşenin monte edilmesini bekleyelim
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 0);
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err.errors?.[0]?.message || 'Doğrulama sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      await signUp?.prepareEmailAddressVerification({ strategy: "email_code" });
      Alert.alert('Başarılı', 'Yeni doğrulama kodu gönderildi.');
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err.errors?.[0]?.message || 'Kod gönderilirken bir hata oluştu.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <ThemedText style={styles.title}>E-posta Doğrulama</ThemedText>
        <ThemedText style={styles.subtitle}>
          {email} adresine gönderilen doğrulama kodunu girin
        </ThemedText>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Doğrulama Kodu"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholderTextColor="#666"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.verifyButton]}
          onPress={onVerify}
          disabled={loading}
        >
          <ThemedText style={styles.buttonText}>
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendLink}
          onPress={resendCode}
        >
          <ThemedText style={styles.resendText}>
            Kodu tekrar gönder
          </ThemedText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: '#4c669f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resendLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: '#4c669f',
    fontSize: 16,
  },
});