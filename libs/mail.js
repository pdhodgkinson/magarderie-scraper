/**
 * Created by phodgkinson on 2014-03-20.
 */
'use strict';
var nodemailer = require('nodemailer'),
    fs = require('fs'),
    Q = require('q'),
    cheerio = require('cheerio'),
    handlebars = require('handlebars'),
    moment = require('moment'),
    config = require('./../config'),
    logger = require('./logger');

var smtpTransport = nodemailer.createTransport('SMTP', config.mail.transport),
    readyDeferred = Q.defer(),
    mailBuilder,
    /**
     * Promise for when the the mail template has been loaded and processed
     *
     * @returns {adapter.deferred.promise|*|promise|Q.promise} A promise that resolves when
     * the mail template is ready
     */
    ready = function () {
        return readyDeferred.promise;
    };

// Read mail template
fs.readFile('./templates/mail.hbs', 'utf-8', function (err, mailTemplate) {
    if (err) {
        throw err;
    }
    handlebars.registerHelper('isIndexEqual', function (index, checkValue) {
        return index === checkValue;
    });
    mailBuilder = handlebars.compile(mailTemplate);
    readyDeferred.resolve();
});

module.exports = {
    /**
     * Sends an e-mail containing the garderie information
     * @param {Object[]} arGarderie The array of garderies to template and send via email
     */
    sendMail: function (arGarderie) {
        ready().then(function () {
            var templateInput = (function () {
                    var i,
                        firstNewIndex = -1,
                        firstUpdatedIndex = -1,
                        garderie;

                    for (i = 0; i < arGarderie.length; i += 1) {
                        garderie = arGarderie[i];
                        if (firstNewIndex < 0 && garderie.__v === 0) {
                            firstNewIndex = i;
                            garderie.firstNew = true;
                        } else if (firstUpdatedIndex < 0 && garderie.__v > 0) {
                            firstUpdatedIndex = i;
                            garderie.firstUpdated = true;
                        }

                        garderie.moment = moment(garderie.lastUpdate).fromNow();
                    }

                    return { elements: arGarderie, baseURL: config.urls.baseUrl };
                }()),
                content = mailBuilder(templateInput),
                mailOptions = (function () {
                    var options = config.mail.delivery;
                    options.text = cheerio.load(content)('table').text();
                    options.html = content;
                    return options;
                }());

            // send mail with defined transport object
            smtpTransport.sendMail(mailOptions, function (error, response) {
                if (error) {
                    logger.error(error);
                    throw error;
                } else {
                    logger.info('Message sent: ' + response.message);
                }
                smtpTransport.close(); // shut down the connection pool, no more messages
            });
        });
    }
};




