const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// GET: Listar todas las solicitudes activas (para los tutores autenticados)
router.get('/', verificarToken, verificarRol('tutor'), async (req, res) => {
    try {
        const query = `
            SELECT s.*, m.nombre as materia_nombre 
            FROM lumen.solicitudes s
            LEFT JOIN lumen.materias m ON s.materia_id = m.id
            WHERE s.estado = 'activa'
            ORDER BY s.creada_en DESC;
        `;
        const { rows } = await pool.query(query);

        res.status(200).json({
            ok: true,
            total: rows.length,
            solicitudes: rows
        });
    } catch (error) {
        console.error('Error al consultar solicitudes activas:', error);
        res.status(500).json({
            ok: false,
            mensaje: 'Error interno del servidor al consultar solicitudes activas'
        });
    }
});

// GET: Obtener las solicitudes creadas por el estudiante autenticado
router.get('/mis-solicitudes', verificarToken, verificarRol('estudiante'), async (req, res) => {
    const estudiante_id = req.usuario.id; // Extraído del JWT
    try {
        const query = `
            SELECT * FROM lumen.solicitudes 
            WHERE estudiante_id = $1 
            ORDER BY creada_en DESC;
        `;
        const { rows } = await pool.query(query, [estudiante_id]);
        
        res.status(200).json({
            ok: true,
            total: rows.length,
            solicitudes: rows
        });
    } catch (error) {
        console.error('Error al obtener las solicitudes:', error);
        res.status(500).json({
            ok: false,
            mensaje: 'Error interno del servidor al obtener las solicitudes'
        });
    }
});

// POST: Crear una nueva solicitud de tutoría (Estudiante autenticado)
router.post('/', verificarToken, verificarRol('estudiante'), async (req, res) => {
    try {
        const estudiante_id = req.usuario.id; // Extraído de forma segura del JWT

        const { 
            materia_id, 
            tema_especifico, 
            nivel_educativo, 
            modalidad, 
            tipo, 
            fecha_programada, 
            duracion_horas, 
            presupuesto_hora, 
            ciudad 
        } = req.body;

        // Validamos los campos obligatorios
        if (!materia_id || !nivel_educativo || !modalidad || !duracion_horas) {
            return res.status(400).json({ 
                ok: false, 
                mensaje: 'Faltan campos obligatorios (materia_id, nivel_educativo, modalidad, duracion_horas).' 
            });
        }

        const query = `
            INSERT INTO lumen.solicitudes (
                estudiante_id, materia_id, tema_especifico, nivel_educativo, 
                modalidad, tipo, fecha_programada, duracion_horas, presupuesto_hora, ciudad, estado
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'activa') 
            RETURNING *;
        `;
        
        const values = [
            estudiante_id, 
            materia_id, 
            tema_especifico || null, 
            nivel_educativo, 
            modalidad, 
            tipo || 'inmediata', 
            fecha_programada || null, 
            duracion_horas, 
            presupuesto_hora || 0, 
            ciudad || null
        ];

        const nuevaSolicitud = await pool.query(query, values);

        res.status(201).json({
            ok: true,
            mensaje: '¡Solicitud creada y guardada en la base de datos con éxito!',
            solicitud: nuevaSolicitud.rows[0]
        });

    } catch (error) {
        console.error('Error al guardar la solicitud en la BD:', error);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor al procesar la solicitud' });
    }
});

// GET: Ver las ofertas recibidas para una solicitud específica (Estudiante autenticado)
router.get('/:id/ofertas', verificarToken, verificarRol('estudiante'), async (req, res) => {
    const { id } = req.params;
    const estudiante_id = req.usuario.id;

    try {
        // Validar que la solicitud pertenezca al estudiante logueado
        const solCheck = await pool.query(
            'SELECT estudiante_id FROM lumen.solicitudes WHERE id = $1',
            [id]
        );

        if (solCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: 'La solicitud no existe' });
        }

        if (solCheck.rows[0].estudiante_id !== estudiante_id) {
            return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para ver las ofertas de esta solicitud' });
        }

        const query = `
            SELECT o.*, t.tarifa_hora as tarifa_tutor 
            FROM lumen.ofertas o
            LEFT JOIN lumen.tutores t ON o.tutor_id = t.id
            WHERE o.solicitud_id = $1
            ORDER BY o.creada_en DESC;
        `;
        const { rows } = await pool.query(query, [id]);
        
        res.status(200).json({
            ok: true,
            solicitud_id: id,
            total_ofertas: rows.length,
            ofertas: rows
        });
    } catch (error) {
        console.error('Error al obtener las ofertas:', error);
        res.status(500).json({
            ok: false,
            mensaje: 'Error interno del servidor al obtener las ofertas de la solicitud'
        });
    }
});

module.exports = router;