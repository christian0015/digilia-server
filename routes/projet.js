const express = require('express');
const { createProject, getUserProjects, updateProjectName, deleteProject } = require('../controllers/projectController');
const router = express.Router();

// Routes pour les projets
router.post('/createProject', createProject);
router.get('/getUserProjects', getUserProjects);
router.post('/updateProjectName/:projectId', updateProjectName);
router.post('/deleteProject/:projectId', deleteProject);

module.exports = router;
