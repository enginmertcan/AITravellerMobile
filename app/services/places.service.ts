import { API_CONFIG, API_ENDPOINTS } from '../config/api';

interface Place {
  name: string;
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export const searchPlaces = async (query: string, isDomestic: boolean = true): Promise<Place[]> => {
  try {
    const baseUrl = `${API_ENDPOINTS.GOOGLE_MAPS}/place/autocomplete/json`;
    const params = new URLSearchParams({
      input: query,
      key: API_CONFIG.GOOGLE_MAPS,
    });

    // Eğer Türkiye gezisi ise, sadece Türkiye'deki yerleri göster
    if (isDomestic) {
      params.append('components', 'country:tr');
    }

    const response = await fetch(`${baseUrl}?${params.toString()}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(data.error_message || 'Places API error');
    }

    return data.predictions.map((prediction: any) => ({
      name: prediction.description,
      place_id: prediction.place_id,
      formatted_address: prediction.description,
      geometry: {
        location: {
          lat: 0,
          lng: 0,
        },
      },
    }));
  } catch (error) {
    console.error('Error searching places:', error);
    throw error;
  }
};

export const getPlaceDetails = async (placeId: string): Promise<Place> => {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.GOOGLE_MAPS}/place/details/json?` +
      `place_id=${placeId}&` +
      `key=${API_CONFIG.GOOGLE_MAPS}`
    );

    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(data.error_message || 'Place Details API error');
    }

    return data.result;
  } catch (error) {
    console.error('Error getting place details:', error);
    throw error;
  }
}; 