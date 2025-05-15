import React, { useState, useEffect, useRef } from 'react';
import { View, Modal, TouchableOpacity, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Hotel } from '../types/travel';
import HotelPhotosService from '../services/HotelPhotosService';

interface HotelDetailModalProps {
  visible: boolean;
  hotel: Hotel | null;
  onClose: () => void;
}

const HotelDetailModal = ({ visible, hotel, onClose }: HotelDetailModalProps) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [enhancedHotel, setEnhancedHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<number, boolean>>({});
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const scale = useState(new Animated.Value(1))[0];

  // Otel görüntülendiğinde ek fotoğrafları getir
  useEffect(() => {
    const fetchAdditionalPhotos = async () => {
      if (!hotel) return;

      // Eğer otel zaten yeterli fotoğrafa sahipse, işlem yapma
      if (hotel.additionalImages && Array.isArray(hotel.additionalImages) && hotel.additionalImages.length >= 10) {

        setEnhancedHotel(hotel);
        return;
      }

      setIsLoading(true);
      try {
        // Otelin bulunduğu şehri belirle
        const city = hotel.hotelAddress?.split(',')[1]?.trim() || 'Istanbul';

        // Ek fotoğrafları getir
        const updatedHotel = await HotelPhotosService.enhanceHotelWithPhotos(hotel, city);

        // Fotoğraf sayısını kontrol et
        const photoCount = updatedHotel.additionalImages?.length || 0;

        setEnhancedHotel(updatedHotel);
      } catch (error) {
        console.error('Otel fotoğrafları getirme hatası:', error);
        setEnhancedHotel(hotel);
      } finally {
        setIsLoading(false);
      }
    };

    if (visible && hotel) {
      fetchAdditionalPhotos();
    }
  }, [visible, hotel]);

  if (!hotel) return null;

  // Görüntülenecek otel verisi (zenginleştirilmiş veya orijinal)
  const displayHotel = enhancedHotel || hotel;

  // Process hotel images
  let allImages: Array<{url: string, isPlaceholder?: boolean}> = [];

  // Add main image if available and valid
  const isValidUrl = (url: string) => {
    return url &&
           typeof url === 'string' &&
           url.trim() !== '' &&
           url !== 'null' &&
           url !== 'undefined' &&
           url.startsWith('http');
  };

  // Ana fotoğrafı kontrol et ve ekle
  if (displayHotel.imageUrl && isValidUrl(displayHotel.imageUrl)) {
    allImages.push({ url: displayHotel.imageUrl });
  } else if (displayHotel.hotelImageUrl && isValidUrl(displayHotel.hotelImageUrl)) {
    allImages.push({ url: displayHotel.hotelImageUrl });
  }

  // Add additional images if available
  if (displayHotel.additionalImages && Array.isArray(displayHotel.additionalImages)) {
    // Önce tüm geçerli fotoğrafları topla
    const validImages = displayHotel.additionalImages.filter(img => {
      if (img && typeof img === 'string' && img.trim() !== '' && img !== 'null' && img !== 'undefined' && img.startsWith('http')) {
        return true;
      } else if (img && typeof img === 'object' && img.url &&
                typeof img.url === 'string' && img.url.trim() !== '' &&
                img.url !== 'null' && img.url !== 'undefined' &&
                img.url.startsWith('http')) {
        return true;
      }
      return false;
    });

    console.log(`Toplam ${displayHotel.additionalImages.length} fotoğraftan ${validImages.length} tanesi geçerli`);

    // Geçerli fotoğrafları ekle
    validImages.forEach(img => {
      if (typeof img === 'string') {
        allImages.push({ url: img });
      } else {
        allImages.push(img);
      }
    });
  }

  // Tekrarlayan fotoğrafları kaldır
  const uniqueUrls = new Set();
  const uniqueImages = allImages.filter(img => {
    if (uniqueUrls.has(img.url)) {
      return false;
    }
    uniqueUrls.add(img.url);
    return true;
  });

  // Benzersiz fotoğrafları kullan
  allImages = uniqueImages;

  // Limit to 10 images maximum (to avoid showing null/invalid images)
  if (allImages.length > 10) {
    allImages = allImages.slice(0, 10);
  }


  // Final hotelImages array
  const hotelImages = allImages;

  // If no images available, add a placeholder
  if (hotelImages.length === 0) {
    hotelImages.push({
      url: 'https://via.placeholder.com/400x300/4c669f/ffffff?text=Otel+Görseli+Yok',
      isPlaceholder: true
    });
  }

  // Tam ekran görüntüleme için
  const openFullscreen = (imageUrl: string) => {
    setFullscreenImage(imageUrl);
  };

  const closeFullscreen = () => {
    setFullscreenImage(null);
  };

  // Yakınlaştırma efekti
  const zoomIn = () => {
    Animated.spring(scale, {
      toValue: 2,
      friction: 3,
      useNativeDriver: true
    }).start();
  };

  const zoomOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true
    }).start();
  };

  const renderImageItem = ({ item, index }: { item: any, index: number }) => {
    // Eğer bu fotoğrafta daha önce hata olduysa, gösterme
    if (imageLoadErrors[index]) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[
          styles.thumbnailContainer,
          selectedImageIndex === index && styles.selectedThumbnail
        ]}
        onPress={() => setSelectedImageIndex(index)}
      >
        <Image
          source={{ uri: item.url }}
          style={styles.thumbnailImage}
          resizeMode="cover"
          onError={() => {
            console.log(`Thumbnail yükleme hatası: ${item.url}`);
            // Hata durumunu kaydet
            setImageLoadErrors(prev => ({
              ...prev,
              [index]: true
            }));
          }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <MaterialCommunityIcons name="close" size={24} color="#4c669f" />
          </TouchableOpacity>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4c669f" />
              <ThemedText style={styles.loadingText}>Otel fotoğrafları yükleniyor...</ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.modalScrollView}>
              {/* Main Image */}
              <TouchableOpacity
                style={styles.mainImageContainer}
                onPress={() => openFullscreen(hotelImages[selectedImageIndex]?.url)}
              >
                <Image
                  source={{ uri: hotelImages[selectedImageIndex]?.url }}
                  style={styles.mainImage}
                  resizeMode="cover"
                  onError={() => {
                    console.log(`Fotoğraf yükleme hatası: ${hotelImages[selectedImageIndex]?.url}`);
                    // Hata durumunda bir sonraki fotoğrafa geç
                    if (selectedImageIndex < hotelImages.length - 1) {
                      setSelectedImageIndex(selectedImageIndex + 1);
                    } else if (selectedImageIndex > 0) {
                      // Son fotoğrafta hata varsa ilk fotoğrafa dön
                      setSelectedImageIndex(0);
                    }
                    // Hata durumunu kaydet
                    setImageLoadErrors(prev => ({
                      ...prev,
                      [selectedImageIndex]: true
                    }));
                  }}
                />
                {hotelImages.length > 1 && (
                  <View style={styles.imageCounter}>
                    <ThemedText style={styles.imageCounterText}>
                      {selectedImageIndex + 1} / {hotelImages.length}
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>

              {/* Image Thumbnails */}
              {hotelImages.length > 1 && (
                <FlatList
                  data={hotelImages}
                  renderItem={renderImageItem}
                  keyExtractor={(_, index) => `hotel-image-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailList}
                />
              )}

              {/* Fotoğraf sayısı bilgisi */}
              {hotelImages.length > 1 && (
                <View style={styles.photoCountContainer}>
                  <MaterialCommunityIcons name="image-multiple" size={16} color="#4c669f" />
                  <ThemedText style={styles.photoCountText}>
                    {hotelImages.length} fotoğraf
                  </ThemedText>
                </View>
              )}

            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{hotel.hotelName}</ThemedText>
              <View style={styles.ratingContainer}>
                <MaterialCommunityIcons name="star" size={18} color="#FFD700" />
                <ThemedText style={styles.ratingText}>{hotel.rating || '?'}</ThemedText>
              </View>
            </View>

            <View style={styles.modalBody}>
              {/* Address */}
              <View style={styles.modalSection}>
                <ThemedText style={styles.modalSectionTitle}>Adres</ThemedText>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="map-marker" size={18} color="#4c669f" style={styles.infoIcon} />
                  <ThemedText style={styles.modalText}>{hotel.hotelAddress}</ThemedText>
                </View>
              </View>

              {/* Price */}
              <View style={styles.modalSection}>
                <ThemedText style={styles.modalSectionTitle}>Fiyat</ThemedText>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="currency-usd" size={18} color="#4c669f" style={styles.infoIcon} />
                  <ThemedText style={styles.modalText}>{hotel.priceRange || hotel.price || 'Belirtilmemiş'}</ThemedText>
                </View>
              </View>

              {/* Description */}
              <View style={styles.modalSection}>
                <ThemedText style={styles.modalSectionTitle}>Açıklama</ThemedText>
                <ThemedText style={styles.modalText}>{hotel.description}</ThemedText>
              </View>

              {/* Best Time to Visit */}
              {hotel.bestTimeToVisit && (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle}>En İyi Ziyaret Zamanı</ThemedText>
                  <ThemedText style={styles.modalText}>{hotel.bestTimeToVisit}</ThemedText>
                </View>
              )}

              {/* Features */}
              {hotel.features && hotel.features.length > 0 && (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle}>Özellikler</ThemedText>
                  {hotel.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#4c669f" style={styles.featureIcon} />
                      <ThemedText style={styles.featureText}>{feature}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Surroundings */}
              {hotel.surroundings && (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.modalSectionTitle}>Çevre</ThemedText>
                  <ThemedText style={styles.modalText}>{hotel.surroundings}</ThemedText>
                </View>
              )}
            </View>
          </ScrollView>
          )}
        </View>
      </View>

      {/* Tam ekran görüntüleme modalı */}
      {fullscreenImage && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!fullscreenImage}
          onRequestClose={closeFullscreen}
        >
          <View style={styles.fullscreenOverlay}>
            <TouchableOpacity
              style={styles.fullscreenCloseButton}
              onPress={closeFullscreen}
            >
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullscreenContainer}
              activeOpacity={1}
              onPress={zoomOut}
              onLongPress={zoomIn}
              delayLongPress={200}
            >
              <Animated.Image
                source={{ uri: fullscreenImage }}
                style={[
                  styles.fullscreenImage,
                  { transform: [{ scale }] }
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View style={styles.fullscreenHint}>
              <ThemedText style={styles.fullscreenHintText}>
                Uzun basın: Yakınlaştır • Dokun: Uzaklaştır
              </ThemedText>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 10,
    zIndex: 10,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 10,
    color: '#4c669f',
    fontSize: 16,
  },
  mainImageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailList: {
    paddingVertical: 10,
  },
  thumbnailContainer: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#4c669f',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  photoCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.3)',
  },
  photoCountText: {
    marginLeft: 5,
    color: '#4c669f',
    fontSize: 14,
  },
  modalHeader: {
    marginTop: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.3)',
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'InterRegular',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ratingText: {
    marginLeft: 5,
    fontWeight: '700',
    color: '#FFD700',
  },
  modalBody: {
    flex: 1,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4c669f',
    marginBottom: 10,
    fontFamily: 'InterRegular',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  infoIcon: {
    marginRight: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 22,
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  // Tam ekran görüntüleme stilleri
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullscreenHintText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default HotelDetailModal;
