// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const authRoutes = require('./routes/auth');
// const projectRoutes = require('./routes/projet'); // Assurez-vous que le nom du fichier est correct
// const app = express();
// const path = require('path');

// // Autoriser toutes les origines
// app.use(cors());
// app.use(express.json());

// // Connexion à MongoDB
// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('MongoDB connecté'))
// .catch((err) => console.error('Erreur de connexion à MongoDB:', err));

// // // Routes
// // app.use('/api/auth', authRoutes);
// // app.use('/api/projects', projectRoutes); // Assurez-vous que le nom de la route est correct


// // Erreur 404
// app.use((req, res, next) => {
//   res.status(404).json({ message: 'Resource not found' });
// });

// // Gestion des erreurs
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ message: 'Internal Server Error' });
// });

// // Servir les fichiers statiques depuis le dossier 'public'
// app.use(express.static(path.join(__dirname, 'public')));

// // Route pour toutes les autres requêtes GET, renvoyant index.html
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });


// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

// module.exports = app; // Exporte l'application pour Vercel


const express = require('express');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/projet');
const userApi = require('./routes/auth');
const voteApi = require('./routes/projet');
const successApi = require('./routes/projet');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// // Définir les options CORS avec des origines spécifiques autorisées
// const corsOptions = {
//   // origin: 'https://miss-africamaroc.vercel.app', // URL réelle de votre frontend sans le slash final
//   origin: 'http://localhost:5000/', // URL réelle de votre frontend sans le slash final
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   optionsSuccessStatus: 200 // Some legacy browsers (IE11) choke on 204
// };

// app.use(cors(corsOptions));
app.use(cors());
// Utilisation de CORS avec les options définies


// Utilisation de bodyParser pour analyser les corps de requête en JSON
app.use(bodyParser.json());


// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connecté'))
.catch((err) => console.error('Erreur de connexion à MongoDB:', err));


// Routes API
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);

// Autres routes spécifiques
app.use('/users', userApi);
app.use('/vote', voteApi);
app.use('/success', successApi);

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route pour toutes les autres requêtes GET, renvoyant index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

