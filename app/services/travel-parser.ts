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
      if (parsedItinerary.culturalDifferences) {
        parsedData.culturalDifferences = parsedItinerary.culturalDifferences;
      }

      // Safely extract visa info
      if (parsedItinerary.visaInfo) {
        parsedData.visaInfo = parsedItinerary.visaInfo;
      } else if (parsedItinerary.visaRequirements || parsedItinerary.visaApplicationProcess) {
        parsedData.visaInfo = {
          visaRequirement: parsedItinerary.visaRequirements || '',
          visaApplicationProcess: parsedItinerary.visaApplicationProcess || '',
          requiredDocuments: Array.isArray(parsedItinerary.requiredDocuments)
            ? parsedItinerary.requiredDocuments
            : [],
          visaFee: parsedItinerary.visaFees || '',
        };
      }

      // Safely extract local info
      const localInfo = parsedItinerary.localTips || {};
      if (localInfo) {
        parsedData.localTips = localInfo;

        // Backward compatibility for fields that might be directly in data
        parsedData.travelDocumentChecklist = Array.isArray(localInfo.travelDocumentChecklist)
          ? localInfo.travelDocumentChecklist
          : typeof localInfo.travelDocumentChecklist === 'string'
            ? localInfo.travelDocumentChecklist
            : '';

        parsedData.localTransportationGuide = localInfo.localTransportationGuide || '';
        parsedData.emergencyContacts = Array.isArray(localInfo.emergencyContacts)
          ? localInfo.emergencyContacts
          : typeof localInfo.emergencyContacts === 'string'
            ? localInfo.emergencyContacts
            : '';
        parsedData.currencyAndPayment = localInfo.currencyAndPayment || '';
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

    // Format itinerary if it's an array - Web uyumluluğu için
    let formattedItinerary = parsedData.itinerary;
    if (Array.isArray(parsedData.itinerary)) {
      formattedItinerary = parsedData.itinerary.reduce((acc: any, day: any, index: number) => {
        if (day && typeof day === 'object') {
          acc[`Day ${index + 1}`] = day;
        }
        return acc;
      }, {});
    }

    // Duration'ı string'e dönüştür - Web uyumluluğu için
    const duration = typeof parsedData.duration === 'number'
      ? `${parsedData.duration} days`
      : parsedData.duration;

    // bestTimeToVisit alanını işle
    let bestTimeToVisit = parsedData.bestTimeToVisit;

    // Eğer bestTimeToVisit boşsa ve destinationInfo varsa, oradan al
    if ((!bestTimeToVisit || bestTimeToVisit === '') && parsedData.destinationInfo) {
      if (typeof parsedData.destinationInfo === 'string') {
        try {
          const destinationInfo = safeParseJSON(parsedData.destinationInfo);
          if (destinationInfo && destinationInfo.bestTimeToVisit) {
            bestTimeToVisit = destinationInfo.bestTimeToVisit;
          }
        } catch (error) {
          console.error('destinationInfo parse hatası:', error);
        }
      } else if (typeof parsedData.destinationInfo === 'object' && parsedData.destinationInfo.bestTimeToVisit) {
        bestTimeToVisit = parsedData.destinationInfo.bestTimeToVisit;
      }
    }

    // Hala boşsa, mevsimsel bir varsayılan değer ata
    if (!bestTimeToVisit || bestTimeToVisit === '') {
      const destination = parsedData.destination || '';
      if (destination.includes('Türkiye') || destination.includes('Turkey')) {
        bestTimeToVisit = 'İlkbahar (Nisan-Haziran) ve Sonbahar (Eylül-Ekim) ayları';
      } else {
        bestTimeToVisit = 'İlkbahar ve Sonbahar ayları';
      }
    }

    // Web uyumluluğu için veri formatını düzenle
    return {
      ...parsedData,
      duration: duration,
      bestTimeToVisit: bestTimeToVisit,
      itinerary: formattedItinerary
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

    // JSON olarak parse etme
    const parsedData = safeParseJSON(cleanedResponse);
    if (!parsedData) {
      console.error('JSON parse hatası');
      return DEFAULT_TRAVEL_PLAN;
    }

    // TravelPlan formatına dönüştürme
    return formatTravelPlan(parsedData);
  } catch (error) {
    console.error('AI yanıtı parse hatası:', error);
    return DEFAULT_TRAVEL_PLAN;
  }
}

// OpenAI API yanıtını işleme
export function parseOpenAIResponse(responseText: string): Partial<TravelPlan> {
  try {
    // OpenAI yanıtı zaten JSON formatında olmalı, ancak yine de kontrol edelim
    const parsedData = safeParseJSON(responseText);
    if (!parsedData) {
      console.error('OpenAI JSON parse hatası');
      return DEFAULT_TRAVEL_PLAN;
    }

    // Kültürel farklılıklar ve yerel ipuçları için özel işleme
    // Web uygulamasıyla uyumlu olması için culturalDifferences nesnesini oluştur
    if (parsedData.culturalDifferences && typeof parsedData.culturalDifferences === 'string') {
      // Eğer culturalDifferences bir string ise, onu bir nesneye dönüştür
      const culturalDifferencesObj: Record<string, any> = {
        culturalDifferences: parsedData.culturalDifferences
      };

      // Diğer kültürel farklılık alanlarını ekle
      if (parsedData.lifestyleDifferences) {
        culturalDifferencesObj.lifestyleDifferences = parsedData.lifestyleDifferences;
      }
      if (parsedData.foodCultureDifferences) {
        culturalDifferencesObj.foodCultureDifferences = parsedData.foodCultureDifferences;
      }
      if (parsedData.socialNormsDifferences) {
        culturalDifferencesObj.socialNormsDifferences = parsedData.socialNormsDifferences;
      }

      // Orijinal culturalDifferences alanını güncelle
      parsedData.culturalDifferences = culturalDifferencesObj;
    }

    // Yerel ipuçları için özel işleme
    // Web uygulamasıyla uyumlu olması için localTips nesnesini oluştur
    if (!parsedData.localTips || typeof parsedData.localTips !== 'object') {
      const localTipsObj: any = {};

      // Yerel ipuçları alanlarını ekle
      if (parsedData.localTransportationGuide) {
        localTipsObj.localTransportationGuide = parsedData.localTransportationGuide;
      }
      if (parsedData.emergencyContacts) {
        localTipsObj.emergencyContacts = parsedData.emergencyContacts;
      }
      if (parsedData.currencyAndPayment) {
        localTipsObj.currencyAndPayment = parsedData.currencyAndPayment;
      }
      if (parsedData.communicationInfo) {
        localTipsObj.communicationInfo = parsedData.communicationInfo;
      }
      if (parsedData.healthcareInfo) {
        localTipsObj.healthcareInfo = parsedData.healthcareInfo;
      }

      // Eğer en az bir alan varsa, localTips nesnesini oluştur
      if (Object.keys(localTipsObj).length > 0) {
        parsedData.localTips = localTipsObj;
      }
    }

    // TravelPlan formatına dönüştürme
    return formatTravelPlan(parsedData);
  } catch (error) {
    console.error('OpenAI yanıtı parse hatası:', error);
    return DEFAULT_TRAVEL_PLAN;
  }
}

// Expo Router için default export gereklidir
export default function TravelParserComponent() {
  return null;
}
