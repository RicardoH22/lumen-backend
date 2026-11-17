const { Router } = require('express');
const pool = require('../db');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', verificarToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, nombre FROM lumen.materias ORDER BY nombre, id'
        );
        res.json({ ok: true, total: rows.length, materias: rows });
    } catch (error) {
        console.error('Error al consultar materias:', error);
        res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el catálogo de materias.' });
    }
});

module.exports = router;
