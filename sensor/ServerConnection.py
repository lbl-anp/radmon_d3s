
import requests
from urllib.parse import urlencode
import SelfProvision
import json
import datetime




class ServerConnection(object):
    def __init__(self, server_config):
        self.config = server_config
        self.creds  = SelfProvision.loadCredentials(
                                               self.config['credentials_path'],
                                               self.config['url_base'],
                                               self.config['provisioning_token_path'],
                                               self.config['device_serial'])
        if not self.config.get('post_url',None):
                self.config['post_url'] = self.config['url_base'] + '/newdata'
        if not self.config.get('ping_url',None):
                self.config['ping_url'] = self.config['url_base'] + '/stillhere'
        if not self.config.get('params_url',None):
                self.config['params_url'] = self.config['url_base'] + '/sensorparams/' + self.creds['sensor_name']

        self.ip = self.myIP()

        self.stats = {
            'consec_net_errs': 0,
        }

    def getStats(self):
        return { k:self.stats[k] for k in self.stats }

    def ping(self):
        try:
            print('ping()')
            now = datetime.datetimenow()
            data = {
                'sensor_name': self.creds.get('sensor_name',''),
                'token': self.creds['token'],
                'source': 'kromek_d3s',
                'date': now.isoformat(),
                'source_ip': self.ip,
            }
            res = requests.post(self.config['ping_url'], data = data, timeout=20)
            if res.status_code != 200:
                self.stats['consec_net_errs'] += 1
            else:
                self.stats['consec_net_errs'] = 0
            return res
        except:
            return None


    def push(self, sdata):
        print('uploadData()')
        now = datetime.datetime.now()

        data = {
            'sensor_data': sdata,
            'sensor_name': self.creds.get('sensor_name',''),
            'token': self.creds['token'],
            'source': 'kromek_d3s',
            'date': now.isoformat(),
            'source_ip': self.ip,
        }
        res = requests.post(self.config['post_url'], json = data, timeout=60)
        if res.status_code != 200:
            self.stats['consec_net_errs'] += 1
        else:
            self.stats['consec_net_errs'] = 0
        return res


    def myIP(self):
        try:
            return requests.get('https://ipinfo.io').json()['ip']
        except:
            return 'dunno'

    def getParams(self, params = {}):
        self.configLocalOverride(params)
        self.configRemoteOverride(params)

    def configLocalOverride(self,params):
        fn = self.config['params_path']
        try:
            with open(fn,'r') as fh:
                data = json.loads(fh.read())
                for key in data:
                    print('Local override params[{0}] = {1}'.format(key,json.dumps(data[key])))
                    params[key] = data[key]
        except Exception as e:
            print('Got exception reading local overrides');
            print(e)


    def configRemoteOverride(self,params):
        print('configRemoveOverride')
        try:
            url = self.config['params_url'] + '?' + urlencode({'token':self.creds['token']})
            res = requests.get(url, timeout=30)
            if res.status_code == 200:
                data = res.json()
                for key in data:
                    print('Remote override params[{0}] = {1}'.format(key,json.dumps(data[key])))
                    params[key] = data[key]
            else:
                print('Got error code fetching params from server.')
        except Exception as e:
            print('Got exception fetching params.')
            print(e)

