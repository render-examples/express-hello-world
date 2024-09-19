const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const path = require('path'); 

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

const router = express.Router(); 

// Setup essential routes 
router.get('/', function(req, res) { 
  res.sendFile(path.join(__dirname + '/views/index.html')); 
  //__dirname : It will resolve to your project folder. 
}); 

router.get('/name-comparison', function(req, res) { 
  res.sendFile(path.join(__dirname + '/views/name-comparison.html')); 
  //__dirname : It will resolve to your project folder. 
}); 

router.use(function(req, res) {
  res.status(404).end('Error 404. Page is non-existant.');
});


//add the router 
app.use('/', router); 