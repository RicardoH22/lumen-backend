const { Router } = require('express');
const { buscarDireccion } = require('../controllers/map.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = Router();

// Ruta protegida para buscar direcciones (ideal que solo usuarios logueados busquen ubicaciones de clases)
router.get('/buscar', verificarToken, buscarDireccion);

module.exports = router;