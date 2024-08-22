const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // Middleware d'authentification

router.post('/login', authController.login);
router.post('/register', authController.register);

// Route pour obtenir les informations de l'utilisateur connecté
router.get('/servers', authController.getAllUserProfile);
router.get('/me', authController.getUserProfile);

module.exports = router;
