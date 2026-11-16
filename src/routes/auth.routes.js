const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({
            ok: false,
            mensaje: 'Faltan campos obligatorios: correo, password'
        });
    }

    try {
        const { rows } = await pool.query(
            'SELECT id, nombre, apellido, correo, rol, password_hash FROM lumen.usuarios WHERE correo = $1',
            [correo]
        );

        if (rows.length === 0) {
            return res.status(400).json({ ok: false, mensaje: 'Correo o contraseña incorrectos.' });
        }

        const usuario = rows[0];

        const esValida = await bcrypt.compare(password, usuario.password_hash);
        if (!esValida) {
            return res.status(400).json({ ok: false, mensaje: 'Correo o contraseña incorrectos.' });
        }

        const token = jwt.sign(
            { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
            process.env.JWT_SECRET || 'lumen_secreto_cuc_2026',
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            ok: true,
            mensaje: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor al iniciar sesión' });
    }
});

// POST /api/auth/registro (Crea usuario y su perfil dentro de una transacción)
router.post('/registro', async (req, res) => {
    const { nombre, apellido, correo, password, rol } = req.body;

    if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({
            ok: false,
            mensaje: 'Faltan campos obligatorios: nombre, correo, password, rol.'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 1. Insertar usuario base
        const queryUsuario = `
            INSERT INTO lumen.usuarios (nombre, apellido, correo, password_hash, rol, proveedor_auth, activo)
            VALUES ($1, $2, $3, $4, $5, 'local', true)
            RETURNING id, nombre, apellido, correo, rol;
        `;
        const valuesUsuario = [nombre, apellido || '', correo, password_hash, rol];
        const { rows } = await client.query(queryUsuario, valuesUsuario);
        const nuevoUsuario = rows[0];

        // 2. Crear automáticamente el perfil correspondiente según el rol
        if (rol === 'estudiante') {
            await client.query(
                `INSERT INTO lumen.perfiles_estudiante (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING;`,
                [nuevoUsuario.id]
            );
        } else if (rol === 'tutor') {
            await client.query(
                `INSERT INTO lumen.perfiles_tutor (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING;`,
                [nuevoUsuario.id]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            ok: true,
            mensaje: 'Usuario y perfil registrados con éxito',
            usuario: nuevoUsuario
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ ok: false, mensaje: error.message || 'Error al registrar usuario' });
    } finally {
        client.release();
    }
});

module.exports = router;