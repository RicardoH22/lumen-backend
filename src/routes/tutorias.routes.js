const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken } = require('../middlewares/auth.middleware');

// GET /api/tutorias/mis-tutorias
// Obtiene el historial/lista de tutorías del estudiante o tutor autenticado
router.get('/mis-tutorias', verificarToken, async (req, res) => {
    const usuario_id = req.usuario.id;
    const rol = req.usuario.rol;

    try {
        const campoFiltro = rol === 'tutor' ? 'tutor_id' : 'estudiante_id';
        const query = `
            SELECT 
                t.id,
                t.solicitud_id,
                t.oferta_id,
                t.estudiante_id,
                t.tutor_id,
                t.fecha_inicio,
                t.duracion_horas,
                t.precio_hora,
                t.precio_total,
                t.modalidad,
                t.enlace_sala,
                t.estado,
                t.creada_en,
                s.tema_especifico
            FROM lumen.tutorias t
            JOIN lumen.solicitudes s ON t.solicitud_id = s.id
            WHERE t.${campoFiltro} = $1
            ORDER BY t.id DESC;
        `;
        const { rows } = await pool.query(query, [usuario_id]);

        res.status(200).json({
            ok: true,
            total: rows.length,
            tutorias: rows
        });
    } catch (error) {
        console.error('Error al obtener tutorías:', error);
        res.status(500).json({ ok: false, mensaje: 'Error al obtener el listado de tutorías.' });
    }
});

// POST /api/tutorias
// Registrar tutoría manualmente a partir de una solicitud y oferta aceptada
router.post('/', verificarToken, async (req, res) => {
    const { solicitud_id, oferta_id, tutor_id, fecha_inicio, duracion_horas, precio_hora, modalidad } = req.body || {};
    const estudiante_id = req.usuario.id;

    if (!solicitud_id || !oferta_id || !tutor_id) {
        return res.status(400).json({
            ok: false,
            mensaje: 'Faltan campos obligatorios: solicitud_id, oferta_id, tutor_id.'
        });
    }

    try {
        let duracion = duracion_horas;
        let mod = modalidad;

        const solRes = await pool.query(
            `SELECT duracion_horas, modalidad FROM lumen.solicitudes WHERE id = $1`,
            [solicitud_id]
        );

        if (solRes.rows.length > 0) {
            if (!duracion) duracion = solRes.rows[0].duracion_horas;
            if (!mod) mod = solRes.rows[0].modalidad;
        }

        duracion = duracion || 1;
        mod = mod || 'virtual';

        let precio = precio_hora;
        if (!precio) {
            const ofRes = await pool.query(
                `SELECT precio_hora FROM lumen.ofertas WHERE id = $1`,
                [oferta_id]
            );
            precio = ofRes.rows.length > 0 && ofRes.rows[0].precio_hora ? ofRes.rows[0].precio_hora : 0;
        }

        const { rows } = await pool.query(
            `INSERT INTO lumen.tutorias 
                (solicitud_id, oferta_id, estudiante_id, tutor_id, estado, fecha_inicio, duracion_horas, precio_hora, modalidad)
             VALUES ($1, $2, $3, $4, 'confirmada', COALESCE($5::timestamp, NOW()), $6, $7, $8)
             RETURNING *`,
            [solicitud_id, oferta_id, estudiante_id, tutor_id, fecha_inicio || null, duracion, precio, mod]
        );

        res.status(201).json({
            ok: true,
            mensaje: 'Tutoría registrada correctamente.',
            tutoria: rows[0]
        });
    } catch (error) {
        console.error('Error al crear tutoría:', error);
        res.status(500).json({ ok: false, mensaje: 'Error al registrar la tutoría.' });
    }
});

// PATCH /api/tutorias/:id/enlace
// Asignar/Actualizar enlace de la sala virtual por parte del tutor
router.patch('/:id/enlace', verificarToken, async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const enlace_sala = body.enlace_sala || body.enlace_reunion || body.link;
    const tutor_id = req.usuario.id;

    if (!enlace_sala) {
        return res.status(400).json({ 
            ok: false, 
            mensaje: 'El enlace de la sala es requerido.' 
        });
    }

    try {
        const result = await pool.query(
            `UPDATE lumen.tutorias 
             SET enlace_sala = $1 
             WHERE id = $2 AND tutor_id = $3 
             RETURNING *`,
            [enlace_sala, id, tutor_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: 'Tutoría no encontrada o no tienes permisos de tutor para modificarla.'
            });
        }

        res.status(200).json({
            ok: true,
            mensaje: 'Enlace de sala actualizado con éxito.',
            tutoria: result.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar enlace:', error);
        res.status(500).json({ ok: false, mensaje: 'Error interno al actualizar el enlace.' });
    }
});

// PATCH /api/tutorias/:id/estado
// Cambiar estado de la tutoría ('confirmada', 'en_curso', 'finalizada', 'cancelada')
router.patch('/:id/estado', verificarToken, async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const estado = body.estado;
    const usuario_id = req.usuario.id;

    const estadosPermitidos = ['confirmada', 'en_curso', 'finalizada', 'cancelada'];
    if (!estado || !estadosPermitidos.includes(estado)) {
        return res.status(400).json({
            ok: false,
            mensaje: `Estado no válido. Opciones permitidas: ${estadosPermitidos.join(', ')}`
        });
    }

    try {
        const tutoriaRes = await pool.query(
            `SELECT * FROM lumen.tutorias WHERE id = $1`,
            [id]
        );

        if (tutoriaRes.rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Tutoría no encontrada.' });
        }

        const tutoria = tutoriaRes.rows[0];

        if (String(tutoria.estudiante_id) !== String(usuario_id) && String(tutoria.tutor_id) !== String(usuario_id)) {
            return res.status(403).json({ ok: false, mensaje: 'No tienes acceso a esta tutoría.' });
        }

        const updated = await pool.query(
            `UPDATE lumen.tutorias SET estado = $1 WHERE id = $2 RETURNING *`,
            [estado, id]
        );

        res.status(200).json({
            ok: true,
            mensaje: `Estado de la tutoría actualizado a '${estado}'`,
            tutoria: updated.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar estado de la tutoría:', error);
        res.status(500).json({ ok: false, mensaje: 'Error al actualizar el estado de la tutoría.' });
    }
});

module.exports = router;