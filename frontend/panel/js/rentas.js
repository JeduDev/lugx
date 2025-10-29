// Rentas Management JavaScript - Sistema Híbrido Online/Offline

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

// API Configuration
const API_CONFIG = {
    baseUrl: window.location.origin + '/api',
    endpoints: {
        rentas: '/rentas',
        clientes: '/clientes',
        trajes: '/trajes'
    }
};

// Funciones para obtener y establecer rentas (ahora híbridas)
async function getRentas() {
    try {
        // Intentar obtener desde API si hay conexión
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            const result = await window.connectivityManager.makeRequest('/rentas');
            if (result.success) {
                // Guardar en localStorage como backup
                localStorage.setItem('lugx_rentas', JSON.stringify(result.data));
                return result.data;
            }
        }
        
        // Fallback a localStorage
        const rentas = localStorage.getItem('lugx_rentas');
        return rentas ? JSON.parse(rentas) : [];
    } catch (error) {
        console.error('Error al obtener rentas:', error);
        // Fallback final a localStorage
        const rentas = localStorage.getItem('lugx_rentas');
        return rentas ? JSON.parse(rentas) : [];
    }
}

function setRentas(rentas) {
    try {
        localStorage.setItem('lugx_rentas', JSON.stringify(rentas));
        return true;
    } catch (error) {
        console.error('Error al guardar rentas:', error);
        return false;
    }
}

// Funciones API para rentas
async function createRenta(rentaData) {
    try {
        const result = await window.connectivityManager.makeRequest('/rentas', {
            method: 'POST',
            body: JSON.stringify(rentaData)
        });
        return result;
    } catch (error) {
        console.error('Error al crear renta:', error);
        return { success: false, error: error.message };
    }
}

async function updateRenta(id, rentaData) {
    try {
        const result = await window.connectivityManager.makeRequest(`/rentas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(rentaData)
        });
        return result;
    } catch (error) {
        console.error('Error al actualizar renta:', error);
        return { success: false, error: error.message };
    }
}

async function deleteRenta(id) {
    try {
        const result = await window.connectivityManager.makeRequest(`/rentas/${id}`, {
            method: 'DELETE'
        });
        return result;
    } catch (error) {
        console.error('Error al eliminar renta:', error);
        return { success: false, error: error.message };
    }
}

async function getRentaById(id) {
    try {
        const result = await window.connectivityManager.makeRequest(`/rentas/${id}`);
        return result;
    } catch (error) {
        console.error('Error al obtener renta:', error);
        return { success: false, error: error.message };
    }
}

// Funciones para obtener clientes y trajes
async function getClientes() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            const result = await window.connectivityManager.makeRequest('/clientes');
            if (result.success) {
                localStorage.setItem('lugx_clientes', JSON.stringify(result.data));
                return result.data;
            }
        }
        
        // Fallback a localStorage
        const clientes = localStorage.getItem('lugx_clientes');
        return clientes ? JSON.parse(clientes) : [];
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        return [];
    }
}

async function getTrajes() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            const result = await window.connectivityManager.makeRequest('/trajes');
            if (result.success) {
                localStorage.setItem('lugx_trajes', JSON.stringify(result.data));
                return result.data;
            }
        }
        
        // Fallback a localStorage
        const trajes = localStorage.getItem('lugx_trajes');
        return trajes ? JSON.parse(trajes) : [];
    } catch (error) {
        console.error('Error al obtener trajes:', error);
        return [];
    }
}

// Datos de muestra eliminados - ahora la aplicación iniciará sin datos por defecto

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
    // Esperar a que el connectivity manager esté listo
    if (window.connectivityManager) {
        await window.connectivityManager.checkConnectivity();
    }
    
    await loadRentas();
    await loadClientesSelect();
    await loadTrajesSelect();
    
    // Search functionality
    document.getElementById('searchRenta').addEventListener('input', filterRentas);
    
    // Filter functionality
    document.getElementById('statusFilter').addEventListener('change', filterRentas);
    document.getElementById('dateFrom').addEventListener('change', filterRentas);
    document.getElementById('dateTo').addEventListener('change', filterRentas);
    
    // Sync button functionality
    const syncButton = document.getElementById('sync-button');
    if (syncButton) {
        syncButton.addEventListener('click', () => {
            if (window.connectivityManager) {
                window.connectivityManager.forcSync();
            }
        });
    }
});

// Load and display rentas
async function loadRentas() {
    try {
        showLoadingIndicator(true);
        let rentasData = await getRentas();
        
        // Mostrar los datos tal como vienen de la base de datos (sin datos de muestra)
        displayRentas(rentasData);
        updateStatsCards(rentasData);
    } catch (error) {
        console.error('Error cargando rentas:', error);
        showNotification('Error al cargar rentas', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// Load clientes into select dropdown
async function loadClientesSelect() {
    const select = document.getElementById('idCliente');
    if (!select) return;
    
    try {
        const clientesData = await getClientes();
        select.innerHTML = '<option value="">Seleccionar Cliente</option>';
        clientesData.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.idCliente;
            option.textContent = cliente.nombreCliente;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

// Load trajes into select dropdown
async function loadTrajesSelect() {
    const select = document.getElementById('idTraje');
    if (!select) return;
    
    try {
        const trajesData = await getTrajes();
        select.innerHTML = '<option value="">Seleccionar Traje</option>';
        trajesData.forEach(traje => {
            const option = document.createElement('option');
            option.value = traje.idTraje;
            option.textContent = traje.nombreTraje;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando trajes:', error);
    }
}

// Actualizar tarjetas de estadísticas
function updateStatsCards(rentas) {
    const totalRentas = rentas.length;
    const activas = rentas.filter(r => r.estado === 'activa').length;
    const completadas = rentas.filter(r => r.estado === 'completada').length;
    const vencidas = rentas.filter(r => r.estado === 'vencida').length;
    
    // Actualizar los valores en las tarjetas
    const statsCards = document.querySelectorAll('.admin-card .card-content h4');
    if (statsCards.length >= 4) {
        statsCards[0].textContent = totalRentas;
        statsCards[1].textContent = activas;
        statsCards[2].textContent = completadas;
        statsCards[3].textContent = vencidas;
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

// Display rentas in table
function displayRentas(rentas) {
    const tbody = document.getElementById('rentasTableBody');
    tbody.innerHTML = '';
    
    if (rentas.length === 0) {
        // Mostrar mensaje cuando no hay rentas
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="8" class="text-center py-4">
                <i class="fa fa-inbox fa-3x text-muted mb-3"></i>
                <p class="text-muted">No hay rentas registradas</p>
                <button class="btn btn-primary" onclick="openAddRentaModal()">
                    <i class="fa fa-plus"></i> Agregar Primera Renta
                </button>
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    rentas.forEach(renta => {
        const row = document.createElement('tr');
        
        const statusBadge = getStatusBadge(renta.estado);
        const fechaInicio = formatDateTime(renta.fechaHoraInicio);
        const fechaFin = formatDateTime(renta.fechaHoraFin);
        
        row.innerHTML = `
            <td>${renta.idRenta}</td>
            <td>${renta.clienteNombre}</td>
            <td>${renta.trajeNombre}</td>
            <td>${renta.descripcion}</td>
            <td>${fechaInicio}</td>
            <td>${fechaFin}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-view" onclick="viewRenta(${renta.idRenta})" title="Ver Detalles">
                    <i class="fa fa-eye"></i>
                </button>
                <button class="btn btn-edit" onclick="editRenta(${renta.idRenta})" title="Editar">
                    <i class="fa fa-edit"></i>
                </button>
                <button class="btn btn-delete" onclick="cancelRenta(${renta.idRenta})" title="Cancelar">
                    <i class="fa fa-times"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Get status badge HTML
function getStatusBadge(estado) {
    const badges = {
        'activa': '<span class="badge bg-success">Activa</span>',
        'completada': '<span class="badge bg-primary">Completada</span>',
        'vencida': '<span class="badge bg-danger">Vencida</span>',
        'cancelada': '<span class="badge bg-secondary">Cancelada</span>'
    };
    return badges[estado] || '<span class="badge bg-secondary">Desconocido</span>';
}

// Filter rentas
function filterRentas() {
    const rentasData = getRentas();
    const searchTerm = document.getElementById('searchRenta').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    let filteredRentas = rentasData.filter(renta => {
        const matchesSearch = renta.clienteNombre.toLowerCase().includes(searchTerm) ||
                            renta.trajeNombre.toLowerCase().includes(searchTerm) ||
                            renta.descripcion.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter || renta.estado === statusFilter;
        
        let matchesDateRange = true;
        if (dateFrom || dateTo) {
            const rentaDate = new Date(renta.fechaHoraInicio).toISOString().split('T')[0];
            if (dateFrom && rentaDate < dateFrom) matchesDateRange = false;
            if (dateTo && rentaDate > dateTo) matchesDateRange = false;
        }
        
        return matchesSearch && matchesStatus && matchesDateRange;
    });
    
    displayRentas(filteredRentas);
}

// Open add renta modal
function openAddRentaModal() {
    document.getElementById('rentaModalTitle').textContent = 'Agregar Nueva Renta';
    document.getElementById('rentaForm').reset();
    document.getElementById('rentaId').value = '';
    document.getElementById('costoTotal').value = '';
    
    // Reload selects to ensure they have latest data
    loadClientesSelect();
    loadTrajesSelect();
    
    // Set minimum date to today
    const now = new Date();
    const minDateTime = now.toISOString().slice(0, 16);
    document.getElementById('fechaHoraInicio').min = minDateTime;
    document.getElementById('fechaHoraFin').min = minDateTime;
    
    $('#rentaModal').modal('show');
}

// Edit renta
async function editRenta(id) {
    try {
        showLoadingIndicator(true);
        const result = await getRentaById(id);
        
        if (result.success && result.data) {
            const renta = result.data;
            document.getElementById('rentaModalTitle').textContent = 'Editar Renta';
            document.getElementById('rentaId').value = renta.idRenta;
            document.getElementById('idCliente').value = renta.idCliente || '';
            document.getElementById('idTraje').value = renta.idTraje;
            document.getElementById('descripcion').value = renta.descripcion;
            document.getElementById('fechaHoraInicio').value = renta.fechaHoraInicio;
            document.getElementById('fechaHoraFin').value = renta.fechaHoraFin;
            document.getElementById('costoTotal').value = renta.precioTotal || 0;
            
            $('#rentaModal').modal('show');
        } else {
            showNotification('Renta no encontrada', 'error');
        }
    } catch (error) {
        console.error('Error al cargar renta:', error);
        showNotification('Error al cargar renta', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// Save renta
async function saveRenta() {
    const form = document.getElementById('rentaForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const rentaId = document.getElementById('rentaId').value;
    const idCliente = document.getElementById('idCliente').value || null;
    const idTraje = parseInt(document.getElementById('idTraje').value);
    const descripcion = document.getElementById('descripcion').value;
    const fechaHoraInicio = document.getElementById('fechaHoraInicio').value;
    const fechaHoraFin = document.getElementById('fechaHoraFin').value;
    const costoTotal = parseFloat(document.getElementById('costoTotal').value);
    
    // Validate dates
    if (new Date(fechaHoraFin) <= new Date(fechaHoraInicio)) {
        showNotification('La fecha de fin debe ser posterior a la fecha de inicio', 'error');
        return;
    }
    
    try {
        showLoadingIndicator(true);
        
        // Obtener datos actuales para nombres
        const clientesData = await getClientes();
        const trajesData = await getTrajes();
        
        // Get client and traje names
        const cliente = clientesData.find(c => c.idCliente == idCliente);
        const traje = trajesData.find(t => t.idTraje == idTraje);
        
        const rentaData = {
            idCliente: idCliente ? parseInt(idCliente) : null,
            idTraje: idTraje,
            descripcion: descripcion,
            fechaHoraInicio: fechaHoraInicio,
            fechaHoraFin: fechaHoraFin,
            precioTotal: costoTotal, // Enviamos como precioTotal para compatibilidad con API
            // Campos adicionales para mostrar
            clienteNombre: cliente ? cliente.nombreCliente : "Sin asignar",
            trajeNombre: traje ? traje.nombreTraje : "Traje desconocido",
            estado: 'activa'
        };
        
        let result;
        if (rentaId) {
            // Update existing renta
            result = await updateRenta(rentaId, rentaData);
            if (result.success) {
                showNotification('Renta actualizada exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al actualizar renta', 'error');
                return;
            }
        } else {
            // Add new renta
            result = await createRenta(rentaData);
            if (result.success) {
                showNotification('Renta agregada exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al crear renta', 'error');
                return;
            }
        }
        
        $('#rentaModal').modal('hide');
        await loadRentas();
        
    } catch (error) {
        console.error('Error al guardar renta:', error);
        showNotification('Error al guardar renta', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// View renta details
function viewRenta(id) {
    const rentasData = getRentas();
    const renta = rentasData.find(r => r.idRenta === id);
    if (!renta) return;
    
    const fechaInicio = formatDateTime(renta.fechaHoraInicio);
    const fechaFin = formatDateTime(renta.fechaHoraFin);
    const duracion = calculateDuration(renta.fechaHoraInicio, renta.fechaHoraFin);
    
    const content = `
        <div class="row">
            <div class="col-md-6">
                <h6>Información de la Renta</h6>
                <p><strong>ID Renta:</strong> ${renta.idRenta}</p>
                <p><strong>Cliente:</strong> ${renta.clienteNombre}</p>
                <p><strong>Traje:</strong> ${renta.trajeNombre}</p>
                <p><strong>Descripción:</strong> ${renta.descripcion}</p>
                <p><strong>Estado:</strong> ${getStatusBadge(renta.estado)}</p>
            </div>
            <div class="col-md-6">
                <h6>Fechas y Duración</h6>
                <p><strong>Fecha de Inicio:</strong> ${fechaInicio}</p>
                <p><strong>Fecha de Fin:</strong> ${fechaFin}</p>
                <p><strong>Duración:</strong> ${duracion}</p>
            </div>
        </div>
    `;
    
    document.getElementById('viewRentaContent').innerHTML = content;
    $('#viewRentaModal').modal('show');
}

// Delete renta
async function deleteRenta(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta renta?')) {
        try {
            showLoadingIndicator(true);
            const result = await deleteRentaById(id);
            
            if (result.success) {
                await loadRentas();
                showNotification('Renta eliminada exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al eliminar renta', 'error');
            }
        } catch (error) {
            console.error('Error al eliminar renta:', error);
            showNotification('Error al eliminar renta', 'error');
        } finally {
            showLoadingIndicator(false);
        }
    }
}

// Cancel renta
async function cancelRenta(id) {
    if (confirm('¿Estás seguro de que deseas cancelar esta renta?')) {
        try {
            showLoadingIndicator(true);
            const result = await deleteRentaById(id);
            
            if (result.success) {
                await loadRentas();
                showNotification('Renta cancelada exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al cancelar renta', 'error');
            }
        } catch (error) {
            console.error('Error al cancelar renta:', error);
            showNotification('Error al cancelar renta', 'error');
        } finally {
            showLoadingIndicator(false);
        }
    }
}

// Calculate duration between two dates
function calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    if (diffDays >= 1) {
        return `${diffDays} día(s)`;
    } else {
        return `${diffHours} hora(s)`;
    }
}

// Format date and time
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Export rentas to CSV
function exportRentas() {
    const rentasData = getRentas();
    const headers = ['ID Renta', 'Cliente', 'Traje', 'Descripción', 'Fecha Inicio', 'Fecha Fin', 'Estado'];
    const csvContent = [
        headers.join(','),
        ...rentasData.map(renta => [
            renta.idRenta,
            `"${renta.clienteNombre}"`,
            `"${renta.trajeNombre}"`,
            `"${renta.descripcion}"`,
            formatDateTime(renta.fechaHoraInicio),
            formatDateTime(renta.fechaHoraFin),
            renta.estado
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'rentas.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Archivo CSV exportado exitosamente', 'success');
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
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