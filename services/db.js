const path = require('path');
const sqlite = require('sqlite3').verbose();
// const db = new sqlite.Database(path.resolve('convidados.db'));
const db = new sqlite.Database('./convidados.db');

// const sqlite = require('sqlite3');
// const db = new sqlite(path.resolve('convidados.db'), { fileMustExist: true });

function query(sql, params) {
  return db.prepare(sql).all(params);
}

function run(sql, params) {
  return db.prepare(sql).run(params);
}

module.exports = {
  query,
  run,
  db
}