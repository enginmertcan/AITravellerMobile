import React from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { AI_PROMPT, budgetOptions, companionOptions } from '@/app/constants/options';
import { chatSession } from '@/app/services/ai.service';
import { getCountries } from '@/app/services/location.service';
import { searchPlaces, getPlaceDetails, type Place as PlaceType } from '@/app/services/places.service';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isDomestic, setIsDomestic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [formState, setFormState] = useState({
    city: '',
    days: 1,
    startDate: new Date(),
    budget: '',
    companion: '',
    residenceCountry: '',
    citizenship: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceType[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const fetchedCountries = await getCountries();
        setCountries(fetchedCountries);
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };
    fetchCountries();
  }, []);

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

    // Form validation
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

    try {
      const selectedBudget = budgetOptions.find(opt => opt.value === formState.budget);
      const selectedCompanion = companionOptions.find(opt => opt.value === formState.companion);

      const FINAL_PROMPT = AI_PROMPT
        .replace('{location}', formState.city)
        .replace('{totalDays}', formState.days.toString())
        .replace('{traveller}', selectedCompanion?.title || 'Belirtilmedi')
        .replace('{budget}', selectedBudget?.title || 'Belirtilmedi')
        .replace('{residenceCountry}', formState.residenceCountry)
        .replace('{citizenship}', formState.citizenship);

      const aiResponse = await chatSession.sendMessage(FINAL_PROMPT);
      const aiItinerary = aiResponse?.response?.text;

      // TODO: Save the travel plan to your database
      console.log('AI Response:', aiItinerary);

      Alert.alert(
        'Başarılı',
        'Seyahat planınız oluşturuldu!',
        [
          {
            text: 'Tamam',
            onPress: () => router.push('/'),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating travel plan:', error);
      Alert.alert('Hata', 'Seyahat planı oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderDatePicker = () => {
    const showPicker = Platform.OS === 'ios' || showDatePicker;
    
    return showPicker ? (
      <DateTimePicker
        value={formState.startDate}
        mode="date"
        display={Platform.OS === 'ios' ? "spinner" : "default"}
        onChange={(event: DateTimePickerEvent, date?: Date) => {
          if (Platform.OS === 'android') {
            setShowDatePicker(false);
          }
          if (date) {
            setFormState({ ...formState, startDate: date });
          }
        }}
        minimumDate={new Date()}
      />
    ) : null;
  };

  const handlePlaceSelect = async (place: PlaceType) => {
    try {
      const details = await getPlaceDetails(place.placeId, isDomestic);
      if (details) {
        setFormState({ ...formState, city: details.description });
        setSearchQuery(place.mainText);
        setShowResults(false);
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      Alert.alert('Hata', 'Şehir detayları alınırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Seyahat Planı Oluştur</ThemedText>
        <ThemedText style={styles.subtitle}>
          Yapay zeka asistanımız size özel bir seyahat planı hazırlayacak
        </ThemedText>
      </View>

      <View style={styles.formContainer}>
        {/* Trip Type Selection */}
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

        {/* Destination Search */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Nereyi Keşfetmek İstersin?</ThemedText>
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="map-search" size={24} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.length >= 2) {
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
                }}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          {showResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((place, index) => (
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
          {showResults && searchResults.length === 0 && searchQuery.length >= 2 && (
            <View style={styles.searchResults}>
              <View style={styles.searchResultItem}>
                <ThemedText style={styles.searchResultMainText}>
                  Sonuç bulunamadı
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Travel Details */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Seyahat Detayları</ThemedText>
          
          {/* Date Selection */}
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
                {formState.startDate.toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </ThemedText>
            </View>
          </TouchableOpacity>
          {renderDatePicker()}

          {/* Duration Selection */}
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

        {/* Budget Selection */}
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

        {/* Companion Selection */}
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

        {/* Country Selection */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Ülke Bilgileri</ThemedText>
          <View style={styles.countryCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f33' }]}>
              <MaterialCommunityIcons name="home-city" size={24} color="#4c669f" />
            </View>
            <View style={styles.countryPicker}>
              <ThemedText style={styles.countryLabel}>Yaşadığınız Ülke</ThemedText>
              <View style={styles.pickerContainer}>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#666" style={styles.pickerIcon} />
                <Picker
                  selectedValue={formState.residenceCountry}
                  onValueChange={(value) => setFormState({ ...formState, residenceCountry: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Ülke Seçin" value="" color="#666" />
                  {countries.map((country) => (
                    <Picker.Item
                      key={country.cca2}
                      label={country.name.common}
                      value={country.name.common}
                      color="#fff"
                    />
                  ))}
                </Picker>
              </View>
              {formState.residenceCountry && (
                <ThemedText style={styles.selectedValue}>
                  Seçilen: {formState.residenceCountry}
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.countryCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#4c669f33' }]}>
              <MaterialCommunityIcons name="passport" size={24} color="#4c669f" />
            </View>
            <View style={styles.countryPicker}>
              <ThemedText style={styles.countryLabel}>Vatandaşlık</ThemedText>
              <View style={styles.pickerContainer}>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#666" style={styles.pickerIcon} />
                <Picker
                  selectedValue={formState.citizenship}
                  onValueChange={(value) => setFormState({ ...formState, citizenship: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Vatandaşlık Seçin" value="" color="#666" />
                  {countries.map((country) => (
                    <Picker.Item
                      key={country.cca2}
                      label={country.name.common}
                      value={country.name.common}
                      color="#fff"
                    />
                  ))}
                </Picker>
              </View>
              {formState.citizenship && (
                <ThemedText style={styles.selectedValue}>
                  Seçilen: {formState.citizenship}
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handlePlanTrip}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="robot" size={24} color="#fff" />
              <ThemedText style={styles.submitButtonText}>AI ile Plan Oluştur</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'SpaceMono',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
  },
  tripTypeTitleActive: {
    color: '#4c669f',
  },
  tripTypeDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
    fontWeight: '600',
  },
  searchResultSecondaryText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
  },
  optionTitleActive: {
    color: '#4c669f',
  },
  optionDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
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
    fontFamily: 'SpaceMono',
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
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  selectedValue: {
    fontSize: 14,
    color: '#4c669f',
    marginTop: 8,
    fontFamily: 'SpaceMono',
  },
  clearButton: {
    padding: 4,
  },
}); 