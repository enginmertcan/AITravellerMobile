import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Image, Modal, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { FirebaseService } from '../services/firebase.service';
import { CommentPhoto, TripComment } from '../types/travel';
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AppStyles from '@/constants/AppStyles';

interface TripCommentsProps {
  travelPlanId: string;
}

const TripComments: React.FC<TripCommentsProps> = ({ travelPlanId }) => {
  const { userId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [comments, setComments] = useState<TripComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Çoklu fotoğraf desteği
  const [selectedImages, setSelectedImages] = useState<Array<{uri: string, location?: string}>>([]);

  // Geriye uyumluluk için
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoLocation, setPhotoLocation] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhotoForModal, setSelectedPhotoForModal] = useState<{ url: string, location?: string } | null>(null);

  // Fotoğraf galerisi için
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<Array<{url: string, location?: string}>>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Yorumları yükle
  useEffect(() => {
    loadComments();
  }, [travelPlanId]);

  const loadComments = async () => {
    if (!travelPlanId) return;

    setLoading(true);
    try {
      // 1. Önce yorumları getir
      const commentsData = await FirebaseService.Comment.getCommentsByTravelPlanId(travelPlanId);

      // 2. Sonra yorum fotoğraflarını getir
        const commentPhotos = await FirebaseService.CommentPhoto.getPhotosByTravelPlanId(travelPlanId);

      // 3. Her yoruma ait fotoğrafları eşleştir
      if (commentPhotos.length > 0) {
        for (const comment of commentsData) {
          // Bu yoruma ait fotoğrafı bul
          const commentPhoto = commentPhotos.find(photo => photo.commentId === comment.id);

          if (commentPhoto) {
            // Fotoğraf verilerini yoruma ekle
            if (commentPhoto.photoData) {
              comment.photoData = commentPhoto.photoData;
            }

            if (commentPhoto.photoLocation) {
              comment.photoLocation = commentPhoto.photoLocation;
            }
          }
        }
      }

      // Yorum fotoğraflarını kontrol et
      commentsData.forEach((comment, index) => {
        if (comment.photoUrl) {
          console.log(`  photoUrl: ${comment.photoUrl.substring(0, 30)}...`);
        }
        if (comment.photoData) {
          console.log(`  photoData uzunluğu: ${comment.photoData.length}`);
        }
      });

      setComments(commentsData);
    } catch (error) {
      console.error('Yorumları yükleme hatası:', error);
      Alert.alert('Hata', 'Yorumlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Fotoğraf seçme işlemi
  const handleSelectImage = async () => {
    try {
      // İzinleri kontrol et
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişim izni gereklidir.');
        return;
      }

      // Fotoğraf seçiciyi aç
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1.0, // En yüksek kalite
        aspect: [4, 3],
        exif: false, // EXIF verilerini alma (daha hızlı)
      });

      console.log('Fotoğraf seçme sonucu:', result.canceled ? 'İptal edildi' : 'Seçildi');

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Yeni fotoğraf URI'sini al
        const newImageUri = result.assets[0].uri;
        console.log('Seçilen fotoğraf URI:', newImageUri);

        // Fotoğrafın varlığını kontrol et
        try {
          const fileInfo = await FileSystem.getInfoAsync(newImageUri);
          if (!fileInfo.exists) {
            console.error('Seçilen fotoğraf dosyası bulunamadı:', newImageUri);
            Alert.alert('Hata', 'Seçilen fotoğraf dosyası bulunamadı.');
            return;
          }
          console.log('Fotoğraf dosya boyutu:', fileInfo.size);

          // Dosya boyutu çok küçükse uyarı ver (muhtemelen bozuk dosya)
          if (fileInfo.size < 1000) {
            console.warn('Fotoğraf dosyası çok küçük, muhtemelen bozuk:', fileInfo.size);
            Alert.alert('Uyarı', 'Seçilen fotoğraf geçersiz görünüyor. Lütfen başka bir fotoğraf seçin.');
            return;
          }
        } catch (fileError) {
          console.error('Dosya kontrolü hatası:', fileError);
        }

        // Fotoğrafı doğrudan ekle (konum bilgisi olmadan)
        console.log('Fotoğraf doğrudan ekleniyor...');
        await addPhotoToSelection(newImageUri, '');
      }
    } catch (error) {
      console.error('Fotoğraf seçme hatası:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  // Fotoğrafı seçime ekle (yardımcı fonksiyon)
  const addPhotoToSelection = async (uri: string, location: string) => {
    try {
      // Fotoğrafı daha kalıcı bir yere kopyala
      const fileExtension = uri.split('.').pop() || 'jpg';
      const fileName = `photo_${new Date().getTime()}.${fileExtension}`;
      const destinationUri = `${FileSystem.documentDirectory}photos/${fileName}`;

      // photos dizini yoksa oluştur
      const photosDir = `${FileSystem.documentDirectory}photos`;
      const photosDirInfo = await FileSystem.getInfoAsync(photosDir);
      if (!photosDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
        console.log('Photos dizini oluşturuldu:', photosDir);
      }

      // Dosyayı kopyala
      await FileSystem.copyAsync({
        from: uri,
        to: destinationUri
      });

      console.log(`Fotoğraf kopyalandı: ${uri} -> ${destinationUri}`);

      // Dosyanın varlığını kontrol et
      const fileInfo = await FileSystem.getInfoAsync(destinationUri);
      if (!fileInfo.exists) {
        console.error('Kopyalanan dosya bulunamadı:', destinationUri);
        Alert.alert('Hata', 'Fotoğraf kaydedilemedi.');
        return;
      }

      console.log('Kopyalanan dosya boyutu:', fileInfo.size);

      // Geriye uyumluluk için
      setSelectedImage(destinationUri);
      setPhotoLocation(location);

      // Yeni çoklu fotoğraf desteği
      setSelectedImages(prevImages => {
        const newImages = [
          ...prevImages,
          { uri: destinationUri, location }
        ];
        console.log(`Fotoğraf listeye eklendi, toplam: ${newImages.length}`);
        return newImages;
      });
    } catch (error) {
      console.error('Fotoğraf kopyalama hatası:', error);
      Alert.alert('Hata', 'Fotoğraf kaydedilemedi.');

      // Hata durumunda orijinal URI'yi kullan
      setSelectedImage(uri);
      setPhotoLocation(location);

      setSelectedImages(prevImages => {
        const newImages = [
          ...prevImages,
          { uri, location }
        ];
        return newImages;
      });
    }
  };

  // Fotoğrafı temizle
  const handleClearImage = () => {
    // Geriye uyumluluk için
    setSelectedImage(null);
    setPhotoLocation('');

    // Yeni çoklu fotoğraf desteği
    setSelectedImages([]);
  };

  // Fotoğrafa tıklama işlemi - Tamamen yenilenmiş versiyon
  const handlePhotoPress = (photo: { url: string, location?: string }) => {
    console.log(`Fotoğrafa tıklandı: ${photo.url.substring(0, 30)}...`);
    console.log(`Konum bilgisi: ${photo.location || 'Yok'}`);

    // Fotoğraf URL'sinin geçerli olup olmadığını kontrol et
    if (!photo.url || photo.url.trim() === '') {
      console.error('Geçersiz fotoğraf URL\'si');
      Alert.alert('Hata', 'Fotoğraf görüntülenemiyor.');
      return;
    }

    // URL'yi işle - daha kapsamlı format kontrolü
    let processedUrl = photo.url;

    // 1. HTTP/HTTPS URL'leri
    if (processedUrl.includes('firebasestorage.googleapis.com') ||
        processedUrl.startsWith('https://') ||
        processedUrl.startsWith('http://')) {
      console.log('HTTP URL formatı algılandı, doğrudan kullanılıyor');
      // URL'yi olduğu gibi kullan
    }
    // 2. Data URI (base64)
    else if (processedUrl.startsWith('data:image')) {
      console.log('Data URI formatı algılandı, doğrudan kullanılıyor');
      // URL'yi olduğu gibi kullan
    }
    // 3. Yerel dosya yolu
    else if (processedUrl.startsWith('file://') || processedUrl.startsWith('/')) {
      console.log('Yerel dosya yolu algılandı, doğrudan kullanılıyor');
      // URL'yi olduğu gibi kullan
    }
    // 4. Base64 verisi (prefix olmadan)
    else if (processedUrl.length > 100) {
      console.log('Base64 verisi algılandı, prefix ekleniyor');
      processedUrl = `data:image/jpeg;base64,${processedUrl}`;
    }

    console.log(`İşlenmiş URL: ${processedUrl.substring(0, 30)}...`);

    // Modal için fotoğraf bilgilerini ayarla
    setSelectedPhotoForModal({
      url: processedUrl,
      location: photo.location
    });

    // Modalı göster
    setModalVisible(true);
  };

  // Yeni yorum ekle
  const handleAddComment = async () => {
    if ((!newComment.trim() && selectedImages.length === 0) || !userId || !isUserLoaded || !user) return;

    setSubmitting(true);
    try {
      console.log('Yorum ekleme işlemi başlatılıyor...');
      console.log(`Seçilen fotoğraf sayısı: ${selectedImages.length}`);

      // Çoklu fotoğraf desteği için
      const photoUploadPromises: Array<Promise<{data: string, location?: string}>> = [];

      // Seçilen tüm fotoğrafları işle
      for (const image of selectedImages) {
        try {
          console.log(`Fotoğraf işleniyor: ${image.uri.substring(0, 30)}...`);

          // Fotoğrafın varlığını kontrol et
          const fileInfo = await FileSystem.getInfoAsync(image.uri);
          if (!fileInfo.exists) {
            console.error('Fotoğraf dosyası bulunamadı:', image.uri);
            continue; // Bu fotoğrafı atla
          }
          console.log(`Fotoğraf dosya boyutu: ${fileInfo.size}`);

          // Fotoğraf URI'sini data olarak ekle
          photoUploadPromises.push(Promise.resolve({
            data: image.uri,
            location: image.location
          }));
        } catch (error) {
          console.error(`Fotoğraf işleme hatası (${image.uri.substring(0, 30)}...):`, error);
          // Bir fotoğraf işlenemese bile diğerlerini işlemeye devam et
        }
      }

      // Geriye uyumluluk için tek fotoğraf desteği
      // Eğer fotoğraf seçilmişse ve çoklu fotoğraf listesi boşsa, yükle
      if (selectedImage && selectedImages.length === 0) {
        try {
          console.log('Tek fotoğraf işleniyor...');

          // Fotoğrafın varlığını kontrol et
          const fileInfo = await FileSystem.getInfoAsync(selectedImage);
          if (!fileInfo.exists) {
            console.error('Fotoğraf dosyası bulunamadı:', selectedImage);
            Alert.alert('Hata', 'Seçilen fotoğraf dosyası bulunamadı.');
            setSubmitting(false);
            return;
          }
          console.log(`Fotoğraf dosya boyutu: ${fileInfo.size}`);

          // Konum bilgisi varsa ekle
          const photoLocationValue = photoLocation && photoLocation.trim() !== '' ? photoLocation.trim() : undefined;

          // Fotoğraf URI'sini data olarak listeye ekle
          photoUploadPromises.push(Promise.resolve({
            data: selectedImage,
            location: photoLocationValue
          }));
        } catch (error) {
          console.error('Fotoğraf işleme hatası:', error);
          Alert.alert('Hata', 'Fotoğraf işlenirken bir hata oluştu.');
          setSubmitting(false);
          return;
        }
      }

      // Tüm fotoğraf URI'lerini al
      const photoUriArray = await Promise.all(photoUploadPromises);
      console.log(`İşlenen toplam fotoğraf sayısı: ${photoUriArray.length}`);

      // 1. Önce yorumu ekle
      // Kullanıcı adını doğru şekilde oluştur
      let userName = 'Misafir';
      if (user.fullName && user.fullName.trim() !== '') {
        userName = user.fullName;
      } else if (user.firstName || user.lastName) {
        userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      }

      console.log('Yorum ekleyen kullanıcı:', userName);

      const commentData: Omit<TripComment, 'id' | 'createdAt' | 'updatedAt'> = {
        travelPlanId,
        userId,
        userName: userName,
        userPhotoUrl: user.imageUrl || undefined,
        content: newComment.trim(),
      };

      console.log('Yorum Firebase\'e gönderiliyor...');

      // Çoklu fotoğraf desteği ile yorum ekle
      const commentId = await FirebaseService.Comment.addComment(commentData, photoUriArray);
      console.log(`Yorum başarıyla eklendi, ID: ${commentId}`);

      // Formu temizle
      setNewComment('');
      setSelectedImage(null);
      setPhotoLocation('');
      setSelectedImages([]);

      console.log('Yorumlar yeniden yükleniyor...');
      await loadComments(); // Yorumları yeniden yükle
    } catch (error) {
      console.error('Yorum ekleme hatası:', error);
      Alert.alert('Hata', 'Yorum eklenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Yorumu düzenlemeye başla
  const startEditing = (comment: TripComment) => {
    setEditingComment(comment.id);
    setEditText(comment.content);
  };

  // Yorumu güncelle
  const handleUpdateComment = async (commentId: string) => {
    if (!editText.trim()) return;

    setSubmitting(true);
    try {
      // Sadece içeriği güncelle, fotoğrafları değiştirme
      await FirebaseService.Comment.updateComment(commentId, {
        content: editText.trim(),
      });
      setEditingComment(null);
      await loadComments(); // Yorumları yeniden yükle
    } catch (error) {
      console.error('Yorum güncelleme hatası:', error);
      Alert.alert('Hata', 'Yorum güncellenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Yorumu sil
  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      'Yorumu Sil',
      'Bu yorumu silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              // 1. Önce yoruma ait fotoğrafları sil
              try {
                console.log(`Yorum fotoğrafları kontrol ediliyor...`);
                const photos = await FirebaseService.CommentPhoto.getPhotosByCommentId(commentId);

                // Fotoğrafları sil
                if (photos.length > 0) {
                  console.log(`${photos.length} yorum fotoğrafı bulundu, siliniyor...`);

                  for (const photo of photos) {
                    await FirebaseService.CommentPhoto.deletePhoto(photo.id);
                    console.log(`Fotoğraf silindi: ${photo.id}`);
                  }
                }
              } catch (photoError) {
                console.error(`Fotoğraf silme hatası:`, photoError);
                // Fotoğraflar silinemese bile yorumu silmeye devam et
              }

              // 2. Sonra yorumu sil
              await FirebaseService.Comment.deleteComment(commentId);
              await loadComments(); // Yorumları yeniden yükle
            } catch (error) {
              console.error('Yorum silme hatası:', error);
              Alert.alert('Hata', 'Yorum silinirken bir hata oluştu.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Tarih formatı
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: tr
      });
    } catch (error) {
      return 'bilinmeyen tarih';
    }
  };

  // Fotoğraf kaynağını belirle - Tamamen yenilenmiş versiyon
  const getImageSource = (photoUrl?: string, photoData?: string, itemId?: string) => {

    try {
      // Önce photoUrl kontrolü (daha güvenilir)
      if (photoUrl && photoUrl.trim() !== '') {
        // 1. HTTP/HTTPS URL'leri
        if (photoUrl.includes('firebasestorage.googleapis.com') ||
            photoUrl.startsWith('https://') ||
            photoUrl.startsWith('http://')) {
          console.log(`  ${itemId || 'global'} için HTTP URL kullanılıyor: ${photoUrl.substring(0, 30)}...`);
          return { uri: photoUrl };
        }

        // 2. Data URI (base64)
        if (photoUrl.startsWith('data:image')) {
          console.log(`  ${itemId || 'global'} için data:image URL'i kullanılıyor`);

          // Bazı durumlarda data:image URL'leri React Native'de sorun çıkarabilir
          // Bu durumda base64 kısmını ayıklayıp yeniden formatlamak gerekebilir
          try {
            const parts = photoUrl.split('base64,');
            if (parts.length > 1) {
              const base64Data = parts[1];
              // Eğer base64 verisi geçerliyse, yeniden formatla
              if (base64Data && base64Data.length > 10) {
                console.log(`  ${itemId || 'global'} için data:image URL'i yeniden formatlandı`);
                return { uri: `data:image/jpeg;base64,${base64Data}` };
              }
            }
          } catch (innerError) {
            console.log(`  Base64 ayıklama hatası, orijinal URL kullanılıyor: ${innerError}`);
          }

          // Ayıklama başarısız olursa orijinal URL'yi kullan
          return { uri: photoUrl };
        }

        // 3. Yerel dosya yolu
        if (photoUrl.startsWith('file://') || photoUrl.startsWith('/')) {
          console.log(`  ${itemId || 'global'} için yerel dosya yolu kullanılıyor: ${photoUrl.substring(0, 30)}...`);
          return { uri: photoUrl };
        }

        // 4. Base64 verisi (prefix olmadan)
        // Base64 verisi genellikle uzun olur ve özel karakterler içerir
        if (photoUrl.length > 100 && /^[A-Za-z0-9+/=]+$/.test(photoUrl.substring(0, 20))) {
          console.log(`  ${itemId || 'global'} için base64 verisi prefix eklenerek kullanılıyor`);
          return { uri: `data:image/jpeg;base64,${photoUrl}` };
        }

        // 5. Diğer URI formatları
        console.log(`  ${itemId || 'global'} için bilinmeyen URI formatı, direkt kullanılıyor: ${photoUrl.substring(0, 30)}...`);
        return { uri: photoUrl };
      }

      // Sonra photoData kontrolü
      if (photoData && photoData.trim() !== '') {
        console.log(`  ${itemId || 'global'} için photoData kullanılıyor (uzunluk: ${photoData.length})`);

        // 1. Data URI (base64)
        if (photoData.startsWith('data:image')) {
          console.log(`  ${itemId || 'global'} için photoData data:image formatında`);
          return { uri: photoData };
        }

        // 2. Base64 verisi (prefix olmadan)
        if (photoData.length > 100) {
          console.log(`  ${itemId || 'global'} için photoData base64 formatına dönüştürülüyor`);
          return { uri: `data:image/jpeg;base64,${photoData}` };
        }

        // 3. Diğer formatlar
        console.log(`  ${itemId || 'global'} için photoData bilinmeyen formatta, direkt kullanılıyor`);
        return { uri: photoData };
      }

      // Hiçbir kaynak bulunamadıysa placeholder göster
      console.log(`  ${itemId || 'global'} için fotoğraf kaynağı bulunamadı, placeholder kullanılıyor`);
      return require('../assets/images/placeholder.png');
    } catch (error) {
      console.error(`  Fotoğraf kaynağı belirleme hatası: ${error}`);
      console.log(`  Hata nedeniyle placeholder kullanılıyor`);
      return require('../assets/images/placeholder.png');
    }
  };

  // Yorum öğesi
  const renderCommentItem = ({ item }: { item: TripComment }) => {
    // Yorum öğesi için dinamik stiller
    const itemStyles = {
      commentItem: dynamicStyles.commentItem,
      photoContainer: dynamicStyles.photoContainer,
      editInput: dynamicStyles.editInput,
      cancelButton: dynamicStyles.cancelButton,
      userName: dynamicStyles.userName,
      commentDate: dynamicStyles.commentDate,
      commentContent: dynamicStyles.commentContent,
      editButtonText: dynamicStyles.editButtonText,
    };
    const isCurrentUser = userId === item.userId;



    // Yorumun tüm fotoğraflarını al - Geliştirilmiş versiyon
    const getCommentPhotos = (): Array<{url: string, location?: string}> => {
      console.log(`Yorum fotoğrafları alınıyor: ${item.id}`);
      console.log(`Yorum verileri: photosJson=${!!item.photosJson}, photoUrl=${!!item.photoUrl}, photoData=${!!item.photoData}`);

      const photos: Array<{url: string, location?: string}> = [];

      // 1. Önce photosJson alanını kontrol et (en güvenilir kaynak)
      if (item.photosJson && item.photosJson.trim() !== '') {
        try {
          console.log(`photosJson alanı mevcut, parse ediliyor...`);
          let parsedPhotos;

          try {
            parsedPhotos = JSON.parse(item.photosJson);
          } catch (innerError) {
            // JSON parse hatası durumunda, string içindeki kaçış karakterlerini temizlemeyi dene
            console.log('İlk JSON parse başarısız, string temizleniyor...');
            const cleanString = item.photosJson
              .replace(/\\"/g, '"')  // Kaçış karakterli çift tırnakları düzelt
              .replace(/^"(.*)"$/, '$1'); // Başta ve sonda çift tırnak varsa kaldır

            parsedPhotos = JSON.parse(cleanString);
          }

          if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
            console.log(`${parsedPhotos.length} fotoğraf bulundu (photosJson)`);

            // Her fotoğrafı işle
            for (const photo of parsedPhotos) {
              if (photo && photo.url && photo.url.trim() !== '') {
                let url = photo.url;

                // URL formatını düzelt
                if (!url.startsWith('data:image') && !url.startsWith('http') && !url.startsWith('file://') && url.length > 100) {
                  url = `data:image/jpeg;base64,${url}`;
                }

                photos.push({
                  url: url,
                  location: photo.location
                });
              }
            }

            if (photos.length > 0) {
              console.log(`${photos.length} geçerli fotoğraf işlendi`);
              return photos;
            }
          }
        } catch (e) {
          console.error(`JSON parse hatası (${item.id}):`, e);
        }
      }

      // 2. Geriye uyumluluk için photoUrl alanını kontrol et
      if (item.photoUrl && item.photoUrl.trim() !== '') {
        console.log(`photoUrl alanı mevcut: ${item.photoUrl?.substring(0, 30)}...`);
        let url = item.photoUrl;

        // URL formatını düzelt
        if (!url.startsWith('data:image') && !url.startsWith('http') && !url.startsWith('file://') && url.length > 100) {
          url = `data:image/jpeg;base64,${url}`;
          console.log('photoUrl base64 formatına dönüştürüldü');
        }

        console.log(`Tek fotoğraf eklendi (photoUrl): ${url.substring(0, 30)}...`);
        return [{
          url: url,
          location: item.photoLocation
        }];
      }

      // 3. En son çare olarak photoData alanını kontrol et
      if (item.photoData && item.photoData.trim() !== '') {
        console.log(`photoData alanı mevcut, uzunluk: ${item.photoData.length}`);
        let data = item.photoData;

        // Base64 formatını düzelt
        if (!data.startsWith('data:image')) {
          data = `data:image/jpeg;base64,${data}`;
          console.log('photoData base64 formatına dönüştürüldü');
        }

        console.log(`Tek fotoğraf eklendi (photoData): ${data.substring(0, 30)}...`);
        return [{
          url: data,
          location: item.photoLocation
        }];
      }

      console.log(`Yorum için fotoğraf bulunamadı: ${item.id}`);
      return [];
    };

    // Yorumun fotoğraflarını al
    const commentPhotos = getCommentPhotos();

    return (
      <View style={itemStyles.commentItem}>
        <View style={styles.commentHeader}>
          <ThemedText style={dynamicStyles.userName}>{item.userName}</ThemedText>
          <ThemedText style={dynamicStyles.commentDate}>{formatDate(item.createdAt)}</ThemedText>
        </View>

        {editingComment === item.id ? (
          <View style={styles.editContainer}>
            <TextInput
              style={itemStyles.editInput}
              value={editText}
              onChangeText={setEditText}
              placeholderTextColor={AppStyles.colors.dark.textMuted}
              multiline
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, itemStyles.cancelButton]}
                onPress={() => setEditingComment(null)}
              >
                <ThemedText style={dynamicStyles.editButtonText}>İptal</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={() => handleUpdateComment(item.id)}
                disabled={submitting}
              >
                <ThemedText style={dynamicStyles.editButtonText}>Kaydet</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <ThemedText style={dynamicStyles.commentContent}>{item.content}</ThemedText>

            {commentPhotos.length > 0 && (
              <View style={styles.photosContainer}>
                {commentPhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={`photo-${item.id}-${index}`}
                    style={[
                      itemStyles.photoContainer,
                      commentPhotos.length > 1 ? styles.multiplePhotosItem : styles.singlePhotoItem
                    ]}
                    onPress={() => {
                      console.log(`Fotoğrafa tıklandı: ${item.id}, fotoğraf ${index}`);

                      // Fotoğraf URL'sini al
                      const photoUrl = photo.url;

                      if (photoUrl) {
                        // Fotoğraf kaynağını belirle
                        const imageSource = getImageSource(photoUrl, photoUrl, item.id);

                        if (imageSource && imageSource.uri) {
                          console.log(`Modal için fotoğraf URL'si: ${imageSource.uri.substring(0, 30)}...`);

                          // Tüm fotoğrafları galeri modunda göstermek için
                          if (commentPhotos.length > 1) {
                            // Galeri modunda göster
                            setGalleryPhotos(commentPhotos);
                            setCurrentPhotoIndex(index);
                            setGalleryVisible(true);
                          } else {
                            // Tek fotoğraf modunda göster
                            handlePhotoPress({
                              url: imageSource.uri,
                              location: photo.location
                            });
                          }
                        } else {
                          // Yerel resim kaynağı için
                          console.log('Modal için yerel fotoğraf kaynağı kullanılıyor');

                          // Placeholder görüntüsünü kullan
                          handlePhotoPress({
                            url: 'https://via.placeholder.com/300x200/4c669f/ffffff?text=Resim+Yok',
                            location: photo.location
                          });
                        }
                      } else {
                        console.error('Geçerli fotoğraf kaynağı bulunamadı');
                        Alert.alert('Hata', 'Fotoğraf görüntülenemiyor.');
                      }
                    }}
                  >
                    {/* Fotoğraf bileşeni - Tamamen yenilenmiş versiyon */}
                    {React.createElement(() => {
                      // Fotoğraf yükleme durumunu takip etmek için state
                      const [isLoading, setIsLoading] = React.useState(true);
                      const [hasError, setHasError] = React.useState(false);

                      return (
                        <>
                          {/* Yükleme göstergesi - sadece yüklenirken göster */}
                          {isLoading && (
                            <View style={styles.photoLoadingContainer}>
                              <ActivityIndicator size="small" color="#0066cc" />
                              <ThemedText style={styles.photoLoadingText}>Yükleniyor...</ThemedText>
                            </View>
                          )}

                          {/* Fotoğraf */}
                          <Image
                            source={getImageSource(photo.url, photo.url, item.id)}
                            style={[
                              styles.commentPhoto,
                              commentPhotos.length > 1 ? styles.multiplePhotosImage : styles.singlePhotoImage,
                              hasError && styles.errorImage
                            ]}
                            resizeMode={commentPhotos.length > 1 ? "cover" : "contain"}
                            onLoadStart={() => {
                              console.log(`Fotoğraf yükleniyor (${item.id}): ${photo.url?.substring(0, 30)}...`);
                              setIsLoading(true);
                              setHasError(false);
                            }}
                            onLoad={() => {
                              console.log(`Fotoğraf başarıyla yüklendi (${item.id})`);
                              setIsLoading(false);
                            }}
                            onError={(error) => {
                              console.error(`Fotoğraf yükleme hatası (${item.id}):`, error.nativeEvent.error);
                              console.log(`Hatalı URL: ${photo.url?.substring(0, 50)}...`);
                              setIsLoading(false);
                              setHasError(true);
                            }}
                            defaultSource={require('../assets/images/placeholder.png')}
                          />
                        </>
                      );
                    })}

                    {photo.location && (
                      <View style={styles.photoLocationBadge}>
                        <MaterialCommunityIcons name="map-marker" size={12} color="#fff" />
                        <ThemedText style={styles.photoLocationText} numberOfLines={1} ellipsizeMode="tail">
                          {photo.location}
                        </ThemedText>
                      </View>
                    )}

                    {/* Çoklu fotoğraf göstergesi */}
                    {commentPhotos.length > 1 && index === 0 && (
                      <View style={styles.photoCountBadge}>
                        <MaterialCommunityIcons name="image-multiple" size={12} color="#fff" />
                        <ThemedText style={styles.photoCountText}>
                          {commentPhotos.length}
                        </ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {isCurrentUser && editingComment !== item.id && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => startEditing(item)}
            >
              <Ionicons name="pencil" size={16} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteComment(item.id)}
            >
              <Ionicons name="trash" size={16} color="#d9534f" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Dark mode stiller
  const dynamicStyles = {
    container: {
      ...styles.container,
      backgroundColor: '#111',
      borderColor: '#4c669f',
    },
    commentItem: {
      ...styles.commentItem,
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      borderColor: '#4c669f',
    },
    input: {
      ...styles.input,
      backgroundColor: '#111',
      borderColor: '#4c669f',
      color: AppStyles.colors.dark.text,
    },
    photoButton: {
      ...styles.photoButton,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: '#4c669f',
    },
    previewContainer: {
      ...styles.previewContainer,
      backgroundColor: '#111',
      borderColor: '#4c669f',
    },
    photoContainer: {
      ...styles.photoContainer,
      backgroundColor: '#111',
    },
    editInput: {
      ...styles.editInput,
      backgroundColor: '#111',
      borderColor: '#4c669f',
      color: AppStyles.colors.dark.text,
    },
    cancelButton: {
      ...styles.cancelButton,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: '#4c669f',
    },
    locationContainer: {
      ...styles.locationContainer,
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
    },
    locationText: {
      ...styles.locationText,
      color: AppStyles.colors.dark.text,
    },
    clearButton: {
      ...styles.clearButton,
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
    },
    inputContainer: {
      ...styles.inputContainer,
      borderTopColor: '#4c669f',
    },
    noComments: {
      ...styles.noComments,
      color: AppStyles.colors.dark.textMuted,
    },
    userName: {
      ...styles.userName,
      color: AppStyles.colors.dark.text,
    },
    commentDate: {
      ...styles.commentDate,
      color: AppStyles.colors.dark.textMuted,
    },
    commentContent: {
      ...styles.commentContent,
      color: AppStyles.colors.dark.text,
    },
    title: {
      ...styles.title,
      color: AppStyles.colors.dark.text,
      backgroundColor: '#111',
      borderWidth: 1,
      borderColor: '#4c669f',
    },
    editButtonText: {
      ...styles.editButtonText,
      color: AppStyles.colors.dark.text,
    },
    modalContent: {
      ...styles.modalContent,
      backgroundColor: '#111',
    },
  };

  return (
    <View style={dynamicStyles.container}>
      <ThemedText style={dynamicStyles.title}>Yorumlar</ThemedText>

      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
      ) : (
        <>
          {comments.length > 0 ? (
            <FlatList
              data={comments}
              renderItem={renderCommentItem}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              initialNumToRender={5}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          ) : (
            <ThemedText style={dynamicStyles.noComments}>Henüz yorum yapılmamış. İlk yorumu siz yapın!</ThemedText>
          )}
        </>
      )}

      {/* Fotoğraf Önizleme - Çoklu Fotoğraf Desteği */}
      {selectedImages.length > 0 ? (
        <View style={styles.photosContainer}>
          {selectedImages.map((image, index) => (
            <View key={`preview-${index}`} style={[dynamicStyles.previewContainer, selectedImages.length > 1 && styles.multiplePhotosItem]}>
              <Image
                source={{ uri: image.uri }}
                style={[styles.previewImage, selectedImages.length > 1 && styles.multiplePhotosImage]}
                defaultSource={require('../assets/images/placeholder.png')}
              />
              {image.location ? (
                <View style={dynamicStyles.locationContainer}>
                  <MaterialCommunityIcons name="map-marker" size={12} color="#4c669f" />
                  <ThemedText style={dynamicStyles.locationText} numberOfLines={1}>{image.location}</ThemedText>
                </View>
              ) : null}
              <TouchableOpacity
                style={dynamicStyles.clearButton}
                onPress={() => {
                  // Sadece bu fotoğrafı kaldır
                  setSelectedImages(prevImages => prevImages.filter((_, i) => i !== index));
                  console.log(`Fotoğraf kaldırıldı, kalan: ${selectedImages.length - 1}`);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#d9534f" />
              </TouchableOpacity>
            </View>
          ))}
          {selectedImages.length > 1 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearImage}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <ThemedText style={styles.clearAllText}>Tümünü Temizle</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      ) : selectedImage ? (
        <View style={dynamicStyles.previewContainer}>
          <Image
            source={{ uri: selectedImage }}
            style={styles.previewImage}
            defaultSource={require('../assets/images/placeholder.png')}
          />
          {photoLocation ? (
            <View style={dynamicStyles.locationContainer}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#4c669f" />
              <ThemedText style={dynamicStyles.locationText} numberOfLines={1}>{photoLocation}</ThemedText>
            </View>
          ) : null}
          <TouchableOpacity style={dynamicStyles.clearButton} onPress={handleClearImage}>
            <Ionicons name="close-circle" size={24} color="#d9534f" />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={dynamicStyles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={dynamicStyles.input}
            placeholder="Yorum yazın..."
            placeholderTextColor={AppStyles.colors.dark.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={dynamicStyles.photoButton}
              onPress={handleSelectImage}
            >
              <Ionicons name="camera" size={20} color="#4c669f" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, ((!newComment.trim() && selectedImages.length === 0 && !selectedImage) || submitting) && styles.disabledButton]}
              onPress={handleAddComment}
              disabled={(!newComment.trim() && selectedImages.length === 0 && !selectedImage) || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Fotoğraf Detay Modalı */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {selectedPhotoForModal && (
            <View style={dynamicStyles.modalContent}>
              <Image
                source={getImageSource(selectedPhotoForModal.url, selectedPhotoForModal.url, 'modal')}
                style={styles.modalImage}
                resizeMode="contain"
                onLoadStart={() => {
                  console.log(`Modal fotoğraf yükleniyor: ${selectedPhotoForModal.url?.substring(0, 30)}...`);
                }}
                onLoad={() => {
                  console.log('Modal fotoğraf başarıyla yüklendi');
                }}
                onError={(error) => {
                  console.error('Modal fotoğraf yükleme hatası:', error.nativeEvent.error);
                  console.log(`Hatalı modal URL: ${selectedPhotoForModal.url?.substring(0, 50)}...`);

                  // Alternatif kaynak dene
                  try {
                    // Base64 formatını düzeltmeyi dene
                    console.log('Alternatif kaynak deneniyor: base64 formatı düzeltiliyor');
                    // Burada doğrudan state güncellemesi yapamıyoruz, sadece log
                  } catch (e) {
                    console.error('Alternatif kaynak hatası:', e);
                    // Modalı kapat
                    setModalVisible(false);
                  }
                }}
                defaultSource={require('../assets/images/placeholder.png')}
              />
              {selectedPhotoForModal.location && (
                <View style={styles.modalLocationBadge}>
                  <MaterialCommunityIcons name="map-marker" size={16} color="#fff" />
                  <ThemedText style={styles.modalLocationText} numberOfLines={1} ellipsizeMode="tail">
                    {selectedPhotoForModal.location}
                  </ThemedText>
                </View>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Fotoğraf Galerisi Modalı */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={galleryVisible}
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <TouchableOpacity
              style={styles.galleryCloseButton}
              onPress={() => setGalleryVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText style={styles.galleryCounter}>
              {currentPhotoIndex + 1} / {galleryPhotos.length}
            </ThemedText>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.floor(
                event.nativeEvent.contentOffset.x /
                event.nativeEvent.layoutMeasurement.width
              );
              setCurrentPhotoIndex(newIndex);
            }}
          >
            {galleryPhotos.map((photo, index) => (
              <View key={`gallery-${index}`} style={styles.gallerySlide}>
                <Image
                  source={getImageSource(photo.url, photo.url, 'gallery')}
                  style={styles.galleryImage}
                  resizeMode="contain"
                  onError={(error) => {
                    console.error(`Galeri fotoğraf yükleme hatası:`, error.nativeEvent.error);
                    console.log(`Hatalı galeri URL: ${photo.url?.substring(0, 50)}...`);
                  }}
                  defaultSource={require('../assets/images/placeholder.png')}
                />
                {photo.location && (
                  <View style={styles.galleryLocationBadge}>
                    <MaterialCommunityIcons name="map-marker" size={16} color="#fff" />
                    <ThemedText style={styles.galleryLocationText} numberOfLines={1} ellipsizeMode="tail">
                      {photo.location}
                    </ThemedText>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.galleryNavigation}>
            <TouchableOpacity
              style={[styles.galleryNavButton, currentPhotoIndex === 0 && styles.galleryNavButtonDisabled]}
              onPress={() => {
                if (currentPhotoIndex > 0) {
                  setCurrentPhotoIndex(currentPhotoIndex - 1);
                }
              }}
              disabled={currentPhotoIndex === 0}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.galleryNavButton, currentPhotoIndex === galleryPhotos.length - 1 && styles.galleryNavButtonDisabled]}
              onPress={() => {
                if (currentPhotoIndex < galleryPhotos.length - 1) {
                  setCurrentPhotoIndex(currentPhotoIndex + 1);
                }
              }}
              disabled={currentPhotoIndex === galleryPhotos.length - 1}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent', // Will be set dynamically
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 16,
    overflow: 'hidden',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  multiplePhotosItem: {
    width: '48%',
    margin: '1%',
    maxWidth: 150,
    minWidth: 120,
  },
  singlePhotoItem: {
    width: '96%',
    margin: '2%',
    maxWidth: 500,
    minWidth: 250,
    alignSelf: 'center',
  },
  multiplePhotosImage: {
    height: 120,
    width: '100%',
  },
  singlePhotoImage: {
    height: 250,
    width: '100%',
    resizeMode: 'cover',
  },
  photoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
    borderRadius: 8,
  },
  photoLoadingText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
    fontWeight: '500',
  },
  errorImage: {
    opacity: 0.5,
    backgroundColor: 'rgba(255,0,0,0.1)',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(76, 102, 159, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoCountText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 2,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  loader: {
    marginTop: 20,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4c669f',
    ...AppStyles.shadows.medium,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.3)',
  },
  userName: {
    fontFamily: 'InterSemiBold',
    fontSize: 15,
    color: AppStyles.colors.dark.text,
  },
  commentDate: {
    fontSize: 12,
    color: AppStyles.colors.dark.textMuted,
    fontFamily: 'InterRegular',
  },
  commentContent: {
    marginVertical: 12,
    lineHeight: 22,
    fontSize: 15,
    color: AppStyles.colors.dark.text,
    fontFamily: 'InterRegular',
  },
  photoContainer: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3, // Android shadow - increased
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: '#fff',
    transform: [{ scale: 1 }], // For transition effect
    maxWidth: '100%', // Maksimum genişlik sınırlaması - increased
    alignSelf: 'center', // Yatayda ortalama
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  commentPhoto: {
    width: '100%',
    height: 180, // Daha büyük boyut
    borderRadius: 12,
    objectFit: 'cover',
    backgroundColor: 'rgba(0,0,0,0.05)', // Hafif arka plan rengi
  },
  photoLocationBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(76, 102, 159, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  photoLocationText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  noComments: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  previewContainer: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    backgroundColor: '#fff',
    maxWidth: '80%', // Maksimum genişlik sınırlaması
    alignSelf: 'center', // Yatayda ortalama
  },
  previewImage: {
    width: '100%',
    height: 150, // Daha küçük boyut
    borderRadius: 12,
    objectFit: 'cover',
  },
  locationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(17, 17, 17, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  locationText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'InterRegular',
    marginLeft: 4,
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(17, 17, 17, 0.85)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  inputContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4c669f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    backgroundColor: '#111',
    color: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  photoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  submitButton: {
    backgroundColor: '#4c669f',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...AppStyles.shadows.small,
  },
  disabledButton: {
    backgroundColor: 'rgba(76, 102, 159, 0.5)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...AppStyles.shadows.small,
  },
  editContainer: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#4c669f',
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
    backgroundColor: '#111',
    color: '#fff',
    fontFamily: 'InterRegular',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  saveButton: {
    backgroundColor: '#4c669f',
    ...AppStyles.shadows.small,
  },
  editButtonText: {
    color: AppStyles.colors.dark.text,
    fontSize: 14,
    fontFamily: 'InterSemiBold',
    marginLeft: 4,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '85%',
    backgroundColor: '#111',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  modalImage: {
    width: '100%',
    height: 450, // Increased height
    backgroundColor: '#000',
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalLocationBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(76, 102, 159, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalLocationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Galeri stilleri
  galleryContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    position: 'relative',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  galleryCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 102, 159, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gallerySlide: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 150,
    resizeMode: 'contain',
  },
  galleryLocationBadge: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: 'rgba(76, 102, 159, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: '80%',
  },
  galleryLocationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  galleryNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  galleryNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(76, 102, 159, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryNavButtonDisabled: {
    backgroundColor: 'rgba(76, 102, 159, 0.3)',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 83, 79, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'center',
  },
  clearAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

});

export default TripComments;
