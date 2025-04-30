// OpenAI API Service
import Constants from 'expo-constants';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

// OpenAI API anahtarı
const API_KEY = API_CONFIG.OPENAI;

// API endpoint
const API_URL = API_ENDPOINTS.OPENAI;

// Hata mesajları
const ERROR_MESSAGES = {
  NO_API_KEY: 'OpenAI API anahtarı bulunamadı. Lütfen .env dosyasını kontrol edin.',
  REQUEST_FAILED: 'OpenAI API isteği başarısız oldu.',
  INVALID_RESPONSE: 'OpenAI API\'den geçersiz yanıt alındı.',
};

/**
 * OpenAI API'sine istek gönderir
 * @param prompt Kullanıcı isteği
 * @param model Kullanılacak model (varsayılan: gpt-4o)
 * @param maxTokens Maksimum token sayısı
 * @returns API yanıtı
 */
export async function generateAIResponse(
  prompt: string,
  model: string = 'gpt-4o',
  maxTokens: number = 1000
): Promise<string> {
  try {
    // API anahtarı kontrolü
    if (!API_KEY) {
      console.error(ERROR_MESSAGES.NO_API_KEY);
      return ERROR_MESSAGES.NO_API_KEY;
    }

    // API isteği
    const response = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Sen bir seyahat asistanısın. Kullanıcıya seyahat planlaması konusunda yardımcı oluyorsun.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
      }),
    });

    // Yanıt kontrolü
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Hatası:', errorData);
      return `${ERROR_MESSAGES.REQUEST_FAILED} Hata: ${errorData.error?.message || 'Bilinmeyen hata'}`;
    }

    // Yanıtı işle
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      console.error('Geçersiz OpenAI yanıtı:', data);
      return ERROR_MESSAGES.INVALID_RESPONSE;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI servisi hatası:', error);
    return `OpenAI servisi hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`;
  }
}

// Expo Router için default export gereklidir
export default function OpenAIServiceComponent() {
  return null;
}
