// Weather API Service

import Constants from 'expo-constants';

const API_KEY = Constants.expoConfig?.extra?.weatherApiKey || '';

export interface WeatherData {
  date: string; // DD/MM/YYYY formatı (API çağrıları için)
  dateISO?: string; // ISO formatı (YYYY-MM-DD)
  dateTurkish?: string; // Türkçe format (30 Nisan 2025 Pazartesi)
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
  date: formatDateToDDMMYYYY(new Date(Date.UTC(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  ))), // Web uyumluluğu için DD/MM/YYYY formatında
  temperature: 20,
  feelsLike: 20,
  description: "Hava durumu verisi alınamadı",
  icon: "01d",
  humidity: 50,
  windSpeed: 5,
  precipitationProbability: 0,
  uvIndex: 5
};

// Tarihi DD/MM/YYYY formatına dönüştüren yardımcı fonksiyon
function formatDateToDDMMYYYY(date: Date): string {
  // UTC kullanarak tarih formatla - gün kayması sorununu önlemek için
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

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

export async function getWeatherForecast(location: string, startDate: Date, days: number = 5): Promise<WeatherData[]> {
  try {

    if (!location || !startDate) {
      console.warn('Missing location or startDate in getWeatherForecast');
      return [fallbackWeatherData];
    }

    const formattedLocation = formatLocation(location);
    if (!formattedLocation) {
      console.warn('Invalid location format in getWeatherForecast');
      return [fallbackWeatherData];
    }

    // Tarih geçerli mi kontrol et
    if (isNaN(startDate.getTime())) {
      console.warn('Invalid date format in getWeatherForecast');
      return [fallbackWeatherData];
    }

    // Global değişkene ata (AI servisi için)
    (global as any).weatherStartDate = startDate.toISOString();

    // Bugünün tarihiyle karşılaştır
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Eğer startDate bugünden önceyse, bugünü kullan
    if (startDate < today) {
      startDate = today;
    }

    // Tarih aralığını hesapla
    const endDate = new Date(startDate);
    // Kullanıcının seçtiği gün sayısını kullan, en az 1, en fazla 15 gün
    const requestDays = Math.max(1, Math.min(days, 15));
    endDate.setDate(startDate.getDate() + requestDays - 1); // API en fazla 15 gün destekliyor

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];


    // API çağrısını yap - tarih aralığı için
    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(formattedLocation)}/${formattedStartDate}/${formattedEndDate}?unitGroup=metric&include=days&key=${API_KEY}&contentType=json`;

    const response = await fetch(
      apiUrl,
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


    // Veriyi dönüştür ve tarihi formatla
    const weatherData = data.days.map((day: any, index: number) => {
      // Tarihi hesapla (startDate + index gün) - UTC kullanarak
      const dayDate = new Date(Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + index
      ));

      // Tarihi DD/MM/YYYY formatına dönüştür (API çağrıları için)
      const formattedDate = `${dayDate.getUTCDate().toString().padStart(2, '0')}/${(dayDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${dayDate.getUTCFullYear()}`;

      // Tarihi ISO formatına dönüştür (YYYY-MM-DD)
      const isoDate = `${dayDate.getUTCFullYear()}-${(dayDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${dayDate.getUTCDate().toString().padStart(2, '0')}`;

      // Tarihi Türkçe formatına dönüştür (görüntüleme için)
      const turkishDate = dayDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
      });

      return {
        date: formattedDate, // DD/MM/YYYY formatı (API çağrıları için)
        dateISO: isoDate, // ISO formatı (YYYY-MM-DD)
        dateTurkish: turkishDate, // Türkçe format (30 Nisan 2025 Pazartesi)
        temperature: day.temp ?? 20,
        feelsLike: day.feelslike ?? day.temp ?? 20,
        description: day.conditions ?? "Parçalı Bulutlu",
        icon: getWeatherIcon(day.icon),
        humidity: day.humidity ?? 50,
        windSpeed: day.windspeed ?? 5,
        precipitationProbability: day.precipprob ?? 0,
        uvIndex: day.uvindex ?? 5
      };
    });

    return weatherData;

  } catch (error) {
    console.error('Error in getWeatherForecast:', error);
    return [fallbackWeatherData];
  }
}

const WeatherService = {
  getWeatherForecast,
  formatDateToDDMMYYYY,
  formatLocation,
  getWeatherIcon,
  validateWeatherData
};

export default WeatherService;
