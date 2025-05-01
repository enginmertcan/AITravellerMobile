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
        <View style={styles.userInfoCard}>
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
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>0</ThemedText>
              <ThemedText style={styles.statLabel}>Seyahatler</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>0</ThemedText>
              <ThemedText style={styles.statLabel}>Ülkeler</ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <ThemedText style={styles.sectionTitle}>Hesap</ThemedText>
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 ? styles.menuItemLast : null
              ]}
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

        <ThemedText style={styles.versionText}>Versiyon 1.0.0</ThemedText>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    fontFamily: 'SpaceMono',
  },
  userInfoCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(76, 102, 159, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#4c669f',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  userEmail: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'SpaceMono',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4c669f',
    fontFamily: 'SpaceMono',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'SpaceMono',
  },
  menuContainer: {
    backgroundColor: '#111',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuItemLast: {
    borderBottomWidth: 0,
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
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  signOutText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  versionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
});