import { DEFAULT_TRAVEL_PLAN, TravelPlan, safeParseJSON } from '../types/travel';

export function parseItinerary(data: any) {
  try {
    // Create a deep copy of the data to avoid mutations
    let parsedData = JSON.parse(JSON.stringify({ ...DEFAULT_TRAVEL_PLAN, ...data }));

    // Parse itinerary if it's a string
    if (typeof data.itinerary === 'string') {
      const parsedItinerary = safeParseJSON(data.itinerary);
      if (!parsedItinerary) return parsedData;

      // Extract nested fields with safe access
      parsedData = {
        ...parsedData,
        ...parsedItinerary,
        itinerary: Array.isArray(parsedItinerary.itinerary) ? parsedItinerary.itinerary : [],
        hotelOptions: Array.isArray(parsedItinerary.hotelOptions) ? parsedItinerary.hotelOptions : [],
      };

      // Safely extract cultural differences
      const culturalDiff = parsedItinerary.culturalDifferences || {};
      if (typeof culturalDiff === 'object') {
        parsedData.culturalDifferences = culturalDiff.culturalDifferences || '';
        parsedData.lifestyleDifferences = culturalDiff.lifestyleDifferences || '';
        parsedData.foodCultureDifferences = culturalDiff.foodCultureDifferences || '';
        parsedData.socialNormsDifferences = culturalDiff.socialNormsDifferences || '';
      }

      // Safely extract visa requirements
      const visaReq = parsedItinerary.visaAndTravelRequirements || {};
      if (typeof visaReq === 'object') {
        parsedData.visaRequirements = visaReq.visaRequirements || '';
        parsedData.visaApplicationProcess = visaReq.visaApplicationProcess || '';
        parsedData.visaFees = visaReq.visaFees || '';
        parsedData.travelDocumentChecklist = Array.isArray(visaReq.travelDocumentChecklist) 
          ? visaReq.travelDocumentChecklist 
          : typeof visaReq.travelDocumentChecklist === 'string' 
            ? visaReq.travelDocumentChecklist 
            : '';
      }

      // Safely extract local life information
      const localInfo = parsedItinerary.localLifeInformation || {};
      if (typeof localInfo === 'object') {
        parsedData.localTransportationGuide = localInfo.localTransportationGuide || '';
        parsedData.emergencyContacts = Array.isArray(localInfo.emergencyContacts)
          ? localInfo.emergencyContacts
          : typeof localInfo.emergencyContacts === 'string'
            ? localInfo.emergencyContacts
            : '';
        parsedData.currencyAndPayment = localInfo.currencyAndPayment || '';
        parsedData.healthcareInfo = localInfo.healthcareInfo || '';
        parsedData.communicationInfo = localInfo.communicationInfo || '';
      }
    }

    return parsedData;
  } catch (error) {
    console.error('Error in parseItinerary:', error);
    return { ...DEFAULT_TRAVEL_PLAN, ...data };
  }
}

export function formatTravelPlan(data: any): Partial<TravelPlan> {
  try {
    const parsedData = parseItinerary(data);
    
    // Format itinerary if it's an array
    let formattedItinerary = parsedData.itinerary;
    if (Array.isArray(parsedData.itinerary)) {
      formattedItinerary = parsedData.itinerary.reduce((acc: any, day: any, index: number) => {
        if (day && typeof day === 'object') {
          acc[`Day ${index + 1}`] = day;
        }
        return acc;
      }, {});
    }
    
    // Ensure all required fields exist with proper types
    return {
      ...DEFAULT_TRAVEL_PLAN,
      ...parsedData,
      id: data?.id || DEFAULT_TRAVEL_PLAN.id,
      itinerary: formattedItinerary || DEFAULT_TRAVEL_PLAN.itinerary,
      hotelOptions: Array.isArray(parsedData.hotelOptions) 
        ? parsedData.hotelOptions.filter(hotel => hotel && typeof hotel === 'object')
        : DEFAULT_TRAVEL_PLAN.hotelOptions,
      days: typeof parsedData.days === 'number' ? parsedData.days : DEFAULT_TRAVEL_PLAN.days,
      isDomestic: typeof parsedData.isDomestic === 'boolean' ? parsedData.isDomestic : DEFAULT_TRAVEL_PLAN.isDomestic,
    };
  } catch (error) {
    console.error('Error formatting travel plan:', error);
    return { ...DEFAULT_TRAVEL_PLAN, id: data?.id || '' };
  }
}

export function parseGeminiResponse(responseText: string): Partial<TravelPlan> {
  try {
    // JSON formatındaki metni temizleme
    let cleanedResponse = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
      
    // Ekstra açıklamaları kaldırma (genelde yanıtın altında açıklama metni olabilir)
    // İlk '}' karakterinden sonraki tüm metni kesip atıyoruz
    const jsonEndIndex = cleanedResponse.lastIndexOf('}');
    if (jsonEndIndex > 0) {
      cleanedResponse = cleanedResponse.substring(0, jsonEndIndex + 1);
    }
    
    // JSON parse
    const parsedData = safeParseJSON(cleanedResponse);
    if (!parsedData) {
      throw new Error('JSON parse error');
    }
    
    // TravelPlan formatına çevirme
    return formatTravelPlan(parsedData);
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return { 
      ...DEFAULT_TRAVEL_PLAN,
      error: 'Yanıt işlenemedi' 
    };
  }
}
