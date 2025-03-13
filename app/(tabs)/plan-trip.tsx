import { StyleSheet, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
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
import { searchPlaces, getPlaceDetails } from '@/app/services/places.service';
import { Ionicons } from '@expo/vector-icons';

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

interface Place {
  place_id: string;
  formatted_address: string;
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
  const [searchResults, setSearchResults] = useState<Place[]>([]);
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
          const results = await searchPlaces(searchQuery, isDomestic);
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
    }, 500);

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
    if (Platform.OS === 'ios') {
      return (
        <DateTimePicker
          value={formState.startDate}
          mode="date"
          display="spinner"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (date) {
              setFormState({ ...formState, startDate: date });
            }
          }}
          minimumDate={new Date()}
        />
      );
    }

    if (Platform.OS === 'android') {
      return showDatePicker ? (
        <DateTimePicker
          value={formState.startDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) {
              setFormState({ ...formState, startDate: date });
            }
          }}
          minimumDate={new Date()}
        />
      ) : null;
    }

    return null;
  };

  const handlePlaceSelect = async (place: Place) => {
    try {
      const details = await getPlaceDetails(place.place_id);
      setFormState({ ...formState, city: details.name });
      setSearchQuery(details.name);
      setShowResults(false);
    } catch (error) {
      console.error('Error getting place details:', error);
      Alert.alert('Hata', 'Şehir detayları alınırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.header}
      >
        <ThemedText style={styles.title}>Seyahat Planı Oluştur</ThemedText>
        <ThemedText style={styles.subtitle}>
          Yapay zeka asistanımız size özel bir seyahat planı hazırlayacak
        </ThemedText>
      </LinearGradient>

      <View style={styles.formContainer}>
        {/* Domestic/International Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, isDomestic && styles.toggleButtonActive]}
            onPress={() => setIsDomestic(true)}
          >
            <Ionicons
              name="home-outline"
              size={24}
              color={isDomestic ? '#fff' : '#4c669f'}
            />
            <ThemedText style={[styles.toggleButtonText, isDomestic && styles.toggleButtonTextActive]}>
              TÜRKİYE GEZİSİ
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !isDomestic && styles.toggleButtonActive]}
            onPress={() => setIsDomestic(false)}
          >
            <Ionicons
              name="airplane-outline"
              size={24}
              color={!isDomestic ? '#fff' : '#4c669f'}
            />
            <ThemedText style={[styles.toggleButtonText, !isDomestic && styles.toggleButtonTextActive]}>
              YURT DIŞI GEZİSİ
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Country Selection */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Yaşadığınız Ülke</ThemedText>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formState.residenceCountry}
              onValueChange={(value: string) => setFormState({ ...formState, residenceCountry: value })}
              style={styles.picker}
            >
              <Picker.Item label="Seçiniz" value="" />
              {countries.map((country) => (
                <Picker.Item
                  key={country.cca2}
                  label={country.name.common}
                  value={country.name.common}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Vatandaşlık</ThemedText>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formState.citizenship}
              onValueChange={(value: string) => setFormState({ ...formState, citizenship: value })}
              style={styles.picker}
            >
              <Picker.Item label="Seçiniz" value="" />
              {countries.map((country) => (
                <Picker.Item
                  key={country.cca2}
                  label={country.name.common}
                  value={country.name.common}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* City Input */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Nereye gitmek istiyorsunuz?</ThemedText>
          <View style={styles.inputWrapper}>
            <Ionicons name="location-outline" size={24} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setFormState({ ...formState, city: text });
              }}
              placeholder={isDomestic ? "Örn: İstanbul, Türkiye" : "Örn: Paris, Fransa"}
              placeholderTextColor="#666"
            />
          </View>
          {showResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((place) => (
                <TouchableOpacity
                  key={place.place_id}
                  style={styles.searchResultItem}
                  onPress={() => handlePlaceSelect(place)}
                >
                  <Ionicons name="location-outline" size={20} color="#666" style={styles.searchResultIcon} />
                  <ThemedText style={styles.searchResultText}>
                    {place.formatted_address}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Days Input */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Kaç gün kalacaksınız?</ThemedText>
          <View style={styles.inputWrapper}>
            <Ionicons name="calendar-outline" size={24} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={formState.days.toString()}
              onChangeText={(text) => {
                const days = parseInt(text) || 1;
                if (days >= 1 && days <= 5) {
                  setFormState({ ...formState, days });
                }
              }}
              placeholder="1-5 gün"
              keyboardType="numeric"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Başlangıç Tarihi</ThemedText>
          {Platform.OS === 'android' ? (
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={24} color="#666" style={styles.inputIcon} />
              <ThemedText style={styles.dateButtonText}>
                {formState.startDate.toLocaleDateString('tr-TR')}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={styles.datePickerContainer}>
              {renderDatePicker()}
            </View>
          )}
        </View>

        {/* Budget Selection */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Bütçe</ThemedText>
          <View style={styles.optionsContainer}>
            {budgetOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  formState.budget === option.value && styles.optionCardActive,
                ]}
                onPress={() => setFormState({ ...formState, budget: option.value })}
              >
                <Ionicons
                  name={option.value === 'low' ? 'wallet-outline' : option.value === 'medium' ? 'card-outline' : 'cash-outline'}
                  size={24}
                  color={formState.budget === option.value ? '#4c669f' : '#666'}
                />
                <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                <ThemedText style={styles.optionDescription}>{option.description}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Companion Selection */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Seyahat Arkadaşı</ThemedText>
          <View style={styles.optionsContainer}>
            {companionOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  formState.companion === option.value && styles.optionCardActive,
                ]}
                onPress={() => setFormState({ ...formState, companion: option.value })}
              >
                <Ionicons
                  name={option.value === 'alone' ? 'person-outline' : option.value === 'couple' ? 'people-outline' : 'people'}
                  size={24}
                  color={formState.companion === option.value ? '#4c669f' : '#666'}
                />
                <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                <ThemedText style={styles.optionDescription}>{option.description}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handlePlanTrip}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#4c669f', '#3b5998']}
            style={styles.buttonGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="create-outline" size={24} color="#fff" style={styles.buttonIcon} />
                <ThemedText style={styles.buttonText}>Plan Oluştur</ThemedText>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 32,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    lineHeight: 24,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    marginTop: -40,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4c669f',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#4c669f',
  },
  toggleButtonText: {
    color: '#4c669f',
    fontWeight: 'bold',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCardActive: {
    borderColor: '#4c669f',
    backgroundColor: '#f8f9fa',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    marginTop: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  datePickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchResults: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchResultIcon: {
    marginRight: 8,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
}); 