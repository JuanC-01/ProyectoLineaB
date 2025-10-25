const API_URL = 'https://backend-os9w.onrender.com/api';

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
export const fetchLocalidadesParaBusqueda = async () => {
    const wfsUrl = `https://redes2.online/geoserver/hospitales_bogota/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=hospitales_bogota%3Alocalidades&outputFormat=application%2Fjson`;
    try {
        const response = await fetch(wfsUrl);
        if (!response.ok) throw new Error('Error al obtener localidades para búsqueda');
        return await response.json();
    } catch (error) {
        console.error(error.message);
        return null;
    }
};
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
export const registrarNuevoIncidente = async (data) => {
    const url = `${API_URL}/incidentes/registrar`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            let errorMsg = 'Error al registrar el incidente: Error desconocido.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.msg || errorData.error || errorMsg; 
            } catch (jsonError) {
                errorMsg = `Error HTTP ${response.status}: ${response.statusText}`;
            }
            return { error: errorMsg };
        }
        return await response.json();
    } catch (networkError) {
        console.error("Error de red al registrar incidente:", networkError.message);
        return { error: 'Error de conexión: El servidor no está disponible o hay un problema de red.' };
    }
};
export const fetchObtenerIncidentes = async (fecha = null) => {
    let url = `${API_URL}/incidentes`;
    if (fecha) {
        url += `?fecha=${fecha}`;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al obtener la lista de incidentes');
        return await response.json();
    } catch (error) {
        console.error("Error de red al obtener incidentes:", error.message);
        return { error: 'Error de conexión: No se pudieron cargar los reportes.' };
    }
};

export const fetchEliminarIncidente = async (id) => {
    const url = `${API_URL}/incidentes/${id}`; 
    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Error al eliminar el incidente.');
        }
        return await response.json();
    } catch (error) {
        console.error("Error al eliminar incidente:", error.message);
        return { error: error.message };
    }
};

export const fetchActualizarIncidente = async (id, data) => {
    const url = `${API_URL}/incidentes/editar/${id}`;
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Error al actualizar el incidente.');
        }
        return await response.json();
    } catch (error) {
        console.error("Error de red/API al actualizar incidente:", error.message);
        return { error: error.message };
    }
};
