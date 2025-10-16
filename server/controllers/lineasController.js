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

exports.getLineas = async (req, res) => {
  try {
    const barrio = req.query.barrio;
    let q, params;
    if (barrio) {
      q = `SELECT id, nombre, barrio, descripcion, ST_AsGeoJSON(geom) as geojson FROM lineas WHERE barrio = $1`;
      params = [barrio];
    } else {
      q = `SELECT id, nombre, barrio, descripcion, ST_AsGeoJSON(geom) as geojson FROM lineas`;
      params = [];
    }
    const result = await pool.query(q, params);
    res.json(rowsToGeoJSON(result.rows));
  } catch (err) {
    console.error('Error en getLineas:', err);
    res.status(500).json({ error: err.message });
  }
};


exports.createLinea = async (req, res) => {
  try {
    const feature = req.body;
    const props = feature.properties || {};
    const nombre = props.nombre || 'sin_nombre';
    const barrio = props.barrio || null;
    const descripcion = props.descripcion || null;
    const geom = JSON.stringify(feature.geometry);

    const q = `
      INSERT INTO lineas (nombre, barrio, descripcion, geom)
      VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
      RETURNING id
    `;
    const result = await pool.query(q, [nombre, barrio, descripcion, geom]);
    res.json({ status: 'ok', id: result.rows[0].id });
  } catch (err) {
    console.error('Error en createLinea:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateLinea = async (req, res) => {
  try {
    const id = req.params.id;
    const feature = req.body;
    const props = feature.properties || {};
    const geom = JSON.stringify(feature.geometry);

    const q = `
      UPDATE lineas
      SET nombre = COALESCE($1, nombre),
          barrio = COALESCE($2, barrio),
          descripcion = COALESCE($3, descripcion),
          geom = ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)
      WHERE id = $5
    `;
    await pool.query(q, [props.nombre, props.barrio, props.descripcion, geom, id]);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error en updateLinea:', err);
    res.status(500).json({ error: err.message });
  }
};


exports.deleteLinea = async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query('DELETE FROM lineas WHERE id = $1', [id]);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error en deleteLinea:', err);
    res.status(500).json({ error: err.message });
  }
};
