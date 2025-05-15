/**
 * HotelPhotosService.ts
 *
 * Bu servis, otel fotoğraflarını getirmek ve görüntülemek için kullanılır.
 * Google Places API kullanarak otel fotoğraflarını getirir.
 */

import Constants from 'expo-constants';
import { API_CONFIG } from '../config/api';
import ProxyApiService from './proxy-api.service';

// Google Places API anahtarı
// Önce API_CONFIG'den al, yoksa Constants'dan, yoksa sabit değeri kullan
const GOOGLE_PLACES_API_KEY = API_CONFIG.GOOGLE_PLACES ||
                             Constants.expoConfig?.extra?.googlePlacesApiKey ||
                             process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
                             'AIzaSyCuywyLDcnyRENGnIHnit-ym2rhQBnXMJw';

// API anahtarını kontrol et ve log'a yaz
// API key validation is handled by the Places API client

// Maksimum fotoğraf sayısı (sabit bir limit yok)
const MAX_PHOTOS = 20; // 10 geçerli fotoğraf göstermek için 20 tane getiriyoruz (ilk 1-2 tanesi null olabilir)

/**
 * Otel Fotoğrafları Servisi
 * Otel fotoğraflarını getirmek ve görüntülemek için metodlar sağlar
 */
const HotelPhotosService = {
  /**
   * Google Places API'den otel fotoğraflarını getirir
   * @param hotelName - Otelin adı
   * @param city - Otelin bulunduğu şehir
   * @returns Promise<string[]> - Fotoğraf URL'lerinin dizisi
   */
  async fetchHotelPhotos(hotelName: string, city: string): Promise<string[]> {
    try {

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
        }

        return isValid;
      });


      // Eğer doğrudan URL'ler yeterli değilse, proxy URL'leri kullan
      if (photoUrls.length < 10 && proxyPhotoUrls.length > 0) {

        // Proxy URL'lerini filtrele ve ekle
        const validProxyUrls = proxyPhotoUrls.filter(url =>
          url && typeof url === 'string' && url.trim() !== '' && url.startsWith('http')
        );

        // Tekrarları önlemek için kontrol et
        const existingUrls = new Set(photoUrls);
        const newProxyUrls = validProxyUrls.filter(url => !existingUrls.has(url));

        // Yeni proxy URL'lerini ekle
        photoUrls = [...photoUrls, ...newProxyUrls];
      }

      return photoUrls;
    } catch (error) {
      console.error("Otel fotoğrafları getirme hatası:", error);
      return [];
    }
  },

  /**
   * Otel için ek fotoğraflar getirir ve mevcut otel nesnesini günceller
   * @param hotel - Otel nesnesi
   * @param city - Otelin bulunduğu şehir
   * @returns Promise<any> - Güncellenmiş otel nesnesi
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
        return hotel;
      }

      try {
        // Ek fotoğraflar getir
        const photoUrls = await this.fetchHotelPhotos(hotel.hotelName, city);

        if (photoUrls.length === 0) {
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
        const updatedHotel = {
          ...hotel,
          additionalImages: [...existingImages, ...newImages]
        };

        return updatedHotel;
      } catch (fetchError) {
        console.error("Otel fotoğrafları getirme hatası:", fetchError);

        // Alternatif yöntem: Doğrudan Google Places API'ye istek yap
        try {

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
                additionalImages: [...existingImages, { url: photoUrl }]
              };

              return updatedHotel;
            }
          }
        } catch (altError) {
          console.error("Alternatif yöntem hatası:", altError);
        }

        // Hiçbir yöntem çalışmazsa orijinal oteli döndür
        return hotel;
      }
    } catch (error) {
      console.error("Otel fotoğrafları ile zenginleştirme hatası:", error);
      return hotel;
    }
  },

  /**
   * Bir otel listesindeki tüm oteller için fotoğrafları zenginleştirir
   * @param hotels - Otel nesneleri dizisi
   * @param city - Otellerin bulunduğu şehir
   * @returns Promise<any[]> - Güncellenmiş otel nesneleri dizisi
   */
  async enhanceHotelsWithPhotos(hotels: any[], city: string): Promise<any[]> {
    if (!hotels || !Array.isArray(hotels) || hotels.length === 0) {
      return [];
    }

    try {

      // Her otel için fotoğrafları zenginleştir
      const enhancedHotels = await Promise.all(
        hotels.map(async (hotel) => await this.enhanceHotelWithPhotos(hotel, city))
      );

      return enhancedHotels;
    } catch (error) {
      console.error("Otelleri fotoğraflarla zenginleştirme hatası:", error);
      return hotels; // Hata durumunda orijinal otelleri döndür
    }
  }
};

export default HotelPhotosService;
