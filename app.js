const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

const myFirstQueue = new Bull('my-first-queue', 'redis://red-ca01lds6fj35fniee9ig:6379');

const job = await myFirstQueue.add({
  foo: 'bar'
});

myFirstQueue.process(async (job) => {
  return console.log(`the job ran! ${job.data}`);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
