#!/usr/bin/env python3

from sys import exit
import time
import datetime
import kromek
import ServerConnection

base_config = {
    'upload_period': 60,
    'config_check_period': 7200,
    'ping_period': 900,
    'tick_length': 0.5,
    'sensor_params': { },
    'max_consec_net_errs': 10,
}


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

    server_config = {
        'provisioning_token_path': './provisioning_token.json',
        'url_base': 'https://skunkworks.lbl.gov/radmon',
        'credentials_path': './credentials.json',
        'params_path': './device_params.json',
        'device_name': None,
        'device_serial': ser['serial'],
    }

    sconn = ServerConnection.ServerConnection(server_config)

    cfg = { k:base_config[k] for k in base_config }
    cfg['kconn'] = kconn
    cfg['sconn'] = sconn

    return cfg



def readSensor():
    print('readSensor()')
    fake_kromek = False 

    try:
        sdata = {}
        if fake_kromek:
            sdata = {
                'serial': 'blee bloop',
                'bias': 123,
                'measurement': [1,2,3,4,5,6,7],
            }
        else:
            for group in ['serial','status','measurement','gain','bias','lld-g','lld-n']:
                res = kromek.get_value(cfg['kconn'],param=group)
                for k in res:
                    sdata[k] = res[k]
        return sdata

    except Exception as e:
        print('well, that didn\'t work')
        print(e)
        return None





def mymain(cfg):

    count = 0
    running = True;

    last = datetime.datetime.fromtimestamp(0)
    last_ping = datetime.datetime.fromtimestamp(0)
    last_cfg_check = datetime.datetime.fromtimestamp(0)

    while running:
        now = datetime.datetime.now()

        if cfg['sconn'].getStats()['consec_net_errs'] > cfg['max_consec_net_errs']:
            print('Network not working. I\'m going to kill myself and presumably systemd will restart me.')
            exit(-10)

        if now - last_cfg_check > datetime.timedelta(seconds=cfg['config_check_period']):
            last_cfg_check = now
            cfg['sconn'].getParams(cfg)

        did_upload = False
        if now - last > datetime.timedelta(seconds=cfg['upload_period']):
            last = now
            sdata = readSensor()
            res = cfg['sconn'].push(sdata)
            did_upload = True

        if not did_upload and now - last_ping > datetime.timedelta(seconds=cfg['ping_period']):
            last_ping = now
            res = cfg['sconn'].ping();

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
