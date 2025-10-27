const pool = require('../config/db');

const getHospitalesCercanos = async (req, res) => {
    try {
        const { lon, lat, distancia } = req.query;
        const query = `
            SELECT
                gid,
                rsoentadsc, 
                dirsirep,   
                nivel,      
                njuridica,
                ST_AsGeoJSON(geom) AS geojson
            FROM
                rasa -- Nombre de la tabla corregido
            WHERE
                ST_DWithin(
                    geom,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326),
                    $3
                );
        `;

        const result = await pool.query(query, [lon, lat, distancia]);

        const features = result.rows.map(row => {
            return {
                type: "Feature",
                properties: {
                    gid: row.gid,
                    nombre: row.rsoentadsc,
                    direccion: row.dirsirep,
                    nivel: row.nivel,
                    tipo: row.njuridica,
                },
                geometry: JSON.parse(row.geojson)
            };
        });

        res.json({ type: "FeatureCollection", features });

    } catch (error) {
        console.error("Error en getHospitalesCercanos:", error.message);
        res.status(500).send("Error en el servidor");
    }
};

const getTodosLosHospitales = async (req, res) => {
    try {
        const query = `
            SELECT gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson
            FROM rasa; -- Nombre de la tabla corregido
        `;
        const result = await pool.query(query);

        const features = result.rows.map(row => ({
            type: "Feature",
            properties: {
                gid: row.gid,
                nombre: row.rsoentadsc,
                direccion: row.dirsirep,
                nivel: row.nivel,
                tipo: row.njuridica,
                prestador: row.clprestado,
            },
            geometry: JSON.parse(row.geojson)
        }));

        res.json({ type: "FeatureCollection", features });
    } catch (error) {
        console.error("Error en getTodosLosHospitales:", error.message);
        res.status(500).send("Error en el servidor");
    }
};

const updateHospital = async (req, res) => {
    const { id, nombre, lat, lon } = req.body;

    if (!id) {
        return res.status(400).json({ message: "El ID del hospital es requerido." });
    }

    // Verifica que haya al menos un campo a actualizar
    if ((!nombre || nombre.trim() === '') && (lat === undefined || lon === undefined)) {
        return res.status(400).json({ message: "Debe enviar al menos un campo (nombre o coordenadas)." });
    }

    try {
        let query;
        let params;

        // --- Caso 1: editar nombre y ubicación ---
        if (nombre && lat !== undefined && lon !== undefined) {
            query = `
                UPDATE rasa
                SET rsoentadsc = $1,
                    geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)
                WHERE gid = $4
                RETURNING gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson;
            `;
            params = [nombre.trim(), lon, lat, id];
        }
        // --- Caso 2: solo editar nombre ---
        else if (nombre && (lat === undefined || lon === undefined)) {
            query = `
                UPDATE rasa
                SET rsoentadsc = $1
                WHERE gid = $2
                RETURNING gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson;
            `;
            params = [nombre.trim(), id];
        }
        // --- Caso 3: solo mover hospital (sin cambiar nombre) ---
        else if (!nombre && lat !== undefined && lon !== undefined) {
            query = `
                UPDATE rasa
                SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)
                WHERE gid = $3
                RETURNING gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson;
            `;
            params = [lon, lat, id];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Hospital no encontrado." });
        }

        const row = result.rows[0];
        const updatedFeature = {
            type: "Feature",
            properties: {
                gid: row.gid,
                id: row.gid,
                nombre: row.rsoentadsc,
                direccion: row.dirsirep,
                nivel: row.nivel,
                tipo: row.njuridica,
                prestador: row.clprestado
            },
            geometry: JSON.parse(row.geojson)
        };

        res.json(updatedFeature);
    } catch (err) {
        console.error("Error en updateHospital:", err.message);
        res.status(500).json({ message: "Error interno del servidor al actualizar el hospital." });
    }
};

module.exports = {
    getHospitalesCercanos,
    getTodosLosHospitales,
    updateHospital
};