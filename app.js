const express = require("express");
const fs = require('fs').promises;
const crypto = require("crypto");
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3001;
const readData = require("./src/read-data.js");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.render("./index.ejs");
});

app.get("/book-rooms/new", (req, res) => {
  res.render("./book-rooms/new.ejs");
});

app.get("/book-rooms/:roomId", (req,res) => {
  fs.readFile("public/data.json", 'utf-8').then((file) => {
    const data = JSON.parse(file).data;
    console.log(data);
    console.log(req.params.bookRoomId);
    const bookRoom = data.find(datum => datum.roomId === req.params.roomId);
    console.log(bookRoom);
    res.render("./book-rooms/book-room.ejs", bookRoom);
  })
});

app.post('/api/add/',(req, res) =>  {
  const firstValue = parseInt(req.body.firstValue);
  const secondValue = parseInt(req.body.secondValue);
  const sum = firstValue + secondValue;
  res.json({sum: sum, firstValue: firstValue, secondValue: secondValue});
});

app.post('/api/book-rooms/create',(req, res) =>  {
  const bookRoomId = crypto.randomUUID();
  const data = {
    roomId: bookRoomId,
    roomTitle: req.body.roomTitle,
    hostName: req.body.playerName,
    minuteMax: parseInt(req.body.minuteMax),
    pageNum: parseInt(req.body.pageNum),
    status: "WAITING",
    players: [{
      name: req.body.playerName
    }]
  }
  fs.readFile("public/data.json", 'utf-8').then((file) => {
    const readData = JSON.parse(file);
    readData.data.push(data);
    fs.writeFile("public/data.json", JSON.stringify(readData)).then(_ => {
      res.json({bookRoomId: bookRoomId});
    })
  })
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));