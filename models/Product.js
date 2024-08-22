const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true }, // Prix de vente
  costPrice: { type: Number, required: true }, // Prix de revient
  quantity: { type: Number, default: 0 } // Quantité en stock
}, { collection: 'lesecretProduits' }); // Nom de collection avec préfixe

module.exports = mongoose.model('Product', productSchema);
