const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const Queue = require('bull');
const _ = require('lodash');

const REDIS_URL = process.env.INTERNAL_REDIS_URL || process.env.REDIS_URL;

const getQueue = (queueName, redisUrl) => {
  let redisOpts = {};
  if (_.startsWith(redisUrl, 'rediss')) {
    redisOpts = { redis: { tls: true, enableTLSForSentinelMode : false } };
  }
  const queue = new Queue(queueName, redisUrl, redisOpts);
  return queue;
}

app.listen(port, async () => {
  console.log(`Webserver up. Listening on ${port}!`);

  //Schedule all tasks
  const myFirstQueue = getQueue('my-third-queue', REDIS_URL);

  //Scheduler
  const jobData = { foo : 'bar' };
  const cronSchedule = { repeat: { cron: '* * * * *' } };
  const job = await myFirstQueue.add(jobData, cronSchedule);

});
