// API anahtarları .env dosyasından alınıyor
// Expo'da çevre değişkenleri EXPO_PUBLIC_ öneki ile tanımlanmalıdır

import Constants from 'expo-constants';

export const API_CONFIG = {
  GOOGLE_MAPS: Constants.expoConfig?.extra?.googleMapsApiKey || '',
  OPENWEATHER: Constants.expoConfig?.extra?.openWeatherApiKey || '',
  VISUAL_CROSSING: Constants.expoConfig?.extra?.weatherApiKey || '',
  OPENAI: Constants.expoConfig?.extra?.openaiApiKey || '',
  RESEND: Constants.expoConfig?.extra?.resendApiKey || '',
};

export const API_ENDPOINTS = {
  GOOGLE_MAPS: 'https://maps.googleapis.com',
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

export default ApiConfigComponent;