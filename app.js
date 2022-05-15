const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const Queue = require('bull');
const _ = require('lodash');

const REDIS_URL = process.env.INTERNAL_REDIS_URL || process.env.REDIS_URL;

const getQueue = (queueName, redisUrl) => {
  if (!redisUrl) {
    console.log('Note: redisUrl is missing');
  }
  let redisOpts = {};
  if (_.startsWith(redisUrl, 'rediss')) {
    redisOpts = { redis: { tls: true, enableTLSForSentinelMode : false } };
  }
  const queue = new Queue(queueName, redisUrl, redisOpts);
  console.log(`Queue ${queueName} is initialized`);
  return queue;
}

app.listen(port, async () => {
  console.log(`Webserver up. Listening on ${port}!`);

  //Schedule all tasks
  const queueName = 'my-fourth-queue'
  const myFirstQueue = getQueue(queueName, REDIS_URL);

  //Scheduler
  const jobData = { foo : 'bar' };
  const cronSchedule = { repeat: { cron: '* * * * *' } };
  const job = await myFirstQueue.add(jobData, cronSchedule);
  console.log(`Job ${JSON.stringify(jobData)} enqueued in ${queueName}`);
});
