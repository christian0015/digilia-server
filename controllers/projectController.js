const Project = require('../models/Projet');
const User = require('../models/User'); // Assurez-vous d'importer le modèle User

// Créer un projet
exports.createProject = async (req, res) => {
  const { name, description, code } = req.body;
  const userId = req.user.id;

  try {
    const project = new Project({
      user: userId,
      name,
      description,
      code,
    });

    await project.save();
    res.status(201).json({ message: 'Projet créé avec succès', project });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du projet', error });
  }
};

const updateSubscriptionStatus = async (userId) => {
    try {
      const user = await User.findById(userId).populate('projects'); // Assumes user has a projects reference
  
      // Nombre de projets de l'utilisateur
      const projectCount = user.projects.length;
  
      // Mettre à jour le statut en fonction du nombre de projets
      if (user.subscription.type === 'free' && projectCount > 5) {
        user.subscription.status = 'inactive';
      } else if (user.subscription.type === 'free' && projectCount <= 5) {
        user.subscription.status = 'active';
      }
  
      await user.save();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut d\'abonnement:', error);
    }
  };
  

// Obtenir les projets d'un utilisateur
exports.getUserProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user.id });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des projets', error });
  }
};

// Mettre à jour le nom du projet
exports.updateProjectName = async (req, res) => {
    const { projectId } = req.params;
    const { newName } = req.body;
  
    try {
      // Trouver et mettre à jour le projet
      const project = await Project.findById(projectId);
  
      if (!project) {
        return res.status(404).json({ message: 'Projet non trouvé.' });
      }
  
      // Vérifier que l'utilisateur est le propriétaire du projet (optionnel, si nécessaire)
      if (project.user.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Accès interdit.' });
      }
  
      project.name = newName;
      await project.save();
  
      res.status(200).json({ message: 'Nom du projet mis à jour avec succès.', project });
    } catch (error) {
      res.status(500).json({ message: 'Erreur lors de la mise à jour du nom du projet.', error });
    }
};

// Supprimer un projet
exports.deleteProject = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
  
    try {
      // Supprimer le projet
      await Project.findByIdAndDelete(projectId);
  
      // Mettre à jour le statut d'abonnement
      await updateSubscriptionStatus(userId);
  
      res.status(200).json({ message: 'Projet supprimé avec succès.' });
    } catch (error) {
      res.status(500).json({ message: 'Erreur lors de la suppression du projet.', error });
    }
  };