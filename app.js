const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;
app.use(bodyParser.json());
app.post('/enviar-solicitud', (req, res) => {
// Aquí puedes procesar la solicitud recibida desde Tasker
console.log('Solicitud recibida desde Tasker:', req.body);
// Por ejemplo, puedes devolver una respuesta simple
res.send('Solicitud recibida correctamente');
});
app.listen(PORT, () => {
console.log(`Servidor escuchando en el puerto ${PORT}`);
});
