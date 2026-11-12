const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

const mapRoutes = require('./routes/map.routes');
app.use('/api/mapas', mapRoutes);

const PORT = process.env.PORT || 3000;

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: 'API de LUMEN funcionando correctamente 🚀' });
});

// Registrar rutas de la API
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/solicitudes', require('./routes/solicitudes.routes'));

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

