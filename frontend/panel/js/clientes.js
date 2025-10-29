// Clientes Management JavaScript

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
    console.error('storage-utils.js debe ser cargado antes que clientes.js');
}

// Función para limpiar localStorage de clientes
function clearClientesCache() {
    localStorage.removeItem('lugx_clientes');
    localStorage.removeItem('lugx_clientes_timestamp');
    console.log('Cache de clientes limpiado');
}

// Función para guardar clientes en localStorage con timestamp
function saveClientesToLocalStorage(clientes) {
    try {
        localStorage.setItem('lugx_clientes', JSON.stringify(clientes));
        localStorage.setItem('lugx_clientes_timestamp', Date.now().toString());
        console.log('Clientes guardados en localStorage:', clientes.length, 'registros');
        return true;
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
        return false;
    }
}

// Función para obtener clientes desde localStorage
function getClientesFromLocalStorage() {
    try {
        const clientes = localStorage.getItem('lugx_clientes');
        const timestamp = localStorage.getItem('lugx_clientes_timestamp');
        
        if (clientes && timestamp) {
            const data = JSON.parse(clientes);
            const savedTime = parseInt(timestamp);
            const currentTime = Date.now();
            const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
            
            // Si los datos tienen menos de 24 horas, los usamos
            if (hoursDiff < 24) {
                console.log('Cargando clientes desde localStorage:', data.length, 'registros');
                return data;
            } else {
                console.log('Datos de localStorage obsoletos, limpiando...');
                clearClientesCache();
                return [];
            }
        }
        return [];
    } catch (error) {
        console.error('Error al leer localStorage:', error);
        clearClientesCache();
        return [];
    }
}

// Funciones para obtener clientes (online/offline) - MEJORADA
async function getClientes() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            console.log('Obteniendo clientes desde la API...');
            const result = await window.connectivityManager.makeRequest('/clientes');
            if (result.success && Array.isArray(result.data)) {
                // Guardar automáticamente en localStorage cuando obtenemos datos de la API
                saveClientesToLocalStorage(result.data);
                return result.data;
            } else {
                console.warn('API no devolvió datos válidos, usando localStorage como fallback');
                return getClientesFromLocalStorage();
            }
        }
        
        // Fallback a localStorage cuando estamos offline
        console.log('Sin conexión, cargando desde localStorage...');
        return getClientesFromLocalStorage();
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        // En caso de error, intentar cargar desde localStorage
        return getClientesFromLocalStorage();
    }
}

// Crear cliente (online/offline)
async function createCliente(clienteData) {
    try {
        // Siempre usar ConnectivityManager para manejar online/offline automáticamente
        const result = await window.connectivityManager.makeRequest('/clientes', {
            method: 'POST',
            body: JSON.stringify(clienteData)
        });
        
        return result;
    } catch (error) {
        console.error('Error al crear cliente:', error);
        return { success: false, error: error.message };
    }
}

// Actualizar cliente (online/offline)
async function updateCliente(id, clienteData) {
    try {
        // Siempre usar ConnectivityManager para manejar online/offline automáticamente
        const result = await window.connectivityManager.makeRequest(`/clientes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(clienteData)
        });
        
        return result;
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        return { success: false, error: error.message };
    }
}

// Eliminar cliente (online/offline)
async function deleteClienteById(id) {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            const result = await window.connectivityManager.makeRequest(`/clientes/${id}`, {
                method: 'DELETE'
            });
            if (result.success) {
                return result;
            }
        }
        
        // Fallback offline
        if (window.storageManager.deleteItem('clientes', id)) {
            return { success: true };
        } else {
            return { success: false, error: 'Error al eliminar offline' };
        }
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        return { success: false, error: error.message };
    }
}

// Los datos de clientes ahora se cargan únicamente desde la base de datos

// Load clientes on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Esperar a que el connectivity manager esté listo
    if (window.connectivityManager) {
        await window.connectivityManager.checkConnectivity();
    }
    
    // Configurar sincronización automática
    setupAutoSync();
    
    // Cargar clientes (ahora con localStorage habilitado)
    await loadClientes();
    setupEventListeners();
    
    // Mostrar estadísticas de localStorage en consola
    const stats = getLocalStorageStats();
    console.log('Estadísticas de localStorage:', stats);
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchCliente').addEventListener('input', function() {
        filterClientes();
    });

    // Status filter
    document.getElementById('filterStatus').addEventListener('change', function() {
        filterClientes();
    });
}

// Load and display clientes
async function loadClientes() {
    try {
        showLoadingIndicator(true);
        const clientes = await getClientes();
        displayClientes(clientes);
        updateStatsCards(clientes);
    } catch (error) {
        console.error('Error cargando clientes:', error);
        showNotification('Error al cargar clientes', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// Display clientes in table
function displayClientes(clientes) {
    const tableBody = document.getElementById('clientesTableBody');
    tableBody.innerHTML = '';

    if (clientes.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" class="text-center">
                <div class="empty-state">
                    <i class="fa fa-users fa-3x text-muted mb-3"></i>
                    <h5>No hay clientes registrados</h5>
                    <p class="text-muted">Comienza agregando tu primer cliente</p>
                    <button class="btn btn-primary" onclick="openAddClienteModal()">
                        <i class="fa fa-plus"></i> Agregar Cliente
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }

    clientes.forEach(cliente => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cliente.idCliente}</td>
            <td>${cliente.nombreCliente}</td>
            <td>${cliente.telefono}</td>
            <td>${cliente.correoElectronico}</td>
            <td>
                <span class="badge ${(cliente.rentasActivas || 0) > 0 ? 'badge-success' : 'badge-secondary'}">
                    ${cliente.rentasActivas || 0}
                </span>
            </td>
            <td>${formatDate(cliente.fechaRegistro || cliente.created_at)}</td>
            <td>
                <button class="btn btn-edit" onclick="editCliente(${cliente.idCliente})" title="Editar">
                    <i class="fa fa-edit"></i>
                </button>
                <button class="btn btn-delete" onclick="deleteCliente(${cliente.idCliente})" title="Eliminar">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Filter clientes
async function filterClientes() {
    const searchTerm = document.getElementById('searchCliente').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const clientes = await getClientes();

    let filteredClientes = clientes.filter(cliente => {
        const matchesSearch = cliente.nombreCliente.toLowerCase().includes(searchTerm) ||
                            cliente.correoElectronico.toLowerCase().includes(searchTerm) ||
                            cliente.telefono.includes(searchTerm);
        
        const matchesStatus = statusFilter === '' || 
                            (statusFilter === 'activo' && cliente.activo === 1) ||
                            (statusFilter === 'inactivo' && cliente.activo === 0);

        return matchesSearch && matchesStatus;
    });

    displayClientes(filteredClientes);
}

// Open add cliente modal
function openAddClienteModal() {
    document.getElementById('clienteModalTitle').textContent = 'Agregar Cliente';
    document.getElementById('clienteForm').reset();
    document.getElementById('clienteId').value = '';
    $('#clienteModal').modal('show');
}

// Edit cliente
async function editCliente(id) {
    try {
        const clientes = await getClientes();
        const cliente = clientes.find(c => c.idCliente === parseInt(id));
        
        if (cliente) {
            document.getElementById('clienteModalTitle').textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.idCliente;
            document.getElementById('nombreCliente').value = cliente.nombreCliente;
            document.getElementById('telefono').value = cliente.telefono;
            document.getElementById('correoElectronico').value = cliente.correoElectronico;
            $('#clienteModal').modal('show');
        } else {
            showNotification('Cliente no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error al cargar cliente:', error);
        showNotification('Error al cargar los datos del cliente', 'error');
    }
}

// Save cliente (add or update)
async function saveCliente() {
    const form = document.getElementById('clienteForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const clienteId = document.getElementById('clienteId').value;
    const nombreCliente = document.getElementById('nombreCliente').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const correoElectronico = document.getElementById('correoElectronico').value.trim();

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(telefono)) {
        showNotification('El teléfono debe tener exactamente 10 dígitos', 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correoElectronico)) {
        showNotification('Por favor ingrese un correo electrónico válido', 'error');
        return;
    }

    // Check for duplicate email (excluding current cliente if editing)
    const clientes = await getClientes();
    const duplicateEmail = clientes.find(c => 
        c.correoElectronico === correoElectronico && 
        c.idCliente !== parseInt(clienteId)
    );
    
    if (duplicateEmail) {
        showNotification('Ya existe un cliente con este correo electrónico', 'error');
        return;
    }

    try {
        showLoadingIndicator(true);
        
        if (clienteId) {
            // Update existing cliente
            const updateData = {
                nombreCliente,
                telefono,
                correoElectronico
            };
            
            const result = await updateCliente(clienteId, updateData);
            if (result.success) {
                showNotification('Cliente actualizado exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al actualizar el cliente', 'error');
                return;
            }
        } else {
            // Add new cliente
            const newCliente = {
                nombreCliente,
                telefono,
                correoElectronico
            };
            
            const result = await createCliente(newCliente);
            if (result.success) {
                showNotification('Cliente agregado exitosamente', 'success');
            } else {
                showNotification(result.error || 'Error al agregar el cliente', 'error');
                return;
            }
        }

        $('#clienteModal').modal('hide');
        await loadClientes();
    } catch (error) {
        console.error('Error en saveCliente:', error);
        showNotification('Error al procesar la solicitud', 'error');
    } finally {
        showLoadingIndicator(false);
    }
}

// Delete cliente
async function deleteCliente(id) {
    try {
        const clientes = await getClientes();
        const cliente = clientes.find(c => c.idCliente === parseInt(id));
        
        if (cliente) {
            if ((cliente.rentasActivas || 0) > 0) {
                showNotification('No se puede eliminar un cliente con rentas activas', 'error');
                return;
            }

            if (confirm(`¿Está seguro de que desea eliminar al cliente "${cliente.nombreCliente}"?`)) {
                showLoadingIndicator(true);
                const result = await deleteClienteById(id);
                
                if (result.success) {
                    showNotification('Cliente eliminado exitosamente', 'success');
                    await loadClientes();
                } else {
                    showNotification(result.error || 'Error al eliminar el cliente', 'error');
                }
                showLoadingIndicator(false);
            }
        } else {
            showNotification('Cliente no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        showNotification('Error al procesar la solicitud', 'error');
        showLoadingIndicator(false);
    }
}

// Export clientes to CSV
async function exportClientes() {
    try {
        const clientes = await getClientes();
        
        if (clientes.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }

        const headers = ['ID', 'Nombre', 'Teléfono', 'Correo Electrónico', 'Rentas Activas', 'Fecha Registro', 'Estado'];
        const csvContent = [
            headers.join(','),
            ...clientes.map(cliente => [
                cliente.idCliente,
                `"${cliente.nombreCliente}"`,
                cliente.telefono,
                cliente.correoElectronico,
                cliente.rentasActivas || 0,
                cliente.fechaRegistro || cliente.created_at,
                cliente.activo ? 'Activo' : 'Inactivo'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
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
function updateStatsCards(clientes) {
    const totalClientes = clientes.length;
    const clientesActivos = clientes.filter(c => c.activo === 1 || c.activo === true).length;
    
    // Calcular clientes nuevos este mes
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const nuevosEsteMes = clientes.filter(c => {
        const fechaRegistro = new Date(c.fechaRegistro || c.created_at);
        return fechaRegistro.getMonth() === currentMonth && fechaRegistro.getFullYear() === currentYear;
    }).length;
    
    const conRentasActivas = clientes.filter(c => (c.rentasActivas || 0) > 0).length;
    
    // Actualizar los valores en las tarjetas
    const statsCards = document.querySelectorAll('.admin-card .card-content h4');
    if (statsCards.length >= 4) {
        statsCards[0].textContent = totalClientes;
        statsCards[1].textContent = clientesActivos;
        statsCards[2].textContent = nuevosEsteMes;
        statsCards[3].textContent = conRentasActivas;
    }
}

// Utility functions
function formatDate(dateString) {
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
async function syncClientesWithDatabase() {
    try {
        if (!window.connectivityManager || !window.connectivityManager.isOnline) {
            console.log('Sin conexión, no se puede sincronizar');
            return false;
        }

        console.log('Sincronizando clientes con la base de datos...');
        const result = await window.connectivityManager.makeRequest('/clientes');
        
        if (result.success && Array.isArray(result.data)) {
            saveClientesToLocalStorage(result.data);
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
    const timestamp = localStorage.getItem('lugx_clientes_timestamp');
    if (!timestamp) return true;
    
    const savedTime = parseInt(timestamp);
    const currentTime = Date.now();
    const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
    
    // Considerar obsoleto si tiene más de 1 hora
    return hoursDiff > 1;
}

// Función para refrescar datos automáticamente
async function refreshClientesData() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            if (isLocalStorageStale()) {
                console.log('Datos obsoletos detectados, refrescando...');
                await syncClientesWithDatabase();
                
                // Recargar la vista si estamos en la página de clientes
                if (window.location.pathname.includes('clientes.html')) {
                    await loadClientes();
                }
            }
        }
    } catch (error) {
        console.error('Error al refrescar datos:', error);
    }
}

// Función para configurar sincronización automática
function setupAutoSync() {
    // Sincronizar cada 5 minutos si hay conexión
    setInterval(async () => {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            await refreshClientesData();
        }
    }, 5 * 60 * 1000); // 5 minutos

    // Registrar callback para cuando se recupera la conexión
    if (window.connectivityManager) {
        window.connectivityManager.onConnectionRestored(async () => {
            console.log('Conexión restaurada, sincronizando datos de clientes...');
            await syncClientesWithDatabase();
            
            // Recargar la vista si estamos en la página de clientes
            if (window.location.pathname.includes('clientes.html')) {
                await loadClientes();
                showNotification('Datos sincronizados con el servidor', 'success');
            }
        });
    }
}

// Función para obtener estadísticas de localStorage
function getLocalStorageStats() {
    try {
        const clientes = localStorage.getItem('lugx_clientes');
        const timestamp = localStorage.getItem('lugx_clientes_timestamp');
        
        if (!clientes || !timestamp) {
            return {
                hasData: false,
                count: 0,
                lastUpdate: null,
                isStale: true
            };
        }

        const data = JSON.parse(clientes);
        const savedTime = parseInt(timestamp);
        const lastUpdate = new Date(savedTime);
        const hoursDiff = (Date.now() - savedTime) / (1000 * 60 * 60);

        return {
            hasData: true,
            count: data.length,
            lastUpdate: lastUpdate,
            isStale: hoursDiff > 1,
            hoursOld: Math.round(hoursDiff * 10) / 10
        };
    } catch (error) {
        console.error('Error al obtener estadísticas de localStorage:', error);
        return {
            hasData: false,
            count: 0,
            lastUpdate: null,
            isStale: true,
            error: error.message
        };
    }
}