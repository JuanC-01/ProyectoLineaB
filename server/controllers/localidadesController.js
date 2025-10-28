const pool = require('../config/db');

const getLocalidadesConteo = async (req, res) => {
    try {
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