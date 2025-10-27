import L from 'leaflet';
import 'leaflet.heat';
import * as turf from '@turf/turf';
import { fetchTodosLosHospitales, fetchLocalidadesConConteo, fetchObtenerIncidentes, fetchActualizarIncidente, 
    fetchEliminarIncidente } from './api.js';
const resultadosLayer = L.featureGroup();
const rutaLayer = L.layerGroup();
let hospitalesClusterLayer;
let leyendaControl;

const hospitalIcon = L.icon({
    iconUrl: '/hospital.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const incidenteIcon = L.icon({
    iconUrl: '/accidente.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

function getColor(d) {
    return d > 17 ? '#800026' : d > 12 ? '#BD0026' : d > 8 ? '#E31A1C' :
        d > 7 ? '#FC4E2A' : d > 3 ? '#FD8D3C' : d > 0 ? '#FEB24C' : '#FFEDA0';
}
function estiloLocalidad(feature) {
    return {
        fillColor: getColor(feature.properties.hospital_count || 0),
        weight: 2, opacity: 1, color: 'white', dashArray: '3', fillOpacity: 0.7
    };
}

// --- NUEVA LÓGICA DE LEYENDA ---
const leyendaItems = {};
let baseMapActivo = 'Normal';
export const inicializarLeyenda = (map, baseMaps) => {
    if (leyendaControl) map.removeControl(leyendaControl);

    leyendaControl = L.control({ position: 'bottomright' });
    leyendaControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <h4>Leyenda</h4>
            <div id="leyenda-base"><strong>Mapa base:</strong> ${baseMapActivo}</div>
            <hr>
            <div id="leyenda-capas"><em>Activa capas para ver aquí</em></div>
        `;
        return div;
    };
    leyendaControl.addTo(map);
    map.on('baselayerchange', (e) => {
        baseMapActivo = e.name;
        actualizarLeyenda();
    });
    map.on('overlayadd', (e) => agregarItemLeyenda(e.name));
    map.on('overlayremove', (e) => quitarItemLeyenda(e.name));

    actualizarLeyenda();
};
export const actualizarLeyenda = () => {
    if (!leyendaControl) return;
    const div = leyendaControl.getContainer();
    if (!div) return;

    let content = `
        <h4>Leyenda</h4>
        <div id="leyenda-base"><strong>Mapa base:</strong> ${baseMapActivo}</div>
        <hr>
    `;

    let tieneItems = false;
    for (const key in leyendaItems) {
        if (leyendaItems[key]) {
            content += leyendaItems[key];
            tieneItems = true;
        }
    }

    content += tieneItems ? '' : '<div id="leyenda-capas"><em>Activa capas para ver aquí</em></div>';
    div.innerHTML = content;
};

export const agregarItemLeyenda = (nombreCapa) => {
    const geoserverBase = "http://redes2.online:8080/geoserver/wms";

    switch (nombreCapa) {
        case "Departamentos":
            leyendaItems[nombreCapa] = `
        <div class="leyenda-item">
          <img src="${geoserverBase}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=hospitales_bogota:dv_departamento" 
               alt="Leyenda Departamentos" width="40">
          <span>Departamentos</span>
        </div>`;
            break;

        case "Vías":
            leyendaItems[nombreCapa] = `
        <div class="leyenda-item">
          <img src="${geoserverBase}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=hospitales_bogota:malla_vial_integral_bogota_d_c" 
               alt="Leyenda Vías" width="40">
          <span>Vías</span>
        </div>`;
            break;

        case "Localidades":
            const grades = [0, 3, 7, 8, 12, 17];
            let labels = `<strong>Nº de Hospitales<br>en Localidades</strong>`;
            for (let i = 0; i < grades.length; i++) {
                labels += `<br><i style="background:${getColor(grades[i] + 1)}"></i> 
                   ${grades[i]}${grades[i + 1] ? `–${grades[i + 1]}` : '+'}`;
            }
            leyendaItems[nombreCapa] = labels;
            break;

        case "Hospitales":
            leyendaItems[nombreCapa] = `
        <div class="leyenda-item">
          <img src="/hospital.png" height="20" width="20"> Hospitales
        </div>`;
            break;
        case "Mapa de Calor":
            leyendaItems[nombreCapa] = `
        <div class="leyenda-item" style="line-height: 1.3;">
            <strong>Densidad de Incidentes</strong><br>
                <div class="heatmap-legend-gradient"></div>
                <span style="float: left; font-size: 11px;">Baja</span>
                <span style="float: right; font-size: 11px;">Alta</span>
        </div>`;
            break;
        case "Incidentes": // Asegúrate que este nombre coincida con el de tu control de capas
            leyendaItems[nombreCapa] = `
        <div class="leyenda-item">
            <img src="/accidente.png" height="20" width="20"> Incidentes
        </div>`;
            break;
    }
    actualizarLeyenda();
};

// Quita un ítem de la leyenda
export const quitarItemLeyenda = (nombreCapa) => {
    leyendaItems[nombreCapa] = null;
    actualizarLeyenda();
};

// --- CAPAS WMS ---
export const addDepartamentosLayer = (map) => {
    const geoserverUrl = 'https://redes2.online/geoserver/wms';
    const departamentosWMS = L.tileLayer.wms(geoserverUrl, {
        layers: 'hospitales_bogota:dv_departamento',
        format: 'image/png',
        transparent: true,
        version: '1.1.0',
        crs: L.CRS.EPSG4326
    });
    return departamentosWMS;
};

export const addViasLayer = (map) => {
    const geoserverUrl = 'https://redes2.online/geoserver/wms';
    const viasWMS = L.tileLayer.wms(geoserverUrl, {
        layers: 'hospitales_bogota:malla_vial_integral_bogota_d_c',
        format: 'image/png',
        transparent: true,
        version: '1.1.0',
        crs: L.CRS.EPSG4326
    });
    return viasWMS;
};

// --- LOCALIDADES ---
export const addLocalidadesLayer = async (map) => {
    const wfsUrl = `https://redes2.online/geoserver/hospitales_bogota/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=hospitales_bogota%3Alocalidades&outputFormat=application%2Fjson`;
    const [localidadesGeoJSON, conteoHospitales] = await Promise.all([
        fetch(wfsUrl).then(res => res.json()),
        fetchLocalidadesConConteo()
    ]);

    let localidadesLayer;
    if (localidadesGeoJSON && conteoHospitales) {
        const conteoMap = new Map(conteoHospitales.map(item => [item.nombre, item.hospital_count]));
        localidadesGeoJSON.features.forEach(feature => {
            const nombreLocalidad = feature.properties.locnombre;
            feature.properties.hospital_count = conteoMap.get(nombreLocalidad) || 0;
        });
        localidadesLayer = L.geoJSON(localidadesGeoJSON, {
            style: estiloLocalidad,
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`<b>${feature.properties.locnombre}</b><br>${feature.properties.hospital_count} hospitales`);
            }
        });
    }
    return localidadesLayer;
};

let modoEdicionActivo = false;

// --- HOSPITALES ---
export const addHospitalesClusterLayer = async (map) => {
    hospitalesClusterLayer = L.markerClusterGroup({
        iconCreateFunction: (cluster) => {
            const childCount = cluster.getChildCount();
            let cssClass = "";
            if (childCount < 10) cssClass = "hospital-cluster-small";
            else if (childCount < 100) cssClass = "hospital-cluster-medium";
            else cssClass = "hospital-cluster-large";

            return L.divIcon({
                html: `<div><span>${childCount}</span></div>`,
                className: `hospital-cluster ${cssClass}`,
                iconSize: L.point(40, 40),
            });
        },
    });

    const todosLosHospitales = await fetchTodosLosHospitales();

    if (todosLosHospitales) {
        const geoJsonLayer = L.geoJSON(todosLosHospitales, {
            pointToLayer: (feature, latlng) => {
                const marker = L.marker(latlng, { icon: hospitalIcon });
                marker.feature = feature; // Guardar propiedades
                return marker;
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popupContent = `
          <b>${props.nombre}</b><br>  
          <img src="/hospital.jpg" alt="Hospital" 
               style="width:100%; max-height:150px; object-fit:cover; margin-top:5px; border-radius: 4px;">
          <hr>
          <strong>Dirección:</strong> ${props.direccion || "No disponible"}<br>
          <strong>Nivel:</strong> ${props.nivel || "No disponible"}<br>
          <strong>Tipo:</strong> ${props.tipo || "No disponible"}<br>
          <strong>Prestador:</strong> ${props.prestador || "No disponible"}
          
        `;
                layer.bindPopup(popupContent);
            },
        });

        hospitalesClusterLayer.addLayer(geoJsonLayer);
    }

    map.addLayer(hospitalesClusterLayer);
    return hospitalesClusterLayer;
};

//Incidentes
export const addIncidentesClusterLayer = async (map) => {
    const incidentesClusterLayer = L.markerClusterGroup({

        // --- AÑADIDO: Estilos de clúster personalizados para incidentes ---
        iconCreateFunction: (cluster) => {
            const childCount = cluster.getChildCount();
            let cssClass = "";

            // Usamos nombres de clases diferentes a los de hospitales
            if (childCount < 10) cssClass = "incidente-cluster-small";
            else if (childCount < 100) cssClass = "incidente-cluster-medium";
            else cssClass = "incidente-cluster-large";

            return L.divIcon({
                html: `<div><span>${childCount}</span></div>`,
                className: `incidente-cluster ${cssClass}`, // Clase base 'incidente-cluster'
                iconSize: L.point(40, 40),
            });
        },
        // --- FIN DE LA ADICIÓN ---

    });
    const data = await fetchObtenerIncidentes();

    if (data && !data.error && Array.isArray(data)) {
        const incidentesFeatures = data
            .filter(incidente => incidente.punto_geojson && incidente.punto_geojson.coordinates)
            .map(incidente => {
                const coords = incidente.punto_geojson.coordinates;
                return {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: coords
                    },
                    properties: incidente
                };
            });
        const geoJsonLayer = L.geoJSON(incidentesFeatures, {
            pointToLayer: (feature, latlng) => {
                const marker = L.marker(latlng, { icon: incidenteIcon });
                marker.feature = feature;
                return marker;
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popupContent = `
                    <b style="font-size: 1.1em;">Incidente Registrado</b><br>
                    <strong>Accidentado:</strong> ${props.nombre_accidentado || "No disponible"}<br>
                    <strong>Fecha:</strong> ${props.fecha_incidente || "N/A"}<br>
                    <strong>Hospital Destino:</strong> ${props.hospital_destino || "No disponible"}<br> 
                    <div class="popup-actions">
                    <button class="btn-popup btn-editar-incidente" data-id="${props.id}">✏️ Editar</button>
                    <button class="btn-popup btn-eliminar-incidente" data-id="${props.id}">🗑️ Eliminar</button>
                </div>
                `;
                layer.bindPopup(popupContent);
            }
        });

        incidentesClusterLayer.addLayer(geoJsonLayer);
    }
    return incidentesClusterLayer;
};

// --- DIBUJAR RESULTADOS ---
export const dibujarResultados = (map, latlng, data) => {
    resultadosLayer.clearLayers();
    rutaLayer.clearLayers();
    if (map.hasLayer(hospitalesClusterLayer)) map.removeLayer(hospitalesClusterLayer);

    const markerIncidente = L.marker(latlng).bindPopup("📍 Punto del incidente");
    markerIncidente.addTo(resultadosLayer);

    if (data.hospitalesEnBuffer && data.hospitalesEnBuffer.length > 0) {
        const velocidadKmH = 40;
        const puntoIncidente = turf.point([latlng.lng, latlng.lat]);

        L.geoJSON(data.hospitalesEnBuffer, {
            pointToLayer: (feature, latlngHosp) => L.marker(latlngHosp, { icon: hospitalIcon }),
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;
                const puntoHospital = turf.point(coords);
                const distanciaKm = turf.distance(puntoIncidente, puntoHospital, { units: 'kilometers' });
                const tiempoMin = Math.round((distanciaKm / velocidadKmH) * 60);

                const popupContent = `
                    <b>${props.nombre}</b><br>
                    <strong>Dirección:</strong> ${props.direccion || 'No disponible'}<br>
                    <strong>Nivel:</strong> ${props.nivel || 'No disponible'}<br>
                    <strong>Tipo:</strong> ${props.tipo || 'No disponible'}<hr>
                    <strong>Distancia aprox.:</strong> ${distanciaKm.toFixed(2)} km<br>
                    <strong>Tiempo estimado:</strong> ${tiempoMin} min<br><br>
                   <button class="btn-ruta" 
                    data-lat="${coords[1]}" 
                    data-lon="${coords[0]}"
                    data-name="${props.nombre}">
                    🚗 Calcular ruta óptima
                    </button>
                `;

                layer.bindPopup(popupContent);
            }
        }).addTo(resultadosLayer);
    } else {
        L.popup()
            .setLatLng(latlng)
            .setContent("No se encontraron hospitales dentro del buffer.")
            .openOn(map);
    }

    resultadosLayer.addTo(map);
    if (resultadosLayer.getLayers().length > 0) {
        map.fitBounds(resultadosLayer.getBounds().pad(0.2));
    }
};

// --- DIBUJAR RUTA ---
export const dibujarRuta = (map, rutaGeoJSON) => {
    rutaLayer.clearLayers();
    if (rutaGeoJSON) {
        L.geoJSON(rutaGeoJSON, {
            style: { color: '#e31a1c', weight: 5, opacity: 0.85 }
        }).addTo(rutaLayer);
        rutaLayer.addTo(map);
    } else {
        alert('No se pudo calcular la ruta.');
    }
};

// --- CAPA DE MAPA DE CALOR (HEATMAP) ---
export const addHeatmapLayer = async () => {
    const heatLayer = L.heatLayer([], {
        radius: 35,
        blur: 25,
        maxZoom: 17,
        max: 0.5,
        gradient: { 0.4: 'yellow', 0.8: 'orange', 1.0: 'red' }
    });
    const poblarMapaDeCalor = async () => {
        const data = await fetchObtenerIncidentes();

        if (data && !data.error && Array.isArray(data)) {
            const heatPoints = data
                .filter(incidente => incidente.punto_geojson && incidente.punto_geojson.coordinates)
                .map(incidente => {
                    const coords = incidente.punto_geojson.coordinates;
                    return [coords[1], coords[0], 0.5];
                });
            heatLayer.setLatLngs(heatPoints);
        }
    };

    poblarMapaDeCalor();
    return heatLayer;
};


export const inicializarEventosPopup = (map, layerIncidentes) => {

    map.on('popupopen', (e) => {
        const marker = e.popup._source;
        if (!marker || !marker.feature || !layerIncidentes.hasLayer(marker)) {
            return; 
        }

        const popupNode = e.popup._container;
        if (!popupNode) return;

        // 1. Botón ELIMINAR (Corregido para usar api.js)
        const btnEliminar = popupNode.querySelector('.btn-eliminar-incidente');
        if (btnEliminar) {
            L.DomEvent.on(btnEliminar, 'click', async (evt) => {
                L.DomEvent.stop(evt); 
                const id = btnEliminar.dataset.id;
                if (!id) return;

                if (confirm(`¿Estás seguro de que deseas eliminar el incidente #${id}?`)) {
                    try {
                        // --- CAMBIO AQUÍ ---
                        // Usamos la función de api.js
                        const data = await fetchEliminarIncidente(id);

                        if (data && !data.error) {
                            alert(data.msg);
                            map.closePopup();
                            layerIncidentes.removeLayer(marker); 
                        } else {
                            alert(`Error: ${data.error || 'No se pudo eliminar'}`);
                        }
                    } catch (err) {
                        console.error('Error al eliminar:', err);
                        alert('Error de red al intentar eliminar.');
                    }
                }
            });
        }

        // 2. Botón EDITAR (Lógica sin cambios, pero la función helper SÍ cambia)
        const btnEditar = popupNode.querySelector('.btn-editar-incidente');
        if (btnEditar) {
            L.DomEvent.on(btnEditar, 'click', (evt) => {
                L.DomEvent.stop(evt);

                const id = btnEditar.dataset.id;
                const props = marker.feature.properties;

                const nuevoNombre = prompt("Nuevo nombre del accidentado:", props.nombre_accidentado);
                if (nuevoNombre === null) return; 

                if (nuevoNombre) {
                    _actualizarIncidente(id, nuevoNombre, props.usuario_registro, marker, e.popup);
                } else {
                    alert("El nombre es un campo requerido para editar.");
                }
            });
        }
    });
};

// --- FUNCIÓN HELPER (CORREGIDA) ---
async function _actualizarIncidente(id, nombre, usuario, marker, popup) {
    try {
        // --- CAMBIO AQUÍ ---
        // Preparamos los datos que la API espera
        const dataToUpdate = {
            nombre_accidentado: nombre,
            usuario_registro: usuario 
        };

        // Usamos la función de api.js que apunta a la URL CORRECTA (.../editar/:id)
        const data = await fetchActualizarIncidente(id, dataToUpdate);

        if (data && !data.error) {
            alert(data.msg); // Mensaje de éxito desde el backend

            // 1. Actualizar los datos en el 'feature' del marcador
            const props = marker.feature.properties;
            props.nombre_accidentado = nombre;
            props.usuario_registro = usuario;

            // 2. Re-generar y actualizar el contenido del popup (con tu formato simple)
            const newPopupContent = `
                <b style="font-size: 1.1em;">Incidente Registrado</b><br>
                <strong>Accidentado:</strong> ${props.nombre_accidentado || "No disponible"}<br>
                <strong>Fecha:</strong> ${props.fecha_incidente || "N/A"}<br>
                <strong>Hospital Destino:</strong> ${props.hospital_destino || "No disponible"}<br> 
                <div class="popup-actions">
                    <button class="btn-popup btn-editar-incidente" data-id="${props.id}">✏️ Editar</button>
                    <button class="btn-popup btn-eliminar-incidente" data-id="${props.id}">🗑️ Eliminar</button>
                </div>
            `;
            popup.setContent(newPopupContent);

        } else {
            // Muestra el error devuelto por la función de api.js
            alert(`Error: ${data.error || 'No se pudo actualizar'}`);
        }
    } catch (err) {
        console.error('Error al actualizar:', err);
        alert('Error de red al intentar actualizar.');
    }
}