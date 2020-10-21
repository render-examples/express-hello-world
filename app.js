const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3001;
const validator = require('email-validator');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient;

app.use(bodyParser.json());
app.use(cors());
app.use(bodyParser.urlencoded({
    extended: true
}));


app.get("/", (req, res) => res.send("Goodbye From OneSpot!"));

app.post('/captureEmail', function(request, response) {
    const client = new MongoClient(process.env.MongoConnectionString, { useNewUrlParser: true });
    const dbName = "CustomerAcquisition_DB";
    const collectionName = "EmailAcquisitionCollection";

    client.connect(err => {
        if (err) {
          throw err;
        }
        if(!validator.validate(request.body.emailAddress)) {
            return response.sendStatus(400);
        }
        const collection = client.db(dbName).collection(collectionName);
          collection.insertOne({ ...request.body })
          .then((item) => {
            if (item.insertedCount === 1){
              return response.sendStatus(201);
            }
          }).catch((err) => {
            return response.sendStatus(500, err);
          });
          client.close();
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
