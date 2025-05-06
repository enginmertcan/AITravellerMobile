import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { FirebaseService } from '../services/firebase.service';
import { TripComment } from '../types/travel';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoLocation, setPhotoLocation] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhotoForModal, setSelectedPhotoForModal] = useState<{ url: string, location?: string } | null>(null);

  // Yorumları yükle
  useEffect(() => {
    loadComments();
  }, [travelPlanId]);

  const loadComments = async () => {
    if (!travelPlanId) return;

    setLoading(true);
    try {
      console.log(`Yorumlar yükleniyor, travelPlanId: ${travelPlanId}`);

      // 1. Önce yorumları getir
      const commentsData = await FirebaseService.Comment.getCommentsByTravelPlanId(travelPlanId);
      console.log(`${commentsData.length} yorum yüklendi`);

      // 2. Sonra yorum fotoğraflarını getir
      console.log(`Yorum fotoğrafları getiriliyor...`);
      const commentPhotos = await FirebaseService.CommentPhoto.getPhotosByTravelPlanId(travelPlanId);
      console.log(`${commentPhotos.length} yorum fotoğrafı bulundu`);

      // 3. Her yoruma ait fotoğrafları eşleştir
      if (commentPhotos.length > 0) {
        for (const comment of commentsData) {
          // Bu yoruma ait fotoğrafı bul
          const commentPhoto = commentPhotos.find(photo => photo.commentId === comment.id);

          if (commentPhoto) {
            console.log(`Yorum ${comment.id} için fotoğraf bulundu`);

            // Fotoğraf verilerini yoruma ekle
            if (commentPhoto.photoData) {
              comment.photoData = commentPhoto.photoData;
              console.log(`Fotoğraf verisi eklendi, uzunluk: ${commentPhoto.photoData.length}`);
            }

            if (commentPhoto.photoLocation) {
              comment.photoLocation = commentPhoto.photoLocation;
              console.log(`Fotoğraf konum bilgisi eklendi: ${commentPhoto.photoLocation}`);
            }
          }
        }
      }

      // Yorum fotoğraflarını kontrol et
      commentsData.forEach((comment, index) => {
        console.log(`Yorum ${index + 1} - ID: ${comment.id}`);
        console.log(`  Fotoğraf var mı: ${comment.photoUrl || comment.photoData ? 'Evet' : 'Hayır'}`);
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
        quality: 0.5, // Kaliteyi düşürelim
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
        Alert.prompt(
          'Konum Bilgisi',
          'Fotoğrafın çekildiği yeri belirtin (opsiyonel):',
          [
            {
              text: 'İptal',
              onPress: () => setPhotoLocation(''),
              style: 'cancel',
            },
            {
              text: 'Tamam',
              onPress: (location) => setPhotoLocation(location || ''),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Fotoğraf seçme hatası:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  // Fotoğrafı temizle
  const handleClearImage = () => {
    setSelectedImage(null);
    setPhotoLocation('');
  };

  // Fotoğrafa tıklama işlemi
  const handlePhotoPress = (photo: { url: string, location?: string }) => {
    console.log(`Fotoğrafa tıklandı: ${photo.url.substring(0, 30)}...`);
    console.log(`Konum bilgisi: ${photo.location || 'Yok'}`);

    // Fotoğraf URL'sinin geçerli olup olmadığını kontrol et
    if (!photo.url || photo.url.trim() === '') {
      console.error('Geçersiz fotoğraf URL\'si');
      Alert.alert('Hata', 'Fotoğraf görüntülenemiyor.');
      return;
    }

    setSelectedPhotoForModal(photo);
    setModalVisible(true);
  };

  // Yeni yorum ekle
  const handleAddComment = async () => {
    if ((!newComment.trim() && !selectedImage) || !userId || !isUserLoaded || !user) return;

    setSubmitting(true);
    try {
      let base64Data = null;
      let photoLocationValue = null;

      // Eğer fotoğraf seçilmişse, yükle
      if (selectedImage) {
        try {
          console.log('Fotoğraf base64\'e dönüştürülüyor...');

          // Resmi base64'e dönüştür
          base64Data = await FileSystem.readAsStringAsync(selectedImage, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log(`Base64 dönüşümü başarılı, veri uzunluğu: ${base64Data.length}`);

          // Konum bilgisi varsa ekle
          if (photoLocation && photoLocation.trim() !== '') {
            photoLocationValue = photoLocation.trim();
            console.log(`Fotoğraf konum bilgisi: ${photoLocationValue}`);
          }
        } catch (error) {
          console.error('Fotoğraf dönüştürme hatası:', error);
          Alert.alert('Hata', 'Fotoğraf işlenirken bir hata oluştu.');
          setSubmitting(false);
          return;
        }
      }

      // 1. Önce yorumu ekle (fotoğraf olmadan)
      const commentData: Omit<TripComment, 'id' | 'createdAt' | 'updatedAt'> = {
        travelPlanId,
        userId,
        userName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Misafir',
        userPhotoUrl: user.imageUrl || undefined,
        content: newComment.trim(),
      };

      console.log('Yorum Firebase\'e gönderiliyor...');
      const commentId = await FirebaseService.Comment.addComment(commentData);
      console.log(`Yorum başarıyla eklendi, ID: ${commentId}`);

      // 2. Eğer fotoğraf varsa, ayrı koleksiyona ekle
      if (base64Data) {
        try {
          console.log('Fotoğraf ayrı koleksiyona ekleniyor...');

          // Base64 verisi data:image formatında değilse ekle
          if (!base64Data.startsWith('data:image')) {
            base64Data = `data:image/jpeg;base64,${base64Data}`;
            console.log('Base64 verisi data:image formatına dönüştürüldü');
          }

          // CommentPhotoService kullanarak fotoğrafı ekle
          await FirebaseService.CommentPhoto.addCommentPhoto(
            commentId,
            travelPlanId,
            base64Data,
            photoLocationValue || undefined
          );

          console.log(`Fotoğraf başarıyla ayrı koleksiyona eklendi`);
        } catch (photoError) {
          console.error(`Fotoğraf ekleme hatası:`, photoError);
          // Fotoğraf eklenemese bile yorumu silmiyoruz
        }
      }

      setNewComment('');
      setSelectedImage(null);
      setPhotoLocation('');

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

  // Yorum öğesi
  const renderCommentItem = ({ item }: { item: TripComment }) => {
    const isCurrentUser = userId === item.userId;
    const hasPhoto = item.photoUrl || item.photoData;

    // Fotoğraf kaynağını belirle - Geliştirilmiş versiyon
    const getImageSource = () => {
      console.log(`Fotoğraf kaynağı belirleniyor: ${item.id}`);

      try {
        // Önce photoUrl kontrolü (daha güvenilir)
        if (item.photoUrl && item.photoUrl.trim() !== '') {
          console.log(`  ${item.id} için URL kullanılıyor: ${item.photoUrl.substring(0, 30)}...`);
          return { uri: item.photoUrl };
        }

        // Sonra photoData kontrolü
        if (item.photoData && item.photoData.trim() !== '') {
          console.log(`  ${item.id} için base64 verisi kullanılıyor (uzunluk: ${item.photoData.length})`);

          // Base64 formatını kontrol et ve düzelt
          let base64Data = item.photoData;

          // Eğer data:image ile başlıyorsa, sadece base64 kısmını al
          if (base64Data.startsWith('data:image')) {
            console.log('  Veri data:image formatında, ayıklanıyor...');
            const parts = base64Data.split('base64,');
            if (parts.length > 1) {
              base64Data = parts[1];
            }
          }

          // React Native için doğru format
          console.log('  Base64 verisi URI formatına dönüştürülüyor');
          return { uri: `data:image/jpeg;base64,${base64Data}` };
        }
      } catch (error) {
        console.error(`  Fotoğraf kaynağı belirleme hatası: ${error}`);
      }

      console.log(`  ${item.id} için fotoğraf kaynağı bulunamadı, placeholder kullanılıyor`);
      return require('../assets/images/placeholder.png');
    };

    return (
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
        </View>

        {editingComment === item.id ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => setEditingComment(null)}
              >
                <Text style={styles.editButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={() => handleUpdateComment(item.id)}
                disabled={submitting}
              >
                <Text style={styles.editButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.commentContent}>{item.content}</Text>

            {hasPhoto && (
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={() => {
                  console.log(`Fotoğrafa tıklandı: ${item.id}`);

                  // getImageSource fonksiyonunu kullanarak aynı kaynağı kullan
                  const imageSource = getImageSource();

                  if (imageSource) {
                    if (imageSource.uri) {
                      console.log(`Modal için fotoğraf URL'si: ${imageSource.uri.substring(0, 30)}...`);

                      handlePhotoPress({
                        url: imageSource.uri,
                        location: item.photoLocation
                      });
                    } else {
                      // Yerel resim kaynağı için
                      console.log('Modal için yerel fotoğraf kaynağı kullanılıyor');

                      // Placeholder görüntüsünü kullan
                      handlePhotoPress({
                        url: 'https://via.placeholder.com/300x200/4c669f/ffffff?text=Resim+Yok',
                        location: item.photoLocation
                      });
                    }
                  } else {
                    console.error('Geçerli fotoğraf kaynağı bulunamadı');
                    Alert.alert('Hata', 'Fotoğraf görüntülenemiyor.');
                  }
                }}
              >
                <Image
                  source={getImageSource()}
                  style={styles.commentPhoto}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error(`Fotoğraf yükleme hatası (${item.id}):`, error.nativeEvent.error);
                    Alert.alert('Hata', `Fotoğraf yüklenirken bir hata oluştu: ${error.nativeEvent.error}`);
                  }}
                  defaultSource={require('../assets/images/placeholder.png')}
                />
                {item.photoLocation && (
                  <View style={styles.photoLocationBadge}>
                    <MaterialCommunityIcons name="map-marker" size={12} color="#fff" />
                    <Text style={styles.photoLocationText} numberOfLines={1} ellipsizeMode="tail">
                      {item.photoLocation}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yorumlar</Text>

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
            />
          ) : (
            <Text style={styles.noComments}>Henüz yorum yapılmamış. İlk yorumu siz yapın!</Text>
          )}
        </>
      )}

      {/* Fotoğraf Önizleme */}
      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          {photoLocation ? (
            <View style={styles.locationContainer}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#4c669f" />
              <Text style={styles.locationText} numberOfLines={1}>{photoLocation}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.clearButton} onPress={handleClearImage}>
            <Ionicons name="close-circle" size={24} color="#d9534f" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Yorum yazın..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleSelectImage}
            >
              <Ionicons name="camera" size={20} color="#4c669f" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, ((!newComment.trim() && !selectedImage) || submitting) && styles.disabledButton]}
              onPress={handleAddComment}
              disabled={(!newComment.trim() && !selectedImage) || submitting}
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
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedPhotoForModal.url }}
                style={styles.modalImage}
                resizeMode="contain"
                onError={(error) => {
                  console.error('Modal fotoğraf yükleme hatası:', error.nativeEvent.error);

                  // Hata mesajı göster
                  Alert.alert(
                    'Hata',
                    'Fotoğraf yüklenirken bir hata oluştu. Lütfen tekrar deneyin.',
                    [
                      {
                        text: 'Tamam',
                        onPress: () => setModalVisible(false)
                      }
                    ]
                  );
                }}
                defaultSource={require('../assets/images/placeholder.png')}
              />
              {selectedPhotoForModal.location && (
                <View style={styles.modalLocationBadge}>
                  <MaterialCommunityIcons name="map-marker" size={16} color="#fff" />
                  <Text style={styles.modalLocationText} numberOfLines={1} ellipsizeMode="tail">
                    {selectedPhotoForModal.location}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loader: {
    marginTop: 20,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
    color: '#444',
  },
  photoContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    backgroundColor: '#fff',
    transform: [{ scale: 1 }], // For transition effect
    maxWidth: '80%', // Maksimum genişlik sınırlaması
    alignSelf: 'center', // Yatayda ortalama
  },
  commentPhoto: {
    width: '100%',
    height: 150, // Daha küçük boyut
    borderRadius: 12,
    objectFit: 'cover',
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  locationText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  buttonGroup: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  photoButton: {
    backgroundColor: '#f8f9fa',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  submitButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
  },
  editContainer: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  editButtonText: {
    color: '#333',
    fontSize: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
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
});

export default TripComments;
