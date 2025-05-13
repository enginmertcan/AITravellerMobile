import React, { useState } from 'react';
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
};

export default function WeatherCard({ weatherData }: WeatherCardProps) {
  // Hava durumu verilerini kontrol et ve benzersiz günleri filtrele
  const uniqueWeatherData = React.useMemo(() => {
    if (!weatherData || weatherData.length === 0) return [];

    // Tarih bazında benzersiz günleri filtrele
    const uniqueDates = new Map<string, WeatherData>();
    weatherData.forEach(day => {
      // Tarih formatını normalize et - DD/MM/YYYY formatını kullan
      let dateKey = day.date;

      // Eğer bu tarih daha önce eklenmemişse ekle
      if (!uniqueDates.has(dateKey)) {
        uniqueDates.set(dateKey, day);
      }
    });

    // Map'ten array'e çevir ve tarihe göre sırala
    return Array.from(uniqueDates.values()).sort((a, b) => {
      // DD/MM/YYYY formatını Date objesine çevir
      const [dayA, monthA, yearA] = a.date.split('/').map(Number);
      const [dayB, monthB, yearB] = b.date.split('/').map(Number);

      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);

      return dateA.getTime() - dateB.getTime();
    });
  }, [weatherData]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = uniqueWeatherData[selectedDayIndex] || weatherData[0];

  // Format date
  const formatDate = (dateString: string) => {
    // Tarih formatını kontrol et (YYYY-MM-DD veya DD/MM/YYYY)
    let date;
    if (dateString.includes('/')) {
      // DD/MM/YYYY formatı
      const [day, month, year] = dateString.split('/').map(Number);
      date = new Date(year, month - 1, day); // Ay 0-11 arasında olduğu için -1
    } else {
      // YYYY-MM-DD formatı (API'den gelen)
      date = new Date(dateString);
    }

    // Geçerli bir tarih mi kontrol et
    if (isNaN(date.getTime())) {
      return "Geçersiz Tarih";
    }

    return date.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format short date (for day selector)
  const formatShortDate = (dateString: string) => {
    // Tarih formatını kontrol et (YYYY-MM-DD veya DD/MM/YYYY)
    let date;
    if (dateString.includes('/')) {
      // DD/MM/YYYY formatı
      const [day, month, year] = dateString.split('/').map(Number);
      date = new Date(year, month - 1, day); // Ay 0-11 arasında olduğu için -1
    } else {
      // YYYY-MM-DD formatı (API'den gelen)
      date = new Date(dateString);
    }

    // Geçerli bir tarih mi kontrol et
    if (isNaN(date.getTime())) {
      return "Geçersiz Tarih";
    }

    return date.toLocaleDateString('tr-TR', {
      weekday: 'short',
      day: 'numeric',
    });
  };

  // Get icon name from weather code
  const getIconName = (iconCode: string): MaterialCommunityIconName => {
    return weatherIconMap[iconCode] || 'weather-partly-cloudy'; // Ensure the default is also a valid name
  };

  return (
    <View style={styles.container}>
      {/* Gün seçici */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {uniqueWeatherData.map((day, index) => (
          <TouchableOpacity
            key={day.date}
            style={[styles.dayButton, index === selectedDayIndex && styles.selectedDayButton]}
            onPress={() => setSelectedDayIndex(index)}
          >
            <ThemedText style={[styles.dayButtonText, index === selectedDayIndex && styles.selectedDayText]}>
              {formatShortDate(day.date)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.header}>
        <ThemedText style={styles.title}>Hava Durumu</ThemedText>
        <ThemedText style={styles.date}>{formatDate(selectedDay.date)}</ThemedText>
      </View>

      <View style={styles.mainInfo}>
        <MaterialCommunityIcons
          name={getIconName(selectedDay.icon)}
          size={64}
          color="#4c669f"
        />
        <View style={styles.temperatureContainer}>
          <ThemedText style={styles.temperature}>{Math.round(selectedDay.temperature)}°C</ThemedText>
          <ThemedText style={styles.feelsLike}>Hissedilen: {Math.round(selectedDay.feelsLike)}°C</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.description}>{selectedDay.description}</ThemedText>

      <View style={styles.detailsContainer}>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="water-percent" size={20} color="#4c669f" />
          <ThemedText style={styles.detailText}>Nem: %{Math.round(selectedDay.humidity)}</ThemedText>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="weather-windy" size={20} color="#4c669f" />
          <ThemedText style={styles.detailText}>Rüzgar: {Math.round(selectedDay.windSpeed)} km/s</ThemedText>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="water" size={20} color="#4c669f" />
          <ThemedText style={styles.detailText}>Yağış: %{Math.round(selectedDay.precipitationProbability)}</ThemedText>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="white-balance-sunny" size={20} color="#4c669f" />
          <ThemedText style={styles.detailText}>UV: {selectedDay.uvIndex}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
    width: '100%',
    alignSelf: 'center',
  },
  daySelector: {
    marginBottom: 20,
  },
  daySelectorContent: {
    paddingBottom: 8,
    paddingTop: 4,
  },
  dayButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  selectedDayButton: {
    backgroundColor: '#4c669f',
    borderColor: '#4c669f',
    shadowColor: '#4c669f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  dayButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.1)',
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  date: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  temperatureContainer: {
    marginLeft: 16,
    flex: 1,
  },
  temperature: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  feelsLike: {
    color: '#999',
    fontSize: 18,
    fontFamily: 'SpaceMono',
    marginTop: 4,
  },
  description: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 20,
    fontFamily: 'SpaceMono',
    textAlign: 'center',
    backgroundColor: 'rgba(76, 102, 159, 0.05)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  detailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    width: '100%',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 16,
    backgroundColor: 'rgba(76, 102, 159, 0.05)',
    borderRadius: 8,
    padding: 8,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.1)',
  },
  detailText: {
    color: '#ccc',
    marginLeft: 8,
    fontSize: 13,
    fontFamily: 'SpaceMono',
    flexShrink: 1,
  },
});
