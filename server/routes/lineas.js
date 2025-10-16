const express = require('express');
const router = express.Router();
const lineasController = require('../controllers/lineasController');

router.get('/', lineasController.getLineas);
router.post('/', lineasController.createLinea);
router.put('/:id', lineasController.updateLinea);
router.delete('/:id', lineasController.deleteLinea);

module.exports = router;
