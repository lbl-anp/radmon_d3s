# radmon_d3s

Demo for collecting data in Python from Kromek D3s's on remote machines and
pushing results to central NodeJS server for display.

## Usage

The readout of streaming data from a D3S can be performed over a USB connection
or Bluetooth (untested). The main script below will find devices and connect to
the first. It then connects to the web server to stream count data for basic
plotting. The python acquisition script is:

```bash
python3 ./sensor/capture.py
```

The web server requires NodeJS. It is run with:

```bash
node ./server/index.js
```

## TODO

- [ ] Expand docs after testing on MacOS
- [ ] Add Dockerfile for python readout and docs
- [ ] Add Dockerfile for NodeJS server and docs

## Credit

- Maintainer: Joey Curtis (@jccurtis)
- Original author: Dave Jacobowitz
- Kromek readout from ???

## Version

Consider this version -1. This is only a demo tool.
