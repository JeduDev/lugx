-- Base de datos para sistema de rentas de trajes
-- Compatible con Turso SQLite
-- Generado: 2025-01-27

-- Configuración para SQLite
PRAGMA foreign_keys = ON;

-- ========================================
-- TABLA: usuarios
-- ========================================
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
    idUsuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nombreUsuario TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'moderador', 'usuario')),
    fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimoAcceso DATETIME,
    activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1))
);

-- Insertar usuarios de ejemplo
INSERT INTO usuarios (nombreUsuario, email, password, rol, ultimoAcceso, activo) VALUES
('admin', 'admin@rentastrajes.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlxO', 'admin', '2025-01-27 10:00:00', 1),
('moderador1', 'mod@rentastrajes.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlxO', 'moderador', '2025-01-26 15:30:00', 1),
('usuario1', 'usuario@rentastrajes.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PmvlxO', 'usuario', '2025-01-25 09:15:00', 1);

-- ========================================
-- TABLA: clientes
-- ========================================
DROP TABLE IF EXISTS clientes;
CREATE TABLE clientes (
    idCliente INTEGER PRIMARY KEY AUTOINCREMENT,
    nombreCliente TEXT NOT NULL,
    telefono TEXT NOT NULL,
    correoElectronico TEXT NOT NULL,
    fechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1))
);

-- Insertar clientes de ejemplo
INSERT INTO clientes (nombreCliente, telefono, correoElectronico, fechaRegistro, activo) VALUES
('María González', '5551234567', 'maria.gonzalez@email.com', '2025-01-15 10:30:00', 1),
('Carlos Rodríguez', '5559876543', 'carlos.rodriguez@email.com', '2025-01-20 14:15:00', 1),
('Ana Martínez', '5555555555', 'ana.martinez@email.com', '2025-01-25 09:45:00', 1),
('Luis Hernández', '5552468135', 'luis.hernandez@email.com', '2025-01-26 16:20:00', 1);

-- ========================================
-- TABLA: trajes
-- ========================================
DROP TABLE IF EXISTS trajes;
CREATE TABLE trajes (
    idTraje INTEGER PRIMARY KEY AUTOINCREMENT,
    nombreTraje TEXT NOT NULL,
    descripcion TEXT,
    estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'rentado', 'mantenimiento', 'fuera_servicio')),
    fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1))
);

-- Insertar trajes de ejemplo
INSERT INTO trajes (nombreTraje, descripcion, estado, fechaCreacion, activo) VALUES
('Traje Cruzado Negro', 'Pantalon de cierre frontal y cremallera, con bolsillos laterales sin boton y traseros con boton. Saco con solapa de pico, recto de dos botones, bolsillo superior de lado izquierdo y dos bolsillos frontales.', 'disponible', '2025-01-10 08:00:00', 1),
('Vestido midi mariposas', 'Vestido de punto midi de cuello a la caja falda de vuelo y estampado de mariposas.', 'disponible', '2025-01-10 08:15:00', 1),
('Esmoquin Clásico', 'Esmoquin negro tradicional con solapas de satén, incluye pajarita y fajín. Perfecto para eventos formales y bodas de noche.', 'disponible', '2025-01-12 10:30:00', 1),
('Traje Azul Marino', 'Traje de corte moderno en azul marino, ideal para eventos de día y reuniones de negocios. Incluye chaleco opcional.', 'disponible', '2025-01-14 11:45:00', 1),
('Vestido de Noche Elegante', 'Vestido largo de gala en color negro con detalles de encaje y pedrería. Perfecto para eventos de etiqueta.', 'rentado', '2025-01-16 13:20:00', 1);

-- ========================================
-- TABLA: rentas
-- ========================================
DROP TABLE IF EXISTS rentas;
CREATE TABLE rentas (
    idRenta INTEGER PRIMARY KEY AUTOINCREMENT,
    idCliente INTEGER,
    idTraje INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    fechaHoraInicio DATETIME NOT NULL,
    fechaHoraFin DATETIME NOT NULL,
    estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'vencida', 'cancelada')),
    fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    costoTotal DECIMAL(10,2),
    observaciones TEXT,
    FOREIGN KEY (idTraje) REFERENCES trajes(idTraje) ON DELETE RESTRICT,
    FOREIGN KEY (idCliente) REFERENCES clientes(idCliente) ON DELETE SET NULL
);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_rentas_cliente ON rentas(idCliente);
CREATE INDEX idx_rentas_traje ON rentas(idTraje);
CREATE INDEX idx_rentas_fechas ON rentas(fechaHoraInicio, fechaHoraFin);
CREATE INDEX idx_rentas_estado ON rentas(estado);

-- Insertar rentas de ejemplo
INSERT INTO rentas (idCliente, idTraje, descripcion, fechaHoraInicio, fechaHoraFin, estado, fechaCreacion, costoTotal, observaciones) VALUES
(NULL, 1, 'Rentado para fiesta de quince.', '2025-02-04 17:00:00', '2025-02-06 17:00:00', 'activa', '2025-01-27 09:00:00', 1500.00, 'Cliente pagó en efectivo'),
(NULL, 2, 'Rentado para boda.', '2025-02-04 18:00:00', '2025-02-06 18:00:00', 'activa', '2025-01-27 09:30:00', 1200.00, 'Incluye accesorios'),
(1, 3, 'Evento corporativo anual.', '2025-01-15 19:00:00', '2025-01-16 02:00:00', 'completada', '2025-01-10 14:20:00', 2000.00, 'Excelente estado de devolución'),
(2, 4, 'Graduación universitaria.', '2024-12-20 10:00:00', '2024-12-20 18:00:00', 'completada', '2024-12-15 11:30:00', 800.00, 'Primera renta del cliente'),
(3, 5, 'Gala benéfica de fin de año.', '2024-12-31 20:00:00', '2025-01-01 03:00:00', 'completada', '2024-12-20 16:45:00', 2500.00, 'Evento de alta sociedad');

-- ========================================
-- TABLA: notificaciones
-- ========================================
DROP TABLE IF EXISTS notificaciones;
CREATE TABLE notificaciones (
    idNotificacion INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT DEFAULT 'info' CHECK (tipo IN ('info', 'warning', 'error', 'success')),
    idUsuario INTEGER,
    idRenta INTEGER,
    leida INTEGER DEFAULT 0 CHECK (leida IN (0, 1)),
    fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fechaLectura DATETIME,
    activa INTEGER DEFAULT 1 CHECK (activa IN (0, 1)),
    FOREIGN KEY (idUsuario) REFERENCES usuarios(idUsuario) ON DELETE CASCADE,
    FOREIGN KEY (idRenta) REFERENCES rentas(idRenta) ON DELETE CASCADE
);

-- Crear índices para notificaciones
CREATE INDEX idx_notificaciones_usuario ON notificaciones(idUsuario);
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX idx_notificaciones_fecha ON notificaciones(fechaCreacion);

-- Insertar notificaciones de ejemplo
INSERT INTO notificaciones (titulo, mensaje, tipo, idUsuario, idRenta, leida, fechaCreacion, fechaLectura, activa) VALUES
('Renta próxima a vencer', 'La renta #1 del Traje Cruzado Negro vence mañana a las 17:00', 'warning', 1, 1, 0, '2025-01-27 08:00:00', NULL, 1),
('Nueva renta registrada', 'Se ha registrado una nueva renta para el Vestido midi mariposas', 'success', 1, 2, 1, '2025-01-27 09:30:00', '2025-01-27 10:15:00', 1),
('Renta completada', 'La renta #3 del Esmoquin Clásico ha sido completada exitosamente', 'success', 1, 3, 1, '2025-01-16 03:00:00', '2025-01-16 08:30:00', 1),
('Mantenimiento programado', 'El sistema estará en mantenimiento el próximo domingo de 2:00 AM a 6:00 AM', 'info', 1, NULL, 0, '2025-01-26 15:00:00', NULL, 1),
('Renta vencida', 'La renta #4 del Traje Azul Marino ha vencido y requiere seguimiento', 'error', 1, 4, 0, '2024-12-21 00:00:00', NULL, 1),
('Nuevo cliente registrado', 'Se ha registrado un nuevo cliente: Luis Hernández', 'info', 2, NULL, 1, '2025-01-26 16:20:00', '2025-01-26 17:00:00', 1),
('Inventario bajo', 'Solo quedan 2 trajes disponibles para renta este fin de semana', 'warning', 1, NULL, 0, '2025-01-25 12:00:00', NULL, 1),
('Pago pendiente', 'La renta #2 tiene un pago pendiente de $200.00', 'warning', 2, 2, 0, '2025-01-27 11:00:00', NULL, 1);

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista para rentas activas con información completa
CREATE VIEW vista_rentas_activas AS
SELECT 
    r.idRenta,
    r.descripcion,
    r.fechaHoraInicio,
    r.fechaHoraFin,
    r.estado,
    r.costoTotal,
    c.nombreCliente,
    c.telefono as telefonoCliente,
    t.nombreTraje,
    t.descripcion as descripcionTraje,
    CASE 
        WHEN datetime('now') > r.fechaHoraFin THEN 'VENCIDA'
        WHEN datetime('now') BETWEEN r.fechaHoraInicio AND r.fechaHoraFin THEN 'EN_CURSO'
        ELSE 'PROGRAMADA'
    END as estadoTemporal
FROM rentas r
LEFT JOIN clientes c ON r.idCliente = c.idCliente
JOIN trajes t ON r.idTraje = t.idTraje
WHERE r.estado = 'activa'
ORDER BY r.fechaHoraInicio;

-- Vista para estadísticas del dashboard
CREATE VIEW vista_estadisticas AS
SELECT 
    (SELECT COUNT(*) FROM clientes WHERE activo = 1) as totalClientes,
    (SELECT COUNT(*) FROM trajes WHERE activo = 1) as totalTrajes,
    (SELECT COUNT(*) FROM trajes WHERE estado = 'disponible' AND activo = 1) as trajesDisponibles,
    (SELECT COUNT(*) FROM rentas WHERE estado = 'activa') as rentasActivas,
    (SELECT COUNT(*) FROM rentas WHERE estado = 'completada') as rentasCompletadas,
    (SELECT COUNT(*) FROM rentas WHERE estado = 'vencida') as rentasVencidas,
    (SELECT COUNT(*) FROM notificaciones WHERE leida = 0 AND activa = 1) as notificacionesPendientes;

-- ========================================
-- TRIGGERS PARA AUTOMATIZACIÓN
-- ========================================

-- Trigger para actualizar estado del traje cuando se crea una renta
CREATE TRIGGER actualizar_estado_traje_renta
AFTER INSERT ON rentas
WHEN NEW.estado = 'activa'
BEGIN
    UPDATE trajes SET estado = 'rentado' WHERE idTraje = NEW.idTraje;
END;

-- Trigger para restaurar estado del traje cuando se completa una renta
CREATE TRIGGER restaurar_estado_traje_completada
AFTER UPDATE ON rentas
WHEN NEW.estado = 'completada' AND OLD.estado = 'activa'
BEGIN
    UPDATE trajes SET estado = 'disponible' WHERE idTraje = NEW.idTraje;
END;

-- Trigger para crear notificación cuando se registra una nueva renta
CREATE TRIGGER notificar_nueva_renta
AFTER INSERT ON rentas
BEGIN
    INSERT INTO notificaciones (titulo, mensaje, tipo, idUsuario, idRenta)
    VALUES (
        'Nueva renta registrada',
        'Se ha registrado una nueva renta para ' || (SELECT nombreTraje FROM trajes WHERE idTraje = NEW.idTraje),
        'success',
        1, -- Usuario admin por defecto
        NEW.idRenta
    );
END;

-- ========================================
-- COMENTARIOS FINALES
-- ========================================
-- Base de datos creada exitosamente
-- Compatible con Turso SQLite
-- Incluye todas las tablas necesarias para el sistema de rentas de trajes
-- Fecha de creación: 2025-01-27
