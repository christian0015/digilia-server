const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register);

// Route pour obtenir les informations de l'utilisateur connecté
router.post('/update', authController.update);
router.post('/delete', authController.delete);

module.exports = router;
