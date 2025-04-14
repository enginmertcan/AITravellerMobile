import { API_CONFIG, API_ENDPOINTS } from '../config/api';

export interface Place {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  country?: string;
}

export const searchPlaces = async (query: string, isDomestic: boolean = true): Promise<Place[]> => {
  try {
    console.log('Searching places with query:', query, 'isDomestic:', isDomestic);
    
    // Google Places API for both domestic and international cities
    const baseUrl = `${API_ENDPOINTS.GOOGLE_MAPS}/maps/api/place/autocomplete/json`;
    const params = new URLSearchParams({
      input: query,
      key: API_CONFIG.GOOGLE_MAPS,
      types: '(cities)',
      language: 'tr'
    });

    // Add country restriction only for domestic searches
    if (isDomestic) {
      params.append('components', 'country:tr');
    }

    const response = await fetch(`${baseUrl}?${params}`);
    const responseText = await response.clone().text();
    console.log('Google Places API Response:', responseText);
    
    const data = await response.json();
    console.log('Google Places API Data:', data);

    if (data.status !== 'OK' || !data.predictions) {
      console.error('Places API Error:', data);
      return [];
    }

    return data.predictions.map((prediction: any) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting?.main_text || prediction.description,
      secondaryText: prediction.structured_formatting?.secondary_text || ''
    }));
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
};

export const getPlaceDetails = async (placeId: string, isDomestic: boolean = true): Promise<PlaceDetails | null> => {
  try {
    console.log('Getting place details for:', placeId, 'isDomestic:', isDomestic);
    
    // Google Places API for both domestic and international cities
    const baseUrl = `${API_ENDPOINTS.GOOGLE_MAPS}/maps/api/place/details/json`;
    const params = new URLSearchParams({
      place_id: placeId,
      key: API_CONFIG.GOOGLE_MAPS,
      language: 'tr',
      fields: 'formatted_address,geometry,address_components'
    });

    const response = await fetch(`${baseUrl}?${params}`);
    const responseText = await response.clone().text();
    console.log('Google Places Details API Response:', responseText);
    
    const data = await response.json();
    console.log('Google Places Details API Data:', data);

    if (data.status !== 'OK' || !data.result) {
      console.error('Place Details API Error:', data);
      return null;
    }

    const country = data.result.address_components?.find(
      (component: any) => component.types.includes('country')
    )?.long_name;

    return {
      description: data.result.formatted_address,
      coordinates: {
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng
      },
      country
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}; 