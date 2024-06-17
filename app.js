'use strict'

import kosmos_query from "./nvidia_api.js";

import express from "express";
import cors from "cors";
const app = express();
const port = process.env.PORT || 10000;

var corsOptions = {
  origin: 'https://nvidia-contest-react-app.onrender.com',
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
  const response = await kosmos_query(query);
  res.send(response["message"]["content"]);
  //res.send(JSON.stringify(response));
});

app.listen(port);
console.log(`Nvidia contest web services app started on port ${port}`);
