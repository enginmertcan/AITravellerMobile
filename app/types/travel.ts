export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface Activity {
  time?: string;
  name?: string;
  placeName?: string;
  title?: string;
  description?: string;
  placeDetails?: string;
  imageUrl?: string;
  placeImageUrl?: string;
  geoCoordinates?: GeoCoordinates;
  timeEstimate?: string;
  timeToSpend?: string;
  timeToTravel?: string;
  ticketPricing?: string;
  cost?: string;
  tips?: string[];
  warnings?: string[];
  alternatives?: string[];
}

export interface DayPlan {
  day: string;
  theme?: string;
  activities?: Activity[];
  plan?: Activity[];
}

export interface Hotel {
  hotelName: string;
  hotelAddress: string;
  priceRange?: string;
  price?: string;
  imageUrl?: string;
  hotelImageUrl?: string;
  geoCoordinates?: GeoCoordinates;
  rating?: number;
  description: string;
  bestTimeToVisit?: string;
  features?: string[];
  surroundings?: string;
}

export interface TripPhoto {
  id: string;
  imageUrl?: string;
  imageData?: string; // Base64 formatında resim verisi
  imageRef?: string;  // Firestore referansı
  caption?: string;
  location?: string;
  date?: string;
  dayNumber?: number;
  activityName?: string;
  uploadedAt: string;
}

export interface TravelPlan {
  // Temel bilgiler
  id?: string;                // Firebase document ID
  destination: string;        // Ana destinasyon/şehir adı
  rawResponse?: string;       // Ham AI yanıtı

  // Temel seyahat bilgileri
  startDate: string;           // Başlangıç tarihi
  endDate?: string;            // Bitiş tarihi (opsiyonel)
  duration: string;            // Seyahat süresi (gün) - Web uyumluluğu için string
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

  // Gezi planı ve otel bilgileri - Web uyumluluğu için
  itinerary: { [key: string]: DayPlan | Activity[] } | string;  // Web uyumluluğu için nesne veya string
  hotelOptions: Hotel[] | string;  // Web uyumluluğu için dizi veya string

  // Kültürel bilgiler ve yerel ipuçları
  culturalDifferences?: string;
  lifestyleDifferences?: string;
  foodCultureDifferences?: string;
  socialNormsDifferences?: string;
  localTips?: any;

  // Seyahat özeti
  tripSummary?: {
    duration: string;
    travelers: string;
    budget: string;
  };

  // Vize bilgileri
  visaInfo?: VisaInfo;
  visaRequirements?: string;
  visaApplicationProcess?: string;
  visaFees?: string;

  // Diğer yardımcı bilgiler
  travelDocumentChecklist?: string | string[];
  localTransportationGuide?: string;
  emergencyContacts?: string | string[];
  currencyAndPayment?: string;
  communicationInfo?: string;
  healthcareInfo?: string;

  // Seyahat fotoğrafları
  tripPhotos?: TripPhoto[] | string; // Web uyumluluğu için dizi veya string
}

export interface VisaInfo {
  visaRequirement: string;
  visaApplicationProcess: string;
  requiredDocuments: string[];
  visaFee: string;
  visaProcessingTime: string;
  visaApplicationCenters: string;
  passportRequirements: string;
  passportValidityRequirements: string;
  importantNotes: string;
  emergencyContacts: {
    ambulance: string;
    police: string;
    jandarma: string;
  };
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

// Seyahat fotoğraflarını parse et
export function parseTripPhotos(tripPhotos: TripPhoto[] | string | undefined): TripPhoto[] {
  if (!tripPhotos) {
    return [];
  }

  if (typeof tripPhotos === 'string') {
    try {
      const parsed = safeParseJSON(tripPhotos);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Fotoğraf parse hatası:', error);
      return [];
    }
  }

  return Array.isArray(tripPhotos) ? tripPhotos : [];
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
  duration: '', // Web uyumluluğu için string
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
  // Web uyumluluğu için boş nesne
  itinerary: {},
  hotelOptions: [],
  // Kültürel farklılıklar
  culturalDifferences: '',
  lifestyleDifferences: '',
  foodCultureDifferences: '',
  socialNormsDifferences: '',
  // Seyahat özeti
  tripSummary: {
    duration: '',
    travelers: '',
    budget: ''
  },
  // Vize bilgileri
  visaInfo: {
    visaRequirement: '',
    visaApplicationProcess: '',
    requiredDocuments: [],
    visaFee: '',
    visaProcessingTime: '',
    visaApplicationCenters: '',
    passportRequirements: '',
    passportValidityRequirements: '',
    importantNotes: '',
    emergencyContacts: {
      ambulance: '',
      police: '',
      jandarma: ''
    }
  },
  visaRequirements: '',
  visaApplicationProcess: '',
  visaFees: '',
  // Diğer yardımcı bilgiler
  travelDocumentChecklist: [],
  localTransportationGuide: '',
  emergencyContacts: [],
  currencyAndPayment: '',
  communicationInfo: '',
  healthcareInfo: '',
  // Seyahat fotoğrafları
  tripPhotos: []
};
