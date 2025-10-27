const express = require('express');
const router = express.Router();
const { getHospitalesCercanos, getTodosLosHospitales, updateHospital } = require('../controllers/hospitalesController');

router.get('/cercanos', getHospitalesCercanos);
router.get('/todos', getTodosLosHospitales); 
router.put('/:id', updateHospital);

module.exports = router;