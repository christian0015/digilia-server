// controllers/aiPuterController.js
const puterAIService = require('../services/puterAIService');

// Configuration des modèles disponibles
const MODELS = {
  'claude-opus-4': { provider: 'claude', model: 'claude-opus-4' },
  'claude-sonnet-4': { provider: 'claude', model: 'claude-sonnet-4' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt-5': { provider: 'openai', model: 'gpt-5' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'gemini-pro': { provider: 'gemini', model: 'gemini-pro' },
  'grok': { provider: 'xai', model: 'grok' }
};

/**
 * Contrôleur pour la génération de texte avec l'IA
 */
const chatAI = async (req, res) => {
  try {
   let message, modelName, stream;

// Support POST ou GET (pour EventSource)
if (req.method === 'POST') {
  message = req.body.message;
  modelName = req.body.model;
  stream = req.body.stream || false;
} else if (req.method === 'GET') {
  message = req.query.message;
  modelName = req.query.model;
  stream = req.query.stream === 'true';
}
    console.log(message , stream);
    

    // Validation des paramètres
    if (!message) {
      return res.status(400).json({ error: 'Le message est requis' });
    }

    if (!modelName || !MODELS[modelName]) {
      return res.status(400).json({ 
        error: 'Modèle non valide', 
        availableModels: Object.keys(MODELS) 
      });
    }

    const modelConfig = MODELS[modelName];
    
    // Utilisation de Puter.js pour tous les modèles
    if (stream) {
      // Configuration des en-têtes pour le streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      await puterAIService.chatStream(
        message, 
        modelConfig.model,
        (data) => {
          if (data.text) {
            res.write(`data: ${JSON.stringify({ text: data.text })}\n\n`);
          }
        }
      );
      
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await puterAIService.chat(message, modelConfig.model);
      res.json({ message: response });
    }

  } catch (error) {
    console.error('Erreur dans chatAI:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération de texte',
      details: error.message 
    });
  }
};

/**
 * Contrôleur pour la génération d'images avec l'IA
 */
const imageGen = async (req, res) => {
  try {
    const { prompt, size = '512x512' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Le prompt est requis' });
    }

    // Pour Puter.js, nous devons vérifier s'il offre un service de génération d'images
    // Pour l'instant, nous allons utiliser un service tiers ou retourner une erreur
    res.status(501).json({ 
      error: 'La génération d\'images n\'est pas encore implémentée avec Puter.js',
      suggestion: 'Utilisez un service spécialisé comme OpenAI DALL-E ou Stable Diffusion'
    });

  } catch (error) {
    console.error('Erreur dans imageGen:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération d\'image',
      details: error.message 
    });
  }
};

module.exports = {
  chatAI,
  imageGen
};