const express = require("express");
const { default: chart } = require("./src/chart");
const app = express();
const port = process.env.PORT || 3001;

app.get('/:chartId', chart);

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
