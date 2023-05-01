const pgp = require("pg-promise")();
const db = pgp(process.env.postgres_connection_string);

module.exports = { db };
