// authController.js
const User = require('../models/User');
const Projet = require('../models/Projet');
const Export = require('../models/Export');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');
const sendEmail = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');

// // Initialisez le client OAuth2 CORRECTEMENT
// const oauth2Client = new OAuth2Client(
//   process.env.GOOGLE_CLIENT_ID,
//   process.env.GOOGLE_CLIENT_SECRET,
//   `${process.env.BACKEND_URL}/api/auth/google/callback`
// );
// === INITIALISATION CORRECTE ===
// Client OAuth2 SANS redirect_uri dans le constructeur
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
  // NE PAS mettre redirect_uri ici !
);

// const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Connexion
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Vérifier si l'utilisateur est temporairement bloqué
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ 
        message: 'Identifiants incorrects' // Message générique pour la sécurité
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Compte temporairement verrouillé. Réessayez dans ${remainingTime} minutes.`
      });
    }

    // Vérifier si c'est un utilisateur Google sans mot de passe
    if (user.googleId && !user.password) {
      return res.status(400).json({
        message: 'Veuillez vous connecter avec Google'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Incrémenter les tentatives échouées
      user.loginAttempts += 1;
      
      if (user.loginAttempts >= 5) {
        // Verrouiller le compte pendant 15 minutes
        user.lockUntil = Date.now() + 15 * 60 * 1000;
        await user.save();
        
        return res.status(423).json({
          message: 'Trop de tentatives échouées. Compte verrouillé pendant 15 minutes.'
        });
      }
      
      await user.save();
      return res.status(400).json({ 
        message: 'Identifiants incorrects' 
      });
    }

    // Vérifier si l'email est confirmé
    if (!user.isEmailVerified && !user.googleId) {
      return res.status(403).json({
        message: 'Veuillez vérifier votre email avant de vous connecter',
        needsVerification: true,
        email: user.email
      });
    }

    // Réinitialiser les tentatives après une connexion réussie
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user._id, '2d');
    const { password: _, ...userWithoutPassword } = user.toObject();
    
    userWithoutPassword.token = token;
    
    // Calcul des quotas
    const dailyLimit = user.subscription?.type === 'premium' ? 10
      : (user.subscription?.type === 'basic' ? 5 : 5);
    const paidLimit = user.subscription?.type === 'premium' ? 50 
      : (user.subscription?.type === 'basic' ? 20 : 0);
    
    userWithoutPassword.dailyRemaining = Math.max(0, dailyLimit - user.dailyGenerations);
    userWithoutPassword.paidUsed = user.subscription?.type !== 'free' 
      ? Math.max(0, paidLimit - user.paidGenerations) 
      : 0;

    res.json({ 
      token, 
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Inscription
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Validation du mot de passe
    if (password.length < 8) {
      return res.status(400).json({ 
        message: 'Le mot de passe doit contenir au moins 8 caractères' 
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ 
        message: 'Le mot de passe doit contenir au moins une majuscule' 
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ 
        message: 'Le mot de passe doit contenir au moins un chiffre' 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      if (existingUser.email === email) {
        // Si l'utilisateur existe mais n'est pas vérifié, on peut renvoyer un code
        if (!existingUser.isEmailVerified) {
          await sendVerificationEmail(existingUser);
          return res.status(400).json({
            message: 'Email déjà utilisé mais non vérifié. Un nouveau code a été envoyé.',
            needsVerification: true,
            email: existingUser.email
          });
        }
        return res.status(400).json({ 
          message: 'Cet email est déjà utilisé' 
        });
      }
      
      if (existingUser.username === username) {
        return res.status(400).json({ 
          message: 'Ce nom d\'utilisateur est déjà pris' 
        });
      }
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({ 
      username, 
      email, 
      password: hashedPassword,
      emailVerificationToken: crypto.randomBytes(6).toString('hex'),
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 heures
    });

    await user.save();

    // Envoyer l'email de vérification
    await sendVerificationEmail(user);

    // Générer un token temporaire (valide seulement pour la vérification)
    const tempToken = generateToken(user._id, '1h');

    res.status(201).json({
      message: 'Inscription réussie. Veuillez vérifier votre email.',
      needsVerification: true,
      email: user.email,
      tempToken
    });
  } catch (error) {
    console.error('Register error:', error);
    
    if (error.code === 11000) {
      const field = error.keyPattern.email ? 'email' : 'username';
      return res.status(400).json({
        message: `Cet ${field} est déjà utilisé.`
      });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de l\'inscription', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

// Vérification d'email
exports.verifyEmail = async (req, res) => {
  const { token } = req.body;

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Lien de vérification invalide ou expiré' 
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Générer un vrai token de connexion
    const authToken = generateToken(user._id, '2d');
    const { password: _, ...userWithoutPassword } = user.toObject();
    userWithoutPassword.token = authToken;

    res.json({
      message: 'Email vérifié avec succès',
      token: authToken,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification' });
  }
};

// Renvoyer le code de vérification
exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ 
        message: 'Email déjà vérifié' 
      });
    }

    user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user);

    res.json({ 
      message: 'Nouveau code de vérification envoyé' 
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi' });
  }
};


// === 1. CONNEXION AVEC GOOGLE (flux frontend) ===
exports.googleAuth = async (req, res) => {
  const { tokenId } = req.body;

  try {
    console.log('Google Auth flux frontend démarré');
    
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    console.log('Utilisateur Google identifié:', email);

    let user = await User.findOne({ 
      $or: [{ googleId }, { email }] 
    });

    if (!user) {
      console.log('Création nouvel utilisateur');
      user = new User({
        googleId,
        email,
        username: name || email.split('@')[0],
        isEmailVerified: true,
        lastLogin: Date.now(),
        avatar: picture
      });
    } else {
      console.log('Mise à jour utilisateur existant');
      if (!user.googleId) user.googleId = googleId;
      user.lastLogin = Date.now();
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      if (picture && !user.avatar) user.avatar = picture;
    }

    await user.save();

    const authToken = generateToken(user._id, '2d');
    const userResponse = user.toObject();
    delete userResponse.password;

    // Calcul des quotas
    const dailyLimit = user.subscription?.type === 'premium' ? 10
      : (user.subscription?.type === 'basic' ? 5 : 5);
    const paidLimit = user.subscription?.type === 'premium' ? 50 
      : (user.subscription?.type === 'basic' ? 20 : 0);
    
    userResponse.dailyRemaining = Math.max(0, dailyLimit - user.dailyGenerations);
    userResponse.paidUsed = user.subscription?.type !== 'free' 
      ? Math.max(0, paidLimit - user.paidGenerations) 
      : 0;

    console.log('Connexion Google réussie pour:', email);
    
    res.json({
      token: authToken,
      user: userResponse
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(400).json({ 
      message: 'Échec de l\'authentification Google',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// === 2. CALLBACK GOOGLE OAUTH (flux server-side) ===
exports.googleCallback = async (req, res) => {
  console.log('=== GOOGLE CALLBACK DÉMARRÉ ===');
  console.log('Code reçu:', req.query.code ? 'OUI' : 'NON');
  console.log('Erreur Google:', req.query.error || 'AUCUNE');
  
  const { code, error } = req.query;

  if (error) {
    console.error('Google a retourné une erreur:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_${error}`);
  }

  if (!code) {
    console.error('Pas de code d\'autorisation reçu');
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
  }

  try {
    console.log('Échange du code contre token Google...');
    
    // Échange du code contre un token d'accès
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET
    });

    console.log('Tokens Google reçus');
    
    if (!tokens || !tokens.id_token) {
      throw new Error('Pas de token ID reçu de Google');
    }

    // Vérification du token ID
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    console.log('Utilisateur Google authentifié:', payload.email);
    
    const { sub: googleId, email, name, picture, email_verified } = payload;

    // Chercher ou créer l'utilisateur dans notre base
    let user = await User.findOne({ 
      $or: [{ googleId }, { email }] 
    });

    if (!user) {
      console.log('Création nouvel utilisateur dans notre base');
      user = new User({
        googleId,
        email,
        username: name || email.split('@')[0],
        isEmailVerified: email_verified || true,
        lastLogin: Date.now(),
        avatar: picture
      });
    } else {
      console.log('Mise à jour utilisateur existant');
      if (!user.googleId) user.googleId = googleId;
      user.lastLogin = Date.now();
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      if (picture && !user.avatar) user.avatar = picture;
    }

    await user.save();
    console.log('Utilisateur sauvegardé:', user.email);

    // Générer notre propre token JWT
    const authToken = generateToken(user._id, '2d');
    console.log('JWT généré');

    // Redirection vers le frontend avec le token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${authToken}`;
    console.log('Redirection vers:', redirectUrl);
    
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('=== ERREUR GOOGLE CALLBACK ===');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.response?.data) {
      console.error('Réponse Google:', error.response.data);
    }
    
    // Redirection avec erreur détaillée
    const errorMsg = encodeURIComponent(error.message.substring(0, 100));
    res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed&details=${errorMsg}`);
  }
};

// === 3. GET SESSION (pour récupérer les infos utilisateur) ===
exports.getSession = async (req, res) => {
  try {
    console.log('Get session appelé');
    
    // Récupérer le token depuis la query string
    const token = req.query.token;
    
    if (!token) {
      console.log('Aucun token fourni');
      return res.status(401).json({ 
        message: 'Token manquant' 
      });
    }

    console.log('Token JWT reçu, vérification...');
    
    // Vérifier le token JWT
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('Token JWT valide, ID utilisateur:', decoded.id);
    
    // Récupérer l'utilisateur
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('Utilisateur non trouvé pour ID:', decoded.id);
      return res.status(404).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    console.log('Utilisateur trouvé:', user.email);

    // Calcul des quotas
    const dailyLimit = user.subscription?.type === 'premium' ? 10
      : (user.subscription?.type === 'basic' ? 5 : 5);
    const paidLimit = user.subscription?.type === 'premium' ? 50 
      : (user.subscription?.type === 'basic' ? 20 : 0);
    
    const userResponse = user.toObject();
    userResponse.dailyRemaining = Math.max(0, dailyLimit - user.dailyGenerations);
    userResponse.paidUsed = user.subscription?.type !== 'free' 
      ? Math.max(0, paidLimit - user.paidGenerations) 
      : 0;

    console.log('Session retournée pour:', user.email);
    
    res.json({
      token,
      user: userResponse
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Token invalide' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expiré' 
      });
    }
    
    res.status(401).json({ 
      message: 'Erreur d\'authentification' 
    });
  }
};

// === 4. ROUTE DE TEST (optionnel mais utile) ===
exports.testConfig = async (req, res) => {
  res.json({
    status: 'OK',
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'CONFIGURÉ' : 'MANQUANT',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'CONFIGURÉ' : 'MANQUANT',
      redirectUri: `${process.env.BACKEND_URL}/api/auth/google/callback`
    },
    urls: {
      backend: process.env.BACKEND_URL || 'NON DÉFINI',
      frontend: process.env.FRONTEND_URL || 'NON DÉFINI'
    },
    environment: process.env.NODE_ENV || 'development'
  });
};

// // Connexion avec Google
// exports.googleAuth = async (req, res) => {
//   const { tokenId } = req.body;

//   try {
//     const ticket = await oauth2Client.verifyIdToken({
//       idToken: tokenId,
//       audience: GOOGLE_CLIENT_ID
//     });

//     const payload = ticket.getPayload();
//     const { sub: googleId, email, name, picture } = payload;

//     let user = await User.findOne({ 
//       $or: [{ googleId }, { email }] 
//     });

//     if (!user) {
//       // Créer un nouvel utilisateur
//       user = new User({
//         googleId,
//         email,
//         username: name || email.split('@')[0],
//         isEmailVerified: true, // Google vérifie déjà l'email
//         lastLogin: Date.now()
//       });
//     } else {
//       // Mettre à jour les infos Google si nécessaire
//       if (!user.googleId) {
//         user.googleId = googleId;
//       }
//       user.lastLogin = Date.now();
//       user.loginAttempts = 0;
//       user.lockUntil = undefined;
//     }

//     await user.save();

//     const authToken = generateToken(user._id, '2d');
//     const userResponse = user.toObject();
//     delete userResponse.password;

//     // Calcul des quotas
//     const dailyLimit = user.subscription?.type === 'premium' ? 10
//       : (user.subscription?.type === 'basic' ? 5 : 5);
//     const paidLimit = user.subscription?.type === 'premium' ? 50 
//       : (user.subscription?.type === 'basic' ? 20 : 0);
    
//     userResponse.dailyRemaining = Math.max(0, dailyLimit - user.dailyGenerations);
//     userResponse.paidUsed = user.subscription?.type !== 'free' 
//       ? Math.max(0, paidLimit - user.paidGenerations) 
//       : 0;

//     res.json({
//       token: authToken,
//       user: userResponse
//     });
//   } catch (error) {
//     console.error('Google auth error:', error);
//     res.status(400).json({ 
//       message: 'Échec de l\'authentification Google' 
//     });
//   }
// };

// // Callback pour OAuth server-side Google - VERSION CORRIGÉE
// exports.googleCallback = async (req, res) => {
//   console.log('Google OAuth callback reçu');
  
//   const { code, error } = req.query;

//   if (error) {
//     console.error('Erreur de Google:', error);
//     return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_${error}`);
//   }

//   if (!code) {
//     console.error('Pas de code reçu de Google');
//     return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
//   }

//   try {
//     console.log('Échange du code contre token...');
    
//     // IMPORTANT: Utilisez oauth2Client qui a le client_secret
//     const { tokens } = await oauth2Client.getToken({
//       code,
//       redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`
//     });

//     console.log('Token reçu, vérification...');
    
//     const ticket = await oauth2Client.verifyIdToken({
//       idToken: tokens.id_token,
//       audience: process.env.GOOGLE_CLIENT_ID
//     });

//     const payload = ticket.getPayload();
//     const { sub: googleId, email, name, picture, email_verified } = payload;

//     console.log('Utilisateur Google:', email);

//     // Chercher ou créer l'utilisateur
//     let user = await User.findOne({ 
//       $or: [{ googleId }, { email }] 
//     });

//     if (!user) {
//       user = new User({
//         googleId,
//         email,
//         username: name || email.split('@')[0],
//         isEmailVerified: email_verified || true,
//         lastLogin: Date.now(),
//         avatar: picture
//       });
//     } else {
//       if (!user.googleId) user.googleId = googleId;
//       user.lastLogin = Date.now();
//       user.loginAttempts = 0;
//       user.lockUntil = undefined;
//       if (picture && !user.avatar) user.avatar = picture;
//     }

//     await user.save();

//     // Générer notre token JWT
//     const authToken = generateToken(user._id, '2d');
    
//     // OPTION SIMPLE: Rediriger avec token dans l'URL
//     const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${authToken}`;
//     console.log('Redirection vers:', redirectUrl);
    
//     res.redirect(redirectUrl);

//   } catch (error) {
//     console.error('Erreur dans googleCallback:', error.message);
    
//     // Redirection avec message d'erreur détaillé
//     const errorMsg = encodeURIComponent(error.message.substring(0, 100));
//     res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed&details=${errorMsg}`);
//   }
// };

// // Ajoutez cette fonction pour récupérer la session
// exports.getSession = async (req, res) => {
//   try {
//     // Si vous utilisez des cookies
//     const token = req.cookies?.auth_token || req.query.token;
    
//     if (!token) {
//       return res.status(401).json({ 
//         message: 'Non authentifié' 
//       });
//     }

//     // Vérifier le token et récupérer l'utilisateur
//     const jwt = require('jsonwebtoken');
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     const user = await User.findById(decoded.id).select('-password');
    
//     if (!user) {
//       return res.status(404).json({ 
//         message: 'Utilisateur non trouvé' 
//       });
//     }

//     // Calcul des quotas
//     const dailyLimit = user.subscription?.type === 'premium' ? 10
//       : (user.subscription?.type === 'basic' ? 5 : 5);
//     const paidLimit = user.subscription?.type === 'premium' ? 50 
//       : (user.subscription?.type === 'basic' ? 20 : 0);
    
//     const userResponse = user.toObject();
//     userResponse.dailyRemaining = Math.max(0, dailyLimit - user.dailyGenerations);
//     userResponse.paidUsed = user.subscription?.type !== 'free' 
//       ? Math.max(0, paidLimit - user.paidGenerations) 
//       : 0;

//     res.json({
//       token,
//       user: userResponse
//     });
    
//   } catch (error) {
//     console.error('Get session error:', error);
//     res.status(401).json({ 
//       message: 'Token invalide ou expiré' 
//     });
//   }
// };


// Mot de passe oublié
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Pour la sécurité, ne pas révéler si l'email existe
      return res.json({ 
        message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation' 
      });
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    await user.save();

    // Envoyer l'email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    await sendEmail({
      email: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <h1>Réinitialisation de mot de passe</h1>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${resetUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          background-color: #4CAF50;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 10px 0;
        ">Réinitialiser mon mot de passe</a>
        <p>Ce lien expirera dans 15 minutes.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      `
    });

    res.json({ 
      message: 'Lien de réinitialisation envoyé par email' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email' });
  }
};

// Réinitialisation du mot de passe
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Hasher le token pour le comparer avec celui en DB
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Lien invalide ou expiré' 
      });
    }

    // Validation du nouveau mot de passe
    if (password.length < 8) {
      return res.status(400).json({ 
        message: 'Le mot de passe doit contenir au moins 8 caractères' 
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ 
        message: 'Le mot de passe doit contenir au moins une majuscule' 
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ 
        message: 'Le mot de passe doit contenir au moins un chiffre' 
      });
    }

    // Mettre à jour le mot de passe
    user.password = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Envoyer une confirmation par email
    await sendEmail({
      email: user.email,
      subject: 'Mot de passe modifié avec succès',
      html: `
        <h1>Mot de passe modifié</h1>
        <p>Votre mot de passe a été modifié avec succès.</p>
        <p>Si vous n'avez pas effectué cette modification, contactez immédiatement le support.</p>
      `
    });

    res.json({ 
      message: 'Mot de passe réinitialisé avec succès' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation' });
  }
};

// Mise à jour du profil (inchangé)
exports.update = async (req, res) => {
  const { _id: userId, username, email, password } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ 
          message: 'Le mot de passe doit contenir au moins 8 caractères' 
        });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    const token = generateToken(user._id, '2d');

    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error });
  }
};

// Suppression du compte (inchangé)
exports.delete = async (req, res) => {
  const userId = req.params.userId;

  try {
    const projets = await Projet.find({ user: userId });
    const projetIds = projets.map(p => p._id);

    await Export.deleteMany({ projet: { $in: projetIds } });
    await Projet.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Compte et toutes les données associées supprimés avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du compte', error });
  }
};

// Fonction utilitaire pour envoyer les emails de vérification
async function sendVerificationEmail(user) {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${user.emailVerificationToken}`;
  
  await sendEmail({
    email: user.email,
    subject: 'Vérification de votre email - Digilia',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4CAF50;">Bienvenue sur Digilia !</h1>
        <p>Merci de vous être inscrit. Pour compléter votre inscription, veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="
            display: inline-block;
            padding: 14px 28px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
          ">Vérifier mon email</a>
        </div>
        
        <p>Ou copiez-collez ce lien dans votre navigateur :</p>
        <p style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; word-break: break-all;">
          ${verificationUrl}
        </p>
        
        <p>Ce lien expirera dans 24 heures.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <p style="font-size: 12px; color: #666;">
          Si vous n'avez pas créé de compte sur Digilia, ignorez simplement cet email.
        </p>
      </div>
    `
  });
}