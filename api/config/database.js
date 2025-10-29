const { createClient } = require('@libsql/client');
const path = require('path');

// Intentar usar Turso primero, luego SQLite local como respaldo
let client;
let usingLocalDB = false;

try {
  const { DATABASE_URL, DATABASE_TOKEN } = require('../keys');
  client = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_TOKEN,
  });
  console.log('🔗 Intentando conectar con Turso...');
} catch (error) {
  console.log('⚠️ Credenciales de Turso no disponibles, usando SQLite local...');
  client = createClient({
    url: `file:${path.join(__dirname, '../data/lugx_gaming.db')}`
  });
  usingLocalDB = true;
}

// Función para probar la conexión
async function testConnection() {
  try {
    const result = await client.execute('SELECT 1 as test');
    const dbType = usingLocalDB ? 'SQLite local' : 'Turso';
    console.log(`✅ Conexión a ${dbType} exitosa`);
    return { success: true, message: `Conexión exitosa a ${dbType}` };
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    
    // Si falla Turso, intentar con SQLite local
    if (!usingLocalDB) {
      console.log('🔄 Turso falló, intentando con SQLite local...');
      try {
        client = createClient({
          url: `file:${path.join(__dirname, '../data/lugx_gaming.db')}`
        });
        usingLocalDB = true;
        
        const localResult = await client.execute('SELECT 1 as test');
        console.log('✅ Conexión a SQLite local exitosa');
        return { success: true, message: 'Conexión exitosa a SQLite local (respaldo)' };
      } catch (localError) {
        console.error('❌ Error también con SQLite local:', localError.message);
        return { success: false, error: localError.message };
      }
    }
    
    return { success: false, error: error.message };
  }
}

// Función para ejecutar consultas con manejo de errores
async function executeQuery(sql, params = []) {
  try {
    const result = await client.execute({
      sql: sql,
      args: params
    });
    return {
      success: true,
      data: result,
      rows: result.rows,
      rowsAffected: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid
    };
  } catch (error) {
    console.error('Error ejecutando consulta:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Función para ejecutar múltiples consultas en una transacción
async function executeTransaction(queries) {
  try {
    const results = [];
    
    for (const query of queries) {
      const result = await client.execute({
        sql: query.sql,
        args: query.params || []
      });
      results.push(result);
    }
    
    return {
      success: true,
      results: results
    };
  } catch (error) {
    console.error('Error en transacción:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Función para obtener estadísticas de la base de datos
async function getDatabaseStats() {
  try {
    const tables = ['clientes', 'trajes', 'rentas', 'usuarios', 'notificaciones'];
    const stats = {};
    
    for (const table of tables) {
      const result = await executeQuery(`SELECT COUNT(*) as count FROM ${table}`);
      if (result.success) {
        stats[table] = result.rows[0].count;
      }
    }
    
    return {
      success: true,
      stats: stats
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Función para inicializar las tablas según la estructura de app2_rentas_trajes.sql
async function initializeTables() {
  const createTables = [
    // Configuración para SQLite
    `PRAGMA foreign_keys = ON`,
    
    // Tabla de usuarios
    `CREATE TABLE IF NOT EXISTS usuarios (
      idUsuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nombreUsuario TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'moderador', 'usuario')),
      fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultimoAcceso DATETIME,
      activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)),
      resetToken TEXT,
      resetTokenExpires DATETIME
    )`,
    
    // Tabla de clientes
    `CREATE TABLE IF NOT EXISTS clientes (
      idCliente INTEGER PRIMARY KEY AUTOINCREMENT,
      nombreCliente TEXT NOT NULL,
      telefono TEXT NOT NULL,
      correoElectronico TEXT NOT NULL,
      fechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
      activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1))
    )`,
    
    // Tabla de trajes
    `CREATE TABLE IF NOT EXISTS trajes (
      idTraje INTEGER PRIMARY KEY AUTOINCREMENT,
      nombreTraje TEXT NOT NULL,
      descripcion TEXT,
      estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'rentado', 'mantenimiento', 'fuera_servicio')),
      fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1))
    )`,
    
    // Tabla de rentas
    `CREATE TABLE IF NOT EXISTS rentas (
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
    )`,
    
    // Tabla de notificaciones
    `CREATE TABLE IF NOT EXISTS notificaciones (
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
    )`
  ];
  
  try {
    for (const sql of createTables) {
      await client.execute(sql);
    }
    
    // Crear índices para mejorar rendimiento
    const indices = [
      `CREATE INDEX IF NOT EXISTS idx_rentas_cliente ON rentas(idCliente)`,
      `CREATE INDEX IF NOT EXISTS idx_rentas_traje ON rentas(idTraje)`,
      `CREATE INDEX IF NOT EXISTS idx_rentas_fechas ON rentas(fechaHoraInicio, fechaHoraFin)`,
      `CREATE INDEX IF NOT EXISTS idx_rentas_estado ON rentas(estado)`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(idUsuario)`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida)`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo)`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON notificaciones(fechaCreacion)`
    ];
    
    for (const index of indices) {
      await client.execute(index);
    }
    
    // Crear usuario administrador por defecto si no existe
    try {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await client.execute(`
        INSERT OR IGNORE INTO usuarios (nombreUsuario, email, password, rol, ultimoAcceso, activo)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['admin', 'admin@rentastrajes.com', hashedPassword, 'admin', new Date().toISOString(), 1]);
      
      console.log('✅ Usuario administrador verificado/creado: admin@rentastrajes.com / admin123');
    } catch (error) {
      console.log('⚠️ Usuario administrador ya existe o error al crear:', error.message);
    }
    
    console.log('✅ Tablas inicializadas correctamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error al inicializar tablas:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  client,
  testConnection,
  executeQuery,
  executeTransaction,
  getDatabaseStats,
  initializeTables
};