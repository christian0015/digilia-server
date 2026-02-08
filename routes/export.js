const express = require('express');
const router = express.Router();
const Projet = require('../models/Projet');
const Export = require('../models/Export');

// ----------- ⚡️ RAM Cache simple (optionnel, commenté) ----------- //
// const exportCache = {}; // Objet JavaScript (clé: exportKey, valeur: { html, expire })

// ----------- Utilitaire clé d'export ----------- //
function generateExportKey(username, projetName) {
  const random4Digits = Math.floor(1000 + Math.random() * 9000);
  const cleanUsername = username.replace(/\s+/g, '').toLowerCase();
  const cleanProjetName = projetName.replace(/\s+/g, '').toLowerCase();
  return `${cleanUsername}${cleanProjetName}${random4Digits}`;
}

// ----------- Détection automatique du type de projet ----------- //
function detectProjectType(code) {
  if (!code) return 'experience-3d'; // Changé par défaut
  
  try {
    let data = code;
    if (typeof code === 'string') {
      try {
        data = JSON.parse(code);
      } catch {
        return 'experience-3d'; // Changé par défaut
      }
    }
    
    // Nouveau format "experience-3d" avec structure site/layout
    if (typeof data === 'object' && data !== null) {
      // Vérifier si c'est le nouveau format "experience-3d"
      if (data.type === 'site' && Array.isArray(data.layout)) {
        return 'experience-3d';
      }
      
      // Si c'est un tableau (probablement jsx-3d)
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const first = data[0];
          // Vérifier les types d'éléments
          const elementTypes = ['jsxElement', '3DElement', 'textElement', 'imageElement'];
          if (elementTypes.includes(first.elementType) || 
              first.style !== undefined ||
              ['section', 'div', 'header', 'nav', 'button', 'a'].includes(first.type)) {
            return 'jsx-3d';
          }
        }
      } 
      // Si c'est un objet (probablement full-3d)
      else if (typeof data === 'object') {
        const full3dKeys = ['scene', 'camera', 'interaction', 'scroll', 'lights'];
        if (full3dKeys.some(key => data[key] !== undefined)) {
          return 'full-3d';
        }
      }
    }
  } catch (e) {
    console.error('Erreur détection type:', e);
  }
  
  return 'experience-3d'; // Changé par défaut
}

// ----------- Création / MAJ de l'export ----------- //
router.post('/createOrUpdate', async (req, res) => {
  const { projetId, username } = req.body;

  if (!projetId || !username) {
    return res.status(400).json({ message: 'projetId et username obligatoires' });
  }

  try {
    const projet = await Projet.findById(projetId);
    if (!projet) return res.status(404).json({ message: 'Projet non trouvé' });

    let exportDoc = await Export.findOne({ projet: projetId });

    if (!exportDoc) {
      // Générer une clé unique
      let exportKey;
      let isUnique = false;
      while (!isUnique) {
        exportKey = generateExportKey(username, projet.name);
        const exists = await Export.findOne({ exportKey });
        if (!exists) isUnique = true;
      }

      exportDoc = new Export({ 
        projet: projetId, 
        exportKey,
        // Nouveaux champs pour la gestion des vues
        viewCount: 0,
        viewHistory: [],
        lastViewed: null
      });
    }

    exportDoc.updatedAt = Date.now();
    // Mettre à jour le type de projet si disponible
    if (projet.projectType) {
      exportDoc.projectType = projet.projectType;
    }
    await exportDoc.save();

    // ❌ Supprimer du cache RAM s'il existait (commenté)
    // delete exportCache[`export:${exportDoc.exportKey}`];

    res.status(200).json({ 
      message: 'Export créé/mis à jour', 
      exportKey: exportDoc.exportKey,
      // Nouveau champ retourné
      projectType: projet.projectType || detectProjectType(projet.code)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur lors de la création export' });
  }
});

// ----------- Accès à l'export (rendu JSON) ----------- //
router.get('/:exportKey', async (req, res) => {
  const { exportKey } = req.params;

  // Ancienne logique de cache RAM (commentée)
  // const cacheKey = `export:${exportKey}`;
  // const now = Date.now();
  
  // 1. Vérifier le cache RAM (commenté)
  // const cached = exportCache[cacheKey];
  // if (cached && cached.expire > now) {
  //   console.log('⚡️ Export RAM cache hit (JSON)');
  //   return res.status(200).json(cached.data);
  // }

  try {
    // 🐢 DB lookup (toujours depuis la base de données)
    const exportDoc = await Export.findOne({ exportKey }).populate('projet');
    if (!exportDoc) return res.status(404).json({ message: 'Export non trouvé' });

    const projet = exportDoc.projet;

    let data;
    try {
      data = JSON.parse(projet.code);
    } catch {
      data = projet.code;
    }

    // Nouvelle logique avec gestion des vues
    // Incrémenter le compteur de vues
    exportDoc.viewCount += 1;
    exportDoc.lastViewed = new Date();
    
    // Gestion de l'historique des vues par mois
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    let previousMonth;
    
    if (currentDate.getMonth() === 0) {
      // Si janvier, mois précédent est décembre de l'année précédente
      previousMonth = `${currentDate.getFullYear() - 1}-12`;
    } else {
      previousMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth()).padStart(2, '0')}`;
    }
    
    // Mettre à jour l'historique
    let viewHistory = exportDoc.viewHistory || [];
    const monthIndex = viewHistory.findIndex(item => item.month === currentMonth);
    
    if (monthIndex >= 0) {
      viewHistory[monthIndex].count += 1;
    } else {
      viewHistory.push({ month: currentMonth, count: 1 });
    }
    
    // Garder uniquement les 2 derniers mois
    viewHistory = viewHistory.filter(item => 
      item.month === currentMonth || item.month === previousMonth
    );
    
    exportDoc.viewHistory = viewHistory;
    await exportDoc.save();
    
    // Détection du type de projet
    const projectType = projet.projectType || detectProjectType(data);
    
    // Structure de réponse enrichie
    const response = {
      exportKey,
      projectType,
      projetId: projet._id,
      projetName: projet.name,
      projetDescription: projet.description || '',
      createdAt: exportDoc.createdAt,
      updatedAt: exportDoc.updatedAt,
      lastViewed: exportDoc.lastViewed,
      viewCount: exportDoc.viewCount,
      viewStats: {
        currentMonth: viewHistory.find(item => item.month === currentMonth)?.count || 0,
        previousMonth: viewHistory.find(item => item.month === previousMonth)?.count || 0,
        total: exportDoc.viewCount
      },
      data: data
    };
    
    // Compatibilité avec l'ancien système
    if (projectType === 'jsx-3d') {
      response.components = data;
    } else if (projectType === 'full-3d') {
      response.scene = data;
    } else if (projectType === 'experience-3d') {
      response.site = data;
    }
    
    // Ancienne logique de cache RAM (commentée)
    // exportCache[cacheKey] = {
    //   data: response,
    //   expire: now + 90 * 1000, // 90s en millisecondes
    // };

    console.log('✅ Export JSON généré depuis MongoDB');

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération export' });
  }
});

// ----------- Ancienne logique HTML (commentée) ----------- //
//   const cacheKey = `export:${exportKey}`;
//   const now = Date.now();

//   try {
//     // ⚡️ 1. RAM CACHE : existe et pas expiré
//     const cached = exportCache[cacheKey];
//     if (cached && cached.expire > now) {
//       console.log('⚡️ Export RAM cache hit');
//       return res.status(200).send(cached.html);
//     }

//     // 🐢 2. Sinon, DB lookup
//     const exportDoc = await Export.findOne({ exportKey }).populate('projet');
//     if (!exportDoc) return res.status(404).send('Export non trouvé');

//     const projet = exportDoc.projet;

//     const exportHTML = `
//       <!DOCTYPE html>
//       <html>
//         <head><title>Export Projet - ${projet.name}</title></head>
//         <body>
//           <h1>${projet.name}</h1>
//           <p>${projet.description}</p>
//           <pre>${JSON.stringify(projet.code, null, 2)}</pre>
//         </body>
//       </html>
//     `;

//     // ⏱️ 3. Stockage dans le cache RAM pour 90 secondes
//     exportCache[cacheKey] = {
//       html: exportHTML,
//       expire: now + 90 * 1000, // 90s en millisecondes
//     };

//     console.log('✅ Export généré depuis MongoDB');

//     res.status(200).send(exportHTML);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Erreur serveur lors de la récupération export');
//   }
// });

// ----------- Route pour les statistiques ----------- //
router.get('/:exportKey/stats', async (req, res) => {
  const { exportKey } = req.params;

  try {
    const exportDoc = await Export.findOne({ exportKey });
    if (!exportDoc) return res.status(404).json({ message: 'Export non trouvé' });

    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    let previousMonth;
    
    if (currentDate.getMonth() === 0) {
      previousMonth = `${currentDate.getFullYear() - 1}-12`;
    } else {
      previousMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth()).padStart(2, '0')}`;
    }

    res.status(200).json({
      exportKey,
      viewCount: exportDoc.viewCount,
      lastViewed: exportDoc.lastViewed,
      viewHistory: exportDoc.viewHistory,
      recentStats: {
        currentMonth: exportDoc.viewHistory.find(item => item.month === currentMonth)?.count || 0,
        previousMonth: exportDoc.viewHistory.find(item => item.month === previousMonth)?.count || 0,
        total: exportDoc.viewCount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des stats' });
  }
});

module.exports = router;