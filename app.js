const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
    res.send("HELLO FROM TEJAS")
})

app.get('/home', (req, res) => {
    res.send("HOME")
})

app.listen(port, () => console.log("I'm Alive"))