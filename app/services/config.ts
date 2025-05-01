import Constants from 'expo-constants';

// API anahtarları
export const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
export const VISUAL_CROSSING_API_KEY = Constants.expoConfig?.extra?.weatherApiKey || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

// Diğer yapılandırma değerleri
export const DEFAULT_SEARCH_RADIUS = 5000; // metre cinsinden (5 km)
export const MAX_SEARCH_RADIUS = 10000; // maksimum arama yarıçapı (10 km)
export const MAX_API_RETRIES = 2; // API isteklerini yeniden deneme sayısı
