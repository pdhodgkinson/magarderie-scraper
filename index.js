#!/usr/bin/env node
'use strict';
var check = require('check-types'),
    db = require('./libs/model/db'),
    mail = require('./libs/mail'),
    config = require('./config'),
    Fetcher = require('./libs/fetcher'),
    logger = require('./libs/logger');
/**
 * Mails the results of the page fetching in an email
 * @param results the array of results from parsing the set of detail pages
 * @returns {boolean}
 */
var mailResults = function (results) {
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
        mail.sendMail(results);
    }
    return true;
};

var fetcher = new Fetcher(config.query);

/**
 * Main flow control
 *  1. Wait for DB connection to be open
 *  2. Fetch all the pertinent details pages, parse them, and save them to the DB if necessary
 *  3. Mail the results out via the mailer
 *  4. Close DB connections
 *  5. Done!
 */
db.ready()
    .then(fetcher.fetchAllGarderies.bind(fetcher))
    .then(mailResults)
    .then(db.close)
    .done();
