/*jshint esversion:6 */
var path = require("path");
var mysql = require("mysql");

var mysqlWrap = function (dbcfg) {
  var rpthis = this;
  this.dbconfig = dbcfg;

  this.pool = mysql.createPool(this.dbconfig.conn_params);
};

mysqlWrap.prototype.qwrap = function (q, cb, tries = 3) {
  var dbthis = this;
  if (tries) {
    try {
      this.pool.getConnection(function (connerr, connection) {
        if (!connerr) {
          connection.query(q, function (qe, r) {
            connection.release();
            if (
              qe &&
              qe.code &&
              qe.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"
            ) {
              console.warn("retrying query because ENQUEUE_AFTER_FATAL");
              dbthis.qwrap(q, cb, tries - 1);
              return;
            } else {
              // yay success or a failure not worth retrying
              return cb(qe, r);
            }
          });
        } else {
          console.warn("retrying query because pool connection error");
          console.warn(conerr);
          dbthis.qwrap(q, cb, tries - 1);
          return;
        }
      });
    } catch (ee) {
      console.error("dbwrap.qwrap caught EXCEPTION");
      if (ee) console.error(ee);
      return cb(ee.toString(), null);
    }
  } else {
    console.error("dbwrap exhausted all db access attempts");
    return cb("exhausted_db_access_attempts", null);
  }
};

module.exports = mysqlWrap;
