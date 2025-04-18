import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function TripDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<any>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        // AsyncStorage'dan AI yanıtını alıyoruz
        const aiResponse = await AsyncStorage.getItem('aiTripResponse');
        
        if (aiResponse) {
          // JSON olarak parse etmeye çalışıyoruz
          try {
            // Son işaretçilerden temizleme (varsa ```json ve ``` işaretçilerini kaldırıyoruz)
            const cleanedResponse = aiResponse
              .replace(/```json/g, '')
              .replace(/```/g, '')
              .trim();
              
            const parsedData = JSON.parse(cleanedResponse);
            setTripData(parsedData);
          } catch (parseError) {
            console.error('JSON parse hatası:', parseError);
            // JSON olarak parse edilemiyorsa düz metin olarak gösteriyoruz
            setTripData({ rawResponse: aiResponse });
          }
        } else {
          console.error('AI yanıtı bulunamadı');
        }
      } catch (error) {
        console.error('Veri çekme hatası:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, []);

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
          {tripData.destinationInfo && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Destinasyon Bilgileri</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.destinationName}>{tripData.destinationInfo.name}</ThemedText>
                <ThemedText style={styles.infoItem}>Ülke: {tripData.destinationInfo.country}</ThemedText>
                <ThemedText style={styles.infoItem}>En İyi Ziyaret Zamanı: {tripData.destinationInfo.bestTimeToVisit}</ThemedText>
                <ThemedText style={styles.infoItem}>Dil: {tripData.destinationInfo.language}</ThemedText>
                <ThemedText style={styles.infoItem}>Saat Dilimi: {tripData.destinationInfo.timezone}</ThemedText>
                <ThemedText style={styles.infoItem}>Para Birimi: {tripData.destinationInfo.currency}</ThemedText>
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
          {tripData.hotelOptions && tripData.hotelOptions.length > 0 && (
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
          {tripData.itinerary && tripData.itinerary.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Gezi Planı</ThemedText>
              {tripData.itinerary.map((day: any, dayIndex: number) => (
                <View key={dayIndex} style={styles.dayCard}>
                  <ThemedText style={styles.dayTitle}>{day.day}</ThemedText>
                  {day.plan && day.plan.map((activity: any, actIndex: number) => (
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
          {tripData.visaInfo && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Vize ve Pasaport Bilgileri</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.infoItem}>Vize Gerekliliği: {tripData.visaInfo.visaRequirement}</ThemedText>
                <ThemedText style={styles.infoItem}>Vize Başvuru Süreci: {tripData.visaInfo.visaApplicationProcess}</ThemedText>
                {tripData.visaInfo.requiredDocuments && (
                  <>
                    <ThemedText style={styles.subTitle}>Gerekli Belgeler:</ThemedText>
                    {tripData.visaInfo.requiredDocuments.map((doc: string, index: number) => (
                      <ThemedText key={index} style={styles.listItem}>• {doc}</ThemedText>
                    ))}
                  </>
                )}
                {tripData.visaInfo.visaFee && (
                  <ThemedText style={styles.infoItem}>Vize Ücreti: {tripData.visaInfo.visaFee}</ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Kültürel Farklılıklar */}
          {tripData.culturalDifferences && (
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
          {tripData.localTips && (
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
