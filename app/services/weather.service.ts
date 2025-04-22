// Weather API Service

import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.weatherApiKey || '';

export interface WeatherData {
  date: string;
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  uvIndex: number;
}

// Yedek hava durumu verisi
const fallbackWeatherData: WeatherData = {
  date: new Date().toISOString(),
  temperature: 20,
  feelsLike: 20,
  description: "Hava durumu verisi alınamadı",
  icon: "01d",
  humidity: 50,
  windSpeed: 5,
  precipitationProbability: 0,
  uvIndex: 5
};

// Konum adını formatlama fonksiyonu
function formatLocation(location: string): string {
  // Türkçe karakterleri koru ama özel karakterleri temizle
  return location
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Hava durumu ikonlarını eşleştirme
function getWeatherIcon(icon: string): string {
  const iconMap: { [key: string]: string } = {
    'clear-day': '01d',
    'clear-night': '01n',
    'partly-cloudy-day': '02d',
    'partly-cloudy-night': '02n',
    'cloudy': '03d',
    'rain': '10d',
    'snow': '13d',
    'sleet': '13d',
    'wind': '50d',
    'fog': '50d',
    'thunder-rain': '11d',
    'thunder-showers-day': '11d',
    'thunder-showers-night': '11n',
  };

  return iconMap[icon] || '01d';
}

// Veri doğrulama fonksiyonu
function validateWeatherData(data: any): boolean {
  return (
    data &&
    Array.isArray(data.days) &&
    data.days.length > 0 &&
    typeof data.days[0].temp === 'number' &&
    typeof data.days[0].feelslike === 'number'
  );
}

export async function getWeatherForecast(location: string, startDate: Date, days: number = 1): Promise<WeatherData[]> {
  try {
    if (!location || !startDate) {
      console.warn('Invalid location or date provided');
      return [fallbackWeatherData];
    }

    const formattedLocation = formatLocation(location);
    if (!formattedLocation) {
      console.warn('Location formatting failed');
      return [fallbackWeatherData];
    }

    // Tarih aralığını hesapla
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + Math.min(days, 15) - 1); // API en fazla 15 gün destekliyor

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`Fetching weather for ${formattedLocation} from ${formattedStartDate} to ${formattedEndDate}`);

    // API çağrısını yap - tarih aralığı için
    const response = await fetch(
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(formattedLocation)}/${formattedStartDate}/${formattedEndDate}?unitGroup=metric&include=days&key=${API_KEY}&contentType=json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // HTTP durumunu kontrol et
    if (!response.ok) {
      console.warn(`Weather API returned status ${response.status}`);
      return [fallbackWeatherData];
    }

    const data = await response.json();

    // Veri doğrulaması yap
    if (!validateWeatherData(data)) {
      console.warn('Invalid weather data structure received');
      return [fallbackWeatherData];
    }

    // Veriyi dönüştür
    return data.days.map((day: any) => ({
      date: day.datetime,
      temperature: day.temp ?? 20,
      feelsLike: day.feelslike ?? day.temp ?? 20,
      description: day.conditions ?? "Parçalı Bulutlu",
      icon: getWeatherIcon(day.icon),
      humidity: day.humidity ?? 50,
      windSpeed: day.windspeed ?? 5,
      precipitationProbability: day.precipprob ?? 0,
      uvIndex: day.uvindex ?? 5
    }));

  } catch (error) {
    console.error('Error fetching weather data:', error);
    return [fallbackWeatherData];
  }
}

// Expo Router için default export gereklidir
export default function WeatherServiceComponent() {
  return null;
}
