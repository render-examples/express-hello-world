const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3001;
const validator = require('email-validator');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


app.get("/", (req, res) => res.send("Goodbye From OneSpot!"));

app.post('/captureEmail', function(request, response) {
    if(!validator.validate(request.body.emailAddress)) {
        return response.sendStatus(400);
    }
    return response.sendStatus(200);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
