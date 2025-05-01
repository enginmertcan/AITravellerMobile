import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Image,
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as NearbyPlacesService from './services/nearby-places.service';
import { NearbyPlace, LocationData } from './services/nearby-places.service';

// Sıralama seçenekleri için enum
enum SortOption {
  RATING = 'rating',
  DISTANCE = 'distance',
}

const SORT_OPTIONS = [
  { id: SortOption.RATING, name: 'Yıldıza Göre', icon: 'star' },
  { id: SortOption.DISTANCE, name: 'Uzaklığa Göre', icon: 'map-marker-distance' },
];

const PLACE_TYPES = [
  { id: 'tourist_attraction', name: 'Turistik Yerler', icon: 'camera', keywords: ['turist', 'gezi', 'görülecek'] },
  { id: 'restaurant', name: 'Restoranlar', icon: 'food-fork-drink', keywords: ['yemek', 'restoran', 'lokanta'] },
  { id: 'museum', name: 'Müzeler', icon: 'bank', keywords: ['müze', 'sergi', 'kültür'] },
  { id: 'shopping_mall', name: 'Alışveriş', icon: 'shopping', keywords: ['avm', 'mağaza', 'market'] },
  { id: 'hotel', name: 'Oteller', icon: 'bed', keywords: ['otel', 'konaklama', 'pansiyon'] },
  { id: 'park', name: 'Parklar', icon: 'tree', keywords: ['park', 'bahçe', 'yeşil alan'] },
  { id: 'cafe', name: 'Kafeler', icon: 'coffee', keywords: ['kafe', 'kahve', 'çay'] },
  { id: 'bar', name: 'Barlar', icon: 'glass-cocktail', keywords: ['bar', 'pub', 'gece hayatı'] },
  { id: 'bakery', name: 'Fırınlar', icon: 'bread-slice', keywords: ['fırın', 'pastane', 'ekmek'] },
];

export default function NearbyPlacesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selectedType, setSelectedType] = useState('tourist_attraction');
  const [mapVisible, setMapVisible] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>(SortOption.RATING);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const router = useRouter();

  // Kullanıcı konumunu ve yakın yerleri yükle
  useEffect(() => {
    loadUserLocationAndPlaces();
  }, [selectedType]);

  const loadUserLocationAndPlaces = async () => {
    try {
      setLoading(true);

      // Kullanıcı konumunu al
      const location = await NearbyPlacesService.getCurrentLocation();
      setUserLocation(location);

      // Seçilen türe göre yakın yerleri al
      let nearbyPlaces;

      // Seçilen türe göre uygun fonksiyonu çağır
      switch (selectedType) {
        case 'tourist_attraction':
          nearbyPlaces = await NearbyPlacesService.getNearbyTouristAttractions();
          break;
        case 'restaurant':
          nearbyPlaces = await NearbyPlacesService.getNearbyRestaurants();
          break;
        case 'museum':
          nearbyPlaces = await NearbyPlacesService.getNearbyMuseums();
          break;
        case 'shopping_mall':
          nearbyPlaces = await NearbyPlacesService.getNearbyShoppingMalls();
          break;
        case 'hotel':
          nearbyPlaces = await NearbyPlacesService.getNearbyHotels();
          break;
        case 'park':
          nearbyPlaces = await NearbyPlacesService.getNearbyParks();
          break;
        case 'cafe':
          nearbyPlaces = await NearbyPlacesService.getNearbyCafes();
          break;
        case 'bar':
          nearbyPlaces = await NearbyPlacesService.getNearbyBars();
          break;
        case 'bakery':
          nearbyPlaces = await NearbyPlacesService.getNearbyBakeries();
          break;
        default:
          // Diğer türler için genel fonksiyonu kullan
          nearbyPlaces = await NearbyPlacesService.getNearbyPlaces(
            location,
            5000, // Daha geniş bir arama yarıçapı kullan
            selectedType
          );
      }

      // Yerleri ayarla ve mevcut sıralama seçeneğine göre sırala
      setPlaces(nearbyPlaces);

      // Yeni yerler yüklendikten sonra mevcut sıralama seçeneğine göre sırala
      setTimeout(() => sortPlaces(sortOption), 0);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);

      // Hata mesajını daha açıklayıcı hale getir
      let errorMessage = 'Konum bilgisi veya yakın yerler alınamadı.';

      // Hata türüne göre özel mesajlar
      if (error instanceof Error) {
        if (error.message.includes('Konum izni verilmedi')) {
          errorMessage = 'Konum izni verilmedi. Yakın yerleri görebilmek için konum izni vermeniz gerekiyor.';
        } else if (error.message.includes('türünde yer bulunamadı')) {
          errorMessage = `Yakınınızda ${getPlaceTypeTitle().toLowerCase()} bulunamadı. Başka bir kategori seçmeyi veya arama yarıçapını artırmayı deneyebilirsiniz.`;
        } else if (error.message.includes('API hatası')) {
          errorMessage = 'Google Places API ile iletişim kurulurken bir sorun oluştu. Lütfen internet bağlantınızı kontrol edin.';
        }
      }

      Alert.alert(
        'Hata',
        errorMessage,
        [
          {
            text: 'Tekrar Dene',
            onPress: () => loadUserLocationAndPlaces()
          },
          {
            text: 'Tamam',
            style: 'cancel'
          }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserLocationAndPlaces();
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
  };

  const getPlaceTypeTitle = () => {
    const selectedTypeObj = PLACE_TYPES.find(type => type.id === selectedType);
    return selectedTypeObj ? selectedTypeObj.name : 'Yakın Yerler';
  };

  const toggleMapView = () => {
    setMapVisible(!mapVisible);
  };

  // Sıralama seçeneğini değiştir
  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
    setSortModalVisible(false);
    sortPlaces(option);
  };

  // Yerleri sırala
  const sortPlaces = (option: SortOption) => {
    if (!places || places.length === 0) {
      console.log('Sıralanacak yer bulunamadı.');
      return;
    }

    console.log(`${places.length} yer ${option} kriterine göre sıralanıyor...`);

    const sortedPlaces = [...places];

    if (option === SortOption.RATING) {
      // Yıldıza göre sırala (yüksekten düşüğe)
      sortedPlaces.sort((a, b) => {
        // Önce puanı olmayan yerleri en sona koy
        if (!a.rating && b.rating) return 1;
        if (a.rating && !b.rating) return -1;

        // İki yerin de puanı varsa, yüksekten düşüğe sırala
        return (b.rating || 0) - (a.rating || 0);
      });
    } else if (option === SortOption.DISTANCE) {
      // Uzaklığa göre sırala (yakından uzağa)
      sortedPlaces.sort((a, b) => {
        // Önce mesafesi olmayan yerleri en sona koy
        if (!a.distance && b.distance) return 1;
        if (a.distance && !b.distance) return -1;

        // İki yerin de mesafesi varsa, yakından uzağa sırala
        return (a.distance || 0) - (b.distance || 0);
      });
    }

    console.log('Sıralama tamamlandı.');
    setPlaces(sortedPlaces);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Yakın Yerler</ThemedText>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setSortModalVisible(true)}
        >
          <MaterialCommunityIcons
            name="sort"
            size={24}
            color="#4c669f"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={toggleMapView}
        >
          <MaterialCommunityIcons
            name={mapVisible ? "format-list-bulleted" : "map"}
            size={24}
            color="#4c669f"
          />
        </TouchableOpacity>
      </View>

      {/* Sıralama Seçenekleri Modalı */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sortModalVisible}
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Sıralama Seçenekleri</ThemedText>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.sortOption,
                  sortOption === option.id && styles.selectedSortOption
                ]}
                onPress={() => handleSortChange(option.id as SortOption)}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={24}
                  color={sortOption === option.id ? "#fff" : "#4c669f"}
                />
                <ThemedText
                  style={[
                    styles.sortOptionText,
                    sortOption === option.id && styles.selectedSortOptionText
                  ]}
                >
                  {option.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.typeSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeSelectorContent}
        >
          {PLACE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeButton,
                selectedType === type.id && styles.selectedTypeButton
              ]}
              onPress={() => handleTypeSelect(type.id)}
            >
              <MaterialCommunityIcons
                name={type.icon}
                size={20}
                color={selectedType === type.id ? "#fff" : "#4c669f"}
              />
              <ThemedText
                style={[
                  styles.typeButtonText,
                  selectedType === type.id && styles.selectedTypeButtonText
                ]}
              >
                {type.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>
          {getPlaceTypeTitle()} {userLocation ? '(Yakınınızda)' : ''}
        </ThemedText>

        <View style={styles.sortIndicator}>
          <MaterialCommunityIcons
            name={sortOption === SortOption.RATING ? 'star' : 'map-marker-distance'}
            size={16}
            color="#4c669f"
          />
          <ThemedText style={styles.sortIndicatorText}>
            {sortOption === SortOption.RATING ? 'Yıldıza Göre' : 'Uzaklığa Göre'}
          </ThemedText>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4c669f" />
          <ThemedText style={styles.loadingText}>
            Yakın yerler yükleniyor...
          </ThemedText>
        </View>
      ) : mapVisible ? (
        // Harita Görünümü
        <View style={styles.mapContainer}>
          {userLocation && (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              {/* Kullanıcı konumu */}
              <Marker
                coordinate={{
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                }}
                title="Konumunuz"
                pinColor="#4c669f"
              />

              {/* Yakın yerler */}
              {places.map((place) => (
                <Marker
                  key={place.id}
                  coordinate={{
                    latitude: place.geometry.location.lat,
                    longitude: place.geometry.location.lng,
                  }}
                  title={place.name}
                  description={place.vicinity}
                />
              ))}
            </MapView>
          )}
        </View>
      ) : (
        // Liste Görünümü
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {places.length > 0 ? (
            places.map((place) => (
              <View key={place.id} style={styles.placeCard}>
                {place.photos && place.photos.length > 0 ? (
                  <Image
                    source={{ uri: place.photos[0] }}
                    style={styles.placeImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <MaterialCommunityIcons
                      name={PLACE_TYPES.find(type => type.id === selectedType)?.icon || 'map-marker'}
                      size={40}
                      color="#4c669f"
                    />
                  </View>
                )}

                <View style={styles.placeInfo}>
                  <ThemedText style={styles.placeName}>{place.name}</ThemedText>
                  <ThemedText style={styles.placeAddress}>{place.vicinity}</ThemedText>

                  <View style={styles.detailsContainer}>
                    {place.rating ? (
                      <View style={styles.ratingContainer}>
                        <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                        <ThemedText style={styles.ratingText}>{place.rating.toFixed(1)}</ThemedText>
                      </View>
                    ) : null}

                    {place.distance ? (
                      <View style={styles.distanceContainer}>
                        <MaterialCommunityIcons name="map-marker-distance" size={16} color="#4c669f" />
                        <ThemedText style={styles.distanceText}>
                          {place.distance < 1000
                            ? `${Math.round(place.distance)} m`
                            : `${(place.distance / 1000).toFixed(1)} km`}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.directionButton}
                  onPress={() => {
                    // Google Maps'te yol tarifi için URL oluştur
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.geometry.location.lat},${place.geometry.location.lng}&destination_place_id=${place.id}&travelmode=driving`;
                    // URL'yi açmak için Linking kullan
                    import('expo-linking').then(Linking => {
                      Linking.openURL(url);
                    });
                  }}
                >
                  <MaterialCommunityIcons name="directions" size={24} color="#4c669f" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="map-search" size={80} color="#4c669f" />
              <ThemedText style={styles.emptyText}>
                Yakınınızda {getPlaceTypeTitle().toLowerCase()} bulunamadı.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  headerButton: {
    marginLeft: 10,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  selectedSortOption: {
    backgroundColor: '#4c669f',
    borderColor: '#4c669f',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#4c669f',
    marginLeft: 15,
    fontFamily: 'SpaceMono',
  },
  selectedSortOptionText: {
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
    flex: 1,
  },
  typeSelector: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  typeSelectorContent: {
    paddingVertical: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  selectedTypeButton: {
    backgroundColor: '#4c669f',
    borderColor: '#4c669f',
  },
  typeButtonText: {
    color: '#4c669f',
    marginLeft: 8,
    fontFamily: 'SpaceMono',
    fontSize: 14,
  },
  selectedTypeButtonText: {
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
    flex: 1,
  },
  sortIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  sortIndicatorText: {
    fontSize: 12,
    color: '#4c669f',
    marginLeft: 5,
    fontFamily: 'SpaceMono',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  placeCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  placeImage: {
    width: 100,
    height: 100,
  },
  placeholderImage: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  placeAddress: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  detailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 4,
    fontFamily: 'SpaceMono',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 4,
    fontFamily: 'SpaceMono',
  },
  directionButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    margin: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.3)',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
