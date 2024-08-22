// const express = require('express');
// const { login, register, update, delete: deleteUser } = require('../controllers/authController');
// const router = express.Router();

// router.post('/login', login);
// router.post('/register', register);
// router.post('/update', update);
// router.post('/delete', deleteUser);

// module.exports = router;
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);

module.exports = router;
