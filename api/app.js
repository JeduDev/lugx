const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Importar configuración de base de datos
const { testConnection, initializeTables } = require('./config/database');

// Importar rutas
const clientesRoutes = require('./routes/clientes');
const trajesRoutes = require('./routes/trajes');
const rentasRoutes = require('./routes/rentas');
const usuariosRoutes = require('./routes/usuarios');
const notificationsRoutes = require('./routes/notifications');
const { router: authRoutes, verifyToken } = require('./routes/auth');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como aplicaciones móviles o Postman)
    if (!origin) return callback(null, true);
    
    // Lista de dominios permitidos
    const allowedOrigins = [
      'http://localhost:8000', // Frontend server (Python)
      'http://127.0.0.1:8000',
      'http://localhost:8001', // Frontend server alternativo
      'http://127.0.0.1:8080',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:5173',
      'http://localhost:8001',
      "http://localhost:8009",
      "https://08bbf551fbc4.ngrok-free.app",
      "https://878a69659087.ngrok-free.app"
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control']
};

// Configuración de rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting específico para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// Middleware básico
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Aplicar rate limiting
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// El servidor solo maneja la API - no sirve archivos estáticos

// Middleware para logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/trajes', trajesRoutes);
app.use('/api/rentas', rentasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/notifications', notificationsRoutes);

// Ruta de salud del servidor
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    res.json({
      success: true,
      message: 'Servidor funcionando correctamente',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus.success ? 'connected' : 'disconnected',
        version: '1.0.0'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error.message
      }
    });
  }
});

// Ruta para información de la API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API de Lugx Gaming - Sistema de Gestión de Trajes',
    data: {
      version: '1.0.0',
      endpoints: {
        auth: {
          login: 'POST /api/auth/login',
          logout: 'POST /api/auth/logout',
          me: 'GET /api/auth/me',
          changePassword: 'PUT /api/auth/change-password',
          forgotPassword: 'POST /api/auth/forgot-password',
          resetPassword: 'POST /api/auth/reset-password',
          verifyToken: 'GET /api/auth/verify-token'
        },
        clientes: {
          list: 'GET /api/clientes',
          create: 'POST /api/clientes',
          get: 'GET /api/clientes/:id',
          update: 'PUT /api/clientes/:id',
          delete: 'DELETE /api/clientes/:id',
          history: 'GET /api/clientes/:id/historial'
        },
        trajes: {
          list: 'GET /api/trajes',
          create: 'POST /api/trajes',
          get: 'GET /api/trajes/:id',
          update: 'PUT /api/trajes/:id',
          delete: 'DELETE /api/trajes/:id',
          available: 'GET /api/trajes/disponibles',
          history: 'GET /api/trajes/:id/historial',
          stats: 'GET /api/trajes/estadisticas/resumen'
        },
        rentas: {
          list: 'GET /api/rentas',
          create: 'POST /api/rentas',
          get: 'GET /api/rentas/:id',
          update: 'PUT /api/rentas/:id',
          cancel: 'DELETE /api/rentas/:id',
          active: 'GET /api/rentas/activas',
          stats: 'GET /api/rentas/estadisticas/resumen'
        },
        usuarios: {
          list: 'GET /api/usuarios',
          create: 'POST /api/usuarios',
          get: 'GET /api/usuarios/:id',
          update: 'PUT /api/usuarios/:id',
          delete: 'DELETE /api/usuarios/:id',
          updateAccess: 'PUT /api/usuarios/:id/ultimo-acceso',
          stats: 'GET /api/usuarios/estadisticas/resumen'
        },
        notifications: {
          list: 'GET /api/notifications',
          create: 'POST /api/notifications',
          get: 'GET /api/notifications/:id',
          update: 'PUT /api/notifications/:id',
          delete: 'DELETE /api/notifications/:id',
          markRead: 'PUT /api/notifications/:id/read',
          stats: 'GET /api/notifications/stats/summary'
        }
      }
    }
  });
});

// Ruta para servir el panel de administración
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, '../panel/index.html'));
});

app.get('/panel/*', (req, res) => {
  const requestedFile = req.params[0];
  const filePath = path.join(__dirname, '../panel', requestedFile);
  
  // Verificar si el archivo existe
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    // Si no existe, servir index.html para SPA routing
    res.sendFile(path.join(__dirname, '../panel/index.html'));
  }
});

// Middleware para rutas protegidas (ejemplo)
const protectedRoutes = [
  '/api/usuarios',
  '/api/clientes',
  '/api/trajes',
  '/api/rentas'
];

app.use(protectedRoutes, (req, res, next) => {
  // Excluir métodos GET para algunos endpoints públicos
  if (req.method === 'GET' && (
    req.path.includes('/disponibles') ||
    req.path.includes('/estadisticas')
  )) {
    return next();
  }
  
  // Aplicar verificación de token para otras operaciones
  verifyToken(req, res, next);
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    data: {
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Error de CORS
  if (error.message === 'No permitido por CORS') {
    return res.status(403).json({
      success: false,
      message: 'Acceso no permitido por CORS',
      error: 'Origin no autorizado'
    });
  }
  
  // Error de JSON malformado
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      message: 'JSON malformado',
      error: 'Verifica la sintaxis del JSON enviado'
    });
  }
  
  // Error de payload muy grande
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Archivo demasiado grande',
      error: 'El tamaño del archivo excede el límite permitido'
    });
  }
  
  // Error genérico
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
  });
});

// Función para inicializar el servidor
async function startServer() {
  try {
    // Probar conexión a la base de datos
    console.log('🔍 Probando conexión a la base de datos...');
    const dbTest = await testConnection();
    
    if (!dbTest.success) {
      console.error('❌ Error al conectar con la base de datos:', dbTest.error);
      process.exit(1);
    }
    
    console.log('✅ Conexión a la base de datos exitosa');
    
    // Inicializar tablas
    console.log('🔧 Inicializando tablas de la base de datos...');
    const initResult = await initializeTables();
    
    if (!initResult.success) {
      console.error('❌ Error al inicializar tablas:', initResult.error);
      process.exit(1);
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
      console.log(`📱 Panel de administración: http://localhost:${PORT}/panel`);
      console.log(`🔗 API disponible en: http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 Documentación: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de señales del sistema
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

// Iniciar servidor si este archivo es ejecutado directamente
if (require.main === module) {
  startServer();
}

module.exports = app;