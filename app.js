const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


app.get("/", (req, res) => res.send("Goodbye From OneSpot!"));

app.post('/captureEmail', function(request, response) {
    return response.sendStatus(200);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
