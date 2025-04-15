import { API_CONFIG } from '../config/api';

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

export const getCountries = async (): Promise<Country[]> => {
  try {
    const response = await fetch('https://restcountries.com/v3.1/all');
    const data = await response.json();
    
    // Türkiye'yi listenin başına ekle
    const turkey = data.find((country: Country) => country.cca2 === 'TR');
    const otherCountries = data.filter((country: Country) => country.cca2 !== 'TR');
    
    return [turkey, ...otherCountries].filter(Boolean);
  } catch (error) {
    console.error('Error fetching countries:', error);
    // Hata durumunda en azından Türkiye'yi döndür
    return [{
      name: {
        common: 'Turkey',
        official: 'Republic of Turkey'
      },
      cca2: 'TR',
      flags: {
        png: 'https://flagcdn.com/w320/tr.png',
        svg: 'https://flagcdn.com/tr.svg'
      }
    }];
  }
};

export const geocodeAddress = async (address: string): Promise<any> => {
  // Implementation
};

// Expo Router için default export gereklidir
export default function LocationServiceComponent() {
  return null;
}
