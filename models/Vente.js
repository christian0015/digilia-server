const mongoose = require('mongoose');

const venteSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  table: { type: String, required: true },
  date: { type: Date, default: Date.now }
}, { collection: 'lesecretVentes' }); // Nom de collection avec préfixe

module.exports = mongoose.model('Vente', venteSchema);
