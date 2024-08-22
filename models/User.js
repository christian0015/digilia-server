const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {type: String,required: true,unique: true,},
  email: {type: String,required: true,unique: true,lowercase: true,},
  password: {type: String,required: true,},
}); // Nom de collection avec préfixe

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model('UserD', userSchema);

module.exports = User;
