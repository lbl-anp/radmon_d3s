
var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var fs         = require('fs');
var DataAcceptor  = require('./DataAcceptor');
var Provisioner   = require('./Provisioner');
var sensor_params = require('./sensor_params.json');

var port = process.env.TURKEY_PORT || 9090;

var simpleSplat = function(res, type, fn) {
    res.sendFile(__dirname + fn);
};

real_files = { 'async.js':1, 'main.js': 1, 'gobble.wav': 1, 'turkeys.js':1, 'helpers.js':1, 'main.css':1};

var handleStatic = function(req, res) {
   var name = req.params.name.replace('/','');
   if (real_files[name] || null) {
       var type = 'text/html';
       if (name.match(/\.js$/)) {
           type = 'text/javascript';
       } else if (name.match(/\.wav$/)) {
           type = 'audio/wave';
       } else if (name.match(/\.css$/)) {
           type = 'text/css';
       }
       simpleSplat(res,type, '/static/' + name);
   } else {
       res.status(404);
       res.json({message: 'never heard of that one.'});
   }
};

var handleRootGet = function(req, res) {
    console.log('get HTML');
    simpleSplat(res,'text/html', '/static/index.html');
};

if (require.main === module) {

    var pv = new Provisioner('./provisioned_clients.json',
                             './provisioning_tokens.json');
    pv.load();

    var da = new DataAcceptor(pv);
    da.setupDefaults();
    da.setSensorParams(sensor_params);

    var router = express.Router();

    router.post('/newdata',           da.handleDataPost.bind(da));
    router.post('/stillhere',         da.handleStillHere.bind(da));
    router.post('/setup/:name',       da.handleProvision.bind(da));
    router.get('/sensornames',        da.handleListGet.bind(da));
    router.get('/sensorparams/:name', da.handleParamsGet.bind(da));
    router.get('/status/:name',       da.handleStatusGet.bind(da));
    router.get('/',                   handleRootGet);
    router.get('/static/:name',       handleStatic);

    app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}));
    app.use(bodyParser.json({limit:'50mb'}));

    app.use('/radmon', router);

    app.listen(port);
    console.log('RadMonrunning on port ' + port);
}


