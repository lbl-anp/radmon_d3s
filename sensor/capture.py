#!/usr/bin/env python3

import sys
import time
import io
import datetime
import string
import random
import base64
import json
import requests
import kromek
from urllib.parse import urlencode

from SelfProvision import loadCredentials

def pre_run():
    kdevs = kromek.discover()
    print('Discovered %s' % kdevs)
    if len(kdevs) <= 0:
        return

    try:
        kconn = kromek.connect(kdevs[0])
    except:
        return None

    try:
        ser = kromek.get_value(kconn,param='serial')
    except:
        return None

    url_base = 'https://skunkworks.lbl.gov/radmon'
    creds = loadCredentials('./credentials.json',url_base,ser['serial']);

    cfg = {
        'serial': ser['serial'],
        'upload_period': 60,
        'config_check_period': 7200,
        'ping_period': 900,
        'token': creds['token'],
        'sensor_name': creds['sensor_name'],
        'post_url': url_base + '/newdata',
        'ping_url': url_base + '/stillhere',
        'config_url': url_base + '/sensorparams/' + creds['sensor_name'],
        'tick_length': 0.5,
        'sensor_params': {
        },
        # if we get a series of bad network responses, either the server
        # or the network is down. We will just shutdown and restart
        'max_consec_net_errs': 10,
        'net_reboot_off_period': 180,
        'kconn': kconn,
    }

    return cfg



def myIP():
    try:
        return requests.get('https://ipinfo.io').json()['ip']
    except:
        return 'dunno'


def readSensorAndUpload(ip):

    try:
        sdata = {}
        for group in ['serial','status','measurement','gain','lld-g','lld-n']:
            res = kromek.get_value(cfg['kconn'],param=group)
            for k in res:
                sdata[k] = res[k]

        do_upload = True

        if do_upload:
            res = uploadData(sdata,ip)
            print(res)

    except Exception as e:
        print('well, that didn\'t work')
        print(e)


def sayHi(ip = None):
    try:
        print('sayHi()')
        now = datetime.datetime.now()

        data = {
            'sensor_name': cfg.get('sensor_name',''),
            'token': cfg['token'],
            'source': 'kromek_d3s',
            'date': now.isoformat(),
            'source_ip': ip,
        }
        return requests.post(cfg['ping_url'], data = data, timeout=20)
    except:
        return None



def uploadData(sdata, ip = None):
    print('uploadData()')
    now = datetime.datetime.now()

    data = {
        'sensor_data': sdata,
        'sensor_name': cfg.get('sensor_name',''),
        'token': cfg['token'],
        'source': 'kromek_d3s',
        'date': now.isoformat(),
        'source_ip': ip,
    }
    return requests.post(cfg['post_url'], json = data, timeout=60)
 


def configLocalOverride(cfg,fn):
    try:
        with open(fn,'r') as fh:
            data = json.loads(fh.read())
            for key in data:
                print('Local override cfg[{0}] = {1}'.format(key,json.dumps(data[key])))
                cfg[key] = data[key]
    except Exception as e:
        print('Got exception reading local overrides');
        print(e)


def configRemoteOverride(cfg):
    try:
        url = cfg['config_url'] + '?' + urlencode({'token':cfg['token']})
        res = requests.get(url, timeout=30)
        if res.status_code == 200:
            data = res.json()
            for key in data:
                print('Remote override cfg[{0}] = {1}'.format(key,json.dumps(data[key])))
                cfg[key] = data[key]
        else:
            print('Got error code fetching params from server.')
    except Exception as e:
        print('Got exception fetching params.')
        print(e)




def mymain(cfg):

    configLocalOverride(cfg, 'local_config.json')
    configRemoteOverride(cfg)

    ip = myIP()
    count = 0
    running = True;
    consec_net_errs = 0

    last = datetime.datetime.now()
    last_ping = datetime.datetime.now()
    last_cfg_check = datetime.datetime.now()

    while running:
        now = datetime.datetime.now()

        if consec_net_errs > cfg['max_consec_net_errs']:
            print('Network not working. I\'m going to kill myself and presumably systemd will restart me.')
            sys.exit(-10)

        did_upload = False
        if now - last > datetime.timedelta(seconds=cfg['upload_period']):
            last = now
            did_upload = readSensorAndUpload(ip)

        if not did_upload and now - last_ping > datetime.timedelta(seconds=cfg['ping_period']):
            last_ping = now
            res = sayHi(ip)
            if res.status_code == 200:
                consec_net_errs = 0
            else:
                consec_net_errs += 1

        if now - last_cfg_check > datetime.timedelta(seconds=cfg['config_check_period']):
            last_cfg_check = now
            configOverride(cfg)

        time.sleep(cfg['tick_length']);
        count += 1
  

if __name__ == '__main__':
    try:
        cfg = pre_run();
        if cfg:
            mymain(cfg)
    except Exception as e:
        print('Whoops!')
        print(e)
