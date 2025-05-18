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
const BUDGETS_COLLECTION = "budgets";
const EXPENSES_COLLECTION = "expenses";

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

    }
    // Eğer itinerary zaten varsa ve string değilse
    else if (formattedPlan.itinerary && typeof formattedPlan.itinerary !== 'string') {


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

        // Önce startDateISO alanını kontrol et (en doğru tarih bilgisi)
        if ((formattedPlan as any).startDateISO && typeof (formattedPlan as any).startDateISO === 'string') {
          console.log('startDateISO alanı bulundu:', (formattedPlan as any).startDateISO);
          date = new Date((formattedPlan as any).startDateISO);
        }
        // Sonra startDateFormatted alanını kontrol et
        else if ((formattedPlan as any).startDateFormatted && typeof (formattedPlan as any).startDateFormatted === 'string') {
          console.log('startDateFormatted alanı bulundu:', (formattedPlan as any).startDateFormatted);
          // Eğer bu alan zaten Türkçe formatta ise, direkt kullan
          formattedPlan.startDate = (formattedPlan as any).startDateFormatted;

          // Tarih formatını kontrol et (30 Nisan 2025 veya DD/MM/YYYY)
          if ((formattedPlan as any).startDateFormatted.includes('/')) {
            // DD/MM/YYYY formatı
            const [day, month, year] = (formattedPlan as any).startDateFormatted.split('/').map(Number);
            date = new Date(Date.UTC(year, month - 1, day));
          } else {
            // Türkçe tarih formatı (30 Nisan 2025)
            const turkishMonths = {
              'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5,
              'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11
            };

            // Tarih formatını parçala
            const parts = (formattedPlan as any).startDateFormatted.split(' ');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const monthName = parts[1];
              const year = parseInt(parts[2]);

              // Ay adını sayıya çevir
              const monthIndex = turkishMonths[monthName as keyof typeof turkishMonths];

              if (!isNaN(day) && monthIndex !== undefined && !isNaN(year)) {
                // UTC kullanarak tarih oluştur
                date = new Date(Date.UTC(year, monthIndex, day));
              } else {
                date = new Date();
              }
            } else {
              date = new Date();
            }
          }
        }
        // String ise parse et
        else if (typeof formattedPlan.startDate === 'string') {
          // ISO formatı (2023-04-30T14:52:18.000Z)
          if (formattedPlan.startDate.includes('T')) {
            date = new Date(formattedPlan.startDate);
          }
          // DD/MM/YYYY formatındaysa
          else if (formattedPlan.startDate.includes('/')) {
            const [day, month, year] = formattedPlan.startDate.split('/').map(Number);
            date = new Date(Date.UTC(year, month - 1, day));
          }
          // Türkçe tarih formatı (30 Nisan 2025)
          else if (/\d+\s+[A-Za-zğüşıöçĞÜŞİÖÇ]+\s+\d{4}/.test(formattedPlan.startDate)) {
            const turkishMonths = {
              'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5,
              'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11
            };

            // Tarih formatını parçala
            const parts = formattedPlan.startDate.split(' ');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const monthName = parts[1];
              const year = parseInt(parts[2]);

              // Ay adını sayıya çevir
              const monthIndex = turkishMonths[monthName as keyof typeof turkishMonths];

              if (!isNaN(day) && monthIndex !== undefined && !isNaN(year)) {
                // UTC kullanarak tarih oluştur
                date = new Date(Date.UTC(year, monthIndex, day));
              } else {
                date = new Date();
              }
            } else {
              date = new Date();
            }
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
          // Orijinal tarihi sakla (ISO formatında)
          const originalDate = date.toISOString();

          // Web uygulaması için Türkçe tarih formatı (30 Nisan 2025)
          const options: Intl.DateTimeFormatOptions = {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          };

          // Eğer startDate zaten Türkçe formatta değilse, dönüştür
          if (!/\d+\s+[A-Za-zğüşıöçĞÜŞİÖÇ]+\s+\d{4}/.test(formattedPlan.startDate as string)) {
            // Türkçe tarih formatı oluştur
            formattedPlan.startDate = date.toLocaleDateString('tr-TR', options);
            console.log('Tarih formatı düzenlendi (Türkçe format):', formattedPlan.startDate);
          }

          // Orijinal tarihi de sakla (ISO formatında) - hava durumu ve diğer hesaplamalar için
          formattedPlan.originalStartDate = originalDate;
          formattedPlan.startDateISO = originalDate; // Ek olarak startDateISO alanını da ekle
          console.log('Orijinal tarih saklandı (ISO format):', originalDate);

          // Ayrıca DD/MM/YYYY formatında da sakla (API çağrıları için)
          (formattedPlan as any).startDateDDMMYYYY = `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCFullYear()}`;
          console.log('DD/MM/YYYY formatında tarih saklandı:', (formattedPlan as any).startDateDDMMYYYY);
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

          // Orijinal tarihi de sakla (ISO formatında) - hava durumu ve diğer hesaplamalar için
          const originalDate = today.toISOString();
          formattedPlan.originalStartDate = originalDate;
          formattedPlan.startDateISO = originalDate; // Ek olarak startDateISO alanını da ekle

          // Ayrıca DD/MM/YYYY formatında da sakla (API çağrıları için)
          (formattedPlan as any).startDateDDMMYYYY = `${today.getUTCDate().toString().padStart(2, '0')}/${(today.getUTCMonth() + 1).toString().padStart(2, '0')}/${today.getUTCFullYear()}`;

          console.log('Orijinal tarih saklandı (bugün - ISO format):', originalDate);
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

        // Orijinal tarihi de sakla (ISO formatında) - hava durumu ve diğer hesaplamalar için
        const originalDate = today.toISOString();
        formattedPlan.originalStartDate = originalDate;
        formattedPlan.startDateISO = originalDate; // Ek olarak startDateISO alanını da ekle

        // Ayrıca DD/MM/YYYY formatında da sakla (API çağrıları için)
        (formattedPlan as any).startDateDDMMYYYY = `${today.getUTCDate().toString().padStart(2, '0')}/${(today.getUTCMonth() + 1).toString().padStart(2, '0')}/${today.getUTCFullYear()}`;

      }
    }

    // Veri formatını kontrol et - web uygulamasının beklediği formatta olduğundan emin ol

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
              data.visaInfo = parsedItinerary.visaInfo;
            }

            if (parsedItinerary.culturalDifferences && !data.culturalDifferences) {
              data.culturalDifferences = parsedItinerary.culturalDifferences;
            }

            if (parsedItinerary.localTips && !data.localTips) {
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


          // Önce string içindeki kaçış karakterlerini temizle
          let cleanString = data.culturalDifferences
            .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
            .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

          // Eğer string JSON formatında değilse, düzelt
          if (!cleanString.startsWith('{')) {
            cleanString = `{${cleanString}}`;
          }


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
          (_snapshot) => {
            // Yükleme durumunu izle
            // İlerleme durumu gerekirse burada kullanılabilir
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
          (_snapshot) => {
            // Yükleme durumunu izle
            // İlerleme durumu gerekirse burada kullanılabilir
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
   * Birden fazla fotoğrafı bir yoruma ekler
   */
  async addMultipleCommentPhotos(commentId: string, travelPlanId: string, photos: Array<{data: string, location?: string}>): Promise<Array<{url: string, location?: string}>> {
    try {
      console.log(`Çoklu yorum fotoğrafları ekleniyor: ${commentId}, fotoğraf sayısı: ${photos.length}`);

      if (!commentId?.trim() || !travelPlanId?.trim()) {
        console.warn("Geçersiz yorum ID'si veya seyahat planı ID'si");
        throw new Error("Geçersiz yorum ID'si veya seyahat planı ID'si");
      }

      if (!photos || photos.length === 0) {
        console.warn("Fotoğraf verisi bulunamadı");
        return [];
      }

      const uploadedPhotos: Array<{url: string, location?: string}> = [];

      // Her fotoğrafı ayrı ayrı ekle
      for (const photo of photos) {
        if (!photo.data || !photo.data.trim()) {
          console.warn("Geçersiz fotoğraf verisi, atlanıyor");
          continue;
        }

        try {
          // Fotoğrafı ekle
          const photoId = await this.addCommentPhoto(
            commentId,
            travelPlanId,
            photo.data,
            photo.location
          );

          // Başarıyla eklenen fotoğrafı listeye ekle
          uploadedPhotos.push({
            url: photo.data, // Base64 verisi URL olarak kullanılıyor
            location: photo.location
          });

          console.log(`Fotoğraf başarıyla eklendi: ${photoId}`);
        } catch (photoError) {
          console.error(`Fotoğraf ekleme hatası:`, photoError);
          // Bir fotoğraf eklenemese bile diğerlerini eklemeye devam et
        }
      }

      console.log(`${uploadedPhotos.length} fotoğraf başarıyla eklendi`);
      return uploadedPhotos;
    } catch (error) {
      console.error("Çoklu fotoğraf ekleme hatası:", error);
      throw error;
    }
  },

  /**
   * Yorum ID'sine göre fotoğrafları getirir
   */
  async getPhotosByCommentId(commentId: string): Promise<any[]> {
    try {
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
      const photos: any[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const uploadedAt = data.uploadedAt instanceof Timestamp
          ? data.uploadedAt.toDate().toISOString()
          : data.uploadedAt || new Date().toISOString();

        // Base64 formatını kontrol et
        if (data.photoData) {
          // Eğer data:image ile başlamıyorsa, ekle
          if (!data.photoData.startsWith('data:image')) {
            data.photoData = `data:image/jpeg;base64,${data.photoData}`;
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
      const photos: any[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const uploadedAt = data.uploadedAt instanceof Timestamp
          ? data.uploadedAt.toDate().toISOString()
          : data.uploadedAt || new Date().toISOString();

        // Base64 formatını kontrol et
        if (data.photoData) {
          // Eğer data:image ile başlamıyorsa, ekle
          if (!data.photoData.startsWith('data:image')) {
            data.photoData = `data:image/jpeg;base64,${data.photoData}`;
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
      if (!photoId?.trim()) {
        console.warn("Geçersiz fotoğraf ID'si");
        return false;
      }

      const photoRef = doc(db, COMMENT_PHOTOS_COLLECTION, photoId);
      await deleteDoc(photoRef);

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
      const comments: TripComment[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();

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
      const photos = await CommentPhotoService.getPhotosByTravelPlanId(travelPlanId);

      // 3. Her yoruma ait fotoğrafları eşleştir
      if (photos.length > 0) {
        comments.forEach(comment => {
          // Bu yoruma ait tüm fotoğrafları bul
          const commentPhotos = photos.filter(photo => photo.commentId === comment.id);

          if (commentPhotos.length > 0) {
            // Geriye uyumluluk için ilk fotoğrafı eski alanlara ekle
            const firstPhoto = commentPhotos[0];
            comment.photoData = firstPhoto.photoData;
            comment.photoLocation = firstPhoto.photoLocation;

            // Birden fazla fotoğraf varsa, photosJson alanını oluştur
            if (commentPhotos.length > 0) {
              // Fotoğrafları JSON formatında sakla
              const photosArray = commentPhotos.map(photo => ({
                url: photo.photoData,
                location: photo.photoLocation || undefined
              }));

              // Eğer yorum nesnesinde zaten photosJson alanı yoksa ekle
              if (!comment.photosJson) {
                comment.photosJson = JSON.stringify(photosArray);
              }
            }
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
  async addComment(comment: Omit<TripComment, 'id' | 'createdAt' | 'updatedAt'>, photos?: Array<{data: string, location?: string}>): Promise<string> {
    try {
      // Fotoğraf verilerini geçici olarak sakla (geriye uyumluluk için)
      const photoData = comment.photoData;
      const photoLocation = comment.photoLocation;

      // photosJson alanını geçici olarak sakla
      const photosJson = comment.photosJson;

      // Yorum nesnesinden fotoğraf verilerini çıkar (ayrı koleksiyona taşıyacağız)
      delete comment.photoData;
      delete comment.photoUrl;
      delete comment.photoLocation;
      delete comment.photosJson;

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

      // Çoklu fotoğraf desteği
      if (photos && photos.length > 0) {
        try {
          // Çoklu fotoğrafları ekle
          const uploadedPhotos = await CommentPhotoService.addMultipleCommentPhotos(
            commentId,
            comment.travelPlanId,
            photos
          );

          // Yüklenen fotoğrafların URL'lerini ve konum bilgilerini içeren JSON'ı oluştur
          const photosJsonData = JSON.stringify(uploadedPhotos);

          // Yorumu güncelle, fotoğraf URL'lerini ekle
          await this.updateComment(commentId, {
            photosJson: photosJsonData,
            // Geriye uyumluluk için ilk fotoğrafı da eski alanlara ekle
            photoUrl: uploadedPhotos.length > 0 ? uploadedPhotos[0].url : undefined,
            photoLocation: uploadedPhotos.length > 0 ? uploadedPhotos[0].location : undefined
          });
        } catch (photoError) {
          console.error(`Fotoğraf ekleme hatası:`, photoError);
          // Fotoğraf eklenemese bile yorumu silmiyoruz
        }
      }
      // Geriye uyumluluk için tek fotoğraf desteği
      else if (photoData && photoData.trim() !== '') {
        try {
          // CommentPhotoService kullanarak fotoğrafı ekle
          await CommentPhotoService.addCommentPhoto(
            commentId,
            comment.travelPlanId,
            photoData,
            photoLocation
          );

          // Tek fotoğrafı JSON formatında kaydet
          const singlePhotoJson = JSON.stringify([{
            url: photoData,
            location: photoLocation
          }]);

          // Yorumu güncelle
          await this.updateComment(commentId, {
            photosJson: singlePhotoJson,
            photoUrl: photoData,
            photoLocation: photoLocation
          });
        } catch (photoError) {
          console.error(`Fotoğraf ekleme hatası:`, photoError);
          // Fotoğraf eklenemese bile yorumu silmiyoruz
        }
      }
      // Eğer photosJson alanı varsa, direkt olarak kullan
      else if (photosJson) {
        try {
          // Yorumu güncelle
          await this.updateComment(commentId, {
            photosJson: photosJson
          });

          // photosJson'dan fotoğrafları parse et
          try {
            const parsedPhotos = JSON.parse(photosJson);
            if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
              // Her fotoğrafı ayrı koleksiyona ekle
              for (const photo of parsedPhotos) {
                if (photo.url) {
                  await CommentPhotoService.addCommentPhoto(
                    commentId,
                    comment.travelPlanId,
                    photo.url,
                    photo.location
                  );
                }
              }

              // Geriye uyumluluk için ilk fotoğrafı da eski alanlara ekle
              await this.updateComment(commentId, {
                photoUrl: parsedPhotos[0].url,
                photoLocation: parsedPhotos[0].location
              });
            }
          } catch (parseError) {
            console.error(`photosJson parse hatası:`, parseError);
          }
        } catch (jsonError) {
          console.error(`photosJson güncelleme hatası:`, jsonError);
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
  async updateComment(id: string, comment: Partial<TripComment>, photos?: Array<{data: string, location?: string}>): Promise<boolean> {
    try {
      console.log(`Yorum güncelleniyor: ${id}`);

      if (!id?.trim()) {
        console.warn("Geçersiz yorum ID'si");
        return false;
      }

      // Fotoğraf verilerini geçici olarak sakla (geriye uyumluluk için)
      const photoData = comment.photoData;
      const photoLocation = comment.photoLocation;

      // photosJson alanını geçici olarak sakla
      const photosJson = comment.photosJson;

      // Yorum nesnesinden fotoğraf verilerini çıkar (ayrı koleksiyonda saklayacağız)
      // Eğer photosJson alanı güncelleme için gönderilmişse, onu silme
      if (!photosJson) {
        delete comment.photosJson;
      }
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

      // Yorumun mevcut verilerini al (travelPlanId için gerekli)
      const commentDoc = await getDoc(commentRef);
      const commentData = commentDoc.exists() ? commentDoc.data() : null;
      const travelPlanId = commentData?.travelPlanId || '';

      // Çoklu fotoğraf desteği
      if (photos && photos.length > 0) {
        try {

          // Önce bu yoruma ait mevcut fotoğrafları getir ve sil
          const existingPhotos = await CommentPhotoService.getPhotosByCommentId(id);

          if (existingPhotos.length > 0) {

            for (const photo of existingPhotos) {
              await CommentPhotoService.deletePhoto(photo.id);
              console.log(`Fotoğraf silindi: ${photo.id}`);
            }
          }

          // Çoklu fotoğrafları ekle
          const uploadedPhotos = await CommentPhotoService.addMultipleCommentPhotos(
            id,
            travelPlanId,
            photos
          );

          // Yüklenen fotoğrafların URL'lerini ve konum bilgilerini içeren JSON'ı oluştur
          const photosJsonData = JSON.stringify(uploadedPhotos);

          // Yorumu güncelle, fotoğraf URL'lerini ekle
          await updateDoc(commentRef, {
            photosJson: photosJsonData,
            // Geriye uyumluluk için ilk fotoğrafı da eski alanlara ekle
            photoUrl: uploadedPhotos.length > 0 ? uploadedPhotos[0].url : undefined,
            photoLocation: uploadedPhotos.length > 0 ? uploadedPhotos[0].location : undefined,
            updatedAt: serverTimestamp()
          });

          console.log(`Fotoğraflar başarıyla güncellendi`);
        } catch (photoError) {
          console.error(`Fotoğraf güncelleme hatası:`, photoError);
          // Fotoğraf güncellenemese bile devam et
        }
      }
      // Geriye uyumluluk için tek fotoğraf desteği
      else if (photoData && photoData.trim() !== '') {
        try {

          // Önce bu yoruma ait mevcut fotoğrafları getir
          const existingPhotos = await CommentPhotoService.getPhotosByCommentId(id);

          if (existingPhotos.length > 0) {
            // Mevcut fotoğrafları sil

            for (const photo of existingPhotos) {
              await CommentPhotoService.deletePhoto(photo.id);
              console.log(`Fotoğraf silindi: ${photo.id}`);
            }
          }

          // Yeni fotoğrafı ekle
          console.log(`Fotoğraf ayrı koleksiyona ekleniyor...`);

          // CommentPhotoService kullanarak fotoğrafı ekle
          await CommentPhotoService.addCommentPhoto(
            id,
            travelPlanId || existingPhotos[0]?.travelPlanId,
            photoData,
            photoLocation
          );

          // Tek fotoğrafı JSON formatında kaydet
          const singlePhotoJson = JSON.stringify([{
            url: photoData,
            location: photoLocation
          }]);

          // Yorumu güncelle
          await updateDoc(commentRef, {
            photosJson: singlePhotoJson,
            photoUrl: photoData,
            photoLocation: photoLocation,
            updatedAt: serverTimestamp()
          });

          console.log(`Fotoğraf başarıyla ayrı koleksiyona eklendi`);
        } catch (photoError) {
          console.error(`Fotoğraf güncelleme hatası:`, photoError);
          // Fotoğraf güncellenemese bile devam et
        }
      }
      // Eğer photosJson alanı varsa ve güncelleme için gönderilmişse
      else if (photosJson) {
        try {
          console.log(`photosJson alanı mevcut, fotoğraflar güncelleniyor...`);

          // Önce bu yoruma ait mevcut fotoğrafları getir
          const existingPhotos = await CommentPhotoService.getPhotosByCommentId(id);

          if (existingPhotos.length > 0) {
            // Mevcut fotoğrafları sil
            console.log(`${existingPhotos.length} mevcut fotoğraf bulundu, siliniyor...`);

            for (const photo of existingPhotos) {
              await CommentPhotoService.deletePhoto(photo.id);
              console.log(`Fotoğraf silindi: ${photo.id}`);
            }
          }

          // photosJson'dan fotoğrafları parse et
          try {
            const parsedPhotos = JSON.parse(photosJson);
            if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
              // Her fotoğrafı ayrı koleksiyona ekle
              for (const photo of parsedPhotos) {
                if (photo.url) {
                  await CommentPhotoService.addCommentPhoto(
                    id,
                    travelPlanId,
                    photo.url,
                    photo.location
                  );
                }
              }

              // Geriye uyumluluk için ilk fotoğrafı da eski alanlara ekle
              await updateDoc(commentRef, {
                photoUrl: parsedPhotos[0].url,
                photoLocation: parsedPhotos[0].location,
                updatedAt: serverTimestamp()
              });
            }
          } catch (parseError) {
            console.error(`photosJson parse hatası:`, parseError);
          }

          console.log(`Fotoğraflar photosJson ile güncellendi`);
        } catch (jsonError) {
          console.error(`photosJson güncelleme hatası:`, jsonError);
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

// Bütçe servisi
export const BudgetService = {
  // Yeni bütçe oluştur
  async createBudget(budget: any): Promise<string> {
    try {
      if (!budget.userId || !budget.travelPlanId) {
        throw new Error("Kullanıcı ID ve seyahat planı ID gereklidir");
      }

      const budgetRef = collection(db, BUDGETS_COLLECTION);

      // Timestamp ekle
      const budgetWithTimestamp = {
        ...budget,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Firestore'a ekle
      const docRef = await addDoc(budgetRef, budgetWithTimestamp);
      console.log("Bütçe oluşturuldu:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Bütçe oluşturma hatası:', error);
      throw error;
    }
  },

  // Bütçe bilgilerini getir
  async getBudget(budgetId: string, currentUserId?: string): Promise<any | null> {
    try {
      if (!budgetId?.trim()) {
        console.warn("Geçersiz bütçe ID'si");
        return null;
      }

      const budgetDocRef = doc(db, BUDGETS_COLLECTION, budgetId);
      const budgetDoc = await getDoc(budgetDocRef);

      if (!budgetDoc.exists()) {
        console.warn('Bütçe bulunamadı:', budgetId);
        return null;
      }

      const data = budgetDoc.data();

      // Timestamp'i Date'e dönüştür
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : undefined;

      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : undefined;

      // Kullanıcı bütçe sahibi mi kontrol et (isOwner özelliği için)
      let isOwner = false;
      if (currentUserId) {
        isOwner = data.userId === currentUserId;

        // Kullanıcı bütçenin sahibi değilse, log kaydı oluştur
        if (!isOwner) {
          console.log('Kullanıcı bütçe sahibi değil, sadece görüntüleme yetkisi var');
        }
      }

      return {
        id: budgetDoc.id,
        ...data,
        createdAt,
        updatedAt,
        isOwner // Kullanıcının bütçe sahibi olup olmadığı bilgisi
      };
    } catch (error) {
      console.error('Bütçe getirme hatası:', error);
      throw error;
    }
  },

  // Seyahat planına ait bütçeyi getir
  async getBudgetByTravelPlanId(travelPlanId: string): Promise<any | null> {
    try {
      if (!travelPlanId?.trim()) {
        console.warn("Geçersiz seyahat planı ID'si");
        return null;
      }

      const budgetQuery = query(
        collection(db, BUDGETS_COLLECTION),
        where('travelPlanId', '==', travelPlanId)
      );

      const budgetSnapshot = await getDocs(budgetQuery);

      if (budgetSnapshot.empty) {
        console.log("Seyahat planına ait bütçe bulunamadı:", travelPlanId);
        return null;
      }

      const budgetDoc = budgetSnapshot.docs[0];
      const data = budgetDoc.data();

      // Timestamp'i Date'e dönüştür
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : undefined;

      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : undefined;

      return {
        id: budgetDoc.id,
        ...data,
        createdAt,
        updatedAt
      };
    } catch (error) {
      console.error('Seyahat planı bütçesi getirme hatası:', error);
      throw error;
    }
  },

  // Kullanıcıya ait bütçeleri getir
  async getUserBudgets(userId: string): Promise<any[]> {
    try {
      if (!userId?.trim()) {
        console.warn("Geçersiz kullanıcı ID'si");
        return [];
      }

      const budgetQuery = query(
        collection(db, BUDGETS_COLLECTION),
        where('userId', '==', userId)
      );

      const budgetSnapshot = await getDocs(budgetQuery);

      if (budgetSnapshot.empty) {
        console.log("Kullanıcıya ait bütçe bulunamadı:", userId);
        return [];
      }

      return budgetSnapshot.docs.map(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : undefined;

        const updatedAt = data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : undefined;

        return {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt
        };
      });
    } catch (error) {
      console.error('Kullanıcı bütçeleri getirme hatası:', error);
      throw error;
    }
  },

  // Bütçeyi güncelle
  async updateBudget(budgetId: string, updates: any, currentUserId?: string): Promise<boolean> {
    try {
      if (!budgetId?.trim()) {
        console.warn("Geçersiz bütçe ID'si");
        return false;
      }

      const budgetDocRef = doc(db, BUDGETS_COLLECTION, budgetId);
      const budgetDoc = await getDoc(budgetDocRef);

      if (!budgetDoc.exists()) {
        console.warn('Bütçe bulunamadı:', budgetId);
        return false;
      }

      const budgetData = budgetDoc.data();

      // Erişim kontrolü: Sadece bütçe sahibi güncelleyebilir
      if (currentUserId && budgetData.userId !== currentUserId) {
        console.warn('Erişim reddedildi: Sadece bütçe sahibi bütçeyi güncelleyebilir');
        return false;
      }

      // Timestamp ekle
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(budgetDocRef, updatesWithTimestamp);
      console.log("Bütçe güncellendi:", budgetId);

      return true;
    } catch (error) {
      console.error('Bütçe güncelleme hatası:', error);
      throw error;
    }
  },

  // Bütçeyi sil
  async deleteBudget(budgetId: string, currentUserId?: string): Promise<boolean> {
    try {
      if (!budgetId?.trim()) {
        console.warn("Geçersiz bütçe ID'si");
        return false;
      }

      const budgetDocRef = doc(db, BUDGETS_COLLECTION, budgetId);
      const budgetDoc = await getDoc(budgetDocRef);

      if (!budgetDoc.exists()) {
        console.warn('Bütçe bulunamadı:', budgetId);
        return false;
      }

      const budgetData = budgetDoc.data();

      // Erişim kontrolü: Sadece bütçe sahibi silebilir
      if (currentUserId && budgetData.userId !== currentUserId) {
        console.warn('Erişim reddedildi: Sadece bütçe sahibi bütçeyi silebilir');
        return false;
      }

      // Önce bütçeye ait harcamaları sil
      const expenseQuery = query(
        collection(db, EXPENSES_COLLECTION),
        where('budgetId', '==', budgetId)
      );

      const expenseSnapshot = await getDocs(expenseQuery);

      const deletePromises = expenseSnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      );

      await Promise.all(deletePromises);

      // Sonra bütçeyi sil
      await deleteDoc(budgetDocRef);

      console.log("Bütçe silindi:", budgetId);
      return true;
    } catch (error) {
      console.error('Bütçe silme hatası:', error);
      throw error;
    }
  }
};

// Harcama servisi
export const ExpenseService = {
  // Yeni harcama ekle
  async addExpense(expense: any, currentUserId?: string): Promise<string> {
    try {
      console.log("ExpenseService.addExpense çağrıldı:", JSON.stringify(expense, null, 2));

      // Zorunlu alanları kontrol et
      if (!expense.userId) {
        console.error("userId eksik:", expense);
        throw new Error("Kullanıcı ID gereklidir");
      }

      if (!expense.budgetId) {
        console.error("budgetId eksik:", expense);
        throw new Error("Bütçe ID gereklidir");
      }

      if (!expense.categoryId) {
        console.error("categoryId eksik:", expense);
        throw new Error("Kategori ID gereklidir");
      }

      // Erişim kontrolü: Sadece bütçe sahibi harcama ekleyebilir
      if (currentUserId) {
        const budgetDocRef = doc(db, BUDGETS_COLLECTION, expense.budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (!budgetDoc.exists()) {
          console.warn('Bütçe bulunamadı:', expense.budgetId);
          throw new Error("Bütçe bulunamadı");
        }

        const budgetData = budgetDoc.data();

        // Kullanıcı bütçenin sahibi değilse, harcama ekleyemez
        if (budgetData.userId !== currentUserId) {
          console.warn('Erişim reddedildi: Sadece bütçe sahibi harcama ekleyebilir');
          throw new Error("Erişim reddedildi: Sadece bütçe sahibi harcama ekleyebilir");
        }
      }

      const expenseRef = collection(db, EXPENSES_COLLECTION);

      // Tarih kontrolü
      const expenseData = {
        ...expense,
        date: expense.date || serverTimestamp(),
      };

      console.log("Firestore'a kaydedilecek veri:", JSON.stringify(expenseData, null, 2));

      // Firestore'a eklemeden önce son kontrol
      if (!expenseData.userId || typeof expenseData.userId !== 'string') {
        console.error("Geçersiz userId formatı:", expenseData.userId);
        throw new Error("Geçersiz userId formatı. String olmalı.");
      }

      if (!expenseData.budgetId || typeof expenseData.budgetId !== 'string') {
        console.error("Geçersiz budgetId formatı:", expenseData.budgetId);
        throw new Error("Geçersiz budgetId formatı. String olmalı.");
      }

      if (!expenseData.categoryId || typeof expenseData.categoryId !== 'string') {
        console.error("Geçersiz categoryId formatı:", expenseData.categoryId);
        throw new Error("Geçersiz categoryId formatı. String olmalı.");
      }

      // Firestore'a ekle
      const docRef = await addDoc(expenseRef, expenseData);
      console.log("Harcama eklendi:", docRef.id);

      // Kategori harcama miktarını güncelle
      if (expense.budgetId && expense.categoryId && expense.amount) {
        const budgetDocRef = doc(db, BUDGETS_COLLECTION, expense.budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (budgetDoc.exists()) {
          const budget = budgetDoc.data();
          const categories = budget.categories || [];
          const categoryIndex = categories.findIndex((c: any) => c.id === expense.categoryId);

          if (categoryIndex !== -1) {
            categories[categoryIndex].spentAmount = (categories[categoryIndex].spentAmount || 0) + expense.amount;

            await updateDoc(budgetDocRef, {
              categories,
              updatedAt: serverTimestamp(),
            });

            console.log("Kategori harcama miktarı güncellendi");
          }
        }
      }

      return docRef.id;
    } catch (error) {
      console.error('Harcama ekleme hatası:', error);
      throw error;
    }
  },

  // Bütçeye ait harcamaları getir
  async getExpensesByBudgetId(budgetId: string, currentUserId?: string): Promise<any[]> {
    try {
      if (!budgetId?.trim()) {
        console.warn("Geçersiz bütçe ID'si");
        return [];
      }

      // Önce bütçeyi getir ve erişim kontrolü yap
      if (currentUserId) {
        const budgetDocRef = doc(db, BUDGETS_COLLECTION, budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (!budgetDoc.exists()) {
          console.warn('Bütçe bulunamadı:', budgetId);
          return [];
        }

        const budgetData = budgetDoc.data();

        // Kullanıcı bütçenin sahibi değilse, seyahat planı katılımcısı mı kontrol et
        if (budgetData.userId !== currentUserId) {
          const travelPlanRef = doc(db, TRAVEL_PLANS_COLLECTION, budgetData.travelPlanId);
          const travelPlanDoc = await getDoc(travelPlanRef);

          if (!travelPlanDoc.exists()) {
            console.warn('Erişim reddedildi: İlgili seyahat planı bulunamadı');
            return [];
          }

          const travelPlanData = travelPlanDoc.data();
          const isParticipant = travelPlanData.participantUserIds &&
                               Array.isArray(travelPlanData.participantUserIds) &&
                               travelPlanData.participantUserIds.includes(currentUserId);

          if (!isParticipant) {
            console.warn('Erişim reddedildi: Kullanıcı bu bütçenin harcamalarına erişim yetkisine sahip değil');
            return [];
          }

          // Kullanıcı katılımcı ise, harcamaları görüntüleme yetkisine sahiptir
          console.log('Kullanıcı seyahat planı katılımcısı olarak harcamalara erişiyor');
        }
      }

      const expenseQuery = query(
        collection(db, EXPENSES_COLLECTION),
        where('budgetId', '==', budgetId)
      );

      const expenseSnapshot = await getDocs(expenseQuery);

      if (expenseSnapshot.empty) {
        console.log("Bütçeye ait harcama bulunamadı:", budgetId);
        return [];
      }

      return expenseSnapshot.docs.map(doc => {
        const data = doc.data();

        // Timestamp'i Date'e dönüştür
        const date = data.date instanceof Timestamp
          ? data.date.toDate().toISOString()
          : data.date;

        return {
          id: doc.id,
          ...data,
          date
        };
      });
    } catch (error) {
      console.error('Harcama listesi getirme hatası:', error);
      throw error;
    }
  },

  // Harcamayı güncelle
  async updateExpense(expenseId: string, updates: any, oldAmount?: number, currentUserId?: string): Promise<boolean> {
    try {
      if (!expenseId?.trim()) {
        console.warn("Geçersiz harcama ID'si");
        return false;
      }

      const expenseRef = doc(db, EXPENSES_COLLECTION, expenseId);
      const expenseDoc = await getDoc(expenseRef);

      if (!expenseDoc.exists()) {
        console.warn("Harcama bulunamadı:", expenseId);
        return false;
      }

      const expense = expenseDoc.data();

      // Erişim kontrolü: Sadece bütçe sahibi harcamayı güncelleyebilir
      if (currentUserId && expense.budgetId) {
        const budgetDocRef = doc(db, BUDGETS_COLLECTION, expense.budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (!budgetDoc.exists()) {
          console.warn('Bütçe bulunamadı:', expense.budgetId);
          return false;
        }

        const budgetData = budgetDoc.data();

        // Kullanıcı bütçenin sahibi değilse, harcamayı güncelleyemez
        if (budgetData.userId !== currentUserId) {
          console.warn('Erişim reddedildi: Sadece bütçe sahibi harcamayı güncelleyebilir');
          return false;
        }
      }

      // Harcamayı güncelle
      await updateDoc(expenseRef, updates);
      console.log("Harcama güncellendi:", expenseId);

      // Eğer miktar değiştiyse, kategori harcama miktarını güncelle
      if (updates.amount !== undefined && oldAmount !== undefined && expense.budgetId && expense.categoryId) {
        const amountDiff = updates.amount - oldAmount;

        const budgetDocRef = doc(db, BUDGETS_COLLECTION, expense.budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (budgetDoc.exists()) {
          const budget = budgetDoc.data();
          const categories = budget.categories || [];
          const categoryIndex = categories.findIndex((c: any) => c.id === expense.categoryId);

          if (categoryIndex !== -1) {
            categories[categoryIndex].spentAmount = (categories[categoryIndex].spentAmount || 0) + amountDiff;

            await updateDoc(budgetDocRef, {
              categories,
              updatedAt: serverTimestamp(),
            });

            console.log("Kategori harcama miktarı güncellendi");
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Harcama güncelleme hatası:', error);
      throw error;
    }
  },

  // Harcamayı sil
  async deleteExpense(expenseId: string, currentUserId?: string): Promise<boolean> {
    try {
      if (!expenseId?.trim()) {
        console.warn("Geçersiz harcama ID'si");
        return false;
      }

      const expenseRef = doc(db, EXPENSES_COLLECTION, expenseId);
      const expenseDoc = await getDoc(expenseRef);

      if (!expenseDoc.exists()) {
        console.warn("Harcama bulunamadı:", expenseId);
        return false;
      }

      const expense = expenseDoc.data();

      // Erişim kontrolü: Sadece bütçe sahibi harcamayı silebilir
      if (currentUserId && expense.budgetId) {
        const budgetDocRef = doc(db, BUDGETS_COLLECTION, expense.budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (!budgetDoc.exists()) {
          console.warn('Bütçe bulunamadı:', expense.budgetId);
          return false;
        }

        const budgetData = budgetDoc.data();

        // Kullanıcı bütçenin sahibi değilse, harcamayı silemez
        if (budgetData.userId !== currentUserId) {
          console.warn('Erişim reddedildi: Sadece bütçe sahibi harcamayı silebilir');
          return false;
        }
      }

      // Harcamayı sil
      await deleteDoc(expenseRef);
      console.log("Harcama silindi:", expenseId);

      // Kategori harcama miktarını güncelle
      if (expense.budgetId && expense.categoryId && expense.amount) {
        const budgetDocRef = doc(db, BUDGETS_COLLECTION, expense.budgetId);
        const budgetDoc = await getDoc(budgetDocRef);

        if (budgetDoc.exists()) {
          const budget = budgetDoc.data();
          const categories = budget.categories || [];
          const categoryIndex = categories.findIndex((c: any) => c.id === expense.categoryId);

          if (categoryIndex !== -1) {
            categories[categoryIndex].spentAmount = (categories[categoryIndex].spentAmount || 0) - expense.amount;

            await updateDoc(budgetDocRef, {
              categories,
              updatedAt: serverTimestamp(),
            });

            console.log("Kategori harcama miktarı güncellendi");
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Harcama silme hatası:', error);
      throw error;
    }
  }
};

// Firebase servisi - tüm servisleri birleştir
export const FirebaseService = {
  TravelPlan: TravelPlanService,
  User: UserService,
  Comment: CommentService,
  CommentPhoto: CommentPhotoService,
  Budget: BudgetService,
  Expense: ExpenseService
};

// Expo Router için default export gereklidir
export default function FirebaseServiceComponent() {
  return null;
}
