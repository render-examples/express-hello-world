const { Router } = require("express");
const { getTasks } = require("./taskService");

const router = Router();

router.get("/", async (req, res) => {
  const tasks = await getTasks();
  res.json(tasks);
});

module.exports = router;
