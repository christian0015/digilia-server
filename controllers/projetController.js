const Projet = require('../models/Projet');
const User = require('../models/User'); // Assurez-vous d'importer le modèle User

// Créer un projet
exports.createProjet = async (req, res) => {
  const { name, description, code } = req.body;
  const userId = req.user.id;

  try {
    const projet = new Projet({
      user: userId,
      name,
      description,
      code,
    });

    await projet.save();
    res.status(201).json({ message: 'Projet créé avec succès', projet });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du projet', error });
  }
};

const updateSubscriptionStatus = async (userId) => {
    try {
      const user = await User.findById(userId).populate('projets'); // Assumes user has a projets reference
  
      // Nombre de projets de l'utilisateur
      const projetCount = user.projets.length;
  
      // Mettre à jour le statut en fonction du nombre de projets
      if (user.subscription.type === 'free' && projetCount > 5) {
        user.subscription.status = 'inactive';
      } else if (user.subscription.type === 'free' && projetCount <= 5) {
        user.subscription.status = 'active';
      }
  
      await user.save();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut d\'abonnement:', error);
    }
  };
  

// Obtenir les projets d'un utilisateur
exports.getUserProjets = async (req, res) => {
  try {
    const projets = await Projet.find({ user: req.user.id });
    res.status(200).json(projets);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des projets', error });
  }
};

// Mettre à jour le nom du projet
exports.updateProjetName = async (req, res) => {
    const { projetId } = req.params;
    const { newName } = req.body;
  
    try {
      // Trouver et mettre à jour le projet
      const projet = await Projet.findById(projetId);
  
      if (!projet) {
        return res.status(404).json({ message: 'Projet non trouvé.' });
      }
  
      // Vérifier que l'utilisateur est le propriétaire du projet (optionnel, si nécessaire)
      if (projet.user.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Accès interdit.' });
      }
  
      projet.name = newName;
      await projet.save();
  
      res.status(200).json({ message: 'Nom du projet mis à jour avec succès.', projet });
    } catch (error) {
      res.status(500).json({ message: 'Erreur lors de la mise à jour du nom du projet.', error });
    }
};

// Supprimer un projet
exports.deleteProjet = async (req, res) => {
    const { projetId } = req.params;
    const userId = req.user.id;
  
    try {
      // Supprimer le projet
      await Projet.findByIdAndDelete(projetId);
  
      // Mettre à jour le statut d'abonnement
      await updateSubscriptionStatus(userId);
  
      res.status(200).json({ message: 'Projet supprimé avec succès.' });
    } catch (error) {
      res.status(500).json({ message: 'Erreur lors de la suppression du projet.', error });
    }
  };