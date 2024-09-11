const express = require('express');
const Color = require('color');
const colorNamer = require('color-namer');

// Inicializar la aplicación
const app = express();

// Definir el puerto en el que el servidor escuchará
const port = process.env.PORT || 3000;

// Mapa de traducción de nombres de colores al español
const colorTranslations = {
    "red": "Rojo",
    "green": "Verde",
    "blue": "Azul",
    "black": "Negro",
    "white": "Blanco",
    "yellow": "Amarillo",
    "orange": "Naranja",
    "pink": "Rosa",
    "purple": "Púrpura",
    "brown": "Marrón",
    "gray": "Gris",
    "cyan": "Cian",
    "magenta": "Magenta",
    // Agrega más traducciones según sea necesario
};

// Crear el endpoint para la raíz
app.get('/', (req, res) => {
    res.send('Bienvenido a la API de conversión de colores. Usa /color?hex=tu_codigo_hexadecimal para obtener el nombre del color.');
});

// Crear el endpoint para manejar la conversión de color
app.get('/color', (req, res) => {
    let hex = req.query.hex;

    try {
        // Convertir cualquier longitud de código hexadecimal a un formato de 6 dígitos
        const color = Color(`#${hex}`).hex().slice(1); // Eliminar el prefijo '#'

        // Convertir el código hexadecimal al nombre del color
        const namedColors = colorNamer(color);
        const colorNameInEnglish = namedColors.basic[0].name;

        // Traducir el nombre del color al español
        const colorNameInSpanish = colorTranslations[colorNameInEnglish.toLowerCase()] || colorNameInEnglish;

        // Devolver el nombre del color como respuesta
        res.send(`${colorNameInSpanish}`);
    } catch (error) {
        res.status(400).send('Código hexadecimal inválido');
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
