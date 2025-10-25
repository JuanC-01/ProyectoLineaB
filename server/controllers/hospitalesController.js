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

module.exports = {
    getHospitalesCercanos,
    getTodosLosHospitales,
};