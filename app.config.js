// app.config.js - Bu dosya ile environment değişkenlerini daha iyi yönetebilirsiniz
const path = require('path');
const dotenv = require('dotenv');

// .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Çevre değişkenlerini kontrol et
console.log('Çevre değişkenleri yükleniyor...');
console.log('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY:', process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ? 'Mevcut' : 'Eksik');
console.log('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:', process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Mevcut' : 'Eksik');

module.exports = {
  name: "AITravellerMobile",
  slug: "AITravellerMobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "aitravellermobile",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    }
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff"
      }
    ],
    "expo-secure-store"
  ],
  experiments: {
    typedRoutes: true
  },
  // Environment değişkenleri burada tanımlanır
  extra: {
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    weatherApiKey: process.env.EXPO_PUBLIC_WEATHER_API_KEY,
    openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    openWeatherApiKey: process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY,
    resendApiKey: process.env.EXPO_PUBLIC_RESEND_API_KEY,
    eas: {
      projectId: "your-project-id"
    }
  }
};
