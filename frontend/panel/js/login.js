// login.js - Funcionalidades de Autenticación
$(document).ready(function() {
    // Verificar que storage-utils.js esté cargado
    if (typeof window.storageManager === 'undefined') {
        console.error('storage-utils.js debe ser cargado antes que login.js');
    }

    // Función para obtener usuarios desde localStorage
    function getUsuarios() {
        return JSON.parse(localStorage.getItem('lugx_usuarios') || '[]');
    }

    // Función para inicializar usuarios por defecto si no existen
    function inicializarUsuariosPorDefecto() {
        const usuarios = getUsuarios();
        if (usuarios.length === 0) {
            const usuariosPorDefecto = [
                {
                    id: 1,
                    email: "admin@lugx.com",
                    password: "admin123",
                    nombre: "Administrador",
                    rol: "admin",
                    estado: "activo",
                    fechaRegistro: new Date().toLocaleDateString(),
                    ultimoAcceso: new Date().toLocaleString()
                },
                {
                    id: 2,
                    email: "jose@lugx.com",
                    password: "jose123",
                    nombre: "José Osorio",
                    rol: "admin",
                    estado: "activo",
                    fechaRegistro: new Date().toLocaleDateString(),
                    ultimoAcceso: new Date().toLocaleString()
                },
                {
                    id: 3,
                    email: "maria@lugx.com",
                    password: "maria123",
                    nombre: "María González",
                    rol: "employee",
                    estado: "activo",
                    fechaRegistro: new Date().toLocaleDateString(),
                    ultimoAcceso: new Date().toLocaleString()
                },
                {
                    id: 4,
                    email: "empleado@lugx.com",
                    password: "empleado123",
                    nombre: "Empleado Demo",
                    rol: "employee",
                    estado: "activo",
                    fechaRegistro: new Date().toLocaleDateString(),
                    ultimoAcceso: new Date().toLocaleString()
                }
            ];
            localStorage.setItem('lugx_usuarios', JSON.stringify(usuariosPorDefecto));
            console.log('Usuarios por defecto inicializados en localStorage');
        }
    }

    // Inicializar usuarios por defecto
    inicializarUsuariosPorDefecto();

    // Verificar si ya hay una sesión activa
    verificarSesionActiva();

    // Configurar event listeners
    configurarEventListeners();

    function configurarEventListeners() {
        // Formulario de login
        $('#loginForm').on('submit', function(e) {
            e.preventDefault();
            procesarLogin();
        });

        // Enter en los campos de input
        $('#email, #password').on('keypress', function(e) {
            if (e.which === 13) {
                procesarLogin();
            }
        });

        // Mostrar/ocultar contraseña
        $(document).on('click', '.toggle-password', function() {
            const input = $(this).siblings('input');
            const icon = $(this).find('i');
            
            if (input.attr('type') === 'password') {
                input.attr('type', 'text');
                icon.removeClass('fa-eye').addClass('fa-eye-slash');
            } else {
                input.attr('type', 'password');
                icon.removeClass('fa-eye-slash').addClass('fa-eye');
            }
        });

        // Limpiar alertas cuando el usuario empiece a escribir
        $('#email, #password').on('input', function() {
            ocultarAlerta();
        });
    }

    function verificarSesionActiva() {
        const sesionActiva = localStorage.getItem('lugx_session');
        if (sesionActiva) {
            try {
                const datosSession = JSON.parse(sesionActiva);
                const ahora = new Date().getTime();
                
                // Verificar si la sesión no ha expirado (24 horas)
                if (ahora - datosSession.timestamp < 24 * 60 * 60 * 1000) {
                    // Redirigir al panel
                    window.location.href = 'index.html';
                    return;
                }
            } catch (e) {
                // Si hay error al parsear, limpiar la sesión
                localStorage.removeItem('lugx_session');
            }
        }
    }

    async function procesarLogin() {
        const email = $('#email').val().trim();
        const password = $('#password').val();
        const recordarSesion = $('#rememberMe').is(':checked');

        // Validaciones básicas
        if (!email || !password) {
            mostrarAlerta('Por favor, completa todos los campos.', 'danger');
            return;
        }

        if (!validarEmail(email)) {
            mostrarAlerta('Por favor, ingresa un email válido.', 'danger');
            return;
        }

        // Mostrar loading
        mostrarLoading(true);

        try {
            // Hacer petición al backend
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
                // Login exitoso
                guardarSesion(result.data, recordarSesion);
                mostrarAlerta('¡Bienvenido! Redirigiendo...', 'success');
                
                // Redirigir después de un breve delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // Login fallido
                mostrarAlerta(result.message || 'Email o contraseña incorrectos.', 'danger');
                // Limpiar contraseña por seguridad
                $('#password').val('');
            }
        } catch (error) {
            console.error('Error en login:', error);
            mostrarAlerta('Error de conexión. Intenta nuevamente.', 'danger');
            $('#password').val('');
        }
        
        mostrarLoading(false);
    }

    // Función para autenticar usuario
    function autenticarUsuario(email, password) {
        const usuarios = getUsuarios();
        const usuario = usuarios.find(u => 
            u.email === email && u.password === password && u.estado === 'activo'
        );
        
        if (usuario) {
            // Actualizar último acceso
            usuario.ultimoAcceso = new Date().toLocaleString();
            localStorage.setItem('lugx_usuarios', JSON.stringify(usuarios));
        }
        
        return usuario;
    }

    function guardarSesion(data, recordar) {
        const datosSession = {
            usuario: {
                email: data.user.email,
                nombre: data.user.nombre_completo,
                rol: data.user.rol,
                id: data.user.id
            },
            token: data.token,
            expiresIn: data.expiresIn,
            timestamp: new Date().getTime(),
            recordar: recordar
        };

        if (recordar) {
            localStorage.setItem('lugx_session', JSON.stringify(datosSession));
        } else {
            sessionStorage.setItem('lugx_session', JSON.stringify(datosSession));
        }

        // Registrar el acceso
        registrarAcceso(datosSession.usuario);
    }

    function registrarAcceso(usuario) {
        const accesos = JSON.parse(localStorage.getItem('lugx_accesos') || '[]');
        accesos.push({
            email: usuario.email,
            fecha: new Date().toISOString(),
            ip: 'localhost', // En producción se obtendría la IP real
            userAgent: navigator.userAgent
        });

        // Mantener solo los últimos 50 accesos
        if (accesos.length > 50) {
            accesos.splice(0, accesos.length - 50);
        }

        localStorage.setItem('lugx_accesos', JSON.stringify(accesos));
    }

    function mostrarLoading(mostrar) {
        const submitBtn = $('#loginForm button[type="submit"]');
        
        if (mostrar) {
            submitBtn.prop('disabled', true);
            submitBtn.html('<i class="fa fa-spinner fa-spin"></i> Iniciando sesión...');
        } else {
            submitBtn.prop('disabled', false);
            submitBtn.html('<i class="fa fa-sign-in-alt"></i> Iniciar Sesión');
        }
    }

    function mostrarAlerta(mensaje, tipo) {
        const alertDiv = $('#loginAlert');
        const alertMessage = $('#alertMessage');
        
        alertDiv.removeClass('alert-success alert-danger alert-warning alert-info');
        alertDiv.addClass(`alert-${tipo}`);
        alertMessage.text(mensaje);
        alertDiv.fadeIn();

        // Auto-ocultar después de 5 segundos si es error
        if (tipo === 'danger') {
            setTimeout(() => {
                ocultarAlerta();
            }, 5000);
        }
    }

    function ocultarAlerta() {
        $('#loginAlert').fadeOut();
    }

    function validarEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    // Función para mostrar modal de recuperación de contraseña
    window.showForgotPassword = function() {
        $('#forgotPasswordModal').modal('show');
    };

    // Función para enviar email de recuperación
    window.sendResetEmail = function() {
        const email = $('#resetEmail').val().trim();
        
        if (!email) {
            alert('Por favor, ingresa tu email.');
            return;
        }

        if (!validarEmail(email)) {
            alert('Por favor, ingresa un email válido.');
            return;
        }

        // Verificar si el email existe
        const usuarioExiste = usuariosValidos.some(u => u.email === email);
        
        if (usuarioExiste) {
            alert('Se ha enviado un enlace de recuperación a tu email.');
            $('#forgotPasswordModal').modal('hide');
            $('#resetEmail').val('');
        } else {
            alert('No se encontró una cuenta con ese email.');
        }
    };

    // Función para cerrar sesión (útil para otros archivos)
    window.cerrarSesion = function() {
        localStorage.removeItem('lugx_session');
        sessionStorage.removeItem('lugx_session');
        window.location.href = 'login.html';
    };

    // Función para obtener datos de sesión (útil para otros archivos)
    window.obtenerSesion = function() {
        const sesionLocal = localStorage.getItem('lugx_session');
        const sesionSession = sessionStorage.getItem('lugx_session');
        
        const datosSession = sesionLocal || sesionSession;
        
        if (datosSession) {
            try {
                const datos = JSON.parse(datosSession);
                const ahora = new Date().getTime();
                
                // Verificar si la sesión no ha expirado
                if (ahora - datos.timestamp < 24 * 60 * 60 * 1000) {
                    return datos;
                }
            } catch (e) {
                // Error al parsear, limpiar sesiones
                localStorage.removeItem('lugx_session');
                sessionStorage.removeItem('lugx_session');
            }
        }
        
        return null;
    };

    // Función para verificar si el usuario está autenticado
    window.verificarAutenticacion = function() {
        const sesion = obtenerSesion();
        if (!sesion) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    };

    // Función para obtener información del usuario actual
    window.obtenerUsuarioActual = function() {
        const sesion = obtenerSesion();
        return sesion ? sesion.usuario : null;
    };

    // Mostrar información de usuarios demo en consola
    console.log('=== USUARIOS DEMO PARA TESTING ===');
    console.log('Administrador: admin@lugx.com / admin123');
    console.log('José Osorio: jose@lugx.com / jose123');
    console.log('María González: maria@lugx.com / maria123');
    console.log('Empleado Demo: empleado@lugx.com / empleado123');
    console.log('=====================================');
});