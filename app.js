const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
var exec = require("child_process").exec;
const os = require("os");
const { createProxyMiddleware } = require("http-proxy-middleware");
var request = require('request');

app.get("/", (req, res) => {
  res.send("hello world!");
});

app.get("/status", (req, res) => {
  let cmdStr = "ps -ef";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send("命令行执行结果：" + stdout);
    }
  });
});

app.get("/start", (req, res) => {
  let cmdStr = "./web -c ./config.yaml";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send("命令行执行结果：" + stdout);
    }
  });
});

app.get("/info", (req, res) => {
  let cmdStr = "cat /etc/*release | grep -E ^NAME";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send(
        "命令行执行结果：\n" +
          "Linux System:" +
          stdout +
          "\nRAM:" +
          os.totalmem() / 1000 / 1000
      );
    }
  });
});

app.use(
  "/api",
  createProxyMiddleware({
    target: "http://127.0.0.1:8080/", // 需要跨域处理的请求地址
    changeOrigin: true, // 默认false，是否需要改变原始主机头为目标URL
    ws: true, // 是否代理websockets
    pathRewrite: {
      // 请求中去除/api
      "^/api": "/qwe",
    },
    onProxyReq: function onProxyReq(proxyReq, req, res) {
      // 我就打个log康康
      console.log(
        "-->  ",
        req.method,
        req.baseUrl,
        "->",
        proxyReq.host + proxyReq.path
      );
    },
  })
);

/* keepalive  begin */
let replit_app_urls = ["https://nodejs-express-test-7lve.onrender.com"]
function http_get(url) {
    request({
        url: url,
        method: "GET"
    }, function (error, response, body) {
        if (!error) {
            console.log("地址--" + url + "发包成功！")
            console.log("响应报文:", body)
            //console.log("statusCode: "+response.statusCode)
            //console.log(response.headers)
        } else
            console.log("请求错误: " + error)
    });
}

function keepalive() {
    for (const url of replit_app_urls) {
        http_get(url)
    }
}
setInterval(keepalive, 2000);

/* keepalive  end */

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
