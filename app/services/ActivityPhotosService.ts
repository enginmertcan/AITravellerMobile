/**
 * ActivityPhotosService.ts
 *
 * Bu servis, aktivite fotoğraflarını getirmek için kullanılır.
 * Google Places API kullanarak aktivite fotoğraflarını getirir.
 */

import { API_CONFIG } from '../config/api';
import ProxyApiService from './proxy-api.service';

// Google Places API anahtarı
const GOOGLE_PLACES_API_KEY = API_CONFIG.GOOGLE_PLACES ||
                             process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
                             'AIzaSyCuywyLDcnyRENGnIHnit-ym2rhQBnXMJw';

// Maksimum fotoğraf sayısı
const MAX_PHOTOS = 20;

// Aktivite fotoğrafı tipi
export interface ActivityPhoto {
  imageUrl: string;
  location: string;
  description: string;
  imageData?: string;
}

/**
 * Aktivite Fotoğrafları Servisi
 * Aktivite fotoğraflarını getirmek için metodlar sağlar
 */
const ActivityPhotosService = {
  // Fotoğraf önbelleği - aynı sorguları tekrar tekrar yapmamak için
  photoCache: new Map<string, ActivityPhoto[]>(),

  /**
   * Metindeki Türkçe karakterleri İngilizce karakterlere dönüştürür
   * @param text Dönüştürülecek metin
   * @returns Dönüştürülmüş metin
   */
  normalizeText(text: string): string {
    return text
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/İ/g, 'I')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C');
  },

  /**
   * Aktivite fotoğraflarını getirir
   * @param activityName Aktivite adı
   * @param city Şehir adı
   * @returns Fotoğraf URL'lerinin listesi
   */
  async getActivityPhotos(activityName: string, city: string): Promise<string[]> {
    try {
      console.log(`Aktivite fotoğrafları getiriliyor: ${activityName}, ${city}`);

      // Aktivite adı veya şehir yoksa, boş dizi döndür
      if (!activityName || !city) {
        console.warn('Aktivite adı veya şehir bilgisi eksik');
        return [];
      }

      // Türkçe karakterleri normalize et
      const normalizedActivityName = this.normalizeText(activityName);
      const normalizedCity = this.normalizeText(city);

      // Farklı sorgular oluştur - daha fazla ve çeşitli sonuç için
      const queries = [
        `${normalizedActivityName} ${normalizedCity} tourist attraction`,
        `${normalizedActivityName} ${normalizedCity} landmark`,
        `${normalizedActivityName} ${normalizedCity} point of interest`
      ];

      // Her sorgu için paralel olarak fotoğrafları getir
      const photoPromises = queries.map(async (queryText) => {
        try {
          // Places API Text Search ile yerleri bul
          const searchData = await ProxyApiService.placeTextSearch(queryText, GOOGLE_PLACES_API_KEY);

          if (!searchData.results || searchData.results.length === 0) {
            console.log(`"${queryText}" sorgusu için sonuç bulunamadı`);
            return [];
          }

          // İlk sonucu al (en alakalı)
          const placeId = searchData.results[0].place_id;
          console.log(`Yer ID: ${placeId}`);

          // Fotoğraflar dahil yer detaylarını al
          const detailsData = await ProxyApiService.placeDetails(placeId, 'photos', GOOGLE_PLACES_API_KEY);

          if (!detailsData.result || !detailsData.result.photos || detailsData.result.photos.length === 0) {
            console.log(`"${queryText}" sorgusu için fotoğraf bulunamadı`);
            return [];
          }

          // Fotoğraf referanslarını al
          const photoReferences = detailsData.result.photos
            .slice(0, MAX_PHOTOS / queries.length) // Her sorgu için eşit sayıda fotoğraf
            .map((photo: any) => photo.photo_reference);

          // Fotoğraf URL'lerini oluştur
          return photoReferences
            .filter((ref: string) => ref)
            .map((ref: string) => ProxyApiService.getPhotoUrl(ref, 1200, GOOGLE_PLACES_API_KEY));
        } catch (error) {
          console.error(`"${queryText}" sorgusu için hata:`, error);
          return [];
        }
      });

      // Tüm sorgu sonuçlarını bekle
      const photoUrlsArrays = await Promise.all(photoPromises);

      // Tüm sonuçları birleştir ve tekrarlanan URL'leri kaldır
      const uniquePhotoUrls = Array.from(new Set(
        photoUrlsArrays.flat().filter(url => url && url.length > 0)
      ));

      console.log(`Toplam ${uniquePhotoUrls.length} benzersiz fotoğraf URL'i bulundu`);
      return uniquePhotoUrls;
    } catch (error) {
      console.error('Aktivite fotoğrafları getirme hatası:', error);
      return [];
    }
  },

  /**
   * Yedek aktivite fotoğrafları döndürür (API çağrısı başarısız olduğunda kullanılır)
   * @param activityName Aktivite adı (opsiyonel)
   * @param city Şehir adı (opsiyonel)
   * @returns Yedek aktivite fotoğraf URL'leri
   */
  getDummyPhotos(activityName?: string, city?: string): string[] {
    console.log(`Yedek fotoğraflar kullanılıyor: ${activityName || ''}, ${city || ''}`);

    // Aktivite adına göre kategorize edilmiş fotoğraflar
    const activityNameLower = (activityName || '').toLowerCase();

    // Müze fotoğrafları
    if (activityNameLower.includes('müze') || activityNameLower.includes('museum')) {
      return [
        'https://images.unsplash.com/photo-1503152394-c571994fd383?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1605358831041-fee6ef5a6acd?q=80&w=2070&auto=format&fit=crop'
      ];
    }
    
    // Cami fotoğrafları
    if (activityNameLower.includes('cami') || activityNameLower.includes('mosque')) {
      return [
        'https://images.unsplash.com/photo-1545167496-c1e092d383a2?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1584720223124-0d1c2a08a8a0?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1614438370783-b0e7e3f83ffd?q=80&w=2070&auto=format&fit=crop'
      ];
    }
    
    // Saray fotoğrafları
    if (activityNameLower.includes('saray') || activityNameLower.includes('palace')) {
      return [
        'https://images.unsplash.com/photo-1548115184-bc6544d06a58?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1603191659812-ee978eeeef67?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1594733113809-65e574d0a4c7?q=80&w=2070&auto=format&fit=crop'
      ];
    }
    
    // Genel turistik yer fotoğrafları
    return [
      'https://images.unsplash.com/photo-1558005530-a7958896ec60?q=80&w=2071&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=2014&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1520939817895-060bdaf4fe1b?q=80&w=2073&auto=format&fit=crop'
    ];
  },

  /**
   * Aktivite fotoğraflarını yükler ve döndürür
   * @param activityName Aktivite adı
   * @param city Şehir adı
   * @returns Aktivite fotoğrafları
   */
  async loadActivityPhotos(activityName: string, city: string): Promise<ActivityPhoto[]> {
    try {
      // Önbellek anahtarı oluştur
      const cacheKey = `${activityName}_${city}`;

      // Önbellekte varsa, önbellekten döndür
      if (this.photoCache.has(cacheKey)) {
        console.log(`Önbellekten fotoğraflar alınıyor: ${activityName}, ${city}`);
        return this.photoCache.get(cacheKey) || [];
      }

      // Aktivite adı veya şehir yoksa, varsayılan fotoğrafları döndür
      if (!activityName || !city) {
        console.log('Aktivite adı veya şehir bilgisi eksik, varsayılan fotoğraflar kullanılıyor');
        const dummyUrls = this.getDummyPhotos('', '');
        const dummyPhotos = dummyUrls.map((url: string, index: number) => ({
          imageUrl: url,
          location: activityName || 'Aktivite',
          description: `${activityName || 'Aktivite'} - Fotoğraf ${index + 1}`
        }));
        return dummyPhotos;
      }

      console.log(`Aktivite fotoğrafları yükleniyor: ${activityName}, ${city}`);

      // Google Places API'den fotoğraf URL'lerini al
      const photoUrls = await this.getActivityPhotos(activityName, city);

      // Fotoğraf URL'lerini aktivite fotoğrafı formatına dönüştür
      const activityPhotos = photoUrls.map((url: string, index: number) => ({
        imageUrl: url,
        location: activityName,
        description: `${activityName} - ${city} - Fotoğraf ${index + 1}`
      }));

      // Eğer hiç fotoğraf bulunamadıysa, yedek fotoğrafları kullan
      if (activityPhotos.length === 0) {
        console.log('Fotoğraf bulunamadı, yedek fotoğraflar kullanılıyor');
        const dummyUrls = this.getDummyPhotos(activityName, city);
        const dummyPhotos = dummyUrls.map((url: string, index: number) => ({
          imageUrl: url,
          location: activityName,
          description: `${activityName} - ${city} - Fotoğraf ${index + 1}`
        }));
        
        // Önbelleğe kaydet
        this.photoCache.set(cacheKey, dummyPhotos);
        return dummyPhotos;
      }

      // Önbelleğe kaydet
      this.photoCache.set(cacheKey, activityPhotos);
      return activityPhotos;
    } catch (error) {
      console.error('Aktivite fotoğrafları yükleme hatası:', error);
      // Hata durumunda yedek fotoğraflar kullan
      const backupUrls = this.getDummyPhotos(activityName, city);
      return backupUrls.map((url: string, index: number) => ({
        imageUrl: url,
        location: activityName,
        description: `${activityName} - ${city} - Fotoğraf ${index + 1}`
      }));
    }
  }
};

export default ActivityPhotosService;
