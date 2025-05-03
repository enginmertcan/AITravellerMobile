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
import { TravelPlan, DEFAULT_TRAVEL_PLAN } from "../types/travel";

// Koleksiyon referansları
const TRAVEL_PLANS_COLLECTION = "travelPlans";
const USERS_COLLECTION = "users";

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

      // Web formatında itinerary oluştur - tam olarak web uygulamasının beklediği format
      // Web uygulaması için itinerary formatı: { hotelOptions: [...], itinerary: [...] }
      const itineraryString = JSON.stringify({
        hotelOptions: hotelOptionsArray,
        itinerary: itineraryArray
      });

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

          // Web formatında itinerary oluştur
          formattedPlan.itinerary = JSON.stringify({
            hotelOptions: hotelOptionsArray,
            itinerary: itineraryArray
          });
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

    // Karmaşık nesneleri temizle - web uygulaması bunları beklemediği için
    // İtinerary ve hotelOptions alanlarını zaten string'e dönüştürdük
    // Diğer karmaşık nesneleri temizleyelim
    const complexObjectsToRemove = [
      'visaInfo', 'tripSummary', 'destinationInfo', 'localTips',
      'culturalDifferences', 'lifestyleDifferences', 'foodCultureDifferences',
      'socialNormsDifferences', 'visaRequirements', 'visaApplicationProcess',
      'visaFees', 'travelDocumentChecklist', 'localTransportationGuide',
      'emergencyContacts', 'currencyAndPayment', 'communicationInfo',
      'healthcareInfo', 'religiousAndCulturalSensitivities', 'localTraditionsAndCustoms',
      'culturalEventsAndFestivals', 'localCommunicationTips'
    ];

    complexObjectsToRemove.forEach(field => {
      if (formattedPlan[field]) {
        delete formattedPlan[field];
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

        plans.push({
          ...data as Partial<TravelPlan>,
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

      return {
        ...data as Partial<TravelPlan>,
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
      console.log(`Resim yükleme başlatılıyor: ${folderName} klasörüne ${userId} kullanıcısı için`);

      // Dosya adı oluştur
      const timestamp = new Date().getTime();
      const fileName = `${userId}_${timestamp}.jpg`;
      const fullPath = `${folderName}/${fileName}`;
      console.log(`Dosya yolu: ${fullPath}`);

      const storageRef = ref(storage, fullPath);
      console.log('Storage referansı oluşturuldu');

      // Resmi fetch et ve buffer'a dönüştür
      console.log('Resim fetch ediliyor:', imageUri.substring(0, 50) + '...');
      const response = await fetch(imageUri);
      const blob = await response.blob();
      console.log(`Blob oluşturuldu, boyut: ${blob.size} bytes`);

      // Storage'a yükle - uploadBytesResumable kullanarak daha iyi hata yönetimi
      console.log('Firebase Storage\'a yükleniyor...');

      // Promise olarak yükleme işlemini bekle
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Yükleme durumunu izle
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Yükleme ilerlemesi: ${progress.toFixed(2)}%`);
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
            console.log('Yükleme başarıyla tamamlandı');
            try {
              // Download URL al
              console.log('Download URL alınıyor...');
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('Download URL:', downloadUrl);
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
      console.log(`Blob yükleniyor, boyut: ${blob.size} bytes`);

      // Yükleme işlemi
      const uploadTask = uploadBytesResumable(storageRef, blob);

      // Promise olarak yükleme işlemini bekle
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Yükleme durumunu izle
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Yükleme ilerlemesi: ${progress.toFixed(2)}%`);
          },
          (error) => {
            // Hata durumunda
            console.error('Yükleme hatası:', error);
            reject(error);
          },
          () => {
            // Yükleme tamamlandığında
            console.log('Yükleme başarıyla tamamlandı');
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
      console.log('Download URL alındı:', url);
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
      console.log(`Base64 resim yükleme başlatılıyor: ${fullPath}`);
      console.log(`Base64 uzunluğu: ${base64Image.length}`);

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
      console.log('Firebase Storage\'a yükleniyor...');
      const snapshot = await uploadBytes(storageRef, blob);
      console.log('Yükleme tamamlandı, metadata:', snapshot.metadata);

      // Download URL al
      console.log('Download URL alınıyor...');
      const downloadUrl = await getDownloadURL(snapshot.ref);
      console.log('Download URL:', downloadUrl);

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

      console.log("Fotoğraf başarıyla eklendi:", newPhoto.id);
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
        console.log(`Mevcut fotoğraf güncellendi: ${photoId}`);
      } else {
        // Yoksa ekle
        tripPhotos.push(newPhoto);
        console.log(`Yeni fotoğraf eklendi: ${photoId}`);
      }

      // Web uyumluluğu için string'e dönüştür
      const tripPhotosString = JSON.stringify(tripPhotos);

      // Seyahat planını güncelle
      const docRef = doc(db, TRAVEL_PLANS_COLLECTION, travelPlanId);
      await updateDoc(docRef, {
        tripPhotos: tripPhotosString,
        updatedAt: serverTimestamp()
      });

      console.log("Base64 resim başarıyla ana koleksiyona kaydedildi:", photoId);
      console.log(`Toplam fotoğraf sayısı: ${tripPhotos.length}`);
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
      console.log(`Base64 resim Firestore'a kaydediliyor...`);
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

// Firebase servisi - tüm servisleri birleştir
export const FirebaseService = {
  TravelPlan: TravelPlanService,
  User: UserService
};

// Expo Router için default export gereklidir
export default function FirebaseServiceComponent() {
  return null;
}
