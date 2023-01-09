var express = require("express");
var proxy = require("http-proxy-middleware").createProxyMiddleware;
// proxy 中间件的选择项
var options = {
  target: "http://127.0.0.1", // 目标服务器 host
  changeOrigin: true, // 默认false，是否需要改变原始主机头为目标URL
  ws: true, // 是否代理websockets
  pathRewrite: {
    "^/api/old-path": "/api/new-path", // 重写请求，比如我们源访问的是api/old-path，那么请求会被解析为/api/new-path
    "^/api/remove/path": "/path", // 同上
    "^/api": "/qwe", 
  },
  router: {
    // 如果请求主机 == 'dev.localhost:3000',
    // 重写目标服务器 'http://www.example.org' 为 'http://localhost:8000'
    // "dev.localhost:3000": "http://localhost:8000",
    // "127.0.0.1:8080": "http://localhost:3000",
  },
};
// 创建代理
var exampleProxy = proxy(options);
// 使用代理
var app = express();
app.use("/api", exampleProxy);
app.listen(3000);
