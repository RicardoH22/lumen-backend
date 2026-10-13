const { Router } = require('express');
const { registrar, login } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware'); // <-- Importas el middleware

const router = Router();

// Rutas públicas
router.post('/registro', registrar);
router.post('/login', login);

// NUEVA RUTA PROTEGIDA DE PRUEBA
router.get('/perfil', verificarToken, (req, res) => {
  res.json({
    mensaje: "¡Acceso autorizado a la ruta protegida!",
    usuario: req.usuario 
  });
});

module.exports = router;