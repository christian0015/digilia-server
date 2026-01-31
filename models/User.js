// [file name]: User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Email invalide'],
  },
  password: {
    type: String,
    required: function() { return !this.googleId; }, // Requis seulement pour auth classique
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client',
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
    },
  },
  dailyGenerations: {
    type: Number,
    default: 0,
  },
  paidGenerations: {
    type: Number,
    default: 0,
  },
  lastReset: {
    type: Date,
    default: Date.now,
  },
  freeDeepSeekGenerations: {
    type: Number,
    default: 3,
  },
  lastFreeDeepSeekReset: {
    type: Date,
    default: Date.now,
  },
  recentGenerations: [{
    timestamp: { type: Date, default: Date.now },
    model: String,
    type: String,
    typeSection: String,
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    requestId: String,
    default: []
  }],
  lastLogin: {
    type: Date,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { collection: 'digiliaUsers' });

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index pour les recherches fréquentes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;