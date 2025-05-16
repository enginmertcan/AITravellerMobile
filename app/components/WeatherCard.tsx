import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { WeatherData } from '../services/weather.service';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Define the type for MaterialCommunityIcons names
type MaterialCommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface WeatherCardProps {
  weatherData: WeatherData[];
}

// Weather icon mapping
const weatherIconMap: { [key: string]: MaterialCommunityIconName } = {
  '01d': 'weather-sunny',
  '01n': 'weather-night',
  '02d': 'weather-partly-cloudy',
  '02n': 'weather-night-partly-cloudy',
  '03d': 'weather-cloudy',
  '03n': 'weather-cloudy',
  '04d': 'weather-cloudy',
  '04n': 'weather-cloudy',
  '09d': 'weather-pouring',
  '09n': 'weather-pouring',
  '10d': 'weather-rainy',
  '10n': 'weather-rainy',
  '11d': 'weather-lightning-rainy',
  '11n': 'weather-lightning-rainy',
  '13d': 'weather-snowy',
  '13n': 'weather-snowy',
  '50d': 'weather-fog',
  '50n': 'weather-fog',
  'unknown': 'help-circle-outline',
};

// Çeviri Eşleme Objesi
const weatherDescriptionTranslations: { [key: string]: string } = {
  // Genel Durumlar
  "Clear": "Açık",
  "Clear sky": "Açık Hava",
  "Sunny": "Güneşli",
  // Bulutlu Durumlar
  "Clouds": "Bulutlu",
  "Cloudy": "Bulutlu",
  "Few clouds": "Az Bulutlu",
  "Scattered clouds": "Parçalı Bulutlu",
  "Broken clouds": "Çok Bulutlu",
  "Overcast clouds": "Kapalı Hava",
  "Partly cloudy": "Parçalı Bulutlu",
  // Yağışlı Durumlar
  "Rain": "Yağmurlu",
  "Light rain": "Hafif Yağmurlu",
  "Moderate rain": "Orta Şiddette Yağmur",
  "Heavy rain": "Şiddetli Yağmur",
  "Very heavy rain": "Çok Şiddetli Yağmur",
  "Extreme rain": "Aşırı Yağmur",
  "Freezing rain": "Dondurucu Yağmur",
  "Light intensity shower rain": "Hafif Sağanak Yağış",
  "Shower rain": "Sağanak Yağışlı",
  "Heavy intensity shower rain": "Şiddetli Sağanak Yağış",
  "Ragged shower rain": "Düzensiz Sağanak Yağış",
  "Drizzle": "Çisenti",
  "Light intensity drizzle": "Hafif Çisenti",
  "Heavy intensity drizzle": "Yoğun Çisenti",
  // Karlı Durumlar
  "Snow": "Karlı",
  "Light snow": "Hafif Karlı",
  "Heavy snow": "Yoğun Karlı",
  "Sleet": "Sulu Sepken",
  "Light shower sleet": "Hafif Sulu Sepken Yağışı",
  "Shower sleet": "Sulu Sepken Yağışı",
  "Light rain and snow": "Hafif Yağmur ve Kar",
  "Rain and snow": "Yağmur ve Kar",
  "Light shower snow": "Hafif Kar Yağışı",
  "Shower snow": "Kar Yağışı",
  "Heavy shower snow": "Yoğun Kar Yağışı",
  // Atmosferik Durumlar
  "Mist": "Sisli",
  "Smoke": "Dumanlı",
  "Haze": "Puslu",
  "Sand/dust whirls": "Kum/Toz Fırtınası",
  "Fog": "Yoğun Sis",
  "Sand": "Kum Fırtınası",
  "Dust": "Toz Bulutu",
  "Volcanic ash": "Volkanik Kül",
  "Squalls": "Kasırga",
  "Tornado": "Hortum",
  // Gök Gürültülü Fırtına
  "Thunderstorm": "Gök Gürültülü Fırtına",
  "Thunderstorm with light rain": "Hafif Yağmurlu Gök Gürültülü Fırtına",
  "Thunderstorm with rain": "Yağmurlu Gök Gürültülü Fırtına",
  "Thunderstorm with heavy rain": "Şiddetli Yağmurlu Gök Gürültülü Fırtına",
  "Light thunderstorm": "Hafif Gök Gürültülü Fırtına",
  "Heavy thunderstorm": "Şiddetli Gök Gürültülü Fırtına",
  "Ragged thunderstorm": "Düzensiz Gök Gürültülü Fırtına",
  "Thunderstorm with light drizzle": "Hafif Çisentili Gök Gürültülü Fırtına",
  "Thunderstorm with drizzle": "Çisentili Gök Gürültülü Fırtına",
  "Thunderstorm with heavy drizzle": "Yoğun Çisentili Gök Gürültülü Fırtına",
  // API'den gelebilecek diğer yaygın ifadeler (genelde baş harfleri büyük olur)
  "Partially cloudy": "Parçalı Bulutlu",
  "Mostly cloudy": "Çoğunlukla Bulutlu",
  "Scattered showers": "Yer Yer Sağanak Yağışlı",
  "Isolated thunderstorms": "Münferit Gök Gürültülü Fırtınalar",
  // Weather data unavailable messages (can be added here if API sometimes sends them)
  "Weather data not available": "Hava durumu verisi yok",
  "No data": "Veri yok",
};

// Çeviri Fonksiyonu
const translateWeatherDescription = (description: string): string => {
  // API'den gelen açıklamanın baş harflerini büyütüp karşılaştırma yapmak daha tutarlı olabilir
  // Örnek: "rain" yerine "Rain" ile eşleşmesi için
  const normalizedDescription = description.charAt(0).toUpperCase() + description.slice(1).toLowerCase();
  const foundTranslation = weatherDescriptionTranslations[description] || weatherDescriptionTranslations[normalizedDescription];
  return foundTranslation || description; // Çeviri bulunamazsa orijinal açıklamayı döndür
};

export default function WeatherCard({ weatherData }: WeatherCardProps) {
  const uniqueWeatherData = useMemo(() => {
    if (!weatherData || weatherData.length === 0) return [];

    // Log the received weather data for debugging
    console.log(`WeatherCard received ${weatherData.length} days of weather data:`,
      weatherData.map(day => day.date).join(', '));

    const uniqueDates = new Map<string, WeatherData>();

    const validWeatherData = weatherData.filter(day => {
      if (!day.date) return false;
      try {
        if (day.date.includes('/')) {
          const [dayPart, monthPart, yearPart] = day.date.split('/');
          if (!dayPart || !monthPart || !yearPart) return false;
          const dayNum = parseInt(dayPart);
          const monthNum = parseInt(monthPart);
          const yearNum = parseInt(yearPart);
          if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return false;
          if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return false;
          return true;
        } else if (day.date.includes('-')) {
          const [yearPart, monthPart, dayPart] = day.date.split('-');
          if (!dayPart || !monthPart || !yearPart) return false;
          const dayNum = parseInt(dayPart);
          const monthNum = parseInt(monthPart);
          const yearNum = parseInt(yearPart);
          if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return false;
          if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return false;
          return true;
        }
        return false;
      } catch (error) {
        console.error('Geçersiz tarih formatı WeatherCard.uniqueWeatherData içinde:', day.date, error);
        return false;
      }
    });

    // Log the valid weather data

    // Make sure each day is included only once by using the date as a key
    validWeatherData.forEach(day => {
      let dateKey = day.date;
      if (!uniqueDates.has(dateKey)) {
        uniqueDates.set(dateKey, day);
      } else {
        console.warn(`Duplicate date found in weather data: ${day.date}`);
      }
    });

    // Eğer hiç geçerli tarih yoksa, orijinal veriyi kullan
    if (uniqueDates.size === 0 && weatherData.length > 0) {
      console.warn('No valid dates found in weather data, using original data');
      weatherData.forEach((day, index) => {
        uniqueDates.set(`day-${index}`, day);
      });
    }

    // Sort the weather data by date
    const sortedData = Array.from(uniqueDates.values()).sort((a, b) => {
      try {
        let dateA_val: Date, dateB_val: Date;
        if (a.date && a.date.includes('/')) {
          const [dayA, monthA, yearA] = a.date.split('/').map(Number);
          dateA_val = new Date(Date.UTC(yearA, monthA - 1, dayA));
        } else if (a.date) {
          dateA_val = new Date(a.date + 'T00:00:00Z');
        } else {
          return -1; // Tarih yoksa en başa koy
        }

        if (b.date && b.date.includes('/')) {
          const [dayB, monthB, yearB] = b.date.split('/').map(Number);
          dateB_val = new Date(Date.UTC(yearB, monthB - 1, dayB));
        } else if (b.date) {
          dateB_val = new Date(b.date + 'T00:00:00Z');
        } else {
          return 1; // Tarih yoksa en başa koy
        }

        return dateA_val.getTime() - dateB_val.getTime();
      } catch (error) {
        console.error('Tarih sıralama hatası WeatherCard içinde:', error);
        return 0;
      }
    });

    return sortedData;
  }, [weatherData]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Helper to get displayable values, with defaults for missing data
  const getValidSelectedDay = (day: WeatherData | null | undefined) => {
    if (!day || !day.date) {
      return {
        date: new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }), // Show current date as fallback
        dateISO: new Date().toISOString().split('T')[0], // ISO formatı (YYYY-MM-DD)
        dateTurkish: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }), // Türkçe format
        description: 'Hava durumu verisi alınamadı.',
        currentTemp: '--', // Keep this key for internal consistency in the component
        feelsLike: '--',
        humidity: '--',
        windSpeed: '--',
        precipitation: '--', // Keep this key for internal consistency
        uvIndex: '--',
        icon: 'unknown', // Default icon
      };
    }
    return {
      date: day.date, // DD/MM/YYYY formatı (API çağrıları için)
      dateISO: day.dateISO || day.date.split('/').reverse().join('-'), // ISO formatı (YYYY-MM-DD)
      dateTurkish: day.dateTurkish || formatDate(day.date), // Türkçe format (30 Nisan 2025 Pazartesi)
      description: day.description || 'Açıklama mevcut değil',
      currentTemp: day.temperature?.toString() ?? '--', // Map from WeatherData.temperature
      feelsLike: day.feelsLike?.toString() ?? '--',
      humidity: day.humidity?.toString() ?? '--',
      windSpeed: day.windSpeed?.toString() ?? '--',
      precipitation: day.precipitationProbability?.toString() ?? '--', // Map from WeatherData.precipitationProbability
      uvIndex: day.uvIndex?.toString() ?? '--',
      icon: day.icon || 'unknown',
    };
  };

  const selectedDay = uniqueWeatherData.length > 0 && selectedDayIndex < uniqueWeatherData.length ? uniqueWeatherData[selectedDayIndex] : null;
  const validSelectedDay = getValidSelectedDay(selectedDay);

  const formatDate = (dateString: string): string => {
    try {
      let dateObj: Date;
      if (dateString.includes('/')) {
        const [day, month, year] = dateString.split('/').map(Number);
        dateObj = new Date(Date.UTC(year, month - 1, day));
      } else if (dateString.includes('-')) {
        dateObj = new Date(dateString + 'T00:00:00Z');
      } else {
        const parsed = Date.parse(dateString);
        if (!isNaN(parsed)) {
          dateObj = new Date(parsed);
        } else {
          return 'Geçersiz Tarih';
        }
      }
      return dateObj.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
        timeZone: 'UTC',
      });
    } catch (error) {
      console.error('Tarih formatlama hatası (formatDate):', dateString, error);
      return dateString;
    }
  };

  const formatShortDate = (dateString: string): string => {
    try {
      let dateObj: Date;
      if (dateString.includes('/')) {
        const [day, month, year] = dateString.split('/').map(Number);
        dateObj = new Date(Date.UTC(year, month - 1, day));
      } else if (dateString.includes('-')) {
        dateObj = new Date(dateString + 'T00:00:00Z');
      } else {
        const parsed = Date.parse(dateString);
        if (!isNaN(parsed)) {
          dateObj = new Date(parsed);
        } else {
          return '---';
        }
      }
      const dayOfMonth = dateObj.getUTCDate();
      const shortDayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: 'UTC' });
      return `${dayOfMonth} ${shortDayName.charAt(0).toUpperCase() + shortDayName.slice(1, 3)}`;
    } catch (error) {
      console.error('Tarih formatlama hatası (formatShortDate):', dateString, error);
      return '---';
    }
  };

  const getIconName = (iconCode: string): MaterialCommunityIconName => {
    return weatherIconMap[iconCode] || weatherIconMap['unknown'];
  };

  if (!weatherData || weatherData.length === 0) {
    const fallbackDay = getValidSelectedDay(null);
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Hava Durumu</ThemedText>
          <ThemedText style={styles.date}>{fallbackDay.dateTurkish || formatDate(fallbackDay.date)}</ThemedText>
        </View>
        <View style={styles.mainInfoContainer}>
          <MaterialCommunityIcons
            name={getIconName(fallbackDay.icon)}
            size={64} // Adjusted size for fallback
            color="#AEAEB2" // Muted color for fallback icon
          />
          <View style={styles.temperatureContainer}>
            <ThemedText style={styles.temperature}>{fallbackDay.currentTemp}°C</ThemedText>
            {/* Fallback'te hissedilen sıcaklığı göstermeyebiliriz veya onu da -- yapabiliriz */}
          </View>
        </View>
        <ThemedText style={styles.description}>{translateWeatherDescription(fallbackDay.description)}</ThemedText>
      </View>
    );
  }

  // If there's data (even if current selected might be problematic, getValidSelectedDay handles it)
  const currentIconName = getIconName(validSelectedDay.icon);

  return (
    <View style={styles.container}>
      {/* Day selector - horizontal scrollable list of days */}
      <View style={styles.daySelectorContainer}>
        <ThemedText style={styles.daySelectorTitle}>
          {uniqueWeatherData.length > 1
            ? `${uniqueWeatherData.length} Günlük Hava Durumu - Gün Seçin`
            : "Hava Durumu"}
        </ThemedText>

        {uniqueWeatherData.length > 1 && (
          <ThemedText style={styles.daySelectorInstructions}>
            Aşağıdaki günlerden birini seçerek o günün hava durumunu görüntüleyebilirsiniz
          </ThemedText>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.daySelector}
          contentContainerStyle={styles.daySelectorContent}
        >
          {uniqueWeatherData.map((day, index) => (
            <TouchableOpacity
              key={`${day.date}-${index}`}
              style={[
                styles.dayButton,
                selectedDayIndex === index && styles.selectedDayButton,
              ]}
              onPress={() => setSelectedDayIndex(index)}
            >
              <ThemedText
                style={[
                  styles.dayButtonText,
                  selectedDayIndex === index && styles.selectedDayText,
                ]}
              >
                {formatShortDate(day.date)}
              </ThemedText>

              {/* Küçük hava durumu ikonu */}
              {day.icon && (
                <MaterialCommunityIcons
                  name={getIconName(day.icon)}
                  size={18}
                  color={selectedDayIndex === index ? "#FFFFFF" : "#CCCCCC"}
                  style={{marginTop: 4}}
                />
              )}

              {/* Sıcaklık bilgisi */}
              <ThemedText
                style={[
                  styles.dayTempText,
                  selectedDayIndex === index && styles.selectedDayText,
                ]}
              >
                {day.temperature}°C
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.header}>
        <ThemedText style={styles.title}>Hava Durumu</ThemedText>
        {/* Türkçe tarih formatını kullan (dateTurkish) */}
        <ThemedText style={styles.date}>{validSelectedDay.dateTurkish || formatDate(validSelectedDay.date)}</ThemedText>
      </View>

      <View style={styles.mainInfoContainer}>
        <MaterialCommunityIcons name={currentIconName} size={80} color="#FFFFFF" />
        <View style={styles.temperatureContainer}>
          <ThemedText style={styles.temperature}>{validSelectedDay.currentTemp}°C</ThemedText>
          <ThemedText style={styles.feelsLike}>Hissedilen: {validSelectedDay.feelsLike}°C</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.description}>{translateWeatherDescription(validSelectedDay.description)}</ThemedText>

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="water-percent" size={28} color="#87CEEB" />
          <View style={styles.detailTextContainer}>
            <ThemedText style={styles.detailLabel}>Nem</ThemedText>
            <ThemedText style={styles.detailValue}>{validSelectedDay.humidity}%</ThemedText>
          </View>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="weather-windy" size={28} color="#B0C4DE" />
           <View style={styles.detailTextContainer}>
            <ThemedText style={styles.detailLabel}>Rüzgar</ThemedText>
            <ThemedText style={styles.detailValue}>{validSelectedDay.windSpeed} km/s</ThemedText>
          </View>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="weather-pouring" size={28} color="#4682B4" />
          <View style={styles.detailTextContainer}>
            <ThemedText style={styles.detailLabel}>Yağış İht.</ThemedText>
            <ThemedText style={styles.detailValue}>{validSelectedDay.precipitation}%</ThemedText>
          </View>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="white-balance-sunny" size={28} color="#FFD700" />
          <View style={styles.detailTextContainer}>
            <ThemedText style={styles.detailLabel}>UV</ThemedText>
            <ThemedText style={styles.detailValue}>{validSelectedDay.uvIndex}</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2C2C2E', // Daha koyu ve modern bir gri tonu
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18, // Padding'i biraz ayarladım
    marginVertical: 10,
    marginHorizontal: 12, // Kenar boşluklarını biraz azalttım
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 }, // Gölgeyi biraz daha belirginleştirdim
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)', // Daha ince ve şık bir kenarlık
  },
  // Day selector container and title
  daySelectorContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  daySelectorTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  daySelectorInstructions: {
    color: '#CCCCCC',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  daySelector: {
    marginBottom: 5,
  },
  daySelectorContent: {
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    marginHorizontal: 5,
    backgroundColor: '#3A3A3C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedDayButton: {
    backgroundColor: '#0A84FF', // iOS Mavi
    borderColor: 'rgba(10, 132, 255, 0.7)',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 7,
  },
  dayButtonText: {
    color: '#E0E0E0',
    fontSize: 15,
    fontFamily: 'InterRegular',
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTempText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontFamily: 'InterRegular',
    fontWeight: '500',
    marginTop: 2,
  },
  header: {
    marginBottom: 18, // Boşluğu ayarladım
    alignItems: 'center',
  },
  title: {
    fontSize: 24, // Başlık fontunu biraz büyüttüm
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    fontFamily: 'InterSemiBold',
  },
  date: {
    color: '#AEAEB2',
    fontSize: 15,
    fontFamily: 'InterRegular',
    fontWeight: '400',
  },
  mainInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 22, // Boşluğu artırdım
    backgroundColor: 'rgba(76, 76, 76, 0.25)', // Biraz daha belirgin arka plan
    borderRadius: 16,
    paddingVertical: 25, // Dikey padding'i artırdım
    paddingHorizontal: 15,
  },
  temperatureContainer: {
    alignItems: 'center',
    marginLeft: 10, // İkon ile sıcaklık arasına hafif boşluk
  },
  temperature: {
    fontSize: 48, // Sıcaklığı biraz küçülttüm
    fontWeight: '200', // Daha ince bir font (modern görünüm)
    color: '#FFFFFF',
    fontFamily: 'InterRegular',
    lineHeight: 82, // Satır yüksekliğini de fontSize'a uygun azalttım
  },
  feelsLike: {
    color: '#C7C7CC',
    fontSize: 16,
    fontFamily: 'InterRegular',
    fontWeight: '400',
    marginTop: 6,
  },
  description: {
    color: '#E5E5EA',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 25,
    paddingHorizontal: 15,
    fontFamily: 'InterRegular',
    lineHeight: 23,
    fontWeight: '400',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 5, // Açıklama ile grid arası hafif boşluk
  },
  detailItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48.5%', // Sütun genişliğini hafif ayarladım
    marginBottom: 14,
    backgroundColor: 'rgba(76, 76, 76, 0.3)', // Detay kutularının arka planını biraz daha belirgin yaptım
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  detailTextContainer: {
    marginTop: 10, // İkon ile metin arası boşluğu artırdım
    alignItems: 'center',
  },
  detailLabel: {
    color: '#AEAEB2',
    fontSize: 13,
    fontFamily: 'InterRegular',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 17, // Değer fontunu büyüttüm
    fontWeight: '500',
    fontFamily: 'InterRegular',
  },
  weatherLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  weatherLoadingText: {
    marginTop: 10,
    color: '#AEAEB2',
    fontSize: 14,
  },
});
