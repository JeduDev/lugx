// Connectivity Manager - Maneja la conectividad y sincronización
class ConnectivityManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.syncQueue = [];
        this.lastSyncTime = localStorage.getItem('lastSyncTime') || null;
        this.syncInProgress = false;
        this.connectionCallbacks = []; // Array para múltiples callbacks
        
        // Event listeners para cambios de conectividad
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Verificar conectividad al cargar
        this.checkConnectivity();
    }

    // Obtener token de autenticación de la sesión
    getAuthToken() {
        try {
            // Intentar obtener de localStorage primero
            let sessionData = localStorage.getItem('lugx_session');
            if (!sessionData) {
                // Si no está en localStorage, intentar sessionStorage
                sessionData = sessionStorage.getItem('lugx_session');
            }
            
            if (sessionData) {
                const session = JSON.parse(sessionData);
                return session.token || null;
            }
            
            return null;
        } catch (error) {
            console.error('Error al obtener token de autenticación:', error);
            return null;
        }
    }

    // Verificar si hay conectividad real (no solo el estado del navegador)
    async checkConnectivity() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
            
            const response = await fetch(`${this.apiBaseUrl}/health`, {
                method: 'GET',
                mode: 'cors',
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            this.isOnline = response.ok;
        } catch (error) {
            console.log('Error en checkConnectivity:', error.message);
            this.isOnline = false;
        }
        
        this.updateConnectivityStatus();
        return this.isOnline;
    }

    // Manejar cuando se detecta conexión
    async handleOnline() {
        console.log('🌐 Evento online detectado');
        await this.checkConnectivity();
        
        if (this.isOnline) {
            console.log('✅ Conexión confirmada, iniciando sincronización...');
            this.showConnectivityNotification('Conexión restaurada', 'success');
            await this.syncData();
            
            // Ejecutar callbacks de reconexión
            console.log('🔄 Ejecutando callbacks de reconexión...');
            await this.executeConnectionCallbacks();
        } else {
            console.log('❌ Conexión no confirmada después del evento online');
        }
    }

    // Registrar callback para cuando se recupere la conexión
    onConnectionRestored(callback) {
        if (typeof callback === 'function') {
            this.connectionCallbacks.push(callback);
        }
    }

    // Ejecutar todos los callbacks de reconexión
    async executeConnectionCallbacks() {
        for (const callback of this.connectionCallbacks) {
            try {
                await callback();
            } catch (error) {
                console.error('Error ejecutando callback de reconexión:', error);
            }
        }
    }

    // Manejar cuando se pierde conexión
    handleOffline() {
        console.log('Conexión perdida');
        this.isOnline = false;
        this.updateConnectivityStatus();
        this.showConnectivityNotification('Modo offline activado', 'warning');
    }

    // Actualizar indicadores visuales de conectividad
    updateConnectivityStatus() {
        const statusIndicator = document.getElementById('connectivity-status');
        const syncButton = document.getElementById('sync-button');
        
        if (statusIndicator) {
            statusIndicator.className = this.isOnline ? 'status-online' : 'status-offline';
            statusIndicator.innerHTML = this.isOnline 
                ? '<i class="fa fa-wifi"></i> Online' 
                : '<i class="fa fa-wifi-slash"></i> Offline';
        }
        
        if (syncButton) {
            syncButton.disabled = !this.isOnline;
            syncButton.innerHTML = this.isOnline 
                ? '<i class="fa fa-sync"></i> Sincronizar'
                : '<i class="fa fa-sync"></i> Sin conexión';
        }
    }

    // Realizar petición HTTP con fallback a localStorage
    async makeRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        // Si estamos offline, usar localStorage
        if (!this.isOnline) {
            return this.handleOfflineRequest(endpoint, options);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout para requests normales
            
            // Obtener token de autenticación
            const authToken = this.getAuthToken();
            
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return { success: true, data: data.data || data, response };
            
        } catch (error) {
            console.error('Error en petición API:', error);
            
            // Si falla la petición, cambiar a modo offline
            this.isOnline = false;
            this.updateConnectivityStatus();
            
            return this.handleOfflineRequest(endpoint, options);
        }
    }

    // Manejar peticiones cuando estamos offline
    handleOfflineRequest(endpoint, options) {
        const method = options.method || 'GET';
        
        switch (method.toUpperCase()) {
            case 'GET':
                return this.getFromLocalStorage(endpoint);
            case 'POST':
                return this.saveToLocalStorage(endpoint, options.body, 'create');
            case 'PUT':
                return this.saveToLocalStorage(endpoint, options.body, 'update');
            case 'DELETE':
                return this.saveToLocalStorage(endpoint, null, 'delete');
            default:
                return { success: false, error: 'Método no soportado en modo offline' };
        }
    }

    // Obtener datos de localStorage
    getFromLocalStorage(endpoint) {
        try {
            if (endpoint.includes('/rentas')) {
                const rentas = JSON.parse(localStorage.getItem('lugx_rentas') || '[]');
                
                // Si es una petición específica (con ID)
                const idMatch = endpoint.match(/\/rentas\/(\d+)/);
                if (idMatch) {
                    const id = parseInt(idMatch[1]);
                    const renta = rentas.find(r => r.idRenta === id);
                    return renta 
                        ? { success: true, data: renta }
                        : { success: false, error: 'Renta no encontrada' };
                }
                
                // Petición de todas las rentas
                return { success: true, data: rentas };
            }
            
            if (endpoint.includes('/clientes')) {
                const clientes = JSON.parse(localStorage.getItem('lugx_clientes') || '[]');
                
                // Si es una petición específica (con ID)
                const idMatch = endpoint.match(/\/clientes\/(\d+)/);
                if (idMatch) {
                    const id = parseInt(idMatch[1]);
                    const cliente = clientes.find(c => c.idCliente === id);
                    return cliente 
                        ? { success: true, data: cliente }
                        : { success: false, error: 'Cliente no encontrado' };
                }
                
                // Petición de todos los clientes
                return { success: true, data: clientes };
            }
            
            if (endpoint.includes('/trajes')) {
                const trajes = JSON.parse(localStorage.getItem('lugx_trajes') || '[]');
                
                // Si es una petición específica (con ID)
                const idMatch = endpoint.match(/\/trajes\/(\d+)/);
                if (idMatch) {
                    const id = parseInt(idMatch[1]);
                    const traje = trajes.find(t => t.id === id);
                    return traje 
                        ? { success: true, data: traje }
                        : { success: false, error: 'Traje no encontrado' };
                }
                
                // Petición de todos los trajes
                return { success: true, data: trajes };
            }
            
            if (endpoint.includes('/notifications')) {
                const notificaciones = JSON.parse(localStorage.getItem('lugx_notificaciones') || '[]');
                
                // Si es una petición específica (con ID)
                const idMatch = endpoint.match(/\/notifications\/(\d+)/);
                if (idMatch) {
                    const id = parseInt(idMatch[1]);
                    const notificacion = notificaciones.find(n => n.idNotificacion === id);
                    return notificacion 
                        ? { success: true, data: notificacion }
                        : { success: false, error: 'Notificación no encontrada' };
                }
                
                // Si es petición de estadísticas
                if (endpoint.includes('/stats')) {
                    const total = notificaciones.length;
                    const unread = notificaciones.filter(n => !n.leida).length;
                    const high_priority = notificaciones.filter(n => n.prioridad === 'high').length;
                    const today = notificaciones.filter(n => {
                        const fechaCreacion = new Date(n.fechaCreacion);
                        const hoy = new Date();
                        return fechaCreacion.toDateString() === hoy.toDateString();
                    }).length;
                    
                    return { 
                        success: true, 
                        data: { 
                            total, 
                            unread, 
                            high_priority, 
                            today,
                            by_type: {},
                            by_priority: {}
                        } 
                    };
                }
                
                // Petición de todas las notificaciones
                return { success: true, data: notificaciones };
            }
            
            return { success: false, error: 'Endpoint no soportado en modo offline' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Guardar en localStorage y cola de sincronización
    saveToLocalStorage(endpoint, body, operation) {
        try {
            const data = body ? JSON.parse(body) : null;
            
            if (endpoint.includes('/rentas')) {
                let rentas = JSON.parse(localStorage.getItem('lugx_rentas') || '[]');
                
                switch (operation) {
                    case 'create':
                        const newId = rentas.length > 0 ? Math.max(...rentas.map(r => r.idRenta)) + 1 : 1;
                        const newRenta = { ...data, idRenta: newId, _pendingSync: true };
                        rentas.push(newRenta);
                        
                        // Agregar a cola de sincronización
                        this.addToSyncQueue('create', '/rentas', newRenta);
                        break;
                        
                    case 'update':
                        const idMatch = endpoint.match(/\/rentas\/(\d+)/);
                        if (idMatch) {
                            const id = parseInt(idMatch[1]);
                            const index = rentas.findIndex(r => r.idRenta === id);
                            if (index !== -1) {
                                rentas[index] = { ...rentas[index], ...data, _pendingSync: true };
                                this.addToSyncQueue('update', endpoint, rentas[index]);
                            }
                        }
                        break;
                        
                    case 'delete':
                        const deleteIdMatch = endpoint.match(/\/rentas\/(\d+)/);
                        if (deleteIdMatch) {
                            const id = parseInt(deleteIdMatch[1]);
                            const index = rentas.findIndex(r => r.idRenta === id);
                            if (index !== -1) {
                                this.addToSyncQueue('delete', endpoint, { idRenta: id });
                                rentas.splice(index, 1);
                            }
                        }
                        break;
                }
                
                localStorage.setItem('lugx_rentas', JSON.stringify(rentas));
                return { success: true, data: data };
            }
            
            if (endpoint.includes('/clientes')) {
                let clientes = JSON.parse(localStorage.getItem('lugx_clientes') || '[]');
                
                switch (operation) {
                    case 'create':
                        const newClienteId = clientes.length > 0 ? Math.max(...clientes.map(c => c.idCliente)) + 1 : 1;
                        const newCliente = { ...data, idCliente: newClienteId, _pendingSync: true };
                        clientes.push(newCliente);
                        
                        // Agregar a cola de sincronización
                        this.addToSyncQueue('create', '/clientes', newCliente);
                        break;
                        
                    case 'update':
                        const clienteIdMatch = endpoint.match(/\/clientes\/(\d+)/);
                        if (clienteIdMatch) {
                            const id = parseInt(clienteIdMatch[1]);
                            const index = clientes.findIndex(c => c.idCliente === id);
                            if (index !== -1) {
                                clientes[index] = { ...clientes[index], ...data, _pendingSync: true };
                                this.addToSyncQueue('update', endpoint, clientes[index]);
                            }
                        }
                        break;
                        
                    case 'delete':
                        const deleteClienteIdMatch = endpoint.match(/\/clientes\/(\d+)/);
                        if (deleteClienteIdMatch) {
                            const id = parseInt(deleteClienteIdMatch[1]);
                            const index = clientes.findIndex(c => c.idCliente === id);
                            if (index !== -1) {
                                this.addToSyncQueue('delete', endpoint, { idCliente: id });
                                clientes.splice(index, 1);
                            }
                        }
                        break;
                }
                
                localStorage.setItem('lugx_clientes', JSON.stringify(clientes));
                return { success: true, data: data };
            }
            
            if (endpoint.includes('/trajes')) {
                let trajes = JSON.parse(localStorage.getItem('lugx_trajes') || '[]');
                
                switch (operation) {
                    case 'create':
                        const newTrajeId = trajes.length > 0 ? Math.max(...trajes.map(t => t.id)) + 1 : 1;
                        const newTraje = { ...data, id: newTrajeId, _pendingSync: true };
                        trajes.push(newTraje);
                        
                        // Agregar a cola de sincronización
                        this.addToSyncQueue('create', '/trajes', newTraje);
                        break;
                        
                    case 'update':
                        const trajeIdMatch = endpoint.match(/\/trajes\/(\d+)/);
                        if (trajeIdMatch) {
                            const id = parseInt(trajeIdMatch[1]);
                            const index = trajes.findIndex(t => t.id === id);
                            if (index !== -1) {
                                trajes[index] = { ...trajes[index], ...data, _pendingSync: true };
                                this.addToSyncQueue('update', endpoint, trajes[index]);
                            }
                        }
                        break;
                        
                    case 'delete':
                        const deleteTrajeIdMatch = endpoint.match(/\/trajes\/(\d+)/);
                        if (deleteTrajeIdMatch) {
                            const id = parseInt(deleteTrajeIdMatch[1]);
                            const index = trajes.findIndex(t => t.id === id);
                            if (index !== -1) {
                                this.addToSyncQueue('delete', endpoint, { id: id });
                                trajes.splice(index, 1);
                            }
                        }
                        break;
                }
                
                localStorage.setItem('lugx_trajes', JSON.stringify(trajes));
                return { success: true, data: data };
            }
            
            if (endpoint.includes('/notifications')) {
                let notificaciones = JSON.parse(localStorage.getItem('lugx_notificaciones') || '[]');
                
                switch (operation) {
                    case 'create':
                        const newNotificationId = notificaciones.length > 0 ? Math.max(...notificaciones.map(n => n.idNotificacion)) + 1 : 1;
                        const newNotification = { 
                            ...data, 
                            idNotificacion: newNotificationId, 
                            fechaCreacion: new Date().toISOString(),
                            fechaActualizacion: new Date().toISOString(),
                            leida: false,
                            activa: 1,
                            _pendingSync: true 
                        };
                        notificaciones.push(newNotification);
                        
                        // Agregar a cola de sincronización
                        this.addToSyncQueue('create', '/notifications', newNotification);
                        break;
                        
                    case 'update':
                        const notificationIdMatch = endpoint.match(/\/notifications\/(\d+)/);
                        if (notificationIdMatch) {
                            const id = parseInt(notificationIdMatch[1]);
                            const index = notificaciones.findIndex(n => n.idNotificacion === id);
                            if (index !== -1) {
                                notificaciones[index] = { 
                                    ...notificaciones[index], 
                                    ...data, 
                                    fechaActualizacion: new Date().toISOString(),
                                    _pendingSync: true 
                                };
                                this.addToSyncQueue('update', endpoint, notificaciones[index]);
                            }
                        }
                        break;
                        
                    case 'delete':
                        const deleteNotificationIdMatch = endpoint.match(/\/notifications\/(\d+)/);
                        if (deleteNotificationIdMatch) {
                            const id = parseInt(deleteNotificationIdMatch[1]);
                            const index = notificaciones.findIndex(n => n.idNotificacion === id);
                            if (index !== -1) {
                                this.addToSyncQueue('delete', endpoint, { idNotificacion: id });
                                notificaciones.splice(index, 1);
                            }
                        }
                        break;
                }
                
                localStorage.setItem('lugx_notificaciones', JSON.stringify(notificaciones));
                return { success: true, data: data };
            }
            
            return { success: false, error: 'Endpoint no soportado para escritura offline' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Agregar operación a la cola de sincronización
    addToSyncQueue(operation, endpoint, data) {
        console.log(`📝 Agregando a cola de sincronización: ${operation} en ${endpoint}`, data);
        
        const syncItem = {
            id: Date.now() + Math.random(),
            operation,
            endpoint,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.syncQueue.push(syncItem);
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
        
        console.log(`📋 Cola actualizada (${this.syncQueue.length} elementos):`, this.syncQueue);
        
        this.updateSyncIndicator();
    }

    // Sincronizar datos pendientes
    async syncData() {
        console.log('🚀 Iniciando proceso de sincronización...');
        console.log('📡 Estado online:', this.isOnline);
        console.log('🔄 Sincronización en progreso:', this.syncInProgress);
        
        if (this.syncInProgress || !this.isOnline) {
            console.log('⏸️ Sincronización cancelada - offline o ya en progreso');
            return;
        }
        
        this.syncInProgress = true;
        this.updateSyncIndicator();
        
        try {
            // Cargar cola de sincronización
            this.syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
            console.log('📋 Cola de sincronización cargada:', this.syncQueue);
            
            // Primero sincronizar datos del servidor a localStorage
            console.log('⬇️ Sincronizando desde servidor...');
            await this.syncFromServer();
            
            // Luego sincronizar cambios locales al servidor
            console.log('⬆️ Sincronizando hacia servidor...');
            await this.syncToServer();
            
            // Actualizar timestamp de última sincronización
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', this.lastSyncTime);
            
            console.log('✅ Proceso de sincronización completado');
            this.showConnectivityNotification('Sincronización completada', 'success');
            
            // Refrescar datos en la interfaz si estamos en la página de notificaciones
            if (window.location.pathname.includes('notifications.html') && typeof window.loadNotifications === 'function') {
                console.log('🔄 Refrescando interfaz de notificaciones...');
                await window.loadNotifications();
                if (typeof window.updateStats === 'function') {
                    await window.updateStats();
                }
            }
            
        } catch (error) {
            console.error('❌ Error durante la sincronización:', error);
            this.showConnectivityNotification('Error en la sincronización', 'error');
        } finally {
            this.syncInProgress = false;
            this.updateSyncIndicator();
        }
    }

    // Sincronizar datos del servidor a localStorage
    async syncFromServer() {
        try {
            // Sincronizar rentas
            const rentasResponse = await fetch(`${this.apiBaseUrl}/rentas`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (rentasResponse.ok) {
                const result = await rentasResponse.json();
                const serverRentas = result.data || [];
                
                // Obtener rentas locales
                const localRentas = JSON.parse(localStorage.getItem('lugx_rentas') || '[]');
                
                // Merge de datos: priorizar datos del servidor para registros sin cambios pendientes
                const mergedRentas = [...serverRentas];
                
                // Agregar registros locales que no están en el servidor
                localRentas.forEach(localRenta => {
                    if (localRenta._pendingSync && !serverRentas.find(sr => sr.idRenta === localRenta.idRenta)) {
                        mergedRentas.push(localRenta);
                    }
                });
                
                localStorage.setItem('lugx_rentas', JSON.stringify(mergedRentas));
            }
            
            // Sincronizar clientes
            const clientesResponse = await fetch(`${this.apiBaseUrl}/clientes`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (clientesResponse.ok) {
                const result = await clientesResponse.json();
                const serverClientes = result.data || [];
                
                // Obtener clientes locales
                const localClientes = JSON.parse(localStorage.getItem('lugx_clientes') || '[]');
                
                // Merge de datos: priorizar datos del servidor para registros sin cambios pendientes
                const mergedClientes = [...serverClientes];
                
                // Agregar registros locales que no están en el servidor
                localClientes.forEach(localCliente => {
                    if (localCliente._pendingSync && !serverClientes.find(sc => sc.idCliente === localCliente.idCliente)) {
                        mergedClientes.push(localCliente);
                    }
                });
                
                localStorage.setItem('lugx_clientes', JSON.stringify(mergedClientes));
            }
            
            // Sincronizar trajes
            const trajesResponse = await fetch(`${this.apiBaseUrl}/trajes`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (trajesResponse.ok) {
                const result = await trajesResponse.json();
                const serverTrajes = result.data || [];
                
                // Obtener trajes locales
                const localTrajes = JSON.parse(localStorage.getItem('lugx_trajes') || '[]');
                
                // Merge de datos: priorizar datos del servidor para registros sin cambios pendientes
                const mergedTrajes = [...serverTrajes];
                
                // Agregar registros locales que no están en el servidor
                localTrajes.forEach(localTraje => {
                    if (localTraje._pendingSync && !serverTrajes.find(st => st.id === localTraje.id)) {
                        mergedTrajes.push(localTraje);
                    }
                });
                
                localStorage.setItem('lugx_trajes', JSON.stringify(mergedTrajes));
            }
            
            // Sincronizar notificaciones
            const notificationsResponse = await fetch(`${this.apiBaseUrl}/notifications`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (notificationsResponse.ok) {
                const result = await notificationsResponse.json();
                const serverNotifications = result.data?.notifications || result.data || [];
                
                // Obtener notificaciones locales
                const localNotifications = JSON.parse(localStorage.getItem('lugx_notificaciones') || '[]');
                
                // Merge de datos: priorizar datos del servidor para registros sin cambios pendientes
                const mergedNotifications = [...serverNotifications];
                
                // Agregar registros locales que no están en el servidor y tienen cambios pendientes
                localNotifications.forEach(localNotification => {
                    if (localNotification._pendingSync) {
                        // Para notificaciones con IDs temporales (creadas offline), mantenerlas hasta que se sincronicen
                        const existsOnServer = serverNotifications.find(sn => 
                            sn.idNotificacion === localNotification.idNotificacion ||
                            (sn.titulo === localNotification.titulo && 
                             sn.mensaje === localNotification.mensaje &&
                             Math.abs(new Date(sn.fechaCreacion) - new Date(localNotification.fechaCreacion)) < 60000) // 1 minuto de diferencia
                        );
                        
                        if (!existsOnServer) {
                            mergedNotifications.push(localNotification);
                        }
                    }
                });
                
                localStorage.setItem('lugx_notificaciones', JSON.stringify(mergedNotifications));
                console.log(`📱 Notificaciones sincronizadas: ${serverNotifications.length} del servidor, ${mergedNotifications.length} total`);
            }
        } catch (error) {
            console.error('Error sincronizando desde servidor:', error);
        }
    }

    // Sincronizar cambios locales al servidor
    async syncToServer() {
        console.log('🔄 Iniciando sincronización al servidor...');
        console.log('📋 Cola de sincronización:', this.syncQueue);
        
        const successfulSyncs = [];
        
        for (const syncItem of this.syncQueue) {
            console.log(`🔄 Procesando: ${syncItem.operation} en ${syncItem.endpoint}`, syncItem.data);
            try {
                let response;
                const url = `${this.apiBaseUrl}${syncItem.endpoint}`;
                const headers = { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                };
                
                console.log(`📡 Enviando ${syncItem.operation} a ${url}`);
                console.log('📦 Headers:', headers);
                console.log('📦 Body:', JSON.stringify(syncItem.data));
                
                switch (syncItem.operation) {
                    case 'create':
                        response = await fetch(url, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(syncItem.data)
                        });
                        break;
                        
                    case 'update':
                        response = await fetch(url, {
                            method: 'PUT',
                            headers: headers,
                            body: JSON.stringify(syncItem.data)
                        });
                        break;
                        
                    case 'delete':
                        response = await fetch(url, {
                            method: 'DELETE',
                            headers: headers
                        });
                        break;
                }
                
                console.log(`📡 Respuesta del servidor:`, response.status, response.statusText);
                
                if (response && response.ok) {
                    console.log(`✅ Sincronización exitosa para ${syncItem.operation} en ${syncItem.endpoint}`);
                    successfulSyncs.push(syncItem.id);
                    
                    // Obtener datos de respuesta del servidor
                    const responseData = await response.json();
                    console.log(`📦 Datos de respuesta:`, responseData);
                    
                    // Remover flag de sincronización pendiente y actualizar con datos del servidor
                    if (syncItem.operation !== 'delete') {
                        if (syncItem.endpoint.includes('/rentas')) {
                            const rentas = JSON.parse(localStorage.getItem('lugx_rentas') || '[]');
                            const index = rentas.findIndex(r => r.idRenta === syncItem.data.idRenta);
                            if (index !== -1) {
                                delete rentas[index]._pendingSync;
                                delete rentas[index]._tempId;
                                localStorage.setItem('lugx_rentas', JSON.stringify(rentas));
                            }
                        } else if (syncItem.endpoint.includes('/clientes')) {
                            const clientes = JSON.parse(localStorage.getItem('lugx_clientes') || '[]');
                            const index = clientes.findIndex(c => c.idCliente === syncItem.data.idCliente);
                            if (index !== -1) {
                                delete clientes[index]._pendingSync;
                                delete clientes[index]._tempId;
                                localStorage.setItem('lugx_clientes', JSON.stringify(clientes));
                            }
                        } else if (syncItem.endpoint.includes('/trajes')) {
                            const trajes = JSON.parse(localStorage.getItem('lugx_trajes') || '[]');
                            const index = trajes.findIndex(t => t.id === syncItem.data.id);
                            if (index !== -1) {
                                delete trajes[index]._pendingSync;
                                delete trajes[index]._tempId;
                                localStorage.setItem('lugx_trajes', JSON.stringify(trajes));
                            }
                        } else if (syncItem.endpoint.includes('/notifications')) {
                            const notificaciones = JSON.parse(localStorage.getItem('lugx_notificaciones') || '[]');
                            
                            if (syncItem.operation === 'create' && responseData.success && responseData.data) {
                                // Para operaciones CREATE, reemplazar la notificación temporal con la del servidor
                                const tempIndex = notificaciones.findIndex(n => 
                                    n.idNotificacion === syncItem.data.idNotificacion && n._pendingSync
                                );
                                if (tempIndex !== -1) {
                                    // Reemplazar con datos del servidor
                                    notificaciones[tempIndex] = responseData.data;
                                    console.log(`🔄 Notificación temporal ID ${syncItem.data.idNotificacion} reemplazada con ID real ${responseData.data.idNotificacion}`);
                                }
                            } else {
                                // Para operaciones UPDATE, solo remover flags
                                const index = notificaciones.findIndex(n => n.idNotificacion === syncItem.data.idNotificacion);
                                if (index !== -1) {
                                    delete notificaciones[index]._pendingSync;
                                    delete notificaciones[index]._tempId;
                                }
                            }
                            
                            localStorage.setItem('lugx_notificaciones', JSON.stringify(notificaciones));
                        }
                    }
                } else {
                    // Manejar respuestas no exitosas
                    const errorData = await response.text();
                    console.error(`❌ Error en respuesta del servidor (${response.status}):`, errorData);
                    console.error(`❌ Falló sincronización de ${syncItem.operation} en ${syncItem.endpoint}`);
                }
                
            } catch (error) {
                console.error(`❌ Error sincronizando ${syncItem.operation} en ${syncItem.endpoint}:`, error);
            }
        }
        
        // Remover elementos sincronizados exitosamente de la cola
        this.syncQueue = this.syncQueue.filter(item => !successfulSyncs.includes(item.id));
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
        
        console.log(`🎯 Sincronización completada. ${successfulSyncs.length} elementos sincronizados exitosamente`);
        console.log('📋 Cola restante:', this.syncQueue);
    }

    // Actualizar indicador de sincronización
    updateSyncIndicator() {
        const syncIndicator = document.getElementById('sync-indicator');
        const pendingCount = this.syncQueue.length;
        
        if (syncIndicator) {
            if (this.syncInProgress) {
                syncIndicator.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sincronizando...';
                syncIndicator.className = 'sync-indicator syncing';
            } else if (pendingCount > 0) {
                syncIndicator.innerHTML = `<i class="fa fa-clock"></i> ${pendingCount} pendiente(s)`;
                syncIndicator.className = 'sync-indicator pending';
            } else {
                syncIndicator.innerHTML = '<i class="fa fa-check"></i> Sincronizado';
                syncIndicator.className = 'sync-indicator synced';
            }
        }
    }

    // Mostrar notificación de conectividad
    showConnectivityNotification(message, type = 'info') {
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `connectivity-notification ${type}`;
        notification.innerHTML = `
            <i class="fa fa-${type === 'success' ? 'check' : type === 'warning' ? 'exclamation-triangle' : 'info'}"></i>
            ${message}
        `;
        
        // Agregar estilos si no existen
        if (!document.getElementById('connectivity-styles')) {
            const styles = document.createElement('style');
            styles.id = 'connectivity-styles';
            styles.textContent = `
                .connectivity-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 4px;
                    color: white;
                    font-weight: 500;
                    z-index: 10000;
                    animation: slideIn 0.3s ease-out;
                }
                .connectivity-notification.success { background-color: #28a745; }
                .connectivity-notification.warning { background-color: #ffc107; color: #212529; }
                .connectivity-notification.error { background-color: #dc3545; }
                .connectivity-notification.info { background-color: #17a2b8; }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                .status-online { color: #28a745; }
                .status-offline { color: #dc3545; }
                
                .sync-indicator.syncing { color: #007bff; }
                .sync-indicator.pending { color: #ffc107; }
                .sync-indicator.synced { color: #28a745; }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    // Forzar sincronización manual
    async forcSync() {
        if (this.isOnline) {
            await this.syncData();
        } else {
            this.showConnectivityNotification('No hay conexión disponible', 'warning');
        }
    }
}

// Instancia global del manager de conectividad
window.connectivityManager = new ConnectivityManager();