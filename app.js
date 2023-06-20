const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
    res.send("HELLO FROM TEJAS")
})

app.listen(port, () => console.log("I'm Alive"))