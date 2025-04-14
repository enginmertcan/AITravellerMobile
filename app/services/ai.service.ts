import { AI_PROMPT } from '../constants/options';

const chatSession = {
  async sendMessage(message: string) {
    try {
      // TODO: Implement actual AI service integration
      // For now, return a mock response
      return {
        response: {
          text: `Bu bir örnek yanıttır. Gerçek AI entegrasyonu yapılacak.\n\n${message}`
        }
      };
    } catch (error) {
      console.error('Error sending message to AI:', error);
      throw error;
    }
  }
}; 

// JSX component for Expo Router
function AiServiceComponent() {
  return null;
}

// Default ve named exports
AiServiceComponent.chatSession = chatSession;

export default AiServiceComponent;