// models/Export.js
const mongoose = require('mongoose');

const ExportSchema = new mongoose.Schema({
  projet: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Projet', 
    required: true, 
    unique: true 
  },
  exportKey: { 
    type: String, 
    required: true, 
    unique: true 
  },
  viewCount: {
    type: Number,
    default: 0
  },
  viewHistory: [{
    month: { type: String, required: true }, // Format "YYYY-MM"
    count: { type: Number, default: 0 }
  }],
  lastViewed: {
    type: Date
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
}, { 
  collection: 'digiliaExports',
  timestamps: true 
});

// Méthode pour incrémenter le viewCount avec gestion des mois
ExportSchema.methods.incrementView = function() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previousMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  
  if (now.getMonth() === 0) {
    // Si janvier, mois précédent est décembre de l'année précédente
    previousMonth = `${now.getFullYear() - 1}-12`;
  }
  
  this.viewCount += 1;
  this.lastViewed = now;
  
  // Trouver ou créer l'entrée pour le mois courant
  const currentMonthIndex = this.viewHistory.findIndex(item => item.month === currentMonth);
  if (currentMonthIndex >= 0) {
    this.viewHistory[currentMonthIndex].count += 1;
  } else {
    this.viewHistory.push({ month: currentMonth, count: 1 });
  }
  
  // Conserver uniquement les 2 derniers mois
  this.viewHistory = this.viewHistory.filter(item => {
    // Garder le mois courant et le mois précédent
    return item.month === currentMonth || item.month === previousMonth;
  });
  
  return this.save();
};

// Méthode pour récupérer le viewCount des 2 derniers mois
ExportSchema.methods.getRecentViewCount = function() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previousMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  
  if (now.getMonth() === 0) {
    previousMonth = `${now.getFullYear() - 1}-12`;
  }
  
  const currentMonthData = this.viewHistory.find(item => item.month === currentMonth);
  const previousMonthData = this.viewHistory.find(item => item.month === previousMonth);
  
  return {
    currentMonth: currentMonthData ? currentMonthData.count : 0,
    previousMonth: previousMonthData ? previousMonthData.count : 0,
    total: this.viewCount
  };
};

module.exports = mongoose.model('Export', ExportSchema);