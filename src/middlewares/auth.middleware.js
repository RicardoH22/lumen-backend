const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token de autenticación.' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token mal formado o ausente.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lumen_secreto_cuc_2026');
    req.usuario = decoded; 
    next(); 
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

const verificarRol = (rolRequerido) => {
  return (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== rolRequerido) {
      return res.status(403).json({ error: 'No tienes los permisos necesarios (Rol no autorizado).' });
    }
    next();
  };
};

module.exports = {
  verificarToken,
  verificarRol
};