require('dotenv').config({path: './.env'});
const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

app.get("/", (req, res) => res.type('html').send(html));

app.get('/sticker/:prompt', async function (req, res) {

  var prompt = {
    inputs: `sticker, stickers, ${req.params.prompt}`,
    parameters: {
      negative_prompt: 'blurry',
    }
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
const img = Buffer.from(result).toString("base64");

const imageHTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hello from Render!</title>
  </head>
  <body>
    <section>
      <img src="data:image/png;base64, ${img}">
    </section>
  </body>
</html>
`
res.send(imageHTML);
});

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

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
`
