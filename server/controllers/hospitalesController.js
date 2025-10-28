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
    console.log("--- updateHospital ---");
    console.log("req.body:", req.body);

    const { id, nombre, lat, lon } = req.body;

    try {
        let query;
        let params;
        let caseEntered = "None";

        if (nombre && lat !== undefined && lon !== undefined) {
            caseEntered = "Case 1: Name + Location";
            query = `
                UPDATE rasa
                SET rsoentadsc = $1,
                    geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)
                WHERE gid = $4
                RETURNING gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson;
            `;
            params = [nombre.trim(), lon, lat, id];
        }

        else if (nombre && (lat === undefined || lon === undefined)) {
            caseEntered = "Case 2: Name Only";
            query = `
                UPDATE rasa
                SET rsoentadsc = $1
                WHERE gid = $2
                RETURNING gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson;
            `;
            params = [nombre.trim(), id];
        }

        else if (!nombre && lat !== undefined && lon !== undefined) {
            caseEntered = "Case 3: Location Only";
            query = `
                UPDATE rasa
                SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)
                WHERE gid = $3
                RETURNING gid, rsoentadsc, dirsirep, nivel, njuridica, clprestado, ST_AsGeoJSON(geom) AS geojson;
            `;
            params = [lon, lat, id];
        }

        else {
            caseEntered = "Case 4: Invalid combination or no data";
        }

        console.log("Case Entered:", caseEntered);
        console.log("SQL Query:", query);
        console.log("Parameters:", params);

        if (!query || !params) {
            console.error("Query or Params not set correctly for Case:", caseEntered);
            return res.status(400).json({ error: "Datos de actualización inválidos." });
        }

        const result = await pool.query(query, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Hospital no encontrado." });
        }
        console.log("✅ Hospital actualizado correctamente:", result.rows[0]);
        return res.status(200).json({
            msg: "Hospital actualizado correctamente.",
            hospital: result.rows[0],
        });

    } catch (err) {
        console.error("!!! DATABASE ERROR in updateHospital:", err);
        console.error("Failed Query:", query);
        console.error("Failed Params:", params);
        res.status(500).json({ error: "Error interno del servidor al actualizar el hospital." });
    }
};


const deleteHospital = async (req, res) => {
    const { id } = req.params;

    console.log(`--- deleteHospital --- Intentando eliminar hospital con gid: ${id}`); 

    if (!id || isNaN(parseInt(id))) { 
        return res.status(400).json({ error: "El ID del hospital es inválido." });
    }
    try {
        const query = `
            DELETE FROM rasa
            WHERE gid = $1
            RETURNING gid; -- Devuelve el ID si se eliminó algo
        `;
        const params = [parseInt(id)]; 
        console.log("SQL Query:", query);
        console.log("Parameters:", params);

        const result = await pool.query(query, params);
        if (result.rowCount === 0) {
            console.log(`Hospital con gid ${id} no encontrado.`);
            return res.status(404).json({ error: "Hospital no encontrado." });
        }

        console.log(` Hospital con gid ${id} eliminado correctamente.`);
        res.status(200).json({ msg: `Hospital #${id} eliminado correctamente.` }); 

    } catch (err) {
        console.error("!!! DATABASE ERROR in deleteHospital:", err);
        res.status(500).json({ error: "Error interno del servidor al eliminar el hospital." });
    }
};

module.exports = {
    getHospitalesCercanos,
    getTodosLosHospitales,
    updateHospital,
    deleteHospital 
};

