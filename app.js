require('dotenv').config(); // Load environment variables from .env
const express = require("express");
const bodyParser = require('body-parser');
const path = require('path'); 
const app = express();
const port = process.env.PORT || 3001;
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));
const config = require(path.join(__dirname, 'config.js')); // Load config settings

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

const router = express.Router(); 

router.get('/', function(req, res) { 
  res.sendFile(path.join(__dirname + '/views/index.html')); 
}); 

router.get('/name-comparison', function(req, res) { 
  res.sendFile(path.join(__dirname + '/views/name-comparison.html')); 
}); 

router.get('/form', function(req, res) { 
  res.sendFile(path.join(__dirname + '/views/form.html')); 
}); 

app.post('/x', (req, res) => {
  res.send(`Full name is:${req.body.fname} ${req.body.lname}.`);
  console.log(req.body.fname);
  const name = req.body.fname
  
  const db_url = process.env.DB_URL;
  const db_auth_token = process.env.DB_AUTH_TOKEN;
  // const query = "create table if not exists "+name+" (id integer primary key,title varchar(255));"
  const query = "drop table movies;"

  console.log(db_url)

  fetch(db_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${db_auth_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql: query } },
        { type: "close" },
      ],
    }),
  })
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => console.log(err));

});


router.use(function(req, res) {
  res.status(404).end('Error 404. Page is non-existant.');
});


//add the router 
app.use('/', router); 