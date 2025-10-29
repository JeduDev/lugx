// storage-utils.js - Utilidades para manejo de localStorage

/**
 * Clase para manejo centralizado de localStorage
 */
class StorageManager {
    constructor() {
        this.prefix = 'lugx_';
        this.initializeDefaultData();
    }

    /**
     * Inicializar datos por defecto si no existen
     */
    initializeDefaultData() {
        // Usuarios por defecto (coinciden con la base de datos)
        if (!this.getItem('usuarios')) {
            const defaultUsers = [
                {
                    id: 1,
                    nombre: "Administrador",
                    email: "admin@rentastrajes.com",
                    password: "admin123",
                    rol: "admin",
                    estado: "activo",
                    ultimoAcceso: "2024-01-15 10:30:00",
                    fechaRegistro: "2023-06-15",
                    avatar: "https://via.placeholder.com/50x50/667eea/ffffff?text=AD",
                    telefono: "+52 555 123 4567",
                    direccion: "Ciudad de México, México"
                },
                {
                    id: 2,
                    nombre: "Moderador",
                    email: "mod@rentastrajes.com",
                    password: "mod123",
                    rol: "empleado",
                    estado: "activo",
                    ultimoAcceso: "2024-01-15 09:15:00",
                    fechaRegistro: "2023-08-20",
                    avatar: "https://via.placeholder.com/50x50/28a745/ffffff?text=MO",
                    telefono: "+52 555 987 6543",
                    direccion: "Guadalajara, México"
                },
                {
                    id: 3,
                    nombre: "Usuario",
                    email: "usuario@rentastrajes.com",
                    password: "usuario123",
                    rol: "empleado",
                    estado: "activo",
                    ultimoAcceso: "2024-01-10 16:45:00",
                    fechaRegistro: "2023-09-10",
                    avatar: "https://via.placeholder.com/50x50/dc3545/ffffff?text=US",
                    telefono: "+52 555 456 7890",
                    direccion: "Monterrey, México"
                }
            ];
            this.setItem('usuarios', defaultUsers);
        }

        // Las notificaciones ahora se cargan únicamente desde la base de datos
        // No se inicializan datos por defecto en localStorage

        // Los clientes ahora se cargan únicamente desde la base de datos
        // No se inicializan datos por defecto en localStorage

        // Trajes por defecto
        if (!this.getItem('trajes')) {
            const defaultTrajes = [
                {
                    id: 1,
                    nombreTraje: "Traje Cruzado Negro",
                    descripcion: "Pantalon de cierre frontal y cremallera, con bolsillos laterales sin boton y traseros con boton. Saco con solapa de pico, recto de dos botones, bolsillo superior de lado izquierdo y dos bolsillos frontales.",
                    estado: "rentado",
                    rentasTotales: 15,
                    ultimaRenta: "2025-02-04",
                    fechaCreacion: "2024-01-15"
                },
                {
                    id: 2,
                    nombreTraje: "Vestido midi mariposas",
                    descripcion: "Vestido de punto midi de cuello a la caja falda de vuelo y estampado de mariposas.",
                    estado: "rentado",
                    rentasTotales: 8,
                    ultimaRenta: "2025-02-04",
                    fechaCreacion: "2024-02-10"
                },
                {
                    id: 3,
                    nombreTraje: "Esmoquin Clásico",
                    descripcion: "Esmoquin negro clásico con solapa de satén, perfecto para eventos formales y bodas.",
                    estado: "disponible",
                    rentasTotales: 22,
                    ultimaRenta: "2025-01-28",
                    fechaCreacion: "2024-01-05"
                },
                {
                    id: 4,
                    nombreTraje: "Traje Azul Marino",
                    descripcion: "Traje azul marino de corte moderno, ideal para eventos de negocios y ceremonias.",
                    estado: "disponible",
                    rentasTotales: 12,
                    ultimaRenta: "2025-01-20",
                    fechaCreacion: "2024-02-15"
                },
                {
                    id: 5,
                    nombreTraje: "Vestido de Noche Elegante",
                    descripcion: "Vestido largo de noche en color negro con detalles de encaje y pedrería.",
                    estado: "mantenimiento",
                    rentasTotales: 18,
                    ultimaRenta: "2025-01-30",
                    fechaCreacion: "2024-01-20"
                }
            ];
            this.setItem('trajes', defaultTrajes);
        }

        // Rentas - inicializar como array vacío sin datos por defecto
        if (!this.getItem('rentas')) {
            this.setItem('rentas', []);
        }

        // Órdenes por defecto
        if (!this.getItem('orders')) {
            const defaultOrders = [
                {
                    id: 1,
                    clienteId: 1,
                    fecha: "2024-01-15",
                    estado: "pendiente",
                    total: 150.00,
                    items: [
                        { trajeId: 1, cantidad: 1, precio: 150.00 }
                    ]
                }
            ];
            this.setItem('orders', defaultOrders);
        }
    }

    /**
     * Obtener un elemento del localStorage
     * @param {string} key - Clave del elemento
     * @returns {any} - Valor del elemento o null si no existe
     */
    getItem(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error al obtener ${key} del localStorage:`, error);
            return null;
        }
    }

    /**
     * Guardar un elemento en localStorage
     * @param {string} key - Clave del elemento
     * @param {any} value - Valor a guardar
     * @returns {boolean} - true si se guardó correctamente
     */
    setItem(key, value) {
        try {
            const fullKey = this.prefix + key;
            const jsonValue = JSON.stringify(value);
            
            localStorage.setItem(fullKey, jsonValue);
            
            return true;
        } catch (error) {
            console.error(`[StorageManager] Error al guardar ${key} en localStorage:`, error);
            return false;
        }
    }

    /**
     * Eliminar un elemento del localStorage
     * @param {string} key - Clave del elemento
     * @returns {boolean} - true si se eliminó correctamente
     */
    removeItem(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error(`Error al eliminar ${key} del localStorage:`, error);
            return false;
        }
    }

    /**
     * Limpiar todos los datos del localStorage
     */
    clear() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Error al limpiar localStorage:', error);
            return false;
        }
    }

    /**
     * Obtener el siguiente ID disponible para una entidad
     * @param {string} entityName - Nombre de la entidad
     * @returns {number} - Siguiente ID disponible
     */
    getNextId(entityName) {
        const items = this.getItem(entityName) || [];
        if (items.length === 0) return 1;
        
        const idField = this.getIdField(entityName);
        const maxId = Math.max(...items.map(item => {
            return item[idField] || 0;
        }));
        
        return maxId + 1;
    }

    /**
     * Agregar un nuevo elemento a una colección
     * @param {string} entityName - Nombre de la entidad
     * @param {object} newItem - Nuevo elemento a agregar
     * @returns {boolean} - true si se agregó correctamente
     */
    addItem(entityName, newItem) {
        try {
            const items = this.getItem(entityName) || [];
            const idField = this.getIdField(entityName);
            
            // Asignar ID si no existe
            if (!newItem[idField]) {
                const nextId = this.getNextId(entityName);
                newItem[idField] = nextId;
            }
            
            items.push(newItem);
            
            return this.setItem(entityName, items);
        } catch (error) {
            console.error(`[StorageManager] Error al agregar elemento a ${entityName}:`, error);
            return false;
        }
    }

    /**
     * Actualizar un elemento en una colección
     * @param {string} entityName - Nombre de la entidad
     * @param {number} id - ID del elemento a actualizar
     * @param {object} updatedItem - Datos actualizados
     * @returns {boolean} - true si se actualizó correctamente
     */
    updateItem(entityName, id, updatedItem) {
        try {
            const items = this.getItem(entityName) || [];
            const idField = this.getIdField(entityName);
            const index = items.findIndex(item => item[idField] == id);
            
            if (index !== -1) {
                items[index] = { ...items[index], ...updatedItem };
                return this.setItem(entityName, items);
            }
            
            return false;
        } catch (error) {
            console.error(`Error al actualizar elemento en ${entityName}:`, error);
            return false;
        }
    }

    /**
     * Eliminar un elemento de una colección
     * @param {string} entityName - Nombre de la entidad
     * @param {number} id - ID del elemento a eliminar
     * @returns {boolean} - true si se eliminó correctamente
     */
    deleteItem(entityName, id) {
        try {
            const items = this.getItem(entityName) || [];
            const idField = this.getIdField(entityName);
            const filteredItems = items.filter(item => item[idField] != id);
            
            return this.setItem(entityName, filteredItems);
        } catch (error) {
            console.error(`Error al eliminar elemento de ${entityName}:`, error);
            return false;
        }
    }

    /**
     * Obtener el campo ID correspondiente para cada entidad
     * @param {string} entityName - Nombre de la entidad
     * @returns {string} - Nombre del campo ID
     */
    getIdField(entityName) {
        const idFields = {
            'usuarios': 'id',
            'notifications': 'id',
            'clientes': 'id',
            'trajes': 'id',
            'rentas': 'idRenta',
            'orders': 'id'
        };
        
        return idFields[entityName] || 'id';
    }

    /**
     * Buscar elementos en una colección
     * @param {string} entityName - Nombre de la entidad
     * @param {function} filterFn - Función de filtro
     * @returns {array} - Elementos que coinciden con el filtro
     */
    findItems(entityName, filterFn) {
        try {
            const items = this.getItem(entityName) || [];
            return items.filter(filterFn);
        } catch (error) {
            console.error(`Error al buscar elementos en ${entityName}:`, error);
            return [];
        }
    }

    /**
     * Obtener un elemento específico por ID
     * @param {string} entityName - Nombre de la entidad
     * @param {number} id - ID del elemento
     * @returns {object|null} - Elemento encontrado o null
     */
    findById(entityName, id) {
        try {
            const items = this.getItem(entityName) || [];
            const idField = this.getIdField(entityName);
            return items.find(item => item[idField] == id) || null;
        } catch (error) {
            console.error(`Error al buscar elemento por ID en ${entityName}:`, error);
            return null;
        }
    }
}

// Crear instancia global del StorageManager
window.storageManager = new StorageManager();

// Exportar funciones de utilidad globales
window.getStorageData = (entityName) => window.storageManager.getItem(entityName);
window.setStorageData = (entityName, data) => window.storageManager.setItem(entityName, data);
window.addStorageItem = (entityName, item) => window.storageManager.addItem(entityName, item);
window.updateStorageItem = (entityName, id, item) => window.storageManager.updateItem(entityName, id, item);
window.deleteStorageItem = (entityName, id) => window.storageManager.deleteItem(entityName, id);
window.findStorageItems = (entityName, filterFn) => window.storageManager.findItems(entityName, filterFn);
window.findStorageById = (entityName, id) => window.storageManager.findById(entityName, id);