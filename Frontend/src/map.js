import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-minimap/dist/Control.MiniMap.min.css';
import MiniMap from 'leaflet-minimap';

let map;

export const initMap = () => {
  map = L.map('map').setView([4.65, -74.08], 12);

  // === CAPAS BASE ===
  const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  });
  const esriWorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  });

  osmBase.addTo(map);

  const baseMaps = {
    "Normal": osmBase,
    "Relieve": openTopoMap,
    "Satélite": esriWorldImagery
  };

  // === ESCALA ===
  L.control.scale({ imperial: false }).addTo(map);

  // === MINIMAP ===
  let minimapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  });

  const miniMap = new L.Control.MiniMap(minimapLayer, {
    toggleDisplay: true,
    minimized: false,
    position: 'bottomleft',
    zoomLevelOffset: -4
  }).addTo(map);

  //ACTUALIZAR MINIMAPA
  map.on('baselayerchange', (e) => {
    try {
      if (miniMap && miniMap._miniMap) {
        if (minimapLayer && miniMap._miniMap.hasLayer(minimapLayer)) {
          miniMap._miniMap.removeLayer(minimapLayer);
        }
        minimapLayer = L.tileLayer(e.layer._url, e.layer.options);
        minimapLayer.addTo(miniMap._miniMap);
      }
    } catch (err) {
      console.warn('Error actualizando minimapa:', err);
    }
  });

  return { map, baseMaps };
};
