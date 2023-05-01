const { db } = require("../common/db");

const getTasks = async () => {
  const tasks = await db.any("select * from tasks t");
  return tasks;
};

module.exports = { getTasksDao: getTasks };
