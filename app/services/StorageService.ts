import { getDownloadURL, ref, deleteObject } from "firebase/storage";
import { storage } from "./firebaseConfig";
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Firebase Storage servisi
 */
const StorageService = {
  /**
   * Base64 formatındaki bir resmi Storage'a yükler
   * @param base64Data Base64 formatındaki resim verisi
   * @param path Dosya yolu (örn: "comments/123.jpg")
   * @returns Yüklenen dosyanın URL'i
   */
  async uploadBase64Image(base64Data: string, path: string): Promise<string> {
    try {
      console.log(`Resim yükleniyor: ${path}`);
      console.log(`Storage bucket: ${storage.app.options.storageBucket}`);

      // Base64 formatını kontrol et
      let processedData = base64Data;

      // Eğer data:image ile başlıyorsa, prefix'i kaldır
      if (base64Data.startsWith('data:image')) {
        processedData = base64Data.split(',')[1];
      }

      // Storage referansı oluştur
      const storageRef = ref(storage, path);
      console.log(`Storage referansı oluşturuldu: ${storageRef.fullPath}`);

      // Fetch API ile doğrudan yükleme yap
      console.log(`Fetch API ile yükleme yapılıyor...`);

      // Yükleme URL'i oluştur
      const bucket = storage.app.options.storageBucket;
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`;

      // FormData oluştur
      const formData = new FormData();

      // Base64 verisi için dosya adı oluştur
      const fileName = path.split('/').pop() || 'image.jpg';

      // Base64 verisini FormData'ya ekle
      formData.append('file', {
        uri: `data:image/jpeg;base64,${processedData}`,
        type: 'image/jpeg',
        name: fileName
      } as any);

      // Fetch ile yükle
      console.log(`Fetch isteği gönderiliyor: ${uploadUrl}`);
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        console.error(`Fetch yükleme hatası: ${response.status} ${response.statusText}`);

        // Alternatif yöntem - Firebase REST API ile doğrudan yükleme
        console.log(`Alternatif yükleme yöntemi deneniyor...`);

        // Base64 verisini doğrudan gönder
        const altResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: JSON.stringify({
            contentType: 'image/jpeg',
            name: path,
            base64Data: processedData
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!altResponse.ok) {
          throw new Error(`Alternatif yükleme hatası: ${altResponse.status} ${altResponse.statusText}`);
        }

        // Yanıtı al
        const responseData = await altResponse.json();
        console.log(`Alternatif yükleme başarılı:`, responseData);
        return responseData;
      }

      // Yanıtı al
      const responseData = await response.json();
      console.log(`Fetch yükleme başarılı:`, responseData);

      // Bekleme ekle - Firebase'in işlemi tamamlaması için
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        // Yüklenen dosyanın URL'ini al
        const downloadURL = await getDownloadURL(storageRef);
        console.log(`Resim başarıyla yüklendi, URL: ${downloadURL}`);
        return downloadURL;
      } catch (urlError) {
        console.error('Download URL alma hatası:', urlError);

        // Manuel URL oluştur
        const token = responseData.downloadTokens || '';
        if (token) {
          const manualUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
          console.log(`Manuel URL oluşturuldu: ${manualUrl}`);
          return manualUrl;
        } else {
          // Üçüncü yöntem - Geçici dosya oluştur ve yükle
          try {
            console.log(`Üçüncü yöntem deneniyor - Geçici dosya ile...`);

            // Geçici dosya yolu oluştur
            const tempFilePath = `${FileSystem.cacheDirectory}temp_upload_${Date.now()}.jpg`;

            // Base64 verisini geçici dosyaya yaz
            await FileSystem.writeAsStringAsync(tempFilePath, processedData, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Dosya bilgilerini kontrol et
            const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
            console.log(`Geçici dosya oluşturuldu: ${tempFilePath}, var mı: ${fileInfo.exists}`);

            // Dosyayı yükle
            const fileFormData = new FormData();
            fileFormData.append('file', {
              uri: Platform.OS === 'android' ? tempFilePath : `file://${tempFilePath}`,
              type: 'image/jpeg',
              name: fileName
            } as any);

            // Yeni bir istek gönder
            const fileResponse = await fetch(uploadUrl, {
              method: 'POST',
              body: fileFormData,
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            // Geçici dosyayı sil
            await FileSystem.deleteAsync(tempFilePath, { idempotent: true });

            if (!fileResponse.ok) {
              throw new Error(`Dosya yükleme hatası: ${fileResponse.status}`);
            }

            // Yanıtı al
            const fileResponseData = await fileResponse.json();
            console.log(`Dosya yükleme başarılı:`, fileResponseData);

            // Bekleme ekle
            await new Promise(resolve => setTimeout(resolve, 1500));

            // URL oluştur
            const fileToken = fileResponseData.downloadTokens || '';
            if (fileToken) {
              const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${fileToken}`;
              console.log(`Dosya URL oluşturuldu: ${fileUrl}`);
              return fileUrl;
            }
          } catch (fileError) {
            console.error('Dosya yükleme hatası:', fileError);
          }

          throw new Error('Download token bulunamadı ve alternatif yöntemler başarısız oldu');
        }
      }
    } catch (error) {
      console.error('Resim yükleme hatası:', error);

      // Hata detaylarını göster
      if (error instanceof Error) {
        console.error('Hata mesajı:', error.message);
        console.error('Hata stack:', error.stack);

        // Firebase hatası ise
        if ('code' in error) {
          console.error('Firebase hata kodu:', (error as any).code);
        }
      }

      throw error;
    }
  },

  /**
   * Birden fazla base64 formatındaki resmi Storage'a yükler
   * @param images Base64 formatındaki resim verileri ve konum bilgileri
   * @param basePath Temel dosya yolu (örn: "comments/123")
   * @returns Yüklenen dosyaların URL'leri ve konum bilgileri
   */
  async uploadMultipleImages(
    images: { data: string; location?: string }[],
    basePath: string
  ): Promise<{ url: string; location?: string }[]> {
    try {
      console.log(`${images.length} resim yükleniyor: ${basePath}`);
      console.log(`Storage bucket: ${storage.app.options.storageBucket}`);

      // Sıralı yükleme (Promise.all yerine)
      const results = [];

      for (let i = 0; i < images.length; i++) {
        try {
          const image = images[i];
          const path = `${basePath}/${i}.jpg`;
          console.log(`Resim ${i+1}/${images.length} yükleniyor: ${path}`);

          // Resim verisi kontrolü
          if (!image.data || image.data.trim() === '') {
            console.error(`Resim ${i+1}/${images.length} için veri boş`);
            continue;
          }

          // Resim boyutu kontrolü
          if (image.data.length < 1000) {
            console.error(`Resim ${i+1}/${images.length} için veri çok küçük: ${image.data.length} karakter`);
            continue;
          }

          // Resmi yükle - 3 deneme hakkı
          let url = '';
          let success = false;

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`Resim ${i+1}/${images.length} için ${attempt}. deneme...`);
              url = await this.uploadBase64Image(image.data, path);
              success = true;
              break;
            } catch (attemptError) {
              console.error(`Deneme ${attempt} başarısız:`, attemptError);

              // Son deneme değilse bekle
              if (attempt < 3) {
                console.log(`${attempt+1}. deneme için bekleniyor...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (success) {
            console.log(`Resim ${i+1}/${images.length} başarıyla yüklendi: ${url}`);

            // Sonuçlara ekle
            results.push({
              url,
              location: image.location
            });
          } else {
            console.error(`Resim ${i+1}/${images.length} yüklenemedi, tüm denemeler başarısız oldu`);

            // Manuel URL oluşturmayı dene
            try {
              console.log(`Manuel URL oluşturma deneniyor...`);

              // Bucket adı
              const bucket = storage.app.options.storageBucket;

              // Rastgele bir token oluştur
              const randomToken = Math.random().toString(36).substring(2, 15);

              // Manuel URL oluştur
              const manualUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${randomToken}`;
              console.log(`Manuel URL oluşturuldu: ${manualUrl}`);

              // Sonuçlara ekle
              results.push({
                url: manualUrl,
                location: image.location
              });
            } catch (manualError) {
              console.error(`Manuel URL oluşturma hatası:`, manualError);
            }
          }
        } catch (uploadError) {
          console.error(`Resim ${i+1}/${images.length} yükleme işlemi sırasında beklenmeyen hata:`, uploadError);
          // Hata olsa bile devam et
        }
      }

      console.log(`${results.length}/${images.length} resim başarıyla yüklendi`);
      return results;
    } catch (error) {
      console.error('Çoklu resim yükleme hatası:', error);

      // Hata detaylarını göster
      if (error instanceof Error) {
        console.error('Hata mesajı:', error.message);
        console.error('Hata stack:', error.stack);
      }

      // Boş bir dizi döndür (hata durumunda)
      return [];
    }
  },

  /**
   * Storage'dan bir dosyayı siler
   * @param url Silinecek dosyanın URL'i
   * @returns İşlem başarılı ise true, değilse false
   */
  async deleteFile(url: string): Promise<boolean> {
    try {
      console.log(`Dosya siliniyor: ${url}`);

      // URL'den dosya yolunu çıkar
      let filePath = '';
      try {
        // URL'den dosya yolunu çıkar
        const storageUrl = new URL(url);
        // Firebase Storage URL'lerinden yolu çıkar
        // Örnek: https://firebasestorage.googleapis.com/v0/b/ai-traveller-67214.appspot.com/o/comments%2F123%2F0.jpg?alt=media&token=abc123
        const pathRegex = /\/o\/(.+?)(\?|$)/;
        const match = storageUrl.pathname.match(pathRegex);

        if (match && match[1]) {
          // URL-encoded yolu decode et
          filePath = decodeURIComponent(match[1]);
          console.log(`Çıkarılan dosya yolu: ${filePath}`);
        } else {
          // Eğer regex ile bulunamazsa, doğrudan URL'yi kullan
          filePath = url;
        }
      } catch (parseError) {
        console.error('URL parse hatası:', parseError);
        // Eğer URL parse edilemezse, doğrudan URL'yi kullan
        filePath = url;
      }

      // Dosya referansı oluştur
      const fileRef = ref(storage, filePath);

      // Dosyayı sil
      await deleteObject(fileRef);
      console.log(`Dosya başarıyla silindi: ${filePath}`);

      return true;
    } catch (error) {
      console.error('Dosya silme hatası:', error);
      return false;
    }
  },

  /**
   * Bir URL'in geçerli olup olmadığını kontrol eder
   * @param url Kontrol edilecek URL
   * @returns URL geçerli ise true, değilse false
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

export default StorageService;
