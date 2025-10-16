const pool = require('../config/db');

function rowsToGeoJSON(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map(r => ({
      type: "Feature",
      properties: {
        id: r.id,
        nombre: r.nombre,
        barrio: r.barrio,
        descripcion: r.descripcion
      },
      geometry: JSON.parse(r.geojson)
    }))
  };
}

exports.getPoligonos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, barrio, descripcion, ST_AsGeoJSON(geom) as geojson FROM poligonos`
    );
    res.json(rowsToGeoJSON(result.rows));
  } catch (err) {
    console.error('Error en getPoligonos:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createPoligono = async (req, res) => {
  try {
    const feature = req.body;
    const props = feature.properties || {};
    const nombre = props.nombre || 'sin_nombre';
    const barrio = props.barrio || null;
    const descripcion = props.descripcion || null;
    const geom = JSON.stringify(feature.geometry);

    const q = `
      INSERT INTO poligonos (nombre, barrio, descripcion, geom)
      VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
      RETURNING id
    `;
    const result = await pool.query(q, [nombre, barrio, descripcion, geom]);
    res.json({ status: 'ok', id: result.rows[0].id });
  } catch (err) {
    console.error('Error en createPoligono:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updatePoligono = async (req, res) => {
  try {
    const id = req.params.id;
    const feature = req.body;
    const props = feature.properties || {};
    const geom = JSON.stringify(feature.geometry);

    const q = `
      UPDATE poligonos
      SET nombre = COALESCE($1, nombre),
          barrio = COALESCE($2, barrio),
          descripcion = COALESCE($3, descripcion),
          geom = ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)
      WHERE id = $5
    `;
    await pool.query(q, [props.nombre, props.barrio, props.descripcion, geom, id]);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error en updatePoligono:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deletePoligono = async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query('DELETE FROM poligonos WHERE id = $1', [id]);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error en deletePoligono:', err);
    res.status(500).json({ error: err.message });
  }
};
