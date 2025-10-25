const express = require('express');
const router = express.Router();
const { 
    registrarIncidente, 
    obtenerIncidentes, 
    obtenerIncidentePorId,
    eliminarIncidente,
    actualizarIncidente
} = require('../controllers/incidentesController');

router.post('/incidentes/registrar', registrarIncidente);

router.get('/incidentes', obtenerIncidentes);

router.get('/incidentes/:id', obtenerIncidentePorId);

router.delete('/incidentes/:id', eliminarIncidente);

router.put('/incidentes/editar/:id', actualizarIncidente);

module.exports = router;
