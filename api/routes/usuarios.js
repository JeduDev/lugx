const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult, param, query } = require('express-validator');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Validaciones para usuarios
const usuarioValidation = [
  body('nombreUsuario').notEmpty().withMessage('El nombre de usuario es requerido').isLength({ min: 2, max: 50 }),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('rol').isIn(['admin', 'moderador', 'usuario']).withMessage('Rol inválido')
];

const usuarioUpdateValidation = [
  body('nombreUsuario').optional().notEmpty().withMessage('El nombre de usuario es requerido').isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('rol').optional().isIn(['admin', 'moderador', 'usuario']).withMessage('Rol inválido'),
  body('activo').optional().isIn([0, 1]).withMessage('Estado activo inválido')
];

// GET /api/usuarios - Obtener todos los usuarios con paginación y filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('search').optional().isLength({ max: 100 }),
  query('rol').optional().isIn(['admin', 'moderador', 'usuario']),
  query('activo').optional().isIn(['0', '1'])
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const rol = req.query.rol;
    const activo = req.query.activo;

    // Construir consulta con filtros
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (nombreUsuario LIKE ?${paramIndex} OR email LIKE ?${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (rol) {
      whereClause += ` AND rol = ?${paramIndex}`;
      params.push(rol);
      paramIndex++;
    }

    if (activo !== undefined) {
      whereClause += ` AND activo = ?${paramIndex}`;
      params.push(parseInt(activo));
      paramIndex++;
    }

    // Obtener total de registros
    const countQuery = `SELECT COUNT(*) as total FROM usuarios ${whereClause}`;
    const countResult = await executeQuery(countQuery, params);

    if (!countResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al contar usuarios',
        error: countResult.error
      });
    }

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Obtener usuarios con paginación (sin contraseñas)
    const usuariosQuery = `
      SELECT idUsuario, nombreUsuario, email, rol, activo,
             ultimoAcceso, fechaCreacion
      FROM usuarios 
      ${whereClause}
      ORDER BY fechaCreacion DESC
      LIMIT ?${paramIndex} OFFSET ?${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await executeQuery(usuariosQuery, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
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

// GET /api/usuarios/debug - Endpoint temporal para debug
router.get('/debug', async (req, res) => {
  try {
    const result = await executeQuery('SELECT idUsuario, nombreUsuario, email, rol, activo FROM usuarios');
    
    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/usuarios/:id - Obtener un usuario específico
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const query = `
      SELECT idUsuario, nombreUsuario, email, rol, activo,
             ultimoAcceso, fechaCreacion
      FROM usuarios 
      WHERE idUsuario = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener usuario',
        error: result.error
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// POST /api/usuarios - Crear nuevo usuario
router.post('/', usuarioValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const {
      nombreUsuario, email, password, rol
    } = req.body;

    // Verificar si el email ya existe
    const emailCheck = await executeQuery('SELECT idUsuario FROM usuarios WHERE email = ?1', [email]);
    if (emailCheck.success && emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Verificar si el nombre de usuario ya existe
    const usernameCheck = await executeQuery('SELECT idUsuario FROM usuarios WHERE nombreUsuario = ?1', [nombreUsuario]);
    if (usernameCheck.success && usernameCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'El nombre de usuario ya está registrado'
      });
    }

    // Encriptar contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const query = `
      INSERT INTO usuarios (
        nombreUsuario, email, password, rol, fechaCreacion, ultimoAcceso, activo
      ) VALUES (
        ?1, ?2, ?3, ?4, datetime('now'), datetime('now'), 1
      )
    `;

    const params = [
      nombreUsuario, email, hashedPassword, rol
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al crear usuario',
        error: result.error
      });
    }

    // Obtener el usuario creado (sin contraseña)
    const newUsuarioQuery = `
      SELECT idUsuario, nombreUsuario, email, rol, activo,
             ultimoAcceso, fechaCreacion
      FROM usuarios 
      WHERE idUsuario = ?1
    `;

    const newUsuario = await executeQuery(newUsuarioQuery, [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: newUsuario.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/usuarios/:id - Actualizar usuario
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
  ...usuarioUpdateValidation
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

    const { id } = req.params;
    const {
      nombre_completo, email, password, rol, estado, avatar_url
    } = req.body;

    // Verificar si el usuario existe
    const usuarioCheck = await executeQuery('SELECT id FROM usuarios WHERE id = ?1', [id]);
    if (!usuarioCheck.success || usuarioCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el email ya existe en otro usuario
    if (email) {
      const emailCheck = await executeQuery('SELECT id FROM usuarios WHERE email = ?1 AND id != ?2', [email, id]);
      if (emailCheck.success && emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'El email ya está registrado por otro usuario'
        });
      }
    }

    // Construir query de actualización dinámicamente
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (nombre_completo) {
      updateFields.push(`nombre_completo = ?${paramIndex}`);
      params.push(nombre_completo);
      paramIndex++;
    }

    if (email) {
      updateFields.push(`email = ?${paramIndex}`);
      params.push(email);
      paramIndex++;
    }

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateFields.push(`password_hash = ?${paramIndex}`);
      params.push(hashedPassword);
      paramIndex++;
    }

    if (rol) {
      updateFields.push(`rol = ?${paramIndex}`);
      params.push(rol);
      paramIndex++;
    }

    if (estado) {
      updateFields.push(`estado = ?${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (avatar_url !== undefined) {
      updateFields.push(`avatar_url = ?${paramIndex}`);
      params.push(avatar_url);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron campos para actualizar'
      });
    }

    updateFields.push('fecha_actualizacion = datetime("now")');
    params.push(id);

    const query = `
      UPDATE usuarios SET ${updateFields.join(', ')}
      WHERE id = ?${paramIndex}
    `;

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar usuario',
        error: result.error
      });
    }

    // Obtener el usuario actualizado (sin contraseña)
    const updatedUsuarioQuery = `
      SELECT id, nombre_completo, email, rol, estado, avatar_url,
             ultimo_acceso, fecha_registro, fecha_actualizacion
      FROM usuarios 
      WHERE id = ?1
    `;

    const updatedUsuario = await executeQuery(updatedUsuarioQuery, [id]);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUsuario.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (soft delete)
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    // Verificar si el usuario existe
    const usuarioCheck = await executeQuery('SELECT id, estado FROM usuarios WHERE id = ?1', [id]);
    if (!usuarioCheck.success || usuarioCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que no sea el último administrador activo
    const adminCount = await executeQuery(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin" AND estado = "activo" AND id != ?1',
      [id]
    );

    if (adminCount.success && adminCount.rows[0].count === 0) {
      const currentUser = await executeQuery('SELECT rol FROM usuarios WHERE id = ?1', [id]);
      if (currentUser.success && currentUser.rows[0].rol === 'admin') {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el último administrador del sistema'
        });
      }
    }

    // Soft delete - cambiar estado a inactivo
    const query = `
      UPDATE usuarios SET 
        estado = 'inactivo', 
        fecha_actualizacion = datetime('now')
      WHERE id = ?1
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// PUT /api/usuarios/:id/ultimo-acceso - Actualizar último acceso
router.put('/:id/ultimo-acceso', [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const query = `
      UPDATE usuarios SET 
        ultimo_acceso = datetime('now'),
        fecha_actualizacion = datetime('now')
      WHERE id = ?1 AND estado = 'activo'
    `;

    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar último acceso',
        error: result.error
      });
    }

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado o inactivo'
      });
    }

    res.json({
      success: true,
      message: 'Último acceso actualizado'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/usuarios/estadisticas/resumen - Obtener estadísticas de usuarios
router.get('/estadisticas/resumen', async (req, res) => {
  try {
    const queries = [
      { name: 'total', sql: 'SELECT COUNT(*) as count FROM usuarios' },
      { name: 'activos', sql: 'SELECT COUNT(*) as count FROM usuarios WHERE estado = "activo"' },
      { name: 'inactivos', sql: 'SELECT COUNT(*) as count FROM usuarios WHERE estado = "inactivo"' },
      { name: 'administradores', sql: 'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin" AND estado = "activo"' },
      { name: 'empleados', sql: 'SELECT COUNT(*) as count FROM usuarios WHERE rol = "empleado" AND estado = "activo"' },
      { 
        name: 'online', 
        sql: `SELECT COUNT(*) as count FROM usuarios 
              WHERE estado = 'activo' 
              AND ultimo_acceso > datetime('now', '-15 minutes')` 
      },
      {
        name: 'nuevos_mes',
        sql: `SELECT COUNT(*) as count FROM usuarios 
              WHERE strftime('%Y-%m', fecha_registro) = strftime('%Y-%m', 'now')`
      }
    ];

    const estadisticas = {};

    for (const query of queries) {
      const result = await executeQuery(query.sql);
      if (result.success) {
        estadisticas[query.name] = result.rows[0].count;
      }
    }

    res.json({
      success: true,
      data: estadisticas
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;