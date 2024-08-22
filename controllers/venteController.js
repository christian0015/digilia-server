const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); // Assure-toi que le chemin est correct
const Vente = require('../models/Vente'); // Assure-toi que le chemin est correct

// Route pour enregistrer une vente
router.post('/', async (req, res) => {
  const { productId, quantity, serverId, table } = req.body;
  
  try {
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    product.quantity -= quantity;
    await product.save();

    const totalPrice = product.price * quantity;
    const totalCost = product.costPrice * quantity; // Calcule le coût total

    const vente = new Vente({
      product: productId,
      quantity,
      totalPrice,
      totalCost, // Enregistre le coût total de la vente
      server: serverId,
      table,
    });

    await vente.save();

    res.status(201).json({ message: 'Vente recorded successfully', vente });
  } catch (error) {
    res.status(500).json({ message: 'Error recording vente', error });
  }
});

// Route pour obtenir toutes les ventes
router.get('/', async (req, res) => {
  try {
    const ventes = await Vente.find().populate('product').populate('server');
    res.status(200).json(ventes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ventes', error });
  }
});

module.exports = router;
