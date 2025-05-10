/**
 * Firebase Cloud Functions for AITravellerMobile
 * 
 * Bu dosya, AITravellerMobile uygulaması için Firebase Cloud Functions tanımlarını içerir.
 * Özellikle CORS kısıtlaması olan API'lere erişim için proxy işlevleri sağlar.
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const fetch = require('node-fetch');

/**
 * Google Places API Text Search için proxy işlevi
 * 
 * Bu işlev, mobil uygulamadan gelen istekleri Google Places API'ye iletir
 * ve sonuçları döndürür. CORS kısıtlamalarını aşmak için kullanılır.
 */
exports.proxyApi = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      // İstek yolunu kontrol et
      const path = request.path.split('/')[1] || '';
      
      // İstek metodunu kontrol et
      if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed. Use POST.' });
      }
      
      // API anahtarını kontrol et
      const apiKey = request.body.key;
      if (!apiKey) {
        return response.status(400).json({ error: 'API key is required' });
      }
      
      // Text Search isteği
      if (path === 'textSearch') {
        const query = request.body.query;
        if (!query) {
          return response.status(400).json({ error: 'Query parameter is required' });
        }
        
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
        const apiResponse = await fetch(url);
        const data = await apiResponse.json();
        
        return response.json(data);
      }
      
      // Place Details isteği
      else if (path === 'placeDetails') {
        const placeId = request.body.placeId;
        const fields = request.body.fields || 'photos';
        
        if (!placeId) {
          return response.status(400).json({ error: 'Place ID is required' });
        }
        
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
        const apiResponse = await fetch(url);
        const data = await apiResponse.json();
        
        return response.json(data);
      }
      
      // Bilinmeyen istek yolu
      else {
        return response.status(404).json({ error: 'Unknown API endpoint' });
      }
    } catch (error) {
      console.error('Proxy API error:', error);
      return response.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });
});

/**
 * Otel fotoğraflarını getirmek için özel işlev
 * 
 * Bu işlev, bir otel adı ve şehir bilgisi alır, Google Places API'yi kullanarak
 * oteli bulur ve fotoğraflarını döndürür.
 */
exports.getHotelPhotos = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    try {
      // İstek metodunu kontrol et
      if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed. Use POST.' });
      }
      
      // Parametreleri kontrol et
      const { hotelName, city, apiKey } = request.body;
      
      if (!hotelName || !city || !apiKey) {
        return response.status(400).json({ 
          error: 'Missing parameters', 
          required: ['hotelName', 'city', 'apiKey'] 
        });
      }
      
      // Adım 1: Places API Text Search ile oteli bul
      const searchQuery = `${hotelName} hotel ${city}`;
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (!searchData.results || searchData.results.length === 0) {
        return response.json({ photos: [] });
      }
      
      // İlk sonucu al (en alakalı)
      const placeId = searchData.results[0].place_id;
      
      // Adım 2: Fotoğraflar dahil yer detaylarını al
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`;
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();
      
      if (!detailsData.result || !detailsData.result.photos || detailsData.result.photos.length === 0) {
        return response.json({ photos: [] });
      }
      
      // Tüm mevcut fotoğrafları al (maksimum 50)
      const photoReferences = detailsData.result.photos
        .slice(0, 50)
        .map(photo => photo.photo_reference);
      
      // Adım 3: Her referans için fotoğraf URL'lerini oluştur
      const photoUrls = photoReferences.map(
        reference => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${reference}&key=${apiKey}`
      );
      
      return response.json({ photos: photoUrls });
    } catch (error) {
      console.error('Get hotel photos error:', error);
      return response.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });
});
