import React from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useState, useEffect } from 'react';

import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { budgetOptions, companionOptions } from '@/app/constants/options';
import { chatSession } from '@/app/services/ai.service';
import { FirebaseService } from '@/app/services/firebase.service';
import { getCountries } from '@/app/services/location.service';
import { searchPlaces, getPlaceDetails, type Place as PlaceType } from '@/app/services/places.service';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// AsyncStorage kaldırıldı

// Firebase servisindeki formatTravelPlanForWeb fonksiyonunu kullan
// Bu fonksiyon artık kaldırıldı, doğrudan Firebase servisini kullanıyoruz

interface Country {
  name: {
    common: string;
    official: string;
  };
  cca2: string;
  flags: {
    png: string;
    svg: string;
  };
}

export default function PlanTripScreen() {
  const router = useRouter();
  const { userId, isSignedIn } = useAuth(); // useAuth hook'unu en üst seviyede çağırıyoruz
  const [isDomestic, setIsDomestic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [formState, setFormState] = useState<{
    city: string;
    startDate: string;
    _selectedDate: Date;
    startDateISO?: string; // ISO formatında tarih (hava durumu için)
    days: number;
    budget: string;
    companion: string;
    residenceCountry: string;
    citizenship: string;
  }>({
    city: '',
    startDate: new Date().toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }), // Türkçe formatında (30 Nisan 2025)
    _selectedDate: new Date(),
    startDateISO: new Date().toISOString(), // ISO formatında tarih
    days: 3,
    budget: 'moderate', // Default olarak orta bütçe seçili
    companion: 'couple', // Default olarak çift seçili
    residenceCountry: '',
    citizenship: '',
  });
  const [countrySearchText, setCountrySearchText] = useState('');
  const [citizenshipSearchText, setCitizenshipSearchText] = useState('');
  const [filteredResidenceCountries, setFilteredResidenceCountries] = useState<typeof countries>([]);
  const [filteredCitizenshipCountries, setFilteredCitizenshipCountries] = useState<typeof countries>([]);
  const [showResidenceResults, setShowResidenceResults] = useState(false);
  const [showCitizenshipResults, setShowCitizenshipResults] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceType[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const fetchedCountries = await getCountries();
        setCountries(fetchedCountries);
        setFilteredResidenceCountries(fetchedCountries);
        setFilteredCitizenshipCountries(fetchedCountries);
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };
    fetchCountries();
  }, []);

  const filterResidenceCountries = (text: string) => {
    setCountrySearchText(text);

    if (text.trim().length >= 3) {
      const filtered = countries.filter(country =>
        country.name.common.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredResidenceCountries(filtered);
      setShowResidenceResults(true);
    } else {
      setShowResidenceResults(false);
    }
  };

  const filterCitizenshipCountries = (text: string) => {
    setCitizenshipSearchText(text);

    if (text.trim().length >= 3) {
      const filtered = countries.filter(country =>
        country.name.common.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredCitizenshipCountries(filtered);
      setShowCitizenshipResults(true);
    } else {
      setShowCitizenshipResults(false);
    }
  };

  const selectResidenceCountry = (country: Country) => {
    setFormState({ ...formState, residenceCountry: country.name.common });
    setCountrySearchText(country.name.common);
    setShowResidenceResults(false);
  };

  const selectCitizenshipCountry = (country: Country) => {
    setFormState({ ...formState, citizenship: country.name.common });
    setCitizenshipSearchText(country.name.common);
    setShowCitizenshipResults(false);
  };

  useEffect(() => {
    if (!isSignedIn) {
      Alert.alert(
        'Giriş Gerekli',
        'Seyahat planı oluşturmak için lütfen giriş yapın.',
        [
          {
            text: 'Giriş Yap',
            onPress: () => router.push('/sign-in'),
          },
          {
            text: 'İptal',
            style: 'cancel',
          },
        ]
      );
      router.push('/sign-in');
    }
  }, [isSignedIn]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        try {
          console.log('Searching places with:', { query: searchQuery, domestic: isDomestic });
          const results = await searchPlaces(searchQuery, isDomestic);
          console.log('Search results:', results);
          setSearchResults(results);
          setShowResults(true);
        } catch (error) {
          console.error('Error searching places:', error);
          Alert.alert('Hata', 'Şehir araması sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isDomestic]);




  const handlePlanTrip = async () => {
    if (!isSignedIn) {
      Alert.alert('Giriş Gerekli', 'Lütfen önce giriş yapın.');
      return;
    }

    // Tüm form alanlarını kontrol et
    if (!formState.city) {
      Alert.alert('Hata', 'Lütfen bir şehir seçin.');
      return;
    }
    if (!formState.budget) {
      Alert.alert('Hata', 'Lütfen bir bütçe seçin.');
      return;
    }
    if (!formState.companion) {
      Alert.alert('Hata', 'Lütfen seyahat arkadaşınızı seçin.');
      return;
    }
    if (!formState.residenceCountry) {
      Alert.alert('Hata', 'Lütfen yaşadığınız ülkeyi seçin.');
      return;
    }
    if (!formState.citizenship) {
      Alert.alert('Hata', 'Lütfen vatandaşlığınızı seçin.');
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingStage('Seyahat planı oluşturuluyor...');

    try {
      // Kullanıcı ID'sini kullan
      const userIdStr = userId || '';

      // Form verilerini hazırla
      // _selectedDate'i kullan (çünkü startDate string formatında)
      // Eğer startDateISO varsa, onu kullan (en doğru tarih bilgisi)
      let selectedDate: Date;

      if (formState.startDateISO) {
        selectedDate = new Date(formState.startDateISO);
      } else if (formState._selectedDate) {
        // UTC kullanarak tarih oluştur - gün kayması sorununu önlemek için
        selectedDate = new Date(Date.UTC(
          formState._selectedDate.getFullYear(),
          formState._selectedDate.getMonth(),
          formState._selectedDate.getDate()
        ));
      } else {
        // Fallback olarak bugünün tarihini kullan
        const today = new Date();
        selectedDate = new Date(Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ));
      }

      // İlerleme animasyonu başlat
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 1000);

      // Aşamaları göster
      setTimeout(() => setLoadingStage('Destinasyon bilgileri analiz ediliyor...'), 2000);
      setTimeout(() => setLoadingStage('Hava durumu verileri alınıyor...'), 4000);
      setTimeout(() => setLoadingStage('Aktiviteler planlanıyor...'), 6000);
      setTimeout(() => setLoadingStage('Konaklama önerileri hazırlanıyor...'), 8000);
      setTimeout(() => setLoadingStage('Seyahat planı tamamlanıyor...'), 10000);

      console.log('AI servisine gönderilen tarih:', selectedDate.toISOString());
      console.log('Form state:', formState);
      console.log('AI servisine gönderilen gün sayısı:', formState.days);

      const travelFormData = {
        city: formState.city,
        destination: formState.city,
        days: formState.days,
        startDate: selectedDate.toISOString(),
        startDateFormatted: formState.startDate, // Türkçe formatı da gönder
        budget: formState.budget,
        companion: formState.companion,
        residenceCountry: formState.residenceCountry,
        citizenship: formState.citizenship,
        isDomestic: isDomestic,
        userId: userIdStr,
      };

      // AI servisini çağır - createTravelPlan metodu
      const travelPlan = await chatSession.createTravelPlan(travelFormData);

      // İlerlemeyi tamamla
      clearInterval(progressInterval);
      setLoadingProgress(95);
      setLoadingStage('Plan kaydediliyor...');

      // Web uyumluluğu için veri formatını düzenle
      const formattedPlan = FirebaseService.TravelPlan.formatTravelPlanForWeb(travelPlan);

      // Firebase'e kaydet
      let travelPlanId = '';
      try {
        travelPlanId = await FirebaseService.TravelPlan.createTravelPlan(formattedPlan);
        setLoadingProgress(100);
        setLoadingStage('Tamamlandı!');
      } catch (error) {
        Alert.alert(
          'Hata',
          'Seyahat planı kaydedilemedi. Lütfen daha sonra tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
        return; // Hata durumunda işlemi sonlandır
      }

      // Başarı modalı göster
      if (travelPlanId) {
        // Haptic feedback
        if (Platform.OS === 'ios') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.log('Haptic feedback not available');
          }
        }

        // Başarı mesajı göster
        Alert.alert(
          'Seyahat Planı Oluşturuldu!',
          'Seyahat planınız başarıyla oluşturuldu. Şimdi detayları görüntüleyebilir, planınızı önerebilir veya beğenebilirsiniz.',
          [
            {
              text: 'Detayları Görüntüle',
              onPress: () => router.push(`/trip-details?id=${travelPlanId}`),
            },
            {
              text: 'Ana Sayfaya Dön',
              onPress: () => router.push('/'),
              style: 'cancel',
            },
          ]
        );
      } else {
        router.push('/trip-details');
      }
    } catch (error) {
      Alert.alert('Hata', 'Seyahat planı oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (date) {
      // Güncellenen tarihi kaydet
      // UTC kullanarak tarih oluştur - gün kayması sorununu önlemek için
      const selectedDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ));

      // Web uygulaması için Türkçe tarih formatı (30 Nisan 2025)
      const turkishDate = selectedDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // Ayrıca DD/MM/YYYY formatında da kaydet (API çağrıları için)
      const formattedDate = `${selectedDate.getUTCDate().toString().padStart(2, '0')}/${(selectedDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${selectedDate.getUTCFullYear()}`;

      console.log('Seçilen tarih (Türkçe):', turkishDate);
      console.log('Seçilen tarih (DD/MM/YYYY):', formattedDate);
      console.log('Seçilen tarih (ISO):', selectedDate.toISOString());

      setSelectedDate(selectedDate); // Date objesi olarak tut
      setFormState(prev => ({
        ...prev,
        startDate: turkishDate, // Türkçe format olarak kaydet (web uyumluluğu için)
        _selectedDate: selectedDate, // Date objesini ayrıca tut (gerektiğinde kullanmak için)
        startDateISO: selectedDate.toISOString() // ISO formatını da sakla (hava durumu için)
      }));
    }
  };

  const renderDatePicker = () => {
    if (Platform.OS === 'ios') {
      // iOS için her zaman göster
      return (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
          minimumDate={new Date()}
          style={{ width: '100%', backgroundColor: '#222' }}
          textColor="#fff"
        />
      );
    } else if (showDatePicker) {
      // Android için sadece showDatePicker true olduğunda göster
      return (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      );
    }

    return null;
  };

  const handlePlaceSelect = async (place: PlaceType) => {
    try {
      const details = await getPlaceDetails(place.placeId, isDomestic);
      if (details) {
        // Şehir seçildiğinde form güncellenir ve arama kapatılır
        setFormState({ ...formState, city: details.description });
        setSearchQuery(place.mainText);
        setShowResults(false);
        // Arama sonuçlarını temizle
        setSearchResults([]);
      }
    } catch (error) {
      Alert.alert('Hata', 'Şehir detayları alınırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <ThemedText style={styles.title} numberOfLines={1} ellipsizeMode="tail">Seyahat Planı Oluştur</ThemedText>
        <ThemedText style={styles.subtitle}>
          Yapay zeka asistanımız size özel bir seyahat planı hazırlayacak
        </ThemedText>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Seyahat Türü</ThemedText>
          <View style={styles.tripTypeContainer}>
            <TouchableOpacity
              style={[styles.tripTypeCard, isDomestic && styles.tripTypeCardActive]}
              onPress={() => setIsDomestic(true)}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDomestic ? '#4c669f33' : '#11111166' }]}>
                <MaterialCommunityIcons
                  name="home-heart"
                  size={32}
                  color={isDomestic ? '#4c669f' : '#666'}
                />
              </View>
              <ThemedText style={[styles.tripTypeTitle, isDomestic && styles.tripTypeTitleActive]}>
                Yurt İçi
              </ThemedText>
              <ThemedText style={[styles.tripTypeDesc, isDomestic && styles.tripTypeDescActive]}>
                Türkiye'nin güzelliklerini keşfet
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tripTypeCard, !isDomestic && styles.tripTypeCardActive]}
              onPress={() => setIsDomestic(false)}
            >
              <View style={[styles.iconContainer, { backgroundColor: !isDomestic ? '#4c669f33' : '#11111166' }]}>
                <MaterialCommunityIcons
                  name="airplane-takeoff"
                  size={32}
                  color={!isDomestic ? '#4c669f' : '#666'}
                />
              </View>
              <ThemedText style={[styles.tripTypeTitle, !isDomestic && styles.tripTypeTitleActive]}>
                Yurt Dışı
              </ThemedText>
              <ThemedText style={[styles.tripTypeDesc, !isDomestic && styles.tripTypeDescActive]}>
                Dünyayı keşfetmeye hazır mısın?
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Nereyi Keşfetmek İstersin?</ThemedText>
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="map-search" size={24} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                // Eğer bir şehir seçilmediyse ve arama 2+ karakter ise sonuçları göster
                if (text.length >= 2 && !formState.city) {
                  setShowResults(true);
                } else {
                  setShowResults(false);
                }
              }}
              placeholder={isDomestic ? "Örn: İstanbul, Antalya..." : "Örn: Paris, Roma..."}
              placeholderTextColor="#666"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShowResults(false);
                  setFormState({ ...formState, city: '' });
                  setSearchResults([]);
                }}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          {showResults && searchResults.length > 0 && !formState.city && (
            <View style={styles.searchResults}>
              {searchResults.map((place) => (
                <TouchableOpacity
                  key={place.placeId}
                  style={styles.searchResultItem}
                  onPress={() => handlePlaceSelect(place)}
                >
                  <MaterialCommunityIcons name="map-marker" size={20} color="#4c669f" />
                  <View style={styles.searchResultTextContainer}>
                    <ThemedText style={styles.searchResultMainText}>
                      {place.mainText}
                    </ThemedText>
                    <ThemedText style={styles.searchResultSecondaryText}>
                      {place.secondaryText}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !formState.city && (
            <View style={styles.searchResults}>
              <View style={styles.searchResultItem}>
                <ThemedText style={styles.searchResultMainText}>
                  Sonuç bulunamadı
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Seyahat Detayları</ThemedText>

          <TouchableOpacity
            style={styles.detailCard}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f33' }]}>
              <MaterialCommunityIcons name="calendar-month" size={24} color="#4c669f" />
            </View>
            <View style={styles.detailContent}>
              <ThemedText style={styles.detailLabel}>Başlangıç Tarihi</ThemedText>
              <ThemedText style={styles.detailValue}>
                {formState._selectedDate.toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </ThemedText>
            </View>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(!showDatePicker)}
                style={{ padding: 8 }}
              >
                <MaterialCommunityIcons
                  name={showDatePicker ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {Platform.OS === 'ios' ? (
            <View style={[styles.datePickerContainer, !showDatePicker && styles.hiddenDatePicker]}>
              {renderDatePicker()}
            </View>
          ) : renderDatePicker()}

          <View style={styles.detailCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f33' }]}>
              <MaterialCommunityIcons name="clock-outline" size={24} color="#4c669f" />
            </View>
            <View style={styles.detailContent}>
              <ThemedText style={styles.detailLabel}>Süre (Maksimum 5 gün)</ThemedText>
              <View style={styles.durationControl}>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => setFormState({ ...formState, days: Math.max(1, formState.days - 1) })}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                </TouchableOpacity>
                <ThemedText style={styles.durationText}>{formState.days} Gün</ThemedText>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => setFormState({ ...formState, days: Math.min(5, formState.days + 1) })}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Bütçe</ThemedText>
          <View style={styles.optionsGrid}>
            {budgetOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  formState.budget === option.value && styles.optionCardActive
                ]}
                onPress={() => setFormState({ ...formState, budget: option.value })}
              >
                <View style={[styles.iconContainer, { backgroundColor: formState.budget === option.value ? '#4c669f33' : '#11111166' }]}>
                  <MaterialCommunityIcons
                    name={option.value === 'low' ? 'wallet-outline' : option.value === 'medium' ? 'credit-card-outline' : 'cash-multiple'}
                    size={24}
                    color={formState.budget === option.value ? '#4c669f' : '#666'}
                  />
                </View>
                <ThemedText style={[styles.optionTitle, formState.budget === option.value && styles.optionTitleActive]}>
                  {option.title}
                </ThemedText>
                <ThemedText style={[styles.optionDesc, formState.budget === option.value && styles.optionDescActive]}>
                  {option.description}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Kiminle Seyahat Edeceksin?</ThemedText>
          <View style={styles.optionsGrid}>
            {companionOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  formState.companion === option.value && styles.optionCardActive
                ]}
                onPress={() => setFormState({ ...formState, companion: option.value })}
              >
                <View style={[styles.iconContainer, { backgroundColor: formState.companion === option.value ? '#4c669f33' : '#11111166' }]}>
                  <MaterialCommunityIcons
                    name={option.value === 'alone' ? 'account' : option.value === 'couple' ? 'account-multiple' : 'account-group'}
                    size={24}
                    color={formState.companion === option.value ? '#4c669f' : '#666'}
                  />
                </View>
                <ThemedText style={[styles.optionTitle, formState.companion === option.value && styles.optionTitleActive]}>
                  {option.title}
                </ThemedText>
                <ThemedText style={[styles.optionDesc, formState.companion === option.value && styles.optionDescActive]}>
                  {option.description}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Ülke Bilgileri</ThemedText>
          <View style={styles.countryCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f33' }]}>
              <MaterialCommunityIcons name="home-city" size={24} color="#4c669f" />
            </View>
            <View style={styles.countryPicker}>
              <ThemedText style={styles.countryLabel}>Yaşadığınız Ülke</ThemedText>
              <View style={styles.searchablePickerContainer}>
                <View style={styles.inputContainer}>
                  {formState.residenceCountry && countrySearchText === formState.residenceCountry && (
                    <Image
                      source={{ uri: countries.find(c => c.name.common === formState.residenceCountry)?.flags.png }}
                      style={styles.selectedCountryFlag}
                    />
                  )}
                  <TextInput
                    style={styles.countrySearchInput}
                    placeholder="Ülke ara..."
                    placeholderTextColor="#999"
                    value={countrySearchText}
                    onChangeText={filterResidenceCountries}
                  />
                </View>
                {showResidenceResults && (
                  <ScrollView style={styles.searchResultsList} nestedScrollEnabled={true}>
                    {filteredResidenceCountries.length === 0 ? (
                      <TouchableOpacity style={styles.countryResultItem}>
                        <ThemedText>Sonuç bulunamadı</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      filteredResidenceCountries.map((country) => (
                        <TouchableOpacity
                          key={country.cca2}
                          style={styles.countryResultItem}
                          onPress={() => selectResidenceCountry(country)}
                        >
                          <Image
                            source={{ uri: country.flags.png }}
                            style={styles.countryFlag}
                          />
                          <ThemedText style={styles.countryName}>
                            {country.name.common}
                          </ThemedText>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>

            </View>
          </View>

          <View style={styles.countryCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f33' }]}>
              <MaterialCommunityIcons name="passport" size={24} color="#4c669f" />
            </View>
            <View style={styles.countryPicker}>
              <ThemedText style={styles.countryLabel}>Vatandaşlık</ThemedText>
              <View style={styles.searchablePickerContainer}>
                <View style={styles.inputContainer}>
                  {formState.citizenship && citizenshipSearchText === formState.citizenship && (
                    <Image
                      source={{ uri: countries.find(c => c.name.common === formState.citizenship)?.flags.png }}
                      style={styles.selectedCountryFlag}
                    />
                  )}
                  <TextInput
                    style={styles.countrySearchInput}
                    placeholder="Vatandaşlık ara..."
                    placeholderTextColor="#999"
                    value={citizenshipSearchText}
                    onChangeText={filterCitizenshipCountries}
                  />
                </View>
                {showCitizenshipResults && (
                  <ScrollView style={styles.searchResultsList} nestedScrollEnabled={true}>
                    {filteredCitizenshipCountries.length === 0 ? (
                      <TouchableOpacity style={styles.countryResultItem}>
                        <ThemedText>Sonuç bulunamadı</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      filteredCitizenshipCountries.map((country) => (
                        <TouchableOpacity
                          key={country.cca2}
                          style={styles.countryResultItem}
                          onPress={() => selectCitizenshipCountry(country)}
                        >
                          <Image
                            source={{ uri: country.flags.png }}
                            style={styles.countryFlag}
                          />
                          <ThemedText style={styles.countryName}>
                            {country.name.common}
                          </ThemedText>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>

            </View>
          </View>
        </View>

        {isLoading && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${loadingProgress}%` }]} />
            <ThemedText style={styles.progressText}>{loadingProgress}%</ThemedText>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handlePlanTrip}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <ThemedText style={styles.loadingText}>{loadingStage}</ThemedText>
            </View>
          ) : (
            <>
              <MaterialCommunityIcons name="robot" size={24} color="#fff" />
              <ThemedText style={styles.submitButtonText}>AI ile Plan Oluştur</ThemedText>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#4c669f" />
          <ThemedText style={styles.infoText}>
            Oluşturulan seyahat planınızı beğenebilir, önerebilir ve arkadaşlarınızla paylaşabilirsiniz.
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchablePickerContainer: {
    backgroundColor: '#222',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    maxHeight: 250,
  },
  countrySearchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#fff',
    fontFamily: 'InterRegular',
    fontSize: 16,
    padding: 8,
  },
  searchResultsList: {
    maxHeight: 200,
    borderRadius: 8,
    marginTop: 4,
  },
  countryResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  countryFlag: {
    width: 30,
    height: 20,
    marginRight: 10,
    borderRadius: 4,
  },
  countryName: {
    color: '#fff',
    fontFamily: 'InterRegular',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 8,
  },
  selectedCountryFlag: {
    width: 25,
    height: 18,
    marginRight: 8,
    borderRadius: 3,
  },
  datePickerContainer: {
    backgroundColor: '#222',
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 8,
    zIndex: 1000,
  },
  hiddenDatePicker: {
    display: 'none',
  },
  datePickerButton: {
    padding: 8,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'InterRegular',
    paddingRight: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'InterRegular',
  },
  formContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'InterRegular',
  },
  tripTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tripTypeCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  tripTypeCardActive: {
    backgroundColor: '#4c669f22',
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  tripTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
    fontFamily: 'InterRegular',
  },
  tripTypeTitleActive: {
    color: '#4c669f',
  },
  tripTypeDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'InterRegular',
  },
  tripTypeDescActive: {
    color: '#999',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'InterRegular',
  },
  searchResults: {
    backgroundColor: '#111',
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: 12,
  },
  searchResultTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultMainText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'InterRegular',
    fontWeight: '600',
  },
  searchResultSecondaryText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'InterRegular',
    marginTop: 2,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  detailContent: {
    flex: 1,
    marginLeft: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'InterRegular',
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'InterRegular',
  },
  durationControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  durationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4c669f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'InterRegular',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  optionCardActive: {
    backgroundColor: '#4c669f22',
    borderWidth: 1,
    borderColor: '#4c669f',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'InterRegular',
  },
  optionTitleActive: {
    color: '#4c669f',
  },
  optionDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'InterRegular',
  },
  optionDescActive: {
    color: '#999',
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  countryPicker: {
    flex: 1,
    marginLeft: 16,
  },
  countryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'InterRegular',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  pickerIcon: {
    marginRight: 8,
  },
  picker: {
    flex: 1,
    color: '#fff',
  },
  pickerItem: {
    color: '#fff',
    fontFamily: 'InterRegular',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4c669f',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginTop: 32,
    marginBottom: 20,
    shadowColor: '#4c669f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#5d77af',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'InterRegular',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    fontFamily: 'InterRegular',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    fontFamily: 'InterRegular',
  },
  progressBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4c669f',
    borderRadius: 10,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    lineHeight: 20,
  },
  selectedValue: {
    fontSize: 14,
    color: '#4c669f',
    marginTop: 8,
    fontFamily: 'InterRegular',
  },
  clearButton: {
    padding: 4,
  },
});