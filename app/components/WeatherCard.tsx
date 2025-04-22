import React, { useState } from 'react';
import { View, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { WeatherData } from '../services/weather.service';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface WeatherCardProps {
  weatherData: WeatherData[];
}

// Weather icon mapping
const weatherIconMap: { [key: string]: string } = {
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = weatherData[selectedDayIndex];

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format short date (for day selector)
  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      weekday: 'short',
      day: 'numeric',
    });
  };

  // Get icon name from weather code
  const getIconName = (iconCode: string) => {
    return weatherIconMap[iconCode] || 'weather-partly-cloudy';
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
        {weatherData.map((day, index) => (
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
          <ThemedText style={styles.detailText}>UV İndeksi: {selectedDay.uvIndex}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  daySelector: {
    marginBottom: 16,
  },
  daySelectorContent: {
    paddingBottom: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#1a1a1a',
  },
  selectedDayButton: {
    backgroundColor: '#4c669f',
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
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  temperatureContainer: {
    marginLeft: 16,
  },
  temperature: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'SpaceMono',
  },
  feelsLike: {
    color: '#999',
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  description: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 16,
    fontFamily: 'SpaceMono',
  },
  detailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
  },
  detailText: {
    color: '#ccc',
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
});
