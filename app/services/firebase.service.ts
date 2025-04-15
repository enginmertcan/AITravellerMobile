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
  orderBy, 
  serverTimestamp,
  Timestamp,
  addDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
      
      // Timestamp ekle
      const planWithTimestamp = {
        ...travelPlan,
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
        duration: 3, // Duration number olmalı
        days: 3,
        startDate: "04/04/2025",
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
      // Dosya adı oluştur
      const timestamp = new Date().getTime();
      const fileName = `${userId}_${timestamp}.jpg`;
      const storageRef = ref(storage, `${folderName}/${fileName}`);
      
      // Resmi fetch et ve buffer'a dönüştür
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Storage'a yükle
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Download URL al
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      return downloadUrl;
    } catch (error) {
      console.error("Resim yükleme hatası:", error);
      throw error;
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
