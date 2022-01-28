/* jshint esversion:6 */
var path = require("path");
var mysqlWrap = require("./mysql_wrap.js");

var DataDB = function (config) {
  this.config = config;
  mysqlWrap.call(this, config);

  DataDB.prototype.store = function (devname, devdata, cb) {
    var qs = [
      "INSERT INTO",
      config.name + ".log",
      "(sensor_name,date,data)",
      "VALUES(?,?,?)",
      ";",
    ].join(" ");
    vals = [devname, new Date(), JSON.stringify(devdata)];
    this.qwrap(
      { sql: qs, timeout: 1000, values: vals },
      function (sterr, stres) {
        return cb(sterr, stres);
      }
    );
  };

  DataDB.prototype.create_dtable = function (cb) {
    var qs = [
      "CREATE TABLE IF NOT EXISTS",
      config.name + ".log",
      "(",
      "id INT NOT NULL UNIQUE AUTO_INCREMENT,",
      "sensor_name VARCHAR(?) COLLATE latin1_general_cs,",
      "date DATETIME,",
      "data JSON,",
      "PRIMARY KEY ( id ),",
      "KEY ( date ),",
      "KEY ( sensor_name )",
      ")",
      "default charset=latin1",
      ";",
    ].join(" ");
    vals = [config.max_name_length];
    this.qwrap({ sql: qs, values: vals }, function (err, rows) {
      if (err) {
        console.error(err);
        return cb(err, null);
      }
      console.debug(rows);
      return cb(err, rows);
    });
  };
};

DataDB.prototype = Object.create(mysqlWrap.prototype);
DataDB.constructor = DataDB;
module.exports = DataDB;

if (require.main == module) {
  var config = {
    db: {
      name: "radmon",
      max_name_length: 20,
      conn_params: {
        host: "localhost",
        user: "rm_poster",
        password: "d&f4$wP",
      },
    },
  };
  db = new DataDB(config.db);
  db.create_dtable(function () {});
}
