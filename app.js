const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const _ = require('lodash');
const db = require('./src/db');
const scheduler = require('./src/scheduler');
const { v4: uuidv4 } = require('uuid');

const dbUri = process.env.DATABASE_URI;

app.listen(port, async () => {
  console.log(`Job scheduler webserver up. Listening on ${port}!`);
  //init DB
  await db.init(dbUri);
  const locations = await db.getLocations();
  const locationNames = locations.map(loc => loc.name);

  await scheduler.obliterateAllQueues(true);

  //Schedule all tasks
  const orderQueue = scheduler.getQueue(scheduler.ORDER_QUEUE);
  const orderQueueJobDefinitions = scheduler.JOBS[scheduler.ORDER_QUEUE];
  for (const location of locationNames) {
    for (const job of orderQueueJobDefinitions) {
      const jobData = {
        ...job['jobData'],
        location
      }
      const jobOpts = {
        ...job.cronSchedule,
        removeOnComplete: true,
        jobId : uuidv4()
      };
      await orderQueue.add(jobData.name, jobData, jobOpts);
      console.log(`Job ${JSON.stringify(jobData)} enqueued in ${scheduler.ORDER_QUEUE} with opts ${JSON.stringify(jobOpts)}`);
    }
  }
});
