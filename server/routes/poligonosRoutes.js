const express = require('express');
const router = express.Router();
const poligonosController = require('../controllers/poligonosController');

router.get('/', poligonosController.getPoligonos);
router.post('/', poligonosController.createPoligono);
router.put('/:id', poligonosController.updatePoligono);
router.delete('/:id', poligonosController.deletePoligono);

module.exports = router;
