const express = require('express');
const router = express.Router();
const { analizarIncidente, calcularRuta, analisisPorPoligono } = require('../controllers/analisisController');

router.post('/incidente', analizarIncidente);
router.post('/ruta', calcularRuta); 
router.post('/poligono', analisisPorPoligono);

module.exports = router;