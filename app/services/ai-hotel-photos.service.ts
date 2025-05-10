/**
 * ai-hotel-photos.service.ts
 *
 * Bu servis, OpenAI tarafından önerilen otellerin fotoğraflarını getirmek için kullanılır.
 * Google Places API kullanarak otel fotoğraflarını getirir.
 */

import { API_CONFIG } from '../config/api';
import ProxyApiService from './proxy-api.service';

// Google Places API anahtarı
// Önce API_CONFIG'den al, yoksa process.env'den, yoksa sabit değeri kullan
const GOOGLE_PLACES_API_KEY = API_CONFIG.GOOGLE_PLACES ||
                             process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
                             'AIzaSyCuywyLDcnyRENGnIHnit-ym2rhQBnXMJw';

// API anahtarını kontrol et ve log'a yaz
console.log(`AIHotelPhotosService - Google Places API anahtarı: ${GOOGLE_PLACES_API_KEY ? 'Mevcut' : 'Eksik'}`);
console.log(`AIHotelPhotosService - API anahtarı uzunluğu: ${GOOGLE_PLACES_API_KEY?.length || 0}`);

// Maksimum fotoğraf sayısı (sabit bir limit yok)
const MAX_PHOTOS = 20; // 10 geçerli fotoğraf göstermek için 20 tane getiriyoruz (ilk 1-2 tanesi null olabilir)

/**
 * AI Otel Fotoğrafları Servisi
 * OpenAI tarafından önerilen otellerin fotoğraflarını getirmek için metodlar sağlar
 */
const AIHotelPhotosService = {
  /**
   * Google Places API'den otel fotoğraflarını getirir
   * @param hotelName - Otelin adı
   * @param city - Otelin bulunduğu şehir
   * @returns Promise<string[]> - Fotoğraf URL'lerinin dizisi
   */
  async fetchHotelPhotos(hotelName: string, city: string): Promise<string[]> {
    try {
      console.log(`AI Otel fotoğrafları getiriliyor: ${hotelName}, ${city}`);

      // Adım 1: Places API Text Search ile oteli bul (Proxy üzerinden)
      const searchQuery = `${hotelName} hotel ${city}`;

      // Proxy servisini kullan
      const searchData = await ProxyApiService.placeTextSearch(searchQuery, GOOGLE_PLACES_API_KEY);

      if (!searchData.results || searchData.results.length === 0) {
        console.warn(`Otel için sonuç bulunamadı: ${hotelName}`);
        return [];
      }

      // İlk sonucu al (en alakalı)
      const placeId = searchData.results[0].place_id;
      console.log(`Otel Place ID: ${placeId}`);

      // Adım 2: Fotoğraflar dahil yer detaylarını al (Proxy üzerinden)
      const detailsData = await ProxyApiService.placeDetails(placeId, 'photos', GOOGLE_PLACES_API_KEY);

      if (!detailsData.result || !detailsData.result.photos || detailsData.result.photos.length === 0) {
        console.warn(`Otel için fotoğraf bulunamadı: ${hotelName}`);
        return [];
      }

      // Tüm mevcut fotoğrafları al (MAX_PHOTOS'a kadar)
      const photoReferences = detailsData.result.photos
        .slice(0, MAX_PHOTOS)
        .map((photo: any) => photo.photo_reference);

      console.log(`${photoReferences.length} fotoğraf referansı bulundu`);

      // Adım 3: Her referans için fotoğraf URL'lerini al
      // Önce doğrudan URL'leri deneyelim, sorun olursa proxy URL'leri kullanırız
      let photoUrls = photoReferences.map(
        (reference: string) => ProxyApiService.getPhotoUrl(reference, 1200, GOOGLE_PLACES_API_KEY)
      );

      // Yedek olarak proxy URL'leri de hazırlayalım
      const proxyPhotoUrls = photoReferences.map(
        (reference: string) => ProxyApiService.getProxyPhotoUrl(reference, 1200, GOOGLE_PLACES_API_KEY)
      );

      // Eğer doğrudan URL'ler çalışmazsa, proxy URL'leri kullanmak için hazır olalım
      console.log(`Yedek proxy fotoğraf URL'leri hazırlandı: ${proxyPhotoUrls.length} adet`);

      // Null veya geçersiz URL'leri filtrele
      photoUrls = photoUrls.filter(url => {
        // URL null, undefined, boş string veya 'null', 'undefined' string değilse geçerlidir
        const isValid = url &&
                       typeof url === 'string' &&
                       url.trim() !== '' &&
                       url !== 'null' &&
                       url !== 'undefined' &&
                       url.startsWith('http');

        if (!isValid) {
          console.log(`Geçersiz URL filtrelendi: ${url}`);
        }

        return isValid;
      });

      console.log(`Filtreleme sonrası ${photoUrls.length} geçerli fotoğraf URL'si kaldı`);

      // Eğer doğrudan URL'ler yeterli değilse, proxy URL'leri kullan
      if (photoUrls.length < 10 && proxyPhotoUrls.length > 0) {
        console.log(`Doğrudan URL'ler yeterli değil, proxy URL'leri ekleniyor...`);

        // Proxy URL'lerini filtrele ve ekle
        const validProxyUrls = proxyPhotoUrls.filter(url =>
          url && typeof url === 'string' && url.trim() !== '' && url.startsWith('http')
        );

        // Tekrarları önlemek için kontrol et
        const existingUrls = new Set(photoUrls);
        const newProxyUrls = validProxyUrls.filter(url => !existingUrls.has(url));

        // Yeni proxy URL'lerini ekle
        photoUrls = [...photoUrls, ...newProxyUrls];
        console.log(`${newProxyUrls.length} proxy URL eklendi, toplam: ${photoUrls.length}`);
      }

      console.log(`Otel için ${photoUrls.length} fotoğraf bulundu: ${hotelName}`);
      return photoUrls;
    } catch (error) {
      console.error("AI Otel fotoğrafları getirme hatası:", error);
      return [];
    }
  },

  /**
   * OpenAI tarafından önerilen otellerin fotoğraflarını getirir
   * @param hotelOptions - OpenAI tarafından önerilen otel seçenekleri
   * @param city - Otellerin bulunduğu şehir
   * @returns Promise<any[]> - Fotoğraflarla zenginleştirilmiş otel seçenekleri
   */
  async enhanceAIHotelOptions(hotelOptions: any[], city: string): Promise<any[]> {
    if (!hotelOptions || !Array.isArray(hotelOptions) || hotelOptions.length === 0) {
      console.warn("Geçersiz otel seçenekleri");
      return [];
    }

    try {
      console.log(`${hotelOptions.length} AI otel seçeneği için fotoğraflar getiriliyor...`);

      // Her otel için fotoğrafları getir
      const enhancedHotels = await Promise.all(
        hotelOptions.map(async (hotel) => {
          try {
            if (!hotel || !hotel.hotelName) {
              console.warn("Geçersiz otel nesnesi");
              return hotel;
            }

            // Mevcut additionalImages dizisini kontrol et
            const existingImages = hotel.additionalImages || [];

            // Eğer zaten yeterli fotoğraf varsa, işlem yapma
            if (existingImages.length >= 5) {
              console.log(`Otel zaten ${existingImages.length} fotoğrafa sahip, ek fotoğraf getirilmiyor`);
              return hotel;
            }

            // Ek fotoğraflar getir
            const photoUrls = await this.fetchHotelPhotos(hotel.hotelName, city);

            if (photoUrls.length === 0) {
              console.log(`${hotel.hotelName} için fotoğraf bulunamadı`);
              return hotel;
            }

            // Mevcut fotoğrafların URL'lerini topla
            const existingUrls = existingImages.map((img: any) =>
              typeof img === 'string' ? img : img.url
            );

            // Sadece yeni fotoğrafları ekle (tekrarları önle)
            const newPhotoUrls = photoUrls.filter(url => !existingUrls.includes(url));

            // Yeni fotoğrafları additionalImages dizisine ekle
            const newImages = newPhotoUrls.map(url => ({ url }));

            // Ana fotoğrafı ayarla (eğer yoksa)
            let updatedHotel = { ...hotel };

            if (!hotel.imageUrl && newPhotoUrls.length > 0) {
              updatedHotel.imageUrl = newPhotoUrls[0];
            }

            // Ek fotoğrafları ekle
            updatedHotel.additionalImages = [...existingImages, ...newImages];

            // AI tarafından önerilen otel olarak işaretle
            updatedHotel.isAIRecommended = true;

            console.log(`${hotel.hotelName} için ${newImages.length} yeni fotoğraf eklendi`);
            return updatedHotel;
          } catch (error) {
            console.error(`${hotel.hotelName} için fotoğraf getirme hatası:`, error);
            return hotel;
          }
        })
      );

      console.log("AI otel seçenekleri fotoğraflarla zenginleştirildi");
      return enhancedHotels;
    } catch (error) {
      console.error("AI otel seçeneklerini zenginleştirme hatası:", error);
      return hotelOptions; // Hata durumunda orijinal otelleri döndür
    }
  },

  /**
   * Tek bir otelin fotoğraflarını zenginleştirir
   * @param hotel - Otel nesnesi
   * @param city - Otelin bulunduğu şehir
   * @returns Promise<any> - Fotoğraflarla zenginleştirilmiş otel nesnesi
   */
  async enhanceHotelWithPhotos(hotel: any, city: string): Promise<any> {
    try {
      if (!hotel || !hotel.hotelName) {
        console.warn("Geçersiz otel nesnesi");
        return hotel;
      }

      // Mevcut additionalImages dizisini kontrol et
      const existingImages = hotel.additionalImages || [];

      // Eğer zaten yeterli fotoğraf varsa, işlem yapma
      // Geçerli fotoğrafları say (null veya geçersiz olanları sayma)
      const validExistingImages = existingImages.filter(img =>
        img && (typeof img === 'string' ? img.trim() !== '' : (img.url && img.url.trim() !== ''))
      );

      if (validExistingImages.length >= 10) {
        console.log(`Otel zaten ${validExistingImages.length} geçerli fotoğrafa sahip, ek fotoğraf getirilmiyor`);
        return hotel;
      }

      try {
        // Ek fotoğraflar getir
        const photoUrls = await this.fetchHotelPhotos(hotel.hotelName, city);

        if (photoUrls.length === 0) {
          console.log(`${hotel.hotelName} için fotoğraf bulunamadı`);
          return hotel;
        }

        // Mevcut fotoğrafların URL'lerini topla
        const existingUrls = existingImages.map((img: any) =>
          typeof img === 'string' ? img : img.url
        );

        // Sadece yeni fotoğrafları ekle (tekrarları önle)
        const newPhotoUrls = photoUrls.filter(url => !existingUrls.includes(url));

        // Yeni fotoğrafları additionalImages dizisine ekle
        const newImages = newPhotoUrls.map(url => ({ url }));

        // Ana fotoğrafı ayarla (eğer yoksa)
        let updatedHotel = { ...hotel };

        if (!hotel.imageUrl && newPhotoUrls.length > 0) {
          updatedHotel.imageUrl = newPhotoUrls[0];
        }

        // Ek fotoğrafları ekle
        updatedHotel.additionalImages = [...existingImages, ...newImages];

        // AI tarafından önerilen otel olarak işaretle
        updatedHotel.isAIRecommended = true;

        console.log(`${hotel.hotelName} için ${newImages.length} yeni fotoğraf eklendi`);
        return updatedHotel;
      } catch (fetchError) {
        console.error(`${hotel.hotelName} için fotoğraf getirme hatası:`, fetchError);

        // Alternatif yöntem: Doğrudan Google Places API'ye istek yap
        try {
          console.log("Alternatif yöntem deneniyor...");

          // Basit bir arama sorgusu oluştur
          const searchQuery = `${hotel.hotelName} hotel ${city}`;
          const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_PLACES_API_KEY}`;

          // Doğrudan istek yap
          const response = await fetch(searchUrl);
          const data = await response.json();

          if (data.results && data.results.length > 0) {
            // İlk sonucu al
            const place = data.results[0];

            // Eğer fotoğraf varsa ekle
            if (place.photos && place.photos.length > 0) {
              const photoReference = place.photos[0].photo_reference;
              const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;

              // Yeni fotoğrafı ekle
              const updatedHotel = {
                ...hotel,
                additionalImages: [...existingImages, { url: photoUrl }],
                isAIRecommended: true
              };

              console.log("Alternatif yöntemle 1 fotoğraf eklendi");
              return updatedHotel;
            }
          }
        } catch (altError) {
          console.error("Alternatif yöntem hatası:", altError);
        }

        // Hiçbir yöntem çalışmazsa, en azından AI tarafından önerilen olarak işaretle
        return {
          ...hotel,
          isAIRecommended: true
        };
      }
    } catch (error) {
      console.error(`${hotel.hotelName} için fotoğraf getirme hatası:`, error);
      // Hata durumunda bile AI tarafından önerilen olarak işaretle
      return {
        ...hotel,
        isAIRecommended: true
      };
    }
  },

  /**
   * OpenAI yanıtından otel seçeneklerini çıkarır ve fotoğraflarla zenginleştirir
   * @param openAIResponse - OpenAI yanıtı
   * @param city - Otellerin bulunduğu şehir
   * @returns Promise<any[]> - Fotoğraflarla zenginleştirilmiş otel seçenekleri
   */
  async processOpenAIHotelResponse(openAIResponse: any, city: string): Promise<any[]> {
    try {
      if (!openAIResponse) {
        console.warn("Geçersiz OpenAI yanıtı");
        return [];
      }

      // OpenAI yanıtından otel seçeneklerini çıkar
      let hotelOptions: any[] = [];

      if (openAIResponse.hotelOptions && Array.isArray(openAIResponse.hotelOptions)) {
        hotelOptions = openAIResponse.hotelOptions;
      } else if (typeof openAIResponse === 'string') {
        try {
          const parsedResponse = JSON.parse(openAIResponse);
          if (parsedResponse.hotelOptions && Array.isArray(parsedResponse.hotelOptions)) {
            hotelOptions = parsedResponse.hotelOptions;
          }
        } catch (error) {
          console.error("OpenAI yanıtını ayrıştırma hatası:", error);
        }
      }

      if (hotelOptions.length === 0) {
        console.warn("OpenAI yanıtında otel seçeneği bulunamadı");
        return [];
      }

      console.log(`OpenAI yanıtından ${hotelOptions.length} otel seçeneği çıkarıldı`);

      // Otel seçeneklerini fotoğraflarla zenginleştir
      const enhancedHotels = await this.enhanceAIHotelOptions(hotelOptions, city);

      return enhancedHotels;
    } catch (error) {
      console.error("OpenAI otel yanıtını işleme hatası:", error);
      return [];
    }
  }
};

export default AIHotelPhotosService;
