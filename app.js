const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const _ = require('lodash');
const db = require('./src/db');
const scheduler = require('./src/scheduler');

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
      const jobData = _.clone(job['jobData']);
      jobData['location'] = location;
      await orderQueue.add(jobData.name, jobData, job.cronSchedule);
      console.log(`Job ${JSON.stringify(jobData)} enqueued in ${scheduler.ORDER_QUEUE}`);
    }
  }
});
