export interface TravelPlan {
  // Temel bilgiler
  id?: string;                // Firebase document ID
  destination: string;        // Ana destinasyon/şehir adı
  rawResponse?: string;       // Ham AI yanıtı

  // Temel seyahat bilgileri
  startDate: string;           // Başlangıç tarihi
  endDate?: string;            // Bitiş tarihi (opsiyonel)
  duration: number;            // Seyahat süresi (gün)
  days?: number;               // Alternatif süre gösterimi

  // Ülke ve konum bilgileri
  country?: string;            // Ziyaret edilen ülke
  city?: string;               // Ziyaret edilen şehir

  // Konaklama ve bütçe
  budget: string;              // Bütçe durumu ("ekonomik", "standart", "lüks" vb)
  accommodationType?: string;  // Konaklama türü (otel, hostel, Airbnb vb)
  bestTimeToVisit?: string;    // Ziyaret için en uygun zaman

  // Seyahat tipi ve kişi sayısı
  travelType?: string;         // Seyahat türü (tatil, iş, aile ziyareti vb)
  travelerCount?: number;       // Seyahat eden kişi sayısı (sayısal)
  groupType?: string;           // Grup tipi (aile, çift, arkadaş grubu vb)
  numberOfPeople?: string;      // Kişi sayısı (metin olarak ör: "2 Kişi")

  // Özel durumlar
  includeChildren?: boolean;    // Çocuklu aile mi?
  includeElderly?: boolean;     // Yaşlı var mı?

  // Tercihler
  travelStyle?: string[];       // Seyahat stili (macera, kültür, doğa vb)
  mustSeeAttractions?: string[]; // Mutlaka görülmesi gereken yerler

  // Vize ve Dil
  needsVisa?: boolean;          // Vize gerekiyor mu?
  requiresTranslationSupport?: boolean; // Çeviri desteği gerekli mi?

  // Vatandaşlık ve ülke bilgileri
  residenceCountry: string;     // İkamet ülkesi
  citizenship: string;          // Vatandaşlık
  isDomestic: boolean;          // Yurtiçi seyahat mi?

  // Kullanıcı ve zaman bilgileri
  userId: string;               // Kullanıcı ID'si (Clerk veya Firebase)
  createdAt?: string;           // Oluşturma zamanı (ISO string)
  updatedAt?: string;           // Güncelleme zamanı (ISO string)

  // Destinasyon detayları (opsiyonel)
  destinationInfo?: {
    name: string;
    country: string;
    bestTimeToVisit: string;
    language: string;
    timezone: string;
    currency: string;
  };

  // Gezi planı ve otel bilgileri - JSON.stringify edilmiş olabilir veya JSON nesnesi
  itinerary?: string | any;     // Seyahat programı (günlük plan)
  hotelOptions?: any[] | any;    // Otel seçenekleri listesi

  // Kültürel bilgiler ve yerel ipuçları
  culturalDifferences?: any;     // Kültürel farklılıklar
  localTips?: any;               // Yerel ipuçları

  // Seyahat özeti
  tripSummary?: {
    duration: string;
    travelers: string;
    budget: string;
  };

  // Vize bilgileri
  visaInfo?: {
    visaRequirement: string;
    visaApplicationProcess: string;
    requiredDocuments: string[];
    visaFee?: string;
  };

  // Diğer yardımcı bilgiler
  travelDocumentChecklist?: string | string[];
  localTransportationGuide?: string;
  emergencyContacts?: string | string[];
  currencyAndPayment?: string;
  communicationInfo?: string;
}

// Yardımcı fonksiyonlar
export function safeParseJSON(jsonString: string | any) {
  // Eğer zaten bir obje ise, direkt döndür
  if (typeof jsonString === 'object' && jsonString !== null) {
    return jsonString;
  }

  // String değilse veya boşsa null döndür
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return null;
  }

  try {
    // JSON parse işlemi
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON parse hatası:', e);

    // Hata durumunda, JSON formatına uygun hale getirmeyi dene
    try {
      // Tek tırnak yerine çift tırnak kullan
      const fixedJson = jsonString
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // property adlarını düzelt
        .replace(/'/g, '"'); // tek tırnakları çift tırnağa çevir

      return JSON.parse(fixedJson);
    } catch (fixError) {
      console.error('JSON düzeltme hatası:', fixError);
      return null;
    }
  }
}

// Expo Router için default export gereklidir
export default function TravelTypesComponent() {
  return null;
}

// Default empty travel plan object
export const DEFAULT_TRAVEL_PLAN: TravelPlan = {
  id: '',
  destination: '',
  startDate: '',
  duration: 0,
  budget: '',
  residenceCountry: '',
  citizenship: '',
  isDomestic: false,
  userId: '',
  // Opsiyonel alanlar
  days: 0,
  groupType: '',
  numberOfPeople: '',
  country: '',
  bestTimeToVisit: '',
  // Destinasyon detayları
  destinationInfo: {
    name: '',
    country: '',
    bestTimeToVisit: '',
    language: '',
    timezone: '',
    currency: ''
  },
  // Boş diziler ve nesneler
  itinerary: '',
  hotelOptions: [],
  tripSummary: {
    duration: '',
    travelers: '',
    budget: ''
  },
  visaInfo: {
    visaRequirement: '',
    visaApplicationProcess: '',
    requiredDocuments: []
  },
  travelDocumentChecklist: [],
  localTransportationGuide: '',
  emergencyContacts: [],
  currencyAndPayment: '',
  communicationInfo: ''
};
