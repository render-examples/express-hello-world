const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// Conexión a MongoDB
mongoose.connect(ENV.DB_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Conexión exitosa a MongoDB'))
  .catch((error) => console.error('Error al conectar a MongoDB:', error));

// Definición del esquema de datos
const solicitudSchema = new mongoose.Schema({
  datos: Object,
}, { timestamps: true });

const Solicitud = mongoose.model('Solicitud', solicitudSchema);

app.use(bodyParser.json());

app.post('/enviar-solicitud', async (req, res) => {
  try {
    // Crear una nueva instancia de Solicitud con los datos recibidos
    const nuevaSolicitud = new Solicitud({ datos: req.body });

    // Guardar la solicitud en MongoDB
    const solicitudGuardada = await nuevaSolicitud.save();

    console.log('Solicitud guardada en MongoDB:', solicitudGuardada);
    res.send('Solicitud recibida y guardada correctamente');
  } catch (error) {
    console.error('Error al guardar la solicitud:', error);
    res.status(500).send('Error al guardar la solicitud');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
