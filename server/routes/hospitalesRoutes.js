const express = require('express');
const router = express.Router();
const { getHospitalesCercanos, getTodosLosHospitales, updateHospital, deleteHospital } = require('../controllers/hospitalesController');

router.get('/cercanos', getHospitalesCercanos);
router.get('/todos', getTodosLosHospitales); 
router.put('/editar', updateHospital);
router.delete('/:id', deleteHospital);

module.exports = router;