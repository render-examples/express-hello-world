const { MongoClient } = require("mongodb");
const _ = require('lodash');

let client;
let dbConnection;

const init = async (dbUri, dbName = 'strapi') => {
  if (!client) {
    client = new MongoClient(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  await client.connect();
  dbConnection = client.db(dbName);
  console.log(`Successfully connected to MongoDB: ${dbName}`);
}

const getLocations = async () => {
  const locations = await dbConnection.collection('location').find({ active: true, shardKey : { $exists : true } }).toArray();
  const activeShardKeyLocations = locations.filter(location => !_.isEmpty(location.shardKey));
  return activeShardKeyLocations;
}

const db = {
  init,
  getLocations
};

module.exports = db;
