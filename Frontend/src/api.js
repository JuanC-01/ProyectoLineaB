const API_URL = 'http://localhost:5000/api';

// Carga TODOS los hospitales para el clustering y el buscador
export const fetchTodosLosHospitales = async () => {
    const url = `${API_URL}/hospitales/todos`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al obtener todos los hospitales');
        return await response.json();
    } catch (error) {
        console.error(error.message);
        alert("No se pudieron cargar los hospitales.");
        return null;
    }
};

// Obtiene el conteo de hospitales por localidad para el mapa de coropletas
export const fetchLocalidadesConConteo = async () => {
    const url = `${API_URL}/localidades/conteo-hospitales`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al obtener las localidades');
        return await response.json();
    } catch (error) {
        console.error(error.message);
        return null;
    }
};

// Carga las geometrías de las localidades para el buscador
export const fetchLocalidadesParaBusqueda = async () => {
    const wfsUrl = `http://136.112.122.118:8080/geoserver/hospitales_bogota/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=hospitales_bogota%3Alocalidades&outputFormat=application%2Fjson`;
    try {
        const response = await fetch(wfsUrl);
        if (!response.ok) throw new Error('Error al obtener localidades para búsqueda');
        return await response.json();
    } catch (error) {
        console.error(error.message);
        return null;
    }
};

// Llama al servicio de análisis de incidente para obtener hospitales en un buffer
export const fetchAnalisisIncidente = async (lat, lon, distancia) => {
    const url = `${API_URL}/analisis/incidente`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon, distancia })
        });
        if (!response.ok) throw new Error('Error en el análisis de incidente');
        return await response.json();
    } catch (error) {
        console.error(error.message);
        return null;
    }
};

// Calcula la ruta óptima entre dos puntos
export const fetchRutaOptima = async (coords) => {
    const url = `${API_URL}/analisis/ruta`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(coords)
        });
        if (!response.ok) throw new Error('Error al calcular la ruta');
        return await response.json();
    } catch (error) {
        console.error(error.message);
        return null;
    }
};