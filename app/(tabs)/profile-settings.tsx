import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@clerk/clerk-expo';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppStyles from '@/constants/AppStyles';

export default function ProfileSettingsScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? AppStyles.colors.dark : AppStyles.colors.light;

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      await user?.update({
        firstName,
        lastName,
        username,
      });
      Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.');
    } catch (err: any) {
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
        await user?.setProfileImage({
          file: result.assets[0],
        });
        Alert.alert('Başarılı', 'Profil fotoğrafınız güncellendi.');
      }
    } catch (err: any) {
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
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Profil Ayarları</ThemedText>
          <View style={{width: 24}} />
        </View>
      </LinearGradient>

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
              <View style={styles.emailInfo}>
                <ThemedText style={styles.emailText}>{email.emailAddress}</ThemedText>
                {email.verification.status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <ThemedText style={styles.verifiedText}>Doğrulanmış</ThemedText>
                  </View>
                )}
              </View>
              {email.id === user.primaryEmailAddressId && (
                <ThemedText style={styles.primaryBadge}>Birincil</ThemedText>
              )}
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppStyles.colors.dark.background,
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
  emailInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailText: {
    fontSize: 16,
    color: AppStyles.colors.dark.text,
    marginRight: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 4,
  },
  primaryBadge: {
    fontSize: 14,
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
});