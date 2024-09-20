require('dotenv').config(); // Load .env variables

module.exports = {
  port: process.env.PORT || 3000, // Fallback to 3000 if PORT is not set
  db_url: process.env.DB_URL,
  db_auth_token: process.env.DB_AUTH_TOKEN
};
