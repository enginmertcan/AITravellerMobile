import { API_CONFIG } from '../config/api';

export interface Country {
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

interface LocationService {
  getCountries: () => Promise<Country[]>;
}

// Ülke listesini getir fonksiyonu
const getCountries = async (): Promise<Country[]> => {
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
        png: 'https://flagcdn.com/w80/tr.png',
        svg: 'https://flagcdn.com/tr.svg'
      }
    }];
  }
};

// Servis nesnesini oluştur
const locationService: LocationService = {
  getCountries
};

// JSX component for Expo Router
function LocationServiceComponent() {
  return null;
}

// Default ve named exports
LocationServiceComponent.getCountries = getCountries;

export default LocationServiceComponent;