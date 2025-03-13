import { StyleSheet, View, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  if (!isSignedIn || !user) {
    router.replace('/(auth)/sign-in');
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (err) {
      Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
    }
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Hesap Bilgileri',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'shield-outline',
      title: 'Güvenlik Ayarları',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'notifications-outline',
      title: 'Bildirim Ayarları',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'language-outline',
      title: 'Dil Seçenekleri',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    },
    {
      icon: 'help-circle-outline',
      title: 'Yardım ve Destek',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!')
    }
  ];

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user.imageUrl || 'https://via.placeholder.com/100' }}
            style={styles.profileImage}
          />
          <View style={styles.profileInfo}>
            <ThemedText style={styles.name}>{user.fullName}</ThemedText>
            <ThemedText style={styles.email}>{user.primaryEmailAddress?.emailAddress}</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
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

        <TouchableOpacity
          style={[styles.menuItem, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="log-out-outline" size={24} color="#ff4444" />
            <ThemedText style={[styles.menuItemText, styles.signOutText]}>
              Çıkış Yap
            </ThemedText>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    marginLeft: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    padding: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  signOutButton: {
    marginTop: 20,
  },
  signOutText: {
    color: '#ff4444',
  },
}); 