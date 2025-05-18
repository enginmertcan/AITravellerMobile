import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Dimensions, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useCallback, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useColorScheme } from '@/hooks/useColorScheme';
import { TravelPlanService } from '@/app/services/firebase.service';
import { TravelPlan } from '@/app/types/travel';
import AppStyles from '@/constants/AppStyles';

const { width } = Dimensions.get('window');

interface Feature {
  icon: MaterialCommunityIconName;
  title: string;
  description: string;
  color: string;
}

interface QuickAction {
  icon: MaterialCommunityIconName;
  title: string;
  color: string;
}

// Define the type for MaterialCommunityIcons names
type MaterialCommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function HomeScreen() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [travelPlans, setTravelPlans] = useState<Partial<TravelPlan>[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Seyahat planlarını çek
  const fetchTravelPlans = useCallback(async () => {
    try {
      console.log('Kullanıcının seyahat planları çekiliyor...');
      if (userId && isSignedIn) {
        const plans = await TravelPlanService.getUserTravelPlans(userId);
        setTravelPlans(plans);
        console.log(`${plans.length} seyahat planı bulundu.`);
      } else {
        setTravelPlans([]);
      }
    } catch (error) {
      console.error('Seyahat planları çekilirken hata oluştu:', error);
      setTravelPlans([]);
    } finally {
      setLoading(false);
    }
  }, [userId, isSignedIn, TravelPlanService]);

  useEffect(() => {
    const loadData = async () => {
      if (isSignedIn && userId) {
        setLoading(true);
        await fetchTravelPlans();
      } else {
        setTravelPlans([]);
        setLoading(false);
      }
    };

    loadData();
  }, [isSignedIn, userId, fetchTravelPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isSignedIn && userId) {
      setLoading(true);
      await fetchTravelPlans();
    } else {
      setTravelPlans([]);
      setLoading(false);
    }
    setRefreshing(false);
  }, [isSignedIn, userId, fetchTravelPlans]);

  const features: Feature[] = [
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
            <TouchableOpacity onPress={() => router.push('/trip-details')}>
              <ThemedText style={styles.seeAllText}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={isDark ? AppStyles.colors.primary : AppStyles.colors.primary} style={styles.loader} />
          ) : travelPlans.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.travelPlansList}>
              {travelPlans.map((plan, index) => (
                <TouchableOpacity
                  key={plan.id || index}
                  style={styles.travelPlanCard}
                  onPress={() => router.push(`/trip-details?id=${plan.id}`)}
                >
                  <View style={styles.travelPlanImageContainer}>
                    <LinearGradient
                      colors={['#4c669f', '#3b5998', '#192f6a']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientBackground}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={50} color="#ffffff" />
                      {plan.isRecommended && (
                        <View style={styles.recommendedBadgeTop}>
                          <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                          <ThemedText style={styles.recommendedBadgeTopText}>Önerilen</ThemedText>
                        </View>
                      )}
                    </LinearGradient>
                  </View>
                  <View style={styles.travelPlanContent}>
                    <ThemedText style={styles.travelPlanDestination}>{plan.destination}</ThemedText>
                    <ThemedText style={styles.travelPlanDetails}>
                      {plan.startDate} • {plan.days || plan.duration} gün
                    </ThemedText>
                    <View style={styles.travelPlanBadgesContainer}>
                      <View style={styles.travelPlanBadge}>
                        <ThemedText style={styles.travelPlanBadgeText}>{plan.budget}</ThemedText>
                      </View>

                      {/* Beğeni Sayısı */}
                      {(plan.likes && plan.likes > 0) && (
                        <View style={styles.likeBadge}>
                          <MaterialCommunityIcons name="heart" size={12} color="#e91e63" />
                          <ThemedText style={styles.likeBadgeText}>{plan.likes}</ThemedText>
                        </View>
                      )}

                      {/* Önerilen Rozeti */}
                      {plan.isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noPlansContainer}>
              <MaterialCommunityIcons name="briefcase-outline" size={48} color={AppStyles.colors.dark.textMuted} />
              <ThemedText style={styles.noPlansText}>Henüz bir seyahat planın yok.</ThemedText>
              <TouchableOpacity style={styles.createPlanButton} onPress={() => router.push('/createPlan')}>
                <ThemedText style={styles.createPlanButtonText}>Yeni Plan Oluştur</ThemedText>
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
                onPress={() => router.push('/ai-planner')}
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
                  if (feature.title === 'Yakın Yerler') {
                    router.push('/nearby-places');
                  } else if (feature.title === 'Öneriler') {
                    router.push('/recommended-trips');
                  } else {
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



const styles = StyleSheet.create({
  container: {
    ...AppStyles.layout.container,
    paddingBottom: 0, // Ensure no padding at the bottom
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
  travelPlansList: {
    paddingVertical: AppStyles.spacing.sm,
    marginHorizontal: -AppStyles.spacing.lg,
    paddingHorizontal: AppStyles.spacing.lg,
  },
  travelPlanCard: {
    width: 250,
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: AppStyles.borderRadius.md,
    marginRight: AppStyles.spacing.sm,
    ...AppStyles.shadows.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    marginBottom: 2,
    // Daha modern bir görünüm için
    elevation: 4,
  },
  travelPlanImageContainer: {
    height: 120,
    backgroundColor: AppStyles.colors.dark.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gradientBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  recommendedBadgeTop: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedBadgeTopText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
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
  travelPlanBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  travelPlanBadge: {
    backgroundColor: `${AppStyles.colors.primary}15`,
    paddingHorizontal: AppStyles.spacing.sm,
    paddingVertical: AppStyles.spacing.xs,
    borderRadius: AppStyles.borderRadius.xs,
  },
  travelPlanBadgeText: {
    color: AppStyles.colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  likeBadge: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
    paddingHorizontal: AppStyles.spacing.sm,
    paddingVertical: AppStyles.spacing.xs,
    borderRadius: AppStyles.borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeBadgeText: {
    color: '#e91e63',
    fontSize: 12,
    fontWeight: '500',
  },
  recommendedBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: AppStyles.spacing.sm,
    paddingVertical: AppStyles.spacing.xs,
    borderRadius: AppStyles.borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
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
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
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
    ...AppStyles.shadows.medium,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    elevation: 4,
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
    justifyContent: 'space-between',
    gap: 12,
  },
  featureCard: {
    flex: 1,
    borderRadius: AppStyles.borderRadius.lg,
    padding: AppStyles.spacing.md,
    backgroundColor: AppStyles.colors.dark.card,
    ...AppStyles.shadows.medium,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    elevation: 4,
    marginHorizontal: 4,
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
