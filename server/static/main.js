/* jshint esversion:6 */
console.log('start');
var senselems = {};
var current_results = {};

var makeChartFromArray = function(type, target, data, options = null) {
    console.log('makeChartFromArry()');
    var drawChart = function() {
        console.log('drawChart()');
        var cdata = google.visualization.arrayToDataTable(data);
        var chart = null;
        switch (type) {
            case 'bar': 
                chart = new google.visualization.ColumnChart(target); 
                break;
            case 'pie': 
                chart = new google.visualization.PieChart(target); 
                break;
            case 'line': 
                chart = new google.visualization.LineChart(target); 
                break;
            default:
                chart = new google.visualization.ColumnChart(target); 
        }

        chart.draw(cdata, options);
    };

    drawChart();
};


var makeLeft = function(name, d) {
    console.log(d.sensor_data);
    var tdl = senselems[name].tdl;    
    // tdl.innerText = JSON.stringify(d);
    var cdiv = document.createElement('div');
    removeChildren(tdl);
    tdl.appendChild(cdiv);
    var carry = [];
    carry.push(['bin','count']);
    for (var j=0;j<d.sensor_data.spectrum.length;j++) {
        carry.push([j,d.sensor_data.spectrum[j]]);
    }

    makeChartFromArray('line',
                       cdiv,
                       carry,
                       {'title':name});
};

var pnames0 = {
    'Neutron Count': { n: 'neutron_count', u: '' },
    'Integration Time': { n: 'time', u: 'ms' },
    'Temperature': { n: 'temperature', u: '\u2103' },
    'Device Serial': { n: 'serial', u: '' },
    'Gain': {n : 'gain', u: '' },
    'LLD (gamma)': { n: 'lld-g', u: '' },
    'LLD (neutron)': { n: 'lld-n', u: '' },
};

var makeCenter = function(name, d) {
    var tdc = senselems[name].tdc;    
    removeChildren(tdc);
    var ul = document.createElement('ul');
    tdc.appendChild(ul);
    var pns = Object.keys(pnames0);
    for (var i=0;i<pns.length;i++) {
        var friendly_name = pns[i];
        var data_name = pnames0[friendly_name].n;
        var unit = pnames0[friendly_name].u;
        var li = document.createElement('li');
        li.innerText = friendly_name + ': ' + d.sensor_data[data_name] + ' ' + unit;
        ul.appendChild(li);
    }
};

var pnames1 = {
    'Date': { n: 'date', u: '' },
    'Node Name': { n: 'sensor_name', u: '' },
    'Source IP': { n: 'source_ip', u: '' },
};

var makeRight = function(name, d) {
    var tdr = senselems[name].tdr;    
    removeChildren(tdr);
    var ul = document.createElement('ul');
    tdr.appendChild(ul);
    var pns = Object.keys(pnames1);
    for (var i=0;i<pns.length;i++) {
        var friendly_name = pns[i];
        var data_name = pnames1[friendly_name].n;
        var unit = pnames1[friendly_name].u;
        var li = document.createElement('li');
        li.innerText = friendly_name + ': ' + d[data_name] + ' ' + unit;
        ul.appendChild(li);
    }
};



var getSensorList = function(cb) {
    console.log('getSensorList()');
    getJSON('/radmon/sensornames', function(err, data) {
        if (err) {
            console.log('Error getting sensor list: ' + err);
            return cb(err);
        } else {
            return cb(null,data);
        }
    });
};

var checkData = function(name, cb) {
    console.log('checkData()');
    getJSON('/radmon/status/' + name, function(err, new_data) {
        var old_data = current_results[name];
    
        if (err) {
            console.log('checkData err: ' + err);
            return cb('err');
        } else if (!new_data || !old_data) {
            console.log('checkData err, missing sensor');
            return cb('err missing sensor');
        } else if (new_data) {
            console.log('checkData ok');
            var old_image_date = new Date(old_data.date || 0);
            var new_image_date = new Date(new_data.date);
            var old_ping_date  = old_image_date;
            if (old_data.hasOwnProperty('ping')) {
                old_ping_date = new Date(old_data.ping.date);
            }
            var new_ping_date  = old_ping_date;
            if (new_data.hasOwnProperty('ping')) {
                new_ping_date = new Date(new_data.ping.date);
            }
            var refresh   = !old_data || 
                            (new_image_date > old_image_date);
            var new_ping  = (new_ping_date > old_ping_date);

            if (false) {
                console.log('old_image_date: ' + old_image_date);
                console.log('new_image_date: ' + old_image_date);
                console.log('old_ping_date: ' + old_ping_date);
                console.log('new_ping_date: ' + old_ping_date);
                console.log('refresh: ' + refresh);
                console.log('new_ping: ' + new_ping);
            } 

            if (refresh) {
                makeLeft(name, new_data);
                makeCenter(name, new_data);
                makeRight(name, new_data);
            }
            current_results[name] = new_data;
            return cb(null,new_data);
        } else {
            return cb('skip');
        }
    });
};



var makeSensorDivs = function(senslist,cb) {
    console.log('makeSensorDivs()');
    var topdiv = document.getElementById('topdiv');
    var toptable = document.createElement('table');
    toptable.style.width = "100%";
    topdiv.appendChild(toptable);
    for (var i=0;i < senslist.length; i++) {
        var cname = senslist[i];
        var ntr = document.createElement('tr');
        toptable.appendChild(ntr);
        tdl = document.createElement('td');
        tdc = document.createElement('td');
        tdr = document.createElement('td');
        tdl.style.width = "50%";
        tdc.style.width = "25%";
        tdr.style.width = "25%";
        ntr.appendChild(tdl);
        ntr.appendChild(tdc);
        ntr.appendChild(tdr);
        senselems[cname] = {
            tr: ntr,
            tdl: tdl,
            tdc: tdc,
            tdr: tdr,
        };
        current_results[cname] = {
            valid: false,
            busy: false,
            date: '',
        };
    }
    return cb();
};

var startTimer = function() {
    var senslist = Object.keys(senselems);
    async.each(senslist, function(sensn,cb) {
        console.log('async.each: ' + sensn);
        checkData(sensn, function(cerr, cd) {
            cb();
        });
    },
    function (err) {
        window.setTimeout(startTimer, 5000);
    });
};

var init = function() {
    google.charts.load('current', {'packages':['corechart','bar']});

    google.charts.setOnLoadCallback(function() {
        console.log('google charts loaded');
        getSensorList(function(err,insensors) {
            console.log(insensors);
            if (!err) {
                makeSensorDivs(insensors, function() {
                    startTimer();
                });
            }
        });
    });
};



init();


