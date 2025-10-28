import L from 'leaflet';
import 'leaflet.heat';
import * as turf from '@turf/turf';
import Swal from 'sweetalert2';
import {
    fetchTodosLosHospitales, fetchLocalidadesConConteo, fetchObtenerIncidentes, fetchActualizarIncidente,
    fetchEliminarIncidente, fetchActualizarHospital, fetchEliminarHospital
} from './api.js';
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

// --- LEYENDA ---
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
        case "Incidentes":
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


let modoEdicionHospitalesActivo = false;
export const setModoEdicionHospitales = (estaActivo) => {
    modoEdicionHospitalesActivo = estaActivo;
};


function _generarPopupHospital(props) {

    let popupContent = `
        <b>${props.nombre}</b><br> 
        <img src="/hospital.jpg" alt="Hospital" 
        style="width:100%; max-height:150px; object-fit:cover; margin-top:5px; border-radius: 4px;"> 
        <hr>
        <strong>Dirección:</strong> ${props.direccion || "No disponible"}<br>
        <strong>Nivel:</strong> ${props.nivel || "No disponible"}<br>
        <strong>Tipo:</strong> ${props.tipo || "No disponible"}<br>
        <strong>Prestador:</strong> ${props.prestador || "No disponible"}
        `;
    if (modoEdicionHospitalesActivo) {
        const estaHabilitado = props.habilitado !== false;
        const textoBoton = estaHabilitado ? "Deshabilitar" : "Habilitar";
        const iconoBoton = estaHabilitado ? "🔄" : "✅";
        popupContent += `
        <hr style="margin: 8px 0;">
            <div class="popup-actions">
                <button class="btn-popup btn-editar-hospital" data-id="${props.gid}">✏️</button>
                <button class="btn-popup btn-eliminar-hospital" data-id="${props.gid}">🗑️</button>
            </div>
            `;
    }

    return popupContent;
}
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
                marker.feature = feature;
                return marker;
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                layer.bindPopup(() => _generarPopupHospital(props));
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
        iconCreateFunction: (cluster) => {
            const childCount = cluster.getChildCount();
            let cssClass = "";
            if (childCount < 10) cssClass = "incidente-cluster-small";
            else if (childCount < 100) cssClass = "incidente-cluster-medium";
            else cssClass = "incidente-cluster-large";

            return L.divIcon({
                html: `<div><span>${childCount}</span></div>`,
                className: `incidente-cluster ${cssClass}`,
                iconSize: L.point(40, 40),
            });
        },
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
            <b style="font-size: 1.1em;">🚨 Incidente Registrado</b><br>
            <strong>Accidentado:</strong> ${props.nombre_accidentado || "No disponible"}<br>
            <strong>Fecha:</strong> ${props.fecha_incidente || "N/A"}<br>
            <strong>Hospital Destino:</strong> ${props.hospital_destino || "No disponible"}<br>
            <div class="popup-actions" style="margin-top: 6px; display: flex; gap: 6px; justify-content: center;">
                <button class="btn-popup btn-editar-incidente" data-id="${props.id}">
                    <img src="/6.png" alt="Editar" style="width:18px; height:18px; vertical-align:middle;">
                </button>
                <button class="btn-popup btn-eliminar-incidente" data-id="${props.id}">
                    <img src="/7.png" alt="Eliminar" style="width:18px; height:18px; vertical-align:middle;">
                </button>
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

export const inicializarEventosPopup = (map, layerIncidentes, layerHospitales) => {

    map.on('popupopen', (e) => {
        const marker = e.popup._source;
        const popupNode = e.popup._container;
        if (!marker || !marker.feature || !popupNode) {
            return;
        }

        if (layerIncidentes.hasLayer(marker)) {
            const btnEliminarInc = popupNode.querySelector('.btn-eliminar-incidente');
            if (btnEliminarInc) {
                L.DomEvent.on(btnEliminarInc, 'click', (evt) => {
                    L.DomEvent.stop(evt);
                    const id = btnEliminarInc.dataset.id;
                    if (!id) return;
                    Swal.fire({
                        title: '¿Estás seguro?',
                        text: `¡No podrás revertir esto! (Incidente #${id})`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Sí, ¡eliminar!',
                        cancelButtonText: 'Cancelar'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            try {
                                const data = await fetchEliminarIncidente(id);
                                if (data && !data.error) {
                                    Swal.fire('¡Eliminado!', data.msg, 'success');
                                    map.closePopup();
                                    layerIncidentes.removeLayer(marker);
                                } else {
                                    Swal.fire('Error', data.error || 'No se pudo eliminar', 'error');
                                }
                            } catch (err) {
                                console.error('Error al eliminar:', err);
                                Swal.fire('Error de Red', 'No se pudo conectar para eliminar el incidente.', 'error');
                            }
                        }
                    });
                });
            }
            const btnEditarInc = popupNode.querySelector('.btn-editar-incidente');
            if (btnEditarInc) {
                L.DomEvent.on(btnEditarInc, 'click', (evt) => {
                    L.DomEvent.stop(evt);
                    const id = btnEditarInc.dataset.id;
                    const props = marker.feature.properties;
                    (async () => {
                        const { value: nuevoNombre } = await Swal.fire({
                            title: 'Actualizar Incidente',
                            input: 'text',
                            inputLabel: 'Nuevo nombre del accidentado',
                            inputValue: props.nombre_accidentado,
                            showCancelButton: true,
                            confirmButtonText: 'Actualizar',
                            cancelButtonText: 'Cancelar',
                            inputValidator: (value) => !value && '¡El nombre es obligatorio!'
                        });
                        if (nuevoNombre) {
                            _actualizarIncidente(id, nuevoNombre, props.usuario_registro, marker, e.popup);
                        }
                    })();
                });
            }
        }
        else if (layerHospitales && layerHospitales.hasLayer(marker)) {
            const btnEditarHosp = popupNode.querySelector('.btn-editar-hospital');
            if (btnEditarHosp) {
                L.DomEvent.on(btnEditarHosp, 'click', (evt) => {
                    L.DomEvent.stop(evt);
                    const id = btnEditarHosp.dataset.id;
                    const props = marker.feature.properties;
                    (async () => {
                        const { value: nuevoNombre } = await Swal.fire({
                            title: 'Actualizar Hospital',
                            input: 'text',
                            inputLabel: 'Nuevo nombre del hospital',
                            inputValue: props.nombre,
                            showCancelButton: true,
                            confirmButtonText: 'Actualizar',
                            cancelButtonText: 'Cancelar',
                            inputValidator: (v) => !v && 'El nombre es obligatorio'
                        });
                        if (nuevoNombre) {
                            _actualizarHospital(id, nuevoNombre, marker, e.popup);
                        }
                    })();
                });
            }
            const btnEliminarHosp = popupNode.querySelector('.btn-eliminar-hospital');
            if (btnEliminarHosp) {
                L.DomEvent.on(btnEliminarHosp, 'click', (evt) => {
                    L.DomEvent.stop(evt);
                    const gid = btnEliminarHosp.dataset.id;
                    if (!gid) return;
                    Swal.fire({
                        title: '¿Estás seguro?',
                        text: `Se eliminará el hospital #${gid}. ¡Esta acción no se puede deshacer!`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'Sí, ¡eliminar!',
                        cancelButtonText: 'Cancelar'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            try {
                                const deleteResult = await fetchEliminarHospital(gid);
                                if (deleteResult && !deleteResult.error) {
                                    Swal.fire(
                                        '¡Eliminado!',
                                        deleteResult.msg || `Hospital #${gid} eliminado.`,
                                        'success'
                                    );
                                    map.closePopup();
                                    layerHospitales.removeLayer(marker);
                                } else {
                                    Swal.fire(
                                        'Error',
                                        deleteResult.error || 'No se pudo eliminar el hospital.',
                                        'error'
                                    );
                                }
                            } catch (err) { 
                                console.error('Error en el proceso de eliminación del hospital:', err);
                                Swal.fire(
                                    'Error de Red',
                                    'No se pudo conectar para eliminar el hospital.',
                                    'error'
                                );
                            }
                        }
                    });
                });
            }
            const btnToggleHosp = popupNode.querySelector('.btn-toggle-hospital');
            if (btnToggleHosp) {
                L.DomEvent.on(btnToggleHosp, 'click', (evt) => {
                    L.DomEvent.stop(evt);
                    Swal.fire('Función No Disponible', 'La API para cambiar el estado de hospitales aún no está implementada.', 'info');
                });
            }
        }
    });
};

async function _actualizarIncidente(id, nombre, usuario, marker, popup) {
    try {
        const dataToUpdate = {
            nombre_accidentado: nombre,
            usuario_registro: usuario
        };
        const data = await fetchActualizarIncidente(id, dataToUpdate);

        if (data && !data.error) {
            Swal.fire({
                title: '¡Actualizado!',
                text: data.msg,
                icon: 'success'
            });
            const props = marker.feature.properties;
            props.nombre_accidentado = nombre;
            props.usuario_registro = usuario;
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
            Swal.fire({
                title: 'Error',
                text: data.error || 'No se pudo actualizar',
                icon: 'error'
            });
        }
    } catch (err) {
        console.error('Error al actualizar:', err);
        Swal.fire({
            title: 'Error de Red',
            text: 'No se pudo conectar para actualizar el incidente.',
            icon: 'error'
        });
    }
}
async function _actualizarHospital(id, nombre, marker, popup) {
    try {
        const dataToUpdate = { id, nombre };
        const data = await fetchActualizarHospital(dataToUpdate);
        if (data && !data.error) {
            Swal.fire(
                '¡Actualizado!',
                data.msg || data.message || 'Hospital actualizado correctamente.',
                'success'
            );
            const props = marker.feature.properties;
            props.nombre = nombre;
            const newPopupContent = _generarPopupHospital(props);
            popup.setContent(newPopupContent);

        } else {
            Swal.fire(
                'Error',
                data.error || data.message || 'No se pudo actualizar el hospital.',
                'error'
            );
        }
    } catch (err) {
        Swal.fire(
            'Error de Red',
            'No se pudo conectar con el servidor para actualizar.',
            'error'
        );
    }
}
