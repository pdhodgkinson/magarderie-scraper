var winston = require('winston');

var Logger = function (config) {
    'use strict';
    var transport,
        settings,
        transports = [];
    
    for (transport in config.transports) {
        if (config.transports.hasOwnProperty(transport)) {
            settings = config.transports[transport];
            transports.push(new (winston.transports[transport])(settings));
        }
    }
    
    return new (winston.Logger)({
        transports: transports
    });
};

module.exports = Logger;