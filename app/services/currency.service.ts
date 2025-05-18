import axios from 'axios';

// Döviz kuru API'si için anahtar
const API_KEY = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY;
const BASE_URL = 'https://v6.exchangerate-api.com/v6/';

// Önbellek için
interface ExchangeRateCache {
  [baseCurrency: string]: {
    rates: Record<string, number>;
    timestamp: number;
  };
}

let exchangeRatesCache: ExchangeRateCache = {};
const CACHE_DURATION = 3600000; // 1 saat (milisaniye)

export const CurrencyService = {
  // Döviz kurlarını getir
  getExchangeRates: async (baseCurrency: string): Promise<Record<string, number>> => {
    try {
      const now = Date.now();

      // Önbellekte varsa ve güncel ise, önbellekten döndür
      if (
        exchangeRatesCache[baseCurrency] &&
        now - exchangeRatesCache[baseCurrency].timestamp < CACHE_DURATION
      ) {
        return exchangeRatesCache[baseCurrency].rates;
      }

      // API anahtarı yoksa varsayılan değerleri döndür
      if (!API_KEY) {
        console.warn('Döviz kuru API anahtarı bulunamadı, varsayılan değerler kullanılıyor.');
        const defaultRates: Record<string, number> = {
          'USD': 1.0,
          'EUR': 0.93,
          'TRY': 32.5,
          'GBP': 0.79,
        };

        // Önbelleğe kaydet
        exchangeRatesCache[baseCurrency] = {
          rates: defaultRates,
          timestamp: now
        };

        return defaultRates;
      }

      // API'den yeni kurları al
      const response = await axios.get(`${BASE_URL}${API_KEY}/latest/${baseCurrency}`);

      // API yanıtını tiplendir
      const responseData = response.data as {
        result?: string;
        error?: string;
        conversion_rates?: Record<string, number>
      };

      if (responseData.result !== 'success') {
        console.warn(`API hatası: ${responseData.error || 'Bilinmeyen hata'}, varsayılan değerler kullanılıyor.`);
        // Varsayılan değerleri döndür
        const defaultRates: Record<string, number> = {
          'USD': 1.0,
          'EUR': 0.93,
          'TRY': 32.5,
          'GBP': 0.79,
        };

        // Önbelleğe kaydet
        exchangeRatesCache[baseCurrency] = {
          rates: defaultRates,
          timestamp: now
        };

        return defaultRates;
      }

      const rates = responseData.conversion_rates || {};

      // Önbelleğe kaydet
      exchangeRatesCache[baseCurrency] = {
        rates,
        timestamp: now
      };

      return rates;
    } catch (error) {
      console.error('Döviz kuru getirme hatası:', error);
      // Hata durumunda varsayılan değerleri döndür
      const defaultRates: Record<string, number> = {
        'USD': 1.0,
        'EUR': 0.93,
        'TRY': 32.5,
        'GBP': 0.79,
      };

      return defaultRates;
    }
  },

  // Para birimi dönüştürme
  convertCurrency: async (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> => {
    try {
      if (fromCurrency === toCurrency) return amount;

      const rates = await CurrencyService.getExchangeRates(fromCurrency);
      if (!rates[toCurrency]) {
        throw new Error(`Dönüştürme oranı bulunamadı: ${fromCurrency} -> ${toCurrency}`);
      }

      return amount * rates[toCurrency];
    } catch (error) {
      console.error('Para birimi dönüştürme hatası:', error);
      throw error;
    }
  },

  // Desteklenen para birimlerini getir
  getSupportedCurrencies: async (): Promise<string[]> => {
    try {
      const rates = await CurrencyService.getExchangeRates('USD');
      return Object.keys(rates);
    } catch (error) {
      console.error('Desteklenen para birimleri getirme hatası:', error);
      throw error;
    }
  },

  // Para birimi formatla
  formatCurrency: (amount: number, currency: string, locale: string = 'tr-TR'): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Hata durumunda basit formatlama
      console.warn('Para birimi formatlama hatası:', error);
      return `${amount.toFixed(2)} ${currency}`;
    }
  },
};
