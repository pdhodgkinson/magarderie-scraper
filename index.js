#!/usr/bin/env node
'use strict';
var DB = require('./libs/model/db'),
    Mailer = require('./libs/mail'),
    Fetcher = require('./libs/fetcher'),
    Logger = require('./libs/logger'),
    config = require('./config');


var logger = new Logger(config.log);
var db = new DB(config.database, logger);
var fetcher = new Fetcher(config.query, db, logger);
var mailer = new Mailer(config.mail, config.urls, logger);

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
    .then(mailer.mailResults.bind(mailer))
    .then(db.close)
    .done();
