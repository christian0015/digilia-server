// services/puterAIService.js
const axios = require('axios');

class PuterAIService {
  constructor() {
    this.baseURL = 'https://api.puter.com';
  }

  async chat(message, model = 'claude-sonnet-4', stream = false) {
    try {
      // Pour Puter.js, nous devons simuler les appels comme le ferait le navigateur
      const response = await axios.post(
        `${this.baseURL}/v2/ai/chat`,
        {
          message,
          model,
          stream
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://puter.com',
            'Referer': 'https://puter.com/'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error calling Puter AI:', error);
      throw new Error('Failed to get response from Puter AI');
    }
  }

  // Méthode pour gérer le streaming
  async chatStream(message, model = 'claude-sonnet-4', onData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v2/ai/chat`,
        {
          message,
          model,
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://puter.com',
            'Referer': 'https://puter.com/'
          },
          responseType: 'stream'
        }
      );

      response.data.on('data', (chunk) => {
        try {
          const data = chunk.toString();
          if (data.startsWith('data: ')) {
            const jsonData = JSON.parse(data.substring(6));
            onData(jsonData);
          }
        } catch (e) {
          // Ignorer les erreurs de parsing pour les chunks incomplets
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('Error calling Puter AI stream:', error);
      throw new Error('Failed to get stream response from Puter AI');
    }
  }
}

module.exports = new PuterAIService();