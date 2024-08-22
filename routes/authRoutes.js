// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/update', authController.update); // Vérifie que update est exporté correctement
router.post('/delete', authController.delete); // Vérifie que delete est exporté correctement

module.exports = router;
