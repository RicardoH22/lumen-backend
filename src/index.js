const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Middlewares globales 
app.use(cors());
app.use(express.json());

// 2. Importación de rutas
const authRoutes = require('./routes/auth.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const ofertasRoutes = require('./routes/ofertas.routes');
const tutoriasRoutes = require('./routes/tutorias.routes');
const mapRoutes = require('./routes/map.routes');
const materiasRoutes = require('./routes/materias.routes');

// 3. Montaje de rutas
app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/ofertas', ofertasRoutes);
app.use('/api/tutorias', tutoriasRoutes);
app.use('/api/mapas', mapRoutes);
app.use('/api/materias', materiasRoutes);

const PORT = process.env.PORT || 3000;

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: 'API de LUMEN funcionando correctamente 🚀' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

