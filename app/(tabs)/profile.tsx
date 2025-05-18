import { StyleSheet, View, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { FirebaseService } from '@/app/services/firebase.service';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [travelPlansCount, setTravelPlansCount] = useState(0);
  const [countriesCount, setCountriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(true);

  // Doğrudan profile-settings sayfasına yönlendirme
  useEffect(() => {
    // Sayfa yüklendiğinde doğrudan profile-settings sayfasına yönlendir
    router.replace('/(tabs)/profile-settings');
  }, []);

  // Kullanıcının seyahat planlarını ve ziyaret ettiği ülkeleri getir
  useEffect(() => {
    const fetchTravelPlans = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const plans = await FirebaseService.TravelPlan.getUserTravelPlans(user.id);

        // Seyahat planı sayısını ayarla
        setTravelPlansCount(plans.length);

        // Ziyaret edilen benzersiz ülkeleri hesapla
        const uniqueCountries = new Set();
        plans.forEach(plan => {
          if (plan.country) {
            uniqueCountries.add(plan.country);
          }
        });

        setCountriesCount(uniqueCountries.size);
      } catch (error) {
        console.error('Seyahat planları alınırken hata oluştu:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTravelPlans();
  }, [user]);

  const menuItems = [
    {
      icon: 'account-outline',
      title: 'Hesap Bilgileri',
      route: '/(tabs)/profile-settings',
      color: '#4c669f',
    },
    {
      icon: 'bell-outline',
      title: 'Bildirimler',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!'),
      color: '#3b5998',
    },
    {
      icon: 'cog-outline',
      title: 'Ayarlar',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!'),
      color: '#192f6a',
    },
    {
      icon: 'help-circle-outline',
      title: 'Yardım',
      onPress: () => Alert.alert('Bilgi', 'Bu özellik yakında kullanıma açılacak!'),
      color: '#4c669f',
    },
  ];

  // Yükleme ekranı göster
  if (navigating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4c669f" />
        <ThemedText style={styles.loadingText}>Profil yükleniyor...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Profil</ThemedText>
        <View style={styles.userInfoCard}>
          <LinearGradient
            colors={['#4c669f', '#3b5998', '#192f6a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientHeader}
          >
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
          </LinearGradient>
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/trip-details')}
            >
              <ThemedText style={styles.statNumber}>
                {loading ? '...' : travelPlansCount}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Seyahatler</ThemedText>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>
                {loading ? '...' : countriesCount}
              </ThemedText>
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
              onPress={() => item.route ? router.push(item.route) : item.onPress()}
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
          onPress={async () => {
            try {
              // Önce çıkış işlemini gerçekleştir
              await signOut();

              // Sonra giriş sayfasına yönlendir
              router.replace('/(auth)/sign-in');
            } catch (error) {
              console.error("Çıkış yapılırken hata oluştu:", error);
              Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu. Lütfen tekrar deneyin.");
            }
          }}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#ff4444" />
          <ThemedText style={styles.signOutText}>Çıkış Yap</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.versionText}>Versiyon 1.0.0</ThemedText>
      </View>
    </ScrollView>
  );
}

import AppStyles from '@/constants/AppStyles';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.background,
    paddingTop: AppStyles.safeAreaInsets.top,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: AppStyles.colors.dark.text,
  },
  container: {
    ...AppStyles.layout.safeContainer,
    paddingBottom: 0, // Ensure no padding at the bottom
  },
  header: {
    padding: AppStyles.spacing.lg,
    paddingTop: AppStyles.safeAreaInsets.top,
    paddingBottom: AppStyles.spacing.md,
  },
  title: {
    ...AppStyles.typography.title,
    color: AppStyles.colors.dark.text,
    marginBottom: AppStyles.spacing.lg,
    marginTop: AppStyles.spacing.sm,
  },
  userInfoCard: {
    ...AppStyles.layout.card,
    padding: 0,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    overflow: 'hidden',
  },
  gradientHeader: {
    padding: AppStyles.spacing.lg,
    width: '100%',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AppStyles.spacing.lg,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: AppStyles.borderRadius.round,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppStyles.spacing.md,
    borderWidth: 2,
    borderColor: '#ffffff',
    ...AppStyles.shadows.medium,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...AppStyles.typography.subtitle,
    color: '#ffffff',
    marginBottom: AppStyles.spacing.xs,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userEmail: {
    ...AppStyles.typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: AppStyles.spacing.md,
    paddingBottom: AppStyles.spacing.md,
    paddingHorizontal: AppStyles.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: AppStyles.colors.dark.border,
    backgroundColor: AppStyles.colors.dark.card,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    padding: AppStyles.spacing.sm,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: AppStyles.colors.primary,
    fontFamily: 'InterRegular',
  },
  statLabel: {
    ...AppStyles.typography.small,
    color: AppStyles.colors.dark.textMuted,
    marginTop: AppStyles.spacing.xs,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: AppStyles.colors.dark.border,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    padding: AppStyles.spacing.lg,
  },
  sectionTitle: {
    ...AppStyles.typography.subtitle,
    color: AppStyles.colors.dark.text,
    marginBottom: AppStyles.spacing.md,
  },
  menuContainer: {
    ...AppStyles.layout.card,
    overflow: 'hidden',
    marginBottom: AppStyles.spacing.lg,
    padding: 0,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    ...AppStyles.shadows.medium,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: AppStyles.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppStyles.colors.dark.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: AppStyles.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppStyles.spacing.md,
  },
  menuItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemTitle: {
    ...AppStyles.typography.body,
    color: AppStyles.colors.dark.text,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: AppStyles.borderRadius.md,
    padding: AppStyles.spacing.md,
    gap: AppStyles.spacing.sm,
    marginBottom: AppStyles.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
    ...AppStyles.shadows.small,
  },
  signOutText: {
    ...AppStyles.typography.body,
    color: AppStyles.colors.accent,
    fontWeight: '600',
  },
  versionText: {
    ...AppStyles.typography.small,
    color: AppStyles.colors.dark.textMuted,
    textAlign: 'center',
  },
});