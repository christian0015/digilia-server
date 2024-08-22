const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
app.use(cors());
// const cors = require('cors');
app.use(cors({
  origin: '*', // ou l'URL correcte du frontend
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

const mongoose = require('mongoose');
const config = require('./config/config'); // Assure-toi que le chemin est correct

const User = require('./models/User');
const Product = require('./models/Product');
const Vente = require('./models/Vente');
const Historique = require('./models/Historique');

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
// app.use('/api/products', require('./routes/productRoutes'));
// app.use('/api/ventes', require('./routes/venteRoutes'));
// Routes
// app.use('/api/auth', require('./routes/auth'));
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


const seedData = async () => {
  try {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Vente.deleteMany({});
    await Historique.deleteMany({});

    const admin = new User({
      username: 'Djimi',
      email: 'djimi@gmail.com',
      password: 'Djimi',
      role: 'admin',
    });

    await admin.save();

    const drink1 = new Product({
      name: 'Coca',
      category: 'Boissons Locales',
      price: 1500.00,
      costPrice: 1200.00, // Modifier le champ pour correspondre au modèle
    });

    const drink2 = new Product({
      name: 'Fanta',
      category: 'Boissons Locales',
      price: 1500.00,
      costPrice: 1200.00, // Modifier le champ pour correspondre au modèle
    });

    const drink3 = new Product({
      name: 'Maltina',
      category: 'Boissons Locales',
      price: 2000.00,
      costPrice: 1200.00, // Modifier le champ pour correspondre au modèle
    });

    const drink4 = new Product({
      name: 'Ice Brut',
      category: 'Champagnes',
      price: 290000.00,
      costPrice: 250000.00, // Modifier le champ pour correspondre au modèle
    });

    const drink5 = new Product({
      name: 'Jacques Daniel',
      category: 'Liquers',
      price: 222000.00,
      costPrice: 180000.00, // Modifier le champ pour correspondre au modèle
    });

    await drink1.save();
    await drink2.save();
    await drink3.save();
    console.log('Bière Locale créée');
    await drink4.save();
    console.log('Champagne Brut créé');
    await drink5.save();
    console.log('Liqueur créée');

    // Créer des approvisionnements par défaut
    const historique1 = new Historique({
      product: drink1._id,
      quantity: 100,
    });
    const historique2 = new Historique({
      product: drink2._id,
      quantity: 100,
    });
    const historique3 = new Historique({
      product: drink3._id,
      quantity: 100,
    });
    const historique4 = new Historique({
      product: drink4._id,
      quantity: 50,
    });
    const historique5 = new Historique({
      product: drink5._id,
      quantity: 30,
    });
    
    // Sauvegarder les approvisionnements
    await historique1.save();
    await historique2.save();
    await historique3.save();
    await historique4.save();
    await historique5.save();
    console.log('Approvisionnements enregistrés');
    // Mettre à jour la quantité des produits
    drink1.quantity += 100;
    await drink1.save();
    drink2.quantity += 100;
    await drink2.save();
    drink3.quantity += 100;
    await drink3.save();
    drink4.quantity += 50;
    await drink4.save();
    drink5.quantity += 30;
    await drink5.save();
  console.log('Quantités mises à jour');

    // Créer des ventes par défaut
    const vente1 = new Vente({
      product: drink1._id,
      quantity: 2,
      totalPrice: drink1.price * 2,
      server: admin,
      table: '1',
    });
    const vente2 = new Vente({
      product: drink2._id,
      quantity: 1,
      totalPrice: drink2.price * 1,
      server: admin,
      table: '2',
    });
    // Sauvegarder les ventes
    await vente1.save();
    console.log('Vente 1 enregistrée');
    await vente2.save();
    console.log('Vente 2 enregistrée');

    console.log('Données insérées avec succès !');
  } catch (error) {
    console.error('Erreur lors de l’insertion des données :', error);
  } finally {
    // mongoose.connection.close();
  }
};

// Exécuter le script
// seedData();


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));


// const express = require('express');
// const app = express();
// const cors = require('cors');
// app.use(cors());

// const mongoose = require('mongoose');
// const config = require('./config/config'); // Assure-toi que le chemin est correct

// // Connexion à MongoDB
// mongoose.connect(config.mongoURI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   // useCreateIndex: true,
//   // useFindAndModify: false
// });
// console.log('MongoDB Connected...');


// // Middleware
// app.use(express.json());

// // Routes
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/categories', require('./routes/categoryRoutes'));
// app.use('/api/products', require('./routes/productRoutes'));
// app.use('/api/sales', require('./routes/saleRoutes'));

// // Erreur 404
// app.use((req, res, next) => {
//   res.status(404).json({ message: 'Resource not found' });
// });

// // Gestion des erreurs
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ message: 'Internal Server Error' });
// });

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => console.log(`Server started on port ${PORT}`));


// const express = require('express');
// const connectDB = require('./config/db');
// const authRoutes = require('./routes/authRoutes');
// const categoryRoutes = require('./routes/categoryRoutes');
// const productRoutes = require('./routes/productRoutes');
// const saleRoutes = require('./routes/saleRoutes');
// const config = require('./config/config');

// const app = express();

// // Connect Database
// connectDB();

// // Init Middleware
// app.use(express.json());

// // Define Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/categories', categoryRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/sales', saleRoutes);

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
