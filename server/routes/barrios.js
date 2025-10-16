const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 🔹 Obtener TODOS los barrios
router.get('/all', async (req, res) => {
  try {
    const q = `
      SELECT 
        gid, 
        nombre, 
        shape_area, 
        shape_leng,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geojson
      FROM barrios
    `;
    const result = await pool.query(q);

    const featureCollection = {
      type: "FeatureCollection",
      features: result.rows.map(r => ({
        type: "Feature",
        geometry: JSON.parse(r.geojson),
        properties: {
          id: r.gid,
          nombre: r.nombre,
          shape_area: Number(r.shape_area) || 0,
          shape_leng: Number(r.shape_leng) || 0
        }
      }))
    };

    res.json(featureCollection);
  } catch (err) {
    console.error('Error en /api/barrios/all →', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Ruta para obtener varios barrios (?names=)
router.get('/', async (req, res) => {
  try {
    const namesParam = req.query.names;

    if (!namesParam) {
      return res.status(400).json({
        error: 'Debe proporcionar uno o más nombres de barrios en el parámetro "names"'
      });
    }

    const nombres = namesParam.split(',').map(n => n.trim().toUpperCase());
    const q = `
      SELECT 
        gid, 
        nombre, 
        shape_area, 
        shape_leng,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geojson
      FROM barrios
      WHERE TRIM(UPPER(nombre)) = ANY($1)
    `;
    const result = await pool.query(q, [nombres]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'No se encontraron barrios' });

    const featureCollection = {
      type: "FeatureCollection",
      features: result.rows.map(r => ({
        type: "Feature",
        geometry: JSON.parse(r.geojson),
        properties: {
          id: r.gid,
          nombre: r.nombre,
          shape_area: Number(r.shape_area) || 0,
          shape_leng: Number(r.shape_leng) || 0
        }
      }))
    };

    res.json(featureCollection);
  } catch (err) {
    console.error('Error en /api/barrios →', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Ruta para obtener un solo barrio
router.get('/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const q = `
      SELECT 
        gid, 
        nombre, 
        shape_area, 
        shape_leng,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geojson
      FROM barrios
      WHERE TRIM(UPPER(nombre)) = TRIM(UPPER($1))
    `;
    const result = await pool.query(q, [nombre]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Barrio no encontrado' });

    const featureCollection = {
      type: "FeatureCollection",
      features: result.rows.map(r => ({
        type: "Feature",
        geometry: JSON.parse(r.geojson),
        properties: {
          id: r.gid,
          nombre: r.nombre,
          shape_area: Number(r.shape_area) || 0,
          shape_leng: Number(r.shape_leng) || 0
        }
      }))
    };

    res.json(featureCollection);
  } catch (err) {
    console.error('Error en /api/barrios/:nombre →', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
