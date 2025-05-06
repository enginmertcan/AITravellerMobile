import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Dimensions, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useCallback, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/useColorScheme';
import { TravelPlanService } from '@/app/services/firebase.service';
import { TravelPlan } from '@/app/types/travel';

const { width } = Dimensions.get('window');

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface QuickAction {
  icon: string;
  title: string;
  color: string;
}

export default function HomeScreen() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [travelPlans, setTravelPlans] = useState<Partial<TravelPlan>[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Seyahat planlarını çek
  const fetchTravelPlans = async () => {
    try {
      setLoading(true);
      console.log('Kullanıcının seyahat planları çekiliyor...');
      if (userId) {
        const plans = await TravelPlanService.getUserTravelPlans(userId);
        setTravelPlans(plans);
        console.log(`${plans.length} seyahat planı bulundu.`);
      }
    } catch (error) {
      console.error('Seyahat planları çekilirken hata oluştu:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTravelPlans();
  }, [userId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTravelPlans().then(() => {
      setRefreshing(false);
    });
  }, [userId]);

  const features: Feature[] = [
    {
      icon: 'compass',
      title: 'Popüler Rotalar',
      description: 'En çok tercih edilen seyahat rotaları',
      color: '#4c669f',
    },
    {
      icon: 'map-marker-radius',
      title: 'Yakın Yerler',
      description: 'Yakınınızdaki keşfedilecek yerler',
      color: '#3b5998',
    },
    {
      icon: 'star',
      title: 'Öneriler',
      description: 'Size özel seyahat önerileri',
      color: '#192f6a',
    },
    {
      icon: 'calendar-month',
      title: 'Etkinlikler',
      description: 'Yaklaşan seyahat etkinlikleri',
      color: '#4c669f',
    },
  ];

  const quickActions: QuickAction[] = [
    {
      icon: 'robot',
      title: 'AI Planlayıcı',
      color: '#4c669f',
    },
    {
      icon: 'compass',
      title: 'Keşfet',
      color: '#3b5998',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <ThemedText style={styles.welcomeText}>
            Merhaba, {user?.firstName || 'Gezgin'} 👋
          </ThemedText>
          <ThemedText style={styles.welcomeSubtext}>
            Yeni maceralar seni bekliyor
          </ThemedText>
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.searchBar}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#666"
          />
          <ThemedText style={styles.searchText}>Nereyi keşfetmek istersin?</ThemedText>
        </TouchableOpacity>

        {/* Seyahat Planları Listesi */}
        <View style={styles.travelPlansContainer}>
          <View style={styles.travelPlansHeader}>
            <ThemedText style={styles.sectionTitle}>Seyahat Planlarım</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)/ai-planner')}>
              <ThemedText style={styles.seeAllText}>Yeni Ekle</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#4c669f" style={styles.loader} />
          ) : travelPlans.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.travelPlansScroll}
            >
              {travelPlans.map((plan, index) => (
                <TouchableOpacity
                  key={plan.id || index}
                  style={styles.travelPlanCard}
                  onPress={() => router.push(`/trip-details?id=${plan.id}`)}
                >
                  <View style={styles.travelPlanImageContainer}>
                    <MaterialCommunityIcons name="map-marker-outline" size={50} color="#4c669f" />
                  </View>
                  <View style={styles.travelPlanContent}>
                    <ThemedText style={styles.travelPlanDestination}>{plan.destination}</ThemedText>
                    <ThemedText style={styles.travelPlanDetails}>
                      {plan.startDate} • {plan.days || plan.duration} gün
                    </ThemedText>
                    <View style={styles.travelPlanBadge}>
                      <ThemedText style={styles.travelPlanBadgeText}>{plan.budget}</ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noPlansContainer}>
              <MaterialCommunityIcons name="map-search" size={50} color="#ccc" />
              <ThemedText style={styles.noPlansText}>Henüz seyahat planı yok</ThemedText>
              <TouchableOpacity
                style={styles.createPlanButton}
                onPress={() => router.push('/(tabs)/ai-planner')}
              >
                <ThemedText style={styles.createPlanButtonText}>Plan Oluştur</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.quickActionsContainer}>
          <ThemedText style={styles.sectionTitle}>Hızlı İşlemler</ThemedText>
          <View style={styles.quickActions}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={() => router.push('/(tabs)/ai-planner')}
              >
                <View style={[styles.iconContainer, { backgroundColor: action.color + '15' }]}>
                  <MaterialCommunityIcons name={action.icon} size={26} color={action.color} />
                </View>
                <ThemedText style={styles.quickActionTitle}>{action.title}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          <ThemedText style={styles.sectionTitle}>Keşfet</ThemedText>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                onPress={() => {
                  // Yakın Yerler özelliği için özel yönlendirme
                  if (feature.title === 'Yakın Yerler') {
                    router.push('/nearby-places');
                  } else {
                    // Diğer özellikler için henüz bir sayfa yok, ileride eklenebilir
                    console.log(`${feature.title} özelliği tıklandı`);
                  }
                }}
              >
                <View style={[styles.iconContainer, { backgroundColor: feature.color + '15' }]}>
                  <MaterialCommunityIcons name={feature.icon} size={24} color={feature.color} />
                </View>
                <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
                <ThemedText style={styles.featureDescription}>{feature.description}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

import AppStyles from '@/constants/AppStyles';

const styles = StyleSheet.create({
  container: {
    ...AppStyles.layout.container,
  },
  travelPlansContainer: {
    marginVertical: AppStyles.spacing.lg,
  },
  travelPlansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppStyles.spacing.sm,
  },
  seeAllText: {
    color: AppStyles.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  travelPlansScroll: {
    paddingVertical: AppStyles.spacing.sm,
    marginHorizontal: -AppStyles.spacing.lg,
    paddingHorizontal: AppStyles.spacing.lg,
  },
  travelPlanCard: {
    width: 250,
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: AppStyles.borderRadius.md,
    marginRight: AppStyles.spacing.sm,
    ...AppStyles.shadows.small,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
  },
  travelPlanImageContainer: {
    height: 120,
    backgroundColor: AppStyles.colors.dark.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelPlanContent: {
    padding: AppStyles.spacing.sm,
  },
  travelPlanDestination: {
    ...AppStyles.typography.body,
    fontWeight: 'bold',
    marginBottom: AppStyles.spacing.xs,
    color: AppStyles.colors.dark.text,
  },
  travelPlanDetails: {
    ...AppStyles.typography.caption,
    color: AppStyles.colors.dark.textMuted,
    marginBottom: AppStyles.spacing.sm,
  },
  travelPlanBadge: {
    backgroundColor: `${AppStyles.colors.primary}15`,
    paddingHorizontal: AppStyles.spacing.sm,
    paddingVertical: AppStyles.spacing.xs,
    borderRadius: AppStyles.borderRadius.xs,
    alignSelf: 'flex-start',
  },
  travelPlanBadgeText: {
    color: AppStyles.colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  noPlansContainer: {
    padding: AppStyles.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    borderRadius: AppStyles.borderRadius.md,
    backgroundColor: AppStyles.colors.dark.card,
  },
  noPlansText: {
    marginTop: AppStyles.spacing.sm,
    color: AppStyles.colors.dark.textMuted,
    ...AppStyles.typography.body,
  },
  createPlanButton: {
    marginTop: AppStyles.spacing.lg,
    backgroundColor: AppStyles.colors.primary,
    paddingHorizontal: AppStyles.spacing.lg,
    paddingVertical: AppStyles.spacing.sm,
    borderRadius: AppStyles.borderRadius.round,
    ...AppStyles.shadows.small,
  },
  createPlanButtonText: {
    color: 'white',
    fontWeight: '600',
    ...AppStyles.typography.caption,
  },
  loader: {
    marginVertical: 30,
  },
  header: {
    padding: AppStyles.spacing.lg,
    paddingTop: AppStyles.safeAreaInsets.top,
    backgroundColor: AppStyles.colors.dark.background,
    paddingBottom: AppStyles.spacing.md,
  },
  welcomeSection: {
    marginBottom: AppStyles.spacing.lg,
  },
  welcomeText: {
    ...AppStyles.typography.title,
    marginBottom: AppStyles.spacing.sm,
    color: AppStyles.colors.dark.text,
    marginTop: AppStyles.spacing.sm,
  },
  welcomeSubtext: {
    ...AppStyles.typography.body,
    color: AppStyles.colors.dark.textMuted,
  },
  content: {
    flex: 1,
    padding: AppStyles.spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: AppStyles.borderRadius.md,
    padding: AppStyles.spacing.md,
    marginBottom: AppStyles.spacing.lg,
    ...AppStyles.shadows.small,
  },
  searchText: {
    marginLeft: AppStyles.spacing.sm,
    ...AppStyles.typography.body,
    color: AppStyles.colors.dark.textMuted,
  },
  quickActionsContainer: {
    marginBottom: AppStyles.spacing.xl,
  },
  sectionTitle: {
    ...AppStyles.typography.subtitle,
    marginBottom: AppStyles.spacing.md,
    color: AppStyles.colors.dark.text,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: AppStyles.borderRadius.lg,
    padding: AppStyles.spacing.md,
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.card,
    ...AppStyles.shadows.small,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: AppStyles.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppStyles.spacing.sm,
  },
  quickActionTitle: {
    ...AppStyles.typography.caption,
    fontWeight: '600',
    textAlign: 'center',
    color: AppStyles.colors.dark.text,
  },
  featuresContainer: {
    gap: 12,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: (width - 52) / 2,
    borderRadius: AppStyles.borderRadius.lg,
    padding: AppStyles.spacing.md,
    backgroundColor: AppStyles.colors.dark.card,
    ...AppStyles.shadows.small,
  },
  featureTitle: {
    ...AppStyles.typography.body,
    fontWeight: '600',
    marginBottom: AppStyles.spacing.xs,
    color: AppStyles.colors.dark.text,
  },
  featureDescription: {
    ...AppStyles.typography.caption,
    color: AppStyles.colors.dark.textMuted,
    lineHeight: 18,
  },
});
