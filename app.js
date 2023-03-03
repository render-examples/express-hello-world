const request = require('request');
const express = require("express");
const path=require("path");   
const indexRoutes =require("./route.js");
const app = express();
const port = process.env.PORT || 3002;
const { createProxyMiddleware } = require('http-proxy-middleware');
app.set('views', path.join(__dirname,"views"));
app.set('view engine','ejs');
//console.log(indexRoutes)
// Forward all requests to the WAF on port 3001
// app.use((req,res,next)=>{
//   const appReq = request({
//     uri: 'http://localhost:3001' + req.url,
//     headers: req.headers
//   });
//   req.pipe(appReq);
//   appReq.on('response', (appRes) => {
//     //console.log(appRes)
//     if(appRes.statusCode === 200 || appRes.statusCode === 304){
//  next();
//     }else{
//       res.status(appRes.statusCode).sendStatus(appRes.statusCode);
//       //router.get("*", (req, res) => {
//        // res.render('404page');
//      // })
//     }    
    
//   });
// });

app.use(indexRoutes)

// Start the server
app.listen(3002, 'localhost', () => {
  console.log('Backend server listening on port 3002');
});
