const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
var exec = require("child_process").exec;

app.get("/", (req, res) => {
    res.send("hello, mrzyang  web应该跑起来了吧! 3001端口");
});

app.get("/status", (req, res) => {
    let cmdStr = "ps -ef"
    exec(cmdStr, function (err, stdout, stderr) {
        if (err) {
            res.send("命令行执行错误：" + err);
        } else {
            res.send("命令行执行结果：" + stdout);
        }
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
