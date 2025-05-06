import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, FlatList, Modal, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { FirebaseService } from '../services/firebase.service';
import { TripPhoto } from '../types/travel';

interface TripPhotoUploaderProps {
  travelPlanId: string;
  userId: string;
  tripPhotos: TripPhoto[];
  onPhotoAdded: () => void;
  setTripPhotos?: React.Dispatch<React.SetStateAction<TripPhoto[]>>;
}

export default function TripPhotoUploader({ travelPlanId, userId, tripPhotos, onPhotoAdded, setTripPhotos }: TripPhotoUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhotoForModal, setSelectedPhotoForModal] = useState<TripPhoto | null>(null);

  // Component mount olduğunda veya tripPhotos değiştiğinde log
  useEffect(() => {
    console.log(`TripPhotoUploader: ${tripPhotos.length} fotoğraf alındı`);

    // Fotoğrafların içeriğini kontrol et
    if (tripPhotos.length > 0) {
      tripPhotos.forEach((photo, index) => {
        console.log(`Fotoğraf ${index + 1} - ID: ${photo.id}, imageData: ${photo.imageData ? 'var' : 'yok'}, imageUrl: ${photo.imageUrl ? 'var' : 'yok'}`);
      });
    }
  }, [tripPhotos]);

  // Ekran boyutlarını al
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

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
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5, // Kaliteyi düşürelim
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
        setShowForm(true);
      }
    } catch (error) {
      console.error('Fotoğraf seçme hatası:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  // Fotoğraf yükleme işlemi
  const handleUploadPhoto = async () => {
    if (!selectedImage) {
      Alert.alert('Hata', 'Lütfen bir fotoğraf seçin.');
      return;
    }

    try {
      setLoading(true);
      console.log('Fotoğraf yükleme işlemi başlatılıyor...');
      console.log('Kullanıcı ID:', userId);
      console.log('Seyahat Planı ID:', travelPlanId);
      console.log('Seçilen fotoğraf URI:', selectedImage);

      // Fotoğrafı Firestore'a yükle
      try {
        console.log('Fotoğraf işleniyor...');

        // Fotoğraf bilgilerini hazırla
        const timestamp = new Date().getTime();
        const photoUri = selectedImage;

        // Fotoğrafı Firestore'a base64 olarak kaydet
        console.log('Fotoğraf base64 olarak Firestore\'a kaydediliyor...');

        try {
          // Resmi base64'e dönüştür
          const base64Data = await FileSystem.readAsStringAsync(photoUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Fotoğraf bilgilerini hazırla (base64 ile)
          const photoInfo: Partial<TripPhoto> = {
            id: `photo_${timestamp}`,
            location: location.trim() || "", // Boş string kullan, undefined değil
            uploadedAt: new Date().toISOString()
          };

          // Doğrudan ana koleksiyona ekleyelim
          const success = await FirebaseService.TravelPlan.addTripPhotoWithBase64(
            travelPlanId,
            base64Data,
            photoInfo
          );

          if (success) {
            console.log('Fotoğraf başarıyla kaydedildi');

            // Yeni fotoğrafı oluştur (imageData ile birlikte)
            const newPhoto: TripPhoto = {
              id: photoInfo.id || `photo_${timestamp}`,
              imageData: base64Data,
              location: photoInfo.location || "",
              uploadedAt: photoInfo.uploadedAt || new Date().toISOString()
            };

            // Fotoğrafları güncelle (eğer prop olarak geçildiyse)
            if (setTripPhotos) {
              const updatedPhotos = [...tripPhotos, newPhoto];
              setTripPhotos(updatedPhotos);
            }

            // Başarı mesajı göster
            Alert.alert('Başarılı', 'Fotoğraf başarıyla eklendi.');

            // Formu temizle
            setSelectedImage(null);
            setLocation('');
            setShowForm(false);

            // Fotoğrafları yeniden yükle
            onPhotoAdded();
          } else {
            console.error('Fotoğraf kaydetme başarısız');
            Alert.alert('Hata', 'Fotoğraf kaydedilirken bir hata oluştu.');
          }
        } catch (uploadError: any) {
          console.error('Fotoğraf yükleme hatası:', uploadError);
          Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu: ' + (uploadError.message || 'Bilinmeyen hata'));
        }


      } catch (error: any) {
        console.error('Fotoğraf kaydetme hatası:', error);

        // Hata mesajı göster
        let errorMessage = 'Fotoğraf kaydedilirken bir hata oluştu.';
        if (error.message) {
          errorMessage += `\n\nHata detayı: ${error.message}`;
        }

        Alert.alert('Hata', errorMessage);
      }
    } catch (error: any) {
      console.error('Fotoğraf yükleme hatası:', error);

      // Daha detaylı hata mesajı
      let errorMessage = 'Fotoğraf yüklenirken bir hata oluştu.';
      if (error.message) {
        errorMessage += `\n\nHata detayı: ${error.message}`;
      }

      Alert.alert('Hata', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fotoğraf yükleme formunu iptal et
  const handleCancelUpload = () => {
    setSelectedImage(null);
    setLocation('');
    setShowForm(false);
  };

  // Fotoğrafa tıklama işlemi
  const handlePhotoPress = (photo: TripPhoto) => {
    setSelectedPhotoForModal(photo);
    setModalVisible(true);
  };

  // Modalı kapat
  const closeModal = () => {
    setModalVisible(false);
    setSelectedPhotoForModal(null);
  };

  // Fotoğraf kaynağını belirle (URL veya base64)
  const getImageSource = (item: TripPhoto) => {
    console.log(`Fotoğraf kaynağı belirleniyor: ${item.id}`);

    if (item.imageData) {
      console.log(`${item.id} için base64 verisi kullanılıyor`);
      return { uri: `data:image/jpeg;base64,${item.imageData}` };
    } else if (item.imageUrl) {
      console.log(`${item.id} için URL kullanılıyor: ${item.imageUrl}`);
      return { uri: item.imageUrl };
    } else {
      console.log(`${item.id} için placeholder kullanılıyor`);
      return { uri: 'https://via.placeholder.com/300x200/4c669f/ffffff?text=Resim+Yok' };
    }
  };

  // Fotoğraf listesini render et
  const renderPhotoItem = ({ item }: { item: TripPhoto }) => {
    const imageSource = getImageSource(item);

    return (
      <TouchableOpacity
        style={styles.photoCardHorizontal}
        onPress={() => handlePhotoPress(item)}
      >
        <Image source={imageSource} style={styles.photoImageHorizontal} />
        <View style={styles.photoOverlay}>
          {item.location && (
            <View style={styles.photoLocationBadge}>
              <MaterialCommunityIcons name="map-marker" size={12} color="#fff" />
              <ThemedText style={styles.photoLocationText} numberOfLines={1} ellipsizeMode="tail">
                {item.location}
              </ThemedText>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Fotoğrafları render et
  const renderPhotoList = () => {
    console.log(`Fotoğraf listesi render ediliyor, fotoğraf sayısı: ${tripPhotos.length}`);

    if (tripPhotos.length > 0) {
      return (
        <FlatList
          data={tripPhotos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoItem}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoListHorizontal}
          extraData={tripPhotos} // Fotoğraflar değiştiğinde FlatList'i yeniden render et
          nestedScrollEnabled={true}
        />
      );
    } else {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="image-off" size={50} color="#4c669f" />
          <ThemedText style={styles.emptyText}>
            Henüz fotoğraf eklenmemiş.
          </ThemedText>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Fotoğraf Listesi */}
      {renderPhotoList()}

      {/* Fotoğraf Detay Modalı */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={closeModal}
        >
          {selectedPhotoForModal && (
            <View style={styles.modalContent}>
              <Image
                source={getImageSource(selectedPhotoForModal)}
                style={styles.modalImage}
                resizeMode="contain"
              />

              <View style={styles.modalInfo}>
                {selectedPhotoForModal.location && (
                  <View style={styles.photoInfoRow}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#4c669f" />
                    <ThemedText style={styles.modalInfoText}>
                      {selectedPhotoForModal.location}
                    </ThemedText>
                  </View>
                )}

                {selectedPhotoForModal.dayNumber && (
                  <View style={styles.photoInfoRow}>
                    <MaterialCommunityIcons name="calendar-outline" size={18} color="#4c669f" />
                    <ThemedText style={styles.modalInfoText}>
                      Gün {selectedPhotoForModal.dayNumber}
                    </ThemedText>
                  </View>
                )}

                <ThemedText style={styles.photoDate}>
                  {new Date(selectedPhotoForModal.uploadedAt).toLocaleDateString('tr-TR')}
                </ThemedText>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Fotoğraf Yükleme Formu */}
      {showForm && selectedImage ? (
        <View style={styles.uploadForm}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />

          <TextInput
            style={styles.input}
            placeholder="Konum (Neresi olduğunu yazın)"
            value={location}
            onChangeText={setLocation}
            placeholderTextColor="#666"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancelUpload}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>İptal</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.uploadButton]}
              onPress={handleUploadPhoto}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Yükle</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleSelectImage}
          disabled={loading}
        >
          <MaterialCommunityIcons name="camera-plus" size={24} color="#fff" />
          <ThemedText style={styles.addButtonText}>Fotoğraf Ekle</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  // Eski dikey liste stilleri
  photoList: {
    paddingBottom: 16,
  },
  photoCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  photoImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoDetails: {
    padding: 12,
  },

  // Yeni yatay liste stilleri
  photoListHorizontal: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  photoCardHorizontal: {
    backgroundColor: '#111',
    borderRadius: 12,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
    width: 200,
    height: 200,
    position: 'relative',
  },
  photoImageHorizontal: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  photoLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 102, 159, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  photoLocationText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },

  // Modal stilleri
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#000',
  },
  modalInfo: {
    padding: 16,
  },
  modalInfoText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Diğer stiller
  photoCaption: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#fff',
  },
  photoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoInfoText: {
    marginLeft: 6,
    color: '#ccc',
    fontSize: 14,
  },
  photoDate: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  uploadForm: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
    marginRight: 8,
  },
  uploadButton: {
    backgroundColor: '#4c669f',
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#4c669f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});
