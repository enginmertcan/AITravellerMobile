/**
 * proxy-api.service.ts
 *
 * Bu servis, Google Places API gibi CORS kısıtlaması olan API'lere erişim için
 * alternatif yöntemler sağlar.
 */

import { API_CONFIG } from '../config/api';

// Güvenilir bir CORS proxy servisi
const CORS_PROXY_URL = 'https://corsproxy.io/?';

// Alternatif proxy servisleri
const ALTERNATIVE_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
];

/**
 * Proxy API Servisi
 * CORS kısıtlaması olan API'lere erişim için alternatif yöntemler sağlar
 */
const ProxyApiService = {
  /**
   * Google Places API Text Search isteği yapar
   * @param query - Arama sorgusu
   * @param apiKey - Google Places API anahtarı
   * @returns Promise<any> - API yanıtı
   */
  async placeTextSearch(query: string, apiKey: string = API_CONFIG.GOOGLE_PLACES): Promise<any> {
    try {
      console.log(`Places Text Search isteği yapılıyor: ${query}`);

      // Doğrudan istek yapmayı dene (React Native'de CORS sorunu olmayabilir)
      try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        // Eğer sonuçlar varsa, başarılı demektir
        if (data && data.results) {
          return data;
        }
      } catch (directError) {
        console.log("Doğrudan istek başarısız, proxy deneniyor...", directError);
      }

      // Proxy üzerinden istek yap
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
      const response = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(searchUrl)}`);

      // Yanıtı kontrol et
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // JSON yanıtını döndür
      return await response.json();
    } catch (error) {
      console.error("Places Text Search hatası:", error);

      // Alternatif proxy dene
      try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
        const response = await fetch(`${ALTERNATIVE_PROXIES[0]}${encodeURIComponent(searchUrl)}`);
        return await response.json();
      } catch (altError) {

        // Hata durumunda boş bir sonuç döndür
        return { results: [] };
      }
    }
  },

  /**
   * Google Places API Place Details isteği yapar
   * @param placeId - Yer ID'si
   * @param fields - İstenen alanlar
   * @param apiKey - Google Places API anahtarı
   * @returns Promise<any> - API yanıtı
   */
  async placeDetails(placeId: string, fields: string = 'photos', apiKey: string = API_CONFIG.GOOGLE_PLACES): Promise<any> {
    try {
      console.log(`Place Details isteği yapılıyor: ${placeId}`);

      // Doğrudan istek yapmayı dene (React Native'de CORS sorunu olmayabilir)
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
        const response = await fetch(detailsUrl);
        const data = await response.json();

        // Eğer sonuçlar varsa, başarılı demektir
        if (data && data.result) {
          return data;
        }
      } catch (directError) {
      }

      // Proxy üzerinden istek yap
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
      const response = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(detailsUrl)}`);

      // Yanıtı kontrol et
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // JSON yanıtını döndür
      return await response.json();
    } catch (error) {
      console.error("Place Details hatası:", error);

      // Alternatif proxy dene
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
        const response = await fetch(`${ALTERNATIVE_PROXIES[0]}${encodeURIComponent(detailsUrl)}`);
        return await response.json();
      } catch (altError) {

        // Hata durumunda boş bir sonuç döndür
        return { result: { photos: [] } };
      }
    }
  },

  /**
   * Google Places API Photo isteği yapar
   * @param photoReference - Fotoğraf referansı
   * @param maxWidth - Maksimum genişlik
   * @param apiKey - Google Places API anahtarı
   * @returns string - Fotoğraf URL'i
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 1200, apiKey: string = API_CONFIG.GOOGLE_PLACES): string {
    // Fotoğraf URL'i doğrudan kullanılabilir (CORS sorunu yok)
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
  },

  /**
   * Alternatif fotoğraf URL'i oluşturur (proxy üzerinden)
   * @param photoReference - Fotoğraf referansı
   * @param maxWidth - Maksimum genişlik
   * @param apiKey - Google Places API anahtarı
   * @returns string - Proxy üzerinden fotoğraf URL'i
   */
  getProxyPhotoUrl(photoReference: string, maxWidth: number = 1200, apiKey: string = API_CONFIG.GOOGLE_PLACES): string {
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
    return `${CORS_PROXY_URL}${encodeURIComponent(photoUrl)}`;
  }
};

export default ProxyApiService;
