var express = require("express");
var path=require("path");   
var routes=require("./route");
var app = express();
const port = process.env.PORT || 3002;
app.set('views', path.join(__dirname,"views"));
app.set('view engine','ejs');

app.use(routes);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

