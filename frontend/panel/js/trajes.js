// Trajes Management JavaScript

// Verificar autenticación ANTES de cualquier otra cosa
(function checkAuthenticationFirst() {
    try {
        let sessionData = localStorage.getItem('lugx_session');
        if (!sessionData) {
            sessionData = sessionStorage.getItem('lugx_session');
        }
        
        if (!sessionData) {
            // No hay sesión, redirigir al login
            window.location.href = 'login.html';
            return;
        }
        
        const session = JSON.parse(sessionData);
        if (!session.token) {
            // No hay token, redirigir al login
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = 'login.html';
        return;
    }
})();

// Verificar que storage-utils.js esté cargado
if (typeof window.storageManager === 'undefined') {
    console.error('storage-utils.js debe ser cargado antes que trajes.js');
}

// Función para limpiar localStorage de trajes
function clearTrajesCache() {
    localStorage.removeItem('lugx_trajes');
    localStorage.removeItem('lugx_trajes_timestamp');
    console.log('Cache de trajes limpiado');
}

// Función para guardar trajes en localStorage con timestamp
function saveTrajestoLocalStorage(trajes) {
    try {
        localStorage.setItem('lugx_trajes', JSON.stringify(trajes));
        localStorage.setItem('lugx_trajes_timestamp', Date.now().toString());
        console.log('Trajes guardados en localStorage:', trajes.length, 'registros');
        return true;
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
        return false;
    }
}

// Función para obtener trajes desde localStorage
function getTrajesFromLocalStorage() {
    try {
        const trajes = localStorage.getItem('lugx_trajes');
        const timestamp = localStorage.getItem('lugx_trajes_timestamp');
        
        if (trajes && timestamp) {
            const data = JSON.parse(trajes);
            const savedTime = parseInt(timestamp);
            const currentTime = Date.now();
            const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
            
            // Si los datos tienen menos de 24 horas, los usamos
            if (hoursDiff < 24) {
                console.log('Cargando trajes desde localStorage:', data.length, 'registros');
                return data;
            } else {
                console.log('Datos de localStorage obsoletos, limpiando...');
                clearTrajesCache();
                return [];
            }
        }
        return [];
    } catch (error) {
        console.error('Error al leer localStorage:', error);
        clearTrajesCache();
        return [];
    }
}

// Funciones para obtener trajes (online/offline) - MEJORADA
async function getTrajes() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            console.log('Obteniendo trajes desde la API...');
            const result = await window.connectivityManager.makeRequest('/trajes');
            if (result.success && Array.isArray(result.data)) {
                // Guardar automáticamente en localStorage cuando obtenemos datos de la API
                saveTrajestoLocalStorage(result.data);
                return result.data;
            } else {
                console.warn('API no devolvió datos válidos, usando localStorage como fallback');
                return getTrajesFromLocalStorage();
            }
        }
        
        // Fallback a localStorage cuando estamos offline
        console.log('Sin conexión, cargando desde localStorage...');
        return getTrajesFromLocalStorage();
    } catch (error) {
        console.error('Error al obtener trajes:', error);
        // En caso de error, intentar cargar desde localStorage
        return getTrajesFromLocalStorage();
    }
}

// Crear traje (online/offline)
async function createTraje(trajeData) {
    try {
        // Siempre usar ConnectivityManager para manejar online/offline automáticamente
        const result = await window.connectivityManager.makeRequest('/trajes', {
            method: 'POST',
            body: JSON.stringify(trajeData)
        });
        
        return result;
    } catch (error) {
        console.error('Error al crear traje:', error);
        return { success: false, error: error.message };
    }
}

// Actualizar traje (online/offline)
async function updateTraje(id, trajeData) {
    try {
        // Siempre usar ConnectivityManager para manejar online/offline automáticamente
        const result = await window.connectivityManager.makeRequest(`/trajes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(trajeData)
        });
        
        return result;
    } catch (error) {
        console.error('Error al actualizar traje:', error);
        return { success: false, error: error.message };
    }
}

// Eliminar traje (online/offline)
async function deleteTrajeById(id) {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            const result = await window.connectivityManager.makeRequest(`/trajes/${id}`, {
                method: 'DELETE'
            });
            if (result.success) {
                return result;
            }
        }
        
        // Fallback offline
        if (window.storageManager.deleteItem('trajes', id)) {
            return { success: true };
        } else {
            return { success: false, error: 'Error al eliminar offline' };
        }
    } catch (error) {
        console.error('Error al eliminar traje:', error);
        return { success: false, error: error.message };
    }
}

// Load trajes on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Esperar a que el connectivity manager esté listo
    if (window.connectivityManager) {
        await window.connectivityManager.checkConnectivity();
    }
    
    // Configurar sincronización automática
    setupAutoSync();
    
    // Cargar trajes (ahora con localStorage habilitado)
    await loadTrajes();
    setupEventListeners();
    
    // Mostrar estadísticas de localStorage en consola
    const stats = getLocalStorageStats();
    console.log('Estadísticas de localStorage:', stats);
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchTraje').addEventListener('input', function() {
        filterTrajes();
    });

    // Status filter
    document.getElementById('statusFilter').addEventListener('change', function() {
        filterTrajes();
    });
}

// Load and display trajes
async function loadTrajes() {
    try {
        showLoadingIndicator(true);
        const trajes = await getTrajes();
        displayTrajes(trajes);
        updateStatsCards(trajes);
    } catch (error) {
        console.error('Error cargando trajes:', error);
        showNotification('Error al cargar trajes', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// Display trajes in table
function displayTrajes(trajes) {
    const tableBody = document.getElementById('trajesTableBody');
    tableBody.innerHTML = '';

    if (trajes.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" class="text-center">
                <div class="empty-state">
                    <i class="fa fa-tshirt fa-3x text-muted mb-3"></i>
                    <h5>No hay trajes registrados</h5>
                    <p class="text-muted">Comienza agregando tu primer traje</p>
                    <button class="btn btn-primary" onclick="openAddTrajeModal()">
                        <i class="fa fa-plus"></i> Agregar Traje
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }

    trajes.forEach(traje => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${traje.idTraje}</td>
            <td>${traje.nombreTraje}</td>
            <td>${truncateText(traje.descripcion, 80)}</td>
            <td>${getStatusBadge(traje.estado)}</td>
            <td>
                <span class="badge ${(traje.rentasTotales || 0) > 0 ? 'badge-success' : 'badge-secondary'}">
                    ${traje.rentasTotales || 0}
                </span>
            </td>
            <td>${formatDate(traje.fechaCreacion)}</td>
            <td>
                <button class="btn btn-edit" onclick="editTraje(${traje.idTraje})" title="Editar">
                    <i class="fa fa-edit"></i>
                </button>
                <button class="btn btn-view" onclick="viewTraje(${traje.idTraje})" title="Ver Detalles">
                    <i class="fa fa-eye"></i>
                </button>
                <button class="btn btn-delete" onclick="deleteTraje(${traje.idTraje})" title="Eliminar">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Filter trajes
async function filterTrajes() {
    const searchTerm = document.getElementById('searchTraje').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const trajes = await getTrajes();

    let filteredTrajes = trajes.filter(traje => {
        const matchesSearch = traje.nombreTraje.toLowerCase().includes(searchTerm) ||
                            (traje.descripcion && traje.descripcion.toLowerCase().includes(searchTerm));
        
        const matchesStatus = statusFilter === '' || traje.estado === statusFilter;

        return matchesSearch && matchesStatus;
    });

    displayTrajes(filteredTrajes);
}

// Open add traje modal
function openAddTrajeModal() {
    document.getElementById('trajeModalTitle').textContent = 'Agregar Traje';
    document.getElementById('trajeForm').reset();
    document.getElementById('trajeId').value = '';
    $('#trajeModal').modal('show');
}

// Edit traje
async function editTraje(id) {
    try {
        const trajes = await getTrajes();
        const traje = trajes.find(t => t.idTraje === parseInt(id));
        
        if (traje) {
            document.getElementById('trajeModalTitle').textContent = 'Editar Traje';
            document.getElementById('trajeId').value = traje.idTraje;
            document.getElementById('nombreTraje').value = traje.nombreTraje;
            document.getElementById('descripcion').value = traje.descripcion || '';
            $('#trajeModal').modal('show');
        } else {
            showNotification('Traje no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error al cargar traje:', error);
        showNotification('Error al cargar los datos del traje', 'error');
    }
}

// View traje details
async function viewTraje(id) {
    try {
        const trajes = await getTrajes();
        const traje = trajes.find(t => t.idTraje === parseInt(id));
        
        if (traje) {
            const content = `
                <div class="row">
                    <div class="col-md-6">
                        <h6><strong>ID:</strong></h6>
                        <p>${traje.idTraje}</p>
                        
                        <h6><strong>Nombre:</strong></h6>
                        <p>${traje.nombreTraje}</p>
                        
                        <h6><strong>Estado:</strong></h6>
                        <p>${getStatusBadge(traje.estado)}</p>
                    </div>
                    <div class="col-md-6">
                        <h6><strong>Rentas Totales:</strong></h6>
                        <p>${traje.rentasTotales || 0}</p>
                        
                        <h6><strong>Fecha de Creación:</strong></h6>
                        <p>${formatDate(traje.fechaCreacion)}</p>
                        
                        <h6><strong>Estado Activo:</strong></h6>
                        <p>${traje.activo ? 'Sí' : 'No'}</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-12">
                        <h6><strong>Descripción:</strong></h6>
                        <p>${traje.descripcion || 'Sin descripción'}</p>
                    </div>
                </div>
            `;
            
            document.getElementById('viewTrajeContent').innerHTML = content;
            $('#viewTrajeModal').modal('show');
        } else {
            showNotification('Traje no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error al cargar traje:', error);
        showNotification('Error al cargar los datos del traje', 'error');
    }
}

// Save traje (add or update)
async function saveTraje() {
    const form = document.getElementById('trajeForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const trajeId = document.getElementById('trajeId').value;
    const nombreTraje = document.getElementById('nombreTraje').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();

    // Validación básica
    if (!nombreTraje) {
        showNotification('El nombre del traje es requerido', 'error');
        return;
    }

    // Check for duplicate name (excluding current traje if editing)
    const trajes = await getTrajes();
    const duplicateName = trajes.find(t => 
        t.nombreTraje === nombreTraje && 
        t.idTraje !== parseInt(trajeId)
    );
    
    if (duplicateName) {
        showNotification('Ya existe un traje con este nombre', 'error');
        return;
    }

    try {
        showLoadingIndicator(true);
        
        if (trajeId) {
            // Update existing traje
            const updateData = {
                nombreTraje,
                descripcion
            };
            
            const result = await updateTraje(trajeId, updateData);
            if (result.success) {
                showNotification('Traje actualizado exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al actualizar el traje', 'error');
                return;
            }
        } else {
            // Add new traje
            const newTraje = {
                nombreTraje,
                descripcion
            };
            
            const result = await createTraje(newTraje);
            if (result.success) {
                showNotification('Traje agregado exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al agregar el traje', 'error');
                return;
            }
        }

        $('#trajeModal').modal('hide');
        await loadTrajes();
    } catch (error) {
        console.error('Error en saveTraje:', error);
        showNotification('Error al procesar la solicitud', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// Delete traje
async function deleteTraje(id) {
    try {
        const trajes = await getTrajes();
        const traje = trajes.find(t => t.idTraje === parseInt(id));
        
        if (traje) {
            if (traje.estado === 'rentado') {
                showNotification('No se puede eliminar un traje que está rentado', 'error');
                return;
            }

            if (confirm(`¿Está seguro de que desea eliminar el traje "${traje.nombreTraje}"?`)) {
                showLoadingIndicator(true);
                const result = await deleteTrajeById(id);
                
                if (result.success) {
                    showNotification('Traje eliminado exitosamente', 'success');
                    await loadTrajes();
                } else {
                    showNotification(result.error || 'Error al eliminar el traje', 'error');
                }
                showLoadingIndicator(false);
            }
        } else {
            showNotification('Traje no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error al eliminar traje:', error);
        showNotification('Error al procesar la solicitud', 'error');
        showLoadingIndicator(false);
    }
}

// Export trajes to CSV
async function exportTrajes() {
    try {
        const trajes = await getTrajes();
        
        if (trajes.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }

        const headers = ['ID', 'Nombre', 'Descripción', 'Estado', 'Fecha Creación', 'Estado Activo'];
        const csvContent = [
            headers.join(','),
            ...trajes.map(traje => [
                traje.idTraje,
                `"${traje.nombreTraje}"`,
                `"${traje.descripcion || ''}"`,
                traje.estado,
                traje.fechaCreacion,
                traje.activo ? 'Activo' : 'Inactivo'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `trajes_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Archivo CSV exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error al exportar CSV:', error);
        showNotification('Error al exportar los datos', 'error');
    }
}

// Mostrar/ocultar indicador de carga
function showLoadingIndicator(show) {
    let indicator = document.getElementById('loading-indicator');
    
    if (show && !indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loading-indicator';
        indicator.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cargando...';
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px;
            border-radius: 5px;
            z-index: 9999;
        `;
        document.body.appendChild(indicator);
    } else if (!show && indicator) {
        indicator.remove();
    }
}

// Actualizar tarjetas de estadísticas
function updateStatsCards(trajes) {
    const totalTrajes = trajes.length;
    const trajesDisponibles = trajes.filter(t => t.estado === 'disponible').length;
    const trajesRentados = trajes.filter(t => t.estado === 'rentado').length;
    const trajesMantenimiento = trajes.filter(t => t.estado === 'mantenimiento').length;
    
    // Actualizar los valores en las tarjetas si existen
    const statsCards = document.querySelectorAll('.admin-card .card-content h4');
    if (statsCards.length >= 4) {
        statsCards[0].textContent = totalTrajes;
        statsCards[1].textContent = trajesDisponibles;
        statsCards[2].textContent = trajesRentados;
        statsCards[3].textContent = trajesMantenimiento;
    }
}

// Utility functions
function getStatusBadge(estado) {
    const statusMap = {
        'disponible': '<span class="badge bg-success">Disponible</span>',
        'rentado': '<span class="badge bg-warning">En Renta</span>',
        'mantenimiento': '<span class="badge bg-secondary">Mantenimiento</span>',
        'fuera_servicio': '<span class="badge bg-danger">Fuera de Servicio</span>'
    };
    return statusMap[estado] || '<span class="badge bg-secondary">Desconocido</span>';
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert">
            <span>&times;</span>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Función para sincronizar localStorage con la base de datos
async function syncTrajesWithDatabase() {
    try {
        if (!window.connectivityManager || !window.connectivityManager.isOnline) {
            console.log('Sin conexión, no se puede sincronizar');
            return false;
        }

        console.log('Sincronizando trajes con la base de datos...');
        const result = await window.connectivityManager.makeRequest('/trajes');
        
        if (result.success && Array.isArray(result.data)) {
            saveTrajestoLocalStorage(result.data);
            console.log('Sincronización completada exitosamente');
            return true;
        } else {
            console.warn('Error en la sincronización:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Error durante la sincronización:', error);
        return false;
    }
}

// Función para verificar si localStorage necesita actualización
function isLocalStorageStale() {
    const timestamp = localStorage.getItem('lugx_trajes_timestamp');
    if (!timestamp) return true;
    
    const savedTime = parseInt(timestamp);
    const currentTime = Date.now();
    const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
    
    // Considerar obsoleto si tiene más de 1 hora
    return hoursDiff > 1;
}

// Función para refrescar datos automáticamente
async function refreshTrajesData() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline && isLocalStorageStale()) {
            console.log('Refrescando datos de trajes...');
            await syncTrajesWithDatabase();
            await loadTrajes();
        }
    } catch (error) {
        console.error('Error al refrescar datos:', error);
    }
}

// Configurar sincronización automática
function setupAutoSync() {
    // Sincronizar cada 30 minutos
    setInterval(refreshTrajesData, 30 * 60 * 1000);
    
    // Sincronizar cuando la ventana recupera el foco
    window.addEventListener('focus', refreshTrajesData);
    
    // Sincronizar cuando se detecta conexión
    if (window.connectivityManager) {
        window.connectivityManager.onConnectionChange = function(isOnline) {
            if (isOnline) {
                console.log('Conexión restaurada, sincronizando trajes...');
                refreshTrajesData();
            }
        };
    }
}

// Función para obtener estadísticas de localStorage
function getLocalStorageStats() {
    const trajes = getTrajesFromLocalStorage();
    const timestamp = localStorage.getItem('lugx_trajes_timestamp');
    
    return {
        totalTrajes: trajes.length,
        lastUpdate: timestamp ? new Date(parseInt(timestamp)).toLocaleString('es-ES') : 'Nunca',
        isStale: isLocalStorageStale(),
        storageSize: JSON.stringify(trajes).length
    };
}

console.log('🔧 trajes.js cargado correctamente con funcionalidad offline/online');