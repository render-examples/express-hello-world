const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const Bull = require('bull');

const myFirstQueue = new Bull('my-first-queue', 'redis://red-ca01lds6fj35fniee9ig:6379');

app.listen(port, async () => {
  console.log(`Example app listening YO on port ${port}!`)

  const job = await myFirstQueue.add({
    foo: 'bar'
  });

  myFirstQueue.process(async (job) => {
    return console.log(`the job ran! ${job.data}`);
  });

});
