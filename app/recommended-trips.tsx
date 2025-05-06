import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TravelPlan } from './types/travel';
import { FirebaseService } from './services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';
import { useColorScheme } from 'react-native';

export default function RecommendedTripsScreen() {
  const [recommendedPlans, setRecommendedPlans] = useState<Partial<TravelPlan>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { userId } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Önerilen seyahat planlarını yükle
  const loadRecommendedPlans = async () => {
    try {
      setLoading(true);
      console.log('Önerilen seyahat planları yükleniyor...');
      const plans = await FirebaseService.TravelPlan.getRecommendedTravelPlans();
      setRecommendedPlans(plans);
      console.log(`${plans.length} önerilen seyahat planı bulundu.`);
    } catch (error) {
      console.error('Önerilen seyahat planları yüklenirken hata oluştu:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendedPlans();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRecommendedPlans().then(() => {
      setRefreshing(false);
    });
  }, []);

  const selectPlan = (plan: Partial<TravelPlan>) => {
    if (plan.id) {
      router.push(`/trip-details?id=${plan.id}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={isDark ? "#fff" : "#000"} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Önerilen Seyahatler</ThemedText>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4c669f" />
          <ThemedText style={styles.loadingText}>Önerilen seyahatler yükleniyor...</ThemedText>
        </View>
      ) : recommendedPlans.length > 0 ? (
        <FlatList
          data={recommendedPlans}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.planCard}
              onPress={() => selectPlan(item)}
            >
              <View style={styles.planCardContent}>
                <ThemedText style={styles.planDestination} numberOfLines={1} ellipsizeMode="tail">
                  {item.destination || 'İsimsiz Destinasyon'}
                </ThemedText>
                <View style={styles.planDetails}>
                  {item.startDate && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons name="calendar" size={16} color="#4c669f" />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.startDate}
                      </ThemedText>
                    </View>
                  )}
                  {(item.days || item.duration) && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color="#4c669f" />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.days || item.duration} gün
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.planDetails}>
                  {item.budget && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons name="wallet-outline" size={16} color="#4c669f" />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.budget}
                      </ThemedText>
                    </View>
                  )}
                  {item.groupType && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons name="account-group-outline" size={16} color="#4c669f" />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.groupType}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <MaterialCommunityIcons name="account" size={16} color="#4c669f" />
                  <ThemedText style={styles.userInfoText}>
                    {item.userId === userId ? 'Sizin tarafınızdan önerildi' : 'Başka bir kullanıcı tarafından önerildi'}
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="map-search" size={80} color="#4c669f" />
          <ThemedText style={styles.emptyText}>
            Henüz önerilen seyahat planı bulunmuyor.
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Kullanıcılar seyahat planlarını önerdikçe burada görünecekler.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  planCardContent: {
    padding: 16,
  },
  planDestination: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  planDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  planDetailText: {
    fontSize: 14,
    marginLeft: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  userInfoText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
});
