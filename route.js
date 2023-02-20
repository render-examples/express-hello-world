var express= require("express");
var router =express.Router();
router.get("/",function(req,res){
   res.render("index");
})

router.get('/hello', (req, res)=>{
  res.render("hello");
})

router.get('/cli', (req, res)=>{
  res.render("cli");
})
// or respond with html
router.get('/big', (req, res) => {
  res.render("big");
})

// :name indicates a parameter at this location in the URI
router.get('/greeting/:id', (req, res) => {
  var id= ':id';
  res.render('greeting', { name:  `${req.params.id}` });
})

// combine your skills and get creative
router.get('/yo/:buddy', (req, res) => {
  res.send(`<h1>Yo, ${req.params.buddy}!</h1>`)
})

router.get('/login', (req, res) => {
  res.render('login',{uname:'CyberV',pass:`The4As`})
})
// provide multiple query parameters (named first and last) with ? and &
router.get('/fancy', (req, res) => {
  const first = req.query.first
  const last = req.query.last
  res.send(`Hello ${first} ${last}!`)
})
router.get("*", (req, res) => {
  res.render('404page');
})

module.exports =router;