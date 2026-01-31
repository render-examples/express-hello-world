const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {res.sendFile(path.join(__dirname, 'public', 'index.html'));});

const routes = require('./index')
app.use('/', routes);

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

