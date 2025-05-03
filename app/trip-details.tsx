import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform, FlatList } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TravelPlan, DEFAULT_TRAVEL_PLAN, Hotel, TripPhoto } from './types/travel';
import { safeParseJSON, parseTripPhotos } from './types/travel';
import { FirebaseService } from './services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';
import { getWeatherForecast, WeatherData } from './services/weather.service';
import WeatherCard from './components/WeatherCard';
import TripPhotoUploader from './components/TripPhotoUploader';

export default function TripDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<Partial<TravelPlan>>(DEFAULT_TRAVEL_PLAN);
  const [userPlans, setUserPlans] = useState<Partial<TravelPlan>[]>([]);
  const [showPlansList, setShowPlansList] = useState(true); // True to show list, false to show details
  const [weatherData, setWeatherData] = useState<WeatherData[] | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tripPhotos, setTripPhotos] = useState<TripPhoto[]>([]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const planId = params.id as string | undefined;

  // Belirli bir planı seçmek için
  const selectPlan = async (plan: Partial<TravelPlan>) => {
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

    // Fotoğrafları parse et
    if (plan.tripPhotos) {
      const photos = parseTripPhotos(plan.tripPhotos);

      // Fotoğraf referanslarını kontrol et ve gerekirse verileri getir
      const updatedPhotos = await Promise.all(
        photos.map(async (photo) => {
          // Eğer fotoğrafın imageRef'i varsa ve imageData yoksa
          if (photo.imageRef && !photo.imageData && !photo.imageUrl) {
            try {
              // Firestore'dan fotoğraf verisini getir
              const photoDoc = await FirebaseService.TravelPlan.getPhotoById(photo.imageRef);
              if (photoDoc && photoDoc.imageData) {
                return {
                  ...photo,
                  imageData: photoDoc.imageData
                };
              }
            } catch (error) {
              console.error('Fotoğraf verisi getirme hatası:', error);
            }
          }
          return photo;
        })
      );

      setTripPhotos(updatedPhotos);
      console.log(`${updatedPhotos.length} fotoğraf yüklendi`);
    } else {
      setTripPhotos([]);
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

        // Tarih geçerli değilse bugünün tarihini kullan
        if (isNaN(tripDate.getTime())) {
          console.warn('Geçersiz tarih formatı:', plan.startDate);
          tripDate = new Date();
        }
      } else {
        tripDate = new Date(); // Bugünün tarihi
      }

      console.log('Tarih bilgisi:', {
        startDate: plan.startDate,
        parsedDate: tripDate.toISOString(),
        isValid: !isNaN(tripDate.getTime())
      });

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

        // Fotoğrafları parse et
        if (plan.tripPhotos) {
          const photos = parseTripPhotos(plan.tripPhotos);

          // Fotoğraf referanslarını kontrol et ve gerekirse verileri getir
          const updatedPhotos = await Promise.all(
            photos.map(async (photo) => {
              // Eğer fotoğrafın imageRef'i varsa ve imageData yoksa
              if (photo.imageRef && !photo.imageData && !photo.imageUrl) {
                try {
                  // Firestore'dan fotoğraf verisini getir
                  const photoDoc = await FirebaseService.TravelPlan.getPhotoById(photo.imageRef);
                  if (photoDoc && photoDoc.imageData) {
                    return {
                      ...photo,
                      imageData: photoDoc.imageData
                    };
                  }
                } catch (error) {
                  console.error('Fotoğraf verisi getirme hatası:', error);
                }
              }
              return photo;
            })
          );

          setTripPhotos(updatedPhotos);
          console.log(`${updatedPhotos.length} fotoğraf yüklendi`);
        } else {
          setTripPhotos([]);
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
    // Immediate function to allow async/await
    const fetchData = async () => {
      console.log('useEffect triggered, loading data...');
      await loadData();
    };

    fetchData();
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

  // Fotoğraf eklendiğinde planı yeniden yükle
  const handlePhotoAdded = async () => {
    if (planId) {
      await loadSinglePlan(planId);
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
          <ThemedText style={styles.title} numberOfLines={1} ellipsizeMode="tail">Seyahat Planlarım</ThemedText>
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
                  <ThemedText style={styles.planDestination} numberOfLines={1} ellipsizeMode="tail">{item.destination || 'İsimsiz Destinasyon'}</ThemedText>
                  <View style={styles.planDetails}>
                    {item.startDate && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="calendar" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">{item.startDate}</ThemedText>
                      </View>
                    )}
                    {item.duration && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">{item.duration} gün</ThemedText>
                      </View>
                    )}
                    {item.budget && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="wallet-outline" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">{item.budget}</ThemedText>
                      </View>
                    )}
                    {item.groupType && (
                      <View style={styles.planDetailItem}>
                        <MaterialCommunityIcons name="account-group-outline" size={16} color="#4c669f" />
                        <ThemedText style={styles.planDetailText} numberOfLines={1} ellipsizeMode="tail">{item.groupType}</ThemedText>
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
              onPress={() => router.push('/(tabs)/ai-planner')}
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
        <ThemedText style={styles.title} numberOfLines={1} ellipsizeMode="tail">Seyahat Planı</ThemedText>
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
              // Tip dönüşümü yaparak hotelOptions'ı kullan
              hotelOptionsToUse = tripData.itinerary.hotelOptions as unknown as Hotel[];
              console.log('İtinerary içindeki hotelOptions kullanılıyor');
            }

            if (Array.isArray(hotelOptionsToUse) && hotelOptionsToUse.length > 0) {
              return (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Konaklama Seçenekleri</ThemedText>
                  {hotelOptionsToUse.map((hotel: any, index: number) => (
                    <View key={index} style={styles.card}>
                      <ThemedText style={styles.hotelName} numberOfLines={1} ellipsizeMode="tail">{hotel.hotelName}</ThemedText>
                      <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">{hotel.hotelAddress}</ThemedText>
                      <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Fiyat: {hotel.priceRange || hotel.price || 'Belirtilmemiş'}</ThemedText>
                      <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Değerlendirme: {hotel.rating}</ThemedText>
                      <ThemedText style={styles.description} numberOfLines={4} ellipsizeMode="tail">{hotel.description}</ThemedText>
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
                          <ThemedText style={styles.activityTime} numberOfLines={1} ellipsizeMode="tail">{activity.time}</ThemedText>
                          <ThemedText style={styles.activityName} numberOfLines={1} ellipsizeMode="tail">{activity.placeName}</ThemedText>
                          <ThemedText style={styles.activityDetails} numberOfLines={3} ellipsizeMode="tail">{activity.placeDetails}</ThemedText>
                          {activity.ticketPricing && (
                            <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Bilet: {activity.ticketPricing}</ThemedText>
                          )}
                          {activity.timeToTravel && (
                            <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Ulaşım Süresi: {activity.timeToTravel}</ThemedText>
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
                  <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">Vize Gerekliliği: {tripData.visaInfo.visaRequirement}</ThemedText>
                )}
                {tripData.visaInfo.visaApplicationProcess && (
                  <ThemedText style={styles.infoItem} numberOfLines={3} ellipsizeMode="tail">Vize Başvuru Süreci: {tripData.visaInfo.visaApplicationProcess}</ThemedText>
                )}

                {/* Güvenli kontrol - requiredDocuments var mı, array mi ve içinde eleman var mı? */}
                {(() => {
                  try {
                    // Önce requiredDocuments'ın varlığını kontrol et
                    if (!tripData.visaInfo.requiredDocuments) {
                      return <ThemedText style={styles.infoItem}>Gerekli belgeler belirtilmemiş</ThemedText>;
                    }

                    // Array olup olmadığını kontrol et
                    if (!Array.isArray(tripData.visaInfo.requiredDocuments)) {
                      // String ise ve JSON olabilir mi diye kontrol et
                      if (typeof tripData.visaInfo.requiredDocuments === 'string') {
                        try {
                          const parsedDocs = JSON.parse(tripData.visaInfo.requiredDocuments as string);
                          if (Array.isArray(parsedDocs) && parsedDocs.length > 0) {
                            return (
                              <>
                                <ThemedText style={styles.subTitle}>Gerekli Belgeler:</ThemedText>
                                {parsedDocs.map((doc: string, index: number) => (
                                  <ThemedText key={index} style={styles.listItem}>
                                    <ThemedText style={styles.bulletPoint}>•</ThemedText> {doc}
                                  </ThemedText>
                                ))}
                              </>
                            );
                          }
                        } catch (e) {
                          // JSON parse hatası, string olarak göster
                          return (
                            <>
                              <ThemedText style={styles.subTitle}>Gerekli Belgeler:</ThemedText>
                              <ThemedText style={styles.listItem}>
                                <ThemedText style={styles.bulletPoint}>•</ThemedText> {tripData.visaInfo.requiredDocuments}
                              </ThemedText>
                            </>
                          );
                        }
                      }
                      return <ThemedText style={styles.infoItem}>Gerekli belgeler belirtilmemiş</ThemedText>;
                    }

                    // Array ve içinde eleman var mı kontrol et
                    if (tripData.visaInfo.requiredDocuments.length === 0) {
                      return <ThemedText style={styles.infoItem}>Gerekli belgeler belirtilmemiş</ThemedText>;
                    }

                    // Tüm kontroller geçildi, belgeleri listele
                    return (
                      <>
                        <ThemedText style={styles.subTitle}>Gerekli Belgeler:</ThemedText>
                        {tripData.visaInfo.requiredDocuments.map((doc: string, index: number) => (
                          <ThemedText key={index} style={styles.listItem}>
                            <ThemedText style={styles.bulletPoint}>•</ThemedText> {doc}
                          </ThemedText>
                        ))}
                      </>
                    );
                  } catch (error) {
                    console.error('Vize belgeleri gösterilirken hata:', error);
                    return <ThemedText style={styles.infoItem}>Gerekli belgeler yüklenirken hata oluştu</ThemedText>;
                  }
                })()}

                {tripData.visaInfo.visaFee && (
                  <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Vize Ücreti: {tripData.visaInfo.visaFee}</ThemedText>
                )}
              </View>
            </View>
          )}

          {/* Alternatif Vize Bilgileri - visaInfo objesi yoksa ama ayrı alanlar varsa */}
          {(!tripData.visaInfo || typeof tripData.visaInfo !== 'object') &&
           (tripData.visaRequirements || tripData.visaApplicationProcess || tripData.visaFees) && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Vize ve Pasaport Bilgileri</ThemedText>
              <View style={styles.card}>
                {tripData.visaRequirements && (
                  <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">Vize Gerekliliği: {tripData.visaRequirements}</ThemedText>
                )}
                {tripData.visaApplicationProcess && (
                  <ThemedText style={styles.infoItem} numberOfLines={3} ellipsizeMode="tail">Vize Başvuru Süreci: {tripData.visaApplicationProcess}</ThemedText>
                )}
                {tripData.visaFees && (
                  <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Vize Ücreti: {tripData.visaFees}</ThemedText>
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
                  <ThemedText key={key} style={styles.infoItem} numberOfLines={3} ellipsizeMode="tail">
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
                  <ThemedText key={key} style={styles.infoItem} numberOfLines={3} ellipsizeMode="tail">
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
              <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">Destinasyon: {tripData.destination}</ThemedText>
              {tripData.startDate && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Başlangıç Tarihi: {tripData.startDate}</ThemedText>}
              {tripData.duration && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Süre: {tripData.duration} gün</ThemedText>}
              {tripData.budget && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Bütçe: {tripData.budget}</ThemedText>}
              {tripData.groupType && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Grup Tipi: {tripData.groupType}</ThemedText>}
              {tripData.numberOfPeople && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Kişi Sayısı: {tripData.numberOfPeople}</ThemedText>}
              {tripData.bestTimeToVisit && <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">En İyi Ziyaret Zamanı: {tripData.bestTimeToVisit}</ThemedText>}
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

          {/* Seyahat Fotoğrafları */}
          {!showPlansList && tripData.id && userId && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Fotoğrafları</ThemedText>
              <TripPhotoUploader
                travelPlanId={tripData.id}
                userId={userId}
                tripPhotos={tripPhotos}
                onPhotoAdded={handlePhotoAdded}
                setTripPhotos={setTripPhotos}
              />
            </View>
          )}

          {/* AI yanıtı düzgün parse edilememişse ham yanıtı göster */}
          {tripData.rawResponse && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Planı</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.rawResponse} numberOfLines={10} ellipsizeMode="tail">{tripData.rawResponse}</ThemedText>
              </View>
            </View>
          )}

          {/* İtinerary string olarak kalmışsa göster */}
          {tripData.itinerary && typeof tripData.itinerary === 'string' && tripData.itinerary !== '' && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Seyahat Planı (JSON)</ThemedText>
              <View style={styles.card}>
                <ThemedText style={styles.rawResponse} numberOfLines={10} ellipsizeMode="tail">{tripData.itinerary}</ThemedText>
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
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
    paddingBottom: 16,
    marginBottom: 8,
  },
  bulletPoint: {
    color: '#4c669f',
    marginRight: 6,
    fontSize: 16,
  },
  backButton: {
    marginRight: 16,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  refreshButton: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
    flex: 1,
    marginHorizontal: 8,
    marginTop: 10,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'SpaceMono',
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4c669f',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  dayCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4c669f',
    marginBottom: 16,
    fontFamily: 'SpaceMono',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
    paddingBottom: 8,
  },
  activityCard: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  activityTime: {
    color: '#4c669f',
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: 'SpaceMono',
    fontSize: 14,
  },
  activityName: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'SpaceMono',
  },
  activityDetails: {
    color: '#999',
    marginBottom: 10,
    fontFamily: 'SpaceMono',
    lineHeight: 20,
  },
  destinationName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'SpaceMono',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
  },
  hotelName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'SpaceMono',
  },
  infoItem: {
    color: '#ccc',
    marginBottom: 10,
    fontFamily: 'SpaceMono',
    lineHeight: 20,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  description: {
    color: '#999',
    marginTop: 10,
    fontFamily: 'SpaceMono',
    lineHeight: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    flexWrap: 'wrap',
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 10,
    fontFamily: 'SpaceMono',
  },
  listItem: {
    color: '#ccc',
    marginBottom: 6,
    marginLeft: 8,
    fontFamily: 'SpaceMono',
    lineHeight: 20,
    fontSize: 15,
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
    borderLeftWidth: 3,
    borderLeftColor: '#4c669f',
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
    flexShrink: 1,
  },
  planDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planDetailText: {
    color: '#ccc',
    marginLeft: 4,
    fontSize: 13,
    fontFamily: 'SpaceMono',
    flexShrink: 1,
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
});
