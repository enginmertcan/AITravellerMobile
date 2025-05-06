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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  travelPlansContainer: {
    marginVertical: 20,
  },
  travelPlansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    color: '#4c669f',
    fontWeight: '600',
    fontSize: 14,
  },
  travelPlansScroll: {
    paddingVertical: 10,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  travelPlanCard: {
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    overflow: 'hidden',
  },
  travelPlanImageContainer: {
    height: 120,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelPlanContent: {
    padding: 12,
  },
  travelPlanDestination: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  travelPlanDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  travelPlanBadge: {
    backgroundColor: '#4c669f15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  travelPlanBadgeText: {
    color: '#4c669f',
    fontSize: 12,
    fontWeight: '500',
  },
  noPlansContainer: {
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  noPlansText: {
    marginTop: 10,
    color: '#888',
    fontSize: 16,
  },
  createPlanButton: {
    marginTop: 20,
    backgroundColor: '#4c669f',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createPlanButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  loader: {
    marginVertical: 30,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#000',
    paddingBottom: 16,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    color: '#fff',
    fontFamily: 'SpaceMono',
    marginTop: 10,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SpaceMono',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  searchText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#666',
    fontFamily: 'SpaceMono',
  },
  quickActionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#111',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
    fontFamily: 'SpaceMono',
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
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#111',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  featureDescription: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    fontFamily: 'SpaceMono',
  },
});
