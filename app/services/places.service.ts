import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import React from 'react';

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
    // Google Places API for both domestic and international cities
    const baseUrl = `${API_ENDPOINTS.GOOGLE_MAPS}/maps/api/place/autocomplete/json`;
    const apiKey = API_CONFIG.GOOGLE_MAPS || 'AIzaSyCP-WHzK8XQXT_ThNQ5g5oNVXqNMtZ4cOg'; // Fallback API key if not set in config

    const params = new URLSearchParams({
      input: query,
      key: apiKey,
      types: '(cities)',
      language: 'tr'
    });

    // Add country restriction only for domestic searches
    if (isDomestic) {
      params.append('components', 'country:tr');
    }

    const response = await fetch(`${baseUrl}?${params}`);
    const responseText = await response.clone().text();

    const data = await response.json();

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

    // Google Places API for both domestic and international cities
    const baseUrl = `${API_ENDPOINTS.GOOGLE_MAPS}/maps/api/place/details/json`;
    const apiKey = API_CONFIG.GOOGLE_MAPS || 'AIzaSyCP-WHzK8XQXT_ThNQ5g5oNVXqNMtZ4cOg';
    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      language: 'tr',
      fields: 'formatted_address,geometry,address_components'
    });

    const response = await fetch(`${baseUrl}?${params}`);
    const responseText = await response.clone().text();

    const data = await response.json();

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

// JSX component for Expo Router
export function PlacesServiceComponent() {
  return null;
}

// Static properties for component
PlacesServiceComponent.searchPlaces = searchPlaces;
PlacesServiceComponent.getPlaceDetails = getPlaceDetails;

// Default export Expo Router için gerekli
export default PlacesServiceComponent;