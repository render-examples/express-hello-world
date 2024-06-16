'use strict'

import kosmos_query from "./nvidia_api.js";

import express from "express";
const app = express();

// create an error with .status. we
// can then use the property in our
// custom error handler (Connect respects this prop as well)

function error(status, msg) {
  var err = new Error(msg);
  err.status = status;
  return err;
}

// example: http://localhost:3000/api/users/?api-key=foo
app.get('/user/message', function (req, res) {
  var query = req.query['query'];
  var response = kosmos_query(query);

  res.send(response);
});

app.listen(3001);
console.log('Nvidia contest web services app started on port 3001');
