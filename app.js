require("dotenv").config({ path: "./.env" });
const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const removeBG = require("remove.bg");


const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));


// For the generic home page
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


app.get("/", (req, res) => res.type("html").send(html));

// For demo'ing the sticker generation:
// Preview here: https://kidechism-api2.onrender.com/stickerImage/bird

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
// The actual API endpoint to return the sticker
// Preview here: https://kidechism-api2.onrender.com/short/bird

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
      size: "preview",
      type: "product",
    })
    .then((result) => {
      const base64img = result.base64img;
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

