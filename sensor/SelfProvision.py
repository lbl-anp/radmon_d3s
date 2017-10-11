import string
import random
import json
import requests
from sys import exit

def selfProvision(url, tokfile, serial_number):
    print('selfProvision')
    def randStr(n):
        return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(n))

    name = "d3s_" + randStr(10)

    provtok = None
    with open('provisioning_token.json','r') as ptfh:
        provtok = json.load(ptfh)

    reqdata = {
        'serial_number': serial_number,
        'provtok': provtok,
        'name': name,
    }
    res = requests.post(url + '/' + name, reqdata)
    print(res)
    if res.status_code == 200:
        resdata = res.json()
        return resdata
    return None


def loadCredentials(creds_fn, url_base, prov_fn, serial_number):
    try:
        with open(creds_fn,'r') as fh:
            creds = json.load(fh)
            return creds
    except Exception as e:
        print('Problem loading credentials')
        print(e)
        try:
            creds = selfProvision(url_base + '/setup', prov_fn, serial_number)
            if creds:
                with open(creds_fn,'w') as fh:
                    fh.write(json.dumps(creds))
                return creds
            else:
                print('Could not self-provision. Exiting.')
                exit(-1)
        except Exception as f:
            print('Self provisioning failed.')
            print(f)
            exit(-2)



