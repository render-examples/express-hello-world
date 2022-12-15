const express = require("express");
const app = express();
const port = process.env.PORT || 3001;


app.use((req, res, next) => {
  req.timestamp = new Date()
  next()
})

// import routes
const index = require('./routes/index')
const register = require('./routes/register')

// set routes
app.use('/', index)
app.use('/register', register)

module.exports = app
