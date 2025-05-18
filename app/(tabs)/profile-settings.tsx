import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useState, useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppStyles from '@/constants/AppStyles';
import { BlurView } from 'expo-blur';
import { FirebaseService } from '@/app/services/firebase.service';

export default function ProfileSettingsScreen() {
  const { user } = useUser();
  const { userId, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? AppStyles.colors.dark : AppStyles.colors.light;
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Kullanıcı bilgilerini Firebase ile senkronize et
  useEffect(() => {
    if (user && userId) {
      syncUserWithFirebase();
    }
  }, [user, userId]);

  // Kullanıcı bilgilerini Firebase ile senkronize etme fonksiyonu
  const syncUserWithFirebase = async () => {
    if (!user || !userId) return;

    try {
      console.log('Kullanıcı bilgileri Firebase ile senkronize ediliyor...');

      // Kullanıcı profil verilerini oluştur
      const profileData = {
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.primaryEmailAddress?.emailAddress,
        imageUrl: user.imageUrl,
        username: user.username,
        lastSignInAt: new Date().toISOString(),
      };

      // Firebase'e kaydet
      const success = await FirebaseService.User.upsertUserProfile(userId, profileData);

      if (success) {
        console.log('Kullanıcı profili Firebase ile başarıyla senkronize edildi');
      } else {
        console.error('Kullanıcı profili Firebase ile senkronize edilemedi');
      }
    } catch (error) {
      console.error('Kullanıcı profili senkronizasyon hatası:', error);
    }
  };

  // Çıkış yapma fonksiyonu
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  // Çıkış işlemini gerçekleştir
  const performLogout = async () => {
    try {
      setLoggingOut(true);

      // Önce modalı kapat, kullanıcı deneyimini iyileştirmek için
      setLogoutModalVisible(false);

      try {
        // Önce çıkış işlemini gerçekleştir
        await signOut();

        // Sonra giriş sayfasına yönlendir
        router.replace('/(auth)/sign-in');
      } catch (error) {
        console.error("Çıkış yapılırken hata oluştu:", error);
        Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu. Lütfen tekrar deneyin.");
      } finally {
        setLoggingOut(false);
      }
    } catch (error) {
      console.error("Çıkış yapılırken hata oluştu:", error);
      Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu. Lütfen tekrar deneyin.");
      setLoggingOut(false);
      setLogoutModalVisible(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);

      // Clerk profili güncelle
      await user?.update({
        firstName,
        lastName,
        username,
      });

      // Firebase ile senkronize et
      await syncUserWithFirebase();

      Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.');
    } catch (err: any) {
      console.error('Profil güncelleme hatası:', err);
      Alert.alert(
        'Hata',
        err.errors?.[0]?.message || 'Profil güncellenirken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setLoading(true);

        // Clerk profil fotoğrafını güncelle
        const imageUri = result.assets[0].uri;
        const response = await fetch(imageUri);
        const blob = await response.blob();

        await user?.setProfileImage({
          file: blob,
        });

        // Firebase ile senkronize et (kısa bir gecikme ekleyerek Clerk'in işlemi tamamlamasını bekle)
        setTimeout(async () => {
          await syncUserWithFirebase();
        }, 1000);

        Alert.alert('Başarılı', 'Profil fotoğrafınız güncellendi.');
      }
    } catch (err: any) {
      console.error('Profil fotoğrafı güncelleme hatası:', err);
      Alert.alert(
        'Hata',
        err.errors?.[0]?.message || 'Fotoğraf güncellenirken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      icon: 'shield-outline',
      title: 'Güvenlik Ayarları',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'notifications-outline',
      title: 'Bildirim Tercihleri',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'globe-outline',
      title: 'Dil ve Bölge',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'color-palette-outline',
      title: 'Görünüm',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    }
  ];

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={{width: 24}} />
            <ThemedText style={styles.headerTitle}>Profil Ayarları</ThemedText>
            <View style={{width: 24}} />
          </View>
        </View>

      <View style={styles.content}>
        <View style={styles.profileImageSection}>
          <TouchableOpacity onPress={handleImagePick}>
            <Image
              source={{ uri: user?.imageUrl || 'https://via.placeholder.com/100' }}
              style={styles.profileImage}
              contentFit="cover"
            />
            <View style={styles.imageEditBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Kişisel Bilgiler</ThemedText>

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
              placeholder="Kullanıcı Adı"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholderTextColor="#666"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleUpdateProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Değişiklikleri Kaydet</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>E-posta Adresleri</ThemedText>
          {user?.emailAddresses.map((email: any) => (
            <View key={email.id} style={styles.emailItem}>
              <View style={styles.emailMainInfo}>
                <ThemedText style={styles.emailText}>{email.emailAddress}</ThemedText>
                <View style={styles.badgesContainer}>
                  {email.verification.status === 'verified' && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <ThemedText style={styles.verifiedText}>Doğrulanmış</ThemedText>
                    </View>
                  )}
                  {email.id === user.primaryEmailAddressId && (
                    <View style={styles.primaryBadgeContainer}>
                      <ThemedText style={styles.primaryBadge}>Birincil</ThemedText>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Diğer Ayarlar</ThemedText>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemContent}>
                <Ionicons name={item.icon as any} size={24} color="#4c669f" />
                <ThemedText style={styles.menuItemText}>{item.title}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hesap</ThemedText>
          <TouchableOpacity
            style={[styles.menuItem, styles.logoutButton]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <View style={styles.menuItemContent}>
              <MaterialCommunityIcons name="logout" size={24} color="#FF6B6B" />
              <ThemedText style={[styles.menuItemText, styles.logoutText]}>
                {loggingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
              </ThemedText>
            </View>
            {loggingOut ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <Ionicons name="chevron-forward" size={24} color="#999" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

    {/* Çıkış Yapma Modalı */}
    <Modal
      animationType="fade"
      transparent={true}
      visible={logoutModalVisible}
      onRequestClose={() => setLogoutModalVisible(false)}
    >
      <BlurView intensity={10} style={styles.modalOverlay} tint={isDark ? 'dark' : 'light'}>
        <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <MaterialCommunityIcons name="logout" size={40} color="#FF6B6B" />
            <ThemedText style={styles.modalTitle}>Çıkış Yap</ThemedText>
          </View>

          <View style={styles.modalBody}>
            <ThemedText style={styles.modalText}>
              Hesabınızdan çıkış yapmak istediğinize emin misiniz?
            </ThemedText>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setLogoutModalVisible(false)}
              disabled={loggingOut}
            >
              <ThemedText style={styles.cancelButtonText}>İptal</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.logoutModalButton]}
              onPress={performLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.logoutModalButtonText}>Çıkış Yap</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppStyles.colors.dark.background,
    paddingBottom: 0, // Ensure no padding at the bottom
  },
  header: {
    padding: 16,
    paddingTop: AppStyles.safeAreaInsets.top,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: AppStyles.colors.dark.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -20,
    padding: 20,
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imageEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#4c669f',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: AppStyles.colors.dark.text,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    color: AppStyles.colors.dark.text,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: '#4c669f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppStyles.colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
  },
  emailMainInfo: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  emailInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailText: {
    fontSize: 16,
    color: AppStyles.colors.dark.text,
    marginBottom: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  primaryBadgeContainer: {
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadge: {
    fontSize: 12,
    color: '#4c669f',
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppStyles.colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: AppStyles.colors.dark.text,
  },
  logoutButton: {
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  logoutText: {
    color: '#FF6B6B',
  },
  // Modal stilleri
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: Dimensions.get('window').width * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderRightWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutModalButton: {
    backgroundColor: '#FF6B6B',
  },
  logoutModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});