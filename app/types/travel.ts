export interface TravelPlan {
  id?: string;                // Firebase document ID
  destination: string;        // Ana destinasyon/şehir adı
  rawResponse?: string;       // Ham AI yanıtı
  
  // Temel seyahat bilgileri
  startDate: string;
  endDate: string;
  duration: number;           // Seyahat süresi (gün)
  days?: number;              // Alternatif süre gösterimi
  
  // Konaklama ve bütçe
  budget: string;
  accommodationType: string;
  
  // Seyahat tipi ve kişi sayısı
  travelType: string;
  travelerCount: number;
  groupType?: string;
  numberOfPeople?: string;    // Alternatif kişi sayısı gösterimi
  
  // Özel durumlar
  includeChildren: boolean;
  includeElderly: boolean;
  
  // Tercihler
  travelStyle: string[];
  mustSeeAttractions: string[];
  
  // Vize ve Dil
  needsVisa: boolean;
  requiresTranslationSupport: boolean;
  
  // Vatandaşlık ve ülke bilgileri
  residenceCountry: string;   // İkamet ülkesi
  citizenship: string;        // Vatandaşlık
  isDomestic: boolean;        // Yurtiçi seyahat mi?
  
  // Kullanıcı ve zaman bilgileri
  userId: string;
  createdAt?: string;         // ISO string of Firebase Timestamp
  updatedAt?: string;         // ISO string of Firebase Timestamp
  
  // Destinasyon detayları
  destinationInfo: {
    name: string;
    country: string;
    bestTimeToVisit: string;
    language: string;
    timezone: string;
    currency: string;
  };
  
  // Gezi planı
  itinerary: any;

  // Kültürel bilgiler
  culturalDifferences: any;

  // Yerel ipuçları
  localTips: any;

  // Otel seçenekleri
  hotelOptions: any;

  // Seyahat özeti
  tripSummary: {
    duration: string;
    travelers: string;
    budget: string;
  };

  // Vize bilgileri
  visaInfo: {
    visaRequirement: string;
    visaApplicationProcess: string;
    requiredDocuments: string[];
    visaFee?: string;
  };

  // Seyahat belgeleri kontrol listesi
  travelDocumentChecklist: string | string[];
  
  // Yerel yaşam tavsiyeleri
  localTransportationGuide: string;
  emergencyContacts: string | string[];
  currencyAndPayment: string;
  communicationInfo: string;
}

// Yardımcı fonksiyonlar
export function safeParseJSON(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return null;
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
  endDate: '',
  duration: 0,  
  days: 0,
  budget: '',
  accommodationType: '',
  travelType: '',
  travelerCount: 0,
  groupType: '',
  numberOfPeople: '',
  includeChildren: false,
  includeElderly: false,
  travelStyle: [],
  mustSeeAttractions: [],
  needsVisa: false,
  requiresTranslationSupport: false,
  residenceCountry: '',
  citizenship: '',
  isDomestic: false,
  userId: '',
  destinationInfo: {
    name: '',
    country: '',
    bestTimeToVisit: '',
    language: '',
    timezone: '',
    currency: ''
  },
  itinerary: [],
  culturalDifferences: {},
  localTips: {},
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
