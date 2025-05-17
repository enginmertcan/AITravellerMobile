import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth, useOAuth, useSignIn } from '@clerk/clerk-expo';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import AppStyles from '@/constants/AppStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

type OAuthStrategy = 'oauth_google' | 'oauth_github' | 'oauth_facebook';

export default function OAuthCallback() {
  const { isSignedIn, isLoaded } = useAuth(); 
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? AppStyles.colors.dark : AppStyles.colors.light;
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const segments = useSegments();
  
  // URL'den parametreleri al
  const params = useLocalSearchParams<{ 
    provider?: string,
    created_session_id?: string,
    rotating_token_nonce?: string,
    url?: string
  }>();

  // OAuth erişimini kullan - geliştirilmiş çoklu sağlayıcı desteğiyle
  const { startOAuthFlow: googleAuth } = useOAuth({ 
    strategy: "oauth_google", 
    redirectUrl: Linking.createURL('oauth-callback')
  });

  const { startOAuthFlow: githubAuth } = useOAuth({ 
    strategy: "oauth_github", 
    redirectUrl: Linking.createURL('oauth-callback')
  });

  const { startOAuthFlow: facebookAuth } = useOAuth({ 
    strategy: "oauth_facebook", 
    redirectUrl: Linking.createURL('oauth-callback')
  });

  // Sağlayıcı parametre değerine göre doğru OAuth stratejisini döndürür
  const getAuthStrategy = (providerName?: string) => {
    console.log("Kullanılan sağlayıcı:", providerName);
    
    switch (providerName?.toLowerCase()) {
      case 'github':
        return githubAuth;
      case 'facebook':
        return facebookAuth;
      case 'google':
      default:
        return googleAuth;
    }
  };

  // Clerk URL parametrelerini kontrol et
  useEffect(() => {
    // WebBrowser oturumlarını temizle
    try {
      WebBrowser.dismissBrowser();
    } catch (e) {
      // Hata olması normal
      console.log('Browser dismissal ignored:', e);
    }

    const checkParams = async () => {
      // İşlem zaten sürüyorsa yeni bir işlem başlatma
      if (processing) return;
      
      console.log('OAuthCallback: URL parametreleri kontrol ediliyor:', JSON.stringify(params, null, 2));
      console.log('OAuthCallback: segments:', segments);
      
      if (isLoaded) {
        if (isSignedIn) {
          console.log('OAuthCallback: Kullanıcı zaten giriş yapmış, ana sayfaya yönlendiriliyor...');
          router.replace('/(tabs)');
          return;
        }
        
        // Doğrudan router.push tarafından iletilen provider parametresi kontrolü
        const directProvider = params.provider;
        if (directProvider) {
          console.log('Provider parametresi doğrudan bulundu:', directProvider);
        }
        
        // URL parametresinden session ID çıkarmayı dene
        if (params.url) {
          try {
            setProcessing(true);
            console.log("URL parametresi algılandı, çözümleniyor...", params.url);
            
            // URL'den provider'ı ve created_session_id'yi çıkar
            let sessionId = null;
            let providerFromUrl = directProvider || 'google';
            
            // URL'den provider'ı çıkarmaya çalış
            if (params.url.includes("provider=")) {
              providerFromUrl = params.url.split("provider=")[1]?.split("&")[0] || providerFromUrl;
              console.log("URL'den provider çıkarıldı:", providerFromUrl);
            }
            
            if (params.url.includes("created_session_id=")) {
              sessionId = params.url.split("created_session_id=")[1]?.split("&")[0];
            }
            
            if (sessionId) {
              console.log("URL'den session ID çıkarıldı:", sessionId);
              console.log("Kullanılan provider:", providerFromUrl);
              
              // Önce GitHub stratejisini dene, dönen resulttan gerçek provider'ı belirle
              const { setActive } = await githubAuth();
              
              if (setActive) {
                console.log("GitHub stratejisi başarıyla hazırlandı, oturum etkinleştiriliyor...");
                await setActive({ session: sessionId });
                router.replace('/(tabs)');
              } else {
                throw new Error('Oturum etkinleştirme fonksiyonu bulunamadı');
              }
            } else {
              throw new Error('URL parametrelerinden session ID çıkarılamadı');
            }
          } catch (err) {
            console.error('OAuth URL parametresi işleme hatası:', err);
            setError(`OAuth URL parametresi işlenirken hata: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            setProcessing(false);
          }
        }
        // Eğer createdSessionId parametresi varsa, doğrudan oturumu etkinleştirmeyi dene
        else if (params.created_session_id) {
          try {
            setProcessing(true);
            const provider = directProvider || 'google';
            console.log(`OAuthCallback: ${provider} oturumu etkinleştiriliyor...`, params.created_session_id);
            
            // Doğrudan GitHub stratejisini kullan, çünkü mevcut hatada genellikle GitHub oturumu
            // Google olarak işleniyor. GitHub'ı denediğimizde ve başarılı olursa sorun çözülmüş olur.
            const { setActive } = await githubAuth();
            
            if (setActive) {
              console.log("GitHub stratejisi başarıyla hazırlandı, oturum etkinleştiriliyor...");
              await setActive({ session: params.created_session_id });
              router.replace('/(tabs)');
            } else {
              throw new Error('Oturum etkinleştirme fonksiyonu bulunamadı');
            }
          } catch (err) {
            console.error('GitHub OAuth ile etkinleştirme başarısız, Google stratejisi deneniyor...');
            try {
              // GitHub başarısız olursa Google stratejisini dene
              const { setActive } = await googleAuth();
              
              if (setActive) {
                console.log("Google stratejisi başarıyla hazırlandı, oturum etkinleştiriliyor...");
                await setActive({ session: params.created_session_id });
                router.replace('/(tabs)');
              } else {
                throw new Error('Oturum etkinleştirme fonksiyonu bulunamadı');
              }
            } catch (secondErr) {
              console.error('OAuth oturumu etkinleştirme hatası:', secondErr);
              setError(`OAuth oturumu etkinleştirilirken bir hata oluştu: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}`);
            }
          } finally {
            setProcessing(false);
          }
        } else {
          // Eksik parametrelerle geldiyse
          console.log('Geçerli OAuth parametreleri bulunamadı:', params);
          setError('Geçerli OAuth parametreleri bulunamadı. Lütfen tekrar giriş yapın.');
        }
      }
    };
    
    checkParams();
  }, [isLoaded, isSignedIn, params, googleAuth, githubAuth, facebookAuth]);

  // Manüel yeniden deneme işlevi
  const handleRetry = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      // URL'den session ID'yi çıkarmaya çalış (mevcut parametrelerden)
      let sessionId = params.created_session_id;
      
      // URL parametresinden de alabiliriz
      if (!sessionId && params.url && params.url.includes("created_session_id=")) {
        sessionId = params.url.split("created_session_id=")[1]?.split("&")[0];
      }
      
      if (!sessionId) {
        throw new Error("Oturum kimliği bulunamadı.");
      }
      
      console.log(`Yeniden giriş deneniyor... Session ID: ${sessionId}`);
      
      // Tüm OAuth stratejilerini sırayla dene
      try {
        console.log("GitHub stratejisi deneniyor...");
        const githubResult = await githubAuth();
        if (githubResult.setActive) {
          await githubResult.setActive({ session: sessionId });
          router.replace('/(tabs)');
          return;
        }
      } catch (githubErr) {
        console.error("GitHub stratejisi başarısız:", githubErr);
      }
      
      try {
        console.log("Google stratejisi deneniyor...");
        const googleResult = await googleAuth();
        if (googleResult.setActive) {
          await googleResult.setActive({ session: sessionId });
          router.replace('/(tabs)');
          return;
        }
      } catch (googleErr) {
        console.error("Google stratejisi başarısız:", googleErr);
      }
      
      try {
        console.log("Facebook stratejisi deneniyor...");
        const facebookResult = await facebookAuth();
        if (facebookResult.setActive) {
          await facebookResult.setActive({ session: sessionId });
          router.replace('/(tabs)');
          return;
        }
      } catch (facebookErr) {
        console.error("Facebook stratejisi başarısız:", facebookErr);
      }
      
      throw new Error("Tüm stratejiler denendi fakat hiçbiri çalışmadı.");
    } catch (err) {
      console.error('Yeniden deneme hatası:', err);
      setError(`Yeniden deneme başarısız oldu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  };

  // Giriş sayfasına dönme işlevi
  const handleBackToSignIn = () => {
    router.replace('/(auth)/sign-in');
  };

  // Clerk hala yüklenirken
  if (!isLoaded || processing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
        <ThemedText style={[styles.loadingText, { color: theme.text, marginTop: 16 }]}>
          OAuth işlemi tamamlanıyor...
        </ThemedText>
      </SafeAreaView>
    );
  }

  // Hata durumunda
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: theme.text }]}>{error}</ThemedText>
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.button} onPress={handleRetry}>
              <Text style={styles.buttonText}>Yeniden Dene</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleBackToSignIn}>
              <Text style={styles.buttonText}>Giriş Sayfasına Dön</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  // Bekleme durumu
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.text} />
      <ThemedText style={[styles.loadingText, { color: theme.text, marginTop: 16 }]}>
        OAuth kimlik doğrulaması bekleniyor...
      </ThemedText>
      
      <TouchableOpacity style={styles.button} onPress={handleBackToSignIn}>
        <Text style={styles.buttonText}>Giriş Sayfasına Dön</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 12,
    margin: 16,
    width: '100%',
    maxWidth: 400,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#4c669f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  secondaryButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
