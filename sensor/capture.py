#!/usr/bin/env python3

from sys import exit
import time
import datetime
import kromek
import ServerConnection
import TimerLoop

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
        'device_type': 'kromek_d3s',
        'device_serial': ser['serial'],
    }

    sconn = ServerConnection.ServerConnection(server_config)

    cfg = { k:base_config[k] for k in base_config }
    cfg['kconn'] = kconn
    cfg['sconn'] = sconn

    return cfg



def readSensor(cfg):
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




class CapHandlers(object):
    def __init__(self, cfg):
        self.cfg = cfg

    def takeReading(self, name, now):
        sdata = readSensor(self.cfg)
        res = self.cfg['sconn'].push(sdata)
        print(res)
        return False

    def checkNetErrs(self, name, now):
        if self.cfg['sconn'].getStats()['consec_net_errs'] > self.cfg['max_consec_net_errs']:
            print('Network not working. I\'m going to kill myself and presumably systemd will restart me.')
            exit(-10)

    def doPing(self, name, now):
        res = self.cfg['sconn'].ping()

    def cfgCheck(self, name, now):
        self.cfg['sconn'].getParams(self.cfg)



def mymain(cfg):

    ch = CapHandlers(cfg)
    te = TimerLoop.TimerLoop()

    te.addHandler(ch.doPing,       cfg['ping_period'])
    te.addHandler(ch.takeReading,  cfg['upload_period'])
    te.addHandler(ch.checkNetErrs, cfg['upload_period'])
    te.addHandler(ch.cfgCheck,     cfg['config_check_period'])

    te.run(cfg['tick_length'])


if __name__ == '__main__':
    try:
        cfg = pre_run();
        if cfg:
            mymain(cfg)
    except Exception as e:
        print('Whoops!')
        print(e)
