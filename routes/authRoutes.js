const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // Middleware d'authentification

router.post('/login', authController.login);
router.post('/register', authController.register);

// Route pour obtenir les informations de l'utilisateur connecté
router.post('/servers', authController.update);
router.post('/me', authController.delete);

module.exports = router;
