const express = require('express');
const router = express.Router();
const { getLocalidadesConteo } = require('../controllers/localidadesController');

// Ruta para obtener las localidades con el conteo de hospitales
router.get('/conteo-hospitales', getLocalidadesConteo);

module.exports = router;