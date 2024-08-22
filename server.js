require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projet'); // Assurez-vous que le nom du fichier est correct
const app = express();
const path = require('path');

// Autoriser toutes les origines
app.use(cors());
app.use(express.json());

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connecté'))
.catch((err) => console.error('Erreur de connexion à MongoDB:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes); // Assurez-vous que le nom de la route est correct


// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route pour toutes les autres requêtes GET, renvoyant index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

