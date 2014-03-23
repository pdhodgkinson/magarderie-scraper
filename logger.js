var winston = require('winston'),
    config = require('./config').log;

module.exports = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: config.level
        }),
        new (winston.transports.File)({
            filename: config.file,
            level: config.level
        })
    ]
});