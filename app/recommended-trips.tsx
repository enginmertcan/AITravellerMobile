import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
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

  // Beğeni işlemi - Sayfa yenilenmeden çalışacak şekilde düzenlendi
  const handleLike = (plan: Partial<TravelPlan>) => {
    if (!userId) {
      Alert.alert('Giriş Gerekli', 'Beğeni yapabilmek için giriş yapmalısınız.');
      return;
    }

    if (!plan.id) return;

    // Find the plan in the current state
    const planIndex = recommendedPlans.findIndex(p => p.id === plan.id);
    if (planIndex === -1) return;

    const isCurrentlyLiked = plan.likedBy?.includes(userId) || false;
    const currentLikes = plan.likes || 0;

    // Create a new likedBy array
    const newLikedBy = [...(plan.likedBy || [])];

    if (isCurrentlyLiked) {
      // Remove user from likedBy
      const index = newLikedBy.indexOf(userId);
      if (index > -1) {
        newLikedBy.splice(index, 1);
      }
    } else {
      // Add user to likedBy
      newLikedBy.push(userId);
    }

    // Create a new plan object with updated like info
    const updatedPlan = {
      ...plan,
      likes: isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1,
      likedBy: newLikedBy
    };

    // Create a new plans array with the updated plan
    const updatedPlans = [...recommendedPlans];
    updatedPlans[planIndex] = updatedPlan;

    // Update the state immediately for responsive UI
    setRecommendedPlans(updatedPlans);

    // Then perform the actual API call in the background without waiting
    FirebaseService.TravelPlan.toggleLike(plan.id, userId)
      .then(success => {
        if (!success) {
          // If the API call fails, revert the UI change
          const revertedPlans = [...recommendedPlans];
          revertedPlans[planIndex] = plan;
          setRecommendedPlans(revertedPlans);
          Alert.alert('Hata', 'Beğeni işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        }
      })
      .catch(error => {
        console.error('Beğeni hatası:', error);
        // Revert UI change on error
        const revertedPlans = [...recommendedPlans];
        revertedPlans[planIndex] = plan;
        setRecommendedPlans(revertedPlans);
        Alert.alert('Hata', 'Beğeni işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      });
  };

  // Kullanıcının planı beğenip beğenmediğini kontrol et
  const isLikedByUser = (plan: Partial<TravelPlan>) => {
    return plan.likedBy?.includes(userId || '') || false;
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
            <View style={styles.planCard}>
              {/* Ana İçerik - Tıklanabilir */}
              <TouchableOpacity
                style={styles.planCardContent}
                onPress={() => selectPlan(item)}
                activeOpacity={0.7}
              >
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
              </TouchableOpacity>

              {/* Beğeni Bilgisi ve Butonu - Ayrı bir bileşen */}
              <View style={styles.likeContainer}>
                <View style={styles.likeInfo}>
                  <MaterialCommunityIcons name="heart" size={16} color="#e91e63" />
                  <ThemedText style={styles.likeCount}>
                    {item.likes || 0} beğeni
                  </ThemedText>
                </View>

                {/* Beğeni Butonu - Ayrı bir TouchableOpacity */}
                <TouchableOpacity
                  style={styles.likeButton}
                  onPress={() => handleLike(item)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Dokunma alanını genişlet
                >
                  <MaterialCommunityIcons
                    name={isLikedByUser(item) ? "heart" : "heart-outline"}
                    size={22}
                    color={isLikedByUser(item) ? "#e91e63" : "#4c669f"}
                  />
                </TouchableOpacity>
              </View>
            </View>
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
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
  likeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  likeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  likeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
});
