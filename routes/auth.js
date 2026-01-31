// auth.js
const express = require('express');
const { 
  login, 
  register, 
  update, 
  delete: deleteUser,
  verifyEmail,
  resendVerification,
  googleAuth,
  googleCallback,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const router = express.Router();

// Routes d'authentification classique
router.post('/login', login);
router.post('/register', register);
router.put('/update', update);
router.delete('/delete/:userId', deleteUser);

// Routes de vérification email
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Authentification Google
router.post('/google', googleAuth);


router.get('/google/callback', googleCallback);

// router.get('/google', (req, res) => {
//   // URL d'autorisation Google OAuth 2.0
//   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?
//     client_id=${process.env.GOOGLE_CLIENT_ID}
//     &redirect_uri=${process.env.BACKEND_URL}/api/auth/google/callback
//     &response_type=code
//     &scope=email%20profile
//     &access_type=offline
//     &prompt=consent`;
  
//   res.redirect(authUrl);
// });

router.get('/google', (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.BACKEND_URL}/api/auth/google/callback&response_type=code&scope=email%20profile`;
  res.redirect(authUrl);
});

// Réinitialisation de mot de passe
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;