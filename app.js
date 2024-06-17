'use strict'

import kosmos_query from "./nvidia_api.js";

import express from "express";
const app = express();
const port = process.env.PORT || 10000;

// create an error with .status. we
// can then use the property in our
// custom error handler (Connect respects this prop as well)

function error(status, msg) {
  var err = new Error(msg);
  err.status = status;
  return err;
}

// example: http://localhost:3000/api/users/?api-key=foo
app.get('/user/message', async function (req, res) {
  console.log("Received a request!\n");  
  res.send('Received a request!')
  /*
  var query = req.query['query'];
  const response = await kosmos_query(query);
  //console.log("main app:\n", JSON.stringify(response));
  res.send(JSON.stringify(response));
  */
});

app.listen(port);
console.log(`Nvidia contest web services app started on port ${port}`);
