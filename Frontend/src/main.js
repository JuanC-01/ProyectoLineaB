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
import Swal from 'sweetalert2';
import { initMap } from './map.js';
import {
    fetchAnalisisIncidente, fetchRutaOptima, fetchTodosLosHospitales,
    fetchLocalidadesConConteo, fetchLocalidadesParaBusqueda,
    registrarNuevoIncidente, fetchObtenerIncidentes, fetchEliminarIncidente, fetchActualizarIncidente
} from './api.js';
import {
    addDepartamentosLayer, addViasLayer, addLocalidadesLayer, addHospitalesClusterLayer,
    dibujarResultados, dibujarRuta, inicializarLeyenda, agregarItemLeyenda, quitarItemLeyenda
} from './layers.js';

let capaRutaReporte = L.layerGroup();
let capaPuntoReporte = L.layerGroup();
let map;

// =======================================================
// LÓGICA DEL MODAL DE REPORTES
// =======================================================
const verIncidenteEnMapa = (incidente) => {
    capaRutaReporte.clearLayers();
    capaPuntoReporte.clearLayers();

    const coordsPunto = incidente.punto_geojson.coordinates;
    const punto = L.marker([coordsPunto[1], coordsPunto[0]], {
        icon: L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/130/130159.png',
            iconSize: [25, 41], iconAnchor: [12, 41]
        })
    }).addTo(capaPuntoReporte)
        .bindPopup(`**Incidente #${incidente.id}**<br>Accidentado: ${incidente.nombre_accidentado}`);

    if (incidente.ruta_geojson) {
        const rutaLayer = L.geoJSON(incidente.ruta_geojson, {
            style: { color: '#00703C', weight: 4, opacity: 0.8, dashArray: '10, 5' }
        }).addTo(capaRutaReporte);

        const bounds = rutaLayer.getBounds().isValid() ? rutaLayer.getBounds() : L.latLngBounds(punto.getLatLng(), punto.getLatLng());
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        map.setView(punto.getLatLng(), 15);
    }
    document.getElementById('modalReportes').style.display = 'none';
};

const editarIncidente = async (incidente) => {
    const { value: formValues } = await Swal.fire({
        title: `Editar Incidente #${incidente.id}`,
        html:
            `<p>Hospital: <strong>${incidente.hospital_destino}</strong></p><hr>` +
            '<input id="swal-edit-nombre" class="swal2-input" placeholder="Nombre del Accidentado" required value="' + incidente.nombre_accidentado + '">' +
            '<input id="swal-edit-usuario" class="swal2-input" placeholder="Usuario que Registra" required value="' + incidente.usuario_registro + '">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        preConfirm: () => {
            const nombre = document.getElementById('swal-edit-nombre').value;
            const usuario = document.getElementById('swal-edit-usuario').value;
            if (!nombre || !usuario) {
                Swal.showValidationMessage('Debe ingresar el Nombre y el Usuario.');
            }
            return { nombre, usuario };
        }
    });

    if (formValues) {
        Swal.fire({ title: 'Guardando...', didOpen: () => { Swal.showLoading(); } });

        const dataToUpdate = {
            nombre_accidentado: formValues.nombre,
            usuario_registro: formValues.usuario
        };

        const result = await fetchActualizarIncidente(incidente.id, dataToUpdate);

        if (result && !result.error) {
            Swal.fire(
                '¡Actualizado!',
                `Incidente #${incidente.id} ha sido modificado.`,
                'success'
            );
            cargarReportes(); // Recargar la tabla para mostrar los datos actualizados
        } else {
            Swal.fire('Error', result.error || 'No se pudo actualizar el incidente.', 'error');
        }
    }
};

// Función para eliminar un incidente
const eliminarIncidente = async (id) => {
    const confirmacion = await Swal.fire({
        title: '¿Estás seguro?',
        text: `Vas a eliminar el Incidente #${id}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        Swal.fire({ title: 'Eliminando...', didOpen: () => { Swal.showLoading(); } });
        const result = await fetchEliminarIncidente(id);

        if (result && !result.error) {
            Swal.fire('¡Eliminado!', `El Incidente #${id} ha sido eliminado.`, 'success');
            cargarReportes(); // Recargar la tabla
            capaRutaReporte.clearLayers();
            capaPuntoReporte.clearLayers();
        } else {
            Swal.fire('Error', result.error || 'No se pudo eliminar el incidente.', 'error');
        }
    }
}

// Función para cargar los datos en la tabla del modal
const cargarReportes = async () => {
    const tbody = document.querySelector('#tablaReportes tbody');
    tbody.innerHTML = '<tr><td colspan="8">Cargando datos...</td></tr>';

    // Asegurarse de que las capas de reportes estén en el mapa
    if (!map.hasLayer(capaRutaReporte)) capaRutaReporte.addTo(map);
    if (!map.hasLayer(capaPuntoReporte)) capaPuntoReporte.addTo(map);

    const data = await fetchObtenerIncidentes();

    if (data.error || !Array.isArray(data)) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:red;">Error al cargar: ${data.error || 'Desconocido'}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No hay incidentes registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = ''; // Limpiar el "Cargando..."
    data.forEach(incidente => {
        const row = tbody.insertRow();
        // Celdas de datos
        row.insertCell().textContent = incidente.id;
        row.insertCell().textContent = incidente.nombre_accidentado;
        row.insertCell().textContent = incidente.usuario_registro;
        row.insertCell().textContent = incidente.fecha_incidente;
        row.insertCell().textContent = incidente.hospital_destino;
        row.insertCell().textContent = incidente.distancia_km;
        row.insertCell().textContent = incidente.tiempo_min;

        // Celda de acciones (ver y eliminar)
        const actionsCell = row.insertCell();

        // Botón Ver
        const btnVer = document.createElement('button');
        btnVer.textContent = '🗺️ Ver';
        btnVer.className = 'btn-ver-incidente';
        btnVer.onclick = () => verIncidenteEnMapa(incidente);
        actionsCell.appendChild(btnVer);

        const btnEditar = document.createElement('button');
        btnEditar.textContent = '✏️ Editar';
        btnEditar.className = 'btn-editar-incidente';
        btnEditar.onclick = () => editarIncidente(incidente);
        actionsCell.appendChild(btnEditar);

        // Botón Eliminar
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = '❌ Eliminar';
        btnEliminar.className = 'btn-eliminar-incidente';
        btnEliminar.style.marginLeft = '5px';
        btnEliminar.onclick = () => eliminarIncidente(incidente.id);
        actionsCell.appendChild(btnEliminar);
    });
};

// =======================================================
// INICIALIZACIÓN PRINCIPAL DEL MAPA
// =======================================================

document.addEventListener('DOMContentLoaded', async () => {
    const mapObject = initMap();
    map = mapObject.map; // Asignamos el mapa a la variable global
    const baseMaps = mapObject.baseMaps;

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

    // =======================================================
    // ESTADO Y LÓGICA DE REGISTRO DE INCIDENTES
    // =======================================================

    let incidenteActual = null;

    const btnRegistrar = document.getElementById('btnRegistrar');
    if (btnRegistrar) {
        btnRegistrar.style.display = 'none'; // Inicialmente oculto
    }

    const mostrarFormularioRegistro = async () => {
        if (!incidenteActual || !incidenteActual.hospital_destino) {
            Swal.fire('Error', 'Debe calcular la ruta primero para seleccionar el hospital de destino.', 'error');
            return;
        }

        const hospitalName = incidenteActual.hospital_destino;
        const distancia = incidenteActual.distancia_km;
        const tiempo = incidenteActual.tiempo_min;

        const { value: formValues } = await Swal.fire({
            title: 'Registrar Incidente 🚑',
            html:
                `<p>Hospital de Destino Automático:</p>` +
                `<p><strong>${hospitalName}</strong></p>` +
                `<p>Ruta: <b>${distancia} km</b> | Tiempo: <b>${tiempo} min</b></p><hr>` +
                '<input id="swal-input1" class="swal2-input" placeholder="Nombre del Accidentado" required>' +
                '<input id="swal-input2" class="swal2-input" placeholder="Usuario que Registra" required>',
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                const nombre = document.getElementById('swal-input1').value;
                const usuario = document.getElementById('swal-input2').value;
                if (!nombre || !usuario) {
                    Swal.showValidationMessage('Debe ingresar el Nombre del Accidentado y el Usuario.');
                }
                return { nombre, usuario };
            }
        });

        if (formValues && formValues.nombre && formValues.usuario) {
            const dataToRegister = {
                ...incidenteActual,
                nombre_accidentado: formValues.nombre,
                usuario_registro: formValues.usuario
            };

            Swal.fire({ title: 'Registrando...', didOpen: () => { Swal.showLoading(); } });
            const result = await registrarNuevoIncidente(dataToRegister);

            if (result && result.incidente_id) {
                Swal.fire(
                    '¡Incidente Registrado!',
                    `Incidente N° ${result.incidente_id} llevado a **${hospitalName}**.`,
                    'success'
                );

                incidenteActual = null;
                if (btnRegistrar) btnRegistrar.style.display = 'none';

                // Limpiar elementos de análisis del mapa
                bufferLayer.clearLayers();
                map.eachLayer(layer => {
                    if (layer.options && layer.options.className === 'ruta-incidente') {
                        map.removeLayer(layer);
                    }
                });
                puntoIncidente = null;
                infoPanel.textContent = 'Incidente registrado con éxito. Puede marcar un nuevo punto para analizar.';
            }
            else {
                Swal.fire('Error', result.error || 'No se pudo registrar el incidente.', 'error');
            }
        }
    };

    if (btnRegistrar) {
        btnRegistrar.onclick = mostrarFormularioRegistro;
    }

    // =======================================================
    // PANEL DE ANÁLISIS DE INCIDENTES
    // =======================================================

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
        incidenteActual = null;
        if (btnRegistrar) { btnRegistrar.style.display = 'none'; }
        bufferLayer.clearLayers();
        capaRutaReporte.clearLayers(); // Limpiar capas de reporte al iniciar nuevo análisis
        capaPuntoReporte.clearLayers();

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
            if (btnRegistrar) { btnRegistrar.style.display = 'none'; }
            incidenteActual = null;
        } else {
            infoPanel.textContent = `Se encontraron ${analisis.hospitalesEnBuffer.length} hospitales. Haz clic en el popup de un hospital para calcular la ruta.`;
            if (btnRegistrar) { btnRegistrar.style.display = 'none'; }
            incidenteActual = null;
        }
    };

    map.on('pm:create', (e) => {
        puntoIncidente = e.layer.getLatLng();
        map.pm.disableDraw();
        ejecutarAnalisis();
    });

    bufferInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ejecutarAnalisis(); });

    // CÁLCULO DE RUTA Y REGISTRO
    map.on('popupopen', (e) => {
        const popupNode = e.popup._container;
        const btn = popupNode.querySelector('.btn-ruta');
        if (btn) {
            btn.onclick = async () => {
                infoPanel.textContent = 'Calculando ruta óptima...';

                const hospitalLat = btn.dataset.lat;
                const hospitalLon = btn.dataset.lon;
                const hospitalName = btn.dataset.name;

                const coords = { lat_inicio: puntoIncidente.lat, lon_inicio: puntoIncidente.lng, lat_fin: hospitalLat, lon_fin: hospitalLon };

                const resultadoRuta = await fetchRutaOptima(coords);
                if (resultadoRuta && resultadoRuta.ruta) {
                    dibujarRuta(map, resultadoRuta.ruta);

                    const distanciaKm = turf.length(resultadoRuta.ruta, { units: 'kilometers' });
                    const velocidadKmH = 40;
                    const tiempoHoras = distanciaKm / velocidadKmH;
                    const tiempoMinutos = Math.round(tiempoHoras * 60);
                    const rutaGeoJSON = JSON.stringify(resultadoRuta.ruta);

                    incidenteActual = {
                        lat: puntoIncidente.lat,
                        lng: puntoIncidente.lng,
                        hospital_destino: hospitalName,
                        distancia_km: distanciaKm.toFixed(2),
                        tiempo_min: tiempoMinutos,
                        geom_ruta_geojson: rutaGeoJSON
                    };

                    if (btnRegistrar) {
                        btnRegistrar.style.display = 'block';
                    }

                    infoPanel.textContent = `Ruta calculada con éxito al hospital: ${hospitalName}.
                    Distancia: ${distanciaKm.toFixed(2)} km.
                    Tiempo estimado: ${tiempoMinutos} min.
                    ⚠️ El hospital de destino ha sido seleccionado automáticamente. Presiona "Registrar" para guardar el incidente.`;
                } else {
                    infoPanel.textContent = 'No se pudo calcular la ruta.';
                    if (btnRegistrar) { btnRegistrar.style.display = 'none'; }
                    incidenteActual = null;
                }

                map.closePopup();
            };
        }
    });

    // =======================================================
    // LÓGICA DEL MODAL DE REPORTES
    // =======================================================
    const modalReportes = document.getElementById('modalReportes');
    const btnReportes = document.getElementById('btn-reportes');
    const cerrarModal = document.getElementById('cerrarModal');

    if (btnReportes) {
        btnReportes.onclick = () => {
            modalReportes.style.display = 'block';
            cargarReportes(); // Cargar los datos cada vez que se abre
        };
    }

    if (cerrarModal) {
        cerrarModal.onclick = () => {
            modalReportes.style.display = 'none';
        };
    }

    // Cerrar el modal al hacer clic fuera de él
    window.onclick = (event) => {
        if (event.target == modalReportes) {
            modalReportes.style.display = 'none';
        }
    };

    // =======================================================
    // BUSCADOR DE LOCALIDADES Y HOSPITALES
    // =======================================================
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