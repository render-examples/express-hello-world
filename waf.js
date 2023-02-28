//Import the required modules
const http = require('http');
const https = require('https');
const helmet = require('helmet');
const express = require('express');
const sql = require('mysql2');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const httpProxy = require('http-proxy');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Define the path to the logs directory
const logDirectory = path.join(__dirname, 'logs');

// Check if the logs directory exists
// If it doesn't, create it
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Create a write stream for the access log file
const accessLogStream = fs.createWriteStream(
  path.join(logDirectory, 'access.log'),
  {flags: 'a'}
);

// Create an instance of the express application
const app = express();

// Use the morgan middleware to log HTTP requests
app.use(
  morgan('combined', {
    stream: accessLogStream
  })
);

let requestCounts = {};
let bannedIPs = [];
// Function to increment the request count for a given IP
function increment_request_count(ip) {
  return new Promise((resolve, reject) => {
    // If the IP doesn't exist in the requestCounts object, add it with a value of 1
    if (!requestCounts[ip]) {
      requestCounts[ip] = 1;
    } else {
      // If the IP already exists, increment its value by 1
      requestCounts[ip] += 1;
    }
    resolve();
  });
}

// Function to check if an IP is banned
function is_ip_banned(ip) {
  return new Promise((resolve, reject) => {
    // Check if the IP is in the bannedIPs array
    if (bannedIPs.includes(ip)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

//Function to ban an IP
function ban_ip(ip) {
  return new Promise((resolve, reject) => {
    // Add the IP to the bannedIPs array
    bannedIPs.push(ip);
    resolve();
  });
}

// Add custom middleware for rate limiting
const limiter = async (req, res, next) => {
  // Maximum requests per IP in a given time frame
  const rateLimit = 10;
  // Time in milliseconds to ban an IP
  const banTime = 10 * 60 * 1000;

  // Check if request has an array of IP addresses
  if (!req.ips.length) req.ips = [req.ip];

  // Loop through each IP in the request
  for (const ip of req.ips) {
    // Check if the IP is banned
    const isBanned = await is_ip_banned(ip);
    if (isBanned) {
      console.log(`IP ${ip} is banned`);
      // Return error with status code 429 (Too Many Requests) if IP is banned
      res.statusCode = 429;
      return res.end(`Too many requests from IP ${ip}`);
    }

    // Increment the request count for the IP
    await increment_request_count(ip);
    const count = requestCounts[ip];
    if (count > rateLimit) {
      console.log(`IP ${ip} exceeded the rate limit`);
      // Ban the IP if request count exceeds rate limit
      await ban_ip(ip);
      // Return error with status code 429 (Too Many Requests) if IP exceeds rate limit
      res.statusCode = 429;
      return res.end(`Too many requests from IP ${ip}`);
    }
  }

  // Call next middleware if IP is not banned and request count is within the rate limit
  next();
};

// Apply the rate-limiting middleware
app.use(limiter);

// Custom middleware to prevent directory traversal attacks
const sensitiveDirectories = [ "/pwd", "/secret", "/private", "/confidential", "/admin", "/root", "/config", "/backup", "/cli"];

app.use((req, res, next) => {
// Normalize the requested path to prevent encoding attacks
const path = decodeURIComponent(req.path).split('.')[0];
console.log('path: ',path);
// Check if the requested path is in the list of sensitive directories
if (sensitiveDirectories.some(sensitiveDirectories => path.startsWith(sensitiveDirectories))) {
// If it is, return a 401 Unauthorized status
console.log('Unauthorized access attempt: ', req.method, req.originalUrl);
res.status(401).send("401 Unauthorized");
} else {
// If not, continue to the next middleware
next();
}
});

// Apply the helmet middleware to add various security-related HTTP headers
app.use((req, res, next) => {
  helmet()(req, res, () => {
    console.log(`Helmet middleware ran for request with URL: ${req.url}`);
    next();
  });
});

/* Define the database connection properties
const dbProperties = {
  connectionLimit: 10,  // Maximum number of connections to create in the pool
  host: process.env.DB_HOST,  // Hostname of the database server
  user: process.env.DB_USER,  // Database username
  password: process.env.DB_PASSWORD,  // Database password
  database: process.env.DB_NAME  // Name of the database to connect to
};

// Create a connection pool for the database using the defined properties
const pool = sql.createPool(dbProperties);

//Import the Sequelize library
const Sequelize = require('sequelize');

// Create a new Sequelize instance, connecting to a MySQL database
const sequelize = new Sequelize('database', 'username', 'password', {
host: 'localhost',
dialect: 'mysql'
});

// Define a model for a user in the database
const User = sequelize.define('user', {
username: Sequelize.STRING,
password: Sequelize.STRING
});

// Add a custom middleware to prevent SQL injections
app.use((req, res, next) => {
// Get the username and password from the request body
const { username, password } = req.body;

// Use Sequelize to automatically escape any potentially dangerous input
User.findOne({
where: {
username: Sequelize.escape(username),
password: Sequelize.escape(password)
}
})
.then(user => {
// If the user was found in the database, call the next middleware
if (user) {
next();
} else {
// If the user was not found, return a 400 Bad Request response
res.status(400).send('Bad Request');
}
})
.catch(error => {
// If there was an error in the query, return a 500 Internal Server Error response
res.status(500).send(error.message);
});
});
*/

// Custom middleware to sanitize query parameters
app.use((req, res, next) => {
const { query } = req;
const parameters = Object.keys(query);
const parametrizedQuery = {};
parameters.forEach(parameter => {
// Escaping potentially dangerous characters in the query values using encodeURIComponent
parametrizedQuery[parameter] = encodeURIComponent(query[parameter]);
});
req.parametrizedQuery = parametrizedQuery;
console.log('Sanitized query parameters:', req.parametrizedQuery);
next();
});

app.use((req,res)=>{
  res.status(200).send("ok");
});

// Start the server and log a message to indicate that it's listening on port 3001
const server = app.listen(3001, 'localhost', () => {
  console.log("WAF listening on port 3001");
});
