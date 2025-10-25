require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const lineasRoutes = require('./routes/lineas');
const barriosRoutes = require('./routes/barrios');
const poligonosRoutes = require('./routes/poligonosRoutes');
const hospitalesRoutes = require('./routes/hospitalesRoutes');
const localidadesRoutes = require('./routes/localidadesRoutes');
const analisisRouters = require('./routes/analisisRoutes');
const incidentesRoutes = require('./routes/incidentesRoutes');

// rutas 
app.use('/api/lineas', lineasRoutes);
app.use('/api/barrios', barriosRoutes);
app.use('/api/poligonos', poligonosRoutes);
app.use('/api/hospitales', hospitalesRoutes);
app.use('/api/localidades', localidadesRoutes);
app.use('/api/analisis', analisisRouters); 
app.use('/api', incidentesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
});
