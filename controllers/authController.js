const User = require('../models/User');
const bcrypt = require('bcrypt');
const generateToken = require('../utils/generateToken');

// Connexion
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur introuvable' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    const token = generateToken(user._id);
    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Inscription
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    // Hasher le mot de passe avant de créer l'utilisateur
    const hashedPassword = await bcrypt.hash(password, 10); // 10 est le facteur de coût pour bcrypt

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      message: 'Inscription réussie.',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l’inscription.', error });
  }
};

// Mise à jour du profil
exports.update = async (req, res) => {
  const { username, email, password } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error });
  }
};

// Suppression du compte
exports.delete = async (req, res) => {
  const userId = req.user.id;

  try {
    await Project.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'Compte supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du compte', error });
  }
};
