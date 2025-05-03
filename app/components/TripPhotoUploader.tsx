import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, FlatList } from 'react-native';
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
        // @ts-ignore - MediaTypeOptions is deprecated but still works
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      // Fotoğrafı yerel olarak kaydet ve Firestore'a referans ekle
      try {
        console.log('Fotoğraf işleniyor...');

        // Fotoğraf bilgilerini hazırla
        const timestamp = new Date().getTime();
        const photoUri = selectedImage;

        // Fotoğraf bilgilerini hazırla
        const photoInfo: Partial<TripPhoto> = {
          id: `photo_${timestamp}`,
          imageUrl: photoUri, // Doğrudan cihaz URI'sini kullan
          location: location.trim() || undefined,
          uploadedAt: new Date().toISOString()
        };

        console.log('Fotoğraf bilgileri:', photoInfo);

        // Seyahat planına fotoğraf bilgilerini ekle
        console.log('Seyahat planına fotoğraf bilgileri ekleniyor...');

        // Mevcut fotoğrafları al
        const existingPhotos = [...tripPhotos];

        // Yeni fotoğrafı ekle
        existingPhotos.push(photoInfo as TripPhoto);

        // Firestore'a sadece fotoğraf referansını kaydet
        const success = await FirebaseService.TravelPlan.updateTripPhotosReferences(
          travelPlanId,
          existingPhotos
        );

        if (success) {
          console.log('Fotoğraf referansı başarıyla kaydedildi');
          Alert.alert('Başarılı', 'Fotoğraf başarıyla eklendi.');

          // Fotoğrafları güncelle (eğer prop olarak geçildiyse)
          if (setTripPhotos) {
            setTripPhotos(existingPhotos);
          }

          // Formu temizle
          setSelectedImage(null);
          setLocation('');
          setShowForm(false);

          // Yenileme fonksiyonunu çağır
          onPhotoAdded();
        } else {
          console.error('Fotoğraf referansı kaydetme başarısız');
          Alert.alert('Hata', 'Fotoğraf bilgileri kaydedilirken bir hata oluştu.');
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

  // Fotoğraf listesini render et
  const renderPhotoItem = ({ item }: { item: TripPhoto }) => {
    // Resim kaynağını belirle (URL veya base64)
    const imageSource = item.imageData
      ? { uri: `data:image/jpeg;base64,${item.imageData}` }
      : item.imageUrl
        ? { uri: item.imageUrl }
        : { uri: 'https://via.placeholder.com/300x200/4c669f/ffffff?text=Resim+Yok' }; // Online placeholder

    return (
      <View style={styles.photoCard}>
        <Image source={imageSource} style={styles.photoImage} />
        <View style={styles.photoDetails}>
          {item.caption && (
            <ThemedText style={styles.photoCaption} numberOfLines={2} ellipsizeMode="tail">
              {item.caption}
            </ThemedText>
          )}
          {item.location && (
            <View style={styles.photoInfoRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#4c669f" />
              <ThemedText style={styles.photoInfoText} numberOfLines={1} ellipsizeMode="tail">
                {item.location}
              </ThemedText>
            </View>
          )}
          {item.dayNumber && (
            <View style={styles.photoInfoRow}>
              <MaterialCommunityIcons name="calendar-outline" size={16} color="#4c669f" />
              <ThemedText style={styles.photoInfoText} numberOfLines={1} ellipsizeMode="tail">
                Gün {item.dayNumber}
              </ThemedText>
            </View>
          )}
          {item.activityName && (
            <View style={styles.photoInfoRow}>
              <MaterialCommunityIcons name="tag-outline" size={16} color="#4c669f" />
              <ThemedText style={styles.photoInfoText} numberOfLines={1} ellipsizeMode="tail">
                {item.activityName}
              </ThemedText>
            </View>
          )}
          <ThemedText style={styles.photoDate}>
            {new Date(item.uploadedAt).toLocaleDateString('tr-TR')}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Fotoğraf Listesi */}
      {tripPhotos.length > 0 ? (
        <FlatList
          data={tripPhotos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoItem}
          horizontal={false}
          contentContainerStyle={styles.photoList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="image-off" size={50} color="#4c669f" />
          <ThemedText style={styles.emptyText}>
            Henüz fotoğraf eklenmemiş.
          </ThemedText>
        </View>
      )}

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
  photoCaption: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#fff',
  },
  photoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
