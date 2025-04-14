import { StyleSheet, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();

  const menuItems = [
    {
      icon: 'account-outline',
      title: 'Hesap Bilgileri',
      route: '/account',
      color: '#4c669f',
    },
    {
      icon: 'bell-outline',
      title: 'Bildirimler',
      route: '/notifications',
      color: '#3b5998',
    },
    {
      icon: 'cog-outline',
      title: 'Ayarlar',
      route: '/settings',
      color: '#192f6a',
    },
    {
      icon: 'help-circle-outline',
      title: 'Yardım',
      route: '/help',
      color: '#4c669f',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Profil</ThemedText>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons name="account" size={40} color="#fff" />
          </View>
          <View style={styles.userDetails}>
            <ThemedText style={styles.userName}>
              {user?.firstName} {user?.lastName}
            </ThemedText>
            <ThemedText style={styles.userEmail}>{user?.emailAddresses[0].emailAddress}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                <MaterialCommunityIcons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>{item.title}</ThemedText>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#666" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => signOut()}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#ff4444" />
          <ThemedText style={styles.signOutText}>Çıkış Yap</ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    fontFamily: 'SpaceMono',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  userEmail: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'SpaceMono',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  menuContainer: {
    backgroundColor: '#111',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
}); 