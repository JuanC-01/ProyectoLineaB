const pool = require('../config/db'); 

const registrarIncidente = async (req, res) => {
  const {
    nombre_accidentado,
    usuario_registro,
    lat,
    lng,
    hospital_destino,
    distancia_km,
    tiempo_min
  } = req.body;

  if (!nombre_accidentado || !usuario_registro || !lat || !lng || !hospital_destino) {
    return res.status(400).json({ msg: 'Faltan campos obligatorios para registrar el incidente.' });
  }

  try {
    const sql = `
      INSERT INTO public.incidentes (
        nombre_accidentado,
        usuario_registro,
        punto_incidente,
        hospital_destino,
        distancia_km,
        tiempo_min
      )
      VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326),
        $5,
        $6,
        $7
      )
      RETURNING id, fecha_incidente;
    `;

    const result = await pool.query(sql, [
      nombre_accidentado,
      usuario_registro,
      lng, 
      lat,
      hospital_destino,
      distancia_km,
      tiempo_min
    ]);

    res.status(201).json({
      msg: 'Incidente registrado con éxito.',
      incidente_id: result.rows[0].id,
      fecha_registro: result.rows[0].fecha_incidente
    });

  } catch (error) {
    console.error('Error al registrar incidente:', error);
    res.status(500).json({
      error: `Error interno del servidor al registrar el incidente. Detalle: ${error.message}`
    });
  }
};

const obtenerIncidentes = async (req, res) => {
  const { fecha } = req.query;
  try {
    let params = [];
    let whereClause = '';

    if (fecha) {
      params.push(fecha);
      whereClause = `WHERE DATE(fecha_incidente) = TO_DATE($1, 'YYYY-MM-DD')`;
    }

    const sql = `
      SELECT 
        id, nombre_accidentado, usuario_registro, fecha_incidente, 
        hospital_destino, distancia_km, tiempo_min,
        ST_AsGeoJSON(punto_incidente) AS punto_geojson
      FROM public.incidentes
      ${whereClause}
      ORDER BY fecha_incidente DESC;
    `;

    const result = await pool.query(sql, params);

    const incidentesFormateados = result.rows.map(row => ({
      ...row,
      punto_geojson: JSON.parse(row.punto_geojson),
      ruta_geojson: null,
      fecha_incidente: row.fecha_incidente
        ? new Date(row.fecha_incidente).toLocaleString('es-CO')
        : 'N/A'
    }));

    res.json(incidentesFormateados);
  } catch (error) {
    console.error('Error al obtener incidentes:', error);
    res.status(500).json({ error: 'Error al obtener el listado de incidentes.' });
  }
};


const obtenerIncidentePorId = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        id, nombre_accidentado, usuario_registro, fecha_incidente, 
        hospital_destino, distancia_km, tiempo_min,
        ST_AsGeoJSON(punto_incidente) AS punto_geojson
      FROM public.incidentes
      WHERE id = $1;
    `;
    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Incidente no encontrado.' });
    }

    const row = result.rows[0];
    const incidente = {
      ...row,
      punto_geojson: JSON.parse(row.punto_geojson),
      ruta_geojson: null,
      fecha_incidente: row.fecha_incidente.toLocaleString()
    };

    res.json(incidente);
  } catch (error) {
    console.error('Error al obtener incidente por ID:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};


const eliminarIncidente = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `DELETE FROM public.incidentes WHERE id = $1 RETURNING id;`;
    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Incidente no encontrado para eliminar.' });
    }

    res.json({ msg: `Incidente con ID ${id} eliminado con éxito.` });
  } catch (error) {
    console.error('Error al eliminar incidente:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar.' });
  }
};

const actualizarIncidente = async (req, res) => {
    const { id } = req.params;
    const { nombre_accidentado, usuario_registro } = req.body;

    if (!nombre_accidentado || !usuario_registro) {
        return res.status(400).json({ msg: 'Faltan campos obligatorios para la actualización: nombre_accidentado y usuario_registro.' });
    }

    try {
        const sql = `
            UPDATE public.incidentes
            SET 
                nombre_accidentado = $1,
                usuario_registro = $2
            WHERE id = $3
            RETURNING id, nombre_accidentado, usuario_registro;
        `;

        const result = await pool.query(sql, [nombre_accidentado, usuario_registro, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ msg: 'Incidente no encontrado para actualizar.' });
        }

        res.json({ 
            msg: `Incidente #${id} actualizado con éxito.`, 
            incidente_id: result.rows[0].id,
            nombre_accidentado: result.rows[0].nombre_accidentado,
            usuario_registro: result.rows[0].usuario_registro
        });

    } catch (error) {
        console.error('Error al actualizar incidente:', error);
        res.status(500).json({ error: `Error interno del servidor al actualizar el incidente. Detalle: ${error.message}` });
    }
};

module.exports = {
    registrarIncidente,
    obtenerIncidentes,
    obtenerIncidentePorId,
    eliminarIncidente,
    actualizarIncidente 
};