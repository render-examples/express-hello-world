const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

app.get("/", (req, res) => res.send("Goodbye From OneSpot!"));

app.post('/captureEmail', function(request, response) {
    return response.status(200).send(request.body.emailAddress);
});

module.exports = router;

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
