const express = require('express');
const router = express.Router();
const { analizarIncidente, calcularRuta } = require('../controllers/analisisController');

router.post('/incidente', analizarIncidente);
router.post('/ruta', calcularRuta); 

module.exports = router;