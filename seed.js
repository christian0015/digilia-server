const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('./config/config'); // Assurez-vous que ce fichier contient votre clé secrète et autres configurations

// Connexion à la base de données
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Fonction pour se connecter et récupérer le token
const loginUser = async (username, password) => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/login', { username, password });
    const { token } = response.data;
    console.log('Token:', token);

    // Décodez le token pour voir le rôle et autres informations
    const decoded = jwt.verify(token, config.jwtSecret);
    console.log('Decoded Token:', decoded);

    return token;
  } catch (error) {
    console.error('Error logging in:', error.response?.data || error.message);
  }
};

// Exemple d'identifiants d'utilisateur à tester
const username = 'admin'; // Remplacez par un utilisateur valide
const password = 'adminpassword'; // Remplacez par le mot de passe correct

loginUser(username, password).then((token) => {
  console.log('Successfully logged in');
  // Ici, vous pouvez ajouter plus de logique pour tester le token
}).finally(() => {
  mongoose.connection.close(); // Ferme la connexion à la base de données lorsque le script se termine
});
