![npm](https://img.shields.io/npm/v/homebridge-eta-rest)
![downloads](https://img.shields.io/npm/dm/homebridge-eta-rest)
![license](https://img.shields.io/npm/l/homebridge-eta-rest)<p align="center">
<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">
# Homebridge ETA REST Homebridge plugin for ETA pellet boilers using the official ETA REST API.
This plugin exposes key boiler temperatures to Apple Home via Homebridge.
## FEATURES
The plugin currently exposes the following sensors: 
- Boiler flow temperature
- Domestic hot water (DHW) tank temperature
- Outdoor temperature Each value is exposed in HomeKit as a temperature sensor.
## REQUIREMENTS
 - Homebridge >= 1.8
 - Node.js >= 18 
 - ETA boiler with REST API enabled 
 - Network access to the ETA controller The ETA REST interface usually runs on: http://ETA-IP:8080
## INSTALLATION
Install the plugin globally: npm install -g homebridge-eta-rest or install it directly from the Homebridge UI -> Plugins tab. 
## CONFIGURATION
Example configuration in config.json: 
```
{ "platform":
    "EtaRestV3", "name": 
    "ETA REST", "baseUrl": "http://ETA-IP:8080/user/var", 
    "pollInterval": 60, 
    "paths": {
    "boilerFlowTemp": "/120/10101/0/0/12241", 
    "dhwTemp": "/120/10111/0/0/12271", 
    "outdoorTemp": "/40/10241/0/0/12197"
    } 
}
```
Configuration options: 
    baseUrl Base URL of the ETA REST API. 
    pollInterval Polling interval in seconds. 
    paths ETA variable paths for each sensor. 
## HOW IT WORKS
The plugin polls the ETA REST API periodically and reads the configured variable endpoints. 
Example REST call: http://ETA-IP:8080/user/var/120/10101/0/0/12241 
The returned XML value is converted and exposed to HomeKit.  
## DEVELOPMENT
Source code: https://github.com/kestral-homekit/homebridge-eta-rest 
Contributions and issues are welcome.
## ROADMAP
Planned improvements for future versions:
- Homebridge UI configuration
- auto-discover ETA endpoints
- additionnal boilers sensors
- Improved diagnostic and logging
## LICENSE
Apache-2.0

*Note: This is my very first Homebridge plugin. After several months of private use, I decided to release it as open source. Feedback and suggestions are very welcome!*
