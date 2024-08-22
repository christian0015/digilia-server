const express = require('express');
const { createProjet, getUserProjets, updateProjetName, deleteProjet } = require('../controllers/projetController');
const router = express.Router();

// Routes pour les projets
router.post('/createProjet', createProjet);
router.get('/getUserProjets', getUserProjets);
router.post('/updateProjetName/:projetId', updateProjetName);
router.post('/deleteProjet/:projetId', deleteProjet);

module.exports = router;
