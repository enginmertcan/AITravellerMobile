import { AI_PROMPT } from '../constants/options';
import Constants from 'expo-constants';
import { DEFAULT_TRAVEL_PLAN, TravelPlan } from '../types/travel';
import { parseGeminiResponse } from './travel-parser';

// API anahtarını .env dosyasından veya Constants'tan al
const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey || 'AIzaSyA7U8nOp60TreFZ5g9CJ3zloEFheLHkOes';

// Gemini API yapılandırması
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

// Not: Bu paket kurulmalıdır: npm install @google/generative-ai

// AI isteklerinde kullanılacak istek şablonu
const getPromptTemplate = (destination: string, duration: number, groupType: string, budget: string, residenceCountry: string, citizenship: string, startDate: string = '') => {
  return `ÖNEMLİ: Tüm yanıtlarınız kesinlikle Türkçe olmalıdır. İngilizce yanıt vermeyin.

Aşağıdaki seyahat planını oluştur ve şu kurallara uy:

1. Tüm metinler Türkçe olmalı
2. Para birimleri TL olmalı
3. Mesafe ve süre birimleri metrik sistemde olmalı
4. Her aktivite için aşağıdaki bilgiler olmalı:
   - Aktivite adı (placeName)
   - Detaylı açıklama (placeDetails)
   - Görsel URL (placeImageUrl)
   - Konum bilgisi (geoCoordinates)
   - Bilet/giriş ücreti (ticketPricing)
   - Ulaşım süresi (timeToTravel)
   - Önerilen ziyaret zamanı (time)
   - Tavsiyeler (tips) - En az 3 madde
   - Dikkat edilmesi gerekenler (warnings) - Varsa
   - Alternatif aktiviteler (alternatives) - Varsa

5. Her otel için aşağıdaki bilgiler olmalı:
   - Otel adı (hotelName)
   - Adres (hotelAddress)
   - Fiyat aralığı (price)
   - Görsel URL (hotelImageUrl)
   - Konum (geoCoordinates)
   - Puan (rating)
   - Açıklama (description)
   - En iyi ziyaret zamanı (bestTimeToVisit)
   - Öne çıkan özellikler (features) - En az 3 madde
   - Yakın çevre bilgisi (surroundings)

6. Her gün için aktiviteler mantıklı bir sırayla planlanmalı
7. Aktiviteler arası ulaşım süreleri ve dinlenme molaları hesaba katılmalı
8. Her aktivite için pratik tavsiyeler ve ipuçları eklenmeli
9. Yerel deneyimler ve kültürel öğeler vurgulanmalı
10. Bütçeye uygun alternatifler sunulmalı

11. Vize ve Pasaport Bilgileri (ZORUNLU):
    - Vize gerekliliği ve türü (visaRequirement)
    - Vize başvuru süreci detayları (visaApplicationProcess)
    - Gerekli belgeler listesi (requiredDocuments)
    - Vize ücreti (visaFee)
    - Vize başvuru süresi (visaProcessingTime)
    - Vize başvuru merkezi bilgileri (visaApplicationCenters)
    - Pasaport gereksinimleri (passportRequirements)
    - Pasaport geçerlilik süresi gereksinimleri (passportValidityRequirements)
    - Önemli notlar ve uyarılar (importantNotes)
    - Acil durumlar için iletişim bilgileri (emergencyContacts)

12. Kültürel Farklılıklar ve Öneriler (ZORUNLU):
    - Yaşanılan ülke ile hedef ülke arasındaki temel kültürel farklılıklar (culturalDifferences)
    - Günlük yaşam alışkanlıkları farklılıkları (lifestyleDifferences)
    - Yeme-içme kültürü farklılıkları (foodCultureDifferences)
    - Sosyal davranış normları farklılıkları (socialNormsDifferences)
    - Dini ve kültürel hassasiyetler (religiousAndCulturalSensitivities)
    - Yerel gelenekler ve görenekler (localTraditionsAndCustoms)
    - Önemli kültürel etkinlikler ve festivaller (culturalEventsAndFestivals)
    - Yerel halkla iletişim önerileri (localCommunicationTips)

13. Yerel Yaşam Önerileri (ZORUNLU):
    - Yerel ulaşım sistemini kullanma rehberi (localTransportationGuide)
    - Önemli acil durum numaraları (emergencyContacts)
    - Yerel para birimi ve ödeme yöntemleri (currencyAndPayment)
    - Sağlık hizmetleri bilgisi (healthcareInfo)
    - İletişim ve internet kullanımı (communicationInfo)
    - Yerel mutfak ve yemek önerileri (localCuisineAndFoodTips)
    - Güvenlik önerileri (safetyTips)
    - Yerel dil ve iletişim ipuçları (localLanguageAndCommunicationTips)

Lütfen bu seyahat planını JSON formatında oluştur:
Konum: ${destination}
Süre: ${duration} gün
Kişi: ${groupType}
Bütçe: ${budget}
Yaşadığı Ülke: ${residenceCountry}
Vatandaşlık: ${citizenship}
${startDate ? `Başlangıç Tarihi: ${startDate}` : ''}

Yanıtın kesinlikle JSON olmalıdır ve aşağıdaki alanları içermelidir:
- destinationInfo (destinasyon hakkında genel bilgiler)
- tripSummary (seyahat özeti)
- hotelOptions (en az 3 otel önerisi)
- itinerary (günlük gezi planı)
- visaInfo (vize ve pasaport bilgileri)
- culturalDifferences (kültürel farklılıklar)
- localTips (yerel yaşam önerileri)

NOT: Tüm yanıtınız Türkçe olmalıdır. İngilizce yanıt vermeyin.
NOT: Vize, pasaport ve kültürel öneriler bölümleri zorunludur ve detaylı olmalıdır.
NOT: SADECE JSON döndür, ekstra metin veya açıklama ekleme.`;
};

// Chat session API'si
export const chatSession = {
  async sendMessage(message: string) {
    try {
      console.log('AI servisi mesajı gönderiyor:', message);
      
      // Parametreleri mesajdan çıkar
      const destination = message.match(/Konum: (.*?)\n/)?.[1] || 'Paris';
      const duration = message.match(/Süre: (\d+)/)?.[1] || '3';
      const groupType = message.match(/Kişi: (.*?)\n/)?.[1] || 'Çift';
      const budget = message.match(/Bütçe: (.*?)\n/)?.[1] || 'Ekonomik';
      const residenceCountry = message.match(/Yaşadığı Ülke: (.*?)\n/)?.[1] || 'Turkey';
      const citizenship = message.match(/Vatandaşlık: (.*?)\n/)?.[1] || 'Turkey';
      const startDate = message.match(/Başlangıç Tarihi: (.*?)\n/)?.[1] || '';
      
      // Prompt'u oluştur
      const prompt = getPromptTemplate(
        destination, 
        parseInt(duration), 
        groupType, 
        budget, 
        residenceCountry, 
        citizenship,
        startDate
      );
      
      console.log('AI isteği hazırlandı');
      
      // Gemini API'yi çağırmadan önce paket yüklenmiş olmalıdır
      // npm install @google/generative-ai --save
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        
        // Gemini modelini başlat
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash", // veya "gemini-pro"
          generationConfig,
        });
        
        // AI'ya isteği gönder
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        console.log('AI yanıtı alındı');
        
        // TravelPlan formatına dönüştür
        const travelPlan = parseGeminiResponse(responseText);
        
        // JSON string olarak döndür
        return {
          response: {
            text: responseText,
            travelPlan: travelPlan
          }
        };
      } catch (apiError) {
        console.error('Gemini API hatası:', apiError);
        
        // API hata verirse örnek yanıt döndür
        console.log('AI hatası! Örnek yanıt kullanılıyor...');
        
        // Örnek yanıt
        const exampleResponse = `
        {
          "destinationInfo": {
            "name": "${destination}",
            "country": "Fransa",
            "bestTimeToVisit": "Nisan-Ekim arası",
            "language": "Fransızca",
            "timezone": "GMT+1",
            "currency": "Euro (EUR)"
          },
          "tripSummary": {
            "duration": ${duration},
            "travelers": "${groupType}",
            "budget": "${budget}",
            "startingPoint": "${residenceCountry}",
            "citizenship": "${citizenship}"
          },
          "hotelOptions": [
            {
              "hotelName": "Hôtel du Louvre",
              "hotelAddress": "Place André Malraux, 75001 Paris, Fransa",
              "price": "3000 TL - 5000 TL/gece",
              "hotelImageUrl": "https://example.com/hotel-du-louvre.jpg",
              "geoCoordinates": {
                "latitude": 48.8632,
                "longitude": 2.3356
              },
              "rating": 4.5,
              "description": "Louvre Müzesi'ne yakın, tarihi bir binada yer alan 4 yıldızlı lüks otel."
            },
            {
              "hotelName": "Ibis Paris Montmartre",
              "hotelAddress": "5 Rue Caulaincourt, 75018 Paris, Fransa",
              "price": "1500 TL - 2500 TL/gece",
              "hotelImageUrl": "https://example.com/ibis-paris.jpg",
              "geoCoordinates": {
                "latitude": 48.8868,
                "longitude": 2.3301
              },
              "rating": 3.8,
              "description": "Montmartre bölgesinde yer alan, uygun fiyatlı ve konforlu bir otel."
            }
          ],
          "itinerary": [
            {
              "day": "1. Gün",
              "plan": [
                {
                  "time": "09:00 - 12:00",
                  "placeName": "Eyfel Kulesi",
                  "placeDetails": "Paris'in simgesi olan 324 metre yüksekliğindeki ünlü çelik kule.",
                  "placeImageUrl": "https://example.com/eiffel-tower.jpg",
                  "geoCoordinates": {
                    "latitude": 48.8584,
                    "longitude": 2.2945
                  },
                  "ticketPricing": "600 TL",
                  "timeToTravel": "30 dakika"
                }
              ]
            }
          ],
          "visaInfo": {
            "visaRequirement": "Schengen Vizesi gerekli",
            "visaApplicationProcess": "Fransız Konsolosluğu veya yetkili vize başvuru merkezine başvuru yapılmalıdır.",
            "requiredDocuments": ["Pasaport", "Vize başvuru formu", "Fotoğraf", "Seyahat sigortası", "Konaklama bilgileri", "Uçak bileti rezervasyonu", "Banka hesap dökümü"],
            "visaFee": "900 TL"
          },
          "culturalDifferences": {
            "foodCultureDifferences": "Fransa'da yemekler geç saatlerde yenir, akşam yemeği genellikle 19:30-21:00 arası başlar.",
            "socialNormsDifferences": "Karşılaşmalarda yanaktan öpmek yaygındır ve günlük selamlaşmalarda nezaket çok önemlidir."
          },
          "localTips": {
            "transportation": "Metro, Paris'te dolaşmanın en ekonomik ve hızlı yoludur. Günlük veya haftalık bilet alın.",
            "safety": "Tourist dolandırıcılıklarına dikkat edin, özellikle kalabalık turistik bölgelerde."
          }
        }
        `;
        
        // Örnek yanıtı parse et
        const travelPlan = parseGeminiResponse(exampleResponse);
        
        return {
          response: {
            text: exampleResponse,
            travelPlan: travelPlan
          }
        };
      }
    } catch (error) {
      console.error('AI mesajı gönderme hatası:', error);
      throw error;
    }
  },
  
  // Seyahat planı oluşturma fonksiyonu (yeni eklenen)
  async createTravelPlan(formData: any): Promise<Partial<TravelPlan>> {
    try {
      // Formatı Gemini AI için hazırla
      const budgetText = formData.budget === 'low' ? 'Ekonomik' : 
                        formData.budget === 'medium' ? 'Orta' : 'Lüks';
      
      const companionText = formData.companion === 'alone' ? 'Yalnız' : 
                          formData.companion === 'couple' ? 'Çift' : 'Aile/Grup';
      
      // Tarihi Türkçe formatla
      const formattedDate = formData.startDate ? new Date(formData.startDate).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) : '';
      
      // Mesaj formatı
      const message = `Konum: ${formData.city || formData.destination}
Süre: ${formData.days} gün
Kişi: ${companionText}
Bütçe: ${budgetText}
Yaşadığı Ülke: ${formData.residenceCountry}
Vatandaşlık: ${formData.citizenship}
Başlangıç Tarihi: ${formattedDate}`;
      
      // AI'ye gönder
      const result = await this.sendMessage(message);
      
      // TravelPlan formatında döndür
      if (result?.response?.travelPlan) {
        return {
          ...result.response.travelPlan,
          id: formData.id || '',
          destination: formData.city || formData.destination || '',
          startDate: formData.startDate || '',
          days: formData.days || 0,
          isDomestic: formData.isDomestic || false,
          userId: formData.userId || '',
        };
      }
      
      // Eğer travelPlan yoksa, ham yanıtı parse et
      return parseGeminiResponse(result?.response?.text || '');
    } catch (error) {
      console.error('Seyahat planı oluşturma hatası:', error);
      // Hata durumunu kaydet
      return { 
        ...DEFAULT_TRAVEL_PLAN, 
        destination: 'Hata oluştu',
        itinerary: { errorMessage: 'Seyahat planı oluşturulamadı' }
      };
    }
  }
};

// Not: Bu dosya sadece servis işlevine sahiptir, React component değildir.
// Standalone utility functions
export {
  getPromptTemplate,
  parseGeminiResponse
};