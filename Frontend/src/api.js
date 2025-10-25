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
    const wfsUrl = `http://redes2.online:8080/geoserver/hospitales_bogota/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=hospitales_bogota%3Alocalidades&outputFormat=application%2Fjson`;
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

export const registrarNuevoIncidente = async (data) => {
    const url = `${API_URL}/incidentes/registrar`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        // Manejo mejorado para errores 4xx/5xx: leer el mensaje del servidor si es posible
        if (!response.ok) {
            let errorMsg = 'Error al registrar el incidente: Error desconocido.';
            try {
                // Intenta leer el cuerpo del error como JSON para obtener el mensaje del backend
                const errorData = await response.json();
                errorMsg = errorData.msg || errorData.error || errorMsg; // Asume que el backend usa 'msg' o 'error'
            } catch (jsonError) {
                // Si la respuesta no es JSON (ej. un 500 puro), usar el estado HTTP
                errorMsg = `Error HTTP ${response.status}: ${response.statusText}`;
            }
            // Retorna un objeto con la propiedad 'error' en lugar de lanzar una excepción o devolver null
            return { error: errorMsg };
        }

        return await response.json();
    } catch (networkError) {
        // Captura errores de red (ej. servidor apagado o CORS)
        console.error("Error de red al registrar incidente:", networkError.message);
        return { error: 'Error de conexión: El servidor no está disponible o hay un problema de red.' };
    }
};
// Obtiene todos los incidentes registrados
export const fetchObtenerIncidentes = async () => {
    // 🚨 ASUME que el router en el backend ahora es '/incidentes' o '/incidentes/todos'
    // Basado en el error anterior, cambiaremos el endpoint al que usa el router.js: /incidentes
    const url = `${API_URL}/incidentes`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al obtener la lista de incidentes');
        return await response.json();
    } catch (error) {
        console.error("Error de red al obtener incidentes:", error.message);
        return { error: 'Error de conexión: No se pudieron cargar los reportes.' };
    }
};

// Elimina un incidente por ID
export const fetchEliminarIncidente = async (id) => {
    const url = `${API_URL}/incidentes/${id}`; // ✅ sin 'eliminar'
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
            method: 'PUT', // Usamos PUT para actualizar
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
