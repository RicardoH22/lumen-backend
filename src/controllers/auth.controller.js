const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Registro de usuario (Estudiante o Tutor)
const registrar = async (req, res) => {
  const { nombre, apellido, correo, password, rol, telefono, ciudad, nivel_educativo, institucion, biografia, tarifa_hora_base } = req.body;

  try {
    // 1. Verificar si el correo ya existe
    const usuarioExistente = await db.query('SELECT id FROM usuarios WHERE correo = \$1', [correo]);
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // 2. Encriptar la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Iniciar transacción para asegurar que se crea el usuario y su perfil
    await db.query('BEGIN');

    const queryUsuario = `
      INSERT INTO usuarios (nombre, apellido, correo, password_hash, rol, telefono, proveedor_auth)
      VALUES ($1, $2, $3, $4, $5, $6, 'local')
      RETURNING id, nombre, apellido, correo, rol;
    `;
    const valuesUsuario = [nombre, apellido, correo, passwordHash, rol, telefono || null];
    const nuevoUsuarioRes = await db.query(queryUsuario, valuesUsuario);
    const usuario = nuevoUsuarioRes.rows[0];

    // 4. Crear el perfil correspondiente según el rol
    if (rol === 'estudiante') {
      const queryEstudiante = `
        INSERT INTO perfiles_estudiante (usuario_id, nivel_educativo, institucion, ciudad)
        VALUES ($1, $2, $3, $4);
      `;
      await db.query(queryEstudiante, [
        usuario.id,
        nivel_educativo || 'pregrado',
        institucion || null,
        ciudad || null
      ]);
    } else if (rol === 'tutor') {
      const queryTutor = `
        INSERT INTO perfiles_tutor (usuario_id, biografia, ciudad, tarifa_hora_base)
        VALUES ($1, $2, $3, $4);
      `;
      await db.query(queryTutor, [
        usuario.id,
        biografia || null,
        ciudad || null,
        tarifa_hora_base || 0
      ]);
    }

    await db.query('COMMIT');

    // 5. Generar Token JWT
    const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario,
      token
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
  }
};

// Inicio de sesión
const login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    // 1. Buscar usuario por correo
    const resultado = await db.query('SELECT * FROM usuarios WHERE correo = \$1', [correo]);
    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const usuario = resultado.rows[0];

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(403).json({ error: 'La cuenta se encuentra desactivada.' });
    }

    // 2. Validar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // 3. Generar Token JWT
    const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        avatar_url: usuario.avatar_url
      },
      token
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
};

module.exports = {
  registrar,
  login
};