## render上部署trojan
### 操作流程
fork该项目，里面有个叫web的二进制文件，其实是xray-core，自己知道就好，然后在render上创建一个nodejs express的web  service，Start Command设置为```chmod +x ./web && node app.js```。应用创建好了后，你的域名后根目录是主页hello world，/status是系统进程表，/start是启动xray，/info是系统信息。app.js中keepalive代码块中的url(第74行)换成自己的url。我这个config.yaml是配置的trojan，你也可以配置其他协议，我的trojan的ws路径是/qwe,通过nodejs反向代理成了/api，所以/api才是你v2ray客户端的ws路径，域名就写应用自动生成的域名，config.yaml里的密码可以自己设置。开了保活后，一般不会休眠。不开保活，半小时就休眠。

### 客户端配置示例
![image](https://file.eeea.ga/view.php/b6a1266c490122db62b7f1841c9ba6cf.jpg)
