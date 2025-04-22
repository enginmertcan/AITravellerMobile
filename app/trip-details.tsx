import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform, FlatList } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TravelPlan, DEFAULT_TRAVEL_PLAN } from './types/travel';
import { safeParseJSON } from './types/travel';
import { FirebaseService } from './services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';
import { getWeatherForecast, WeatherData } from './services/weather.service';
import WeatherCard from './components/WeatherCard';

export default function TripDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<Partial<TravelPlan>>(DEFAULT_TRAVEL_PLAN);
  const [userPlans, setUserPlans] = useState<Partial<TravelPlan>[]>([]);
  const [showPlansList, setShowPlansList] = useState(true); // True to show list, false to show details
  const [weatherData, setWeatherData] = useState<WeatherData[] | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const planId = params.id as string | undefined;

  // Belirli bir planı seçmek için
  const selectPlan = (plan: Partial<TravelPlan>) => {
    // İtinerary alanını parse et
    if (plan.itinerary && typeof plan.itinerary === 'string') {
      try {
        const parsedItinerary = safeParseJSON(plan.itinerary);
        if (parsedItinerary) {
          console.log('Seçilen plan itinerary başarıyla parse edildi');
          plan.itinerary = parsedItinerary;
        }
      } catch (parseError) {
        console.error('Seçilen plan itinerary parse hatası:', parseError);
      }
    }

    setTripData(plan);
    setShowPlansList(false); // Detay görünümüne geç

    // Hava durumu verilerini getir
    fetchWeatherData(plan);

    // URL'i güncelle ama sayfayı yeniden yükleme
    if (plan.id) {
      router.setParams({ id: plan.id });
    }
  };

  // Hava durumu verilerini getir
  const fetchWeatherData = async (plan: Partial<TravelPlan>) => {
    if (!plan.destination) return;

    setWeatherLoading(true);
    try {
      // Destinasyon bilgisini al
      const destination = plan.destination;

      // Tarih bilgisini al (plan.startDate veya bugünün tarihi)
      let tripDate: Date;
      if (plan.startDate) {
        // startDate formatı "DD/MM/YYYY" olarak kabul edilir
        const [day, month, year] = plan.startDate.split('/').map(Number);
        tripDate = new Date(year, month - 1, day); // Ay 0-11 arasında olduğu için -1
      } else {
        tripDate = new Date(); // Bugünün tarihi
      }

      // Tarih geçerli değilse bugünün tarihini kullan
      if (isNaN(tripDate.getTime())) {
        tripDate = new Date();
      }

      // Plan verilerini debug için logla
      console.log('Plan verileri:', {
        destination: plan.destination,
        startDate: plan.startDate,
        duration: plan.duration,
        days: plan.days,
        tripSummary: plan.tripSummary ? {
          duration: plan.tripSummary.duration,
          travelers: plan.tripSummary.travelers,
          budget: plan.tripSummary.budget
        } : null,
        itineraryType: typeof plan.itinerary
      });

      // Konaklama süresi (gün sayısı)
      let durationDays = 1;

      // duration değerini kontrol et (sayı veya string olabilir)
      if (plan.duration) {
        if (typeof plan.duration === 'number') {
          durationDays = plan.duration;
        } else if (typeof plan.duration === 'string') {
          // "3 days" gibi string'den sayıyı çıkar
          const durationStr = plan.duration as string;
          const durationMatch = durationStr.match(/\d+/);
          if (durationMatch) {
            durationDays = parseInt(durationMatch[0], 10);
          }
        }
      }

      // Eğer duration'dan gün sayısı çıkarılamadıysa days alanını kontrol et
      if (durationDays === 1 && plan.days) {
        if (typeof plan.days === 'number') {
          durationDays = plan.days;
        } else if (typeof plan.days === 'string') {
          const daysStr = plan.days as string;
          const daysMatch = daysStr.match(/\d+/);
          if (daysMatch) {
            durationDays = parseInt(daysMatch[0], 10);
          }
        }
      }

      // tripSummary içindeki duration bilgisini kontrol et
      if (durationDays === 1 && plan.tripSummary && plan.tripSummary.duration) {
        const durationStr = plan.tripSummary.duration as string;
        const durationMatch = durationStr.match(/\d+/);
        if (durationMatch) {
          durationDays = parseInt(durationMatch[0], 10);
        }
      }

      // Hala 1 gün ise, itinerary içindeki gün sayısını kontrol et
      if (durationDays === 1 && plan.itinerary) {
        if (typeof plan.itinerary === 'object' && Array.isArray(plan.itinerary)) {
          durationDays = Math.max(1, plan.itinerary.length);
        } else if (typeof plan.itinerary === 'object' && plan.itinerary.itinerary && Array.isArray(plan.itinerary.itinerary)) {
          durationDays = Math.max(1, plan.itinerary.itinerary.length);
        } else if (typeof plan.itinerary === 'string') {
          // JSON string olarak saklanmış itinerary'yi parse etmeyi dene
          try {
            const parsedItinerary = safeParseJSON(plan.itinerary);
            if (parsedItinerary) {
              if (Array.isArray(parsedItinerary)) {
                durationDays = Math.max(1, parsedItinerary.length);
              } else if (parsedItinerary.itinerary && Array.isArray(parsedItinerary.itinerary)) {
                durationDays = Math.max(1, parsedItinerary.itinerary.length);
              }
            }
          } catch (error) {
            console.error('Itinerary parse hatası:', error);
          }
        }
      }

      console.log('Tespit edilen konaklama süresi:', durationDays, 'gün');

      // En az 1, en fazla 15 gün olacak şekilde sınırla
      durationDays = Math.max(1, Math.min(15, durationDays));

      console.log(`Hava durumu getiriliyor: ${destination}, Tarih: ${tripDate.toISOString().split('T')[0]}, Süre: ${durationDays} gün`);

      // Hava durumu verilerini getir
      const forecast = await getWeatherForecast(destination, tripDate, durationDays);

      if (forecast && forecast.length > 0) {
        setWeatherData(forecast);
        console.log(`${forecast.length} günlük hava durumu verileri başarıyla alındı`);
      } else {
        console.warn('Hava durumu verileri alınamadı');
        setWeatherData(null);
      }
    } catch (error) {
      console.error('Hava durumu verileri getirme hatası:', error);
      setWeatherData(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Sayfa yüklenirken veya yenilenirken çağrılan fonksiyon
  const loadData = async () => {
    console.log('loadData çağrıldı, planId:', planId);
    try {
      setLoading(true);

      // Önce kullanıcının tüm planlarını çekelim
      if (userId) {
        console.log('Kullanıcının tüm seyahat planları çekiliyor...');
        const plans = await FirebaseService.TravelPlan.getUserTravelPlans(userId);

        if (plans && plans.length > 0) {
          console.log(`${plans.length} seyahat planı bulundu.`);
          // Her planın itinerary alanını parse et
          const parsedPlans = plans.map(plan => {
            if (plan.itinerary && typeof plan.itinerary === 'string') {
              try {
                const parsedItinerary = safeParseJSON(plan.itinerary);
                if (parsedItinerary) {
                  plan.itinerary = parsedItinerary;
                }
              } catch (error) {
                console.error('Plan parse hatası:', error);
              }
            }
            return plan;
          });

          setUserPlans(parsedPlans);

          // Eğer belirli bir plan ID'si varsa, o planı göster
          if (planId) {
            const selectedPlan = parsedPlans.find(p => p.id === planId);
            if (selectedPlan) {
              console.log('Plan bulundu ve seçildi:', planId);
              setTripData(selectedPlan);
              setShowPlansList(false);
              fetchWeatherData(selectedPlan); // Hava durumu verilerini getir
              return; // Fonksiyondan çık
            } else {
              // Planlar içinde bulunamadıysa, Firebase'den direkt çekmeyi dene
              await loadSinglePlan(planId);
            }
          } else {
            // Plan ID yoksa liste görünümünü göster
            setShowPlansList(true);
          }
        } else {
          console.log('Kullanıcı için plan bulunamadı');
          setUserPlans([]);
          setShowPlansList(true);

          // Yine de belirli bir plan ID'si varsa, onu yüklemeyi dene
          if (planId) {
            await loadSinglePlan(planId);
          }
        }
      } else {
        console.log('Kullanıcı ID bulunamadı');
        setUserPlans([]);
        setShowPlansList(true);

        // Kullanıcı yoksa bile belirli bir plan ID'si varsa, onu yüklemeyi dene
        if (planId) {
          await loadSinglePlan(planId);
        }
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      setUserPlans([]);
      setTripData(DEFAULT_TRAVEL_PLAN);
      setShowPlansList(true);
    } finally {
      setLoading(false);
    }
  };

  // Tek bir planı ID'ye göre yükle
  const loadSinglePlan = async (id: string) => {
    try {
      console.log('Firebase\'den belirli seyahat planı çekiliyor, ID:', id);
      const plan = await FirebaseService.TravelPlan.getTravelPlanById(id);

      if (plan && Object.keys(plan).length > 0) {
        console.log('Plan başarıyla çekildi');

        // İtinerary alanını parse et
        if (plan.itinerary && typeof plan.itinerary === 'string') {
          try {
            const parsedItinerary = safeParseJSON(plan.itinerary);
            if (parsedItinerary) {
              console.log('İtinerary başarıyla parse edildi');
              plan.itinerary = parsedItinerary;
            } else {
              console.error('İtinerary parse edilemedi');
            }
          } catch (parseError) {
            console.error('İtinerary parse hatası:', parseError);
          }
        }

        setTripData(plan);
        setShowPlansList(false); // Detay görünümünü göster
        fetchWeatherData(plan); // Hava durumu verilerini getir
        return true;
      } else {
        console.error('Plan bulunamadı:', id);
        setShowPlansList(true); // Liste görünümüne dön
        return false;
      }
    } catch (error) {
      console.error('Plan yükleme hatası:', error);
      setShowPlansList(true);
      return false;
    }
  };

  // Component mount olduğunda veya userId/planId değiştiğinde veriyi yükle
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, planId]);

  // Plan listesine geri dönmek için
  const handleBackToList = () => {
    setShowPlansList(true);
    router.setParams({ id: '' }); // URL'den ID'yi kaldır
  };

  // Sayfayı manuel olarak yenilemek için
  const handleRefresh = () => {
    loadData();
    if (!showPlansList && tripData) {
      fetchWeatherData(tripData);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4c669f" />
        <ThemedText style={styles.loadingText}>Seyahat planınız hazırlanıyor...</ThemedText>
      </View>
    );
  }

  // Eğer liste görünümü aktifse, kullanıcının planlarını listele
  if (showPlansList) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Seyahat Planlarım</ThemedText>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <MaterialCommunityIcons name="refresh" size={24} color="#4c669f" />
          </TouchableOpacity>
        </View>

        {userPlans.length > 0 ? (
          <FlatList
            data={userPlans}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.planCard}
                onPress={() => selectPlan(item)}
              >
                <View style={styles.planCardContent}>
                  <ThemedText style={styles.planDestination}>{item.destination || 'İsimsiz Destinasyon'}</ThemedText>
                  <View style={styles.planDetails}>
                    {item.startDate && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="calendar" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText}>{item.startDate}</ThemedText>
                      </View>
                    )}
                    {item.duration && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText}>{item.duration} gün</ThemedText>
                      </View>
                    )}
                    {item.budget && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="wallet-outline" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText}>{item.budget}</ThemedText>
                      </View>
                    )}
                    {item.groupType && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="account-group-outline" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText}>{item.groupType}</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#4c669f" />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="map-search-outline" size={80} color="#4c669f" />
            <ThemedText style={styles.emptyText}>
              Henüz seyahat planınız bulunmuyor.
            </ThemedText>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/')}
            >
              <ThemedText style={styles.createButtonText}>Yeni Plan Oluştur</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Detay görünümü - seçilen planın detaylarını göster
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToList}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Seyahat Planı</ThemedText>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <MaterialCommunityIcons name="refresh" size={24} color="#4c669f" />
        </TouchableOpacity>
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
          {tripData.hotelOptions && (() => {
            // İtinerary içindeki hotelOptions'ı kontrol et
            let hotelOptionsToUse = tripData.hotelOptions;

            // Eğer itinerary bir obje ve içinde hotelOptions varsa, onu kullan
            if (tripData.itinerary && typeof tripData.itinerary === 'object' &&
                tripData.itinerary.hotelOptions && Array.isArray(tripData.itinerary.hotelOptions)) {
              hotelOptionsToUse = tripData.itinerary.hotelOptions;
              console.log('İtinerary içindeki hotelOptions kullanılıyor');
            }

            if (Array.isArray(hotelOptionsToUse) && hotelOptionsToUse.length > 0) {
              return (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Konaklama Seçenekleri</ThemedText>
                  {hotelOptionsToUse.map((hotel: any, index: number) => (
                    <View key={index} style={styles.card}>
                      <ThemedText style={styles.hotelName}>{hotel.hotelName}</ThemedText>
                      <ThemedText style={styles.infoItem}>{hotel.hotelAddress}</ThemedText>
                      <ThemedText style={styles.infoItem}>Fiyat: {hotel.priceRange || hotel.price || 'Belirtilmemiş'}</ThemedText>
                      <ThemedText style={styles.infoItem}>Değerlendirme: {hotel.rating}</ThemedText>
                      <ThemedText style={styles.description}>{hotel.description}</ThemedText>
                    </View>
                  ))}
                </View>
              );
            }
            return null;
          })()}

          {/* Gezi Planı */}
          {(() => {
            // İtinerary'yi kontrol et ve doğru formatı bul
            let itineraryToUse = null;

            if (tripData.itinerary) {
              // Direkt array ise kullan
              if (Array.isArray(tripData.itinerary)) {
                itineraryToUse = tripData.itinerary;
                console.log('İtinerary array olarak kullanılıyor');
              }
              // Obje içinde itinerary array'i varsa onu kullan
              else if (typeof tripData.itinerary === 'object' &&
                       tripData.itinerary.itinerary &&
                       Array.isArray(tripData.itinerary.itinerary)) {
                itineraryToUse = tripData.itinerary.itinerary;
                console.log('İtinerary objesi içindeki itinerary array kullanılıyor');
              }
            }

            if (itineraryToUse && itineraryToUse.length > 0) {
              return (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Gezi Planı</ThemedText>
                  {itineraryToUse.map((day: any, dayIndex: number) => (
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
              );
            }
            return null;
          })()}

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

          {/* Temel Seyahat Bilgileri */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Seyahat Bilgileri</ThemedText>
            <View style={styles.card}>
              <ThemedText style={styles.infoItem}>Destinasyon: {tripData.destination}</ThemedText>
              {tripData.startDate && <ThemedText style={styles.infoItem}>Başlangıç Tarihi: {tripData.startDate}</ThemedText>}
              {tripData.duration && <ThemedText style={styles.infoItem}>Süre: {tripData.duration} gün</ThemedText>}
              {tripData.budget && <ThemedText style={styles.infoItem}>Bütçe: {tripData.budget}</ThemedText>}
              {tripData.groupType && <ThemedText style={styles.infoItem}>Grup Tipi: {tripData.groupType}</ThemedText>}
              {tripData.numberOfPeople && <ThemedText style={styles.infoItem}>Kişi Sayısı: {tripData.numberOfPeople}</ThemedText>}
              {tripData.bestTimeToVisit && <ThemedText style={styles.infoItem}>En İyi Ziyaret Zamanı: {tripData.bestTimeToVisit}</ThemedText>}
            </View>
          </View>

          {/* Hava Durumu */}
          {weatherLoading ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Hava Durumu</ThemedText>
              <View style={[styles.card, styles.weatherLoadingContainer]}>
                <ActivityIndicator size="small" color="#4c669f" />
                <ThemedText style={styles.weatherLoadingText}>Hava durumu bilgileri yükleniyor...</ThemedText>
              </View>
            </View>
          ) : weatherData ? (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Hava Durumu</ThemedText>
              <WeatherCard weatherData={weatherData} />
            </View>
          ) : null}

          {/* AI yanıtı düzgün parse edilememişse ham yanıtı göster */}
          {tripData.rawResponse && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Planı</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.rawResponse}>{tripData.rawResponse}</ThemedText>
              </View>
            </View>
          )}

          {/* İtinerary string olarak kalmışsa göster */}
          {tripData.itinerary && typeof tripData.itinerary === 'string' && tripData.itinerary !== '' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Planı (JSON)</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.rawResponse}>{tripData.itinerary}</ThemedText>
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
  refreshButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
    flex: 1,
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
  weatherLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  weatherLoadingText: {
    color: '#ccc',
    marginTop: 8,
    fontFamily: 'SpaceMono',
  },
  // Plan listesi stilleri
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  planCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardContent: {
    flex: 1,
  },
  planDestination: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  planDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  planDetailText: {
    color: '#ccc',
    marginLeft: 4,
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'SpaceMono',
  },
  createButton: {
    backgroundColor: '#4c669f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
});
