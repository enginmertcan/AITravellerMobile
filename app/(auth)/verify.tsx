import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useState } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function VerifyScreen() {
  const { signUp, setActive } = useSignUp();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onVerifyPress = async () => {
    if (!signUp || !code) {
      alert("Lütfen doğrulama kodunu girin");
      return;
    }

    try {
      setLoading(true);
      console.log("Doğrulama başlatılıyor. Kod:", code);

      // E-posta doğrulama kodunu doğrula
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });

      console.log("Doğrulama yanıtı:", JSON.stringify(signUpAttempt, null, 2));

      if (signUpAttempt.status === "complete") {
        console.log("Doğrulama başarılı, oturum oluşturuluyor...");
        // Oturumu aktif et
        await setActive({ session: signUpAttempt.createdSessionId });
        console.log("Oturum aktif edildi, yönlendiriliyor...");
        router.replace("/(tabs)");
      } else {
        console.log("Doğrulama başarısız. Durum:", signUpAttempt.status);
        alert(`Doğrulama başarısız oldu. Durum: ${signUpAttempt.status}`);
      }
    } catch (err: any) {
      console.error("Doğrulama hatası detayı:", JSON.stringify(err, null, 2));
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].message;
        if (errorMessage.includes("code")) {
          alert("Geçersiz doğrulama kodu. Lütfen doğru kodu girdiğinizden emin olun.");
        } else {
          alert(errorMessage);
        }
      } else {
        alert("Doğrulama sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onResendPress = async () => {
    if (!signUp) return;

    try {
      console.log("Yeni doğrulama kodu isteniyor...");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      console.log("Yeni doğrulama kodu gönderildi");
      alert("Doğrulama kodu tekrar gönderildi. Lütfen e-postanızı kontrol edin.");
    } catch (err: any) {
      console.error("Kod gönderme hatası detayı:", JSON.stringify(err, null, 2));
      alert(err.errors?.[0]?.message || "Doğrulama kodu gönderilirken bir hata oluştu");
    }
  };

  return (
    <LinearGradient
      colors={['#4c669f', '#3b5998', '#192f6a']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="mail" size={64} color="#fff" />
          <Text style={styles.title}>E-posta Doğrulama</Text>
          <Text style={styles.subtitle}>
            E-posta adresinize gönderilen doğrulama kodunu girin
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="key-outline" size={20} color="#fff" style={styles.inputIcon} />
            <TextInput
              value={code}
              placeholder="Doğrulama Kodu"
              placeholderTextColor="#rgba(255, 255, 255, 0.7)"
              onChangeText={setCode}
              style={styles.input}
              keyboardType="number-pad"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onVerifyPress}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Doğrulanıyor..." : "Doğrula"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={onResendPress}
          >
            <Text style={styles.linkText}>
              Kodu tekrar gönder
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#4c669f",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 16,
  },
  linkText: {
    color: "#fff",
    fontSize: 14,
  },
}); 