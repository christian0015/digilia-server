const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware, gerantMiddleware } = require('../middleware/authMiddleware');

router.get('/', productController);
router.get('/getHistorique', productController);
router.post('/update-quantity', productController);

module.exports = router;


// router.get('/', authMiddleware, productController);
// router.get('/getSupply', authMiddleware, productController);
// router.post('/update-quantity', authMiddleware, gerantMiddleware, productController);
