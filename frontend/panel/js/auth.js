// auth.js - Gestión de Usuarios del Sistema

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
    console.error('storage-utils.js debe ser cargado antes que auth.js');
}

// Función para obtener usuarios desde localStorage
function getUsuarios() {
    return window.storageManager.getItem('usuarios') || [];
}

// Función para guardar usuarios en localStorage
function setUsuarios(usuarios) {
    return window.storageManager.setItem('usuarios', usuarios);
}

let paginaActual = 1;
const usuariosPorPagina = 10;

// Función principal para cargar usuarios - Solo desde API
async function cargarUsuarios() {
    const tbody = $('#usersTableBody');
    if (!tbody.length) {
        console.warn('Elemento #usersTableBody no encontrado');
        return;
    }
    tbody.empty();

    // Verificar conexión a internet
    if (!navigator.onLine) {
        tbody.append('<tr><td colspan="9" class="text-center">No hay conexión a internet. Este módulo requiere conexión para funcionar.</td></tr>');
        return;
    }

    // Obtener token de sesión
    let sessionData = localStorage.getItem('lugx_session') || sessionStorage.getItem('lugx_session');
    if (!sessionData) {
        window.location.href = 'login.html';
        return;
    }

    const session = JSON.parse(sessionData);
    const token = session.token;

    try {
        // Obtener usuarios desde la API
        const response = await fetch('http://localhost:3000/api/usuarios', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al obtener usuarios');
        }

        const responseData = await response.json();
        
        if (!responseData.success) {
            throw new Error(responseData.message || 'Error al obtener usuarios');
        }

        const usuarios = responseData.data || [];

    // Aplicar filtros
    let usuariosFiltrados = [...usuarios];
    
    const roleFilterElement = $('#roleFilter');
    const statusFilterElement = $('#statusFilter');
    const searchElement = $('#searchUsers');
    
    const filtroRol = roleFilterElement.length ? String(roleFilterElement.val() || '') : '';
    const filtroEstado = statusFilterElement.length ? String(statusFilterElement.val() || '') : '';
    const busqueda = searchElement.length ? String(searchElement.val() || '').toLowerCase() : '';

    if (filtroRol) {
        usuariosFiltrados = usuariosFiltrados.filter(u => u.rol === filtroRol);
    }

    if (filtroEstado) {
        const estadoNumerico = filtroEstado === 'activo' ? 1 : 0;
        usuariosFiltrados = usuariosFiltrados.filter(u => u.activo === estadoNumerico);
    }

    if (busqueda) {
        usuariosFiltrados = usuariosFiltrados.filter(u => 
            (u.nombreUsuario && String(u.nombreUsuario).toLowerCase().includes(busqueda)) ||
            (u.email && String(u.email).toLowerCase().includes(busqueda))
        );
    }

    // Paginación
    const inicio = (paginaActual - 1) * usuariosPorPagina;
    const fin = inicio + usuariosPorPagina;
    const usuariosPagina = usuariosFiltrados.slice(inicio, fin);

    usuariosPagina.forEach(usuario => {
        const estadoBadge = usuario.activo === 1 ? 
            '<span class="badge bg-success">Activo</span>' : 
            '<span class="badge bg-secondary">Inactivo</span>';
        
        let rolBadge;
        switch(usuario.rol) {
            case 'admin':
                rolBadge = '<span class="badge bg-danger">Administrador</span>';
                break;
            case 'manager':
                rolBadge = '<span class="badge bg-warning">Gerente</span>';
                break;
            case 'employee':
                rolBadge = '<span class="badge bg-info">Empleado</span>';
                break;
            default:
                rolBadge = '<span class="badge bg-secondary">Usuario</span>';
        }

        // Generar avatar con iniciales
        const iniciales = (usuario.nombreUsuario || 'U').split(' ').map(n => n.charAt(0)).join('').substring(0, 2);

        const fila = `
            <tr>
                <td>${usuario.idUsuario}</td>
                <td><div class="user-avatar">${iniciales}</div></td>
                <td>${usuario.nombreUsuario}</td>
                <td>${usuario.email}</td>
                <td>${rolBadge}</td>
                <td>${estadoBadge}</td>
                <td>${usuario.ultimoAcceso || 'N/A'}</td>
                <td>${usuario.fechaCreacion || 'N/A'}</td>
                <td>
                    <button class="btn-view" onclick="verUsuario(${usuario.idUsuario})" title="Ver detalles">
                        <i class="fa fa-eye"></i>
                    </button>
                    <button class="btn-edit" onclick="editarUsuario(${usuario.idUsuario})" title="Editar">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="eliminarUsuario(${usuario.idUsuario})" title="Eliminar">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(fila);
    });

    // Actualizar paginación
    actualizarPaginacion(usuariosFiltrados.length);
    
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        tbody.append('<tr><td colspan="9" class="text-center text-danger">Error al cargar usuarios. Verifique su conexión a internet.</td></tr>');
    }
}

// Función global para actualizar paginación
function actualizarPaginacion(totalUsuarios) {
    const totalPaginas = Math.ceil(totalUsuarios / usuariosPorPagina);
    const paginacion = $('#pagination');
    paginacion.empty();

    if (totalPaginas <= 1) return;

    // Botón anterior
    const anteriorDisabled = paginaActual === 1 ? 'disabled' : '';
    paginacion.append(`
        <li class="page-item ${anteriorDisabled}">
            <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual - 1})">Anterior</a>
        </li>
    `);

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        const activo = i === paginaActual ? 'active' : '';
        paginacion.append(`
            <li class="page-item ${activo}">
                <a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>
            </li>
        `);
    }

    // Botón siguiente
    const siguienteDisabled = paginaActual === totalPaginas ? 'disabled' : '';
    paginacion.append(`
        <li class="page-item ${siguienteDisabled}">
            <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual + 1})">Siguiente</a>
        </li>
    `);
}

// Función global para cambiar página
function cambiarPagina(nuevaPagina) {
    paginaActual = nuevaPagina;
    cargarUsuarios();
}

// Función global para configurar eventos
function configurarEventos() {
    // Búsqueda en tiempo real
    const searchElement = $('#searchUsers');
    if (searchElement.length) {
        searchElement.on('input', function() {
            paginaActual = 1;
            cargarUsuarios();
        });
    }

    // Filtros
    const roleFilter = $('#roleFilter');
    const statusFilter = $('#statusFilter');
    if (roleFilter.length && statusFilter.length) {
        roleFilter.add(statusFilter).on('change', function() {
            paginaActual = 1;
            cargarUsuarios();
        });
    }

    // Botón limpiar filtros
    const clearButton = $('#clearFilters');
    if (clearButton.length) {
        clearButton.on('click', function() {
            if (searchElement.length) searchElement.val('');
            if (roleFilter.length) roleFilter.val('');
            if (statusFilter.length) statusFilter.val('');
            paginaActual = 1;
            cargarUsuarios();
        });
    }
}

// Función global para actualizar estadísticas
function actualizarEstadisticas() {
    // Obtener usuarios desde localStorage
    const usuarios = getUsuarios();
    
    const totalUsuarios = usuarios.length;
    const usuariosActivos = usuarios.filter(u => u.estado === 'activo').length;
    const administradores = usuarios.filter(u => u.rol === 'admin').length;
    const usuariosOnline = usuarios.filter(u => {
        const ultimoAcceso = new Date(u.ultimoAcceso);
        const ahora = new Date();
        const diferencia = (ahora - ultimoAcceso) / (1000 * 60); // minutos
        return diferencia < 30; // Consideramos online si accedió en los últimos 30 minutos
    }).length;

    $('#totalUsers').text(totalUsuarios);
    $('#activeUsers').text(usuariosActivos);
    $('#adminUsers').text(administradores);
    $('#onlineUsers').text(usuariosOnline);
}

// Funciones globales - Disponibles inmediatamente

// Abrir modal para agregar/editar usuario
function abrirModalUsuario(usuario = null) {
    const modal = $('#userModal');
    const titulo = usuario ? 'Editar Usuario' : 'Agregar Usuario';
    
    modal.find('.modal-title').text(titulo);
    
    if (usuario) {
        // Separar el nombre completo en nombre y apellido
        const nombreCompleto = usuario.nombre.split(' ');
        const nombre = nombreCompleto[0] || '';
        const apellido = nombreCompleto.slice(1).join(' ') || '';
        
        $('#userId').val(usuario.id);
        $('#firstName').val(nombre);
        $('#lastName').val(apellido);
        $('#userEmail').val(usuario.email);
        $('#userPhone').val(usuario.telefono);
        $('#userRole').val(usuario.rol);
        $('#userStatus').val(usuario.estado);
        
        // Ocultar campos de contraseña al editar
        $('#userPassword').closest('.form-group').hide();
        $('#confirmPassword').closest('.form-group').hide();
    } else {
        $('#userForm')[0].reset();
        $('#userId').val('');
        
        // Mostrar campos de contraseña al agregar
        $('#userPassword').closest('.form-group').show();
        $('#confirmPassword').closest('.form-group').show();
    }
    
    modal.modal('show');
}

// Función para el botón de guardar (compatibilidad con HTML)
function saveUser() {
    guardarUsuario();
}

// Guardar usuario - Solo funciona con conexión a internet
async function guardarUsuario() {
    // Verificar conexión a internet
    if (!navigator.onLine) {
        mostrarNotificacion('No hay conexión a internet. Este módulo requiere conexión para funcionar.', 'error');
        return;
    }

    const id = $('#userId').val();
    const firstName = $('#firstName').val().trim();
    const lastName = $('#lastName').val().trim();
    const nombre = `${firstName} ${lastName}`.trim();
    const email = $('#userEmail').val().trim();
    const telefono = $('#userPhone').val().trim();
    const rol = $('#userRole').val();
    const estado = $('#userStatus').val();
    const password = $('#userPassword').val();
    const confirmPassword = $('#confirmPassword').val();

    // Validaciones
    if (!nombre || !email || !telefono) {
        mostrarNotificacion('Por favor, complete todos los campos obligatorios.', 'error');
        return;
    }

    if (!validarEmail(email)) {
        mostrarNotificacion('Por favor, ingrese un email válido.', 'error');
        return;
    }

    // Validar contraseñas solo para usuarios nuevos
    if (!id) {
        if (!password || !confirmPassword) {
            mostrarNotificacion('Por favor, ingrese la contraseña y confirmación.', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            mostrarNotificacion('Las contraseñas no coinciden.', 'error');
            return;
        }
        
        if (password.length < 6) {
            mostrarNotificacion('La contraseña debe tener al menos 6 caracteres.', 'error');
            return;
        }
    }

    // Obtener token de sesión
    let sessionData = localStorage.getItem('lugx_session') || sessionStorage.getItem('lugx_session');
    if (!sessionData) {
        mostrarNotificacion('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
        window.location.href = 'login.html';
        return;
    }

    const session = JSON.parse(sessionData);
    const token = session.token;

    try {
        const userData = {
            nombreUsuario: nombre,
            email: email,
            rol: rol,
            activo: estado === 'activo' ? 1 : 0
        };

        // Solo incluir contraseña si se proporcionó
        if (password && password.trim() !== '') {
            if (password !== confirmPassword) {
                mostrarNotificacion('Las contraseñas no coinciden.', 'error');
                return;
            }
            
            if (password.length < 6) {
                mostrarNotificacion('La contraseña debe tener al menos 6 caracteres.', 'error');
                return;
            }
            
            userData.password = password;
        }

        let response;
        if (id) {
            // Actualizar usuario existente
            response = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
        } else {
            // Crear nuevo usuario
            response = await fetch('http://localhost:3000/api/usuarios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            mostrarNotificacion(id ? 'Usuario actualizado exitosamente.' : 'Usuario creado exitosamente.', 'success');
            $('#userModal').modal('hide');
            await cargarUsuarios(); // Recargar la lista de usuarios
            actualizarEstadisticas();
        } else {
            const error = await response.json();
            mostrarNotificacion(error.message || 'Error al guardar el usuario.', 'error');
        }
    } catch (error) {
        console.error('Error al guardar usuario:', error);
        mostrarNotificacion('Error de conexión. Verifique su conexión a internet.', 'error');
    }
}

// Editar usuario - Solo funciona con conexión a internet
async function editarUsuario(id) {
    if (!navigator.onLine) {
        mostrarNotificacion('No hay conexión a internet. Este módulo requiere conexión para funcionar.', 'error');
        return;
    }

    // Obtener token de sesión
    let sessionData = localStorage.getItem('lugx_session') || sessionStorage.getItem('lugx_session');
    if (!sessionData) {
        mostrarNotificacion('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
        window.location.href = 'login.html';
        return;
    }

    const session = JSON.parse(sessionData);
    const token = session.token;

    try {
        const response = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const usuario = await response.json();
            abrirModalUsuario(usuario);
        } else {
            mostrarNotificacion('Error al obtener los datos del usuario.', 'error');
        }
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        mostrarNotificacion('Error de conexión. Verifique su conexión a internet.', 'error');
    }
}

// Eliminar usuario - Solo funciona con conexión a internet
async function eliminarUsuario(id) {
    if (!navigator.onLine) {
        mostrarNotificacion('No hay conexión a internet. Este módulo requiere conexión para funcionar.', 'error');
        return;
    }

    if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
        // Obtener token de sesión
        let sessionData = localStorage.getItem('lugx_session') || sessionStorage.getItem('lugx_session');
        if (!sessionData) {
            mostrarNotificacion('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
            window.location.href = 'login.html';
            return;
        }

        const session = JSON.parse(sessionData);
        const token = session.token;

        try {
            const response = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                await cargarUsuarios();
                actualizarEstadisticas();
                mostrarNotificacion('Usuario eliminado exitosamente.', 'success');
            } else {
                const error = await response.json();
                mostrarNotificacion(error.message || 'Error al eliminar el usuario.', 'error');
            }
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            mostrarNotificacion('Error de conexión. Verifique su conexión a internet.', 'error');
        }
    }
}

// Ver detalles del usuario - Solo funciona con conexión a internet
async function verUsuario(id) {
    if (!navigator.onLine) {
        mostrarNotificacion('No hay conexión a internet. Este módulo requiere conexión para funcionar.', 'error');
        return;
    }

    // Obtener token de sesión
    let sessionData = localStorage.getItem('lugx_session') || sessionStorage.getItem('lugx_session');
    if (!sessionData) {
        mostrarNotificacion('Sesión expirada. Por favor, inicie sesión nuevamente.', 'error');
        window.location.href = 'login.html';
        return;
    }

    const session = JSON.parse(sessionData);
    const token = session.token;

    try {
        const response = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const usuario = await response.json();
            alert(`Detalles del Usuario:\n\nNombre: ${usuario.nombre}\nEmail: ${usuario.email}\nTeléfono: ${usuario.telefono}\nRol: ${usuario.rol}\nEstado: ${usuario.estado}\nÚltimo Acceso: ${usuario.ultimoAcceso || 'N/A'}\nFecha de Registro: ${usuario.fechaRegistro || 'N/A'}`);
        } else {
            mostrarNotificacion('Error al obtener los datos del usuario.', 'error');
        }
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        mostrarNotificacion('Error de conexión. Verifique su conexión a internet.', 'error');
    }
}

// Funciones de compatibilidad con el HTML
function viewUser(id) {
    verUsuario(id);
}

function editUser(id) {
    editarUsuario(id);
}

function deleteUser(id) {
    eliminarUsuario(id);
}

// Funciones auxiliares
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function mostrarNotificacion(mensaje, tipo) {
    const alertClass = tipo === 'success' ? 'alert-success' : 'alert-danger';
    const icon = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    
    const notification = $(`
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            <i class="fa ${icon}"></i> ${mensaje}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `);
    
    $('body').append(notification);
    
    setTimeout(() => {
        notification.alert('close');
    }, 5000);
}









// Función de inicialización
function inicializar() {
    cargarUsuarios();
    actualizarEstadisticas();
    configurarEventos();
}

// Inicializar cuando el documento esté listo
$(document).ready(function() {
    inicializar();
});

// Exportar funciones al objeto global window para acceso desde HTML
window.abrirModalUsuario = abrirModalUsuario;
window.saveUser = saveUser;
window.guardarUsuario = guardarUsuario;
window.editarUsuario = editarUsuario;
window.eliminarUsuario = eliminarUsuario;
window.verUsuario = verUsuario;
window.viewUser = viewUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.cargarUsuarios = cargarUsuarios;
window.cambiarPagina = cambiarPagina;
window.configurarEventos = configurarEventos;
window.actualizarEstadisticas = actualizarEstadisticas;
window.actualizarPaginacion = actualizarPaginacion;