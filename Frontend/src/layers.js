import L from 'leaflet';
import * as turf from '@turf/turf';
import { fetchTodosLosHospitales, fetchLocalidadesConConteo } from './api.js';

// --- CAPAS GLOBALES ---
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

function getColor(d) {
    return d > 40 ? '#800026' : d > 30 ? '#BD0026' : d > 20 ? '#E31A1C' :
        d > 10 ? '#FC4E2A' : d > 5 ? '#FD8D3C' : d > 0 ? '#FEB24C' : '#FFEDA0';
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

// 🔹 Inicializa la leyenda y la vincula a los eventos del mapa
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

    // --- Detectar cambio de mapa base ---
    map.on('baselayerchange', (e) => {
        baseMapActivo = e.name;
        actualizarLeyenda();
    });

    // --- Detectar overlays ---
    map.on('overlayadd', (e) => agregarItemLeyenda(e.name));
    map.on('overlayremove', (e) => quitarItemLeyenda(e.name));

    actualizarLeyenda();
};

// 🔹 Actualiza el contenido HTML de la leyenda
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
    const geoserverBase = "http://136.112.122.118:8080/geoserver/wms";

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
            const grades = [0, 5, 10, 20, 30, 40];
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
    const geoserverUrl = 'http://136.112.122.118:8080/geoserver/wms';
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
    const geoserverUrl = 'http://136.112.122.118:8080/geoserver/wms';
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
    const wfsUrl = `http://136.112.122.118:8080/geoserver/hospitales_bogota/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=hospitales_bogota%3Alocalidades&outputFormat=application%2Fjson`;
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

// --- HOSPITALES ---
export const addHospitalesClusterLayer = async (map) => {
    hospitalesClusterLayer = L.markerClusterGroup({
        iconCreateFunction: (cluster) => {
            const childCount = cluster.getChildCount();
            let cssClass = '';
            if (childCount < 10) cssClass = 'hospital-cluster-small';
            else if (childCount < 100) cssClass = 'hospital-cluster-medium';
            else cssClass = 'hospital-cluster-large';
            return L.divIcon({
                html: `<div><span>${childCount}</span></div>`,
                className: `hospital-cluster ${cssClass}`,
                iconSize: L.point(40, 40)
            });
        }
    });

    const todosLosHospitales = await fetchTodosLosHospitales();
    if (todosLosHospitales) {
        const geoJsonLayer = L.geoJSON(todosLosHospitales, {
            pointToLayer: (feature, latlng) => L.marker(latlng, { icon: hospitalIcon }),
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popupContent = `<b>${props.nombre}</b><br><hr><strong>Dirección:</strong> ${props.direccion || 'No disponible'}<br><strong>Nivel:</strong> ${props.nivel || 'No disponible'}<br><strong>Tipo:</strong> ${props.tipo || 'No disponible'}`;
                layer.bindPopup(popupContent);
            }
        });
        hospitalesClusterLayer.addLayer(geoJsonLayer);
    }
    return hospitalesClusterLayer;
};

// --- DIBUJAR RESULTADOS ---
// Muestra hospitales dentro del buffer + distancia y tiempo estimado en línea recta
export const dibujarResultados = (map, latlng, data) => {
    resultadosLayer.clearLayers();
    rutaLayer.clearLayers();

    // Si hay hospitales cargados globalmente, los quitamos temporalmente
    if (map.hasLayer(hospitalesClusterLayer)) map.removeLayer(hospitalesClusterLayer);

    // 📍 Agregar marcador del incidente
    const markerIncidente = L.marker(latlng).bindPopup("📍 Punto del incidente");
    markerIncidente.addTo(resultadosLayer);

    if (data.hospitalesEnBuffer && data.hospitalesEnBuffer.length > 0) {
        const velocidadKmH = 40; // velocidad urbana promedio
        const puntoIncidente = turf.point([latlng.lng, latlng.lat]);

        L.geoJSON(data.hospitalesEnBuffer, {
            pointToLayer: (feature, latlngHosp) => L.marker(latlngHosp, { icon: hospitalIcon }),
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;

                //  Calcular distancia y tiempo estimado en línea recta
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
                        data-lon="${coords[0]}">
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
