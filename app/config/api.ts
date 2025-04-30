// API anahtarları .env dosyasından alınıyor
// Expo'da çevre değişkenleri EXPO_PUBLIC_ öneki ile tanımlanmalıdır

import Constants from 'expo-constants';

export const API_CONFIG = {
  GOOGLE_MAPS: 'AIzaSyCP-WHzK8XQXT_ThNQ5g5oNVXqNMtZ4cOg',
  GEMINI: 'AIzaSyA7U8nOp60TreFZ5g9CJ3zloEFheLHkOes',
  OPENWEATHER: '825ea120647b5af2d604e6c801967453',
  VISUAL_CROSSING: Constants.expoConfig?.extra?.weatherApiKey || 'NRZST2X7EPA8LCP8BDHB2XGYY',
  OPENAI: Constants.expoConfig?.extra?.openaiApiKey || '',
  RESEND: 're_QAjLr3Yj_Cd9JY7XuLSsxnTvi9yiJa9ZH',
  MONGODB_URI: 'mongodb+srv://enginmertcan:1q2w3e4r5t@cluster0.l82nk.mongodb.net/ai-traveller?retryWrites=true&w=majority',
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