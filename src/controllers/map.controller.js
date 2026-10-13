const buscarDireccion = async (req, res) => {
  try {
    const { q } = req.query; // Ejemplo: ?q=Calle 72, Barranquilla

    if (!q) {
      return res.status(400).json({ error: 'Falta el parámetro de búsqueda "q" con la dirección.' });
    }

    // Usamos fetch nativo de Node.js para consultar la API pública y gratuita de OpenStreetMap
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LumenApp-Backend' // OpenStreetMap exige un User-Agent por normas de uso
      }
    });

    const data = await response.json();

    res.json({
      mensaje: "Búsqueda de ubicación exitosa",
      resultados: data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al conectar con el servicio de mapas.' });
  }
};

module.exports = {
  buscarDireccion
};