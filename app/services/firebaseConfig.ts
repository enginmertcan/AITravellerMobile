// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Auth sorunlu olduğu için şimdilik çıkarttık
// import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import Constants from "expo-constants";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBGux1bZhFmmuNQDvGr2CDsUxIrHF1pFhU", // Önce Constants, sonra process.env, son olarak yedek
  authDomain: "ai-traveller-67214.firebaseapp.com",
  projectId: "ai-traveller-67214",
  storageBucket: "ai-traveller-67214.firebasestorage.app",
  messagingSenderId: "151291844199",
  appId: "1:151291844199:web:45fcc2574f5c1d3453a6c2",
  measurementId: "G-W93HDHGMR1",
};

// Initialize Firebase - check if already initialized to avoid multiple instances
let app: any = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp(); // Eğer zaten initialize edilmişse mevcut app'i kullan
  }

  // API anahtarı kontrolü
  if (!firebaseConfig.apiKey) {
    console.error('Firebase API anahtarı bulunamadı! Environment değişkenleri kontrol edin.');
    throw new Error('Firebase API anahtarı bulunamadı!');
  }
} catch (error) {
  // Hata durumunda varsayılan bir uygulama oluşturmayı deneyelim
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
  }
}

// App önceden oluşturulduğundan emin olalım
if (!app) {
  app = initializeApp(firebaseConfig);
}

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Auth - şimdilik devre dışı bıraktık
// export const auth = getAuth(app);

// Initialize Firebase Storage with explicit bucket URL
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

// Export Firebase app instance for other services
export default app;

// Expo Router için gerekli boş component
export function FirebaseConfigComponent() {
  return null;
}
