import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  addDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, StorageReference } from "firebase/storage";
import { db, storage } from "./firebaseConfig";
import { TravelPlan, DEFAULT_TRAVEL_PLAN, TripComment, safeParseJSON } from "../types/travel";

// Koleksiyon referansları
const TRAVEL_PLANS_COLLECTION = "travelPlans";
const USERS_COLLECTION = "users";
const TRAVEL_PLANS_COMMENTS_COLLECTION = "travelPlans_comments";
const COMMENT_PHOTOS_COLLECTION = "commentPhotos";

// Seyahat planlarını işleme servisi
export const TravelPlanService = {
  /**
   * Yeni bir seyahat planı oluşturur
   */
  async createTravelPlan(travelPlan: Partial<TravelPlan>): Promise<string> {
    try {
      const travelPlanRef = collection(db, TRAVEL_PLANS_COLLECTION);

      // Web uyumluluğu için veri formatını düzenle
      const formattedPlan = this.formatTravelPlanForWeb(travelPlan);

      // Timestamp ekle
      const planWithTimestamp = {
        ...formattedPlan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Firestore'a ekle
      const docRef = await addDoc(travelPlanRef, planWithTimestamp);
      console.log('Seyahat planı oluşturuldu:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Seyahat planı oluşturma hatası:', error);
      throw error;
    }
  },

  /**
   * Web uygulamasıyla uyumlu olması için veri formatını düzenler
   * Web uygulaması için beklenen format:
   * - bestTimeToVisit: string
   * - budget: string
   * - citizenship: string
   * - country: string
   * - days: number
   * - destination: string
   * - duration: string (örn: "1 days")
   * - groupType: string
   * - hotelOptions: array
   * - id: string
   * - isDomestic: boolean
   * - itinerary: string (JSON formatında)
   * - numberOfPeople: string
   * - residenceCountry: string
   * - startDate: string
   * - userId: string
   */
  formatTravelPlanForWeb(travelPlan: Partial<TravelPlan>): Partial<TravelPlan> {
    console.log('Web uyumluluğu için veri formatı düzenleniyor...');

    // Yeni bir nesne oluştur (orijinal nesneyi değiştirmemek için)
    // Index signature ekleyerek TypeScript hatalarını önle
    const formattedPlan: Partial<TravelPlan> & { [key: string]: any } = { ...travelPlan };

    // Temel alanları kontrol et ve düzenle
    if (!formattedPlan.bestTimeToVisit) {
      formattedPlan.bestTimeToVisit = "Not specified";
    }

    if (typeof formattedPlan.duration === 'number') {
      formattedPlan.duration = `${formattedPlan.duration} days`;
    }

    if (!formattedPlan.country && formattedPlan.destination) {
      // Destinasyondan ülke bilgisini çıkarmaya çalış
      const parts = formattedPlan.destination.split(',');
      if (parts.length > 1) {
        formattedPlan.country = parts[parts.length - 1].trim();
      }
    }

    // Kişi sayısı formatını kontrol et
    if (!formattedPlan.numberOfPeople) {
      if (formattedPlan.groupType === "Tek Başına") {
        formattedPlan.numberOfPeople = "1 Kişi";
      } else if (formattedPlan.groupType === "Çift") {
        formattedPlan.numberOfPeople = "2 Kişi";
      } else if (formattedPlan.groupType === "Aile/Grup") {
        formattedPlan.numberOfPeople = "2+ Kişi";
      }
    }

    // tripSummary alanını kontrol et ve eksikse oluştur
    if (!formattedPlan.tripSummary || typeof formattedPlan.tripSummary !== 'object') {
      console.log('tripSummary alanı oluşturuluyor...');

      // Süre bilgisini belirle
      let durationValue = formattedPlan.duration || "Belirtilmemiş";
      if (typeof durationValue === 'number') {
        durationValue = `${durationValue} gün`;
      }

      // Yolcu bilgisini belirle
      let travelersValue = "Belirtilmemiş";
      if (formattedPlan.groupType && formattedPlan.numberOfPeople) {
        travelersValue = `${formattedPlan.groupType} (${formattedPlan.numberOfPeople})`;
      } else if (formattedPlan.groupType) {
        travelersValue = formattedPlan.groupType;
      } else if (formattedPlan.numberOfPeople) {
        travelersValue = formattedPlan.numberOfPeople;
      }

      // Bütçe bilgisini belirle
      const budgetValue = formattedPlan.budget || "Belirtilmemiş";

      // tripSummary alanını oluştur
      formattedPlan.tripSummary = {
        duration: durationValue,
        travelers: travelersValue,
        budget: budgetValue
      };
    }

    // Günlük planları (Day 1, Day 2, Day 3) itinerary alanına taşı
    const dayKeys = Object.keys(formattedPlan).filter(key => key.startsWith('Day '));

    // Eğer günlük planlar varsa, bunları itinerary'ye dönüştür
    if (dayKeys.length > 0) {
      console.log('Günlük planlar bulundu, itinerary alanına taşınıyor...');

      // Günlük planları itinerary dizisine dönüştür
      const itineraryArray = dayKeys.map(dayKey => {
        const dayPlan = formattedPlan[dayKey];
        return {
          day: dayPlan.day,
          plan: dayPlan.plan
        };
      });

      // Otel bilgilerini hazırla
      let hotelOptionsArray = [];
      if (formattedPlan.hotelOptions) {
        if (typeof formattedPlan.hotelOptions === 'string') {
          try {
            hotelOptionsArray = JSON.parse(formattedPlan.hotelOptions);
          } catch (error) {
            console.error('Hotel options parse hatası:', error);
            hotelOptionsArray = [];
          }
        } else if (Array.isArray(formattedPlan.hotelOptions)) {
          hotelOptionsArray = formattedPlan.hotelOptions;
        }
      }

      // visaInfo, culturalDifferences ve localTips alanlarını itinerary'ye ekle
      const itineraryObj: any = {
        hotelOptions: hotelOptionsArray,
        itinerary: itineraryArray
      };

      // visaInfo alanını ekle
      if (formattedPlan.visaInfo) {
        console.log('visaInfo alanı itinerary\'ye ekleniyor');
        if (typeof formattedPlan.visaInfo === 'string') {
          try {
            itineraryObj.visaInfo = JSON.parse(formattedPlan.visaInfo);
          } catch (error) {
            console.error('visaInfo parse hatası:', error);
            itineraryObj.visaInfo = formattedPlan.visaInfo;
          }
        } else {
          itineraryObj.visaInfo = formattedPlan.visaInfo;
        }
      }

      // culturalDifferences alanını ekle
      if (formattedPlan.culturalDifferences) {
        console.log('culturalDifferences alanı itinerary\'ye ekleniyor');
        if (typeof formattedPlan.culturalDifferences === 'string') {
          try {
            itineraryObj.culturalDifferences = JSON.parse(formattedPlan.culturalDifferences);
          } catch (error) {
            console.error('culturalDifferences parse hatası:', error);
            itineraryObj.culturalDifferences = formattedPlan.culturalDifferences;
          }
        } else {
          itineraryObj.culturalDifferences = formattedPlan.culturalDifferences;
        }
      }

      // localTips alanını ekle
      if (formattedPlan.localTips) {
        console.log('localTips alanı itinerary\'ye ekleniyor');
        if (typeof formattedPlan.localTips === 'string') {
          try {
            itineraryObj.localTips = JSON.parse(formattedPlan.localTips);
          } catch (error) {
            console.error('localTips parse hatası:', error);
            itineraryObj.localTips = formattedPlan.localTips;
          }
        } else {
          itineraryObj.localTips = formattedPlan.localTips;
        }
      }

      // Web formatında itinerary oluştur - tam olarak web uygulamasının beklediği format
      const itineraryString = JSON.stringify(itineraryObj);

      // İtinerary'yi string olarak ayarla
      formattedPlan.itinerary = itineraryString;

      // Günlük plan alanlarını temizle
      dayKeys.forEach(dayKey => {
        delete formattedPlan[dayKey];
      });

      console.log('Günlük planlar itinerary alanına taşındı');
    }
    // Eğer itinerary zaten varsa ve string değilse
    else if (formattedPlan.itinerary && typeof formattedPlan.itinerary !== 'string') {
      console.log('İtinerary alanı string değil, düzenleniyor...');

      // İtinerary'yi web formatına dönüştür
      try {
        // Eğer itinerary bir nesne ise ve günlere göre düzenlenmişse (Day 1, Day 2, ...)
        if (typeof formattedPlan.itinerary === 'object' && formattedPlan.itinerary !== null) {
          const itineraryArray: Array<{day: string, plan: any[]}> = [];

          // Günleri diziye dönüştür
          const itineraryObj = formattedPlan.itinerary as {[key: string]: any};
          Object.keys(itineraryObj)
            .filter(key => key.startsWith('Day ') || key.includes('Gün'))
            .forEach(dayKey => {
              const dayPlan = itineraryObj[dayKey];
              if (dayPlan && dayPlan.plan) {
                itineraryArray.push({
                  day: dayPlan.day || dayKey,
                  plan: dayPlan.plan
                });
              }
            });

          // Otel bilgilerini hazırla
          let hotelOptionsArray = [];
          if (formattedPlan.hotelOptions) {
            if (typeof formattedPlan.hotelOptions === 'string') {
              try {
                hotelOptionsArray = JSON.parse(formattedPlan.hotelOptions);
              } catch (error) {
                console.error('Hotel options parse hatası:', error);
                hotelOptionsArray = [];
              }
            } else if (Array.isArray(formattedPlan.hotelOptions)) {
              hotelOptionsArray = formattedPlan.hotelOptions;
            }
          }

          // visaInfo, culturalDifferences ve localTips alanlarını itinerary'ye ekle
          const itineraryData: any = {
            hotelOptions: hotelOptionsArray,
            itinerary: itineraryArray
          };

          // visaInfo alanını ekle
          if (formattedPlan.visaInfo) {
            console.log('visaInfo alanı itinerary\'ye ekleniyor');
            if (typeof formattedPlan.visaInfo === 'string') {
              try {
                itineraryData.visaInfo = JSON.parse(formattedPlan.visaInfo);
              } catch (error) {
                console.error('visaInfo parse hatası:', error);
                itineraryData.visaInfo = formattedPlan.visaInfo;
              }
            } else {
              itineraryData.visaInfo = formattedPlan.visaInfo;
            }
          }

          // culturalDifferences alanını ekle
          if (formattedPlan.culturalDifferences) {
            console.log('culturalDifferences alanı itinerary\'ye ekleniyor');
            if (typeof formattedPlan.culturalDifferences === 'string') {
              try {
                itineraryData.culturalDifferences = JSON.parse(formattedPlan.culturalDifferences);
              } catch (error) {
                console.error('culturalDifferences parse hatası:', error);
                itineraryData.culturalDifferences = formattedPlan.culturalDifferences;
              }
            } else {
              itineraryData.culturalDifferences = formattedPlan.culturalDifferences;
            }
          }

          // localTips alanını ekle
          if (formattedPlan.localTips) {
            console.log('localTips alanı itinerary\'ye ekleniyor');
            if (typeof formattedPlan.localTips === 'string') {
              try {
                itineraryData.localTips = JSON.parse(formattedPlan.localTips);
              } catch (error) {
                console.error('localTips parse hatası:', error);
                itineraryData.localTips = formattedPlan.localTips;
              }
            } else {
              itineraryData.localTips = formattedPlan.localTips;
            }
          }

          // Web formatında itinerary oluştur
          formattedPlan.itinerary = JSON.stringify(itineraryData);
        } else {
          // Diğer durumlarda direkt JSON'a dönüştür
          formattedPlan.itinerary = JSON.stringify(formattedPlan.itinerary);
        }
      } catch (error) {
        console.error('İtinerary JSON dönüştürme hatası:', error);
        formattedPlan.itinerary = "{}";
      }
    }

    // hotelOptions alanını düzenle
    if (formattedPlan.hotelOptions && typeof formattedPlan.hotelOptions !== 'string') {
      console.log('hotelOptions alanı string değil, düzenleniyor...');
      try {
        formattedPlan.hotelOptions = JSON.stringify(formattedPlan.hotelOptions);
      } catch (error) {
        console.error('hotelOptions JSON dönüştürme hatası:', error);
        formattedPlan.hotelOptions = "[]";
      }
    }

    // Eksik alanları tamamla
    if (!formattedPlan.bestTimeToVisit) {
      formattedPlan.bestTimeToVisit = "Yıl boyu";
    }

    if (!formattedPlan.country) {
      formattedPlan.country = formattedPlan.destination?.split(',').pop()?.trim() || "Türkiye";
    }

    if (!formattedPlan.citizenship) {
      formattedPlan.citizenship = "Turkey";
    }

    if (!formattedPlan.residenceCountry) {
      formattedPlan.residenceCountry = "Turkey";
    }

    // Vize bilgilerini kontrol et ve eksik alanları tamamla
    if (formattedPlan.visaInfo && typeof formattedPlan.visaInfo === 'object') {
      const visaInfo = formattedPlan.visaInfo as any;

      // requiredDocuments alanı boş dizi ise varsayılan değerler ekle
      if (visaInfo.requiredDocuments && Array.isArray(visaInfo.requiredDocuments) && visaInfo.requiredDocuments.length === 0) {
        visaInfo.requiredDocuments = ["Kimlik kartı", "Pasaport (isteğe bağlı)"];
      }
    }

    // Kültürel farklılıklar ve yerel ipuçları için eksik alanları tamamla
    // Önce culturalDifferences'ı kontrol et
    if (!formattedPlan.culturalDifferences || typeof formattedPlan.culturalDifferences === 'string' && formattedPlan.culturalDifferences.trim() === '') {
      console.log('culturalDifferences alanı oluşturuluyor...');

      // Varsayılan culturalDifferences objesi oluştur
      const culturalDifferencesObj = {
        culturalDifferences: "Bilgi bulunmuyor",
        lifestyleDifferences: "Bilgi bulunmuyor",
        foodCultureDifferences: "Bilgi bulunmuyor",
        socialNormsDifferences: "Bilgi bulunmuyor",
        religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
        localTraditionsAndCustoms: "Bilgi bulunmuyor",
        culturalEventsAndFestivals: "Bilgi bulunmuyor",
        localCommunicationTips: "Bilgi bulunmuyor"
      };

      // TypeScript hatası nedeniyle any tipine dönüştür
      (formattedPlan as any).culturalDifferences = culturalDifferencesObj;
    }
    else if (typeof formattedPlan.culturalDifferences === 'object') {
      const culturalDifferences = formattedPlan.culturalDifferences as any;

      // Eksik alanları tamamla
      if (!culturalDifferences.culturalDifferences) {
        culturalDifferences.culturalDifferences = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.lifestyleDifferences) {
        culturalDifferences.lifestyleDifferences = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.foodCultureDifferences) {
        culturalDifferences.foodCultureDifferences = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.socialNormsDifferences) {
        culturalDifferences.socialNormsDifferences = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.religiousAndCulturalSensitivities) {
        culturalDifferences.religiousAndCulturalSensitivities = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.localTraditionsAndCustoms) {
        culturalDifferences.localTraditionsAndCustoms = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.culturalEventsAndFestivals) {
        culturalDifferences.culturalEventsAndFestivals = "Bilgi bulunmuyor";
      }

      if (!culturalDifferences.localCommunicationTips) {
        culturalDifferences.localCommunicationTips = "Bilgi bulunmuyor";
      }
    }
    else if (typeof formattedPlan.culturalDifferences === 'string' && formattedPlan.culturalDifferences.trim() !== '') {
      // String ise ve boş değilse, objeye dönüştürmeyi dene
      try {
        const parsedCulturalDifferences = JSON.parse(formattedPlan.culturalDifferences);
        if (parsedCulturalDifferences && typeof parsedCulturalDifferences === 'object') {
          formattedPlan.culturalDifferences = parsedCulturalDifferences;
        } else {
          // Parse edilemezse, string'i culturalDifferences alanına koy
          const culturalDifferencesObj = {
            culturalDifferences: formattedPlan.culturalDifferences,
            lifestyleDifferences: "Bilgi bulunmuyor",
            foodCultureDifferences: "Bilgi bulunmuyor",
            socialNormsDifferences: "Bilgi bulunmuyor",
            religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
            localTraditionsAndCustoms: "Bilgi bulunmuyor",
            culturalEventsAndFestivals: "Bilgi bulunmuyor",
            localCommunicationTips: "Bilgi bulunmuyor"
          };

          // TypeScript hatası nedeniyle any tipine dönüştür
          (formattedPlan as any).culturalDifferences = culturalDifferencesObj;
        }
      } catch (error) {
        console.error('culturalDifferences parse hatası:', error);
        // Parse edilemezse, string'i culturalDifferences alanına koy
        const culturalDifferencesObj = {
          culturalDifferences: formattedPlan.culturalDifferences,
          lifestyleDifferences: "Bilgi bulunmuyor",
          foodCultureDifferences: "Bilgi bulunmuyor",
          socialNormsDifferences: "Bilgi bulunmuyor",
          religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
          localTraditionsAndCustoms: "Bilgi bulunmuyor",
          culturalEventsAndFestivals: "Bilgi bulunmuyor",
          localCommunicationTips: "Bilgi bulunmuyor"
        };

        // TypeScript hatası nedeniyle any tipine dönüştür
        (formattedPlan as any).culturalDifferences = culturalDifferencesObj;
      }
    }

    // Yerel ipuçları için eksik alanları tamamla
    if (!formattedPlan.localTips || typeof formattedPlan.localTips === 'string' && formattedPlan.localTips.trim() === '') {
      console.log('localTips alanı oluşturuluyor...');

      // Varsayılan localTips objesi oluştur
      const localTipsObj = {
        localTransportationGuide: "Bilgi bulunmuyor",
        emergencyContacts: "Acil durumlarda 112'yi arayın",
        currencyAndPayment: "Türk Lirası (TL) kullanılmaktadır",
        communicationInfo: "Bilgi bulunmuyor",
        healthcareInfo: "Bilgi bulunmuyor",
        localCuisineAndFoodTips: "Bilgi bulunmuyor",
        safetyTips: "Bilgi bulunmuyor",
        localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
      };

      // TypeScript hatası nedeniyle any tipine dönüştür
      (formattedPlan as any).localTips = localTipsObj;
    }
    else if (typeof formattedPlan.localTips === 'object') {
      const localTips = formattedPlan.localTips as any;

      // Eksik alanları tamamla
      if (!localTips.localTransportationGuide) {
        localTips.localTransportationGuide = "Bilgi bulunmuyor";
      }

      if (!localTips.emergencyContacts) {
        localTips.emergencyContacts = "Acil durumlarda 112'yi arayın";
      }

      if (!localTips.currencyAndPayment) {
        localTips.currencyAndPayment = "Türk Lirası (TL) kullanılmaktadır";
      }

      if (!localTips.communicationInfo) {
        localTips.communicationInfo = "Bilgi bulunmuyor";
      }

      if (!localTips.healthcareInfo) {
        localTips.healthcareInfo = "Bilgi bulunmuyor";
      }

      if (!localTips.localCuisineAndFoodTips) {
        localTips.localCuisineAndFoodTips = "Bilgi bulunmuyor";
      }

      if (!localTips.safetyTips) {
        localTips.safetyTips = "Bilgi bulunmuyor";
      }

      if (!localTips.localLanguageAndCommunicationTips) {
        localTips.localLanguageAndCommunicationTips = "Bilgi bulunmuyor";
      }
    }
    else if (typeof formattedPlan.localTips === 'string' && formattedPlan.localTips.trim() !== '') {
      // String ise ve boş değilse, objeye dönüştürmeyi dene
      try {
        const parsedLocalTips = JSON.parse(formattedPlan.localTips);
        if (parsedLocalTips && typeof parsedLocalTips === 'object') {
          formattedPlan.localTips = parsedLocalTips;
        } else {
          // Parse edilemezse, string'i localTransportationGuide alanına koy
          const localTipsObj = {
            localTransportationGuide: formattedPlan.localTips,
            emergencyContacts: "Acil durumlarda 112'yi arayın",
            currencyAndPayment: "Türk Lirası (TL) kullanılmaktadır",
            communicationInfo: "Bilgi bulunmuyor",
            healthcareInfo: "Bilgi bulunmuyor",
            localCuisineAndFoodTips: "Bilgi bulunmuyor",
            safetyTips: "Bilgi bulunmuyor",
            localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
          };

          // TypeScript hatası nedeniyle any tipine dönüştür
          (formattedPlan as any).localTips = localTipsObj;
        }
      } catch (error) {
        console.error('localTips parse hatası:', error);
        // Parse edilemezse, string'i localTransportationGuide alanına koy
        const localTipsObj = {
          localTransportationGuide: formattedPlan.localTips,
          emergencyContacts: "Acil durumlarda 112'yi arayın",
          currencyAndPayment: "Türk Lirası (TL) kullanılmaktadır",
          communicationInfo: "Bilgi bulunmuyor",
          healthcareInfo: "Bilgi bulunmuyor",
          localCuisineAndFoodTips: "Bilgi bulunmuyor",
          safetyTips: "Bilgi bulunmuyor",
          localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
        };

        // TypeScript hatası nedeniyle any tipine dönüştür
        (formattedPlan as any).localTips = localTipsObj;
      }
    }

    // Karmaşık nesneleri JSON string'e dönüştür - web uygulaması için
    // İtinerary ve hotelOptions alanlarını zaten string'e dönüştürdük
    // Diğer karmaşık nesneleri de string'e dönüştürelim
    const complexObjectsToStringify = [
      'visaInfo', 'tripSummary', 'destinationInfo', 'localTips',
      'culturalDifferences'
    ];

    complexObjectsToStringify.forEach(field => {
      if (formattedPlan[field] && typeof formattedPlan[field] === 'object') {
        try {
          formattedPlan[field] = JSON.stringify(formattedPlan[field]);
          console.log(`${field} alanı JSON string'e dönüştürüldü`);
        } catch (error) {
          console.error(`${field} JSON dönüştürme hatası:`, error);
          // Hata durumunda alanı silmek yerine boş bir string olarak ayarla
          formattedPlan[field] = "{}";
        }
      }
    });

    // startDate formatını kontrol et ve web uygulaması için uygun formata dönüştür
    if (formattedPlan.startDate) {
      try {
        let date: Date;

        // String ise parse et
        if (typeof formattedPlan.startDate === 'string') {
          // ISO formatı (2023-04-30T14:52:18.000Z)
          if (formattedPlan.startDate.includes('T')) {
            date = new Date(formattedPlan.startDate);
          }
          // Zaten DD/MM/YYYY formatındaysa
          else if (formattedPlan.startDate.includes('/')) {
            const [day, month, year] = formattedPlan.startDate.split('/').map(Number);
            date = new Date(year, month - 1, day);
          }
          // Diğer string formatları
          else {
            date = new Date(formattedPlan.startDate);
          }
        }
        // Date objesi ise direkt kullan
        else if (typeof formattedPlan.startDate === 'object' && formattedPlan.startDate !== null && 'getTime' in formattedPlan.startDate) {
          date = formattedPlan.startDate as Date;
        }
        // Diğer durumlar için bugünün tarihini kullan
        else {
          date = new Date();
        }

        // Geçerli bir tarih mi kontrol et
        if (!isNaN(date.getTime())) {
          // Web uygulaması için Türkçe tarih formatı (30 Nisan 2025)
          const options: Intl.DateTimeFormatOptions = {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          };

          // Türkçe tarih formatı oluştur
          formattedPlan.startDate = date.toLocaleDateString('tr-TR', options);
          console.log('Tarih formatı düzenlendi (Türkçe format):', formattedPlan.startDate);
        } else {
          console.warn('Geçersiz tarih:', formattedPlan.startDate);
          // Geçersiz tarih ise bugünün tarihini kullan
          const today = new Date();
          const options: Intl.DateTimeFormatOptions = {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          };
          formattedPlan.startDate = today.toLocaleDateString('tr-TR', options);
        }
      } catch (error) {
        console.error('Tarih dönüştürme hatası:', error);
        // Hata durumunda bugünün tarihini kullan
        const today = new Date();
        const options: Intl.DateTimeFormatOptions = {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        };
        formattedPlan.startDate = today.toLocaleDateString('tr-TR', options);
      }
    }

    // Veri formatını kontrol et - web uygulamasının beklediği formatta olduğundan emin ol
    console.log('Web uyumluluğu için veri formatı düzenlendi:', Object.keys(formattedPlan));

    return formattedPlan;
  },

  /**
   * Kullanıcının seyahat planlarını getirir
   */
  async getUserTravelPlans(userId: string): Promise<Partial<TravelPlan>[]> {
    try {
      console.log('Kullanıcının seyahat planları çekiliyor...', userId);

      if (!userId?.trim()) {
        console.warn("Geçersiz kullanıcı ID'si veya boş ID. Örnek veri gösteriliyor.");
        // Kullanıcı ID boşsa örnek veri döndürelim
        return this.getMockTravelPlans();
      }

      const travelPlansRef = collection(db, TRAVEL_PLANS_COLLECTION);
      console.log('Firestore koleksiyonu referansı alındı:', TRAVEL_PLANS_COLLECTION);

      // Bileşik indeks hatasını önlemek için orderBy kullanmıyoruz
      // Kalıcı çözüm için: Firebase konsolunda indeksi oluşturmak gerekiyor
      // https://console.firebase.google.com/project/ai-traveller-67214/firestore/indexes
      const q = query(
        travelPlansRef,
        where("userId", "==", userId)
        // orderBy('createdAt', 'desc') - indeks gerektirir
      );

      console.log('Firestore sorgusu gerçekleştiriliyor...');
      const querySnapshot = await getDocs(q);
      console.log('Firestore sorgu sonucu:', querySnapshot.size, 'plan bulundu');

      const plans: Partial<TravelPlan>[] = [];

      querySnapshot.forEach(doc => {
        console.log('Plan verisi işleniyor, ID:', doc.id);
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : undefined;

        const updatedAt = data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : undefined;

        // Özel işleme: itinerary içindeki visaInfo, culturalDifferences ve localTips alanlarını çıkar
        if (data.itinerary && typeof data.itinerary === 'string') {
          try {
            const parsedItinerary = JSON.parse(data.itinerary);
            if (parsedItinerary && typeof parsedItinerary === 'object') {
              // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
              // ve üst seviye alanlara taşı
              if (parsedItinerary.visaInfo && !data.visaInfo) {
                console.log('Extracting visaInfo from itinerary for plan:', doc.id);
                data.visaInfo = parsedItinerary.visaInfo;
              }

              if (parsedItinerary.culturalDifferences && !data.culturalDifferences) {
                console.log('Extracting culturalDifferences from itinerary for plan:', doc.id);
                data.culturalDifferences = parsedItinerary.culturalDifferences;
              }

              if (parsedItinerary.localTips && !data.localTips) {
                console.log('Extracting localTips from itinerary for plan:', doc.id);
                data.localTips = parsedItinerary.localTips;
              }
            }
          } catch (error) {
            console.error('Error parsing itinerary for plan:', doc.id, error);
          }
        }

        // Web uygulamasından gelen string formatındaki culturalDifferences ve localTips alanlarını parse et
        if (data.culturalDifferences && typeof data.culturalDifferences === 'string') {
          try {
            console.log('Parsing culturalDifferences string from web app for plan:', doc.id);
            console.log('Original culturalDifferences string:', data.culturalDifferences);

            // Önce string içindeki kaçış karakterlerini temizle
            let cleanString = data.culturalDifferences
              .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
              .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

            // Eğer string JSON formatında değilse, düzelt
            if (!cleanString.startsWith('{')) {
              cleanString = `{${cleanString}}`;
            }

            console.log('Cleaned culturalDifferences string:', cleanString);

            try {
              const parsedCulturalDifferences = JSON.parse(cleanString);
              if (parsedCulturalDifferences && typeof parsedCulturalDifferences === 'object') {
                console.log('Successfully parsed culturalDifferences as object');
                data.culturalDifferences = parsedCulturalDifferences;
              }
            } catch (innerError) {
              console.error('Error parsing cleaned culturalDifferences string:', innerError);

              // Alternatif çözüm: Direkt olarak obje oluştur
              console.log('Creating culturalDifferences object manually');
              data.culturalDifferences = {
                culturalDifferences: data.culturalDifferences,
                lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
                foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
                socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
                religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
                localTraditionsAndCustoms: "Bilgi bulunmuyor",
                culturalEventsAndFestivals: "Bilgi bulunmuyor",
                localCommunicationTips: "Bilgi bulunmuyor"
              };
            }
          } catch (error) {
            console.error('Error in culturalDifferences processing for plan:', doc.id, error);

            // Hata durumunda manuel obje oluştur
            data.culturalDifferences = {
              culturalDifferences: typeof data.culturalDifferences === 'string' ? data.culturalDifferences : "Bilgi bulunmuyor",
              lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
              foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
              socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
              religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
              localTraditionsAndCustoms: "Bilgi bulunmuyor",
              culturalEventsAndFestivals: "Bilgi bulunmuyor",
              localCommunicationTips: "Bilgi bulunmuyor"
            };
          }
        } else if (!data.culturalDifferences) {
          // culturalDifferences yoksa oluştur
          console.log('Creating new culturalDifferences object for plan:', doc.id);
          data.culturalDifferences = {
            culturalDifferences: "Bilgi bulunmuyor",
            lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
            foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
            socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
            religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
            localTraditionsAndCustoms: "Bilgi bulunmuyor",
            culturalEventsAndFestivals: "Bilgi bulunmuyor",
            localCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        if (data.localTips && typeof data.localTips === 'string') {
          try {
            console.log('Parsing localTips string from web app for plan:', doc.id);
            console.log('Original localTips string:', data.localTips);

            // Önce string içindeki kaçış karakterlerini temizle
            let cleanString = data.localTips
              .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
              .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

            // Eğer string JSON formatında değilse, düzelt
            if (!cleanString.startsWith('{')) {
              cleanString = `{${cleanString}}`;
            }

            console.log('Cleaned localTips string:', cleanString);

            try {
              const parsedLocalTips = JSON.parse(cleanString);
              if (parsedLocalTips && typeof parsedLocalTips === 'object') {
                console.log('Successfully parsed localTips as object');
                data.localTips = parsedLocalTips;
              }
            } catch (innerError) {
              console.error('Error parsing cleaned localTips string:', innerError);

              // Alternatif çözüm: Direkt olarak obje oluştur
              console.log('Creating localTips object manually');
              data.localTips = {
                localTransportationGuide: data.localTransportationGuide || data.localTips || "Bilgi bulunmuyor",
                emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
                currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
                communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
                healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
                localCuisineAndFoodTips: "Bilgi bulunmuyor",
                safetyTips: "Bilgi bulunmuyor",
                localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
              };
            }
          } catch (error) {
            console.error('Error in localTips processing for plan:', doc.id, error);

            // Hata durumunda manuel obje oluştur
            data.localTips = {
              localTransportationGuide: data.localTransportationGuide || (typeof data.localTips === 'string' ? data.localTips : "Bilgi bulunmuyor"),
              emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
              currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
              communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
              healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
              localCuisineAndFoodTips: "Bilgi bulunmuyor",
              safetyTips: "Bilgi bulunmuyor",
              localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
            };
          }
        } else if (!data.localTips) {
          // localTips yoksa oluştur
          console.log('Creating new localTips object for plan:', doc.id);
          data.localTips = {
            localTransportationGuide: data.localTransportationGuide || "Bilgi bulunmuyor",
            emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
            currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
            communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
            healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
            localCuisineAndFoodTips: "Bilgi bulunmuyor",
            safetyTips: "Bilgi bulunmuyor",
            localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        // Vize bilgilerini de parse et
        if (data.visaInfo && typeof data.visaInfo === 'string') {
          try {
            console.log('Parsing visaInfo string from web app for plan:', doc.id);
            const parsedVisaInfo = JSON.parse(data.visaInfo);
            if (parsedVisaInfo && typeof parsedVisaInfo === 'object') {
              data.visaInfo = parsedVisaInfo;
            }
          } catch (error) {
            console.error('Error parsing visaInfo string for plan:', doc.id, error);
          }
        }

        // tripSummary alanını da parse et
        if (data.tripSummary && typeof data.tripSummary === 'string') {
          try {
            console.log('Parsing tripSummary string from web app for plan:', doc.id);
            const parsedTripSummary = JSON.parse(data.tripSummary);
            if (parsedTripSummary && typeof parsedTripSummary === 'object') {
              data.tripSummary = parsedTripSummary;
            }
          } catch (error) {
            console.error('Error parsing tripSummary string for plan:', doc.id, error);
          }
        }

        // Eksik alanları tamamla
        const processedData = { ...data };

        // tripSummary alanını kontrol et ve eksikse oluştur
        if (!processedData.tripSummary || typeof processedData.tripSummary === 'string' && processedData.tripSummary.trim() === '') {
          console.log('tripSummary alanı oluşturuluyor (getUserTravelPlans)...');

          // Süre bilgisini belirle
          let durationValue = processedData.duration || "Belirtilmemiş";
          if (typeof durationValue === 'number') {
            durationValue = `${durationValue} gün`;
          }

          // Yolcu bilgisini belirle
          let travelersValue = "Belirtilmemiş";
          if (processedData.groupType && processedData.numberOfPeople) {
            travelersValue = `${processedData.groupType} (${processedData.numberOfPeople})`;
          } else if (processedData.groupType) {
            travelersValue = processedData.groupType;
          } else if (processedData.numberOfPeople) {
            travelersValue = processedData.numberOfPeople;
          }

          // Bütçe bilgisini belirle
          const budgetValue = processedData.budget || "Belirtilmemiş";

          // tripSummary alanını oluştur
          processedData.tripSummary = {
            duration: durationValue,
            travelers: travelersValue,
            budget: budgetValue
          };
        }

        // culturalDifferences alanını kontrol et ve eksikse oluştur
        if (!processedData.culturalDifferences) {
          console.log('culturalDifferences alanı oluşturuluyor (getUserTravelPlans)...');
          processedData.culturalDifferences = {
            culturalDifferences: "Bilgi bulunmuyor",
            lifestyleDifferences: "Bilgi bulunmuyor",
            foodCultureDifferences: "Bilgi bulunmuyor",
            socialNormsDifferences: "Bilgi bulunmuyor",
            religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
            localTraditionsAndCustoms: "Bilgi bulunmuyor",
            culturalEventsAndFestivals: "Bilgi bulunmuyor",
            localCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        // localTips alanını kontrol et ve eksikse oluştur
        if (!processedData.localTips) {
          console.log('localTips alanı oluşturuluyor (getUserTravelPlans)...');
          processedData.localTips = {
            localTransportationGuide: "Bilgi bulunmuyor",
            emergencyContacts: "Acil durumlarda 112'yi arayın",
            currencyAndPayment: "Türk Lirası (TL) kullanılmaktadır",
            communicationInfo: "Bilgi bulunmuyor",
            healthcareInfo: "Bilgi bulunmuyor",
            localCuisineAndFoodTips: "Bilgi bulunmuyor",
            safetyTips: "Bilgi bulunmuyor",
            localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        plans.push({
          ...processedData as Partial<TravelPlan>,
          id: doc.id,
          createdAt,
          updatedAt
        });
      });

      console.log('Kullanıcının seyahat planları başarıyla alındı');

      if (plans.length === 0) {
        console.log('Kullanıcı için plan bulunamadı, örnek veri döndürülüyor...');
        return this.getMockTravelPlans();
      }

      return plans;
    } catch (error) {
      console.error('Seyahat planları getirme hatası:', error);
      console.log('Örnek veri döndürülüyor...');
      return this.getMockTravelPlans();
    }
  },

  /**
   * Veri bulunamadığında örnek seyahat planı verileri döndürür
   */
  getMockTravelPlans(): Partial<TravelPlan>[] {
    console.log('Örnek seyahat planı verileri oluşturuluyor...');
    return [
      {
        id: "1742413581907",
        userId: "user_2uH5RWoSIs3KOab99PGzWpCiETn",
        destination: "Bükreş, Romanya",
        duration: "3 days", // Web uyumluluğu için string
        days: 3,
        startDate: "4 Nisan 2025",
        country: "Romanya",
        citizenship: "Turkey",
        residenceCountry: "Turkey",
        groupType: "Çift",
        numberOfPeople: "2 Kişi",
        budget: "Standart",
        bestTimeToVisit: "Not specified",
        isDomestic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Döngüsel rekanslı dalgalanma hatasını engellemek için JSON'a çeviriyoruz
        itinerary: JSON.stringify({
          destination: "Bükreş, Romanya",
          duration: "3 Gün",
          groupType: "Çift",
          budget: "Standart",
          residenceCountry: "Türkiye",
          citizenship: "Türkiye",
          hotelOptions: [
            {
              hotelName: "Hotel Cismigiu",
              hotelAddress: "Bulevardul Regina Elisabeta 38, Bükreş",
              price: "400 TL - 700 TL gece",
              hotelImageUrl: "https://www.hotelcismigiu.ro/wp-content/uploads/2023/03/Hotel-Cismigiu-Exterior-Night-2-scaled.jpg",
              geoCoordinates: { latitude: 44.4334, longitude: 26.0978 },
              rating: 4.0,
              description: "Şehir merkezine yakın, tarihi bir binada yer alan şık bir otel.",
              bestTimeToVisit: "İlkbahar veya Sonbahar",
              features: ["Merkezi konum", "Restoran", "Ücretsiz Wi-Fi"],
              surroundings: "Cismigiu Parkı, Üniversite Meydanı"
            },
            // Diğer otel seçenekleri...
          ],
          itinerary: [
            { day: "1. Gün", plan: [] },
            { day: "2. Gün", plan: [] },
            { day: "3. Gün", plan: [] }
          ]
        })
      }
    ];
  },

  /**
   * Belirli bir seyahat planını ID'ye göre getirir
   */
  async getTravelPlanById(id: string): Promise<Partial<TravelPlan>> {
    try {
      if (!id?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return { ...DEFAULT_TRAVEL_PLAN };
      }

      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn('Seyahat planı bulunamadı:', id);
        return { ...DEFAULT_TRAVEL_PLAN, id };
      }

      const data = docSnap.data();

      // Timestamp'i Date'e dönüştür
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : undefined;

      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : undefined;

      // Özel işleme: itinerary içindeki visaInfo, culturalDifferences ve localTips alanlarını çıkar
      if (data.itinerary && typeof data.itinerary === 'string') {
        try {
          const parsedItinerary = JSON.parse(data.itinerary);
          if (parsedItinerary && typeof parsedItinerary === 'object') {
            // visaInfo, culturalDifferences ve localTips alanlarını itinerary'den çıkar
            // ve üst seviye alanlara taşı
            if (parsedItinerary.visaInfo && !data.visaInfo) {
              console.log('Extracting visaInfo from itinerary');
              data.visaInfo = parsedItinerary.visaInfo;
            }

            if (parsedItinerary.culturalDifferences && !data.culturalDifferences) {
              console.log('Extracting culturalDifferences from itinerary');
              data.culturalDifferences = parsedItinerary.culturalDifferences;
            }

            if (parsedItinerary.localTips && !data.localTips) {
              console.log('Extracting localTips from itinerary');
              data.localTips = parsedItinerary.localTips;
            }
          }
        } catch (error) {
          console.error('Error parsing itinerary:', error);
        }
      }

      // Web uygulamasından gelen string formatındaki culturalDifferences ve localTips alanlarını parse et
      if (data.culturalDifferences && typeof data.culturalDifferences === 'string') {
        try {
          console.log('Parsing culturalDifferences string from web app');
          console.log('Original culturalDifferences string:', data.culturalDifferences);

          // Önce string içindeki kaçış karakterlerini temizle
          let cleanString = data.culturalDifferences
            .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
            .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

          // Eğer string JSON formatında değilse, düzelt
          if (!cleanString.startsWith('{')) {
            cleanString = `{${cleanString}}`;
          }

          console.log('Cleaned culturalDifferences string:', cleanString);

          try {
            const parsedCulturalDifferences = JSON.parse(cleanString);
            if (parsedCulturalDifferences && typeof parsedCulturalDifferences === 'object') {
              console.log('Successfully parsed culturalDifferences as object');
              data.culturalDifferences = parsedCulturalDifferences;
            }
          } catch (innerError) {
            console.error('Error parsing cleaned culturalDifferences string:', innerError);

            // Alternatif çözüm: Direkt olarak obje oluştur
            console.log('Creating culturalDifferences object manually');
            data.culturalDifferences = {
              culturalDifferences: data.culturalDifferences,
              lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
              foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
              socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
              religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
              localTraditionsAndCustoms: "Bilgi bulunmuyor",
              culturalEventsAndFestivals: "Bilgi bulunmuyor",
              localCommunicationTips: "Bilgi bulunmuyor"
            };
          }
        } catch (error) {
          console.error('Error in culturalDifferences processing:', error);

          // Hata durumunda manuel obje oluştur
          data.culturalDifferences = {
            culturalDifferences: typeof data.culturalDifferences === 'string' ? data.culturalDifferences : "Bilgi bulunmuyor",
            lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
            foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
            socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
            religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
            localTraditionsAndCustoms: "Bilgi bulunmuyor",
            culturalEventsAndFestivals: "Bilgi bulunmuyor",
            localCommunicationTips: "Bilgi bulunmuyor"
          };
        }
      } else if (!data.culturalDifferences) {
        // culturalDifferences yoksa oluştur
        console.log('Creating new culturalDifferences object');
        data.culturalDifferences = {
          culturalDifferences: "Bilgi bulunmuyor",
          lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
          foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
          socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
          religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
          localTraditionsAndCustoms: "Bilgi bulunmuyor",
          culturalEventsAndFestivals: "Bilgi bulunmuyor",
          localCommunicationTips: "Bilgi bulunmuyor"
        };
      }

      if (data.localTips && typeof data.localTips === 'string') {
        try {
          console.log('Parsing localTips string from web app');
          console.log('Original localTips string:', data.localTips);

          // Önce string içindeki kaçış karakterlerini temizle
          let cleanString = data.localTips
            .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
            .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

          // Eğer string JSON formatında değilse, düzelt
          if (!cleanString.startsWith('{')) {
            cleanString = `{${cleanString}}`;
          }

          console.log('Cleaned localTips string:', cleanString);

          try {
            const parsedLocalTips = JSON.parse(cleanString);
            if (parsedLocalTips && typeof parsedLocalTips === 'object') {
              console.log('Successfully parsed localTips as object');
              data.localTips = parsedLocalTips;
            }
          } catch (innerError) {
            console.error('Error parsing cleaned localTips string:', innerError);

            // Alternatif çözüm: Direkt olarak obje oluştur
            console.log('Creating localTips object manually');
            data.localTips = {
              localTransportationGuide: data.localTransportationGuide || data.localTips || "Bilgi bulunmuyor",
              emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
              currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
              communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
              healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
              localCuisineAndFoodTips: "Bilgi bulunmuyor",
              safetyTips: "Bilgi bulunmuyor",
              localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
            };
          }
        } catch (error) {
          console.error('Error in localTips processing:', error);

          // Hata durumunda manuel obje oluştur
          data.localTips = {
            localTransportationGuide: data.localTransportationGuide || (typeof data.localTips === 'string' ? data.localTips : "Bilgi bulunmuyor"),
            emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
            currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
            communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
            healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
            localCuisineAndFoodTips: "Bilgi bulunmuyor",
            safetyTips: "Bilgi bulunmuyor",
            localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
          };
        }
      } else if (!data.localTips) {
        // localTips yoksa oluştur
        console.log('Creating new localTips object');
        data.localTips = {
          localTransportationGuide: data.localTransportationGuide || "Bilgi bulunmuyor",
          emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
          currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
          communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
          healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
          localCuisineAndFoodTips: "Bilgi bulunmuyor",
          safetyTips: "Bilgi bulunmuyor",
          localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
        };
      }

      // Vize bilgilerini de parse et
      if (data.visaInfo && typeof data.visaInfo === 'string') {
        try {
          console.log('Parsing visaInfo string from web app');
          const parsedVisaInfo = JSON.parse(data.visaInfo);
          if (parsedVisaInfo && typeof parsedVisaInfo === 'object') {
            data.visaInfo = parsedVisaInfo;
          }
        } catch (error) {
          console.error('Error parsing visaInfo string:', error);
        }
      }

      // tripSummary alanını da parse et
      if (data.tripSummary && typeof data.tripSummary === 'string') {
        try {
          console.log('Parsing tripSummary string from web app');
          const parsedTripSummary = JSON.parse(data.tripSummary);
          if (parsedTripSummary && typeof parsedTripSummary === 'object') {
            data.tripSummary = parsedTripSummary;
          }
        } catch (error) {
          console.error('Error parsing tripSummary string:', error);
        }
      }

      // Eksik alanları tamamla
      const processedData = { ...data };

      // tripSummary alanını kontrol et ve eksikse oluştur
      if (!processedData.tripSummary || typeof processedData.tripSummary === 'string' && processedData.tripSummary.trim() === '') {
        console.log('tripSummary alanı oluşturuluyor (getTravelPlanById)...');

        // Süre bilgisini belirle
        let durationValue = processedData.duration || "Belirtilmemiş";
        if (typeof durationValue === 'number') {
          durationValue = `${durationValue} gün`;
        }

        // Yolcu bilgisini belirle
        let travelersValue = "Belirtilmemiş";
        if (processedData.groupType && processedData.numberOfPeople) {
          travelersValue = `${processedData.groupType} (${processedData.numberOfPeople})`;
        } else if (processedData.groupType) {
          travelersValue = processedData.groupType;
        } else if (processedData.numberOfPeople) {
          travelersValue = processedData.numberOfPeople;
        }

        // Bütçe bilgisini belirle
        const budgetValue = processedData.budget || "Belirtilmemiş";

        // tripSummary alanını oluştur
        processedData.tripSummary = {
          duration: durationValue,
          travelers: travelersValue,
          budget: budgetValue
        };
      }

      // culturalDifferences alanını kontrol et ve eksikse oluştur
      if (!processedData.culturalDifferences) {
        console.log('culturalDifferences alanı oluşturuluyor (getTravelPlanById)...');
        processedData.culturalDifferences = {
          culturalDifferences: "Bilgi bulunmuyor",
          lifestyleDifferences: "Bilgi bulunmuyor",
          foodCultureDifferences: "Bilgi bulunmuyor",
          socialNormsDifferences: "Bilgi bulunmuyor",
          religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
          localTraditionsAndCustoms: "Bilgi bulunmuyor",
          culturalEventsAndFestivals: "Bilgi bulunmuyor",
          localCommunicationTips: "Bilgi bulunmuyor"
        };
      }

      // localTips alanını kontrol et ve eksikse oluştur
      if (!processedData.localTips) {
        console.log('localTips alanı oluşturuluyor (getTravelPlanById)...');
        processedData.localTips = {
          localTransportationGuide: "Bilgi bulunmuyor",
          emergencyContacts: "Acil durumlarda 112'yi arayın",
          currencyAndPayment: "Türk Lirası (TL) kullanılmaktadır",
          communicationInfo: "Bilgi bulunmuyor",
          healthcareInfo: "Bilgi bulunmuyor",
          localCuisineAndFoodTips: "Bilgi bulunmuyor",
          safetyTips: "Bilgi bulunmuyor",
          localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
        };
      }

      return {
        ...processedData as Partial<TravelPlan>,
        id: docSnap.id,
        createdAt,
        updatedAt
      };
    } catch (error) {
      console.error("Seyahat planı getirme hatası:", error);
      return { ...DEFAULT_TRAVEL_PLAN, id: id || '' };
    }
  },

  /**
   * Bir seyahat planını günceller
   */
  async updateTravelPlan(id: string, travelPlan: Partial<TravelPlan>): Promise<boolean> {
    try {
      if (!id?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, id);

      // updatedAt timestamp ekle
      const updateData = {
        ...travelPlan,
        updatedAt: serverTimestamp()
      };

      // ID'yi kaldır (Firestore'da zaten document ID olarak var)
      if ('id' in updateData) {
        delete updateData.id;
      }

      await updateDoc(docRef, updateData);
      console.log('Seyahat planı güncellendi:', id);

      return true;
    } catch (error) {
      console.error("Seyahat planı güncelleme hatası:", error);
      return false;
    }
  },

  /**
   * Bir seyahat planını önerilen olarak işaretler veya öneriden kaldırır
   * Sadece planı oluşturan kullanıcı bu işlemi yapabilir
   */
  async toggleRecommendation(id: string, isRecommended: boolean, currentUserId?: string): Promise<boolean> {
    try {
      if (!id?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, id);

      // Önce planı getir ve kullanıcı kontrolü yap
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn("Seyahat planı bulunamadı:", id);
        return false;
      }

      const planData = docSnap.data();

      // Eğer currentUserId verilmişse ve plan sahibi değilse işlemi reddet
      if (currentUserId && planData.userId !== currentUserId) {
        console.warn("Yetki hatası: Sadece planı oluşturan kullanıcı öneri durumunu değiştirebilir");
        return false;
      }

      // Sadece isRecommended alanını güncelle
      await updateDoc(docRef, {
        isRecommended: isRecommended,
        updatedAt: serverTimestamp()
      });

      console.log(`Seyahat planı ${isRecommended ? 'önerilenlere eklendi' : 'önerilerden kaldırıldı'}:`, id);

      return true;
    } catch (error) {
      console.error("Seyahat planı öneri durumu güncelleme hatası:", error);
      return false;
    }
  },

  /**
   * Bir seyahat planını beğenme veya beğeniyi kaldırma
   */
  async toggleLike(id: string, userId: string): Promise<boolean> {
    try {
      if (!id?.trim() || !userId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si veya kullanıcı ID'si");
        return false;
      }

      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, id);

      // Önce planı getir
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn("Seyahat planı bulunamadı:", id);
        return false;
      }

      const planData = docSnap.data();

      // likedBy dizisini kontrol et, yoksa oluştur
      const likedBy = planData.likedBy || [];

      // Kullanıcı zaten beğenmiş mi kontrol et
      const userIndex = likedBy.indexOf(userId);

      if (userIndex > -1) {
        // Kullanıcı zaten beğenmiş, beğeniyi kaldır
        likedBy.splice(userIndex, 1);
        console.log(`Kullanıcı beğeniyi kaldırdı: ${userId}`);
      } else {
        // Kullanıcı henüz beğenmemiş, beğeni ekle
        likedBy.push(userId);
        console.log(`Kullanıcı beğeni ekledi: ${userId}`);
      }

      // Beğeni sayısını güncelle ve veritabanını güncelle
      await updateDoc(docRef, {
        likedBy: likedBy,
        likes: likedBy.length,
        updatedAt: serverTimestamp()
      });

      console.log(`Seyahat planı beğeni durumu güncellendi. Yeni beğeni sayısı: ${likedBy.length}`);

      return true;
    } catch (error) {
      console.error("Seyahat planı beğeni durumu güncelleme hatası:", error);
      return false;
    }
  },

  /**
   * Önerilen seyahat planlarını getirir
   */
  async getRecommendedTravelPlans(): Promise<Partial<TravelPlan>[]> {
    try {
      console.log('Önerilen seyahat planları çekiliyor...');

      const travelPlansRef = collection(db, TRAVEL_PLANS_COLLECTION);

      // Sadece önerilen planları getir
      const q = query(
        travelPlansRef,
        where("isRecommended", "==", true)
      );

      console.log('Firestore sorgusu gerçekleştiriliyor...');
      const querySnapshot = await getDocs(q);
      console.log('Firestore sorgu sonucu:', querySnapshot.size, 'önerilen plan bulundu');

      const plans: Partial<TravelPlan>[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : undefined;

        const updatedAt = data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : undefined;

        // Itinerary'yi parse et
        if (data.itinerary && typeof data.itinerary === 'string') {
          try {
            const parsedItinerary = safeParseJSON(data.itinerary);

            // Eğer itinerary içinde localTips varsa ve ana objede yoksa, taşı
            if (parsedItinerary) {
              if (parsedItinerary.localTips && !data.localTips) {
                data.localTips = parsedItinerary.localTips;
              }

              if (parsedItinerary.culturalDifferences && !data.culturalDifferences) {
                data.culturalDifferences = parsedItinerary.culturalDifferences;
              }

              if (parsedItinerary.visaInfo && !data.visaInfo) {
                console.log('Extracting visaInfo from itinerary for plan:', doc.id);
                data.visaInfo = parsedItinerary.visaInfo;
              }
            }
          } catch (error) {
            console.error('Error parsing itinerary for plan:', doc.id, error);
          }
        }

        // Web uygulamasından gelen string formatındaki culturalDifferences ve localTips alanlarını parse et
        if (data.culturalDifferences && typeof data.culturalDifferences === 'string') {
          try {
            console.log('Parsing culturalDifferences string from web app for plan:', doc.id);
            console.log('Original culturalDifferences string:', data.culturalDifferences);

            // Önce string içindeki kaçış karakterlerini temizle
            let cleanString = data.culturalDifferences
              .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
              .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

            // Eğer string JSON formatında değilse, düzelt
            if (!cleanString.startsWith('{')) {
              cleanString = `{${cleanString}}`;
            }

            console.log('Cleaned culturalDifferences string:', cleanString);

            try {
              const parsedCulturalDifferences = JSON.parse(cleanString);
              if (parsedCulturalDifferences && typeof parsedCulturalDifferences === 'object') {
                console.log('Successfully parsed culturalDifferences as object');
                data.culturalDifferences = parsedCulturalDifferences;
              }
            } catch (innerError) {
              console.error('Error parsing cleaned culturalDifferences string:', innerError);

              // Alternatif çözüm: Direkt olarak obje oluştur
              console.log('Creating culturalDifferences object manually');
              data.culturalDifferences = {
                culturalDifferences: data.culturalDifferences,
                lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
                foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
                socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
                religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
                localTraditionsAndCustoms: "Bilgi bulunmuyor",
                culturalEventsAndFestivals: "Bilgi bulunmuyor",
                localCommunicationTips: "Bilgi bulunmuyor"
              };
            }
          } catch (error) {
            console.error('Error in culturalDifferences processing for plan:', doc.id, error);

            // Hata durumunda manuel obje oluştur
            data.culturalDifferences = {
              culturalDifferences: typeof data.culturalDifferences === 'string' ? data.culturalDifferences : "Bilgi bulunmuyor",
              lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
              foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
              socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
              religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
              localTraditionsAndCustoms: "Bilgi bulunmuyor",
              culturalEventsAndFestivals: "Bilgi bulunmuyor",
              localCommunicationTips: "Bilgi bulunmuyor"
            };
          }
        } else if (!data.culturalDifferences) {
          // culturalDifferences yoksa oluştur
          console.log('Creating new culturalDifferences object for plan:', doc.id);
          data.culturalDifferences = {
            culturalDifferences: "Bilgi bulunmuyor",
            lifestyleDifferences: data.lifestyleDifferences || "Bilgi bulunmuyor",
            foodCultureDifferences: data.foodCultureDifferences || "Bilgi bulunmuyor",
            socialNormsDifferences: data.socialNormsDifferences || "Bilgi bulunmuyor",
            religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
            localTraditionsAndCustoms: "Bilgi bulunmuyor",
            culturalEventsAndFestivals: "Bilgi bulunmuyor",
            localCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        if (data.localTips && typeof data.localTips === 'string') {
          try {
            console.log('Parsing localTips string from web app for plan:', doc.id);

            // Önce string içindeki kaçış karakterlerini temizle
            let cleanString = data.localTips
              .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
              .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

            // Eğer string JSON formatında değilse, düzelt
            if (!cleanString.startsWith('{')) {
              cleanString = `{${cleanString}}`;
            }

            try {
              const parsedLocalTips = JSON.parse(cleanString);
              if (parsedLocalTips && typeof parsedLocalTips === 'object') {
                data.localTips = parsedLocalTips;
              }
            } catch (innerError) {
              console.error('Error parsing cleaned localTips string:', innerError);

              // Alternatif çözüm: Direkt olarak obje oluştur
              console.log('Creating localTips object manually');
              data.localTips = {
                localTransportationGuide: data.localTransportationGuide || data.localTips || "Bilgi bulunmuyor",
                emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
                currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
                communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
                healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
                localCuisineAndFoodTips: "Bilgi bulunmuyor",
                safetyTips: "Bilgi bulunmuyor",
                localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
              };
            }
          } catch (error) {
            console.error('Error in localTips processing for plan:', doc.id, error);

            // Hata durumunda manuel obje oluştur
            data.localTips = {
              localTransportationGuide: data.localTransportationGuide || (typeof data.localTips === 'string' ? data.localTips : "Bilgi bulunmuyor"),
              emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
              currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
              communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
              healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
              localCuisineAndFoodTips: "Bilgi bulunmuyor",
              safetyTips: "Bilgi bulunmuyor",
              localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
            };
          }
        } else if (!data.localTips) {
          // localTips yoksa oluştur
          data.localTips = {
            localTransportationGuide: data.localTransportationGuide || "Bilgi bulunmuyor",
            emergencyContacts: data.emergencyContacts || "Acil durumlarda 112'yi arayın",
            currencyAndPayment: data.currencyAndPayment || "Bilgi bulunmuyor",
            communicationInfo: data.communicationInfo || "Bilgi bulunmuyor",
            healthcareInfo: data.healthcareInfo || "Bilgi bulunmuyor",
            localCuisineAndFoodTips: "Bilgi bulunmuyor",
            safetyTips: "Bilgi bulunmuyor",
            localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        // Vize bilgilerini de parse et
        if (data.visaInfo && typeof data.visaInfo === 'string') {
          try {
            console.log('Parsing visaInfo string from web app for plan:', doc.id);
            const parsedVisaInfo = JSON.parse(data.visaInfo);
            if (parsedVisaInfo && typeof parsedVisaInfo === 'object') {
              data.visaInfo = parsedVisaInfo;
            }
          } catch (error) {
            console.error('Error parsing visaInfo string for plan:', doc.id, error);
          }
        }

        // tripSummary alanını da parse et
        if (data.tripSummary && typeof data.tripSummary === 'string') {
          try {
            const parsedTripSummary = JSON.parse(data.tripSummary);
            if (parsedTripSummary && typeof parsedTripSummary === 'object') {
              data.tripSummary = parsedTripSummary;
            }
          } catch (error) {
            console.error('Error parsing tripSummary string for plan:', doc.id, error);
          }
        }

        // Eksik alanları tamamla
        const processedData = { ...data };

        // tripSummary alanını kontrol et ve eksikse oluştur
        if (!processedData.tripSummary || typeof processedData.tripSummary === 'string' && processedData.tripSummary.trim() === '') {
          // Süre bilgisini belirle
          let durationValue = processedData.duration || "Belirtilmemiş";
          if (typeof durationValue === 'number') {
            durationValue = `${durationValue} gün`;
          }

          // Yolcu bilgisini belirle
          let travelersValue = "Belirtilmemiş";
          if (processedData.groupType && processedData.numberOfPeople) {
            travelersValue = `${processedData.groupType} (${processedData.numberOfPeople})`;
          } else if (processedData.groupType) {
            travelersValue = processedData.groupType;
          } else if (processedData.numberOfPeople) {
            travelersValue = processedData.numberOfPeople;
          }

          // Bütçe bilgisini belirle
          const budgetValue = processedData.budget || "Belirtilmemiş";

          // tripSummary alanını oluştur
          processedData.tripSummary = {
            duration: durationValue,
            travelers: travelersValue,
            budget: budgetValue
          };
        }

        // culturalDifferences alanını kontrol et ve eksikse oluştur
        if (!processedData.culturalDifferences) {
          console.log('culturalDifferences alanı oluşturuluyor (getRecommendedTravelPlans)...');
          processedData.culturalDifferences = {
            culturalDifferences: "Bilgi bulunmuyor",
            lifestyleDifferences: "Bilgi bulunmuyor",
            foodCultureDifferences: "Bilgi bulunmuyor",
            socialNormsDifferences: "Bilgi bulunmuyor",
            religiousAndCulturalSensitivities: "Bilgi bulunmuyor",
            localTraditionsAndCustoms: "Bilgi bulunmuyor",
            culturalEventsAndFestivals: "Bilgi bulunmuyor",
            localCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        // localTips alanını kontrol et ve eksikse oluştur
        if (!processedData.localTips) {
          processedData.localTips = {
            localTransportationGuide: "Bilgi bulunmuyor",
            emergencyContacts: "Acil durumlarda 112'yi arayın",
            currencyAndPayment: "Türk Lirası (TL) kullanılmaktadır",
            communicationInfo: "Bilgi bulunmuyor",
            healthcareInfo: "Bilgi bulunmuyor",
            localCuisineAndFoodTips: "Bilgi bulunmuyor",
            safetyTips: "Bilgi bulunmuyor",
            localLanguageAndCommunicationTips: "Bilgi bulunmuyor"
          };
        }

        plans.push({
          ...processedData as Partial<TravelPlan>,
          id: doc.id,
          createdAt,
          updatedAt
        });
      });

      console.log('Önerilen seyahat planları başarıyla alındı');

      // Beğeni sayısına göre sırala (çoktan aza)
      plans.sort((a, b) => {
        const likesA = a.likes || 0;
        const likesB = b.likes || 0;
        return likesB - likesA;
      });

      return plans;
    } catch (error) {
      console.error('Önerilen seyahat planları getirme hatası:', error);
      return [];
    }
  },

  /**
   * Bir seyahat planını siler
   */
  async deleteTravelPlan(id: string): Promise<boolean> {
    try {
      if (!id?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, id);
      await deleteDoc(docRef);
      console.log('Seyahat planı silindi:', id);

      return true;
    } catch (error) {
      console.error("Seyahat planı silme hatası:", error);
      return false;
    }
  },

  /**
   * Resim yükler ve URL'ini döndürür
   */
  async uploadImage(userId: string, imageUri: string, folderName: string = "travelImages"): Promise<string> {
    try {
      // Dosya adı oluştur
      const timestamp = new Date().getTime();
      const fileName = `${userId}_${timestamp}.jpg`;
      const fullPath = `${folderName}/${fileName}`;

      const storageRef = ref(storage, fullPath);

      // Resmi fetch et ve buffer'a dönüştür
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Storage'a yükle - uploadBytesResumable kullanarak daha iyi hata yönetimi

      // Promise olarak yükleme işlemini bekle
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Yükleme durumunu izle
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          },
          (error) => {
            // Hata durumunda
            console.error('Yükleme hatası:', error);
            if (error.code) {
              console.error(`Hata kodu: ${error.code}`);
            }
            if (error.serverResponse) {
              console.error(`Sunucu yanıtı: ${error.serverResponse}`);
            }
            if (error.name) {
              console.error(`Hata adı: ${error.name}`);
            }
            reject(error);
          },
          async () => {
            // Yükleme tamamlandığında
            try {
              // Download URL al
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            } catch (urlError) {
              console.error('Download URL alma hatası:', urlError);
              reject(urlError);
            }
          }
        );
      });
    } catch (error: any) {
      console.error("Resim yükleme hatası:", error);
      // Daha detaylı hata bilgisi
      if (error.code) {
        console.error(`Hata kodu: ${error.code}`);
      }
      if (error.serverResponse) {
        console.error(`Sunucu yanıtı: ${error.serverResponse}`);
      }
      if (error.name) {
        console.error(`Hata adı: ${error.name}`);
      }
      throw error;
    }
  },

  /**
   * Storage referansı oluşturur
   */
  getStorageRef(path: string): StorageReference {
    return ref(storage, path);
  },

  /**
   * Blob yükler ve yükleme görevini döndürür
   */
  async uploadBlob(storageRef: StorageReference, blob: Blob): Promise<StorageReference> {
    try {
      // Yükleme işlemi
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Promise olarak yükleme işlemini bekle
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Yükleme durumunu izle
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          },
          (error) => {
            // Hata durumunda
            console.error('Yükleme hatası:', error);
            reject(error);
          },
          () => {
            // Yükleme tamamlandığında
            resolve(storageRef);
          }
        );
      });
    } catch (error) {
      console.error('Blob yükleme hatası:', error);
      throw error;
    }
  },

  /**
   * Storage referansından download URL alır
   */
  async getDownloadURL(storageRef: StorageReference): Promise<string> {
    try {
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Download URL alma hatası:', error);
      throw error;
    }
  },

  /**
   * Base64 formatındaki resmi yükler ve URL'ini döndürür
   */
  async uploadBase64Image(base64Image: string, fullPath: string): Promise<string> {
    try {
      // Base64 formatını kontrol et ve düzelt
      let formattedBase64 = base64Image;
      if (base64Image.includes('base64,')) {
        formattedBase64 = base64Image.split('base64,')[1];
        console.log('Base64 formatı düzeltildi');
      }

      // Storage referansı oluştur
      const storageRef = ref(storage, fullPath);
      console.log('Storage referansı oluşturuldu');

      // Base64'ü blob'a dönüştür
      const byteCharacters = atob(formattedBase64);
      const byteArrays = [];

      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }

      const blob = new Blob(byteArrays, { type: 'image/jpeg' });
      console.log(`Blob oluşturuldu, boyut: ${blob.size} bytes`);

      // Storage'a yükle
      const snapshot = await uploadBytes(storageRef, blob);

      // Download URL al
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return downloadUrl;
    } catch (error: any) {
      console.error("Base64 resim yükleme hatası:", error);
      // Daha detaylı hata bilgisi
      if (error.code) {
        console.error(`Hata kodu: ${error.code}`);
      }
      if (error.serverResponse) {
        console.error(`Sunucu yanıtı: ${error.serverResponse}`);
      }
      if (error.name) {
        console.error(`Hata adı: ${error.name}`);
      }
      throw error;
    }
  },

  /**
   * Seyahat planına fotoğraf ekler
   */
  async addTripPhoto(travelPlanId: string, photoData: Partial<import('../types/travel').TripPhoto>): Promise<boolean> {
    try {
      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      // Seyahat planını getir
      const travelPlan = await this.getTravelPlanById(travelPlanId);
      if (!travelPlan || !travelPlan.id) {
        console.warn("Seyahat planı bulunamadı:", travelPlanId);
        return false;
      }

      // Mevcut fotoğrafları al
      let tripPhotos = [];
      if (travelPlan.tripPhotos) {
        if (typeof travelPlan.tripPhotos === 'string') {
          try {
            tripPhotos = JSON.parse(travelPlan.tripPhotos);
          } catch (error) {
            console.error("Fotoğraf verisi parse hatası:", error);
            tripPhotos = [];
          }
        } else if (Array.isArray(travelPlan.tripPhotos)) {
          tripPhotos = [...travelPlan.tripPhotos];
        }
      }

      // Yeni fotoğrafı ekle
      const newPhoto = {
        id: `photo_${new Date().getTime()}`,
        uploadedAt: new Date().toISOString(),
        ...photoData
      };
      tripPhotos.push(newPhoto);

      // Web uyumluluğu için string'e dönüştür
      const tripPhotosString = JSON.stringify(tripPhotos);

      // Seyahat planını güncelle
      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, travelPlanId);
      await updateDoc(docRef, {
        tripPhotos: tripPhotosString,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Fotoğraf ekleme hatası:", error);
      return false;
    }
  },

  /**
   * Base64 formatındaki resmi doğrudan ana koleksiyona ekler
   * Bu metod, Firestore izinleri nedeniyle travelPlans_photos koleksiyonu yerine
   * doğrudan ana koleksiyona eklemek için kullanılır
   */
  async addTripPhotoWithBase64(travelPlanId: string, base64Image: string, photoInfo: Partial<import('../types/travel').TripPhoto>): Promise<boolean> {
    try {
      console.log(`Base64 resim ana koleksiyona kaydediliyor...`);
      console.log(`Base64 uzunluğu: ${base64Image.length}`);

      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      // Seyahat planını getir
      const travelPlan = await this.getTravelPlanById(travelPlanId);
      if (!travelPlan || !travelPlan.id) {
        console.warn("Seyahat planı bulunamadı:", travelPlanId);
        return false;
      }

      // Mevcut fotoğrafları al
      let tripPhotos = [];
      if (travelPlan.tripPhotos) {
        if (typeof travelPlan.tripPhotos === 'string') {
          try {
            tripPhotos = JSON.parse(travelPlan.tripPhotos);
          } catch (error) {
            console.error("Fotoğraf verisi parse hatası:", error);
            tripPhotos = [];
          }
        } else if (Array.isArray(travelPlan.tripPhotos)) {
          tripPhotos = [...travelPlan.tripPhotos];
        }
      }

      // Undefined değerleri boş string ile değiştir
      const cleanPhotoInfo: Record<string, any> = { ...photoInfo };

      // Konum alanını kontrol et - bu alan özellikle hata veriyor
      if (cleanPhotoInfo.location === undefined) {
        cleanPhotoInfo.location = "";
      }

      // Diğer alanları da kontrol et
      if (cleanPhotoInfo.caption === undefined) {
        cleanPhotoInfo.caption = "";
      }

      if (cleanPhotoInfo.date === undefined) {
        cleanPhotoInfo.date = "";
      }

      if (cleanPhotoInfo.activityName === undefined) {
        cleanPhotoInfo.activityName = "";
      }

      // Yeni fotoğraf ID'si oluştur (eğer yoksa)
      const photoId = cleanPhotoInfo.id || `photo_${new Date().getTime()}`;
      cleanPhotoInfo.id = photoId;

      // Yeni fotoğrafı ekle - base64 verisiyle birlikte
      const newPhoto = {
        id: photoId,
        uploadedAt: new Date().toISOString(),
        ...cleanPhotoInfo,
        // Base64 verisini doğrudan ekle
        imageData: base64Image
      };

      // Aynı ID'ye sahip bir fotoğraf var mı kontrol et
      const existingPhotoIndex = tripPhotos.findIndex((p: any) => p.id === photoId);
      if (existingPhotoIndex >= 0) {
        // Varsa güncelle
        tripPhotos[existingPhotoIndex] = newPhoto;
      } else {
        // Yoksa ekle
        tripPhotos.push(newPhoto);
      }

      // Web uyumluluğu için string'e dönüştür
      const tripPhotosString = JSON.stringify(tripPhotos);

      // Seyahat planını güncelle
      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, travelPlanId);
      await updateDoc(docRef, {
        tripPhotos: tripPhotosString,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Base64 resim kaydetme hatası:", error);
      return false;
    }
  },

  /**
   * Base64 formatındaki resmi doğrudan Firestore'a kaydeder
   */
  async saveBase64ImageToFirestore(travelPlanId: string, base64Image: string, photoInfo: Partial<import('../types/travel').TripPhoto>): Promise<boolean> {
    try {
      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      // Seyahat planını getir
      const travelPlan = await this.getTravelPlanById(travelPlanId);
      if (!travelPlan || !travelPlan.id) {
        console.warn("Seyahat planı bulunamadı:", travelPlanId);
        return false;
      }

      // Mevcut fotoğrafları al
      let tripPhotos = [];
      if (travelPlan.tripPhotos) {
        if (typeof travelPlan.tripPhotos === 'string') {
          try {
            tripPhotos = JSON.parse(travelPlan.tripPhotos);
          } catch (error) {
            console.error("Fotoğraf verisi parse hatası:", error);
            tripPhotos = [];
          }
        } else if (Array.isArray(travelPlan.tripPhotos)) {
          tripPhotos = [...travelPlan.tripPhotos];
        }
      }

      // Yeni fotoğraf ID'si oluştur
      const photoId = `photo_${new Date().getTime()}`;

      // Undefined değerleri boş string ile değiştir
      const cleanPhotoInfo: Record<string, any> = { ...photoInfo };

      // Konum alanını kontrol et - bu alan özellikle hata veriyor
      if (cleanPhotoInfo.location === undefined) {
        cleanPhotoInfo.location = "";
      }

      // Diğer alanları da kontrol et
      if (cleanPhotoInfo.caption === undefined) {
        cleanPhotoInfo.caption = "";
      }

      if (cleanPhotoInfo.date === undefined) {
        cleanPhotoInfo.date = "";
      }

      if (cleanPhotoInfo.activityName === undefined) {
        cleanPhotoInfo.activityName = "";
      }

      // Ayrı bir koleksiyon oluşturalım (büyük veri için)
      const photoDocRef = doc(db, `${TRAVEL_PLANS_COLLECTION}_photos`, photoId);
      await setDoc(photoDocRef, {
        travelPlanId,
        photoId,
        imageData: base64Image,
        uploadedAt: serverTimestamp(),
        ...cleanPhotoInfo
      });

      // Ana dokümana sadece referans ekleyelim
      const photoReference = {
        id: photoId,
        uploadedAt: new Date().toISOString(),
        ...cleanPhotoInfo,
        // imageData yerine referans kullanıyoruz
        imageRef: `${TRAVEL_PLANS_COLLECTION}_photos/${photoId}`
      };

      tripPhotos.push(photoReference);

      // Web uyumluluğu için string'e dönüştür
      const tripPhotosString = JSON.stringify(tripPhotos);

      // Seyahat planını güncelle
      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, travelPlanId);
      await updateDoc(docRef, {
        tripPhotos: tripPhotosString,
        updatedAt: serverTimestamp()
      });

      console.log("Base64 resim başarıyla kaydedildi:", photoId);
      return true;
    } catch (error) {
      console.error("Base64 resim kaydetme hatası:", error);
      return false;
    }
  },

  /**
   * Fotoğraf ID'sine göre fotoğraf verisini getirir
   */
  async getPhotoById(photoRef: string): Promise<any> {
    try {
      console.log(`Fotoğraf verisi getiriliyor: ${photoRef}`);

      // Referans formatını kontrol et
      let collectionPath = '';
      let photoId = '';

      if (photoRef.includes('/')) {
        // Tam yol formatı: "koleksiyon/id"
        const parts = photoRef.split('/');
        collectionPath = parts[0];
        photoId = parts[1];
      } else {
        // Sadece ID formatı
        collectionPath = `${TRAVEL_PLANS_COLLECTION}_photos`;
        photoId = photoRef;
      }

      console.log(`Koleksiyon: ${collectionPath}, ID: ${photoId}`);

      // Firestore'dan fotoğraf verisini getir
      const photoDocRef = doc(db, collectionPath, photoId);
      const photoDoc = await getDoc(photoDocRef);

      if (!photoDoc.exists()) {
        console.warn(`Fotoğraf bulunamadı: ${photoRef}`);
        return null;
      }

      const photoData = photoDoc.data();
      console.log(`Fotoğraf verisi başarıyla getirildi: ${photoId}`);

      return photoData;
    } catch (error) {
      console.error(`Fotoğraf getirme hatası (${photoRef}):`, error);
      return null;
    }
  },

  /**
   * Seyahat planının fotoğraf referanslarını günceller
   */
  async updateTripPhotosReferences(travelPlanId: string, photos: import('../types/travel').TripPhoto[]): Promise<boolean> {
    try {
      console.log(`Seyahat planı fotoğraf referansları güncelleniyor: ${travelPlanId}`);
      console.log(`Fotoğraf sayısı: ${photos.length}`);

      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return false;
      }

      // Web uyumluluğu için string'e dönüştür
      const tripPhotosString = JSON.stringify(photos);

      // Seyahat planını güncelle
      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, travelPlanId);
      await updateDoc(docRef, {
        tripPhotos: tripPhotosString,
        updatedAt: serverTimestamp()
      });

      console.log("Fotoğraf referansları başarıyla güncellendi");
      return true;
    } catch (error) {
      console.error("Fotoğraf referansları güncelleme hatası:", error);
      return false;
    }
  }
};

// Kullanıcı servisi
export const UserService = {
  /**
   * Kullanıcı profilini alır
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      if (!userId?.trim()) {
        console.warn("Geçersiz kullanıcı ID'si");
        return null;
      }

      const userDocRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
      } else {
        console.log("Kullanıcı profili bulunamadı:", userId);
        return null;
      }
    } catch (error) {
      console.error("Kullanıcı profili getirme hatası:", error);
      return null;
    }
  },

  /**
   * Kullanıcı profilini oluşturur veya günceller
   */
  async upsertUserProfile(userId: string, profileData: any): Promise<boolean> {
    try {
      if (!userId?.trim()) {
        console.warn("Geçersiz kullanıcı ID'si");
        return false;
      }

      const userDocRef = doc(db, USERS_COLLECTION, userId);

      // Timestamp ekle
      const timestamp = serverTimestamp();
      const userData = {
        ...profileData,
        updatedAt: timestamp
      };

      // Kullanıcı dokümantı yoksa, createdAt ekle
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        userData.createdAt = timestamp;
      }

      await setDoc(userDocRef, userData, { merge: true });
      console.log("Kullanıcı profili güncellendi:", userId);

      return true;
    } catch (error) {
      console.error("Kullanıcı profili güncelleme hatası:", error);
      return false;
    }
  }
};

// Yorum fotoğrafları servisi
export const CommentPhotoService = {
  /**
   * Yorum fotoğrafı ekler
   */
  async addCommentPhoto(commentId: string, travelPlanId: string, photoData: string, photoLocation?: string): Promise<string> {
    try {
      console.log(`Yorum fotoğrafı ekleniyor: ${commentId}`);

      if (!commentId?.trim() || !travelPlanId?.trim()) {
        console.warn("Geçersiz yorum ID'si veya seyahat planı ID'si");
        throw new Error("Geçersiz yorum ID'si veya seyahat planı ID'si");
      }

      // Base64 verisi boş mu kontrol et
      if (!photoData?.trim()) {
        console.warn("Geçersiz fotoğraf verisi");
        throw new Error("Geçersiz fotoğraf verisi");
      }

      // Fotoğraf ID'si oluştur
      const photoId = `photo_${commentId}_${new Date().getTime()}`;

      // Base64 formatını kontrol et ve düzelt
      let processedPhotoData = photoData;

      // Eğer data:image ile başlamıyorsa, ekle
      if (!processedPhotoData.startsWith('data:image')) {
        processedPhotoData = `data:image/jpeg;base64,${processedPhotoData}`;
        console.log('Base64 verisi data:image formatına dönüştürüldü');
      }

      // Fotoğraf verilerini hazırla
      const photoInfo = {
        id: photoId,
        commentId,
        travelPlanId,
        photoData: processedPhotoData,
        photoLocation: photoLocation || "",
        uploadedAt: serverTimestamp()
      };

      // Firestore'a ekle
      const photoDocRef = doc(db, COMMENT_PHOTOS_COLLECTION, photoId);
      await setDoc(photoDocRef, photoInfo);

      console.log('Yorum fotoğrafı başarıyla eklendi, ID:', photoId);
      return photoId;
    } catch (error) {
      console.error("Yorum fotoğrafı ekleme hatası:", error);
      throw error;
    }
  },

  /**
   * Yorum ID'sine göre fotoğrafları getirir
   */
  async getPhotosByCommentId(commentId: string): Promise<any[]> {
    try {
      console.log(`Yorum fotoğrafları getiriliyor: ${commentId}`);

      if (!commentId?.trim()) {
        console.warn("Geçersiz yorum ID'si");
        return [];
      }

      const photosRef = collection(db, COMMENT_PHOTOS_COLLECTION);
      const q = query(
        photosRef,
        where("commentId", "==", commentId)
      );

      const querySnapshot = await getDocs(q);
      console.log(`${querySnapshot.size} fotoğraf bulundu`);

      const photos: any[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const uploadedAt = data.uploadedAt instanceof Timestamp
          ? data.uploadedAt.toDate().toISOString()
          : data.uploadedAt || new Date().toISOString();

        // Base64 formatını kontrol et
        if (data.photoData) {
          console.log(`Fotoğraf verisi mevcut, uzunluk: ${data.photoData.length}`);

          // Eğer data:image ile başlamıyorsa, ekle
          if (!data.photoData.startsWith('data:image')) {
            data.photoData = `data:image/jpeg;base64,${data.photoData}`;
            console.log('Base64 verisi data:image formatına dönüştürüldü');
          }
        }

        photos.push({
          ...data,
          id: doc.id,
          uploadedAt
        });
      });

      return photos;
    } catch (error) {
      console.error("Yorum fotoğrafları getirme hatası:", error);
      return [];
    }
  },

  /**
   * Seyahat planı ID'sine göre tüm yorum fotoğraflarını getirir
   */
  async getPhotosByTravelPlanId(travelPlanId: string): Promise<any[]> {
    try {
      console.log(`Seyahat planı yorum fotoğrafları getiriliyor: ${travelPlanId}`);

      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return [];
      }

      const photosRef = collection(db, COMMENT_PHOTOS_COLLECTION);
      const q = query(
        photosRef,
        where("travelPlanId", "==", travelPlanId)
      );

      const querySnapshot = await getDocs(q);
      console.log(`${querySnapshot.size} fotoğraf bulundu`);

      const photos: any[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const uploadedAt = data.uploadedAt instanceof Timestamp
          ? data.uploadedAt.toDate().toISOString()
          : data.uploadedAt || new Date().toISOString();

        // Base64 formatını kontrol et
        if (data.photoData) {
          console.log(`Fotoğraf verisi mevcut, uzunluk: ${data.photoData.length}`);

          // Eğer data:image ile başlamıyorsa, ekle
          if (!data.photoData.startsWith('data:image')) {
            data.photoData = `data:image/jpeg;base64,${data.photoData}`;
            console.log('Base64 verisi data:image formatına dönüştürüldü');
          }
        }

        photos.push({
          ...data,
          id: doc.id,
          uploadedAt
        });
      });

      return photos;
    } catch (error) {
      console.error("Seyahat planı yorum fotoğrafları getirme hatası:", error);
      return [];
    }
  },

  /**
   * Yorum fotoğrafını siler
   */
  async deletePhoto(photoId: string): Promise<boolean> {
    try {
      console.log(`Yorum fotoğrafı siliniyor: ${photoId}`);

      if (!photoId?.trim()) {
        console.warn("Geçersiz fotoğraf ID'si");
        return false;
      }

      const photoRef = doc(db, COMMENT_PHOTOS_COLLECTION, photoId);
      await deleteDoc(photoRef);

      console.log('Yorum fotoğrafı silindi:', photoId);
      return true;
    } catch (error) {
      console.error("Yorum fotoğrafı silme hatası:", error);
      return false;
    }
  }
};

// Yorum servisi
export const CommentService = {
  /**
   * Bir seyahat planına ait yorumları getirir
   */
  async getCommentsByTravelPlanId(travelPlanId: string): Promise<TripComment[]> {
    try {
      console.log(`Seyahat planı yorumları getiriliyor: ${travelPlanId}`);

      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return [];
      }

      // 1. Önce yorumları getir
      const commentsRef = collection(db, TRAVEL_PLANS_COMMENTS_COLLECTION);
      const q = query(
        commentsRef,
        where("travelPlanId", "==", travelPlanId)
      );

      const querySnapshot = await getDocs(q);
      console.log(`${querySnapshot.size} yorum bulundu`);

      const comments: TripComment[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Yorum verisi alındı, ID: ${doc.id}`);
        console.log(`Yorum içeriği: ${data.content?.substring(0, 30)}...`);

        // Timestamp'i Date'e dönüştür
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt || new Date().toISOString();

        const updatedAt = data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt;

        comments.push({
          ...data as TripComment,
          id: doc.id,
          createdAt,
          updatedAt
        });
      });

      // 2. Sonra bu seyahat planına ait tüm yorum fotoğraflarını getir
      console.log(`Yorum fotoğrafları getiriliyor...`);
      const photos = await CommentPhotoService.getPhotosByTravelPlanId(travelPlanId);
      console.log(`${photos.length} yorum fotoğrafı bulundu`);

      // 3. Her yoruma ait fotoğrafları eşleştir
      if (photos.length > 0) {
        comments.forEach(comment => {
          // Bu yoruma ait fotoğrafı bul
          const commentPhoto = photos.find(photo => photo.commentId === comment.id);

          if (commentPhoto) {
            console.log(`Yorum ${comment.id} için fotoğraf bulundu`);

            // Fotoğraf verilerini yoruma ekle
            comment.photoData = commentPhoto.photoData;
            comment.photoLocation = commentPhoto.photoLocation;
          }
        });
      }

      // Yorumları tarihe göre sırala (en yeniden en eskiye)
      return comments.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error("Yorumları getirme hatası:", error);
      return [];
    }
  },

  /**
   * Yeni bir yorum ekler
   */
  async addComment(comment: Omit<TripComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log(`Yorum ekleniyor: ${comment.travelPlanId}`);
      console.log(`Kullanıcı: ${comment.userName} (${comment.userId})`);
      console.log(`İçerik: ${comment.content?.substring(0, 30)}...`);

      // Fotoğraf verilerini geçici olarak sakla
      const photoData = comment.photoData;
      const photoLocation = comment.photoLocation;

      // Yorum nesnesinden fotoğraf verilerini çıkar (ayrı koleksiyona taşıyacağız)
      delete comment.photoData;
      delete comment.photoUrl;
      delete comment.photoLocation;

      if (!comment.travelPlanId?.trim() || !comment.userId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si veya kullanıcı ID'si");
        throw new Error("Geçersiz seyahat planı ID'si veya kullanıcı ID'si");
      }

      const commentsRef = collection(db, TRAVEL_PLANS_COMMENTS_COLLECTION);

      // Timestamp ekle
      const commentWithTimestamp = {
        ...comment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Firestore'a ekle
      const docRef = await addDoc(commentsRef, commentWithTimestamp);
      const commentId = docRef.id;
      console.log('Yorum başarıyla eklendi, ID:', commentId);

      // Eğer fotoğraf verisi varsa, ayrı koleksiyona ekle
      if (photoData && photoData.trim() !== '') {
        try {
          console.log(`Fotoğraf verisi var, uzunluk: ${photoData.length}`);
          console.log(`Fotoğraf ayrı koleksiyona ekleniyor...`);

          // CommentPhotoService kullanarak fotoğrafı ekle
          await CommentPhotoService.addCommentPhoto(
            commentId,
            comment.travelPlanId,
            photoData,
            photoLocation
          );

          console.log(`Fotoğraf başarıyla ayrı koleksiyona eklendi`);
        } catch (photoError) {
          console.error(`Fotoğraf ekleme hatası:`, photoError);
          // Fotoğraf eklenemese bile yorumu silmiyoruz
        }
      }

      return commentId;
    } catch (error) {
      console.error("Yorum ekleme hatası:", error);
      throw error;
    }
  },

  /**
   * Bir yorumu günceller
   */
  async updateComment(id: string, comment: Partial<TripComment>): Promise<boolean> {
    try {
      console.log(`Yorum güncelleniyor: ${id}`);

      if (!id?.trim()) {
        console.warn("Geçersiz yorum ID'si");
        return false;
      }

      // Fotoğraf verilerini geçici olarak sakla
      const photoData = comment.photoData;
      const photoLocation = comment.photoLocation;

      // Yorum nesnesinden fotoğraf verilerini çıkar (ayrı koleksiyonda saklayacağız)
      delete comment.photoData;
      delete comment.photoUrl;
      delete comment.photoLocation;

      const commentRef = doc(db, TRAVEL_PLANS_COMMENTS_COLLECTION, id);

      // updatedAt timestamp ekle
      const updateData = {
        ...comment,
        updatedAt: serverTimestamp()
      };

      // ID'yi kaldır (Firestore'da zaten document ID olarak var)
      if ('id' in updateData) {
        delete updateData.id;
      }

      await updateDoc(commentRef, updateData);
      console.log('Yorum güncellendi:', id);

      // Eğer fotoğraf verisi varsa, ayrı koleksiyonda güncelle veya ekle
      if (photoData && photoData.trim() !== '') {
        try {
          console.log(`Fotoğraf verisi var, uzunluk: ${photoData.length}`);

          // Önce bu yoruma ait mevcut fotoğrafları getir
          const existingPhotos = await CommentPhotoService.getPhotosByCommentId(id);

          if (existingPhotos.length > 0) {
            // Mevcut fotoğraf varsa güncelle
            console.log(`Mevcut fotoğraf bulundu, güncelleniyor...`);

            // Mevcut fotoğrafı sil
            await CommentPhotoService.deletePhoto(existingPhotos[0].id);
          }

          // Yeni fotoğrafı ekle
          console.log(`Fotoğraf ayrı koleksiyona ekleniyor...`);

          // CommentPhotoService kullanarak fotoğrafı ekle
          await CommentPhotoService.addCommentPhoto(
            id,
            comment.travelPlanId || existingPhotos[0]?.travelPlanId,
            photoData,
            photoLocation
          );

          console.log(`Fotoğraf başarıyla ayrı koleksiyona eklendi`);
        } catch (photoError) {
          console.error(`Fotoğraf güncelleme hatası:`, photoError);
          // Fotoğraf güncellenemese bile yorumu silmiyoruz
        }
      }

      return true;
    } catch (error) {
      console.error("Yorum güncelleme hatası:", error);
      return false;
    }
  },

  /**
   * Bir yorumu siler
   */
  async deleteComment(id: string): Promise<boolean> {
    try {
      console.log(`Yorum siliniyor: ${id}`);

      if (!id?.trim()) {
        console.warn("Geçersiz yorum ID'si");
        return false;
      }

      // Önce bu yoruma ait fotoğrafları getir
      try {
        console.log(`Yorum fotoğrafları kontrol ediliyor...`);
        const photos = await CommentPhotoService.getPhotosByCommentId(id);

        // Fotoğrafları sil
        if (photos.length > 0) {
          console.log(`${photos.length} yorum fotoğrafı bulundu, siliniyor...`);

          for (const photo of photos) {
            await CommentPhotoService.deletePhoto(photo.id);
            console.log(`Fotoğraf silindi: ${photo.id}`);
          }
        }
      } catch (photoError) {
        console.error(`Fotoğraf silme hatası:`, photoError);
        // Fotoğraflar silinemese bile yorumu silmeye devam et
      }

      // Yorumu sil
      const commentRef = doc(db, TRAVEL_PLANS_COMMENTS_COLLECTION, id);
      await deleteDoc(commentRef);
      console.log('Yorum silindi:', id);

      return true;
    } catch (error) {
      console.error("Yorum silme hatası:", error);
      return false;
    }
  }
};

// Firebase servisi - tüm servisleri birleştir
export const FirebaseService = {
  TravelPlan: TravelPlanService,
  User: UserService,
  Comment: CommentService,
  CommentPhoto: CommentPhotoService
};

// Expo Router için default export gereklidir
export default function FirebaseServiceComponent() {
  return null;
}
