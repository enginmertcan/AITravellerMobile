import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, Alert, Modal, Dimensions, Image, Platform, RefreshControl, Linking } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TravelPlan, DEFAULT_TRAVEL_PLAN, Hotel, TripPhoto, Activity } from './types/travel';
import { safeParseJSON, parseTripPhotos } from './types/travel';
import { FirebaseService } from './services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';
import { getWeatherForecast, WeatherData } from './services/weather.service';
import AppStyles from '@/constants/AppStyles';
import WeatherCard from './components/WeatherCard';
import TripPhotoUploader from './components/TripPhotoUploader';
import TripComments from './components/TripComments';
import HotelDetailModal from './components/HotelDetailModal';
import HotelPhotosService from './services/HotelPhotosService';
import AIHotelPhotosService from './services/ai-hotel-photos.service';
import ActivityPhotosService from './services/ActivityPhotosService';
import * as Calendar from 'expo-calendar';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TripDetailsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<Partial<TravelPlan>>(DEFAULT_TRAVEL_PLAN);
  const [userPlans, setUserPlans] = useState<Partial<TravelPlan>[]>([]);
  const [showPlansList, setShowPlansList] = useState(true); // True to show list, false to show details
  const [weatherData, setWeatherData] = useState<WeatherData[] | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tripPhotos, setTripPhotos] = useState<TripPhoto[]>([]);
  const [calendarPermission, setCalendarPermission] = useState(false);

  // Aktivite detayları için modal state'leri
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activityPhotos, setActivityPhotos] = useState<any[]>([]);
  const [activityPhotosLoading, setActivityPhotosLoading] = useState(false);

  // Fotoğraf görüntüleme modalı için state'ler
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Otel detayları için modal state'leri
  const [hotelModalVisible, setHotelModalVisible] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  // Önerme modalı için state
  const [recommendModalVisible, setRecommendModalVisible] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const planId = params.id as string | undefined;

  // Takvim izinlerini kontrol et
  const checkCalendarPermission = async () => {
    try {
      // Önce mevcut izinleri kontrol et
      const { status: existingStatus } = await Calendar.getCalendarPermissionsAsync();

      // Eğer zaten izin verilmişse, doğrudan true döndür
      if (existingStatus === 'granted') {
        setCalendarPermission(true);
        return true;
      }

      // İzin yoksa, izin iste
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        setCalendarPermission(true);
        return true;
      } else {
        setCalendarPermission(false);
        return false;
      }
    } catch (error) {
      console.error('Takvim izni kontrol hatası:', error);
      setCalendarPermission(false);
      return false;
    }
  };

  // Takvime etkinlik ekle
  const addToCalendar = async () => {
    try {
      // İzinleri kontrol et
      const hasPermission = await checkCalendarPermission();
      if (!hasPermission) {
        Alert.alert(
          "İzin Gerekli",
          "Takvime etkinlik eklemek için takvim izni gereklidir.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Seyahat planı bilgilerini kontrol et
      if (!tripData.destination || !tripData.startDate) {
        Alert.alert(
          "Eksik Bilgi",
          "Takvime eklemek için seyahat planında destinasyon ve başlangıç tarihi olmalıdır.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Başlangıç tarihini parse et
      let startDate: Date;
      try {
        // Önce startDateISO alanını kontrol et (en doğru tarih bilgisi burada olmalı)
        if ((tripData as any).startDateISO && typeof (tripData as any).startDateISO === 'string') {
          startDate = new Date((tripData as any).startDateISO);
        }
        // Tarih formatını kontrol et (ISO string, DD/MM/YYYY, "DD Ay YYYY" veya timestamp)
        else if (typeof tripData.startDate === 'string') {
          if (tripData.startDate.includes('/')) {
            // DD/MM/YYYY formatı
            const [day, month, year] = tripData.startDate.split('/').map(Number);
            // UTC kullanarak tarih oluştur - gün kayması sorununu önlemek için
            startDate = new Date(Date.UTC(year, month - 1, day));
          } else if (tripData.startDate.includes('-')) {
            // YYYY-MM-DD formatı
            const [year, month, day] = tripData.startDate.split('-').map(Number);
            startDate = new Date(Date.UTC(year, month - 1, day));
          } else if (tripData.startDate.includes('T')) {
            // ISO string formatı (YYYY-MM-DDTHH:mm:ss.sssZ)
            const isoDate = new Date(tripData.startDate);
            startDate = new Date(Date.UTC(
              isoDate.getFullYear(),
              isoDate.getMonth(),
              isoDate.getDate()
            ));
          } else if (/^\d+$/.test(tripData.startDate)) {
            // Timestamp olabilir
            const tsDate = new Date(parseInt(tripData.startDate));
            startDate = new Date(Date.UTC(
              tsDate.getFullYear(),
              tsDate.getMonth(),
              tsDate.getDate()
            ));
          } else {
            // "30 Nisan 2025" gibi formatlar için
            const dateParts = tripData.startDate.split(' ');
            const day = parseInt(dateParts[0], 10);
            const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
            const month = monthNames.indexOf(dateParts[1]);
            const year = parseInt(dateParts[2], 10);
            // UTC kullanarak tarih oluştur
            startDate = new Date(Date.UTC(year, month, day));
          }
        } else if (typeof tripData.startDate === 'number') {
          // Timestamp formatı
          const tsDate = new Date(tripData.startDate);
          startDate = new Date(Date.UTC(
            tsDate.getFullYear(),
            tsDate.getMonth(),
            tsDate.getDate()
          ));
        } else {
          throw new Error('Geçersiz tarih formatı');
        }

        // Tarih geçerli değilse hata ver
        if (isNaN(startDate.getTime())) {
          throw new Error('Geçersiz tarih formatı');
        }

 
      } catch (error) {
        console.error('Tarih parse hatası:', error);
        Alert.alert(
          "Tarih Hatası",
          "Başlangıç tarihi doğru formatta değil. Lütfen geçerli bir tarih giriniz.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Seyahat süresini belirle
      let durationDays = 1;
      if (tripData.duration) {
        if (typeof tripData.duration === 'number') {
          durationDays = tripData.duration;
        } else if (typeof tripData.duration === 'string') {
          // String içindeki sayıyı bulmak için regex kullanmak yerine güvenli bir yöntem
          const durationStr = String(tripData.duration);
          const durationNum = parseInt(durationStr.replace(/\D/g, ''), 10);
          if (!isNaN(durationNum)) {
            durationDays = durationNum;
          }
        }
      } else if (tripData.days) {
        if (typeof tripData.days === 'number') {
          durationDays = tripData.days;
        } else if (typeof tripData.days === 'string') {
          // String içindeki sayıyı bulmak için regex kullanmak yerine güvenli bir yöntem
          const daysStr = String(tripData.days);
          const daysNum = parseInt(daysStr.replace(/\D/g, ''), 10);
          if (!isNaN(daysNum)) {
            durationDays = daysNum;
          }
        }
      }

      // Bitiş tarihini hesapla
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + durationDays);

      // Varsayılan takvimi al
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (calendar) => calendar.allowsModifications && calendar.source.name !== 'Facebook'
      );

      if (!defaultCalendar) {
        Alert.alert(
          "Takvim Bulunamadı",
          "Etkinlik eklenecek uygun bir takvim bulunamadı.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Etkinlik detaylarını oluştur
      const eventDetails = {
        title: `${tripData.destination} Seyahati`,
        startDate: startDate,
        endDate: endDate,
        timeZone: 'Europe/Istanbul',
        location: tripData.destination,
        notes: `Seyahat Planı: ${tripData.destination}\n` +
               `Süre: ${durationDays} gün\n` +
               (tripData.budget ? `Bütçe: ${tripData.budget}\n` : '') +
               (tripData.groupType ? `Grup Tipi: ${tripData.groupType}\n` : '') +
               (tripData.numberOfPeople ? `Kişi Sayısı: ${tripData.numberOfPeople}\n` : '') +
               (tripData.bestTimeToVisit ? `En İyi Ziyaret Zamanı: ${tripData.bestTimeToVisit}\n` : ''),
        allDay: true,
      };

      // Etkinliği takvime ekle
      const eventId = await Calendar.createEventAsync(defaultCalendar.id, eventDetails);

      if (eventId) {
        // Haptic feedback
        if (Platform.OS === 'ios') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
           }
        }

        Alert.alert(
          "Başarılı",
          "Seyahat planınız takvime eklendi. Takviminizde görüntüleyebilirsiniz.",
          [{ text: "Tamam" }]
        );
      } else {
        throw new Error('Etkinlik oluşturulamadı');
      }
    } catch (error) {
      console.error('Takvime ekleme hatası:', error);
      Alert.alert(
        "Hata",
        "Seyahat planı takvime eklenirken bir hata oluştu.",
        [{ text: "Tamam" }]
      );
    }
  };

  // Belirli bir planı seçmek için
  const selectPlan = async (plan: Partial<TravelPlan>) => {
    // İtinerary alanını parse et
    if (plan.itinerary && typeof plan.itinerary === 'string') {
      try {
        const parsedItinerary = safeParseJSON(plan.itinerary);
        if (parsedItinerary) {
          // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
          if (parsedItinerary.visaInfo && (!plan.visaInfo || Object.keys(plan.visaInfo).length === 0)) {
            plan.visaInfo = parsedItinerary.visaInfo;

            // Ayrıca eski format alanlarını da doldur
            if (parsedItinerary.visaInfo.visaRequirement) {
              plan.visaRequirements = parsedItinerary.visaInfo.visaRequirement;
            }
            if (parsedItinerary.visaInfo.visaApplicationProcess) {
              plan.visaApplicationProcess = parsedItinerary.visaInfo.visaApplicationProcess;
            }
            if (parsedItinerary.visaInfo.visaFee) {
              plan.visaFees = parsedItinerary.visaInfo.visaFee;
            }
          }

          if (parsedItinerary.culturalDifferences) {

            // Eğer string ise, objeye dönüştürmeyi dene
            if (typeof parsedItinerary.culturalDifferences === 'string') {
              try {
                const culturalObj = safeParseJSON(parsedItinerary.culturalDifferences);
                if (culturalObj) {
                  plan.culturalDifferences = culturalObj;

                  // Ayrıca eski format alanlarını da doldur
                  if (culturalObj.lifestyleDifferences) {
                    plan.lifestyleDifferences = culturalObj.lifestyleDifferences;
                  }
                  if (culturalObj.foodCultureDifferences) {
                    plan.foodCultureDifferences = culturalObj.foodCultureDifferences;
                  }
                  if (culturalObj.socialNormsDifferences) {
                    plan.socialNormsDifferences = culturalObj.socialNormsDifferences;
                  }
                } else {
                  plan.culturalDifferences = parsedItinerary.culturalDifferences;
                }
              } catch (error) {
                console.error('culturalDifferences parse hatası:', error);
                plan.culturalDifferences = parsedItinerary.culturalDifferences;
              }
            } else {
              plan.culturalDifferences = parsedItinerary.culturalDifferences;

              // Ayrıca eski format alanlarını da doldur
              if (parsedItinerary.culturalDifferences.lifestyleDifferences) {
                plan.lifestyleDifferences = parsedItinerary.culturalDifferences.lifestyleDifferences;
              }
              if (parsedItinerary.culturalDifferences.foodCultureDifferences) {
                plan.foodCultureDifferences = parsedItinerary.culturalDifferences.foodCultureDifferences;
              }
              if (parsedItinerary.culturalDifferences.socialNormsDifferences) {
                plan.socialNormsDifferences = parsedItinerary.culturalDifferences.socialNormsDifferences;
              }
            }
          }

          if (parsedItinerary.localTips && !plan.localTips) {
            plan.localTips = parsedItinerary.localTips;

            // Ayrıca eski format alanlarını da doldur
            if (parsedItinerary.localTips.localTransportationGuide) {
              plan.localTransportationGuide = parsedItinerary.localTips.localTransportationGuide;
            }
            if (parsedItinerary.localTips.emergencyContacts) {
              plan.emergencyContacts = parsedItinerary.localTips.emergencyContacts;
            }
            if (parsedItinerary.localTips.currencyAndPayment) {
              plan.currencyAndPayment = parsedItinerary.localTips.currencyAndPayment;
            }
            if (parsedItinerary.localTips.communicationInfo) {
              plan.communicationInfo = parsedItinerary.localTips.communicationInfo;
            }
            if (parsedItinerary.localTips.healthcareInfo) {
              plan.healthcareInfo = parsedItinerary.localTips.healthcareInfo;
            }
          }

          plan.itinerary = parsedItinerary;
        }
      } catch (parseError) {
        console.error('Seçilen plan itinerary parse hatası:', parseError);
      }
    }

    // Fotoğrafları parse et
    try {
      if (plan.tripPhotos) {
        // Fotoğrafları parse et
        const photos = parseTripPhotos(plan.tripPhotos);

        if (photos.length > 0) {
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
              } else if (photo.imageData) {
              } else if (photo.imageUrl) {
              }
              return photo;
            })
          );

          setTripPhotos(updatedPhotos);
        } else {
          setTripPhotos([]);
        }
      } else {
        setTripPhotos([]);
      }
    } catch (error) {
      console.error('Fotoğraf yükleme hatası (selectPlan):', error);
      setTripPhotos([]);
    }

    // Veri yapısını güncelleyelim
    const processedPlan = { ...plan };

    // startDateISO alanını kontrol et
    if ((plan as any).startDateISO) {
      (processedPlan as any).startDateISO = (plan as any).startDateISO;
      console.log('selectPlan: startDateISO alanı bulundu:', (plan as any).startDateISO);
    }

    // Vize bilgilerini kontrol et
    if (processedPlan.visaInfo && typeof processedPlan.visaInfo === 'string') {
      try {
        processedPlan.visaInfo = safeParseJSON(processedPlan.visaInfo);
      } catch (error) {
        console.error('Vize bilgileri parse hatası:', error);
      }
    }

    // tripSummary alanını kontrol et ve eksikse oluştur
    if (!processedPlan.tripSummary || typeof processedPlan.tripSummary === 'string' || Object.keys(processedPlan.tripSummary).length === 0) {
      // String formatındaysa parse etmeyi dene
      if (typeof processedPlan.tripSummary === 'string') {
        try {
          const parsedSummary = safeParseJSON(processedPlan.tripSummary);
          if (parsedSummary) {
            processedPlan.tripSummary = parsedSummary;
          } else {
            // Parse edilemezse boş bir obje oluştur
            processedPlan.tripSummary = { duration: "", travelers: "", budget: "" };
          }
        } catch (error) {
          console.error('tripSummary parse hatası:', error);
          // Parse edilemezse boş bir obje oluştur
          processedPlan.tripSummary = { duration: "", travelers: "", budget: "" };
        }
      } else {
        // Hiç yoksa boş bir obje oluştur
        processedPlan.tripSummary = { duration: "", travelers: "", budget: "" };
      }

      // Süre bilgisini belirle
      let durationValue = "Belirtilmemiş";

      // Ana objede duration (string veya sayı olabilir)
      if (processedPlan.duration) {
        if (typeof processedPlan.duration === 'number') {
          durationValue = String(processedPlan.duration);
        } else if (typeof processedPlan.duration === 'string') {
          // "3 days" gibi string'den sayıyı çıkar
          const durationMatch = processedPlan.duration.match(/\d+/);
          if (durationMatch) {
            durationValue = durationMatch[0];
          } else {
            durationValue = processedPlan.duration.replace('days', '').replace('day', '').trim();
          }
        }
      }
      // days alanı (sayı veya string olabilir)
      else if (processedPlan.days) {
        if (typeof processedPlan.days === 'number') {
          durationValue = String(processedPlan.days);
        } else if (typeof processedPlan.days === 'string') {
          const daysMatch = String(processedPlan.days).match(/\d+/);
          if (daysMatch) {
            durationValue = daysMatch[0];
          } else {
            durationValue = processedPlan.days;
          }
        }
      }

      // Yolcu bilgisini belirle
      let travelersValue = "Belirtilmemiş";

      // groupType ve numberOfPeople birleşimi
      if (processedPlan.groupType && processedPlan.numberOfPeople) {
        travelersValue = `${processedPlan.groupType} (${processedPlan.numberOfPeople})`;
      }
      // Sadece groupType
      else if (processedPlan.groupType) {
        travelersValue = processedPlan.groupType;
      }
      // Sadece numberOfPeople
      else if (processedPlan.numberOfPeople) {
        travelersValue = processedPlan.numberOfPeople;
      }

      // Bütçe bilgisini belirle
      const budgetValue = processedPlan.budget || "Belirtilmemiş";

      // tripSummary alanını doldur
      processedPlan.tripSummary = {
        ...processedPlan.tripSummary,
        duration: durationValue,
        travelers: travelersValue,
        budget: budgetValue
      };
    }

    // Kültürel farklılıkları kontrol et
    if (processedPlan.culturalDifferences && typeof processedPlan.culturalDifferences === 'string') {
      try {
        processedPlan.culturalDifferences = safeParseJSON(processedPlan.culturalDifferences);
      } catch (error) {
        console.error('Kültürel farklılıklar parse hatası:', error);
      }
    }

    // Yerel ipuçlarını kontrol et
    if (processedPlan.localTips && typeof processedPlan.localTips === 'string') {
      try {
        processedPlan.localTips = safeParseJSON(processedPlan.localTips);
      } catch (error) {
        console.error('Yerel ipuçları parse hatası:', error);
      }
    }

    // UI'ı güncelle
    setTripData(processedPlan);
    setShowPlansList(false); // Detay görünümüne geç

    // Hava durumu verilerini getir
    fetchWeatherData(processedPlan); // Hava durumu verilerini getir

    // URL'i güncelle ama sayfayı yeniden yükleme
    if (processedPlan.id) {
      router.setParams({ id: processedPlan.id });
    }
  };

  // Hava durumu verilerini getir
  const fetchWeatherData = async (plan: Partial<TravelPlan>) => {
    if (!plan.destination) {
      return;
    }

    setWeatherLoading(true);
    try {
      // Destinasyon bilgisini al
      const destination = plan.destination;

      // Önce startDateISO alanını kontrol et (en doğru tarih bilgisi)
      let tripDate: Date;

      if ((plan as any).startDateISO && typeof (plan as any).startDateISO === 'string') {
         tripDate = new Date((plan as any).startDateISO);
      }
      // Sonra startDateDDMMYYYY alanını kontrol et (API çağrıları için)
      else if ((plan as any).startDateDDMMYYYY && typeof (plan as any).startDateDDMMYYYY === 'string') {
         const [day, month, year] = (plan as any).startDateDDMMYYYY.split('/').map(Number);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          // UTC kullanarak tarih oluştur - gün kayması sorununu önlemek için
          tripDate = new Date(Date.UTC(year, month - 1, day));

          // ISO formatını da ekle
          (plan as any).startDateISO = tripDate.toISOString();
          (plan as any).originalStartDate = tripDate.toISOString();
        } else {
          // Geçersiz format, bugünün tarihini kullan
          tripDate = new Date(Date.UTC(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate()
          ));
        }
      }
      // Sonra startDate alanını kontrol et
      else if (plan.startDate && typeof plan.startDate === 'string') {
 
        // DD/MM/YYYY formatı
        if (plan.startDate.includes('/')) {
          const [day, month, year] = plan.startDate.split('/').map(Number);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            // UTC kullanarak tarih oluştur - gün kayması sorununu önlemek için
            tripDate = new Date(Date.UTC(year, month - 1, day));

            // Eğer originalStartDate veya startDateISO yoksa, bunları ekleyelim
            if (!(plan as any).originalStartDate) {
              (plan as any).originalStartDate = tripDate.toISOString();
             }

            if (!(plan as any).startDateISO) {
              (plan as any).startDateISO = tripDate.toISOString();
             }
          } else {
            // Geçersiz format, bugünün tarihini kullan
            tripDate = new Date(Date.UTC(
              new Date().getFullYear(),
              new Date().getMonth(),
              new Date().getDate()
            ));
          }
        }
        // Türkçe tarih formatı (30 Nisan 2025)
        else if (/\d+\s+[A-Za-zğüşıöçĞÜŞİÖÇ]+\s+\d{4}/.test(plan.startDate)) {
          try {
            // Türkçe ay adlarını sayıya çevir
            const turkishMonths = {
              'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5,
              'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11
            };

            // Tarih formatını parçala
            const parts = plan.startDate.split(' ');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const monthName = parts[1];
              const year = parseInt(parts[2]);

              // Ay adını sayıya çevir
              const monthIndex = turkishMonths[monthName as keyof typeof turkishMonths];

              if (!isNaN(day) && monthIndex !== undefined && !isNaN(year)) {
                // UTC kullanarak tarih oluştur
                tripDate = new Date(Date.UTC(year, monthIndex, day));
 
                // ISO formatında startDate ve startDateISO alanlarını güncelle
                (plan as any).startDateISO = tripDate.toISOString();
                (plan as any).originalStartDate = tripDate.toISOString();
                // DD/MM/YYYY formatında startDateDDMMYYYY alanını ekle
                (plan as any).startDateDDMMYYYY = `${day.toString().padStart(2, '0')}/${(monthIndex + 1).toString().padStart(2, '0')}/${year}`;


              } else {
                // Geçersiz format, bugünün tarihini kullan
                tripDate = new Date(Date.UTC(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  new Date().getDate()
                ));
              }
            } else {
              // Geçersiz format, bugünün tarihini kullan
              tripDate = new Date(Date.UTC(
                new Date().getFullYear(),
                new Date().getMonth(),
                new Date().getDate()
              ));
            }
          } catch (error) {
            console.error('Tarih dönüştürme hatası:', error);
            // Geçersiz format, bugünün tarihini kullan
            tripDate = new Date(Date.UTC(
              new Date().getFullYear(),
              new Date().getMonth(),
              new Date().getDate()
            ));
          }
        }
        // ISO formatı (2023-04-30T14:52:18.000Z)
        else if (plan.startDate.includes('T')) {
          tripDate = new Date(plan.startDate);

          // DD/MM/YYYY formatında startDateDDMMYYYY alanını ekle
          (plan as any).startDateDDMMYYYY = `${tripDate.getUTCDate().toString().padStart(2, '0')}/${(tripDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${tripDate.getUTCFullYear()}`;

          // ISO formatında startDateISO alanını ekle
          (plan as any).startDateISO = tripDate.toISOString();
          (plan as any).originalStartDate = tripDate.toISOString();
        }
        // Diğer formatlar
        else {
          // Varsayılan olarak bugünü kullan
          tripDate = new Date(Date.UTC(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate()
          ));

          // ISO formatında startDateISO alanını ekle
          (plan as any).startDateISO = tripDate.toISOString();
          (plan as any).originalStartDate = tripDate.toISOString();

          // DD/MM/YYYY formatında startDateDDMMYYYY alanını ekle
          (plan as any).startDateDDMMYYYY = `${tripDate.getUTCDate().toString().padStart(2, '0')}/${(tripDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${tripDate.getUTCFullYear()}`;
        }

        // Tarih geçerli değilse bugünün tarihini kullan
        if (isNaN(tripDate.getTime())) {
          console.warn('Geçersiz tarih formatı:', plan.startDate);
          tripDate = new Date(Date.UTC(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate()
          ));

          // ISO formatında startDateISO alanını ekle
          (plan as any).startDateISO = tripDate.toISOString();
          (plan as any).originalStartDate = tripDate.toISOString();

          // DD/MM/YYYY formatında startDateDDMMYYYY alanını ekle
          (plan as any).startDateDDMMYYYY = `${tripDate.getUTCDate().toString().padStart(2, '0')}/${(tripDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${tripDate.getUTCFullYear()}`;
        }
      } else {
        // Bugünün tarihini UTC olarak kullan
        tripDate = new Date(Date.UTC(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate()
        ));

        // ISO formatında startDateISO alanını ekle
        (plan as any).startDateISO = tripDate.toISOString();
        (plan as any).originalStartDate = tripDate.toISOString();

        // DD/MM/YYYY formatında startDateDDMMYYYY alanını ekle
        (plan as any).startDateDDMMYYYY = `${tripDate.getUTCDate().toString().padStart(2, '0')}/${(tripDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${tripDate.getUTCFullYear()}`;
      }

      console.log('Hava durumu için kullanılan tarih:', tripDate.toISOString());

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
              // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
              if (parsedItinerary.visaInfo && (!plan.visaInfo || Object.keys(plan.visaInfo).length === 0)) {
                plan.visaInfo = parsedItinerary.visaInfo;

                // Ayrıca eski format alanlarını da doldur
                if (parsedItinerary.visaInfo.visaRequirement) {
                  plan.visaRequirements = parsedItinerary.visaInfo.visaRequirement;
                }
                if (parsedItinerary.visaInfo.visaApplicationProcess) {
                  plan.visaApplicationProcess = parsedItinerary.visaInfo.visaApplicationProcess;
                }
                if (parsedItinerary.visaInfo.visaFee) {
                  plan.visaFees = parsedItinerary.visaInfo.visaFee;
                }
              }

              if (parsedItinerary.culturalDifferences) {
                // Eğer string ise, objeye dönüştürmeyi dene
                if (typeof parsedItinerary.culturalDifferences === 'string') {
                  try {
                    const culturalObj = safeParseJSON(parsedItinerary.culturalDifferences);
                    if (culturalObj) {
                      plan.culturalDifferences = culturalObj;

                      // Ayrıca eski format alanlarını da doldur
                      if (culturalObj.lifestyleDifferences) {
                        plan.lifestyleDifferences = culturalObj.lifestyleDifferences;
                      }
                      if (culturalObj.foodCultureDifferences) {
                        plan.foodCultureDifferences = culturalObj.foodCultureDifferences;
                      }
                      if (culturalObj.socialNormsDifferences) {
                        plan.socialNormsDifferences = culturalObj.socialNormsDifferences;
                      }
                    } else {
                      plan.culturalDifferences = parsedItinerary.culturalDifferences;
                    }
                  } catch (error) {
                    console.error('culturalDifferences parse hatası:', error);
                    plan.culturalDifferences = parsedItinerary.culturalDifferences;
                  }
                } else {
                  plan.culturalDifferences = parsedItinerary.culturalDifferences;

                  // Ayrıca eski format alanlarını da doldur
                  if (parsedItinerary.culturalDifferences.lifestyleDifferences) {
                    plan.lifestyleDifferences = parsedItinerary.culturalDifferences.lifestyleDifferences;
                  }
                  if (parsedItinerary.culturalDifferences.foodCultureDifferences) {
                    plan.foodCultureDifferences = parsedItinerary.culturalDifferences.foodCultureDifferences;
                  }
                  if (parsedItinerary.culturalDifferences.socialNormsDifferences) {
                    plan.socialNormsDifferences = parsedItinerary.culturalDifferences.socialNormsDifferences;
                  }
                }
              }

              if (parsedItinerary.localTips && !plan.localTips) {
                plan.localTips = parsedItinerary.localTips;

                // Ayrıca eski format alanlarını da doldur
                if (parsedItinerary.localTips.localTransportationGuide) {
                  plan.localTransportationGuide = parsedItinerary.localTips.localTransportationGuide;
                }
                if (parsedItinerary.localTips.emergencyContacts) {
                  plan.emergencyContacts = parsedItinerary.localTips.emergencyContacts;
                }
                if (parsedItinerary.localTips.currencyAndPayment) {
                  plan.currencyAndPayment = parsedItinerary.localTips.currencyAndPayment;
                }
                if (parsedItinerary.localTips.communicationInfo) {
                  plan.communicationInfo = parsedItinerary.localTips.communicationInfo;
                }
                if (parsedItinerary.localTips.healthcareInfo) {
                  plan.healthcareInfo = parsedItinerary.localTips.healthcareInfo;
                }
              }

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

      // Kullanıcının seçtiği gün sayısını kullan, en az 1, en fazla 15 gün
      durationDays = Math.max(1, Math.min(15, durationDays));

      console.log(`Fetching weather data for ${durationDays} days for destination: ${destination}`);
      console.log(`Trip date: ${tripDate.toISOString()}, Duration: ${durationDays} days`);

      // Hava durumu verilerini getir
      const forecast = await getWeatherForecast(destination, tripDate, durationDays);

      if (forecast && forecast.length > 0) {
 
        // Hava durumu verilerini kontrol et
        if (forecast.length < durationDays) {
          console.warn(`Warning: Received fewer weather days (${forecast.length}) than requested (${durationDays})`);
        }

        setWeatherData(forecast);
 
        // Hava durumu verilerini detaylı olarak logla
        forecast.forEach((day, index) => {
         });
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
    try {
      setLoading(true);

      // Önce kullanıcının tüm planlarını çekelim
      if (userId) {
        const plans = await FirebaseService.TravelPlan.getUserTravelPlans(userId);

        if (plans && plans.length > 0) {
          const parsedPlans = plans.map(plan => {
            if (plan.itinerary && typeof plan.itinerary === 'string') {
              try {
                const parsedItinerary = safeParseJSON(plan.itinerary);
                if (parsedItinerary) {
                  // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
                  if (parsedItinerary.visaInfo && (!plan.visaInfo || Object.keys(plan.visaInfo).length === 0)) {
                    plan.visaInfo = parsedItinerary.visaInfo;

                    // Ayrıca eski format alanlarını da doldur
                    if (parsedItinerary.visaInfo.visaRequirement) {
                      plan.visaRequirements = parsedItinerary.visaInfo.visaRequirement;
                    }
                    if (parsedItinerary.visaInfo.visaApplicationProcess) {
                      plan.visaApplicationProcess = parsedItinerary.visaInfo.visaApplicationProcess;
                    }
                    if (parsedItinerary.visaInfo.visaFee) {
                      plan.visaFees = parsedItinerary.visaInfo.visaFee;
                    }
                  }

                  if (parsedItinerary.culturalDifferences) {
                    if (typeof parsedItinerary.culturalDifferences === 'string') {
                      try {
                        const culturalObj = safeParseJSON(parsedItinerary.culturalDifferences);
                        if (culturalObj) {
                          plan.culturalDifferences = culturalObj;

                          // Ayrıca eski format alanlarını da doldur
                          if (culturalObj.lifestyleDifferences) {
                            plan.lifestyleDifferences = culturalObj.lifestyleDifferences;
                          }
                          if (culturalObj.foodCultureDifferences) {
                            plan.foodCultureDifferences = culturalObj.foodCultureDifferences;
                          }
                          if (culturalObj.socialNormsDifferences) {
                            plan.socialNormsDifferences = culturalObj.socialNormsDifferences;
                          }
                        } else {
                          plan.culturalDifferences = parsedItinerary.culturalDifferences;
                        }
                      } catch (error) {
                        console.error('culturalDifferences parse hatası:', error);
                        plan.culturalDifferences = parsedItinerary.culturalDifferences;
                      }
                    } else {
                      plan.culturalDifferences = parsedItinerary.culturalDifferences;

                      // Ayrıca eski format alanlarını da doldur
                      if (parsedItinerary.culturalDifferences.lifestyleDifferences) {
                        plan.lifestyleDifferences = parsedItinerary.culturalDifferences.lifestyleDifferences;
                      }
                      if (parsedItinerary.culturalDifferences.foodCultureDifferences) {
                        plan.foodCultureDifferences = parsedItinerary.culturalDifferences.foodCultureDifferences;
                      }
                      if (parsedItinerary.culturalDifferences.socialNormsDifferences) {
                        plan.socialNormsDifferences = parsedItinerary.culturalDifferences.socialNormsDifferences;
                      }
                    }
                  }

                  if (parsedItinerary.localTips && !plan.localTips) {
                    plan.localTips = parsedItinerary.localTips;

                    // Ayrıca eski format alanlarını da doldur
                    if (parsedItinerary.localTips.localTransportationGuide) {
                      plan.localTransportationGuide = parsedItinerary.localTips.localTransportationGuide;
                    }
                    if (parsedItinerary.localTips.emergencyContacts) {
                      plan.emergencyContacts = parsedItinerary.localTips.emergencyContacts;
                    }
                    if (parsedItinerary.localTips.currencyAndPayment) {
                      plan.currencyAndPayment = parsedItinerary.localTips.currencyAndPayment;
                    }
                    if (parsedItinerary.localTips.communicationInfo) {
                      plan.communicationInfo = parsedItinerary.localTips.communicationInfo;
                    }
                    if (parsedItinerary.localTips.healthcareInfo) {
                      plan.healthcareInfo = parsedItinerary.localTips.healthcareInfo;
                    }
                  }

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
              setTripData(selectedPlan);
              setShowPlansList(false);
              fetchWeatherData(selectedPlan); // Hava durumu verilerini getir
              return; // Fonksiyondan çık
            } else {
              // Planlar içinde bulunamadıysa, Firebase'den direkt çekmeyi dene
              await loadSinglePlan(planId);
            }
          } else {
            setShowPlansList(true);
          }
        } else {
          setUserPlans([]);
          setShowPlansList(true);

          if (planId) {
            await loadSinglePlan(planId);
          }
        }
      } else {
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
      setLoading(true);

      setTripPhotos([]);

      // Plan verilerini getir
      const plan = await FirebaseService.TravelPlan.getTravelPlanById(id);

      if (plan && Object.keys(plan).length > 0) {

        // İtinerary alanını parse et
        if (plan.itinerary && typeof plan.itinerary === 'string') {
          try {
            const parsedItinerary = safeParseJSON(plan.itinerary);
            if (parsedItinerary) {
              // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
              if (parsedItinerary.visaInfo && (!plan.visaInfo || Object.keys(plan.visaInfo).length === 0)) {
                plan.visaInfo = parsedItinerary.visaInfo;

                // Ayrıca eski format alanlarını da doldur
                if (parsedItinerary.visaInfo.visaRequirement) {
                  plan.visaRequirements = parsedItinerary.visaInfo.visaRequirement;
                }
                if (parsedItinerary.visaInfo.visaApplicationProcess) {
                  plan.visaApplicationProcess = parsedItinerary.visaInfo.visaApplicationProcess;
                }
                if (parsedItinerary.visaInfo.visaFee) {
                  plan.visaFees = parsedItinerary.visaInfo.visaFee;
                }
              }

              if (parsedItinerary.culturalDifferences) {

                // Eğer string ise, objeye dönüştürmeyi dene
                if (typeof parsedItinerary.culturalDifferences === 'string') {
                  try {
                    const culturalObj = safeParseJSON(parsedItinerary.culturalDifferences);
                    if (culturalObj) {
                      plan.culturalDifferences = culturalObj;

                      // Ayrıca eski format alanlarını da doldur
                      if (culturalObj.lifestyleDifferences) {
                        plan.lifestyleDifferences = culturalObj.lifestyleDifferences;
                      }
                      if (culturalObj.foodCultureDifferences) {
                        plan.foodCultureDifferences = culturalObj.foodCultureDifferences;
                      }
                      if (culturalObj.socialNormsDifferences) {
                        plan.socialNormsDifferences = culturalObj.socialNormsDifferences;
                      }
                    } else {
                      plan.culturalDifferences = parsedItinerary.culturalDifferences;
                    }
                  } catch (error) {
                    console.error('culturalDifferences parse hatası:', error);
                    plan.culturalDifferences = parsedItinerary.culturalDifferences;
                  }
                } else {
                  plan.culturalDifferences = parsedItinerary.culturalDifferences;

                  // Ayrıca eski format alanlarını da doldur
                  if (parsedItinerary.culturalDifferences.lifestyleDifferences) {
                    plan.lifestyleDifferences = parsedItinerary.culturalDifferences.lifestyleDifferences;
                  }
                  if (parsedItinerary.culturalDifferences.foodCultureDifferences) {
                    plan.foodCultureDifferences = parsedItinerary.culturalDifferences.foodCultureDifferences;
                  }
                  if (parsedItinerary.culturalDifferences.socialNormsDifferences) {
                    plan.socialNormsDifferences = parsedItinerary.culturalDifferences.socialNormsDifferences;
                  }
                }
              }

              if (parsedItinerary.localTips && !plan.localTips) {
                plan.localTips = parsedItinerary.localTips;

                // Ayrıca eski format alanlarını da doldur
                if (parsedItinerary.localTips.localTransportationGuide) {
                  plan.localTransportationGuide = parsedItinerary.localTips.localTransportationGuide;
                }
                if (parsedItinerary.localTips.emergencyContacts) {
                  plan.emergencyContacts = parsedItinerary.localTips.emergencyContacts;
                }
                if (parsedItinerary.localTips.currencyAndPayment) {
                  plan.currencyAndPayment = parsedItinerary.localTips.currencyAndPayment;
                }
                if (parsedItinerary.localTips.communicationInfo) {
                  plan.communicationInfo = parsedItinerary.localTips.communicationInfo;
                }
                if (parsedItinerary.localTips.healthcareInfo) {
                  plan.healthcareInfo = parsedItinerary.localTips.healthcareInfo;
                }
              }

              plan.itinerary = parsedItinerary;
            } else {
              console.error('İtinerary parse edilemedi');
            }
          } catch (parseError) {
            console.error('İtinerary parse hatası:', parseError);
          }
        } else {
        }

        // Fotoğrafları parse et
        try {
          if (plan.tripPhotos) {
            const photos = parseTripPhotos(plan.tripPhotos);

            if (photos.length > 0) {
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
                  } else if (photo.imageData) {
                  } else if (photo.imageUrl) {
                  }
                  return photo;
                })
              );

              setTripPhotos(updatedPhotos);
            } else {
              setTripPhotos([]);
            }
          } else {
            setTripPhotos([]);
          }
        } catch (error) {
          console.error('Fotoğraf yükleme hatası:', error);
          setTripPhotos([]);
        }

        // Veri işleme tamamlandı, şimdi UI'ı güncelleyelim

        // Veri yapısını güncelleyelim
        const processedPlan = { ...plan };

        // Vize bilgilerini kontrol et
        if (processedPlan.visaInfo && typeof processedPlan.visaInfo === 'string') {
          try {
            processedPlan.visaInfo = safeParseJSON(processedPlan.visaInfo);
          } catch (error) {
            console.error('Vize bilgileri parse hatası:', error);
          }
        }

        // tripSummary alanını kontrol et ve eksikse oluştur
        if (!processedPlan.tripSummary || typeof processedPlan.tripSummary === 'string' || Object.keys(processedPlan.tripSummary).length === 0) {
          if (typeof processedPlan.tripSummary === 'string') {
            try {
              const parsedSummary = safeParseJSON(processedPlan.tripSummary);
              if (parsedSummary) {
                processedPlan.tripSummary = parsedSummary;
              } else {
                // Parse edilemezse boş bir obje oluştur
                processedPlan.tripSummary = { duration: "", travelers: "", budget: "" };
              }
            } catch (error) {
              console.error('tripSummary parse hatası:', error);
              // Parse edilemezse boş bir obje oluştur
              processedPlan.tripSummary = { duration: "", travelers: "", budget: "" };
            }
          } else {
            // Hiç yoksa boş bir obje oluştur
            processedPlan.tripSummary = { duration: "", travelers: "", budget: "" };
          }

          // Süre bilgisini belirle
          let durationValue = "Belirtilmemiş";

          // Ana objede duration (string veya sayı olabilir)
          if (processedPlan.duration) {
            if (typeof processedPlan.duration === 'number') {
              durationValue = String(processedPlan.duration);
            } else if (typeof processedPlan.duration === 'string') {
              // "3 days" gibi string'den sayıyı çıkar
              const durationMatch = processedPlan.duration.match(/\d+/);
              if (durationMatch) {
                durationValue = durationMatch[0];
              } else {
                durationValue = processedPlan.duration.replace('days', '').replace('day', '').trim();
              }
            }
          }
          // days alanı (sayı veya string olabilir)
          else if (processedPlan.days) {
            if (typeof processedPlan.days === 'number') {
              durationValue = String(processedPlan.days);
            } else if (typeof processedPlan.days === 'string') {
              const daysMatch = String(processedPlan.days).match(/\d+/);
              if (daysMatch) {
                durationValue = daysMatch[0];
              } else {
                durationValue = processedPlan.days;
              }
            }
          }

          // Yolcu bilgisini belirle
          let travelersValue = "Belirtilmemiş";

          // groupType ve numberOfPeople birleşimi
          if (processedPlan.groupType && processedPlan.numberOfPeople) {
            travelersValue = `${processedPlan.groupType} (${processedPlan.numberOfPeople})`;
          }
          // Sadece groupType
          else if (processedPlan.groupType) {
            travelersValue = processedPlan.groupType;
          }
          // Sadece numberOfPeople
          else if (processedPlan.numberOfPeople) {
            travelersValue = processedPlan.numberOfPeople;
          }

          // Bütçe bilgisini belirle
          const budgetValue = processedPlan.budget || "Belirtilmemiş";

          // tripSummary alanını doldur
          processedPlan.tripSummary = {
            ...processedPlan.tripSummary,
            duration: durationValue,
            travelers: travelersValue,
            budget: budgetValue
          };
        }

        // Kültürel farklılıkları kontrol et
        if (processedPlan.culturalDifferences && typeof processedPlan.culturalDifferences === 'string') {
          try {
            processedPlan.culturalDifferences = safeParseJSON(processedPlan.culturalDifferences);
          } catch (error) {
            console.error('Kültürel farklılıklar parse hatası:', error);
          }
        } else if (processedPlan.culturalDifferences && typeof processedPlan.culturalDifferences === 'object') {
          console.log('Kültürel farklılıklar zaten obje formatında:',
            JSON.stringify(processedPlan.culturalDifferences));
        } else {
          console.log('Kültürel farklılıklar bulunamadı veya geçersiz format');
        }

        // Yerel ipuçlarını kontrol et
        if (processedPlan.localTips && typeof processedPlan.localTips === 'string') {
          try {
            processedPlan.localTips = safeParseJSON(processedPlan.localTips);
          } catch (error) {
            console.error('Yerel ipuçları parse hatası:', error);
          }
        } else if (processedPlan.localTips && typeof processedPlan.localTips === 'object') {
          console.log('Yerel ipuçları zaten obje formatında:',
            JSON.stringify(processedPlan.localTips));
        } else {
          console.log('Yerel ipuçları bulunamadı veya geçersiz format');
        }

        // UI'ı güncelle
        setTripData(processedPlan);
        setShowPlansList(false); // Detay görünümünü göster

        // Hava durumu verilerini getir
        fetchWeatherData(processedPlan);

        // Yükleme durumunu kapat
        setLoading(false);

        return true;
      } else {
        setTripData(DEFAULT_TRAVEL_PLAN);
        setShowPlansList(true); // Liste görünümüne dön
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Plan yükleme hatası:', error);
      setTripData(DEFAULT_TRAVEL_PLAN);
      setShowPlansList(true);
      setLoading(false);
      return false;
    }
  };

  // Component mount olduğunda veya userId/planId değiştiğinde veriyi yükle
  useEffect(() => {
    // Immediate function to allow async/await
    const fetchData = async () => {
      // Eğer planId varsa, doğrudan o planı yükle
      if (planId) {
        await loadSinglePlan(planId);
      } else {
        // Yoksa tüm planları yükle
        await loadData();
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, planId]);

  // Uygulama başladığında takvim izinlerini kontrol etme
  // Sadece kullanıcı takvime ekle butonuna bastığında izin isteyeceğiz

  // Fotoğraflar değiştiğinde UI'ı güncelle
  useEffect(() => {
   }, [tripPhotos]);

  // Plan listesine geri dönmek için
  const handleBackToList = () => {
    setShowPlansList(true);
    router.setParams({ id: '' }); // URL'den ID'yi kaldır
  };

  // Sayfayı manuel olarak yenilemek için
  const handleRefresh = async () => {
    setLoading(true);

    try {
      if (!showPlansList && tripData && tripData.id) {
        // Detay görünümündeyse, Firebase'den planı getir ama sayfayı yenileme
        const plan = await FirebaseService.TravelPlan.getTravelPlanById(tripData.id);

        if (plan && Object.keys(plan).length > 0) {
          // Planı işle ama sayfayı yenileme
          // Sadece gerekli alanları güncelle
          setTripData({
            ...tripData,
            ...plan,
            // Önerme durumunu koru
            isRecommended: plan.isRecommended !== undefined ? plan.isRecommended : tripData.isRecommended,
            // Beğeni durumunu koru
            likes: plan.likes !== undefined ? plan.likes : tripData.likes,
            likedBy: plan.likedBy || tripData.likedBy
          });

          // Hava durumu verilerini güncelle
          fetchWeatherData(plan);

          // Yükleme durumunu kapat
          setLoading(false);

          // Haptic feedback
          if (Platform.OS === 'ios') {
            try {
              const Haptics = require('expo-haptics');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.log('Haptic feedback not available');
            }
          }

          // Başarılı mesajı gösterme
          // setSuccessMessage('Seyahat planı başarıyla güncellendi.');
          // setSuccessModalVisible(true);
        } else {
          // Plan bulunamadıysa hata göster
          Alert.alert('Hata', 'Seyahat planı bulunamadı.');
          setLoading(false);
        }
      } else {
        // Liste görünümündeyse, tüm planları yeniden yükle
        await loadData();
      }
    } catch (error) {
      console.error('Yenileme hatası:', error);
      // Hata durumunda yükleme durumunu kapat
      setLoading(false);
      Alert.alert('Hata', 'Veriler yenilenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  // Başarılı mesajı için state
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Seyahat planını önerilen olarak işaretlemek veya kaldırmak için
  const toggleRecommendation = async () => {
    if (!tripData.id) return;

    try {
      // Kullanıcı kontrolü - sadece planı oluşturan kullanıcı değiştirebilir
      if (tripData.userId !== userId) {
        Alert.alert(
          'Yetki Hatası',
          'Sadece planı oluşturan kullanıcı öneri durumunu değiştirebilir.',
          [{ text: 'Tamam' }]
        );
        return;
      }

      const newRecommendedStatus = !(tripData.isRecommended || false);

      // Optimistic UI update - Önce UI'ı güncelle, sonra API çağrısı yap
      // Bu sayede sayfa yenilenmeden kullanıcı değişikliği görebilir
      setTripData({
        ...tripData,
        isRecommended: newRecommendedStatus
      });

      // Haptic feedback
      if (Platform.OS === 'ios') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.log('Haptic feedback not available');
        }
      }

      // Başarılı mesajını ayarla ve modalı göster
      setSuccessMessage(
        newRecommendedStatus
          ? 'Seyahat planınız başarıyla önerilenlere eklendi.'
          : 'Seyahat planınız önerilerden kaldırıldı.'
      );
      setSuccessModalVisible(true);

      // Arka planda API çağrısını yap
      const success = await FirebaseService.TravelPlan.toggleRecommendation(
        tripData.id as string,
        newRecommendedStatus,
        userId // Kullanıcı ID'sini gönder
      );

      if (!success) {
        // API çağrısı başarısız olursa UI'ı geri al
        setTripData({
          ...tripData,
          isRecommended: !newRecommendedStatus
        });

        Alert.alert(
          'Hata',
          'Öneri durumu değiştirilemedi. Lütfen tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (error) {
      console.error('Öneri durumu değiştirme hatası:', error);

      // Hata durumunda UI'ı geri al
      setTripData({
        ...tripData,
        isRecommended: !(!(tripData.isRecommended || false))
      });

      Alert.alert(
        'Hata',
        'İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.'
      );
    }
  };

  // Fotoğraf eklendiğinde planı yeniden yükle
  const handlePhotoAdded = async () => {
     if (planId) {
      try {
        // Firebase'den planı getir ama sayfayı yenileme
        const plan = await FirebaseService.TravelPlan.getTravelPlanById(planId);

        if (plan && Object.keys(plan).length > 0) {
          // Fotoğrafları parse et
          if (plan.tripPhotos) {
            const photos = parseTripPhotos(plan.tripPhotos);
            setTripPhotos(photos);
          }

          // Planı güncelle
          setTripData({
            ...tripData,
            ...plan,
            // Önerme durumunu koru
            isRecommended: plan.isRecommended !== undefined ? plan.isRecommended : tripData.isRecommended,
            // Beğeni durumunu koru
            likes: plan.likes !== undefined ? plan.likes : tripData.likes,
            likedBy: plan.likedBy || tripData.likedBy
          });

          console.log('Plan başarıyla güncellendi');

          // Başarılı mesajı göster
          setSuccessMessage('Fotoğraf başarıyla eklendi.');
          setSuccessModalVisible(true);
        } else {
          console.error('Plan bulunamadı');
        }
      } catch (error) {
        console.error('Fotoğraf ekleme sonrası plan güncelleme hatası:', error);
      }
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
    <ScrollView
      style={styles.container}
      nestedScrollEnabled={true}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToList}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title} numberOfLines={1} ellipsizeMode="tail">Seyahat Planı</ThemedText>

        {/* Beğeni Sayısı ve Butonu - Her zaman göster */}
        <TouchableOpacity
          style={[
            styles.likeCountContainer,
            tripData.likedBy?.includes(userId || '') && styles.likeCountContainerActive
          ]}
          onPress={() => {
            if (!userId) {
              setSuccessMessage('Beğeni yapabilmek için giriş yapmalısınız.');
              setSuccessModalVisible(true);
              return;
            }

            // Optimistic UI update
            const isCurrentlyLiked = tripData.likedBy?.includes(userId || '') || false;
            const currentLikes = tripData.likes || 0;

            // Create a new likedBy array
            const newLikedBy = [...(tripData.likedBy || [])];

            if (isCurrentlyLiked) {
              // Remove user from likedBy
              const index = newLikedBy.indexOf(userId || '');
              if (index > -1) {
                newLikedBy.splice(index, 1);
              }
            } else {
              // Add user to likedBy
              newLikedBy.push(userId || '');
            }

            // Create a new tripData object with updated like info
            const updatedTripData = {
              ...tripData,
              likes: isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1,
              likedBy: newLikedBy
            };

            // Update the state immediately for responsive UI
            setTripData(updatedTripData);

            // Haptic feedback
            if (Platform.OS === 'ios') {
              try {
                const Haptics = require('expo-haptics');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch (error) {
                console.log('Haptic feedback not available');
              }
            }

            // Show a brief success message
            if (!isCurrentlyLiked) {
              // Beğeni mesajını göster
              setSuccessMessage('Bu seyahat planını beğendiniz. Beğendiğiniz planlar önerilen seyahatler bölümünde görüntülenebilir.');
              setSuccessModalVisible(true);
            }

            // Then perform the actual API call in the background without waiting
            FirebaseService.TravelPlan.toggleLike(tripData.id as string, userId || '')
              .then(success => {
                if (!success) {
                  // If the API call fails, revert the UI change
                  setTripData({
                    ...tripData,
                    likes: currentLikes,
                    likedBy: tripData.likedBy || []
                  });
                  setSuccessMessage('Beğeni işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
                  setSuccessModalVisible(true);
                }
              })
              .catch(error => {
                console.error('Beğeni hatası:', error);
                // Revert UI change on error
                setTripData({
                  ...tripData,
                  likes: currentLikes,
                  likedBy: tripData.likedBy || []
                });
                setSuccessMessage('Beğeni işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
                setSuccessModalVisible(true);
              });
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name={tripData.likedBy?.includes(userId || '') ? "heart" : "heart-outline"}
            size={22}
            color={tripData.likedBy?.includes(userId || '') ? "#e91e63" : "#fff"}
          />
          <ThemedText style={styles.likeCountText}>
            {tripData.likes || 0}
          </ThemedText>
        </TouchableOpacity>

        {/* Öneri Butonu */}
        {tripData.userId === userId && (
          <TouchableOpacity
            style={[styles.actionButton, tripData.isRecommended ? styles.recommendedButton : {}]}
            onPress={() => {
              // Öneri modalını göster
              setRecommendModalVisible(true);

              // Haptic feedback
              if (Platform.OS === 'ios') {
                try {
                  const Haptics = require('expo-haptics');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (error) {
                  console.log('Haptic feedback not available');
                }
              }
            }}
          >
            <MaterialCommunityIcons
              name={tripData.isRecommended ? "star" : "star-outline"}
              size={22}
              color={tripData.isRecommended ? "#FFD700" : "#fff"}
            />
            {tripData.isRecommended && (
              <View style={styles.recommendedBadge}>
                <ThemedText style={styles.recommendedBadgeText}>Önerilen</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Önerilen Rozeti - Kullanıcı plan sahibi değilse ve plan önerilmişse */}
        {tripData.userId !== userId && tripData.isRecommended && (
          <View style={styles.recommendedIndicator}>
            <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
            <ThemedText style={styles.recommendedIndicatorText}>Önerilen</ThemedText>
          </View>
        )}

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

          {/* Temel Seyahat Bilgileri */}
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialCommunityIcons name="information-outline" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                <ThemedText style={styles.sectionTitle} numberOfLines={2}>Seyahat Bilgileri</ThemedText>
              </View>
            </View>
            <View style={styles.card}>
              <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">Destinasyon: {tripData.destination}</ThemedText>
              {tripData.startDate && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Başlangıç Tarihi: {(tripData as any).startDateISO ? new Date((tripData as any).startDateISO).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              }) : (tripData as any).originalStartDate ? new Date((tripData as any).originalStartDate).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              }) : tripData.startDate}</ThemedText>}
              {tripData.duration && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Süre: {tripData.duration} gün</ThemedText>}
              {tripData.budget && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Bütçe: {tripData.budget}</ThemedText>}
              {tripData.groupType && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Grup Tipi: {tripData.groupType}</ThemedText>}
              {tripData.numberOfPeople && <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Kişi Sayısı: {tripData.numberOfPeople}</ThemedText>}
              {tripData.bestTimeToVisit && <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">En İyi Ziyaret Zamanı: {tripData.bestTimeToVisit}</ThemedText>}

              {/* Takvime Ekle Butonu */}
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => {
                  // Haptic feedback
                  if (Platform.OS === 'ios') {
                    try {
                      const Haptics = require('expo-haptics');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch (error) {
                      console.log('Haptic feedback not available');
                    }
                  }

                  // Takvime ekle işlemini onay ile başlat
                  Alert.alert(
                    "Takvime Ekle",
                    `"${tripData.destination}" seyahatinizi takviminize eklemek istiyor musunuz?`,
                    [
                      {
                        text: "İptal",
                        style: "cancel"
                      },
                      {
                        text: "Ekle",
                        onPress: () => {
                          // Takvime ekle
                          addToCalendar();
                        }
                      }
                    ]
                  );
                }}
              >
                <MaterialCommunityIcons name="calendar-plus" size={20} color="#fff" style={{ marginRight: 8 }} />
                <ThemedText style={styles.calendarButtonText}>Takvime Ekle</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Otel Seçenekleri */}
          {tripData.hotelOptions && (() => {
            // İtinerary içindeki hotelOptions'ı kontrol et
            let hotelOptionsToUse = tripData.hotelOptions;

            // Eğer itinerary bir obje ve içinde hotelOptions varsa, onu kullan
            if (tripData.itinerary && typeof tripData.itinerary === 'object' &&
                tripData.itinerary.hotelOptions && Array.isArray(tripData.itinerary.hotelOptions)) {
              // Tip dönüşümü yaparak hotelOptions'ı kullan
              hotelOptionsToUse = tripData.itinerary.hotelOptions as unknown as Hotel[];
             }

            // Otel detaylarını göstermek için fonksiyon
            const handleHotelPress = async (hotel: Hotel) => {
              try {
                // Otelin bulunduğu şehri belirle
                const city = hotel.hotelAddress?.split(',')[1]?.trim() || tripData.destination || 'Istanbul';

                // Ek fotoğrafları getir
                if (!hotel.additionalImages || !Array.isArray(hotel.additionalImages) || hotel.additionalImages.length < 5) {

                  // OpenAI tarafından önerilen oteller için AIHotelPhotosService kullan
                  if (hotel.isAIRecommended || hotel.hotelName.includes('AI Recommended')) {
                    const updatedHotel = await AIHotelPhotosService.enhanceHotelWithPhotos(hotel, city);
                    setSelectedHotel(updatedHotel);
                  } else {
                    // Normal oteller için HotelPhotosService kullan
                    const updatedHotel = await HotelPhotosService.enhanceHotelWithPhotos(hotel, city);
                    setSelectedHotel(updatedHotel);
                  }
                } else {
                  setSelectedHotel(hotel);
                }

                // Modalı göster
                setHotelModalVisible(true);
              } catch (error) {
                console.error('Otel detayları gösterme hatası:', error);
                // Hata durumunda orijinal oteli göster
                setSelectedHotel(hotel);
                setHotelModalVisible(true);
              }
            };

            // Otel fotoğraflarını hazırla
            const prepareHotelImages = (hotel: Hotel) => {
              // Eğer additionalImages yoksa, boş bir dizi oluştur
              if (!hotel.additionalImages) {
                hotel.additionalImages = [];
              }

              // Tüm fotoğrafları obje formatında tutacak yeni bir dizi oluştur
              const processedImages: { url: string; caption?: string }[] = [];

              // Mevcut additionalImages'ı işle
              if (hotel.additionalImages && Array.isArray(hotel.additionalImages)) {
                hotel.additionalImages.forEach(img => {
                  if (typeof img === 'string') {
                    processedImages.push({ url: img });
                  } else if (typeof img === 'object' && img && img.url) {
                    processedImages.push(img);
                  }
                });
              }

              // Ana görselleri ekle (eğer zaten eklenmemişse)
              if (hotel.imageUrl && !processedImages.some(img => img.url === hotel.imageUrl)) {
                processedImages.unshift({ url: hotel.imageUrl });
              }

              if (hotel.hotelImageUrl && !processedImages.some(img => img.url === hotel.hotelImageUrl)) {
                processedImages.unshift({ url: hotel.hotelImageUrl });
              }

              // Güncellenen fotoğraf dizisini atama
              hotel.additionalImages = processedImages;

              return hotel;
            };

            if (Array.isArray(hotelOptionsToUse) && hotelOptionsToUse.length > 0) {
              // Her otel için fotoğrafları hazırla
              hotelOptionsToUse = hotelOptionsToUse.map(prepareHotelImages);

              return (
                <View style={styles.section}>
                  <View style={styles.sectionTitleContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="bed" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                      <ThemedText style={styles.sectionTitle} numberOfLines={2}>Konaklama Seçenekleri</ThemedText>
                    </View>
                  </View>

                  {hotelOptionsToUse.map((hotel: Hotel, index: number) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.card}
                      onPress={() => handleHotelPress(hotel)}
                    >
                      {/* Otel Başlık ve Değerlendirme */}
                      <View style={styles.hotelHeader}>
                        <ThemedText style={styles.hotelName} numberOfLines={1} ellipsizeMode="tail">
                          {hotel.hotelName}
                        </ThemedText>
                        <View style={styles.ratingContainer}>
                          <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                          <ThemedText style={styles.ratingText}>{hotel.rating || '?'}</ThemedText>
                        </View>
                      </View>

                      {/* Otel Fotoğrafları */}
                      {(hotel.imageUrl || hotel.hotelImageUrl || (hotel.additionalImages && hotel.additionalImages.length > 0)) && (
                        <View style={styles.hotelImageContainer}>
                          <FlatList
                            data={
                              // Tip güvenliği için additionalImages'ı obje dizisi olarak kullan
                              hotel.additionalImages && hotel.additionalImages.length > 0
                                ? hotel.additionalImages as { url: string; caption?: string }[]
                                : [{ url: hotel.imageUrl || hotel.hotelImageUrl || 'https://via.placeholder.com/300x200?text=Otel+Görseli+Yok' }]
                            }
                            keyExtractor={(_, imgIndex) => `hotel-${index}-image-${imgIndex}`}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item, index: imgIndex }) => {
                              if (!item || !item.url) return null;
                              const imageUrl = item.url;
                              return (
                                <View style={styles.hotelImageWrapper}>
                                  <Image
                                    source={{ uri: imageUrl }}
                                    style={styles.hotelImage}
                                    resizeMode="cover"
                                  />
                                  {imgIndex === 0 && hotel.additionalImages && hotel.additionalImages.length > 1 && (
                                    <View style={styles.morePhotosOverlay}>
                                      <MaterialCommunityIcons name="image-multiple" size={18} color="#fff" />
                                      <ThemedText style={styles.morePhotosText}>
                                        +{hotel.additionalImages.length - 1} fotoğraf
                                      </ThemedText>
                                    </View>
                                  )}
                                </View>
                              );
                            }}
                            contentContainerStyle={styles.hotelImageList}
                          />
                        </View>
                      )}

                      {/* Otel Bilgileri */}
                      <View style={styles.hotelInfoContainer}>
                        <View style={styles.hotelInfoRow}>
                          <MaterialCommunityIcons name="map-marker" size={16} color="#4c669f" style={styles.hotelInfoIcon} />
                          <ThemedText style={styles.infoItem} numberOfLines={2} ellipsizeMode="tail">
                            {hotel.hotelAddress}
                          </ThemedText>
                        </View>

                        <View style={styles.hotelInfoRow}>
                          <MaterialCommunityIcons name="currency-usd" size={16} color="#4c669f" style={styles.hotelInfoIcon} />
                          <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">
                            {hotel.priceRange || hotel.price || 'Belirtilmemiş'}
                          </ThemedText>
                        </View>
                      </View>

                      <ThemedText style={styles.description} numberOfLines={3} ellipsizeMode="tail">
                        {hotel.description}
                      </ThemedText>

                      <View style={styles.viewMoreContainer}>
                        <ThemedText style={styles.viewMoreText}>Detayları Göster</ThemedText>
                        <MaterialCommunityIcons name="chevron-right" size={16} color="#4c669f" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            }
            return null;
          })()}

          {/* Otel Detay Modalı */}
          <HotelDetailModal
            visible={hotelModalVisible}
            hotel={selectedHotel}
            onClose={() => setHotelModalVisible(false)}
          />

          {/* Önerme Modalı */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={recommendModalVisible}
            onRequestClose={() => setRecommendModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.recommendModalContent}>
                <View style={styles.recommendModalHeader}>
                  <MaterialCommunityIcons
                    name={tripData.isRecommended ? "star" : "star-outline"}
                    size={40}
                    color={tripData.isRecommended ? "#FFD700" : "#4c669f"}
                  />
                  <ThemedText style={styles.recommendModalTitle}>
                    {tripData.isRecommended ? 'Önerilen Seyahat Planı' : 'Seyahat Planını Öner'}
                  </ThemedText>
                </View>

                <ThemedText style={styles.recommendModalText}>
                  {tripData.isRecommended
                    ? 'Bu seyahat planınız şu anda diğer kullanıcılara öneriliyor. Önermeyi kaldırmak istiyor musunuz?'
                    : 'Bu seyahat planınızı diğer kullanıcılara önermek istiyor musunuz? Önerilen planlar, beğeni sayısına göre sıralanır ve diğer kullanıcılar tarafından görüntülenebilir.'}
                </ThemedText>

                <View style={styles.recommendModalButtons}>
                  <TouchableOpacity
                    style={styles.recommendModalCancelButton}
                    onPress={() => setRecommendModalVisible(false)}
                  >
                    <ThemedText style={styles.recommendModalCancelButtonText}>İptal</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.recommendModalActionButton,
                      tripData.isRecommended ? styles.recommendModalRemoveButton : styles.recommendModalAddButton
                    ]}
                    onPress={() => {
                      // Öneri durumunu değiştir
                      toggleRecommendation();

                      // Modalı kapat
                      setRecommendModalVisible(false);

                      // Haptic feedback
                      if (Platform.OS === 'ios') {
                        try {
                          const Haptics = require('expo-haptics');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        } catch (error) {
                          console.log('Haptic feedback not available');
                        }
                      }
                    }}
                  >
                    <ThemedText style={styles.recommendModalActionButtonText}>
                      {tripData.isRecommended ? 'Öneriyi Kaldır' : 'Öner'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Başarılı Mesajı Modalı */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={successModalVisible}
            onRequestClose={() => setSuccessModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.successModalContent}>
                <View style={styles.successModalHeader}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={40}
                    color="#4CAF50"
                  />
                  <ThemedText style={styles.successModalTitle}>
                    İşlem Başarılı
                  </ThemedText>
                </View>

                <ThemedText style={styles.successModalText}>
                  {successMessage}
                </ThemedText>

                <TouchableOpacity
                  style={styles.successModalButton}
                  onPress={() => setSuccessModalVisible(false)}
                >
                  <ThemedText style={styles.successModalButtonText}>Tamam</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Gezi Planı */}
          {/* Aktivite Detay Modalı */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => {
              setModalVisible(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#4c669f" />
                </TouchableOpacity>

                {selectedActivity && (
                  <ScrollView style={styles.modalScrollView}>
                    <View style={styles.modalHeader}>
                      <ThemedText style={styles.modalTitle}>{selectedActivity.placeName}</ThemedText>
                      {selectedActivity.time && (
                        <ThemedText style={styles.modalTime}>{selectedActivity.time}</ThemedText>
                      )}
                    </View>

                    <View style={styles.modalBody}>
                      {selectedActivity.placeDetails && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Detaylar</ThemedText>
                          <ThemedText style={styles.modalText}>{selectedActivity.placeDetails}</ThemedText>
                        </View>
                      )}

                      {selectedActivity.ticketPricing && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Bilet Bilgisi</ThemedText>
                          <ThemedText style={styles.modalText}>{selectedActivity.ticketPricing}</ThemedText>
                        </View>
                      )}

                      {selectedActivity.timeToTravel && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Ulaşım Süresi</ThemedText>
                          <ThemedText style={styles.modalText}>{selectedActivity.timeToTravel}</ThemedText>
                        </View>
                      )}

                      {selectedActivity.timeToSpend && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Tahmini Ziyaret Süresi</ThemedText>
                          <ThemedText style={styles.modalText}>{selectedActivity.timeToSpend}</ThemedText>
                        </View>
                      )}

                      {selectedActivity.cost && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Maliyet</ThemedText>
                          <ThemedText style={styles.modalText}>{selectedActivity.cost}</ThemedText>
                        </View>
                      )}

                      {selectedActivity.tips && selectedActivity.tips.length > 0 && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>İpuçları</ThemedText>
                          {selectedActivity.tips.map((tip, index) => (
                            <ThemedText key={index} style={styles.modalListItem}>
                              <ThemedText style={styles.bulletPoint}>•</ThemedText> {tip}
                            </ThemedText>
                          ))}
                        </View>
                      )}

                      {selectedActivity.warnings && selectedActivity.warnings.length > 0 && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Uyarılar</ThemedText>
                          {selectedActivity.warnings.map((warning, index) => (
                            <ThemedText key={index} style={styles.modalListItem}>
                              <ThemedText style={styles.bulletPoint}>•</ThemedText> {warning}
                            </ThemedText>
                          ))}
                        </View>
                      )}

                      {selectedActivity.alternatives && selectedActivity.alternatives.length > 0 && (
                        <View style={styles.modalSection}>
                          <ThemedText style={styles.modalSectionTitle}>Alternatifler</ThemedText>
                          {selectedActivity.alternatives.map((alternative, index) => (
                            <ThemedText key={index} style={styles.modalListItem}>
                              <ThemedText style={styles.bulletPoint}>•</ThemedText> {alternative}
                            </ThemedText>
                          ))}
                        </View>
                      )}

                      {/* Aktivite Fotoğrafları Bölümü */}
                      <View style={styles.modalSection}>
                        <ThemedText style={styles.modalSectionTitle}>Fotoğraflar</ThemedText>

                        {activityPhotosLoading ? (
                          <View style={styles.photosLoadingContainer}>
                            <ActivityIndicator size="large" color="#4c669f" />
                            <ThemedText style={styles.photosLoadingText}>Fotoğraflar yükleniyor...</ThemedText>
                          </View>
                        ) : activityPhotos.length > 0 ? (
                          <FlatList
                            data={activityPhotos}
                            keyExtractor={(_, index) => `activity-photo-${index}`}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item, index }) => (
                              <TouchableOpacity
                                style={styles.activityPhotoContainer}
                                onPress={() => {
                                  setSelectedPhoto(item.imageUrl);
                                  setSelectedPhotoIndex(index);
                                  setPhotoModalVisible(true);
                                }}
                              >
                                <Image
                                  source={{ uri: item.imageUrl }}
                                  style={styles.activityPhoto}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            )}
                            contentContainerStyle={styles.activityPhotoList}
                          />
                        ) : (
                          <ThemedText style={styles.noPhotosText}>
                            Bu aktivite için fotoğraf bulunamadı.
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </ScrollView>
                )}

                {/* Fotoğraf Görüntüleme Modalı */}
                <Modal
                  animationType="fade"
                  transparent={true}
                  visible={photoModalVisible}
                  onRequestClose={() => setPhotoModalVisible(false)}
                >
                  <View style={styles.photoModalOverlay}>
                    <TouchableOpacity
                      style={styles.photoModalCloseButton}
                      onPress={() => setPhotoModalVisible(false)}
                    >
                      <MaterialCommunityIcons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    {selectedPhoto && (
                      <View style={styles.photoModalContent}>
                        <Image
                          source={{ uri: selectedPhoto }}
                          style={styles.fullScreenPhoto}
                          resizeMode="contain"
                        />

                        {/* Navigasyon Butonları */}
                        {activityPhotos.length > 1 && (
                          <View style={styles.photoNavigation}>
                            <TouchableOpacity
                              style={[styles.photoNavButton, selectedPhotoIndex === 0 && styles.photoNavButtonDisabled]}
                              onPress={() => {
                                if (selectedPhotoIndex > 0) {
                                  const newIndex = selectedPhotoIndex - 1;
                                  setSelectedPhotoIndex(newIndex);
                                  setSelectedPhoto(activityPhotos[newIndex].imageUrl);
                                }
                              }}
                              disabled={selectedPhotoIndex === 0}
                            >
                              <MaterialCommunityIcons name="chevron-left" size={36} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.photoNavButton, selectedPhotoIndex === activityPhotos.length - 1 && styles.photoNavButtonDisabled]}
                              onPress={() => {
                                if (selectedPhotoIndex < activityPhotos.length - 1) {
                                  const newIndex = selectedPhotoIndex + 1;
                                  setSelectedPhotoIndex(newIndex);
                                  setSelectedPhoto(activityPhotos[newIndex].imageUrl);
                                }
                              }}
                              disabled={selectedPhotoIndex === activityPhotos.length - 1}
                            >
                              <MaterialCommunityIcons name="chevron-right" size={36} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Fotoğraf Bilgisi */}
                        <View style={styles.photoInfo}>
                          <ThemedText style={styles.photoInfoText}>
                            {selectedActivity?.placeName} - {selectedPhotoIndex + 1}/{activityPhotos.length}
                          </ThemedText>
                        </View>
                      </View>
                    )}
                  </View>
                </Modal>
              </View>
            </View>
          </Modal>

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
              }
              // String ise parse etmeyi dene
              else if (typeof tripData.itinerary === 'string') {
                try {
                  const parsedItinerary = safeParseJSON(tripData.itinerary);

                  if (parsedItinerary) {
                    // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
                    if (parsedItinerary.visaInfo && (!tripData.visaInfo || Object.keys(tripData.visaInfo).length === 0)) {
                      tripData.visaInfo = parsedItinerary.visaInfo;

                      // Ayrıca eski format alanlarını da doldur
                      if (parsedItinerary.visaInfo.visaRequirement) {
                        tripData.visaRequirements = parsedItinerary.visaInfo.visaRequirement;
                      }
                      if (parsedItinerary.visaInfo.visaApplicationProcess) {
                        tripData.visaApplicationProcess = parsedItinerary.visaInfo.visaApplicationProcess;
                      }
                      if (parsedItinerary.visaInfo.visaFee) {
                        tripData.visaFees = parsedItinerary.visaInfo.visaFee;
                      }
                    }

                    if (parsedItinerary.culturalDifferences) {
                      // Eğer string ise, objeye dönüştürmeyi dene
                      if (typeof parsedItinerary.culturalDifferences === 'string') {
                        try {
                          const culturalObj = safeParseJSON(parsedItinerary.culturalDifferences);
                          if (culturalObj && typeof culturalObj === 'object') {
                            tripData.culturalDifferences = culturalObj;

                            // Ayrıca eski format alanlarını da doldur
                            if (culturalObj.lifestyleDifferences) {
                              tripData.lifestyleDifferences = culturalObj.lifestyleDifferences;
                            }
                            if (culturalObj.foodCultureDifferences) {
                              tripData.foodCultureDifferences = culturalObj.foodCultureDifferences;
                            }
                            if (culturalObj.socialNormsDifferences) {
                              tripData.socialNormsDifferences = culturalObj.socialNormsDifferences;
                            }
                          } else {
                            tripData.culturalDifferences = parsedItinerary.culturalDifferences;
                          }
                        } catch (error) {
                          console.error('culturalDifferences parse hatası:', error);
                          tripData.culturalDifferences = parsedItinerary.culturalDifferences;
                        }
                      } else if (typeof parsedItinerary.culturalDifferences === 'object') {
                        tripData.culturalDifferences = parsedItinerary.culturalDifferences;

                        // Ayrıca eski format alanlarını da doldur
                        if (parsedItinerary.culturalDifferences.lifestyleDifferences) {
                          tripData.lifestyleDifferences = parsedItinerary.culturalDifferences.lifestyleDifferences;
                        }
                        if (parsedItinerary.culturalDifferences.foodCultureDifferences) {
                          tripData.foodCultureDifferences = parsedItinerary.culturalDifferences.foodCultureDifferences;
                        }
                        if (parsedItinerary.culturalDifferences.socialNormsDifferences) {
                          tripData.socialNormsDifferences = parsedItinerary.culturalDifferences.socialNormsDifferences;
                        }
                      }
                    }

                    if (parsedItinerary.localTips) {

                      // Eğer string ise, objeye dönüştürmeyi dene
                      if (typeof parsedItinerary.localTips === 'string') {
                        try {
                          const localTipsObj = safeParseJSON(parsedItinerary.localTips);
                          if (localTipsObj && typeof localTipsObj === 'object') {
                            tripData.localTips = localTipsObj;

                            // Ayrıca eski format alanlarını da doldur
                            if (localTipsObj.localTransportationGuide) {
                              tripData.localTransportationGuide = localTipsObj.localTransportationGuide;
                            }
                            if (localTipsObj.emergencyContacts) {
                              tripData.emergencyContacts = localTipsObj.emergencyContacts;
                            }
                            if (localTipsObj.currencyAndPayment) {
                              tripData.currencyAndPayment = localTipsObj.currencyAndPayment;
                            }
                            if (localTipsObj.communicationInfo) {
                              tripData.communicationInfo = localTipsObj.communicationInfo;
                            }
                            if (localTipsObj.healthcareInfo) {
                              tripData.healthcareInfo = localTipsObj.healthcareInfo;
                            }
                          } else {
                            tripData.localTips = parsedItinerary.localTips;
                          }
                        } catch (error) {
                          tripData.localTips = parsedItinerary.localTips;
                        }
                      } else if (typeof parsedItinerary.localTips === 'object') {
                        tripData.localTips = parsedItinerary.localTips;

                        // Ayrıca eski format alanlarını da doldur
                        if (parsedItinerary.localTips.localTransportationGuide) {
                          tripData.localTransportationGuide = parsedItinerary.localTips.localTransportationGuide;
                        }
                        if (parsedItinerary.localTips.emergencyContacts) {
                          tripData.emergencyContacts = parsedItinerary.localTips.emergencyContacts;
                        }
                        if (parsedItinerary.localTips.currencyAndPayment) {
                          tripData.currencyAndPayment = parsedItinerary.localTips.currencyAndPayment;
                        }
                        if (parsedItinerary.localTips.communicationInfo) {
                          tripData.communicationInfo = parsedItinerary.localTips.communicationInfo;
                        }
                        if (parsedItinerary.localTips.healthcareInfo) {
                          tripData.healthcareInfo = parsedItinerary.localTips.healthcareInfo;
                        }
                      }
                    }

                    // Direkt array ise kullan
                    if (Array.isArray(parsedItinerary)) {
                      itineraryToUse = parsedItinerary;
                    }
                    // Obje içinde itinerary array'i varsa onu kullan
                    else if (typeof parsedItinerary === 'object' &&
                             parsedItinerary.itinerary &&
                             Array.isArray(parsedItinerary.itinerary)) {
                      itineraryToUse = parsedItinerary.itinerary;
                    }
                  } else {
                    console.error('İtinerary parse edilemedi');
                  }
                } catch (parseError) {
                  console.error('İtinerary parse hatası:', parseError);
                }
              }
            }

            // İtinerary'nin gün sayısını kontrol et ve eksik günleri tamamla
            if (itineraryToUse && itineraryToUse.length > 0) {
              // Beklenen gün sayısını belirle
              let expectedDays = 1;
              if (tripData.days && typeof tripData.days === 'number') {
                expectedDays = tripData.days;
              } else if (tripData.duration) {
                if (typeof tripData.duration === 'number') {
                  expectedDays = tripData.duration;
                } else if (typeof tripData.duration === 'string') {
                  // "3 days" gibi string'den sayıyı çıkar
                  const durationMatch = tripData.duration.match(/\d+/);
                  if (durationMatch) {
                    expectedDays = parseInt(durationMatch[0], 10);
                  }
                }
              } else if (tripData.tripSummary && tripData.tripSummary.duration) {
                const durationMatch = String(tripData.tripSummary.duration).match(/\d+/);
                if (durationMatch) {
                  expectedDays = parseInt(durationMatch[0], 10);
                }
              }

 
              // Eksik günleri tamamla
              if (itineraryToUse.length < expectedDays) {
 
                for (let i = itineraryToUse.length + 1; i <= expectedDays; i++) {
                  itineraryToUse.push({
                    day: `${i}. Gün`,
                    plan: [
                      {
                        time: "09:00 - 17:00",
                        placeName: `${tripData.destination} Keşfi - Gün ${i}`,
                        placeDetails: "Bu gün için özel bir plan bulunmamaktadır. Şehri keşfedebilir veya rehberli turlara katılabilirsiniz.",
                        placeImageUrl: "",
                        geoCoordinates: { latitude: 0, longitude: 0 },
                        ticketPricing: "Değişken",
                        timeToTravel: "Değişken",
                        tips: [
                          "Yerel rehberlerden bilgi alabilirsiniz.",
                          "Hava durumuna göre giyinin.",
                          "Yanınızda su bulundurun."
                        ],
                        warnings: ["Değerli eşyalarınıza dikkat edin."],
                        alternatives: ["Müze ziyareti", "Yerel pazarları gezme", "Şehir turu"]
                      }
                    ]
                  });
                }
              }

              return (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Gezi Planı</ThemedText>
                  {itineraryToUse.map((day: any, dayIndex: number) => (
                    <View key={dayIndex} style={styles.dayCard}>
                      <ThemedText style={styles.dayTitle}>{day.day}</ThemedText>
                      {day.plan && Array.isArray(day.plan) && day.plan.map((activity: any, actIndex: number) => (
                        <TouchableOpacity
                          key={actIndex}
                          style={styles.activityCard}
                          onPress={async () => {
                            setSelectedActivity(activity);
                            setModalVisible(true);

                            // Aktivite fotoğraflarını yükle
                            if (activity.placeName && tripData.destination) {
                              setActivityPhotosLoading(true);
                              try {
                                const photos = await ActivityPhotosService.loadActivityPhotos(
                                  activity.placeName,
                                  tripData.destination
                                );
                                setActivityPhotos(photos);
                              } catch (error) {
                                console.error('Aktivite fotoğrafları yükleme hatası:', error);
                              } finally {
                                setActivityPhotosLoading(false);
                              }
                            }
                          }}
                        >
                          <ThemedText style={styles.activityTime} numberOfLines={1} ellipsizeMode="tail">{activity.time}</ThemedText>
                          <ThemedText style={styles.activityName} numberOfLines={1} ellipsizeMode="tail">{activity.placeName}</ThemedText>
                          <ThemedText style={styles.activityDetails} numberOfLines={3} ellipsizeMode="tail">{activity.placeDetails}</ThemedText>
                          {activity.ticketPricing && (
                            <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Bilet: {activity.ticketPricing}</ThemedText>
                          )}
                          {activity.timeToTravel && (
                            <ThemedText style={styles.infoItem} numberOfLines={1} ellipsizeMode="tail">Ulaşım Süresi: {activity.timeToTravel}</ThemedText>
                          )}
                          <View style={styles.viewMoreContainer}>
                            <ThemedText style={styles.viewMoreText}>Detayları Göster</ThemedText>
                            <ThemedText>
                              <MaterialCommunityIcons name="chevron-right" size={16} color="#4c669f" />
                            </ThemedText>
                          </View>
                        </TouchableOpacity>
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
                    if (!tripData.visaInfo.requiredDocuments ||
                        (Array.isArray(tripData.visaInfo.requiredDocuments) && tripData.visaInfo.requiredDocuments.length === 0)) {
                      // Boş dizi yerine varsayılan değerler ekle
                      tripData.visaInfo.requiredDocuments = ["Kimlik kartı", "Pasaport (isteğe bağlı)"];
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
          {(() => {
            // culturalDifferences'ı kontrol et ve doğru formatı bul
            let culturalDifferencesData: any = null;
            let hasCulturalData = false;

            // String olarak geldiyse parse et
            if (tripData.culturalDifferences && typeof tripData.culturalDifferences === 'string') {
              try {
                // Önce JSON olarak parse etmeyi dene
                culturalDifferencesData = safeParseJSON(tripData.culturalDifferences);
                hasCulturalData = true;
              } catch (error) {
                console.error('culturalDifferences parse hatası:', error);
                // String olarak kullan
                culturalDifferencesData = { culturalDifferences: tripData.culturalDifferences };
                hasCulturalData = true;
              }
            }
            // Direkt obje olarak geldiyse kullan
            else if (tripData.culturalDifferences && typeof tripData.culturalDifferences === 'object') {
              culturalDifferencesData = tripData.culturalDifferences;
              hasCulturalData = true;

              // Objenin içeriğini kontrol et
              Object.keys(culturalDifferencesData).forEach(key => {
                console.log(`- ${key}: ${culturalDifferencesData[key]}`);
              });
            }

            // Eksik alanları tamamla
            if (culturalDifferencesData) {
 
              // Temel kültürel farklılıklar
              if (!culturalDifferencesData.culturalDifferences) {
                culturalDifferencesData.culturalDifferences = "Bilgi bulunmuyor";
              }

              // Yaşam tarzı farklılıkları
              if (!culturalDifferencesData.lifestyleDifferences) {
                culturalDifferencesData.lifestyleDifferences = "Bilgi bulunmuyor";
              }

              // Yemek kültürü farklılıkları
              if (!culturalDifferencesData.foodCultureDifferences) {
                culturalDifferencesData.foodCultureDifferences = "Bilgi bulunmuyor";
              }

              // Sosyal normlar farklılıkları
              if (!culturalDifferencesData.socialNormsDifferences) {
                culturalDifferencesData.socialNormsDifferences = "Bilgi bulunmuyor";
              }

              // Dini ve kültürel hassasiyetler
              if (!culturalDifferencesData.religiousAndCulturalSensitivities) {
                culturalDifferencesData.religiousAndCulturalSensitivities = "Bilgi bulunmuyor";
              }

              // Yerel gelenekler ve görenekler
              if (!culturalDifferencesData.localTraditionsAndCustoms) {
                culturalDifferencesData.localTraditionsAndCustoms = "Bilgi bulunmuyor";
              }

              // Kültürel etkinlikler ve festivaller
              if (!culturalDifferencesData.culturalEventsAndFestivals) {
                culturalDifferencesData.culturalEventsAndFestivals = "Bilgi bulunmuyor";
              }

              // Yerel halkla iletişim önerileri
              if (!culturalDifferencesData.localCommunicationTips) {
                culturalDifferencesData.localCommunicationTips = "Bilgi bulunmuyor";
              }

             }

            // Diğer kültürel farklılık alanlarını kontrol et
            const hasLifestyleDifferences = tripData.lifestyleDifferences && typeof tripData.lifestyleDifferences === 'string';
            const hasFoodCultureDifferences = tripData.foodCultureDifferences && typeof tripData.foodCultureDifferences === 'string';
            const hasSocialNormsDifferences = tripData.socialNormsDifferences && typeof tripData.socialNormsDifferences === 'string';

            // Herhangi bir kültürel veri varsa bölümü göster
            if (hasCulturalData || hasLifestyleDifferences || hasFoodCultureDifferences || hasSocialNormsDifferences) {
              return (
                <View style={styles.section}>
                  <View style={styles.sectionTitleContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <ThemedText>
                        <MaterialCommunityIcons name="earth" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                      </ThemedText>
                      <ThemedText style={styles.sectionTitle} numberOfLines={2}>Kültürel Farklılıklar ve Öneriler</ThemedText>
                    </View>
                  </View>

                  {/* Temel Kültürel Farklılıklar - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.culturalDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Temel Kültürel Farklılıklar</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>
                        {culturalDifferencesData.culturalDifferences !== "Bilgi bulunmuyor"
                          ? culturalDifferencesData.culturalDifferences
                          : "Bu destinasyon için kültürel farklılık bilgisi bulunmuyor."}
                      </ThemedText>
                    </View>
                  )}

                  {/* Yaşam Tarzı Farklılıkları - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.lifestyleDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yaşam Tarzı Farklılıkları</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.lifestyleDifferences}</ThemedText>
                    </View>
                  )}

                  {/* Yemek Kültürü Farklılıkları - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.foodCultureDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yemek Kültürü</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.foodCultureDifferences}</ThemedText>
                    </View>
                  )}

                  {/* Sosyal Normlar Farklılıkları - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.socialNormsDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Sosyal Normlar</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.socialNormsDifferences}</ThemedText>
                    </View>
                  )}

                  {/* Dini ve Kültürel Hassasiyetler - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.religiousAndCulturalSensitivities && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Dini ve Kültürel Hassasiyetler</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.religiousAndCulturalSensitivities}</ThemedText>
                    </View>
                  )}

                  {/* Yerel Gelenekler ve Görenekler - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.localTraditionsAndCustoms && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yerel Gelenekler ve Görenekler</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.localTraditionsAndCustoms}</ThemedText>
                    </View>
                  )}

                  {/* Kültürel Etkinlikler ve Festivaller - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.culturalEventsAndFestivals && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Kültürel Etkinlikler ve Festivaller</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.culturalEventsAndFestivals}</ThemedText>
                    </View>
                  )}

                  {/* Yerel Halkla İletişim Önerileri - Obje içinden */}
                  {culturalDifferencesData && culturalDifferencesData.localCommunicationTips && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yerel Halkla İletişim Önerileri</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{culturalDifferencesData.localCommunicationTips}</ThemedText>
                    </View>
                  )}

                  {/* Direkt ana objede bulunan alanlar */}
                  {hasLifestyleDifferences && !culturalDifferencesData?.lifestyleDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yaşam Tarzı Farklılıkları</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{tripData.lifestyleDifferences}</ThemedText>
                    </View>
                  )}

                  {hasFoodCultureDifferences && !culturalDifferencesData?.foodCultureDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yemek Kültürü</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{tripData.foodCultureDifferences}</ThemedText>
                    </View>
                  )}

                  {hasSocialNormsDifferences && !culturalDifferencesData?.socialNormsDifferences && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Sosyal Normlar</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{tripData.socialNormsDifferences}</ThemedText>
                    </View>
                  )}

                  {/* Diğer kültürel alanlar - Obje içindeki diğer alanlar */}
                  {culturalDifferencesData && Object.entries(culturalDifferencesData)
                    .filter(([key]) => !['culturalDifferences', 'lifestyleDifferences', 'foodCultureDifferences', 'socialNormsDifferences',
                                        'religiousAndCulturalSensitivities', 'localTraditionsAndCustoms', 'culturalEventsAndFestivals',
                                        'localCommunicationTips'].includes(key))
                    .map(([key, value]: [string, any]) => (
                      <View key={key} style={styles.card}>
                        <ThemedText style={styles.cardTitle}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</ThemedText>
                        <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{value}</ThemedText>
                      </View>
                    ))
                  }
                </View>
              );
            }
            return null;
          })()}

          {/* Yerel İpuçları */}
          {(() => {
            // localTips'i kontrol et ve doğru formatı bul
            let localTipsData: any = null;
            let hasLocalTipsData = false;

            // String olarak geldiyse parse et
            if (tripData.localTips && typeof tripData.localTips === 'string') {
              try {
                // Önce JSON olarak parse etmeyi dene
                localTipsData = safeParseJSON(tripData.localTips);
                console.log('localTips JSON olarak parse edildi');
                hasLocalTipsData = true;
              } catch (error) {
                console.error('localTips parse hatası:', error);
                // String olarak kullan
                localTipsData = { localTips: tripData.localTips };
                hasLocalTipsData = true;
              }
            }
            // Direkt obje olarak geldiyse kullan
            else if (tripData.localTips && typeof tripData.localTips === 'object') {
              localTipsData = tripData.localTips;
              hasLocalTipsData = true;

              // Objenin içeriğini kontrol et
              if (Object.keys(localTipsData).length > 0) {
                console.log('localTipsData içeriği:', Object.keys(localTipsData));
              }
            }

            // Eksik alanları tamamla
            if (localTipsData) {
 
              // Yerel ulaşım rehberi
              if (!localTipsData.localTransportationGuide) {
                localTipsData.localTransportationGuide = "Bilgi bulunmuyor";
              }

              // Acil durum iletişim bilgileri
              if (!localTipsData.emergencyContacts) {
                localTipsData.emergencyContacts = "Acil durumlarda 112'yi arayın";
              }

              // Para birimi ve ödeme
              if (!localTipsData.currencyAndPayment) {
                localTipsData.currencyAndPayment = "Türk Lirası (TL) kullanılmaktadır";
              }

              // İletişim bilgileri
              if (!localTipsData.communicationInfo) {
                localTipsData.communicationInfo = "Bilgi bulunmuyor";
              }

              // Sağlık hizmetleri
              if (!localTipsData.healthcareInfo) {
                localTipsData.healthcareInfo = "Bilgi bulunmuyor";
              }

              // Yerel mutfak ve yemek önerileri
              if (!localTipsData.localCuisineAndFoodTips) {
                localTipsData.localCuisineAndFoodTips = "Bilgi bulunmuyor";
              }

              // Güvenlik önerileri
              if (!localTipsData.safetyTips) {
                localTipsData.safetyTips = "Bilgi bulunmuyor";
              }

              // Yerel dil ve iletişim ipuçları
              if (!localTipsData.localLanguageAndCommunicationTips) {
                localTipsData.localLanguageAndCommunicationTips = "Bilgi bulunmuyor";
              }

             }

            // Diğer yerel ipuçları alanlarını kontrol et
            const hasLocalTransportationGuide = tripData.localTransportationGuide && typeof tripData.localTransportationGuide === 'string';
            const hasEmergencyContacts = tripData.emergencyContacts;
            const hasCurrencyAndPayment = tripData.currencyAndPayment && typeof tripData.currencyAndPayment === 'string';
            const hasHealthcareInfo = tripData.healthcareInfo && typeof tripData.healthcareInfo === 'string';
            const hasCommunicationInfo = tripData.communicationInfo && typeof tripData.communicationInfo === 'string';

            // Herhangi bir yerel ipucu verisi varsa bölümü göster
            if (hasLocalTipsData || hasLocalTransportationGuide || hasEmergencyContacts ||
                hasCurrencyAndPayment || hasHealthcareInfo || hasCommunicationInfo) {
              return (
                <View style={styles.section}>
                  <View style={styles.sectionTitleContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <ThemedText>
                        <MaterialCommunityIcons name="map-marker-radius" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                      </ThemedText>
                      <ThemedText style={styles.sectionTitle} numberOfLines={2}>Yerel Yaşam Önerileri</ThemedText>
                    </View>
                  </View>

                  {/* Yerel Ulaşım Rehberi - Obje içinden */}
                  {localTipsData && localTipsData.localTransportationGuide && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yerel Ulaşım Rehberi</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>
                        {localTipsData.localTransportationGuide !== "Bilgi bulunmuyor"
                          ? localTipsData.localTransportationGuide
                          : "Bu destinasyon için yerel ulaşım rehberi bilgisi bulunmuyor."}
                      </ThemedText>
                    </View>
                  )}

                  {/* Acil Durum İletişim Bilgileri - Obje içinden */}
                  {localTipsData && localTipsData.emergencyContacts && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Acil Durum İletişim Bilgileri</ThemedText>
                      {typeof localTipsData.emergencyContacts === 'string' ? (
                        <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.emergencyContacts}</ThemedText>
                      ) : Array.isArray(localTipsData.emergencyContacts) ? (
                        localTipsData.emergencyContacts.map((contact: string, index: number) => (
                          <ThemedText key={index} style={[styles.infoItem, { flexShrink: 1 }]}>• {contact}</ThemedText>
                        ))
                      ) : typeof localTipsData.emergencyContacts === 'object' ? (
                        Object.entries(localTipsData.emergencyContacts).map(([key, value]: [string, any]) => (
                          <ThemedText key={key} style={[styles.infoItem, { flexShrink: 1 }]}>• {key}: {value}</ThemedText>
                        ))
                      ) : null}
                    </View>
                  )}

                  {/* Para Birimi ve Ödeme - Obje içinden */}
                  {localTipsData && localTipsData.currencyAndPayment && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Para Birimi ve Ödeme</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.currencyAndPayment}</ThemedText>
                    </View>
                  )}

                  {/* Sağlık Hizmetleri - Obje içinden */}
                  {localTipsData && localTipsData.healthcareInfo && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Sağlık Hizmetleri</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.healthcareInfo}</ThemedText>
                    </View>
                  )}

                  {/* İletişim Bilgileri - Obje içinden */}
                  {localTipsData && localTipsData.communicationInfo && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>İletişim Bilgileri</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.communicationInfo}</ThemedText>
                    </View>
                  )}

                  {/* Yerel Mutfak ve Yemek Önerileri - Obje içinden */}
                  {localTipsData && localTipsData.localCuisineAndFoodTips && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yerel Mutfak ve Yemek Önerileri</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.localCuisineAndFoodTips}</ThemedText>
                    </View>
                  )}

                  {/* Güvenlik Önerileri - Obje içinden */}
                  {localTipsData && localTipsData.safetyTips && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Güvenlik Önerileri</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.safetyTips}</ThemedText>
                    </View>
                  )}

                  {/* Yerel Dil ve İletişim İpuçları - Obje içinden */}
                  {localTipsData && localTipsData.localLanguageAndCommunicationTips && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yerel Dil ve İletişim İpuçları</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{localTipsData.localLanguageAndCommunicationTips}</ThemedText>
                    </View>
                  )}

                  {/* Direkt ana objede bulunan alanlar */}
                  {hasLocalTransportationGuide && !localTipsData?.localTransportationGuide && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Yerel Ulaşım Rehberi</ThemedText>
                      <ThemedText style={[styles.infoItem, { flexShrink: 1 }]}>{tripData.localTransportationGuide}</ThemedText>
                    </View>
                  )}

                  {hasEmergencyContacts && !localTipsData?.emergencyContacts && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Acil Durum İletişim Bilgileri</ThemedText>
                      {typeof tripData.emergencyContacts === 'string' ? (
                        <ThemedText style={styles.infoItem}>{tripData.emergencyContacts}</ThemedText>
                      ) : Array.isArray(tripData.emergencyContacts) ? (
                        tripData.emergencyContacts.map((contact: string, index: number) => (
                          <ThemedText key={index} style={styles.infoItem}>• {contact}</ThemedText>
                        ))
                      ) : typeof tripData.emergencyContacts === 'object' ? (
                        Object.entries(tripData.emergencyContacts).map(([key, value]: [string, any]) => (
                          <ThemedText key={key} style={styles.infoItem}>• {key}: {value}</ThemedText>
                        ))
                      ) : null}
                    </View>
                  )}

                  {hasCurrencyAndPayment && !localTipsData?.currencyAndPayment && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Para Birimi ve Ödeme</ThemedText>
                      <ThemedText style={styles.infoItem}>{tripData.currencyAndPayment}</ThemedText>
                    </View>
                  )}

                  {hasHealthcareInfo && !localTipsData?.healthcareInfo && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Sağlık Hizmetleri</ThemedText>
                      <ThemedText style={styles.infoItem}>{tripData.healthcareInfo}</ThemedText>
                    </View>
                  )}

                  {hasCommunicationInfo && !localTipsData?.communicationInfo && (
                    <View style={styles.card}>
                      <ThemedText style={styles.cardTitle}>İletişim Bilgileri</ThemedText>
                      <ThemedText style={styles.infoItem}>{tripData.communicationInfo}</ThemedText>
                    </View>
                  )}

                  {/* Diğer yerel ipuçları - Obje içindeki diğer alanlar */}
                  {localTipsData && Object.entries(localTipsData)
                    .filter(([key]) => !['localTransportationGuide', 'emergencyContacts', 'currencyAndPayment', 'healthcareInfo', 'communicationInfo',
                                        'localCuisineAndFoodTips', 'safetyTips', 'localLanguageAndCommunicationTips'].includes(key))
                    .map(([key, value]: [string, any]) => (
                      <View key={key} style={styles.card}>
                        <ThemedText style={styles.cardTitle}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</ThemedText>
                        <ThemedText style={styles.infoItem}>{value}</ThemedText>
                      </View>
                    ))
                  }
                </View>
              );
            }
            return null;
          })()}

          {/* Hava Durumu */}
          {weatherLoading ? (
            <View style={styles.section}>
              <View style={styles.sectionTitleContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <ThemedText>
                    <MaterialCommunityIcons name="weather-partly-cloudy" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                  </ThemedText>
                  <ThemedText style={styles.sectionTitle} numberOfLines={2}>Hava Durumu</ThemedText>
                </View>
              </View>
              <View style={[styles.card, styles.weatherLoadingContainer]}>
                <ActivityIndicator size="small" color="#4c669f" />
                <ThemedText style={styles.weatherLoadingText}>Hava durumu bilgileri yükleniyor...</ThemedText>
              </View>
            </View>
          ) : weatherData ? (
            <View style={styles.section}>
              <View style={styles.sectionTitleContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <ThemedText>
                    <MaterialCommunityIcons name="weather-partly-cloudy" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                  </ThemedText>
                  <ThemedText style={styles.sectionTitle} numberOfLines={2}>Hava Durumu</ThemedText>
                </View>
              </View>
              <WeatherCard weatherData={weatherData} />
            </View>
          ) : null}

          {/* Seyahat Fotoğrafları - Sadece planı oluşturan kullanıcı görebilir */}
          {!showPlansList && tripData.id && userId && tripData.userId === userId && (
            <View style={styles.section}>
              <View style={styles.sectionTitleContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <ThemedText>
                    <MaterialCommunityIcons name="image-multiple" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                  </ThemedText>
                  <ThemedText style={styles.sectionTitle} numberOfLines={2}>Seyahat Fotoğrafları</ThemedText>
                </View>
              </View>
              <TripPhotoUploader
                travelPlanId={tripData.id}
                userId={userId}
                tripPhotos={tripPhotos}
                onPhotoAdded={handlePhotoAdded}
                setTripPhotos={setTripPhotos}
              />
            </View>
          )}

          {/* Yorumlar Bölümü */}
          {!showPlansList && tripData.id && (
            <View style={styles.section}>
              <View style={styles.sectionTitleContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <ThemedText>
                    <MaterialCommunityIcons name="comment-text-multiple" size={22} color="#4c669f" style={{ marginRight: 8 }} />
                  </ThemedText>
                  <ThemedText style={styles.sectionTitle} numberOfLines={2}>Yorumlar ve Deneyimler</ThemedText>
                </View>
              </View>
              <TripComments travelPlanId={tripData.id} />
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

          {/* İtinerary string olarak kalmışsa gösterme */}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <ThemedText>
            <MaterialCommunityIcons name="alert-circle-outline" size={50} color="#ff6b6b" />
          </ThemedText>
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
    backgroundColor: AppStyles.colors.dark.background,
    padding: 16,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: AppStyles.colors.dark.border,
    paddingBottom: 16,
    marginBottom: 8,
  },
  // Otel başlık stili
  hotelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  // Değerlendirme container stili
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  // Değerlendirme text stili
  ratingText: {
    marginLeft: 4,
    fontWeight: '700',
    color: '#FFD700',
    fontSize: 14,
  },
  // Otel fotoğraf container stili
  hotelImageContainer: {
    marginVertical: 10,
    width: '100%',
  },
  // Otel fotoğraf listesi stili
  hotelImageList: {
    paddingVertical: 5,
  },
  // Otel fotoğraf wrapper stili
  hotelImageWrapper: {
    width: 150,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  // Otel fotoğraf stili
  hotelImage: {
    width: '100%',
    height: '100%',
  },
  // Daha fazla fotoğraf overlay stili
  morePhotosOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Daha fazla fotoğraf text stili
  morePhotosText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  // Otel bilgi container stili
  hotelInfoContainer: {
    marginVertical: 10,
  },
  // Otel bilgi satır stili
  hotelInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  // Otel bilgi ikon stili
  hotelInfoIcon: {
    marginRight: 8,
  },
  bulletPoint: {
    color: AppStyles.colors.primary,
    marginRight: AppStyles.spacing.xs,
    fontSize: 16,
  },
  backButton: {
    marginRight: AppStyles.spacing.md,
    backgroundColor: `${AppStyles.colors.primary}15`,
    width: 40,
    height: 40,
    borderRadius: AppStyles.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    ...AppStyles.shadows.small,
  },
  refreshButton: {
    marginLeft: 10,
    backgroundColor: `${AppStyles.colors.primary}15`,
    width: 40,
    height: 40,
    borderRadius: AppStyles.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    ...AppStyles.shadows.small,
  },
  actionButton: {
    marginLeft: 'auto',
    backgroundColor: `${AppStyles.colors.primary}15`,
    width: 40,
    height: 40,
    borderRadius: AppStyles.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    ...AppStyles.shadows.small,
    position: 'relative',
  },
  recommendedButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  recommendedBadge: {
    position: 'absolute',
    bottom: -15,
    left: -10,
    right: -10,
    backgroundColor: 'rgba(255, 215, 0, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedBadgeText: {
    color: '#000',
    fontSize: 8,
    fontWeight: 'bold',
  },
  recommendedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  recommendedIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  likeCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 'auto',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.3)',
    ...AppStyles.shadows.small,
    // Animasyon efekti için transform eklenebilir
    transform: [{ scale: 1.0 }],
  },
  likeCountContainerActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.2)',
    borderColor: 'rgba(233, 30, 99, 0.5)',
    transform: [{ scale: 1.05 }],
  },
  likeCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
    color: '#e91e63',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginHorizontal: AppStyles.spacing.sm,
    fontFamily: 'InterRegular',
    paddingRight: 10,
  },
  content: {
    padding: AppStyles.spacing.lg,
  },
  section: {
    marginBottom: AppStyles.spacing.xl,
  },
  sectionTitle: {
    ...AppStyles.typography.subtitle,
    color: AppStyles.colors.dark.text,
    marginBottom: AppStyles.spacing.md,
    paddingVertical: AppStyles.spacing.xs,
    paddingHorizontal: AppStyles.spacing.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  card: {
    ...AppStyles.layout.card,
    marginBottom: AppStyles.spacing.md,
    width: '100%',
  },
  dayCard: {
    ...AppStyles.layout.card,
    marginBottom: AppStyles.spacing.lg,
  },
  dayTitle: {
    ...AppStyles.typography.subtitle,
    color: AppStyles.colors.primary,
    marginBottom: AppStyles.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${AppStyles.colors.primary}20`,
    paddingBottom: AppStyles.spacing.sm,
  },
  activityCard: {
    backgroundColor: `${AppStyles.colors.dark.cardAlt}CC`,
    borderRadius: AppStyles.borderRadius.md,
    padding: AppStyles.spacing.md,
    marginBottom: AppStyles.spacing.sm,
    borderWidth: 1,
    borderColor: AppStyles.colors.dark.border,
    ...AppStyles.shadows.small,
  },
  activityTime: {
    color: AppStyles.colors.primary,
    marginBottom: AppStyles.spacing.xs,
    fontFamily: 'InterBold',
    fontSize: 14,
  },
  activityName: {
    fontSize: 18,
    color: AppStyles.colors.dark.text,
    marginBottom: AppStyles.spacing.xs,
    fontFamily: 'InterSemiBold',
  },
  activityDetails: {
    color: AppStyles.colors.dark.textMuted,
    marginBottom: AppStyles.spacing.sm,
    fontFamily: 'InterRegular',
    lineHeight: 20,
  },
  destinationName: {
    fontSize: 22,
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'InterBold',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
  },
  hotelName: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'InterBold',
  },
  infoItem: {
    color: '#ccc',
    marginBottom: 10,
    fontFamily: 'InterRegular',
    lineHeight: 20,
    fontSize: 14,
    flexWrap: 'wrap',
  },
  description: {
    color: '#999',
    marginTop: 10,
    fontFamily: 'InterRegular',
    lineHeight: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    flexWrap: 'wrap',
  },
  subTitle: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    marginBottom: 10,
    fontFamily: 'InterSemiBold',
  },
  listItem: {
    color: '#ccc',
    marginBottom: 6,
    marginLeft: 8,
    fontFamily: 'InterRegular',
    lineHeight: 20,
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    fontFamily: 'InterRegular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'InterRegular',
  },
  rawResponse: {
    color: '#ccc',
    fontFamily: 'InterRegular',
  },
  weatherLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  weatherLoadingText: {
    color: '#ccc',
    marginTop: 8,
    fontFamily: 'InterRegular',
  },
  sectionTitleContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4c669f',
  },
  cardTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'InterSemiBold',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4c669f',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#5d77af',
  },
  calendarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'InterSemiBold',
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
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'InterSemiBold',
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
    fontFamily: 'InterRegular',
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
    fontFamily: 'InterRegular',
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
    fontFamily: 'InterSemiBold',
  },
  // Aktivite detay modalı için stiller
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 10,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.3)',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    color: '#fff',
    fontFamily: 'InterBold',
    marginBottom: 5,
  },
  modalTime: {
    fontSize: 16,
    color: '#4c669f',
    fontFamily: 'InterRegular',
  },
  modalBody: {
    flex: 1,
  },
  modalSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4c669f',
  },
  modalSectionTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'InterSemiBold',
  },
  modalText: {
    color: '#ccc',
    fontFamily: 'InterRegular',
    lineHeight: 22,
    fontSize: 15,
  },
  modalListItem: {
    color: '#ccc',
    marginBottom: 8,
    marginLeft: 8,
    fontFamily: 'InterRegular',
    lineHeight: 20,
    fontSize: 15,
  },
  viewMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  viewMoreText: {
    color: '#4c669f',
    fontSize: 14,
    fontFamily: 'InterSemiBold',
    marginRight: 5,
  },

  // Aktivite Fotoğrafları Stilleri
  photosLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 150,
  },
  photosLoadingText: {
    marginTop: 10,
    color: AppStyles.colors.dark.textMuted,
    fontFamily: 'InterRegular',
  },
  activityPhotoContainer: {
    width: 150,
    height: 120,
    borderRadius: 8,
    marginRight: 10,
    overflow: 'hidden',
    ...AppStyles.shadows.small,
  },
  activityPhoto: {
    width: '100%',
    height: '100%',
  },
  activityPhotoList: {
    paddingVertical: 10,
  },
  noPhotosText: {
    color: AppStyles.colors.dark.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
    fontFamily: 'InterRegular',
  },

  // Fotoğraf Görüntüleme Modalı Stilleri
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  photoModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenPhoto: {
    width: '100%',
    height: '80%',
  },
  photoNavigation: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  photoNavButton: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  photoNavButtonDisabled: {
    opacity: 0.3,
  },
  photoInfo: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  photoInfoText: {
    color: '#fff',
    fontFamily: 'InterRegular',
    fontSize: 14,
  },

  // Önerme Modalı Stilleri
  recommendModalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    ...AppStyles.shadows.medium,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  recommendModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendModalTitle: {
    fontSize: 20,
    marginLeft: 12,
    color: '#fff',
    fontFamily: 'InterBold',
  },
  recommendModalText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    color: '#ccc',
    fontFamily: 'InterRegular',
  },
  recommendModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recommendModalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendModalCancelButtonText: {
    color: '#fff',
    fontFamily: 'InterSemiBold',
  },
  recommendModalActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  recommendModalAddButton: {
    backgroundColor: '#4c669f',
  },
  recommendModalRemoveButton: {
    backgroundColor: '#e74c3c',
  },
  recommendModalActionButtonText: {
    color: '#ffffff',
    fontFamily: 'InterSemiBold',
  },

  // Başarılı Mesajı Modalı Stilleri
  successModalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    ...AppStyles.shadows.medium,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  successModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  successModalTitle: {
    fontSize: 20,
    color: '#fff',
    marginLeft: 12,
    fontFamily: 'InterBold',
  },
  successModalText: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
    fontFamily: 'InterRegular',
    textAlign: 'center',
  },
  successModalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
    ...AppStyles.shadows.small,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'InterSemiBold',
    textAlign: 'center',
  },
});
