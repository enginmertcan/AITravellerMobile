import Constants from 'expo-constants';
import { DEFAULT_TRAVEL_PLAN } from '../types/travel';
import { parseGeminiResponse, parseOpenAIResponse } from './travel-parser';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { API_CONFIG } from '../config/api';
import OpenAI from 'openai';

// API anahtarlarını al
const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey || 'AIzaSyA7U8nOp60TreFZ5g9CJ3zloEFheLHkOes';
const OPENAI_API_KEY = API_CONFIG.OPENAI;

// Gemini API yapılandırması
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

// Gemini AI modelini başlat
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Gemini modelini başlat
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig,
});

// OpenAI istemcisini başlat
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Expo'da çalışması için gerekli
});

// AI isteklerinde kullanılacak istek şablonu
const getPromptTemplate = (destination: string, duration: number, groupType: string, budget: string, residenceCountry: string, citizenship: string, startDate: string = '') => {
  // Gün sayısını kontrol et ve geçerli bir değer olduğundan emin ol
  const days = !isNaN(duration) && duration > 0 ? duration : 3;

  console.log(`Prompt oluşturuluyor: Destinasyon=${destination}, Gün=${days}, Tarih=${startDate}`);

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
Süre: ${days} gün
Kişi: ${groupType}
Bütçe: ${budget}
Yaşadığı Ülke: ${residenceCountry}
Vatandaşlık: ${citizenship}
${startDate ? `Başlangıç Tarihi: ${startDate}` : ''}

ÖNEMLİ: Tam olarak ${days} günlük bir plan oluştur. Daha az veya daha fazla gün için değil, tam olarak ${days} gün için plan yap.

UYARI: İtinerary dizisi tam olarak ${days} gün içermelidir. Her gün için ayrı bir plan oluşturulmalıdır. Eksik gün olmamalıdır.

ÖRNEK FORMAT:
"itinerary": [
  { "day": "1. Gün", "plan": [...] },
  { "day": "2. Gün", "plan": [...] },
  ...
  { "day": "${days}. Gün", "plan": [...] }
]

Yanıtın kesinlikle JSON olmalıdır ve aşağıdaki alanları içermelidir:
- destinationInfo (destinasyon hakkında genel bilgiler, MUTLAKA bestTimeToVisit alanı içermeli)
- tripSummary (seyahat özeti)
- hotelOptions (en az 3 otel önerisi)
- itinerary (günlük gezi planı - tam olarak ${days} gün için)
- visaInfo (vize ve pasaport bilgileri)
- culturalDifferences (kültürel farklılıklar)
- localTips (yerel yaşam önerileri)
- bestTimeToVisit (destinasyon için en uygun ziyaret zamanı - ZORUNLU ALAN)

NOT: Tüm yanıtınız Türkçe olmalıdır. İngilizce yanıt vermeyin.
NOT: Vize, pasaport ve kültürel öneriler bölümleri zorunludur ve detaylı olmalıdır.
NOT: SADECE JSON döndür, ekstra metin veya açıklama ekleme.`;
};

// Chat session oluştur - Web uygulamasıyla aynı yapıda
const geminiChatSession = model.startChat({
  generationConfig,
  history: [
    {
      role: "user",
      parts: [
        {
          text: `ÖNEMLİ: Tüm yanıtlarınız kesinlikle Türkçe olmalıdır. İngilizce yanıt vermeyin.

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
Konum: {destination}
Süre: {duration} gün
Kişi: {groupType}
Bütçe: {budget}
Yaşadığı Ülke: {residenceCountry}
Vatandaşlık: {citizenship}

NOT: Tüm yanıtınız Türkçe olmalıdır. İngilizce yanıt vermeyin.
NOT: Vize, pasaport ve kültürel öneriler bölümleri zorunludur ve detaylı olmalıdır.`
        },
      ],
    },
    {
      role: "model",
      parts: [
        {
          text: '```json\n{\n  "hotelOptions": [\n    {\n      "hotelName": "The D Las Vegas",\n      "hotelAddress": "301 Fremont Street, Las Vegas, NV 89101",\n      "price": "1500 TL - 3000 TL gece",\n      "hotelImageUrl": "https://www.the-d.com/media/images/hotel-exterior.jpg",\n      "geoCoordinates": {\n        "latitude": 36.1699,\n        "longitude": -115.1426\n      },\n      "rating": 4.0,\n      "description": "Fremont Street\'in kalbinde yer alan, kumarhane, restoranlar ve canlı eğlence sunan uygun fiyatlı bir otel."\n    }\n  ],\n  "itinerary": [\n    {\n      "day": "1. Gün",\n      "plan": [\n        {\n          "time": "09:00 - 12:00",\n          "placeName": "Fremont Street Deneyimi",\n          "placeDetails": "Canlı eğlence, sokak sanatçıları ve ışık şovlarıyla dolu yaya alanını keşfedin.",\n          "placeImageUrl": "https://www.vegasexperience.com/sites/default/files/images/freemont-street-experience-las-vegas-header-image.jpg",\n          "geoCoordinates": {\n            "latitude": 36.1699,\n            "longitude": -115.1426\n          },\n          "ticketPricing": "Ücretsiz",\n          "timeToTravel": "1 saat"\n        }\n      ]\n    }\n  ],\n  "visaInfo": {\n    "visaRequirement": "Amerikan Vizesi gerekli",\n    "visaApplicationProcess": "ABD Büyükelçiliği veya Konsolosluğu\'na başvuru yapılmalıdır.",\n    "requiredDocuments": ["Pasaport", "DS-160 formu", "Fotoğraf", "Randevu onayı", "Ücret ödeme makbuzu"],\n    "visaFee": "3000 TL"\n  },\n  "culturalDifferences": {\n    "foodCultureDifferences": "Amerika\'da porsiyonlar genellikle büyüktür ve bahşiş kültürü yaygındır.",\n    "socialNormsDifferences": "Amerikalılar genellikle daha samimi ve açık sözlüdür."\n  },\n  "localTips": {\n    "transportation": "Las Vegas\'ta taksi ve Uber yaygın olarak kullanılır.",\n    "safety": "Değerli eşyalarınızı güvende tutun ve kalabalık alanlarda dikkatli olun."\n  }\n}\n```'
        },
      ],
    },
  ],
});

// Yardımcı fonksiyonlar
export const aiService = {
  async sendMessage(message: string) {
    try {
      // Parametreleri mesajdan çıkar
      const destination = message.match(/Konum: (.*?)\n/)?.[1] || 'Paris';
      const duration = message.match(/Süre: (\d+)/)?.[1] || '3';
      const groupType = message.match(/Kişi: (.*?)\n/)?.[1] || 'Çift';
      const budget = message.match(/Bütçe: (.*?)\n/)?.[1] || 'Ekonomik';
      const residenceCountry = message.match(/Yaşadığı Ülke: (.*?)\n/)?.[1] || 'Turkey';
      const citizenship = message.match(/Vatandaşlık: (.*?)\n/)?.[1] || 'Turkey';
      const startDate = message.match(/Başlangıç Tarihi: (.*?)\n/)?.[1] || '';

      // Prompt'u oluştur
      // Gün sayısını doğru şekilde parse et
      let days = 3; // Varsayılan değer
      if (duration) {
        if (!isNaN(parseInt(duration))) {
          days = parseInt(duration);
        } else {
          console.warn('Geçersiz süre formatı, varsayılan değer (3 gün) kullanılıyor:', duration);
        }
      }

      console.log('AI prompt için kullanılan gün sayısı:', days);
      console.log('AI prompt için kullanılan tarih:', startDate);

      const prompt = getPromptTemplate(
        destination,
        days,
        groupType,
        budget,
        residenceCountry,
        citizenship,
        startDate
      );

      try {
        // Önce OpenAI API'yi dene
        console.log('OpenAI API ile seyahat planı oluşturuluyor...');

        // OpenAI API'ye istek gönder
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Sen bir seyahat asistanısın. Kullanıcının istediği seyahat planını JSON formatında oluşturmalısın. Tüm yanıtların Türkçe olmalı.

Web ve mobil uygulamalarıyla uyumlu olması için aşağıdaki formatta JSON döndürmelisin:

{
  "bestTimeToVisit": "Destinasyon için en uygun ziyaret zamanı (ZORUNLU ALAN)",
  "destinationInfo": {
    "location": "Konum bilgisi",
    "description": "Destinasyon açıklaması",
    "bestTimeToVisit": "En iyi ziyaret zamanı (ZORUNLU ALAN)",
    "language": "Konuşulan dil",
    "timezone": "Saat dilimi",
    "currency": "Para birimi"
  },
  "hotelOptions": [
    {
      "hotelName": "Otel Adı",
      "hotelAddress": "Adres",
      "price": "Fiyat aralığı",
      "hotelImageUrl": "URL",
      "geoCoordinates": { "latitude": 36.1685, "longitude": -115.1426 },
      "rating": 3.5,
      "description": "Açıklama",
      "bestTimeToVisit": "En iyi ziyaret zamanı",
      "features": ["Özellik 1", "Özellik 2", "Özellik 3"],
      "surroundings": "Çevre bilgisi"
    }
  ],
  "itinerary": [
    {
      "day": "1. Gün: Başlık",
      "plan": [
        {
          "time": "10:00 - 12:00",
          "placeName": "Yer adı",
          "placeDetails": "Detaylar",
          "placeImageUrl": "URL",
          "geoCoordinates": { "latitude": 36.1699, "longitude": -115.1426 },
          "ticketPricing": "Ücret",
          "timeToTravel": "Ulaşım süresi",
          "tips": ["İpucu 1", "İpucu 2", "İpucu 3"],
          "warnings": ["Uyarı 1"],
          "alternatives": ["Alternatif 1"]
        }
      ]
    }
  ],
  "visaInfo": {
    "visaRequirement": "Vize gerekliliği",
    "visaApplicationProcess": "Vize başvuru süreci",
    "requiredDocuments": ["Belge 1", "Belge 2"],
    "visaFee": "Vize ücreti",
    "visaProcessingTime": "İşlem süresi",
    "visaApplicationCenters": ["Merkez 1", "Merkez 2"],
    "passportRequirements": "Pasaport gereksinimleri",
    "passportValidityRequirements": "Geçerlilik süresi",
    "importantNotes": "Önemli notlar",
    "emergencyContacts": {
      "ambulance": "112",
      "police": "155",
      "jandarma": "156"
    }
  },
  "culturalDifferences": "Türkiye ve hedef ülke arasındaki temel kültürel farklılıklar...",
  "lifestyleDifferences": "Günlük yaşam alışkanlıkları farklılıkları...",
  "foodCultureDifferences": "Yemek kültürü farklılıkları...",
  "socialNormsDifferences": "Sosyal davranış normları farklılıkları...",
  "localTransportationGuide": "Yerel ulaşım sistemini kullanma rehberi...",
  "emergencyContacts": "Önemli acil durum numaraları...",
  "currencyAndPayment": "Yerel para birimi ve ödeme yöntemleri...",
  "healthcareInfo": "Sağlık hizmetleri bilgisi...",
  "communicationInfo": "İletişim ve internet kullanımı..."
}`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        });

        // Yanıtı al
        const responseText = completion.choices[0]?.message?.content || '{}';

        // TravelPlan formatına dönüştür
        const travelPlan = parseOpenAIResponse(responseText);

        // JSON string olarak döndür
        return {
          response: {
            text: responseText,
            travelPlan: travelPlan
          }
        };
      } catch (openaiError) {
        // OpenAI hatası durumunda Gemini'ye yönlendir
        console.error('OpenAI hatası, Gemini API deneniyor:', openaiError);

        // Chat session'a mesajı gönder
        const result = await geminiChatSession.sendMessage(prompt);
        const responseText = result.response.text();

        // TravelPlan formatına dönüştür
        const travelPlan = parseGeminiResponse(responseText);

        // JSON string olarak döndür
        return {
          response: {
            text: responseText,
            travelPlan: travelPlan
          }
        };
      }
    } catch (error) {
      console.error('AI mesajı gönderme hatası:', error);
      throw error;
    }
  },

  // Seyahat planı oluşturma fonksiyonu
  async createTravelPlan(formData: any): Promise<any> {
    try {
      // Formatı Gemini AI için hazırla
      const budgetText = formData.budget === 'budget' ? 'Ekonomik' :
                        formData.budget === 'moderate' ? 'Orta' :
                        formData.budget === 'luxury' ? 'Lüks' : 'Orta';

      const companionText = formData.companion === 'solo' ? 'Yalnız' :
                          formData.companion === 'couple' ? 'Çift' :
                          formData.companion === 'family' ? 'Aile' :
                          formData.companion === 'group' ? 'Grup' : 'Çift';

      // Tarihi Türkçe formatla
      let formattedDate = '';
      if (formData.startDate) {
        try {
          // ISO string formatındaki tarihi Date objesine çevir
          const date = new Date(formData.startDate);

          // Geçerli bir tarih mi kontrol et
          if (!isNaN(date.getTime())) {
            // Tarihi Türkçe formatla
            formattedDate = date.toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            console.log('AI servisinde formatlanmış tarih:', formattedDate);
          } else {
            console.error('Geçersiz tarih formatı:', formData.startDate);
          }
        } catch (error) {
          console.error('Tarih formatı hatası:', error);
        }
      }

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
      let travelPlan;

      if (result?.response?.travelPlan) {
        // AITRAVEL ile uyumlu formatı sağla
        travelPlan = {
          ...result.response.travelPlan,
          id: formData.id || new Date().getTime().toString(),
          destination: formData.city || formData.destination || '',
          startDate: formData.startDate || '',
          days: formData.days || 0,
          // Duration alanını string olarak ayarla (web uygulamasıyla uyumlu olması için)
          duration: `${formData.days} days`,
          isDomestic: formData.isDomestic || false,
          userId: formData.userId || '',
          numberOfPeople: companionText === 'Yalnız' ? '1 Kişi' : '2+ Kişi',
          groupType: companionText,
          budget: budgetText,
          residenceCountry: formData.residenceCountry || 'Turkey',
          citizenship: formData.citizenship || 'Turkey',
          country: result.response.travelPlan.country || '',
          isRecommended: false,
          likes: 0,
          likedBy: [],
          bestTimeToVisit: result.response.travelPlan.bestTimeToVisit || '',
        };

        // İtinerary'nin doğru gün sayısına sahip olduğunu kontrol et ve eksik günleri tamamla
        try {
          if (result.response.travelPlan.itinerary) {
            // İtinerary'nin gün sayısını kontrol et
            const itineraryObj = result.response.travelPlan.itinerary;

            // İtinerary bir dizi mi yoksa obje mi kontrol et
            let itineraryArray: any[] = [];

            if (Array.isArray(itineraryObj)) {
              // Zaten dizi formatında
              itineraryArray = itineraryObj;
            } else if (typeof itineraryObj === 'object') {
              // Obje formatında (Day 1, Day 2, ...) - diziye çevir
              itineraryArray = Object.keys(itineraryObj).map(key => {
                const dayData = (itineraryObj as any)[key];
                return {
                  day: key.replace('Day ', '') + '. Gün',
                  plan: dayData && dayData.plan ? dayData.plan : []
                };
              });
            }

            const days = itineraryArray.length;
            console.log(`İtinerary gün sayısı: ${days}, Beklenen gün sayısı: ${formData.days}`);

            // Eğer gün sayısı beklenen gün sayısından farklıysa, eksik günleri ekle
            if (days < formData.days) {
              console.warn(`İtinerary gün sayısı (${days}) beklenen gün sayısından (${formData.days}) az! Eksik günler ekleniyor...`);

              // Eksik günleri ekle
              for (let i = days + 1; i <= formData.days; i++) {
                const newDay = {
                  day: `${i}. Gün`,
                  plan: [
                    {
                      time: "09:00 - 17:00",
                      placeName: `${formData.destination} Keşfi - Gün ${i}`,
                      placeDetails: "Bu gün için özel bir plan bulunmamaktadır. Şehri keşfedebilir veya rehberli turlara katılabilirsiniz.",
                      placeImageUrl: "",
                      geoCoordinates: { latitude: 0, longitude: 0 },
                      ticketPricing: "Değişken",
                      timeToTravel: "Değişken",
                      tips: [
                        "Yerel rehberlerden bilgi alabilirsiniz.",
                        "Hava durumuna göre giyinin.",
                        "Yanınızda su bulundurun."
                      ],
                      warnings: ["Değerli eşyalarınıza dikkat edin."],
                      alternatives: ["Müze ziyareti", "Yerel pazarları gezme", "Şehir turu"]
                    }
                  ]
                };

                itineraryArray.push(newDay);
              }

              // Güncellenmiş itinerary'yi kaydet
              result.response.travelPlan.itinerary = itineraryArray as any;
            } else if (days > formData.days) {
              console.warn(`İtinerary gün sayısı (${days}) beklenen gün sayısından (${formData.days}) fazla! Fazla günler kaldırılıyor...`);

              // Fazla günleri kaldır
              result.response.travelPlan.itinerary = itineraryArray.slice(0, formData.days) as any;
            }
          }
        } catch (error) {
          console.error('İtinerary kontrol ve düzeltme hatası:', error);
        }

        // Web uygulamasıyla uyumlu olması için tarih formatını ayarla
        if (formData.startDate) {
          try {
            // ISO string formatındaki tarihi Date objesine çevir
            const date = new Date(formData.startDate);

            // Geçerli bir tarih mi kontrol et
            if (!isNaN(date.getTime())) {
              // Web uygulaması için DD/MM/YYYY formatında tarih oluştur
              const day = date.getDate().toString().padStart(2, '0');
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const year = date.getFullYear();
              travelPlan.startDate = `${day}/${month}/${year}`;
              console.log('Firebase için formatlanmış tarih:', travelPlan.startDate);

              // Ayrıca ISO formatında da saklayalım (trip-details.tsx'de kullanılacak)
              (travelPlan as any).startDateISO = date.toISOString();
              console.log('Firebase için ISO formatında tarih:', (travelPlan as any).startDateISO);
            } else {
              console.error('Geçersiz tarih formatı:', formData.startDate);
              // Bugünün tarihini kullan
              const today = new Date();
              const day = today.getDate().toString().padStart(2, '0');
              const month = (today.getMonth() + 1).toString().padStart(2, '0');
              const year = today.getFullYear();
              travelPlan.startDate = `${day}/${month}/${year}`;
              (travelPlan as any).startDateISO = today.toISOString();
            }
          } catch (error) {
            console.error('Tarih dönüştürme hatası:', error);
            // Hata durumunda bugünün tarihini kullan
            const today = new Date();
            const day = today.getDate().toString().padStart(2, '0');
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear();
            travelPlan.startDate = `${day}/${month}/${year}`;
            (travelPlan as any).startDateISO = today.toISOString();
          }
        }
      } else {
        // AI yanıtı yoksa veya eksikse, varsayılan bir plan oluştur
        travelPlan = {
          ...DEFAULT_TRAVEL_PLAN,
          id: formData.id || new Date().getTime().toString(),
          destination: formData.city || formData.destination || '',
          startDate: formData.startDate || '',
          days: formData.days || 0,
          duration: `${formData.days} days`,
          isDomestic: formData.isDomestic || false,
          userId: formData.userId || '',
          numberOfPeople: companionText === 'Yalnız' ? '1 Kişi' : '2+ Kişi',
          groupType: companionText,
          budget: budgetText,
          residenceCountry: formData.residenceCountry || 'Turkey',
          citizenship: formData.citizenship || 'Turkey',
          country: '',
          bestTimeToVisit: '',
          isRecommended: false,
          likes: 0,
          likedBy: [],
        };

        // Varsayılan plan için itinerary oluştur - kullanıcının seçtiği gün sayısı kadar
        try {
          // Gün sayısını kontrol et
          const days = formData.days || 3;
          console.log(`Varsayılan plan için gün sayısı: ${days}`);

          // Varsayılan itinerary oluştur - dizi formatında (web ve mobil uygulamalar için uyumlu)
          const defaultItinerary: any[] = [];
          for (let i = 1; i <= days; i++) {
            defaultItinerary.push({
              day: `${i}. Gün`,
              plan: [
                {
                  time: "09:00 - 17:00",
                  placeName: `${formData.city || formData.destination} Gezisi - Gün ${i}`,
                  placeDetails: "Bu gün için özel bir plan bulunmamaktadır. Şehri keşfedebilir veya rehberli turlara katılabilirsiniz.",
                  placeImageUrl: "",
                  geoCoordinates: { latitude: 0, longitude: 0 },
                  ticketPricing: "Değişken",
                  timeToTravel: "Değişken",
                  tips: ["Yerel rehberlerden bilgi alabilirsiniz.", "Hava durumuna göre giyinin.", "Yanınızda su bulundurun."],
                  warnings: ["Değerli eşyalarınıza dikkat edin."],
                  alternatives: ["Müze ziyareti", "Yerel pazarları gezme", "Şehir turu"]
                }
              ]
            });
          }

          // Yeni itinerary'yi kaydet
          travelPlan.itinerary = JSON.stringify(defaultItinerary);

          console.log(`Varsayılan plan için ${days} günlük itinerary oluşturuldu.`);
        } catch (error) {
          console.error('Varsayılan itinerary oluşturma hatası:', error);
        }

        // Web uygulamasıyla uyumlu olması için tarih formatını ayarla
        if (formData.startDate) {
          try {
            // ISO string formatındaki tarihi Date objesine çevir
            const date = new Date(formData.startDate);

            // Geçerli bir tarih mi kontrol et
            if (!isNaN(date.getTime())) {
              // Web uygulaması için DD/MM/YYYY formatında tarih oluştur
              const day = date.getDate().toString().padStart(2, '0');
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const year = date.getFullYear();
              travelPlan.startDate = `${day}/${month}/${year}`;
              console.log('Varsayılan plan için formatlanmış tarih:', travelPlan.startDate);

              // Ayrıca ISO formatında da saklayalım (trip-details.tsx'de kullanılacak)
              (travelPlan as any).startDateISO = date.toISOString();
              console.log('Varsayılan plan için ISO formatında tarih:', (travelPlan as any).startDateISO);
            } else {
              console.error('Geçersiz tarih formatı:', formData.startDate);
              // Bugünün tarihini kullan
              const today = new Date();
              const day = today.getDate().toString().padStart(2, '0');
              const month = (today.getMonth() + 1).toString().padStart(2, '0');
              const year = today.getFullYear();
              travelPlan.startDate = `${day}/${month}/${year}`;
              (travelPlan as any).startDateISO = today.toISOString();
            }
          } catch (error) {
            console.error('Tarih dönüştürme hatası:', error);
            // Hata durumunda bugünün tarihini kullan
            const today = new Date();
            const day = today.getDate().toString().padStart(2, '0');
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear();
            travelPlan.startDate = `${day}/${month}/${year}`;
            (travelPlan as any).startDateISO = today.toISOString();
          }
        }
      }

      // Firebase servisindeki formatTravelPlanForWeb fonksiyonunu kullan
      // this.formatTravelPlanData(travelPlan); // Eski formatı kullanmıyoruz
      // Not: Bu fonksiyon artık plan-trip.tsx'de FirebaseService.TravelPlan.formatTravelPlanForWeb ile değiştirildi

      return travelPlan;
    } catch (error) {
      console.error('Seyahat planı oluşturma hatası:', error);
      throw error;
    }
  },

  // Veri formatını düzenle - Web uygulamasıyla uyumlu hale getir
  formatTravelPlanData(travelPlan: any) {
    // Günlük planları (Day 1, Day 2, Day 3) itinerary alanına taşı
    const dayKeys = Object.keys(travelPlan).filter(key => key.startsWith('Day '));

    // Web formatında itinerary oluştur
    let webFormatItinerary = {};

    if (dayKeys.length > 0) {
      console.log('Günlük planlar bulundu, itinerary alanına taşınıyor...');

      // Günlük planları itinerary dizisine dönüştür
      const itineraryArray = dayKeys.map(dayKey => {
        const dayPlan = travelPlan[dayKey];
        return {
          day: dayPlan.day,
          plan: dayPlan.plan
        };
      });

      // Otel bilgilerini hazırla
      let hotelOptionsArray = [];
      if (travelPlan.hotelOptions) {
        if (typeof travelPlan.hotelOptions === 'string') {
          try {
            hotelOptionsArray = JSON.parse(travelPlan.hotelOptions);
          } catch (error) {
            console.error('Hotel options parse hatası:', error);
            hotelOptionsArray = [];
          }
        } else if (Array.isArray(travelPlan.hotelOptions)) {
          hotelOptionsArray = travelPlan.hotelOptions;
        }
      }

      // Web formatında itinerary oluştur - tam olarak web uygulamasının beklediği format
      webFormatItinerary = {
        hotelOptions: hotelOptionsArray,
        itinerary: itineraryArray,
        transportationTips: [
          "Şehir içi ulaşım taksi ve dolmuşlar ile sağlanmaktadır.",
          "Turistik yerlere ulaşım için taksi veya özel araç kiralamak en uygun yöntemdir.",
          "Şehir merkezinde bazı yerlere yürüyerek ulaşım mümkündür."
        ],
        budgetSummary: {
          konaklama: `${travelPlan.days * 1000} TL - ${travelPlan.days * 2000} TL (${travelPlan.days} gece)`,
          yemek: "1500 TL - 3000 TL",
          aktiviteler: "1000 TL - 2000 TL",
          ulaşım: "1500 TL - 2500 TL",
          ekstralar: "1000 TL"
        },
        notes: [
          `${travelPlan.destination} ziyaret etmek için en uygun zaman ilkbahar veya sonbahar aylarıdır.`,
          `${travelPlan.budget} bir seyahat planladığınız için konaklama, yemek ve aktivitelerde en iyi seçenekleri tercih edebilirsiniz.`,
          "Özellikle popüler restoranlar ve turistik aktiviteler için önceden rezervasyon yaptırmanız önerilir."
        ],
        restaurantOptions: [
          {
            name: "Yerel Restoran",
            cuisine: "Türk Mutfağı",
            priceRange: "300 TL - 600 TL",
            rating: 4.0,
            description: "Yerel lezzetleri tadabileceğiniz bir restoran.",
            address: `${travelPlan.destination}`,
            bestTimeToVisit: "Öğle veya Akşam",
            mustTry: "Yerel lezzetler",
            tips: "Rezervasyon yaptırmanız önerilir.",
            budget: travelPlan.budget
          }
        ]
      };

      // JSON string'e dönüştür
      travelPlan.itinerary = JSON.stringify(webFormatItinerary);

      // Günlük plan alanlarını temizle
      dayKeys.forEach(dayKey => {
        delete travelPlan[dayKey];
      });

      console.log('Günlük planlar itinerary alanına taşındı');
    }
    // Eğer itinerary zaten varsa ve string değilse
    else if (travelPlan.itinerary && typeof travelPlan.itinerary !== 'string') {
      console.log('İtinerary alanı string değil, düzenleniyor...');

      // Eğer itinerary bir nesne ise ve boş değilse
      if (typeof travelPlan.itinerary === 'object' && Object.keys(travelPlan.itinerary).length > 0) {
        // Mevcut itinerary'yi kullan
        webFormatItinerary = travelPlan.itinerary;
      } else {
        // Boş bir itinerary oluştur
        webFormatItinerary = {
          hotelOptions: [],
          itinerary: [],
          transportationTips: [
            "Şehir içi ulaşım taksi ve dolmuşlar ile sağlanmaktadır.",
            "Turistik yerlere ulaşım için taksi veya özel araç kiralamak en uygun yöntemdir.",
            "Şehir merkezinde bazı yerlere yürüyerek ulaşım mümkündür."
          ],
          budgetSummary: {
            konaklama: `${travelPlan.days * 1000} TL - ${travelPlan.days * 2000} TL (${travelPlan.days} gece)`,
            yemek: "1500 TL - 3000 TL",
            aktiviteler: "1000 TL - 2000 TL",
            ulaşım: "1500 TL - 2500 TL",
            ekstralar: "1000 TL"
          },
          notes: [
            `${travelPlan.destination} ziyaret etmek için en uygun zaman ilkbahar veya sonbahar aylarıdır.`,
            `${travelPlan.budget} bir seyahat planladığınız için konaklama, yemek ve aktivitelerde en iyi seçenekleri tercih edebilirsiniz.`,
            "Özellikle popüler restoranlar ve turistik aktiviteler için önceden rezervasyon yaptırmanız önerilir."
          ],
          restaurantOptions: []
        };
      }

      // JSON string'e dönüştür
      travelPlan.itinerary = JSON.stringify(webFormatItinerary);
    }
    // Eğer itinerary string ise, web formatına uygun olup olmadığını kontrol et
    else if (travelPlan.itinerary && typeof travelPlan.itinerary === 'string') {
      try {
        const parsedItinerary = JSON.parse(travelPlan.itinerary);

        // Eğer web formatına uygun değilse, dönüştür
        if (!parsedItinerary.hotelOptions || !parsedItinerary.itinerary) {
          // Boş bir itinerary oluştur
          webFormatItinerary = {
            hotelOptions: [],
            itinerary: [],
            transportationTips: [
              "Şehir içi ulaşım taksi ve dolmuşlar ile sağlanmaktadır.",
              "Turistik yerlere ulaşım için taksi veya özel araç kiralamak en uygun yöntemdir.",
              "Şehir merkezinde bazı yerlere yürüyerek ulaşım mümkündür."
            ],
            budgetSummary: {
              konaklama: `${travelPlan.days * 1000} TL - ${travelPlan.days * 2000} TL (${travelPlan.days} gece)`,
              yemek: "1500 TL - 3000 TL",
              aktiviteler: "1000 TL - 2000 TL",
              ulaşım: "1500 TL - 2500 TL",
              ekstralar: "1000 TL"
            },
            notes: [
              `${travelPlan.destination} ziyaret etmek için en uygun zaman ilkbahar veya sonbahar aylarıdır.`,
              `${travelPlan.budget} bir seyahat planladığınız için konaklama, yemek ve aktivitelerde en iyi seçenekleri tercih edebilirsiniz.`,
              "Özellikle popüler restoranlar ve turistik aktiviteler için önceden rezervasyon yaptırmanız önerilir."
            ],
            restaurantOptions: []
          };

          // JSON string'e dönüştür
          travelPlan.itinerary = JSON.stringify(webFormatItinerary);
        }
      } catch (error) {
        console.error('Itinerary parse hatası:', error);

        // Hata durumunda web formatına dönüştür
        webFormatItinerary = {
          hotelOptions: [],
          itinerary: [],
          transportationTips: [
            "Şehir içi ulaşım taksi ve dolmuşlar ile sağlanmaktadır.",
            "Turistik yerlere ulaşım için taksi veya özel araç kiralamak en uygun yöntemdir.",
            "Şehir merkezinde bazı yerlere yürüyerek ulaşım mümkündür."
          ],
          budgetSummary: {
            konaklama: `${travelPlan.days * 1000} TL - ${travelPlan.days * 2000} TL (${travelPlan.days} gece)`,
            yemek: "1500 TL - 3000 TL",
            aktiviteler: "1000 TL - 2000 TL",
            ulaşım: "1500 TL - 2500 TL",
            ekstralar: "1000 TL"
          },
          notes: [
            `${travelPlan.destination} ziyaret etmek için en uygun zaman ilkbahar veya sonbahar aylarıdır.`,
            `${travelPlan.budget} bir seyahat planladığınız için konaklama, yemek ve aktivitelerde en iyi seçenekleri tercih edebilirsiniz.`,
            "Özellikle popüler restoranlar ve turistik aktiviteler için önceden rezervasyon yaptırmanız önerilir."
          ],
          restaurantOptions: []
        };

        // JSON string'e dönüştür
        travelPlan.itinerary = JSON.stringify(webFormatItinerary);
      }
    }
    // Itinerary yoksa veya boş bir nesne ise, boş bir web formatı oluştur
    else {
      webFormatItinerary = {
        hotelOptions: [],
        itinerary: [],
        transportationTips: [
          "Şehir içi ulaşım taksi ve dolmuşlar ile sağlanmaktadır.",
          "Turistik yerlere ulaşım için taksi veya özel araç kiralamak en uygun yöntemdir.",
          "Şehir merkezinde bazı yerlere yürüyerek ulaşım mümkündür."
        ],
        budgetSummary: {
          konaklama: `${travelPlan.days * 1000} TL - ${travelPlan.days * 2000} TL (${travelPlan.days} gece)`,
          yemek: "1500 TL - 3000 TL",
          aktiviteler: "1000 TL - 2000 TL",
          ulaşım: "1500 TL - 2500 TL",
          ekstralar: "1000 TL"
        },
        notes: [
          `${travelPlan.destination} ziyaret etmek için en uygun zaman ilkbahar veya sonbahar aylarıdır.`,
          `${travelPlan.budget} bir seyahat planladığınız için konaklama, yemek ve aktivitelerde en iyi seçenekleri tercih edebilirsiniz.`,
          "Özellikle popüler restoranlar ve turistik aktiviteler için önceden rezervasyon yaptırmanız önerilir."
        ],
        restaurantOptions: []
      };

      // JSON string'e dönüştür
      travelPlan.itinerary = JSON.stringify(webFormatItinerary);
    }

    // hotelOptions alanını düzenle - Web uygulamasıyla uyumlu olması için
    if (travelPlan.hotelOptions && typeof travelPlan.hotelOptions !== 'string') {
      // Otel alanlarını web formatına dönüştür
      if (Array.isArray(travelPlan.hotelOptions)) {
        travelPlan.hotelOptions = travelPlan.hotelOptions.map((hotel: any) => {
          // price alanını priceRange olarak değiştir (web uyumluluğu için)
          if (hotel.price && !hotel.priceRange) {
            hotel.priceRange = hotel.price;
          }
          return hotel;
        });
      }

      // Sonra JSON string'e dönüştür
      travelPlan.hotelOptions = JSON.stringify(travelPlan.hotelOptions);
    }

    // visaInfo alanını düzenle
    if (travelPlan.visaInfo && typeof travelPlan.visaInfo !== 'string') {
      // Vize bilgilerini ayrı alanlara da ekle (web uyumluluğu için)
      if (travelPlan.visaInfo.visaRequirement) {
        travelPlan.visaRequirements = travelPlan.visaInfo.visaRequirement;
      }
      if (travelPlan.visaInfo.visaApplicationProcess) {
        travelPlan.visaApplicationProcess = travelPlan.visaInfo.visaApplicationProcess;
      }
      if (travelPlan.visaInfo.visaFee) {
        travelPlan.visaFees = travelPlan.visaInfo.visaFee;
      }

      // Sonra JSON string'e dönüştür
      travelPlan.visaInfo = JSON.stringify(travelPlan.visaInfo);
    }

    // culturalDifferences alanını düzenle
    if (travelPlan.culturalDifferences && typeof travelPlan.culturalDifferences !== 'string') {
      // Kültürel farklılıkları ayrı alanlara da ekle (web uyumluluğu için)
      if (typeof travelPlan.culturalDifferences === 'object') {
        if (travelPlan.culturalDifferences.lifestyleDifferences) {
          travelPlan.lifestyleDifferences = travelPlan.culturalDifferences.lifestyleDifferences;
        }
        if (travelPlan.culturalDifferences.foodCultureDifferences) {
          travelPlan.foodCultureDifferences = travelPlan.culturalDifferences.foodCultureDifferences;
        }
        if (travelPlan.culturalDifferences.socialNormsDifferences) {
          travelPlan.socialNormsDifferences = travelPlan.culturalDifferences.socialNormsDifferences;
        }
      }

      // Sonra JSON string'e dönüştür
      travelPlan.culturalDifferences = JSON.stringify(travelPlan.culturalDifferences);
    }

    // localTips alanını düzenle
    if (travelPlan.localTips && typeof travelPlan.localTips !== 'string') {
      // Yerel ipuçlarını ayrı alanlara da ekle (web uyumluluğu için)
      if (typeof travelPlan.localTips === 'object') {
        if (travelPlan.localTips.localTransportationGuide) {
          travelPlan.localTransportationGuide = travelPlan.localTips.localTransportationGuide;
        }
        if (travelPlan.localTips.emergencyContacts) {
          travelPlan.emergencyContacts = travelPlan.localTips.emergencyContacts;
        }
        if (travelPlan.localTips.currencyAndPayment) {
          travelPlan.currencyAndPayment = travelPlan.localTips.currencyAndPayment;
        }
        if (travelPlan.localTips.communicationInfo) {
          travelPlan.communicationInfo = travelPlan.localTips.communicationInfo;
        }
        if (travelPlan.localTips.healthcareInfo) {
          travelPlan.healthcareInfo = travelPlan.localTips.healthcareInfo;
        }
      }

      // Sonra JSON string'e dönüştür
      travelPlan.localTips = JSON.stringify(travelPlan.localTips);
    }

    // duration alanını string olarak ayarla (web uygulamasıyla uyumlu olması için)
    if (typeof travelPlan.duration === 'number') {
      travelPlan.duration = `${travelPlan.duration} days`;
    }

    // startDate formatını kontrol et
    if (travelPlan.startDate && typeof travelPlan.startDate === 'string') {
      // ISO formatındaysa, DD/MM/YYYY formatına dönüştür
      if (travelPlan.startDate.includes('T')) {
        try {
          const date = new Date(travelPlan.startDate);
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          travelPlan.startDate = `${day}/${month}/${year}`;
        } catch (error) {
          console.error('Tarih dönüştürme hatası:', error);
        }
      }
    }
  }
};

// Not: Bu dosya sadece servis işlevine sahiptir, React component değildir.
// Web uygulamasıyla uyumlu olması için chatSession'u export et
export const chatSession = aiService;

// Expo Router için default export gereklidir
export default function AiServiceComponent() {
  return null;
}