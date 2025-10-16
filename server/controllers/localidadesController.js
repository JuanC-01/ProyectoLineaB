const pool = require('../config/db');

const getLocalidadesConteo = async (req, res) => {
    try {
        // La consulta ahora no necesita devolver la geometría, solo el nombre y el conteo.
        const query = `
            SELECT
                l.locnombre AS nombre,
                COUNT(h.gid) AS hospital_count
            FROM
                loca AS l
            LEFT JOIN
                rasa AS h ON ST_Contains(l.geom, h.geom)
            GROUP BY
                l.locnombre;
        `;

        const result = await pool.query(query);
        
        // Devolvemos un array de objetos simple.
        const conteo = result.rows.map(row => ({
            nombre: row.nombre,
            hospital_count: parseInt(row.hospital_count, 10)
        }));

        res.json(conteo);
    } catch (error) {
        console.error("Error al obtener conteo de localidades:", error.message);
        res.status(500).send("Error en el servidor");
    }
};

module.exports = {
    getLocalidadesConteo,
};