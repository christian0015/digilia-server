const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); // Assure-toi que le chemin est correct
const Historique = require('../models/Historique');

// Route pour obtenir tous les produits
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
});

// Route pour ajouter la quantité d'un produit
router.post('/update-quantity', async (req, res) => {
  const { productId, quantity, costPrice } = req.body; // Ajout de costPrice
  
  try {
    if (isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.quantity += quantity;

    // Si un costPrice est fourni, on met à jour le prix de revient
    if (costPrice && !isNaN(costPrice)) {
      product.costPrice = costPrice;
    }

    await product.save();

    // Enregistre l'approvisionnement dans le modèle Historique
    const historique = new Historique({
      product: productId,
      quantity,
    });
    await historique.save();

    res.status(200).json({ message: 'Quantity and cost price updated successfully', product });
  } catch (error) {
    res.status(500).json({ message: 'Error updating quantity', error });
  }
});

// Route pour obtenir l'historique des approvisionnements
router.get('/getHistorique', async (req, res) => {
  try {
    const supplies = await Historique.find().populate('product');
    res.status(200).json(supplies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching supplies', error });
  }
});

module.exports = router;
