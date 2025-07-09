const express = require('express');
const router = express.Router();
const Projet = require('../models/Projet');
const Export = require('../models/Export');

// ----------- ⚡️ RAM Cache simple ----------- //
const exportCache = {}; // Objet JavaScript (clé: exportKey, valeur: { html, expire })

// ----------- Utilitaire clé d'export ----------- //
function generateExportKey(username, projetName) {
  const random4Digits = Math.floor(1000 + Math.random() * 9000);
  const cleanUsername = username.replace(/\s+/g, '').toLowerCase();
  const cleanProjetName = projetName.replace(/\s+/g, '').toLowerCase();
  return `${cleanUsername}${cleanProjetName}${random4Digits}`;
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

      exportDoc = new Export({ projet: projetId, exportKey });
    }

    exportDoc.updatedAt = Date.now();
    await exportDoc.save();

    // ❌ Supprimer du cache RAM s’il existait
    delete exportCache[`export:${exportDoc.exportKey}`];

    res.status(200).json({ message: 'Export créé/mis à jour', exportKey: exportDoc.exportKey });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur lors de la création export' });
  }
});

// ----------- Accès à l'export (rendu HTML, cache 90s) ----------- //
router.get('/:exportKey', async (req, res) => {
  const { exportKey } = req.params;


  try {
    const exportDoc = await Export.findOne({ exportKey }).populate('projet');
    if (!exportDoc) return res.status(404).json({ message: 'Export non trouvé' });

    const projet = exportDoc.projet;

    let components;
    try {
      components = JSON.parse(projet.code);
    } catch {
      components = projet.code;
    }

    res.status(200).json(components);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération export' });
  }
});


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

module.exports = router;
