const express = require('express');
const router = express.Router();

// Importa tu conexión a la base de datos (ajusta la ruta si tu archivo db.js está en otra carpeta)
const pool = require('../db'); 

// POST: Crear una nueva solicitud de tutoría (Basada en el esquema de la BD)
router.post('/', async (req, res) => {
    try {
        const { 
            estudiante_id, 
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

        // Validamos los campos obligatorios según el esquema de la BD
        if (!estudiante_id || !materia_id || !nivel_educativo || !modalidad || !duracion_horas) {
            return res.status(400).json({ 
                ok: false, 
                mensaje: 'Faltan campos obligatorios (estudiante_id, materia_id, nivel_educativo, modalidad, duracion_horas).' 
            });
        }

        // Consulta SQL para insertar en la tabla 'solicitudes'
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

        // Ejecutamos la consulta en PostgreSQL (Neon)
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

// RUTA: Obtener las solicitudes de un estudiante

router.get('/estudiante/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT * FROM lumen.solicitudes 
            WHERE estudiante_id = $1 
            ORDER BY creada_en DESC;
        `;
        const { rows } = await pool.query(query, [id]);
        
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

// RUTA: Ver las ofertas recibidas para una solicitud específica

router.get('/:id/ofertas', async (req, res) => {
    const { id } = req.params; // id de la solicitud
    try {
        
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