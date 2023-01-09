const http = require('http');
const url = require('url');
const qs = require('querystring');
// 创建一个web服务器
const server = http.createServer((req, res) => {
    console.log("请求路径:"+ req.url)
  // /login?username=why&password=123
  const { pathname, query } = url.parse(req.url);
  if (pathname === '/qwe') {
    console.log(query);
    const { username, password } = qs.parse(query);
    console.log(username, password);
    res.end("you have visited /qwe");
  }
});
// 启动服务器,并且制定端口号和主机
server.listen(8080, '0.0.0.0', () => {
  console.log("服务器启动成功~");
});