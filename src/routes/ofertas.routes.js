const { Router } = require('express');
const router = Router();
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// ==========================================
// 1. RUTAS ESPECÍFICAS
// ==========================================

// GET: Obtener las tutorías confirmadas del tutor autenticado (Mis Tutorías)
router.get('/confirmadas/tutor', verificarToken, verificarRol('tutor'), async (req, res) => {
    const tutor_id = req.usuario.id; // Extraído del JWT

    try {
        const query = `
            SELECT 
                o.id as oferta_id,
                o.precio_hora,
                o.creada_en as fecha_oferta,
                s.id as solicitud_id,
                s.tema_especifico,
                s.nivel_educativo,
                s.modalidad,
                s.duracion_horas,
                m.nombre as materia_nombre,
                u.nombre as estudiante_nombre
            FROM lumen.ofertas o
            JOIN lumen.solicitudes s ON o.solicitud_id = s.id
            LEFT JOIN lumen.materias m ON s.materia_id = m.id
            LEFT JOIN lumen.usuarios u ON s.estudiante_id = u.id
            WHERE o.tutor_id = $1 AND o.estado = 'aceptada'
            ORDER BY o.creada_en DESC;
        `;

        const { rows } = await pool.query(query, [tutor_id]);

        res.status(200).json({
            ok: true,
            total_tutorias: rows.length,
            tutorias: rows
        });
    } catch (error) {
        console.error('Error al consultar tutorías confirmadas:', error);
        res.status(500).json({
            ok: false,
            mensaje: 'Error al consultar tutorías confirmadas'
        });
    }
});

// GET: Consultar todas las ofertas enviadas por el tutor autenticado
router.get('/tutor/mis-ofertas', verificarToken, verificarRol('tutor'), async (req, res) => {
    const tutor_id = req.usuario.id; // Extraído del JWT

    try {
        const query = `
            SELECT o.*, s.tema_especifico, s.nivel_educativo
            FROM lumen.ofertas o
            JOIN lumen.solicitudes s ON o.solicitud_id = s.id
            WHERE o.tutor_id = $1
            ORDER BY o.creada_en DESC;
        `;
        const { rows } = await pool.query(query, [tutor_id]);

        res.status(200).json({
            ok: true,
            total: rows.length,
            ofertas: rows
        });
    } catch (error) {
        console.error('Error al consultar ofertas del tutor:', error);
        res.status(500).json({
            ok: false,
            mensaje: 'Error interno al consultar las ofertas'
        });
    }
});

// ==========================================
// 2. RUTAS POST / PATCH / PARAMETRIZADAS
// ==========================================

// POST: Crear una nueva oferta (Tutor autenticado)
router.post('/', verificarToken, verificarRol('tutor'), async (req, res) => {
    const tutor_id = req.usuario.id; // Se obtiene del token, ya no se pasa por el body
    const { solicitud_id, precio_ofrecido, mensaje } = req.body;

    if (!solicitud_id || !precio_ofrecido) {
        return res.status(400).json({
            ok: false,
            mensaje: 'Faltan campos obligatorios: solicitud_id, precio_ofrecido'
        });
    }

    try {
        const query = `
            INSERT INTO lumen.ofertas (solicitud_id, tutor_id, precio_hora, mensaje, estado, creada_en, expira_en)
            VALUES ($1, $2, $3, $4, 'pendiente', NOW(), NOW() + INTERVAL '24 hours')
            RETURNING *;
        `;
        const values = [solicitud_id, tutor_id, precio_ofrecido, mensaje || null];

        const { rows } = await pool.query(query, values);

        res.status(201).json({
            ok: true,
            mensaje: '¡Oferta enviada con éxito!',
            oferta: rows[0]
        });
    } catch (error) {
        console.error('Error al crear la oferta:', error);
        res.status(500).json({
            ok: false,
            mensaje: error.message || 'Error interno del servidor al registrar la oferta'
        });
    }
});

// PATCH /api/ofertas/:id/aceptar
router.patch('/:id/aceptar', verificarToken, verificarRol('estudiante'), async (req, res) => {
    const { id } = req.params;
    const estudiante_id = req.usuario.id;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Obtener oferta y validar propiedad de la solicitud
        const ofertaRes = await client.query(
            `SELECT o.*, s.estudiante_id 
             FROM lumen.ofertas o
             JOIN lumen.solicitudes s ON o.solicitud_id = s.id
             WHERE o.id = $1`,
            [id]
        );

        if (ofertaRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ ok: false, mensaje: 'La oferta no existe.' });
        }

        const oferta = ofertaRes.rows[0];

        if (String(oferta.estudiante_id) !== String(estudiante_id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                ok: false,
                mensaje: 'No tienes permisos para aceptar una oferta de esta solicitud.'
            });
        }

        // 2. Marcar oferta como aceptada
        await client.query(
            `UPDATE lumen.ofertas SET estado = 'aceptada' WHERE id = $1`,
            [id]
        );

        // 3. Actualizar la solicitud a 'asignada'
        await client.query(
            `UPDATE lumen.solicitudes SET estado = 'asignada' WHERE id = $1`,
            [oferta.solicitud_id]
        );

        // 4. Registrar formalmente la tutoría en lumen.tutorias
        const tutoriaRes = await client.query(
            `INSERT INTO lumen.tutorias (solicitud_id, oferta_id, estudiante_id, tutor_id, estado)
             VALUES ($1, $2, $3, $4, 'confirmada', NOW(), $5, $6)
             RETURNING *`,
            [
        oferta.solicitud_id, 
        oferta.id, 
        estudiante_id, 
        oferta.tutor_id, 
        oferta.duracion_horas || 1, 
        oferta.precio_hora, 
        oferta.modalidad || 'virtual'
    ]
);

        await client.query('COMMIT');

        res.status(200).json({
            ok: true,
            mensaje: '¡Oferta aceptada con éxito y tutoría generada!',
            tutoria: tutoriaRes.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al aceptar oferta:', error);
        res.status(500).json({
            ok: false,
            mensaje: error.message || 'Error interno al procesar la aceptación'
        });
    } finally {
        client.release();
    }
});


// GET /api/ofertas/solicitud/:solicitud_id
// Permite al estudiante ver todas las ofertas recibidas para su solicitud
router.get('/solicitud/:solicitud_id', verificarToken, async (req, res) => {
    const { solicitud_id } = req.params;

    try {
        const { rows } = await pool.query(
            `SELECT * FROM lumen.ofertas WHERE solicitud_id = $1`,
            [solicitud_id]
        );

        res.status(200).json({
            ok: true,
            total: rows.length,
            ofertas: rows
        });
    } catch (error) {
        console.error('Error al obtener ofertas:', error);
        res.status(500).json({ ok: false, mensaje: error.message });
    }
});

module.exports = router;