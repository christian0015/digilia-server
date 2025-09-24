// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const { chatAI, imageGen } = require('../controllers/aiPuterController');
const { handleAICreation ,  } = require('../controllers/aiController');


// Route POST pour créer/générer une section ou un site
router.post('/generate', handleAICreation);

// Route for text generation (choose provider/model)
router.post('/chat', chatAI);


// Route for image generation
router.post('/image', imageGen);


module.exports = router;