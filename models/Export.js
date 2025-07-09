// models/Export.js
const mongoose = require('mongoose');

const ExportSchema = new mongoose.Schema({
  projet: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
  exportKey: { type: String, required: true, unique: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Export', ExportSchema);
