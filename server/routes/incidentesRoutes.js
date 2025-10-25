const express = require('express');
const router = express.Router();
const { 
    registrarIncidente, 
    obtenerIncidentes, 
    obtenerIncidentePorId,
    eliminarIncidente,
    actualizarIncidente // ✅ Importación agregada
} = require('../controllers/incidentesController');

// CREATE - POST /api/incidentes/registrar
router.post('/incidentes/registrar', registrarIncidente);

// READ ALL - GET /api/incidentes
router.get('/incidentes', obtenerIncidentes);

// READ ONE - GET /api/incidentes/:id
router.get('/incidentes/:id', obtenerIncidentePorId);

// DELETE - DELETE /api/incidentes/:id
router.delete('/incidentes/:id', eliminarIncidente);

// UPDATE - PUT /api/incidentes/editar/:id
router.put('/incidentes/editar/:id', actualizarIncidente);

module.exports = router;
