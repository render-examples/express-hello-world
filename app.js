require('dotenv').config({path: './.env'});
const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const removeBG = require("remove.bg");

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
const base64img = Buffer.from(result).toString("base64");


removeBG.removeBackgroundFromImageBase64({
  base64img,
  apiKey: `${process.env.REMOVEBG_API_KEY}`,
  size: "regular",
  type: "product",
}).then((result) => {
//  console.log(`File saved to ${outputFile}`);
  const base64img = result.base64img;
  
  res.send(base64img);

}).catch((errors) => {
 console.log(JSON.stringify(errors));
});
});


/*-------*/

app.get('/stickerImage/:prompt', async function (req, res) {

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
const base64img = Buffer.from(result).toString("base64");


removeBG.removeBackgroundFromImageBase64({
  base64img,
  apiKey: `${process.env.REMOVEBG_API_KEY}`,
  size: "regular",
  type: "product",
}).then((result) => {
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
  `

  res.send(imageHTML);

}).catch((errors) => {
 console.log(JSON.stringify(errors));
});
});
// const removebgResponse = await fetch(
//   'https://api.remove.bg/v1.0/removebg',
//   {
//     method: "POST",
//     headers: {
//       'X-Api-Key': `${process.env.REMOVEBG_API_KEY}`,
//     },
//     body: 
//   }
// )

// const arrayBuffer = await removebgResponse.arrayBuffer()
// const base64img = Buffer.from(arrayBuffer).toString('base64');
// const fileType = await FileType.fromBuffer(buffer);
// if (fileType.ext) {
//     const outputFileName = `sticker.${fileType.ext}`
//     fs.createWriteStream(outputFileName).write(buffer);
// } else {
//     console.log('File type could not be reliably determined! The binary data may be malformed! No file saved!')
// }


// .then((response) => {
//   if(response.status != 200) return console.error('Error:', response.status, response.statusText);
//   fs.writeFileSync("no-bg.png", response.data);
// })




// const imageHTML = `
// <!DOCTYPE html>
// <html>
//   <head>
//     <title>Hello from Render!</title>
//   </head>
//   <body>
//     <section>
//       <img src="data:image/png;base64, ${img}">
//     </section>
//   </body>
// </html>
// `
// res.send(imageHTML);
// });

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
`;

