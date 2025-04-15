import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TravelPlan, DEFAULT_TRAVEL_PLAN } from './types/travel';
import { safeParseJSON } from './types/travel';
import { FirebaseService } from './services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';

export default function TripDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<Partial<TravelPlan>>(DEFAULT_TRAVEL_PLAN);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const planId = params.id as string | undefined;

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        setLoading(true);
        
        if (planId) {
          // Belirli bir plan ID'si varsa, onu Firebase'den çekelim
          console.log('Firebase\'den belirli seyahat planı çekiliyor, ID:', planId);
          const plan = await FirebaseService.TravelPlan.getTravelPlanById(planId);
          
          if (plan && Object.keys(plan).length > 0) {
            console.log('Plan başarıyla çekildi');
            setTripData(plan);
          } else {
            console.error('Plan bulunamadı:', planId);
            // Kullanıcının planlarına düşelim
            await loadUserPlans();
          }
        } else {
          // Plan ID yoksa kullanıcının planlarını çekelim
          await loadUserPlans();
        }
      } catch (error) {
        console.error('Veri çekme hatası:', error);
        setTripData(DEFAULT_TRAVEL_PLAN);
      } finally {
        setLoading(false);
      }
    };
    
    // Kullanıcının planlarını çeken yardımcı fonksiyon
    const loadUserPlans = async () => {
      // Sabit test dataları - kullanıcı ID olmayan durumda kullan
      // Sadece test amaçlı, gerçek uygulamanın akışında bu silinecek
      const testTravelPlan = {
        ...DEFAULT_TRAVEL_PLAN,
        destination: "Paris",
        destinationInfo: {
          name: "Paris",
          country: "Fransa",
          bestTimeToVisit: "Nisan-Ekim arası",
          language: "Fransızca",
          timezone: "GMT+1",
          currency: "Euro (EUR)"
        },
        tripSummary: {
          duration: "7 gün",
          travelers: "2 kişi",
          budget: "Orta"
        }
      };
      
      if (userId) {
        console.log('Kullanıcının seyahat planları çekiliyor...');
        try {
          const userPlans = await FirebaseService.TravelPlan.getUserTravelPlans(userId);
          
          if (userPlans && userPlans.length > 0) {
            console.log('Kullanıcının seyahat planları başarıyla alındı');
            // En son oluşturulan planı gösterelim
            setTripData(userPlans[0]); 
            return;
          }
        } catch (error) {
          console.error('Plan çekme hatası:', error);
        }
      }
      
      console.log('Kullanıcı ID bulunamadı veya planları yoktu, örnek veri gösteriliyor');
      // Kullanıcı yoksa veya planları yoksa örnek test planını göster
      setTripData(testTravelPlan);
    };

    fetchTripData();
  }, [userId, planId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4c669f" />
        <ThemedText style={styles.loadingText}>Seyahat planınız hazırlanıyor...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Seyahat Planı</ThemedText>
      </View>

      {tripData ? (
        <View style={styles.content}>
          {/* Destinasyon Bilgileri */}
          {tripData && tripData.destinationInfo && typeof tripData.destinationInfo === 'object' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Destinasyon Bilgileri</ThemedText>
              <View style={styles.card}>
                {tripData.destinationInfo.name && (
                  <ThemedText style={styles.destinationName}>{tripData.destinationInfo.name}</ThemedText>
                )}
                {tripData.destinationInfo.country && (
                  <ThemedText style={styles.infoItem}>Ülke: {tripData.destinationInfo.country}</ThemedText>
                )}
                {tripData.destinationInfo.bestTimeToVisit && (
                  <ThemedText style={styles.infoItem}>En İyi Ziyaret Zamanı: {tripData.destinationInfo.bestTimeToVisit}</ThemedText>
                )}
                {tripData.destinationInfo.language && (
                  <ThemedText style={styles.infoItem}>Dil: {tripData.destinationInfo.language}</ThemedText>
                )}
                {tripData.destinationInfo.timezone && (
                  <ThemedText style={styles.infoItem}>Saat Dilimi: {tripData.destinationInfo.timezone}</ThemedText>
                )}
                {tripData.destinationInfo.currency && (
                  <ThemedText style={styles.infoItem}>Para Birimi: {tripData.destinationInfo.currency}</ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Seyahat Özeti */}
          {tripData.tripSummary && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Özeti</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.infoItem}>Süre: {tripData.tripSummary.duration} gün</ThemedText>
                <ThemedText style={styles.infoItem}>Seyahat Edenler: {tripData.tripSummary.travelers}</ThemedText>
                <ThemedText style={styles.infoItem}>Bütçe: {tripData.tripSummary.budget}</ThemedText>
              </View>
            </View>
          )}

          {/* Otel Seçenekleri */}
          {tripData.hotelOptions && Array.isArray(tripData.hotelOptions) && tripData.hotelOptions.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Konaklama Seçenekleri</ThemedText>
              {tripData.hotelOptions.map((hotel: any, index: number) => (
                <View key={index} style={styles.card}>
                  <ThemedText style={styles.hotelName}>{hotel.hotelName}</ThemedText>
                  <ThemedText style={styles.infoItem}>{hotel.hotelAddress}</ThemedText>
                  <ThemedText style={styles.infoItem}>Fiyat: {hotel.price}</ThemedText>
                  <ThemedText style={styles.infoItem}>Değerlendirme: {hotel.rating}</ThemedText>
                  <ThemedText style={styles.description}>{hotel.description}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Gezi Planı */}
          {tripData.itinerary && Array.isArray(tripData.itinerary) && tripData.itinerary.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Gezi Planı</ThemedText>
              {tripData.itinerary.map((day: any, dayIndex: number) => (
                <View key={dayIndex} style={styles.dayCard}>
                  <ThemedText style={styles.dayTitle}>{day.day}</ThemedText>
                  {day.plan && Array.isArray(day.plan) && day.plan.map((activity: any, actIndex: number) => (
                    <View key={actIndex} style={styles.activityCard}>
                      <ThemedText style={styles.activityTime}>{activity.time}</ThemedText>
                      <ThemedText style={styles.activityName}>{activity.placeName}</ThemedText>
                      <ThemedText style={styles.activityDetails}>{activity.placeDetails}</ThemedText>
                      {activity.ticketPricing && (
                        <ThemedText style={styles.infoItem}>Bilet: {activity.ticketPricing}</ThemedText>
                      )}
                      {activity.timeToTravel && (
                        <ThemedText style={styles.infoItem}>Ulaşım Süresi: {activity.timeToTravel}</ThemedText>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Vize Bilgileri */}
          {tripData && tripData.visaInfo && typeof tripData.visaInfo === 'object' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Vize ve Pasaport Bilgileri</ThemedText>
              <View style={styles.card}>
                {tripData.visaInfo.visaRequirement && (
                  <ThemedText style={styles.infoItem}>Vize Gerekliliği: {tripData.visaInfo.visaRequirement}</ThemedText>
                )}
                {tripData.visaInfo.visaApplicationProcess && (
                  <ThemedText style={styles.infoItem}>Vize Başvuru Süreci: {tripData.visaInfo.visaApplicationProcess}</ThemedText>
                )}
                {tripData.visaInfo.requiredDocuments && Array.isArray(tripData.visaInfo.requiredDocuments) && tripData.visaInfo.requiredDocuments.length > 0 ? (
                  <>
                    <ThemedText style={styles.subTitle}>Gerekli Belgeler:</ThemedText>
                    {tripData.visaInfo.requiredDocuments.map((doc: string, index: number) => (
                      <ThemedText key={index} style={styles.listItem}><ThemedText>{"\u2022"}</ThemedText> {doc}</ThemedText>
                    ))}
                  </>
                ) : (
                  <ThemedText style={styles.infoItem}>Vize belgeleri bilgisi yok</ThemedText>
                )}
                {tripData.visaInfo.visaFee && (
                  <ThemedText style={styles.infoItem}>Vize Ücreti: {tripData.visaInfo.visaFee}</ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Kültürel Farklılıklar */}
          {tripData.culturalDifferences && typeof tripData.culturalDifferences === 'object' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Kültürel Farklılıklar</ThemedText>
              <View style={styles.card}>
                {Object.entries(tripData.culturalDifferences).map(([key, value]: [string, any]) => (
                  <ThemedText key={key} style={styles.infoItem}>
                    {value}
                  </ThemedText>
                ))}
              </View>
            </View>
          )}

          {/* Yerel İpuçları */}
          {tripData.localTips && typeof tripData.localTips === 'object' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Yerel İpuçları</ThemedText>
              <View style={styles.card}>
                {Object.entries(tripData.localTips).map(([key, value]: [string, any]) => (
                  <ThemedText key={key} style={styles.infoItem}>
                    {value}
                  </ThemedText>
                ))}
              </View>
            </View>
          )}

          {/* AI yanıtı düzgün parse edilememişse ham yanıtı göster */}
          {tripData.rawResponse && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Planı</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.rawResponse}>{tripData.rawResponse}</ThemedText>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={50} color="#ff6b6b" />
          <ThemedText style={styles.errorText}>
            Seyahat planı yüklenemedi. Lütfen tekrar deneyin.
          </ThemedText>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'SpaceMono',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  dayCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4c669f',
    marginBottom: 12,
    fontFamily: 'SpaceMono',
  },
  activityCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  activityTime: {
    color: '#4c669f',
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  activityName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  activityDetails: {
    color: '#999',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  destinationName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'SpaceMono',
  },
  hotelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  infoItem: {
    color: '#ccc',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  description: {
    color: '#999',
    marginTop: 8,
    fontFamily: 'SpaceMono',
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  listItem: {
    color: '#ccc',
    marginBottom: 4,
    marginLeft: 8,
    fontFamily: 'SpaceMono',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  rawResponse: {
    color: '#ccc',
    fontFamily: 'SpaceMono',
  },
});
