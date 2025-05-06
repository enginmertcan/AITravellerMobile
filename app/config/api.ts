// API anahtarları .env dosyasından alınıyor
// Expo'da çevre değişkenleri EXPO_PUBLIC_ öneki ile tanımlanmalıdır

import Constants from 'expo-constants';

// API anahtarlarını çevre değişkenlerinden al
export const API_CONFIG = {
  GOOGLE_MAPS: Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  GOOGLE_PLACES: Constants.expoConfig?.extra?.googlePlacesApiKey || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
  OPENWEATHER: Constants.expoConfig?.extra?.openWeatherApiKey || process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '',
  VISUAL_CROSSING: Constants.expoConfig?.extra?.weatherApiKey || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
  OPENAI: Constants.expoConfig?.extra?.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
  RESEND: Constants.expoConfig?.extra?.resendApiKey || process.env.EXPO_PUBLIC_RESEND_API_KEY || '',
};

export const API_ENDPOINTS = {
  GOOGLE_MAPS: 'https://maps.googleapis.com',
  GOOGLE_PLACES: 'https://maps.googleapis.com/maps/api/place',
  OPENWEATHER: 'https://api.openweathermap.org/data/2.5',
  VISUAL_CROSSING: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services',
  RESEND: 'https://api.resend.com',
  OPENAI: 'https://api.openai.com/v1',
};

const apiConfig = {
  API_CONFIG,
  API_ENDPOINTS
};

// JSX component for Expo Router
function ApiConfigComponent() {
  return null;
}

// Default ve named exports
ApiConfigComponent.API_CONFIG = API_CONFIG;
ApiConfigComponent.API_ENDPOINTS = API_ENDPOINTS;

export default apiConfig;