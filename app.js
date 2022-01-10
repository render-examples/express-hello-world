const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

app.get("/", (req, res) => res.send("Hello there 3!"));
app.get("/envs", (req, res) => res.send(`SECRET: ${process.env['SECRET']}; SECRET_2: ${process.env['SECRET_2']}`));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
