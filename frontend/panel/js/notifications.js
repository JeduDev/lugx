// Notifications Management JavaScript

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

// Verificar que connectivity-manager.js esté cargado
if (typeof window.connectivityManager === 'undefined') {
    console.error('connectivity-manager.js debe ser cargado antes que notifications.js');
}

// Verificar que storage-utils.js esté cargado
if (typeof window.storageManager === 'undefined') {
    console.error('storage-utils.js debe ser cargado antes que notifications.js');
}

// Función para limpiar localStorage de notificaciones
function clearNotificationsCache() {
    localStorage.removeItem('lugx_notificaciones');
    localStorage.removeItem('lugx_notificaciones_timestamp');
    console.log('Cache de notificaciones limpiado');
}

// Funciones para manejo de localStorage de notificaciones
function saveNotificationsToLocalStorage(notifications) {
    try {
        localStorage.setItem('lugx_notificaciones', JSON.stringify(notifications));
        localStorage.setItem('lugx_notificaciones_timestamp', Date.now().toString());
        console.log(`${notifications.length} notificaciones guardadas en localStorage`);
    } catch (error) {
        console.error('Error al guardar notificaciones en localStorage:', error);
    }
}

function getNotificationsFromLocalStorage() {
    try {
        const notifications = localStorage.getItem('lugx_notificaciones');
        return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
        console.error('Error al leer notificaciones desde localStorage:', error);
        return [];
    }
}

function isLocalStorageStale() {
    const timestamp = localStorage.getItem('lugx_notificaciones_timestamp');
    if (!timestamp) return true;
    
    const now = Date.now();
    const lastUpdate = parseInt(timestamp);
    const staleTime = 5 * 60 * 1000; // 5 minutos
    
    return (now - lastUpdate) > staleTime;
}

function getLocalStorageStats() {
    const notifications = getNotificationsFromLocalStorage();
    const timestamp = localStorage.getItem('lugx_notificaciones_timestamp');
    
    return {
        totalNotifications: notifications.length,
        lastUpdate: timestamp ? new Date(parseInt(timestamp)).toLocaleString() : 'Nunca',
        isStale: isLocalStorageStale()
    };
}

// Funciones para obtener notificaciones (online/offline) - MEJORADA
async function getNotifications() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            console.log('Obteniendo notificaciones desde la API...');
            const result = await window.connectivityManager.makeRequest('/notifications');
            if (result.success && result.data?.notifications && Array.isArray(result.data.notifications)) {
                // Guardar automáticamente en localStorage cuando obtenemos datos de la API
                saveNotificationsToLocalStorage(result.data.notifications);
                return result.data.notifications;
            } else {
                console.warn('API no devolvió datos válidos, usando localStorage como fallback');
                return getNotificationsFromLocalStorage();
            }
        }
        
        // Fallback a localStorage cuando estamos offline
        console.log('Sin conexión, cargando desde localStorage...');
        return getNotificationsFromLocalStorage();
    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        // En caso de error, intentar cargar desde localStorage
        return getNotificationsFromLocalStorage();
    }
}

async function getNotificationStats() {
    try {
        const response = await window.connectivityManager.makeRequest('/notifications/stats/summary', 'GET');
        return response.data || {};
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        return {};
    }
}

let currentPage = 1;
const notificationsPerPage = 10;

// Funciones globales - Disponibles inmediatamente

// Mostrar modal para crear nueva notificación
function showCreateNotificationModal() {
    const modal = $('#notificationModal');
    const titulo = 'Crear Nueva Notificación';
    
    modal.find('.modal-title').text(titulo);
    
    // Limpiar formulario
    $('#notificationForm')[0].reset();
    $('#notificationId').val('');
    
    modal.modal('show');
}

// Crear notificación (online/offline)
async function createNotification(notificationData) {
    try {
        // Siempre usar ConnectivityManager para manejar online/offline automáticamente
        const result = await window.connectivityManager.makeRequest('/notifications', {
            method: 'POST',
            body: JSON.stringify(notificationData)
        });
        
        return result;
    } catch (error) {
        console.error('Error al crear notificación:', error);
        return { success: false, error: error.message };
    }
}

// Actualizar notificación (online/offline)
async function updateNotification(id, notificationData) {
    try {
        // Siempre usar ConnectivityManager para manejar online/offline automáticamente
        const result = await window.connectivityManager.makeRequest(`/notifications/${id}`, {
            method: 'PUT',
            body: JSON.stringify(notificationData)
        });
        
        return result;
    } catch (error) {
        console.error('Error al actualizar notificación:', error);
        return { success: false, error: error.message };
    }
}

// Función para el botón de guardar
async function saveNotification() {
    const form = document.getElementById('notificationForm');
    const formData = new FormData(form);
    
    const notification = {
        titulo: formData.get('title'),
        mensaje: formData.get('message'),
        tipo: formData.get('type'),
        leida: false,
        activa: 1
    };
    
    // Validaciones
    if (!notification.titulo || !notification.mensaje) {
        showAlert('Por favor, complete todos los campos obligatorios.', 'error');
        return;
    }
    
    const notificationId = $('#notificationId').val();
    
    try {
        let result;
        if (notificationId) {
            // Editar notificación existente
            result = await updateNotification(notificationId, notification);
            if (result.success) {
                showAlert('Notificación actualizada correctamente.', 'success');
            } else {
                showAlert(result.error || 'Error al actualizar la notificación.', 'error');
                return;
            }
        } else {
            // Crear nueva notificación
            result = await createNotification(notification);
            if (result.success) {
                showAlert('Notificación creada correctamente.', 'success');
            } else {
                showAlert(result.error || 'Error al crear la notificación.', 'error');
                return;
            }
        }
        
        // Cerrar modal y recargar tabla
        $('#notificationModal').modal('hide');
        await loadNotifications();
        await updateStats();
        
    } catch (error) {
        console.error('Error al guardar notificación:', error);
        showAlert('Error al guardar la notificación.', 'error');
    }
}

// Editar notificación
async function editNotification(id) {
    try {
        const response = await window.connectivityManager.makeRequest(`/notifications/${id}`, 'GET');
        const notification = response.data;
        
        if (!notification) {
            showAlert('Notificación no encontrada.', 'error');
            return;
        }
        
        const modal = $('#notificationModal');
        modal.find('.modal-title').text('Editar Notificación');
        
        // Llenar formulario
        $('#notificationId').val(notification.idNotificacion);
        $('#notificationTitle').val(notification.titulo);
        $('#notificationMessage').val(notification.mensaje);
        $('#notificationType').val(notification.tipo);
        
        modal.modal('show');
    } catch (error) {
        console.error('Error al cargar notificación:', error);
        showAlert('Error al cargar la notificación.', 'error');
    }
}

// Eliminar notificación (online/offline)
async function deleteNotificationById(id) {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            const result = await window.connectivityManager.makeRequest(`/notifications/${id}`, {
                method: 'DELETE'
            });
            if (result.success) {
                return result;
            }
        }
        
        // Fallback offline
        if (window.storageManager && window.storageManager.deleteItem('notificaciones', id)) {
            return { success: true };
        } else {
            return { success: false, error: 'Error al eliminar offline' };
        }
    } catch (error) {
        console.error('Error al eliminar notificación:', error);
        return { success: false, error: error.message };
    }
}

// Eliminar notificación
async function deleteNotification(id) {
    if (confirm('¿Está seguro de que desea eliminar esta notificación?')) {
        try {
            const result = await deleteNotificationById(id);
            if (result.success) {
                showAlert('Notificación eliminada correctamente.', 'success');
                await loadNotifications();
                await updateStats();
            } else {
                showAlert(result.error || 'Error al eliminar la notificación.', 'error');
            }
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
            showAlert('Error al eliminar la notificación.', 'error');
        }
    }
}

// Marcar como leída/no leída
async function toggleReadStatus(id) {
    try {
        // Primero obtener la notificación actual
        const response = await window.connectivityManager.makeRequest(`/notifications/${id}`, 'GET');
        const notification = response.data;
        
        if (notification) {
            // Cambiar el estado de leída
            const newReadStatus = !notification.leida;
            await window.connectivityManager.makeRequest(
                `/notifications/${id}/read`, 
                'PATCH', 
                { leida: newReadStatus }
            );
            
            await loadNotifications();
            await updateStats();
        }
    } catch (error) {
        console.error('Error al actualizar estado de notificación:', error);
        showAlert('Error al actualizar el estado de la notificación.', 'error');
    }
}

// Mostrar alerta
function showAlert(message, type = 'info') {
    const alertClass = type === 'error' ? 'alert-danger' : 
                      type === 'success' ? 'alert-success' : 
                      type === 'warning' ? 'alert-warning' : 'alert-info';
    
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;
    
    $('#alertContainer').html(alertHtml);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        $('.alert').alert('close');
    }, 5000);
}

// Función loadNotifications disponible globalmente
async function loadNotifications() {
    const tbody = $('#notificationsTableBody');
    tbody.empty();
    
    try {
        // Obtener notificaciones desde el API
        const notifications = await getNotifications();
        
        // Aplicar filtros
        let filteredNotifications = [...notifications];
        
        const filterType = $('#filterType').val();
        const filterStatus = $('#filterStatus').val();
        const search = $('#searchNotification').val().toLowerCase();
        
        if (filterType) {
            filteredNotifications = filteredNotifications.filter(n => n.tipo === filterType);
        }
        
        if (filterStatus) {
            const isRead = filterStatus === 'read';
            filteredNotifications = filteredNotifications.filter(n => n.leida === (isRead ? 1 : 0));
        }
        
        if (search) {
            filteredNotifications = filteredNotifications.filter(n => 
                (n.titulo && n.titulo.toLowerCase().includes(search)) ||
                (n.mensaje && n.mensaje.toLowerCase().includes(search))
            );
        }
        
        // Paginación
        const start = (currentPage - 1) * notificationsPerPage;
        const end = start + notificationsPerPage;
        const pageNotifications = filteredNotifications.slice(start, end);
        
        pageNotifications.forEach(notification => {
            const typeIcon = getTypeIcon(notification.tipo);
            const priorityBadge = getPriorityBadge(notification.prioridad);
            const statusBadge = notification.leida ? 
                '<span class="badge badge-success">Leída</span>' : 
                '<span class="badge badge-warning">No leída</span>';
            
            const row = `
                <tr class="${notification.leida ? '' : 'table-warning'}">
                    <td>${notification.idNotificacion}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            ${typeIcon}
                            <div class="ml-2">
                                <strong>${notification.titulo}</strong>
                                <br>
                                <small class="text-muted">${notification.mensaje.substring(0, 50)}...</small>
                            </div>
                        </div>
                    </td>
                    <td>${priorityBadge}</td>
                    <td>${statusBadge}</td>
                    <td><small>${new Date(notification.fechaCreacion).toLocaleString('es-ES')}</small></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="toggleReadStatus(${notification.idNotificacion})" title="${notification.leida ? 'Marcar como no leída' : 'Marcar como leída'}">
                                <i class="fa fa-${notification.leida ? 'eye-slash' : 'eye'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="editNotification(${notification.idNotificacion})" title="Editar">
                                <i class="fa fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteNotification(${notification.idNotificacion})" title="Eliminar">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
        
        updatePagination(filteredNotifications.length);
    } catch (error) {
        console.error('Error al cargar notificaciones:', error);
        showAlert('Error al cargar las notificaciones.', 'error');
    }
}

// Funciones auxiliares disponibles globalmente
function getTypeIcon(type) {
    const icons = {
        'info': '<i class="fa fa-info-circle text-info"></i>',
        'success': '<i class="fa fa-check-circle text-success"></i>',
        'warning': '<i class="fa fa-exclamation-triangle text-warning"></i>',
        'error': '<i class="fa fa-times-circle text-danger"></i>'
    };
    return icons[type] || icons['info'];
}

function getPriorityBadge(priority) {
    const badges = {
        'high': '<span class="badge badge-danger">Alta</span>',
        'normal': '<span class="badge badge-secondary">Normal</span>',
        'low': '<span class="badge badge-light">Baja</span>'
    };
    return badges[priority] || badges['normal'];
}

function updatePagination(totalNotifications) {
    const totalPages = Math.ceil(totalNotifications / notificationsPerPage);
    const pagination = $('#pagination');
    pagination.empty();
    
    if (totalPages <= 1) return;
    
    // Botón anterior
    pagination.append(`
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Anterior</a>
        </li>
    `);
    
    // Números de página
    for (let i = 1; i <= totalPages; i++) {
        pagination.append(`
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `);
    }
    
    // Botón siguiente
    pagination.append(`
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Siguiente</a>
        </li>
    `);
}

async function updateStats() {
    try {
        const stats = await getNotificationStats();
        
        $('#totalNotifications').text(stats.total || 0);
        $('#unreadNotifications').text(stats.unread || 0);
        $('#highPriorityNotifications').text(stats.highPriority || 0);
        $('#todayNotifications').text(stats.today || 0);
    } catch (error) {
        console.error('Error al actualizar estadísticas:', error);
        // Valores por defecto en caso de error
        $('#totalNotifications').text('0');
        $('#unreadNotifications').text('0');
        $('#highPriorityNotifications').text('0');
        $('#todayNotifications').text('0');
    }
}

// Funciones que dependen de jQuery y DOM
$(document).ready(function() {
    
    function setupEventListeners() {
        // Filtros
        $('#filterType, #filterStatus').on('change', async function() {
            currentPage = 1;
            await loadNotifications();
        });
        
        // Búsqueda
        $('#searchNotification').on('input', async function() {
            currentPage = 1;
            await loadNotifications();
        });
        
        // Formulario de notificación
        $('#notificationForm').on('submit', async function(e) {
            e.preventDefault();
            await saveNotification();
        });
    }
    
    // Función global para cambiar página
    window.changePage = async function(newPage) {
        if (newPage >= 1) {
            currentPage = newPage;
            await loadNotifications();
        }
    };
    
    // Verificar autenticación
    function checkAuthentication() {
        try {
            let sessionData = localStorage.getItem('lugx_session');
            if (!sessionData) {
                sessionData = sessionStorage.getItem('lugx_session');
            }
            
            if (!sessionData) {
                // No hay sesión, redirigir al login
                window.location.href = 'login.html';
                return false;
            }
            
            const session = JSON.parse(sessionData);
            if (!session.token) {
                // No hay token, redirigir al login
                window.location.href = 'login.html';
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            window.location.href = 'login.html';
            return false;
        }
    }

    // Inicializar
    async function initialize() {
        if (!checkAuthentication()) {
            return;
        }
        
        // Esperar a que el connectivity manager esté listo
        if (window.connectivityManager) {
            await window.connectivityManager.checkConnectivity();
        }
        
        // Configurar sincronización automática
        setupAutoSync();
        
        await loadNotifications();
        await updateStats();
        setupEventListeners();
        
        // Mostrar estadísticas de localStorage en consola
        const stats = getLocalStorageStats();
        console.log('Estadísticas de localStorage de notificaciones:', stats);
    }
    
    initialize();
});

// Función para sincronizar localStorage con la base de datos
async function syncNotificationsWithDatabase() {
    try {
        if (!window.connectivityManager || !window.connectivityManager.isOnline) {
            console.log('Sin conexión, no se puede sincronizar notificaciones');
            return false;
        }

        console.log('Sincronizando notificaciones con la base de datos...');
        const result = await window.connectivityManager.makeRequest('/notifications');
        
        if (result.success && result.data?.notifications && Array.isArray(result.data.notifications)) {
            saveNotificationsToLocalStorage(result.data.notifications);
            console.log('Sincronización de notificaciones completada exitosamente');
            return true;
        } else {
            console.warn('Error en la sincronización de notificaciones:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Error durante la sincronización de notificaciones:', error);
        return false;
    }
}

// Función para refrescar datos automáticamente
async function refreshNotificationsData() {
    try {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            if (isLocalStorageStale()) {
                console.log('Datos de notificaciones obsoletos detectados, refrescando...');
                await syncNotificationsWithDatabase();
                
                // Recargar la vista si estamos en la página de notificaciones
                if (window.location.pathname.includes('notifications.html')) {
                    await loadNotifications();
                    await updateStats();
                }
            }
        }
    } catch (error) {
        console.error('Error al refrescar datos de notificaciones:', error);
    }
}

// Función para configurar sincronización automática
function setupAutoSync() {
    // Sincronizar cada 5 minutos si hay conexión
    setInterval(async () => {
        if (window.connectivityManager && window.connectivityManager.isOnline) {
            await refreshNotificationsData();
        }
    }, 5 * 60 * 1000); // 5 minutos

    // Registrar callback para cuando se recupera la conexión
    if (window.connectivityManager) {
        window.connectivityManager.onConnectionRestored(async () => {
            console.log('Conexión restaurada, sincronizando datos de notificaciones...');
            await syncNotificationsWithDatabase();
            
            // Recargar la vista si estamos en la página de notificaciones
            if (window.location.pathname.includes('notifications.html')) {
                await loadNotifications();
                await updateStats();
                showAlert('Datos de notificaciones sincronizados con el servidor', 'success');
            }
        });
    }
}

// Exportar funciones al objeto global window para acceso desde HTML
window.showCreateNotificationModal = showCreateNotificationModal;
window.saveNotification = saveNotification;
window.editNotification = editNotification;
window.deleteNotification = deleteNotification;
window.toggleReadStatus = toggleReadStatus;
window.loadNotifications = loadNotifications;
window.updateStats = updateStats;
window.clearNotificationsCache = clearNotificationsCache;
window.syncNotificationsWithDatabase = syncNotificationsWithDatabase;