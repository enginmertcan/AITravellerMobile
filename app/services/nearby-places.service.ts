import * as Location from 'expo-location';
import { DEFAULT_SEARCH_RADIUS, MAX_SEARCH_RADIUS, MAX_API_RETRIES } from './config';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

// Yer türlerine göre filtreleme için anahtar kelimeler ve ilişkili Google Places API türleri
const TYPE_KEYWORDS = {
  'tourist_attraction': {
    keywords: ['turist', 'gezi', 'görülecek', 'anıt', 'heykel', 'tarihi', 'landmark', 'attraction'],
    relatedTypes: ['tourist_attraction', 'point_of_interest', 'landmark', 'monument']
  },
  'restaurant': {
    keywords: ['yemek', 'restoran', 'lokanta', 'food', 'dinner', 'restaurant', 'eatery'],
    relatedTypes: ['restaurant', 'food', 'meal_takeaway', 'meal_delivery']
  },
  'museum': {
    keywords: ['müze', 'sergi', 'kültür', 'sanat', 'tarih', 'museum', 'exhibition', 'gallery'],
    relatedTypes: ['museum', 'art_gallery']
  },
  'shopping_mall': {
    keywords: ['avm', 'mağaza', 'market', 'alışveriş', 'shopping', 'mall'],
    relatedTypes: ['shopping_mall', 'department_store', 'store', 'supermarket']
  },
  'lodging': {
    keywords: ['otel', 'hotel', 'konaklama', 'pansiyon', 'motel', 'lodging', 'accommodation'],
    relatedTypes: ['lodging', 'hotel', 'motel']
  },
  'park': {
    keywords: ['park', 'bahçe', 'yeşil alan', 'garden', 'nature'],
    relatedTypes: ['park', 'campground', 'natural_feature']
  },
  'cafe': {
    keywords: ['kafe', 'kahve', 'çay', 'coffee', 'cafe', 'tea'],
    relatedTypes: ['cafe', 'bakery', 'coffee_shop']
  },
  'bar': {
    keywords: ['bar', 'pub', 'gece hayatı', 'içki', 'nightlife', 'alcohol', 'beer', 'wine'],
    relatedTypes: ['bar', 'night_club', 'liquor_store']
  },
  'bakery': {
    keywords: ['fırın', 'pastane', 'ekmek', 'bakery', 'pasta', 'bread', 'cake'],
    relatedTypes: ['bakery', 'food', 'store']
  },
};

export interface NearbyPlace {
  id: string;
  name: string;
  vicinity: string;
  distance?: number;  // Kullanıcı konumuna olan mesafe (metre cinsinden)
  rating?: number;    // Yer puanı (5 üzerinden)
  types?: string[];   // Yer türleri
  photos?: string[];  // Fotoğraf URL'leri
  geometry: {
    location: {
      lat: number;    // Enlem
      lng: number;    // Boylam
    }
  };
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * İki nokta arasındaki mesafeyi hesaplar (Haversine formülü)
 * @param lat1 Başlangıç noktası enlemi
 * @param lon1 Başlangıç noktası boylamı
 * @param lat2 Bitiş noktası enlemi
 * @param lon2 Bitiş noktası boylamı
 * @returns Metre cinsinden mesafe
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Dünya'nın yarıçapı (metre)
  const φ1 = lat1 * Math.PI / 180; // φ, λ radyan cinsinden
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metre cinsinden
};

/**
 * Yerleri puan ve mesafeye göre sıralar
 * @param places Sıralanacak yerler listesi
 * @returns Sıralanmış yerler listesi
 */
const sortPlaces = (places: NearbyPlace[]): NearbyPlace[] => {
  return places.sort((a, b) => {
    // Önce puanı yüksek olanlar
    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }

    // Puanlar eşitse, yakın olanlar
    return (a.distance || 0) - (b.distance || 0);
  });
};

/**
 * Google Places API'den gelen sonuçları belirli bir türe göre filtreler
 * @param places API'den gelen yerler listesi
 * @param type Filtrelenecek yer türü
 * @returns Filtrelenmiş yerler listesi
 */
const filterPlacesByType = (places: any[], type: string): any[] => {
  // Eğer hiç yer yoksa, boş dizi döndür
  if (!places || places.length === 0) {
    console.log('Filtrelenecek yer bulunamadı.');
    return [];
  }

  console.log(`Filtreleme başlıyor: ${places.length} yer ${type} türüne göre filtreleniyor...`);

  // ÇOK SIKI FİLTRELEME - SADECE TAM EŞLEŞEN TÜRLERİ KABUL ET
  // Doğrudan tür eşleşmesi olan yerleri bul (en güvenilir)
  const exactMatches = places.filter(place =>
    place.types && Array.isArray(place.types) && place.types.includes(type)
  );

  // Eğer doğrudan eşleşen yerler varsa, sadece onları döndür
  if (exactMatches.length > 0) {
    console.log(`Doğrudan tür eşleşmesi olan ${exactMatches.length} yer bulundu.`);
    return exactMatches;
  }

  // Doğrudan eşleşme yoksa, ilişkili türleri kontrol et
  if (TYPE_KEYWORDS[type]) {
    const { relatedTypes } = TYPE_KEYWORDS[type];

    const relatedMatches = places.filter(place =>
      place.types &&
      Array.isArray(place.types) &&
      place.types.some(t => relatedTypes.includes(t))
    );

    if (relatedMatches.length > 0) {
      console.log(`İlişkili tür eşleşmesi olan ${relatedMatches.length} yer bulundu.`);
      return relatedMatches;
    }
  }

  // Hiçbir eşleşme bulunamadıysa, boş dizi döndür
  console.log(`${type} türünde yer bulunamadı.`);
  return [];
};

/**
 * Kullanıcının mevcut konumunu alır
 */
export const getCurrentLocation = async (): Promise<LocationData> => {
  try {
    // Konum izinlerini kontrol et
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      console.error('Konum izni verilmedi. Status:', status);
      throw new Error('Konum izni verilmedi. Yakın yerleri görebilmek için konum izni vermeniz gerekiyor.');
    }

    // Konum servislerinin açık olup olmadığını kontrol et
    const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();

    if (!isLocationServicesEnabled) {
      console.error('Konum servisleri kapalı.');
      throw new Error('Konum servisleri kapalı. Lütfen cihazınızın konum servislerini açın.');
    }

    console.log('Konum alınıyor...');

    // Mevcut konumu al (daha uzun timeout ile)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,  // 5 saniye
      mayShowUserSettingsDialog: true  // Gerekirse kullanıcıya ayarlar dialogu göster
    });

    if (!location || !location.coords) {
      console.error('Geçerli konum bilgisi alınamadı.');
      throw new Error('Geçerli konum bilgisi alınamadı. Lütfen tekrar deneyin.');
    }

    console.log('Konum başarıyla alındı:',
      location.coords.latitude.toFixed(6),
      location.coords.longitude.toFixed(6),
      'Doğruluk:', location.coords.accuracy ? `${location.coords.accuracy.toFixed(0)}m` : 'bilinmiyor'
    );

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  } catch (error) {
    console.error('Konum alınamadı:', error);

    // Daha açıklayıcı hata mesajları
    if (error instanceof Error) {
      if (error.message.includes('Location request failed')) {
        throw new Error('Konum alınamadı. Lütfen konum servislerinin açık olduğundan emin olun.');
      } else if (error.message.includes('Location timed out')) {
        throw new Error('Konum alınırken zaman aşımı oluştu. Lütfen tekrar deneyin.');
      } else if (error.message.includes('Location provider is unavailable')) {
        throw new Error('Konum sağlayıcısı kullanılamıyor. Lütfen cihazınızın konum ayarlarını kontrol edin.');
      }
    }

    throw error;
  }
};

/**
 * Belirli bir konumun etrafındaki yerleri getirir
 * @param location Konum bilgisi (enlem, boylam)
 * @param radius Arama yarıçapı (metre cinsinden)
 * @param type Yer türü (restaurant, tourist_attraction, museum vb.)
 */
export const getNearbyPlaces = async (
  location: LocationData,
  radius: number = DEFAULT_SEARCH_RADIUS,
  type: string = 'tourist_attraction',
  retryCount: number = 0
): Promise<NearbyPlace[]> => {
  try {
    // API anahtarını al
    const apiKey = API_CONFIG.GOOGLE_PLACES;

    // API anahtarı durumunu kontrol et (güvenlik için tam anahtarı loglamıyoruz)
    if (apiKey) {
      console.log(`Google Places API anahtarı bulundu (${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)})`);
    } else {
      console.log('Google Places API anahtarı bulunamadı!');
    }

    // API anahtarı kontrolü
    if (!apiKey || apiKey.trim() === '') {
      console.error('Google Places API anahtarı bulunamadı veya boş!');
      console.error('Çevre değişkenleri doğru yüklenmiş mi kontrol edin.');
      console.error('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY çevre değişkeni tanımlanmış olmalıdır.');
      throw new Error('API anahtarı eksik. Lütfen .env dosyasını kontrol edin.');
    }

    // Alternatif API anahtarı kontrolü (geçici çözüm)
    if (apiKey === 'undefined' || apiKey === 'null') {
      console.error('API anahtarı geçersiz bir değer içeriyor:', apiKey);
      throw new Error('API anahtarı geçersiz. Lütfen .env dosyasını kontrol edin.');
    }

    // Kullanılacak arama yarıçapı
    const currentRadius = retryCount > 0 ? Math.min(radius * (retryCount + 1), MAX_SEARCH_RADIUS) : radius;

    console.log(`Arama yarıçapı: ${currentRadius} metre (${currentRadius/1000} km), Deneme: ${retryCount + 1}/${MAX_API_RETRIES + 1}`);

    // API URL oluştur
    // Daha iyi sonuçlar için rankby ve radius parametrelerini optimize edelim
    let url;

    // Tür bilgisini al
    const typeInfo = TYPE_KEYWORDS[type];

    // Turistik yerler ve müzeler için prominence (önem sırası) daha iyi sonuç verir
    if (type === 'tourist_attraction' || type === 'point_of_interest' || type === 'museum') {
      url = `${API_ENDPOINTS.GOOGLE_PLACES}/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${currentRadius}&type=${type}&rankby=prominence&key=${apiKey}`;
    }
    // Restoranlar, kafeler ve barlar için mesafe önemli
    else if (type === 'restaurant' || type === 'cafe' || type === 'bar' || type === 'bakery') {
      // Mesafeye göre sıralama yapıldığında, keyword parametresi gerekli
      const keyword = typeInfo ? typeInfo.keywords[0] : type;
      url = `${API_ENDPOINTS.GOOGLE_PLACES}/nearbysearch/json?location=${location.latitude},${location.longitude}&rankby=distance&type=${type}&keyword=${keyword}&key=${apiKey}`;
    }
    // Diğer tüm türler için hem radius hem de keyword kullan
    else {
      const keyword = typeInfo ? typeInfo.keywords[0] : type;
      url = `${API_ENDPOINTS.GOOGLE_PLACES}/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${currentRadius}&type=${type}&keyword=${keyword}&key=${apiKey}`;
    }

    console.log('API isteği yapılıyor:', url.replace(apiKey, 'API_KEY_HIDDEN'));

    // API isteği yap
    const response = await fetch(url);

    if (!response.ok) {
      console.error('API yanıtı başarısız:', response.status, response.statusText);

      // Yeniden deneme kontrolü
      if (retryCount < MAX_API_RETRIES) {
        console.log(`API isteği başarısız oldu. Yeniden deneniyor (${retryCount + 1}/${MAX_API_RETRIES})...`);
        return getNearbyPlaces(location, radius, type, retryCount + 1);
      }

      throw new Error(`API yanıtı başarısız: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // API yanıtını kontrol et
    console.log('Google Places API yanıtı alındı. Status:', data.status);

    // Detaylı hata ayıklama için
    if (data.results && data.results.length > 0) {
      console.log(`${data.results.length} sonuç bulundu.`);
    } else {
      console.log('Sonuç bulunamadı.');

      // Sonuç bulunamadıysa ve yeniden deneme hakkımız varsa, arama yarıçapını artırarak tekrar deneyelim
      if (retryCount < MAX_API_RETRIES) {
        console.log(`Sonuç bulunamadı. Arama yarıçapı artırılarak yeniden deneniyor (${retryCount + 1}/${MAX_API_RETRIES})...`);
        return getNearbyPlaces(location, radius, type, retryCount + 1);
      }
    }

    if (data.status !== 'OK') {
      // ZERO_RESULTS durumunda daha açıklayıcı hata mesajı
      if (data.status === 'ZERO_RESULTS') {
        console.error('Google Places API: Belirtilen konumun etrafında bu türde yer bulunamadı.');

        // Yeniden deneme kontrolü
        if (retryCount < MAX_API_RETRIES) {
          console.log(`Sonuç bulunamadı. Arama yarıçapı artırılarak yeniden deneniyor (${retryCount + 1}/${MAX_API_RETRIES})...`);
          return getNearbyPlaces(location, radius, type, retryCount + 1);
        }

        throw new Error(`Belirtilen konumun etrafında ${type} türünde yer bulunamadı.`);
      } else {
        console.error('Google Places API hatası:', data.status, data.error_message);

        // Yeniden deneme kontrolü (sadece belirli hata kodları için)
        if (retryCount < MAX_API_RETRIES &&
            (data.status === 'OVER_QUERY_LIMIT' || data.status === 'UNKNOWN_ERROR')) {
          console.log(`API hatası oluştu. Yeniden deneniyor (${retryCount + 1}/${MAX_API_RETRIES})...`);

          // Kısa bir bekleme süresi ekleyelim
          await new Promise(resolve => setTimeout(resolve, 1000));

          return getNearbyPlaces(location, radius, type, retryCount + 1);
        }

        throw new Error(`API hatası: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}`);
      }
    }

    // Sonuçları filtrele ve dönüştür
    const filteredResults = filterPlacesByType(data.results, type);

    // Sonuçları dönüştür
    const mappedResults = filteredResults.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      vicinity: place.vicinity,
      rating: place.rating || 0,
      types: place.types,
      photos: place.photos ? place.photos.map((photo: any) =>
        `${API_ENDPOINTS.GOOGLE_PLACES}/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${apiKey}`
      ) : [],
      geometry: place.geometry,
      // Kullanıcı konumuna olan mesafeyi hesapla (metre cinsinden)
      distance: calculateDistance(
        location.latitude,
        location.longitude,
        place.geometry.location.lat,
        place.geometry.location.lng
      )
    }));

    // Sonuçları sırala: Önce puan, sonra mesafe
    return sortPlaces(mappedResults);
  } catch (error) {
    console.error('Yakın yerler alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın turistik yerleri getirir
 */
export const getNearbyTouristAttractions = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    // Turistik yerler için arama yarıçapını artıralım (5000 metre = 5 km)
    try {
      return await getNearbyPlaces(location, 5000, 'tourist_attraction');
    } catch (error) {
      // Turistik yerler bulunamadıysa, alternatif olarak "point_of_interest" türünü deneyelim
      console.log('Turistik yerler bulunamadı, alternatif olarak ilgi çekici yerler aranıyor...');
      return await getNearbyPlaces(location, 5000, 'point_of_interest');
    }
  } catch (error) {
    console.error('Yakın turistik yerler alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın restoranları getirir
 */
export const getNearbyRestaurants = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 1500, 'restaurant');
  } catch (error) {
    console.error('Yakın restoranlar alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın müzeleri getirir
 */
export const getNearbyMuseums = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 3000, 'museum');
  } catch (error) {
    console.error('Yakın müzeler alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın alışveriş merkezlerini getirir
 */
export const getNearbyShoppingMalls = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 3000, 'shopping_mall');
  } catch (error) {
    console.error('Yakın alışveriş merkezleri alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın ilgi çekici yerleri getirir
 */
export const getNearbyPointsOfInterest = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 5000, 'point_of_interest');
  } catch (error) {
    console.error('Yakın ilgi çekici yerler alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın parkları getirir
 */
export const getNearbyParks = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 3000, 'park');
  } catch (error) {
    console.error('Yakın parklar alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın kafeleri getirir
 */
export const getNearbyCafes = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 2000, 'cafe');
  } catch (error) {
    console.error('Yakın kafeler alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın otelleri getirir
 */
export const getNearbyHotels = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 3000, 'lodging');
  } catch (error) {
    console.error('Yakın oteller alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın barları getirir
 */
export const getNearbyBars = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 2000, 'bar');
  } catch (error) {
    console.error('Yakın barlar alınamadı:', error);
    throw error;
  }
};

/**
 * Kullanıcının mevcut konumuna göre yakın fırınları getirir
 */
export const getNearbyBakeries = async (): Promise<NearbyPlace[]> => {
  try {
    const location = await getCurrentLocation();
    return getNearbyPlaces(location, 2000, 'bakery');
  } catch (error) {
    console.error('Yakın fırınlar alınamadı:', error);
    throw error;
  }
};
