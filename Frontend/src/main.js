import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet-minimap/dist/Control.MiniMap.min.css';
import './style.css';
import * as turf from '@turf/turf';
import { initMap } from './map.js';
import {
  fetchAnalisisIncidente, fetchRutaOptima, fetchTodosLosHospitales,
  fetchLocalidadesConConteo, fetchLocalidadesParaBusqueda
} from './api.js';
import {
  addDepartamentosLayer, addViasLayer, addLocalidadesLayer, addHospitalesClusterLayer,
  dibujarResultados, dibujarRuta, inicializarLeyenda, agregarItemLeyenda, quitarItemLeyenda
} from './layers.js';

document.addEventListener('DOMContentLoaded', async () => {
  const { map, baseMaps } = initMap();

  let capaBaseInicial = null;
  for (const nombre in baseMaps) {
    if (map.hasLayer(baseMaps[nombre])) {
      capaBaseInicial = nombre;
      break;
    }
  }

  if (capaBaseInicial) {
    window.baseMapActivo = capaBaseInicial;
  } else {
    window.baseMapActivo = 'Normal';
  }

  inicializarLeyenda(map);
  const departamentosCapa = addDepartamentosLayer(map);
  const viasCapa = addViasLayer(map);
  const localidadesCapa = await addLocalidadesLayer(map);
  const hospitalesCapa = await addHospitalesClusterLayer(map);

  localidadesCapa.addTo(map);
  hospitalesCapa.addTo(map);

  agregarItemLeyenda("Localidades");
  agregarItemLeyenda("Hospitales");

  const overlayMaps = {
    "Departamentos": departamentosCapa,
    "Vías": viasCapa,
    "Localidades": localidadesCapa,
    "Hospitales": hospitalesCapa
  };
  L.control.layers(baseMaps, overlayMaps).addTo(map);

  // LEYENDA dinámica
  map.on('overlayadd', e => agregarItemLeyenda(e.name));
  map.on('overlayremove', e => quitarItemLeyenda(e.name));

  // PANEL DE ANÁLISIS DE INCIDENTES
  const toggleButton = document.getElementById('toggle-incident-panel');
  const incidentControl = toggleButton.parentElement;
  const btnIncidente = document.getElementById('btn-incidente');
  const infoPanel = document.getElementById('info-panel');
  const bufferInput = document.getElementById('distancia-buffer');
  let puntoIncidente = null;
  const bufferLayer = L.layerGroup().addTo(map);

  toggleButton.onclick = (e) => { e.preventDefault(); incidentControl.classList.toggle('open'); };
  btnIncidente.onclick = () => {
    infoPanel.textContent = 'Haz clic en el mapa para marcar la ubicación.';
    incidentControl.classList.remove('open');
    map.pm.enableDraw('Marker', {
      markerStyle: { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/130/130159.png', iconSize: [25, 41], iconAnchor: [12, 41] }) },
    });
  };

  const ejecutarAnalisis = async () => {
    if (!puntoIncidente) return;
    const distancia = bufferInput.value;
    const { lat, lng } = puntoIncidente;

    bufferLayer.clearLayers();
    const buffer = turf.buffer(turf.point([lng, lat]), distancia, { units: 'meters' });
    L.geoJSON(buffer, { style: { color: 'blue', weight: 2, opacity: 0.5, fillOpacity: 0.1 } }).addTo(bufferLayer);

    infoPanel.textContent = `Buscando hospitales en ${distancia}m...`;

    const analisis = await fetchAnalisisIncidente(lat, lng, distancia);
    dibujarResultados(map, puntoIncidente, analisis || { hospitalesEnBuffer: [] });

    if (!analisis || !analisis.hospitalesEnBuffer || analisis.hospitalesEnBuffer.length === 0) {
      infoPanel.textContent = 'No se encontraron hospitales. Aumenta el radio y presiona Enter.';
    } else {
      infoPanel.textContent = `Se encontraron ${analisis.hospitalesEnBuffer.length} hospitales.`;
    }
  };

  map.on('pm:create', (e) => {
    puntoIncidente = e.layer.getLatLng();
    map.pm.disableDraw();
    ejecutarAnalisis();
  });

  bufferInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ejecutarAnalisis(); });

  // CÁLCULO DE RUTA
  map.on('popupopen', (e) => {
    const popupNode = e.popup._container;
    const btn = popupNode.querySelector('.btn-ruta');
    if (btn) {
      btn.onclick = async () => {
        infoPanel.textContent = 'Calculando ruta óptima...';
        const hospitalLat = btn.dataset.lat;
        const hospitalLon = btn.dataset.lon;
        const coords = { lat_inicio: puntoIncidente.lat, lon_inicio: puntoIncidente.lng, lat_fin: hospitalLat, lon_fin: hospitalLon };

        const resultadoRuta = await fetchRutaOptima(coords);

        if (resultadoRuta && resultadoRuta.ruta) {
          dibujarRuta(map, resultadoRuta.ruta);

          // 🧭 Calcular distancia y tiempo estimado
          const distanciaKm = turf.length(resultadoRuta.ruta, { units: 'kilometers' });
          const velocidadKmH = 40; // velocidad promedio urbana
          const tiempoHoras = distanciaKm / velocidadKmH;
          const tiempoMinutos = Math.round(tiempoHoras * 60);

          infoPanel.textContent = `Ruta calculada con éxito.
          Distancia: ${distanciaKm.toFixed(2)} km.
          Tiempo estimado: ${tiempoMinutos} min.`;
        } else {
          infoPanel.textContent = 'No se pudo calcular la ruta.';
        }

        map.closePopup();
      };
    }
  });

  // BUSCADOR CON AUTOCOMPLETADO
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const resultadosBusquedaLayer = L.layerGroup().addTo(map);

  const sugerenciasDiv = document.createElement('div');
  sugerenciasDiv.id = 'sugerencias';
  searchInput.parentElement.appendChild(sugerenciasDiv);

  let datosBusqueda = [];
  (async () => {
    const [localidades, hospitales] = await Promise.all([
      fetchLocalidadesParaBusqueda(),
      fetchTodosLosHospitales()
    ]);

    const localidadesMapeadas = (localidades?.features || []).map(f => ({ nombre: f.properties.locnombre, tipo: 'Localidad', feature: f }));
    const hospitalesMapeados = (hospitales?.features || []).map(h => ({ nombre: h.properties.nombre, tipo: 'Hospital', feature: h }));
    datosBusqueda = [...localidadesMapeadas, ...hospitalesMapeados];
  })();

  searchInput.addEventListener('input', () => {
    const texto = searchInput.value.trim().toLowerCase();
    sugerenciasDiv.innerHTML = '';
    if (!texto) { sugerenciasDiv.style.display = 'none'; return; }

    const coincidencias = datosBusqueda.filter(item => item.nombre?.toLowerCase().includes(texto));
    coincidencias.slice(0, 7).forEach(item => {
      const div = document.createElement('div');
      div.className = 'sugerencia-item';
      div.innerHTML = `<strong>${item.nombre}</strong> <small>(${item.tipo})</small>`;
      div.addEventListener('click', () => {
        searchInput.value = item.nombre;
        sugerenciasDiv.style.display = 'none';
        mostrarResultadoBusqueda(item);
      });
      sugerenciasDiv.appendChild(div);
    });
    sugerenciasDiv.style.display = coincidencias.length ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.parentElement.contains(e.target)) {
      sugerenciasDiv.style.display = 'none';
    }
  });

  function mostrarResultadoBusqueda(item) {
    resultadosBusquedaLayer.clearLayers();
    if (item.tipo === 'Localidad') {
      const localidadLayer = L.geoJSON(item.feature, {
        style: { color: '#0078ff', weight: 4, fillOpacity: 0.1 }
      }).addTo(resultadosBusquedaLayer);
      map.fitBounds(localidadLayer.getBounds());
    } else {
      const markerExistente = hospitalesCapa.getLayers().find(layer =>
        layer.feature && layer.feature.properties.nombre === item.nombre
      );

      if (markerExistente) {
        hospitalesCapa.zoomToShowLayer(markerExistente, () => {
          markerExistente.openPopup();
        });
      } else {
        const coords = item.feature.geometry.coordinates;
        map.setView([coords[1], coords[0]], 16);
      }
    }
  }

  searchBtn.addEventListener('click', () => {
    const texto = searchInput.value.trim().toLowerCase();
    const primeraCoincidencia = datosBusqueda.find(item => item.nombre?.toLowerCase() === texto);
    if (primeraCoincidencia) {
      mostrarResultadoBusqueda(primeraCoincidencia);
    } else {
      alert('No se encontró un resultado exacto. Por favor, selecciona una opción de la lista.');
    }
  });
});
