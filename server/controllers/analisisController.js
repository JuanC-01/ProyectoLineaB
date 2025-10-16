const pool = require('../config/db');

// Función que busca hospitales en el buffer y calcula su distancia
const analizarIncidente = async (req, res) => {
    try {
        const { lat, lon, distancia } = req.body;

        // CONSULTA REFORZADA: Asegura la transformación de coordenadas explícitamente
        const hospitalesQuery = `
            WITH buffer AS (
                SELECT ST_Buffer(
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                    $3
                )::geometry AS geom
            )
            SELECT
                r.gid, r.rsoentadsc, r.dirsirep, r.nivel, r.njuridica,
                ST_AsGeoJSON(r.geom) AS geojson,
                ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distancia_metros
            FROM
                rasa r, buffer b
            WHERE
                ST_Intersects(r.geom, b.geom)
            ORDER BY
                distancia_metros;
        `;
        const result = await pool.query(hospitalesQuery, [lon, lat, distancia]);
        
        const hospitales = result.rows.map(row => ({
            type: "Feature",
            properties: {
                gid: row.gid, nombre: row.rsoentadsc, direccion: row.dirsirep, nivel: row.nivel, tipo: row.njuridica,
                distancia: Math.round(row.distancia_metros)
            },
            geometry: JSON.parse(row.geojson)
        }));

        res.json({ hospitalesEnBuffer: hospitales });

    } catch (error) {
        console.error("--- ERROR DETALLADO EN analizarIncidente ---");
        console.error("Mensaje:", error.message);
        console.error("-----------------------------------------");
        res.status(500).send("Error en el servidor al analizar el incidente.");
    }
};

// Esta es la función que calcula la ruta
const calcularRuta = async (req, res) => {
    try {
        const { lat_inicio, lon_inicio, lat_fin, lon_fin } = req.body;

        const rutaQuery = `
            WITH
            start_node AS (
                SELECT id FROM malla_vial_integral_bogota_d_c_vertices_pgr
                ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1
            ),
            end_node AS (
                SELECT id FROM malla_vial_integral_bogota_d_c_vertices_pgr
                ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint($3, $4), 4326) LIMIT 1
            )
            SELECT ST_AsGeoJSON(ST_Collect(rt.geom)) AS route_geojson
            FROM pgr_dijkstra(
                /* --- ¡CORRECCIÓN AQUÍ! --- */
                'SELECT gid AS id, source, target, ST_Length(geom) AS cost FROM malla_vial_integral_bogota_d_c WHERE source IS NOT NULL AND target IS NOT NULL',
                /* --- FIN DE LA CORRECCIÓN --- */
                (SELECT id FROM start_node),
                (SELECT id FROM end_node),
                false
            ) AS di
            JOIN malla_vial_integral_bogota_d_c AS rt ON di.edge = rt.gid;
        `;
        const rutaResult = await pool.query(rutaQuery, [lon_inicio, lat_inicio, lon_fin, lat_fin]);

        const rutaGeoJSON = rutaResult.rows[0] && rutaResult.rows[0].route_geojson ? JSON.parse(rutaResult.rows[0].route_geojson) : null;
        const ruta = rutaGeoJSON ? { type: "Feature", properties: {}, geometry: rutaGeoJSON } : null;

        res.json({ ruta });

    } catch (error) {
        console.error("--- ERROR DETALLADO EN calcularRuta ---");
        console.error("Mensaje:", error.message);
        console.error("Pila de errores:", error.stack);
        console.error("---------------------------------------");
        res.status(500).send("Error en el servidor al calcular la ruta.");
    }
};

module.exports = { analizarIncidente, calcularRuta };