const express = require('express');
const app = express();
const mongoose = require('mongoose');
const config = require('./config/config'); // Assure-toi que le chemin est correct
const cors = require('cors');
require('dotenv').config();
app.use(cors());
// const cors = require('cors');
app.use(cors({
  origin: '*', // ou l'URL correcte du frontend
  allowedHeaders: ['Authorization', 'Content-Type'],
}));


// Connexion à MongoDB
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // useCreateIndex: true,
  // useFindAndModify: false
}).then(() => console.log('MongoDB Connected...'))
  .catch(err => console.log('MongoDB connection error: ', err));

// Middleware
app.use(express.json());

// Routes
// app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/', require('./routes/auth'));
app.use('/api/projects', require('./routes/projet')); // Assurez-vous que le nom de la route est correct


// Erreur 404
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
