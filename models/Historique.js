const mongoose = require('mongoose');

const historiqueSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  date: { type: Date, default: Date.now },
}, { collection: 'lesecretHistoriques' }); // Nom de collection spécifique avec préfixe

module.exports = mongoose.model('Historique', historiqueSchema);
