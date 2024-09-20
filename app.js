require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path'); 
const config = require('./config.js'); // Centralized config
const webRoutes = require('./routes/webRoutes'); // Import routes

const app = express();
const port = config.port || 3001;

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Use routes
app.use('/', webRoutes);

// Start server
app.listen(port, () => console.log(`App listening on port ${port}!`));
