import Constants from 'expo-constants';

// API anahtarları
export const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyCuywyLDcnyRENGnIHnit-ym2rhQBnXMJw';
export const VISUAL_CROSSING_API_KEY = Constants.expoConfig?.extra?.weatherApiKey || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

// Diğer yapılandırma değerleri
export const DEFAULT_SEARCH_RADIUS = 2000; // metre cinsinden
