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
    check = require('check-types'),
    logger = require('./logger');

var Mailer = function (mailConfig, urlConfig) {
    var smtpTransport = nodemailer.createTransport('SMTP', mailConfig.transport),
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

    /**
     * Sends an e-mail containing the garderie information
     * @param {Object[]} arGarderie The array of garderies to template and send via email
     */
    this.sendMail = function (arGarderie) {
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

                    return { elements: arGarderie, baseURL: urlConfig.baseUrl };
                }()),
                content = mailBuilder(templateInput),
                mailOptions = (function () {
                    var options = mailConfig.delivery;
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
    };

    /**
     * Mails the results of the page fetching in an email
     * @param results the array of results from parsing the set of detail pages
     * @returns {boolean}
     */
    this.mailResults = function (results) {
        logger.debug('Enter mailResults with %d unfiltered results', results.length);
        var undefinedFilter = function (result) {
                return check.object(result);
            },
            resultSort = function (a, b) {
                if (a.__v === 0 && b.__v !== 0) {
                    return -1;
                }
                if (b.__v === 0 && a.__v !== 0) {
                    return 1;
                }
                return a.distance - b.distance;
            };
        results = results.filter(undefinedFilter).sort(resultSort);
        logger.info('Mailing out %d results.', results.length);
        logger.debug('Here are the results to send: ', results.map(function (result) {
            return result.toJSON();
        }));
        //mail them
        if (results.length > 0) {
            this.sendMail(results);
        }
        return true;
    };
};

module.exports = Mailer;




