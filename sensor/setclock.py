#!/usr/bin/env python3

import Synchronizer

sync_params = {
    'time_url': 'https://skunkworks.lbl.gov/radmon/device/time',
    'attempts': 20,
    'min_successes': 5,
    'timeout': 5,
}


if __name__ == '__main__':
    syncer = Synchronizer.Synchronizer(**sync_params)
    delta = syncer.getDelta()
    result = syncer.adjClock()
