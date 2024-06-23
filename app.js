'use strict'

import kosmos_query from "./nvidia_api.js";

import express from "express";
import cors from "cors";
const app = express();
const port = process.env.PORT || 10000;

const DEBUGGING_LOCAL = 0;

// CORS related
var cors_origin = "https://nvidia-contest-react-app.onrender.com";

if (DEBUGGING_LOCAL == 1)
  cors_origin = "http://localhost:3000"

var corsOptions = {
  origin: cors_origin,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

// create an error with .status. we
// can then use the property in our
// custom error handler (Connect respects this prop as well)

function error(status, msg) {
  var err = new Error(msg);
  err.status = status;
  return err;
}

// example: http://localhost:3000/api/users/?api-key=foo
app.get('/user/message', cors(corsOptions), async function (req, res) {
  var query = req.query['query'];
  var image_data;
  const response = await kosmos_query(query, image_data);
  res.send(response ["choices"][0]["message"]["content"]);
  //res.send(JSON.stringify(response));
});

app.listen(port);
console.log(`Nvidia contest web services app started on port ${port}`);
