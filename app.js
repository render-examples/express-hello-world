const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3001;
const validator = require('email-validator');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient;
const mailchimp = require('@mailchimp/mailchimp_marketing');
const { response } = require("express");
require('dotenv').config()

app.use(bodyParser.json());
app.use(cors());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.post('/captureEmail', function(request, response) {
    const client = new MongoClient(process.env.MongoConnectionString, { useNewUrlParser: true });
    const dbName = "CustomerAcquisition_DB";
    const collectionName = "EmailAcquisitionCollection";
    let userFeedbackCheckboxValue = 'No';

    if(!validator.validate(request.body.emailAddress)) {
        return response.sendStatus(400);
    }
    if(request.body.userFeedbackCheckbox === true){
        userFeedbackCheckboxValue = 'Yes';
    }

    subscribeToMailchimpList(request.body.emailAddress, userFeedbackCheckboxValue).then(() => {
        saveToOneSpotDatabase(client, dbName, collectionName, request, response).then(() => {
        }).catch((err) => {
            return response.sendStatus(500, err);
        });
    }).catch((err) => {
        console.log(err);
        return response.sendStatus(500, err);
    });
});

async function saveToOneSpotDatabase(client, dbName, collectionName, request, response) {
    client.connect(err => {
        if (err) {
            throw err;
        }
        const collection = client.db(dbName).collection(collectionName);
        collection.insertOne({ ...request.body })
            .then((item) => {
                if (item.insertedCount === 1) {
                    return response.sendStatus(201);
                }
            }).catch((err) => {
                return response.sendStatus(500, err);
            });
        client.close();
    });
}

async function subscribeToMailchimpList(emailAddress, userFeedbackCheckbox) {
    const listId = process.env.MailChimpListID;
    mailchimp.setConfig({
        apiKey: process.env.MailChimpAPIKey,
        server: process.env.MailChimpServer,
    });
    const subscribingUser = {
        email: emailAddress,
        checkboxValue: userFeedbackCheckbox
    };
    const response = await mailchimp.lists.addListMember(listId, {
        email_address: subscribingUser.email,
        status: "subscribed",
        merge_fields: {
            USERFEEDBK: subscribingUser.checkboxValue
          }
    });
}


app.get("/", (req, res) => res.send("Goodbye From OneSpot!"));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
