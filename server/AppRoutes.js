/*jshint esversion: 6 */
var lp = require('./LongPoller.js');
var dbconfig = require('./mysql_creds.json');
var storer   = require('./storer.js');

var AppRoutes = function(app_config, dataacceptor) {
    this.config = app_config;
    this.da = dataacceptor;
    this.lp = new lp();
    this.st = new storer(dbconfig.db);
    this.da.setHook('push',this.lp.newChange.bind(this.lp));
    this.da.setHook('push',this.dbstore.bind(this));
    this.da.setHook('ping',this.lp.newChange.bind(this.lp));
};

AppRoutes.prototype.setupRoutes = function(router) {
    router.get('/sensornames',   this.handleListGet.bind(this));
    router.get('/status/:name',  this.handleStatusGet.bind(this));
    router.get('/poll',          this.lp.poll.bind(this.lp));
};

AppRoutes.prototype.handleListGet = function(req, res) {
    console.info('GET list of sensors');
    var devlist = this.da.getdevicelist();
    res.json(devlist);
};

AppRoutes.prototype.dbstore = function(evname, devname, devdata = null) {
    this.st.store(devname, devdata, function(sterr,stres) {
        if (sterr) console.error(sterr);
    });
};


AppRoutes.prototype.handleStatusGet = function(req, res) {
    // console.debug('GET sensor status!');
    var name = req.params.name;
    var cstate = this.da.getdevicestate(name) || null;
    rv = {};
    if (cstate) {
        Object.keys(cstate).forEach(function(k) {
            if (k !== 'image_jpeg') rv[k] = cstate[k];
        });
    } else {
        rv.message = 'no such sensor';
    }
    res.json(rv);
};


module.exports = AppRoutes;

