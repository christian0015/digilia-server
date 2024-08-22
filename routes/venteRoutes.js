const express = require('express');
const router = express.Router();
const venteController = require('../controllers/venteController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', venteController);
router.get('/', venteController);

module.exports = router;


// router.post('/', authMiddleware, saleController);
// router.get('/', authMiddleware, saleController);
// module.exports = router;
