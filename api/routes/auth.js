const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Clave secreta para JWT (en producción debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'lugx_gaming_secret_key_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Middleware para verificar token JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso requerido'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Validaciones
const loginValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
];

const changePasswordValidation = [
  body('current_password').notEmpty().withMessage('Contraseña actual requerida'),
  body('new_password').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.new_password) {
      throw new Error('Las contraseñas no coinciden');
    }
    return true;
  })
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Email inválido')
];

// POST /api/auth/login - Iniciar sesión
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuario por email
    const userQuery = `
      SELECT idUsuario as id, nombreUsuario as nombre_completo, email, password, rol, activo
      FROM usuarios 
      WHERE email = ?1
    `;

    const userResult = await executeQuery(userQuery, [email]);

    if (!userResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al buscar usuario',
        error: userResult.error
      });
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const user = userResult.rows[0];

    // Debug: verificar el valor del campo activo
    console.log('Debug - user.activo:', user.activo, 'tipo:', typeof user.activo);

    // Verificar si el usuario está activo (1 = activo, 0 = inactivo)
    if (user.activo != 1) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo. Contacte al administrador.'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Actualizar último acceso
    await executeQuery(
      'UPDATE usuarios SET ultimoAcceso = datetime("now") WHERE idUsuario = ?1',
      [user.id]
    );

    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        nombre_completo: user.nombre_completo
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Respuesta sin contraseña
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: userWithoutPassword,
        token,
        expiresIn: JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // En una implementación más robusta, aquí se podría agregar el token a una blacklist
    // Por ahora, simplemente confirmamos el logout
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/auth/me - Obtener información del usuario autenticado
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userQuery = `
      SELECT idUsuario as id, nombreUsuario as nombre_completo, email, rol, activo as estado,
             ultimoAcceso, fechaCreacion
      FROM usuarios 
      WHERE idUsuario = ?1 AND activo = 1
    `;

    const userResult = await executeQuery(userQuery, [req.user.id]);

    if (!userResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener información del usuario',
        error: userResult.error
      });
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado o inactivo'
      });
    }

    res.json({
      success: true,
      data: userResult.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/auth/change-password - Cambiar contraseña
router.put('/change-password', [verifyToken, ...changePasswordValidation], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { current_password, new_password } = req.body;

    // Obtener contraseña actual del usuario
    const userQuery = 'SELECT password FROM usuarios WHERE idUsuario = ?1';
    const userResult = await executeQuery(userQuery, [req.user.id]);

    if (!userResult.success || userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(
      current_password, 
      userResult.rows[0].password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

    // Actualizar contraseña
    const updateQuery = `
      UPDATE usuarios SET 
        password = ?1
      WHERE idUsuario = ?2
    `;

    const updateResult = await executeQuery(updateQuery, [hashedNewPassword, req.user.id]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar contraseña',
        error: updateResult.error
      });
    }

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// POST /api/auth/forgot-password - Solicitar recuperación de contraseña
router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Verificar si el usuario existe
    const userQuery = 'SELECT idUsuario as id, nombreUsuario as nombre_completo FROM usuarios WHERE email = ?1 AND activo = 1';
    const userResult = await executeQuery(userQuery, [email]);

    // Por seguridad, siempre devolvemos el mismo mensaje
    const message = 'Si el email existe en nuestro sistema, recibirás instrucciones para recuperar tu contraseña.';

    if (!userResult.success || userResult.rows.length === 0) {
      return res.json({
        success: true,
        message
      });
    }

    // Generar token de recuperación (válido por 1 hora)
    const resetToken = jwt.sign(
      { 
        id: userResult.rows[0].id, 
        email,
        type: 'password_reset'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // En una implementación real, aquí se enviaría un email con el token
    // Por ahora, solo guardamos el token en la base de datos
    const saveTokenQuery = `
      UPDATE usuarios SET 
        resetToken = ?1,
        resetTokenExpires = datetime('now', '+1 hour')
      WHERE idUsuario = ?2
    `;

    await executeQuery(saveTokenQuery, [resetToken, userResult.rows[0].id]);

    // En desarrollo, devolvemos el token para pruebas
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.json({
      success: true,
      message,
      ...(isDevelopment && { reset_token: resetToken }) // Solo en desarrollo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// POST /api/auth/reset-password - Restablecer contraseña con token
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requerido'),
  body('new_password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.new_password) {
      throw new Error('Las contraseñas no coinciden');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const { token, new_password } = req.body;

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'password_reset') {
        throw new Error('Token inválido');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Verificar que el token existe en la base de datos y no ha expirado
    const tokenQuery = `
      SELECT idUsuario as id FROM usuarios 
      WHERE idUsuario = ?1 
      AND resetToken = ?2 
      AND resetTokenExpires > datetime('now')
      AND activo = 1
    `;

    const tokenResult = await executeQuery(tokenQuery, [decoded.id, token]);

    if (!tokenResult.success || tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);

    // Actualizar contraseña y limpiar token
    const updateQuery = `
      UPDATE usuarios SET 
        password = ?1,
        resetToken = NULL,
        resetTokenExpires = NULL
      WHERE idUsuario = ?2
    `;

    const updateResult = await executeQuery(updateQuery, [hashedPassword, decoded.id]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al restablecer contraseña',
        error: updateResult.error
      });
    }

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/auth/verify-token - Verificar si un token es válido
router.get('/verify-token', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token válido',
      data: {
        user: req.user,
        valid: true
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Exportar middleware para uso en otras rutas
module.exports = { router, verifyToken };