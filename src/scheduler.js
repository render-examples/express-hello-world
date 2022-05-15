const Queue = require('bull');
const _ = require('lodash');

const redisUrl = process.env.INTERNAL_REDIS_URL || process.env.REDIS_URL;

const ORDER_QUEUE = 'order-queue';
const MENU_QUEUE = 'menu-queue';
const INVENTORY_QUEUE = 'inventory-queue';
const DEVICE_QUEUE = 'device-queue';
const OTHER_QUEUE = 'other-queue';

const JOBS = {
  'order-queue': [
    {
      jobData: { name: 'autoAcceptOrders' },
      cronSchedule: { repeat: { cron: '*/1 * * * *' } }
    },
  ]
}

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

const obliterateAllQueues = async (force = false) => {
  const queue = getQueue(ORDER_QUEUE);
  await queue.obliterate({ force });
}

const scheduler = {
  getQueue,
  JOBS,
  ORDER_QUEUE,
  obliterateAllQueues
};

module.exports = scheduler;
