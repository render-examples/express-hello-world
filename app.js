require("dotenv").config({ path: "./.env" });
const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const FormData = require('form-data');
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const removeBG = require("remove.bg");
const fs = require('fs');

function dataURItoBlob(dataURI) {
  // convert base64/URLEncoded data component to raw binary data held in a string
  var byteString;
  if (dataURI.split(',')[0].indexOf('base64') >= 0)
      byteString = atob(dataURI.split(',')[1]);
  else
      byteString = unescape(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to a typed array
  var ia = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ia], {type:mimeString});
}

app.get("/", (req, res) => res.type("html").send(html));

app.get("/fakeSticker", async function (req, res) {
  res.send();
});

/*
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/images/v1" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -F file=@./<YOUR_IMAGE.IMG>
*/

app.get("/cloudflarelist", function (req, res) {

  let url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`;

let options = {
  method: 'GET',
  headers: {'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`}
};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .then(res.send(200))
  .catch(err => console.error('error:' + err));
});


app.get("/cloudflare", async function (req, res) {

  const formData = new FormData();

  formData.append('metadata', '');
  formData.append('requireSignedURLs', '');

  const imageFilePath = './test.png'; // Update with the actual path to your image file
  const imageStream = fs.createReadStream(imageFilePath);

  formData.append('file', imageStream, 'test.png');
  formData.end();

  let url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`;

  let options = {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`
    },
  };

  options.body = formData;

  fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('error:' + err));

});

app.get("/sticker/:prompt", async function (req, res) {
  var prompt = {
    inputs: `sticker, stickers, ${req.params.prompt}`,
    parameters: {
      negative_prompt: "blurry",
    },
  };

  const response = await fetch(
    "https://api-inference.huggingface.co/models/artificialguybr/StickersRedmond",
    {
      headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
      method: "POST",
      body: JSON.stringify(prompt),
    }
  );

  result = await response.arrayBuffer();
  const base64img = Buffer.from(result).toString("base64");

  removeBG
    .removeBackgroundFromImageBase64({
      base64img,
      apiKey: `${process.env.REMOVEBG_API_KEY}`,
      size: "regular",
      type: "product",
    })
    .then((result) => {
      //  console.log(`File saved to ${outputFile}`);
      const noBackgroundImage = result.base64img;
      
      console.log("base64img API: ", noBackgroundImage);
      console.log('running');

// Section for uploadig to Cloudflare:
const formData = new FormData();

formData.append('metadata', '');
formData.append('requireSignedURLs', '');

// const blobData = new Blob([noBackgroundImage]);
var blobData = dataURItoBlob(dataURL);
formData.append("file", blobData);

let url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`;

let options = {
  method: 'POST',
  headers: {
    "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`
  },
  formData: formData,
};

options.body = formData;

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .catch(err => console.error('error:' + err));


/*
const FormData = require('form-data');
const fetch = require('node-fetch');
const formData = new FormData();

formData.append('metadata', '');
formData.append('requireSignedURLs', '');

let url = 'https://api.cloudflare.com/client/v4/accounts/account_identifier/images/v1';

let options = {
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=---011000010111000001101001',
    Authorization: 'Bearer undefined'
  }
};

options.body = formData;

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log(json))
  .catch(err => console.error('error:' + err));
*/




      // res.send(noBackgroundImage);
    })
    .catch((errors) => {
      console.log(JSON.stringify(errors));
    });
});

/*-------*/

app.get("/stickerImage/:prompt", async function (req, res) {
  var prompt = {
    inputs: `sticker, stickers, ${req.params.prompt}`,
    parameters: {
      negative_prompt: "blurry",
    },
  };

  const response = await fetch(
    "https://api-inference.huggingface.co/models/artificialguybr/StickersRedmond",
    {
      headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
      method: "POST",
      body: JSON.stringify(prompt),
    }
  );

  result = await response.arrayBuffer();
  const base64img = Buffer.from(result).toString("base64");

  removeBG
    .removeBackgroundFromImageBase64({
      base64img,
      apiKey: `${process.env.REMOVEBG_API_KEY}`,
      size: "regular",
      type: "product",
    })
    .then((result) => {
      //  console.log(`File saved to ${outputFile}`);
      const base64img = result.base64img;

      const imageHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hello from Render!</title>
      </head>
      <body>
        <section>
          <img src="data:image/png;base64, ${base64img}">
        </section>
      </body>
    </html>
    `;

      res.send(imageHTML);
    })
    .catch((errors) => {
      console.log(JSON.stringify(errors));
    });
});

/*-----------*/

app.get("/short/:prompt", async function (req, res) {
  var prompt = {
    inputs: `sticker, stickers, ${req.params.prompt}`,
    parameters: {
      negative_prompt: "blurry",
    },
  };

  const response = await fetch(
    "https://api-inference.huggingface.co/models/artificialguybr/StickersRedmond",
    {
      headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
      method: "POST",
      body: JSON.stringify(prompt),
    }
  );

  result = await response.arrayBuffer();
  const base64img = Buffer.from(result).toString("base64");

  removeBG
    .removeBackgroundFromImageBase64({
      base64img,
      apiKey: `${process.env.REMOVEBG_API_KEY}`,
      size: "regular",
      type: "product",
    })
    .then((result) => {
      //  console.log(`File saved to ${outputFile}`);
      const base64img = result.base64img;

      // res.setHeader('Content-Type', 'application/base64');
      res.json({image: base64img});
    })
    .catch((errors) => {
      console.log(JSON.stringify(errors));
      console.error("removeBG is out of credits");
    });
});

/*-------------*/

const server = app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hello from Render!</title>
  </head>
  <body>
    <section>
      Kidechism API
    </section>
  </body>
</html>
`;
