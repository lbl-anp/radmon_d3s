/*jshint esversion:6 */
var fs = require('fs');
var crypto = require('crypto');

// I could not get the node 9.3.0 crypto sha512 module
// to work correctly, so I am using this one instead. I think
// it was an encoding issue on my end, but I gave up trying
// to resolve it.
var sha512 = require('js-sha512').sha512;

const DEBUG_AUTH = false;
const MAX_PROV_ATTEMPTS = 5;

var dB = function(n,b) {
    if (DEBUG_AUTH) {
        console.log('DBG ' + n + '\t:\t' + b.toString('base64'));
    }
};



var Provisioner = function(provisioned_fn, provtoks_fn) {
    this.provtoks_fn = provtoks_fn;
    this.provisioned_fn = provisioned_fn;
    this.provisioned = {};
    this.provtoks = [];
};

Provisioner.prototype.makeRandString = function(l) {
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var text = crypto.randomBytes(l).toString('base64');
  return text;
};

var loadFJS = function(fn) {
    try {
        var fstring = fs.readFileSync(fn);
        var fdata = JSON.parse(fstring);
        return fdata;
    } catch (ex) {
        console.log('Error loading file: ' + fn);
        console.log(ex);
    }
    return null;
};

Provisioner.prototype.loadProvisioned = function() {
    var d  = loadFJS(this.provisioned_fn);
    if (d) {
        this.provisioned = d;
    }
    return this.provisioned;
};

Provisioner.prototype.tokValid = function(b) {
    if (!b.hasOwnProperty('identification')) return false;

    var id = b.identification;

    if (!(id.hasOwnProperty('node_name') &&
          id.hasOwnProperty('salt') &&
          id.hasOwnProperty('salted_tok'))) return false;

    var node_name = id.node_name;

    if (!this.provisioned.hasOwnProperty(node_name)) return false;

    var pi = this.provisioned[node_name];

    if  (!(pi.hasOwnProperty('tok_hash') &&
           pi.hasOwnProperty('serial_number') &&
           pi.hasOwnProperty('salt'))) return false;

    var tok_hash = Buffer.from(pi.tok_hash, 'base64');
    var id_salt  = Buffer.from(id.salt, 'base64');
    var combined = Buffer.concat([tok_hash, id_salt]);

    dB('tok_hash', tok_hash);
    dB('id_salt',  id_salt);
    dB('combined', combined);

    var h1_lcl = Buffer.from(sha512.create().update(combined).digest());
    var h1_rem = Buffer.from(id.salted_tok, 'base64');

    dB('h1_lcl', h1_lcl);
    dB('h1_rem', h1_rem);

    return !Buffer.compare(h1_lcl,h1_rem);

};

Provisioner.prototype.loadProvToks = function() {
    var d  = loadFJS(this.provtoks_fn);
    if (d) {
        this.provtoks = d;
    }
    return this.provtoks;
};

Provisioner.prototype.load = function() {
    this.loadProvToks();
    this.loadProvisioned();
};

Provisioner.prototype.getProvisioned = function() {
    return this.provisioned;
};

Provisioner.prototype.provTokValid = function(candidate) {
    for (var i=0; i<this.provtoks.length; i++) {
        if (candidate == this.provtoks[i]) return true;
    }
    return false;
};


function thingInThings(things, kname, kvalue) {
    var keys = Object.keys(things);
    for (var i=0; i<keys.length; i++) {
        var key = keys[i];
        var kv = things[key][kname] || null;
        if (kv && (kv == kvalue)) return key;
    }
    return null;
}

Provisioner.prototype.createNew = function(name, serial, nows) {
    var new_token = crypto.randomBytes(64);
    var new_salt  = crypto.randomBytes(64);
    var sbuffer   = Buffer.from(serial);
    var combined  = Buffer.concat([new_token, new_salt, sbuffer]);
    var new_hash = Buffer.from(sha512.create().update(combined).digest());

    dB('new_token',new_token);
    dB('new_salt',new_salt);
    dB('sbuffer',sbuffer);
    dB('combined',combined);
    dB('new_hash',new_hash);

    var new_salt_str = new_salt.toString('base64');

    var rv = {
        new_entry: {
            serial_number: serial,
            node_name: name,
            provisioning_attempts: 1,
            prov_date: nows,
            salt: new_salt_str,
            tok_hash: new_hash.toString('base64'),
        },
        return_data: {
            serial_number: serial,
            node_name: name,
            provisioning_attempts: 1,
            prov_date: nows,
            server_salt: new_salt_str,
            token: new_token.toString('base64'),
        },
    };
    return rv;
};

Provisioner.prototype.provision = function(req) {
    var serial  = req.serial_number || '';
    var provtok = req.provtok || '';
    var name    = req.name || '';

    var nows = (new Date()).toISOString();
    var serial_in_use = thingInThings(this.provisioned, 'serial_number', serial);
    var d = null;
    if (this.provTokValid(provtok)) {
        var existing = this.provisioned[name] || null;
        if (existing) {
           if ((existing.provisioning_attempts < MAX_PROV_ATTEMPTS) &&
               (serial == existing.serial_number)) {
               existing.provisioning_attempts += 1;
               existing.prov_date = nows;
               this.saveProvisioned();
               return existing;
           } else {
               return null;
           }
        } else if (serial_in_use) {
            var provisioning_attempts = this.provisioned[serial_in_use].provisioning_attempts;
            if (provisioning_attempts < MAX_PROV_ATTEMPTS) {
                d = this.createNew(serial_in_use, serial, nows);
                provisioning_attempts += 1;
                d.new_entry.provisioning_attempts = provisioning_attempts;
                d.return_data.provisioning_attempts = provisioning_attempts;
                this.provisioned[serial_in_use] = d.new_entry;
                this.saveProvisioned();
                return d.return_data;
            } else {
                return null;
            }
        } else {
            d = this.createNew(name, serial, nows);
            this.provisioned[name] = d.new_entry;
            this.saveProvisioned();
            return d.return_data;
        }
    }
    return null;
};

Provisioner.prototype.saveProvisioned = function() {
    try {
        var ws = fs.createWriteStream(this.provisioned_fn);
        ws.write(JSON.stringify(this.provisioned,null,2));
        ws.end();
        return null;
    } catch (ex) { 
        console.log('Error writing provisioned file.');
        console.log(ex);
    }
    return 'err';
};


module.exports = Provisioner;
