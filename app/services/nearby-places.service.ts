import * as Location from 'expo-location';
import { DEFAULT_SEARCH_RADIUS } from './config';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

export interface NearbyPlace {
  id: string;
  name: string;
  vicinity: string;
  distance?: number;
  rating?: number;
  types?: string[];
  photos?: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    }
  };
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Kullanıcının mevcut konumunu alır
 */
export const getCurrentLocation = async (): Promise<LocationData> => {
  try {
    // Konum izinlerini kontrol et
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error('Konum izni verilmedi');
    }

    // Mevcut konumu al
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  } catch (error) {
    console.error('Konum alınamadı:', error);
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
  type: string = 'tourist_attraction'
): Promise<NearbyPlace[]> => {
  try {
    const apiKey = API_CONFIG.GOOGLE_PLACES;
    console.log('Using Google Places API Key:', apiKey);

    // API URL oluştur
    const url = `${API_ENDPOINTS.GOOGLE_PLACES}/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${radius}&type=${type}&key=${apiKey}`;

    // API isteği yap
    const response = await fetch(url);
    const data = await response.json();

    // API yanıtını kontrol et
    console.log('Google Places API yanıtı:', JSON.stringify(data, null, 2));

    if (data.status !== 'OK') {
      // ZERO_RESULTS durumunda daha açıklayıcı hata mesajı
      if (data.status === 'ZERO_RESULTS') {
        console.error('Google Places API: Belirtilen konumun etrafında bu türde yer bulunamadı.');
        throw new Error(`Belirtilen konumun etrafında ${type} türünde yer bulunamadı.`);
      } else {
        console.error('Google Places API hatası:', data.status, data.error_message);
        throw new Error(`API hatası: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}`);
      }
    }

    // Sonuçları dönüştür
    return data.results.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      vicinity: place.vicinity,
      rating: place.rating,
      types: place.types,
      photos: place.photos ? place.photos.map((photo: any) =>
        `${API_ENDPOINTS.GOOGLE_PLACES}/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${apiKey}`
      ) : [],
      geometry: place.geometry,
    }));
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
