const { getTasksDao } = require("./taskDao");

const getTasks = async () => {
  return getTasksDao();
};

module.exports = {
  getTasks,
};
