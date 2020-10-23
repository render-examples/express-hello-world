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

app.get("/", (req, res) => res.send("Goodbye From OneSpot!"));

app.post('/captureEmail', function(request, response) {
    const client = new MongoClient(process.env.MongoConnectionString, { useNewUrlParser: true });
    const dbName = "CustomerAcquisition_DB";
    const collectionName = "EmailAcquisitionCollection";

    if(!validator.validate(request.body.emailAddress)) {
        return response.sendStatus(400);
    }
    // TODO: Where to put the call to MailChimp to subscribe?
    // should it be after we successfully insert into the DB?
    // at that point we'll at least have the email captured in our DB?
    // is it necessary to save the email to our DB too?
    // def, want it after the validator call.
    subscribeToMailchimpList(request.body.emailAddress).then(() => {
        console.log('mail chimp again');
    });

    client.connect(err => {
        if (err) {
          throw err;
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

async function mailchimpTest() {
    mailchimp.setConfig({
        apiKey: process.env.MailChimpAPIKey,
        server: 'us2',
    });

    const response = await mailchimp.ping.get();
    console.log(response);
}

async function subscribeToMailchimpList(emailAddress) {
    console.log('attempting to sub an email');
    const listId = process.env.MailChimpListID;
    mailchimp.setConfig({
        apiKey: process.env.MailChimpAPIKey,
        server: process.env.MailChimpServer,
    });
    const subscribingUser = {
        email: emailAddress
    };
    const response = await mailchimp.lists.addListMember(listId, {
        email_address: subscribingUser.email,
        status: "subscribed"
    });
    console.log(
        `Successfully added contact as an audience member. The contact's id is ${
          response.id
        }.`
    );
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
