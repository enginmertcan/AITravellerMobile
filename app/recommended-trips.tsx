import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Alert, Image, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TravelPlan } from './types/travel';
import { FirebaseService } from './services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import AppStyles from '@/constants/AppStyles';

export default function RecommendedTripsScreen() {
  const [recommendedPlans, setRecommendedPlans] = useState<Partial<TravelPlan>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { userId } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Stil tanımlamalarını isDark değişkenine göre oluştur
  const styles = getStyles(isDark);

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

    // Haptic feedback
    if (Platform.OS === 'ios') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptic feedback not available');
      }
    }

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

  // Rastgele gradient renkleri oluştur
  const getRandomGradient = (index: number) => {
    const gradients = [
      ['#4c669f', '#3b5998', '#192f6a'], // Mavi
      ['#36D1DC', '#5B86E5', '#376bdb'], // Açık Mavi
      ['#FF416C', '#FF4B2B', '#c62f2f'], // Kırmızı
      ['#11998e', '#38ef7d', '#0f8c7f'], // Yeşil
      ['#8E2DE2', '#4A00E0', '#5e00e0'], // Mor
      ['#F2994A', '#F2C94C', '#c67b3b'], // Turuncu
      ['#614385', '#516395', '#3f4e74'], // Mor-Mavi
      ['#02AABB', '#00CDAC', '#01a0b0'], // Turkuaz
    ];
    return gradients[index % gradients.length];
  };

  return (
    <View style={[styles.container, { backgroundColor: AppStyles.colors.dark.background }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Önerilen Seyahatler</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Diğer kullanıcıların önerdiği seyahat planlarını keşfedin
        </ThemedText>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5d77af" />
          <ThemedText style={styles.loadingText}>Önerilen seyahatler yükleniyor...</ThemedText>
        </View>
      ) : recommendedPlans.length > 0 ? (
        <FlatList
          data={recommendedPlans}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          style={{ backgroundColor: AppStyles.colors.dark.background }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={AppStyles.colors.primaryLight}
              colors={[AppStyles.colors.primaryLight]}
            />
          }
          renderItem={({ item, index }) => (
            <View style={styles.planCard}>
              {/* Gradient Başlık */}
              <LinearGradient
                colors={getRandomGradient(index)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardHeader}
              >
                {/* Öneri Rozeti */}
                <View style={styles.recommendationBadge}>
                  <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                  <ThemedText style={styles.recommendationText}>Önerilen</ThemedText>
                </View>
                {/* Beğeni Sayısı Rozeti */}
                <View style={styles.likeCountBadge}>
                  <MaterialCommunityIcons name="heart" size={14} color="#e91e63" />
                  <ThemedText style={styles.likeCountBadgeText}>
                    {item.likes || 0}
                  </ThemedText>
                </View>

                {/* Beğeni Butonu */}
                <TouchableOpacity
                  style={[
                    styles.likeButtonHeader,
                    isLikedByUser(item) && styles.likeButtonHeaderActive
                  ]}
                  onPress={() => handleLike(item)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name={isLikedByUser(item) ? "heart" : "heart-outline"}
                    size={22}
                    color={isLikedByUser(item) ? "#e91e63" : "#ffffff"}
                  />
                </TouchableOpacity>

                {/* Uçak İkonu (Dekoratif) */}
                <View style={styles.planeIconContainer}>
                  <MaterialCommunityIcons name="airplane" size={80} color="rgba(255,255,255,0.2)" />
                </View>

                <ThemedText style={styles.cardHeaderTitle} numberOfLines={1} ellipsizeMode="tail">
                  {item.destination || 'İsimsiz Destinasyon'}
                </ThemedText>

                <View style={styles.cardHeaderDetails}>
                  <View style={styles.cardHeaderDetailItem}>
                    <MaterialCommunityIcons name="map-marker" size={16} color="#ffffff" />
                    <ThemedText style={styles.cardHeaderDetailText}>
                      {item.country || 'Belirtilmemiş'}
                    </ThemedText>
                  </View>
                </View>

                {/* Yurt içi/Yurt dışı gösterimi - Ayrı bir satırda */}
                {item.isDomestic !== undefined && (
                  <View style={styles.chipRow}>
                    <View style={[styles.chipContainer, item.isDomestic ? styles.chipDomestic : styles.chipInternational]}>
                      <ThemedText style={styles.chipText}>
                        {item.isDomestic ? 'Yurtiçi' : 'Yurtdışı'}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </LinearGradient>

              {/* Kart İçeriği */}
              <View style={styles.planCardContent}>
                <View style={styles.planDetails}>
                  {item.startDate && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons
                        name="calendar"
                        size={16}
                        color={AppStyles.colors.primaryLight}
                      />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.startDate}
                      </ThemedText>
                    </View>
                  )}
                  {(item.days || item.duration) && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={16}
                        color={AppStyles.colors.primaryLight}
                      />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.days || item.duration} gün
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.planDetails}>
                  {item.budget && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons
                        name="wallet-outline"
                        size={16}
                        color={AppStyles.colors.primaryLight}
                      />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.budget}
                      </ThemedText>
                    </View>
                  )}
                  {item.groupType && (
                    <View style={styles.planDetailItem}>
                      <MaterialCommunityIcons
                        name="account-group-outline"
                        size={16}
                        color={AppStyles.colors.primaryLight}
                      />
                      <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">
                        {item.groupType}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* Detay Butonu */}
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={() => selectPlan(item)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.detailButtonText}>Detayları Görüntüle</ThemedText>
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#ffffff" />
                </TouchableOpacity>

                {/* Kullanıcı Bilgisi */}
                {item.userId && (
                  <View style={styles.userInfoContainer}>
                    <MaterialCommunityIcons
                      name="account"
                      size={14}
                      color="#aaa"
                    />
                    <ThemedText style={styles.userInfoText}>
                      {item.userId === userId ? 'Sizin tarafınızdan önerildi' : 'Başka bir kullanıcı tarafından önerildi'}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="map-search"
            size={80}
            color="#5d77af"
          />
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

// StyleSheet'i fonksiyon içinde oluşturalım
const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppStyles.colors.dark.background,
    paddingBottom: 20,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    ...AppStyles.typography.title,
    color: AppStyles.colors.dark.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...AppStyles.typography.caption,
    color: AppStyles.colors.dark.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.background,
  },
  loadingText: {
    marginTop: 16,
    ...AppStyles.typography.body,
    color: AppStyles.colors.dark.text,
  },
  listContent: {
    padding: 16,
    backgroundColor: AppStyles.colors.dark.background,
  },
  planCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: AppStyles.borderRadius.lg,
    marginBottom: 24,
    ...AppStyles.shadows.medium,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
  },
  recommendationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  recommendationText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 24,
    position: 'relative',
  },
  cardHeaderTitle: {
    ...AppStyles.typography.subtitle,
    color: '#ffffff',
    marginTop: 30, // Öneri rozetinin altında kalması için margin ekledik
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardHeaderDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderDetailText: {
    ...AppStyles.typography.small,
    color: '#ffffff',
    marginLeft: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chipContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
  },
  chipDomestic: {
    backgroundColor: 'rgba(52, 199, 89, 0.3)',
  },
  chipInternational: {
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  chipText: {
    ...AppStyles.typography.small,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  likeCountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(70, 70, 70, 0.5)',
  },
  likeCountBadgeText: {
    color: '#e0e0e0',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  likeButtonHeader: {
    position: 'absolute',
    top: 50, // Şehir isminin altında olması için
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...AppStyles.shadows.small,
  },
  likeButtonHeaderActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.3)',
    borderColor: 'rgba(233, 30, 99, 0.6)',
  },
  planeIconContainer: {
    position: 'absolute',
    top: -20,
    right: -20,
    opacity: 0.2,
    transform: [{ rotate: '15deg' }],
  },
  planCardContent: {
    padding: 16,
    backgroundColor: AppStyles.colors.dark.cardAlt,
  },
  planDetails: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  planDetailText: {
    ...AppStyles.typography.small,
    marginLeft: 4,
    color: AppStyles.colors.dark.text,
  },
  detailButton: {
    backgroundColor: AppStyles.colors.primary,
    borderRadius: AppStyles.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: AppStyles.colors.primaryLight,
    ...AppStyles.shadows.small,
  },
  detailButtonText: {
    ...AppStyles.typography.small,
    color: '#ffffff',
    fontWeight: 'bold',
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: AppStyles.colors.dark.background,
  },
  emptyText: {
    ...AppStyles.typography.subtitle,
    color: AppStyles.colors.dark.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    ...AppStyles.typography.caption,
    marginTop: 8,
    textAlign: 'center',
    color: AppStyles.colors.dark.textMuted,
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
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  userInfoText: {
    ...AppStyles.typography.small,
    color: AppStyles.colors.dark.textMuted,
    marginLeft: 4,
  },
}); // getStyles fonksiyonunun sonu