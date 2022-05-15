const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const Bull = require('bull');
//const Redis = require('ioredis');

/*
const client = new Redis({
  host: 'oregon-redis.render.com',
  port: 6379,
  username: 'red-ca01lds6fj35fniee9ig',
  password: 'F6Mb3VxfSF4PATLSzl0z1Y1JJNzGxyeh'
});
*/
//{ redis: { port: 6379, host: '127.0.0.1', password: 'foobared' } }
//const myFirstQueue = new Bull('my-first-queue', 'redis://red-ca01lds6fj35fniee9ig:6379');
//const myFirstQueue = new Bull('my-first-queue', 'rediss://red-ca01lds6fj35fniee9ig:F6Mb3VxfSF4PATLSzl0z1Y1JJNzGxyeh@oregon-redis.render.com:6379');
const myFirstQueue = new Bull('my-second-queue', { redis: { port: 6379, host: 'oregon-redis.render.com', password: 'F6Mb3VxfSF4PATLSzl0z1Y1JJNzGxyeh', username: 'red-ca01lds6fj35fniee9ig' } });

//rediss://red-ca01lds6fj35fniee9ig:F6Mb3VxfSF4PATLSzl0z1Y1JJNzGxyeh@oregon-redis.render.com:6379
// REDISCLI_AUTH=F6Mb3VxfSF4PATLSzl0z1Y1JJNzGxyeh redis-cli --user red-ca01lds6fj35fniee9ig -h oregon-redis.render.com -p 6379 --tls

app.listen(port, async () => {
  console.log(`Example app listening YO on port ${port}!`)

  //Scheduler
  const jobData = { foo : 'bar' };
  const cronSchedule = { repeat: { cron: '* * * * *' } };
  const job = await myFirstQueue.add(jobData, cronSchedule);

  //Consumers
  myFirstQueue.process(async (job) => {
    console.log(`the job ran! ${job.data}`);
  });

  //const Bull = require('bull');
  //const redisUrl = 'rediss://red-ca01lds6fj35fniee9ig:F6Mb3VxfSF4PATLSzl0z1Y1JJNzGxyeh@oregon-redis.render.com:6379'
  //const redisUrl = 'some junk';
  /*
  const reply = await client.get('bull:my-first-queue:repeat');
  console.log(reply);

  console.log("hello world testing bull!!!");
  const myFirstQueue = new Bull('my-first-queue', client);
  console.log("did this happen? creating the new bull queue");

  myFirstQueue.process(async (job) => {
    console.log(`processing from strapi API! ${job.data}`);
  });
  console.log("did this happen? oblierating the queue");

  */
});
