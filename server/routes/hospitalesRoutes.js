const express = require('express');
const router = express.Router();
const { getHospitalesCercanos, getTodosLosHospitales } = require('../controllers/hospitalesController');

router.get('/cercanos', getHospitalesCercanos);
router.get('/todos', getTodosLosHospitales); 

module.exports = router;