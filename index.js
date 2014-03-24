#!/usr/bin/env node
'use strict';
var //check = require('check-types'),
    db = require('./libs/model/db'),
    Mailer = require('./libs/mail'),
    config = require('./config'),
    Fetcher = require('./libs/fetcher'),
    logger = require('./libs/logger');


//var logger = new Logger(config.log); //TODO: implement this
//var db = new DB(config.database); //TODO: implement this
var fetcher = new Fetcher(config.query);
var mailer = new Mailer(config.mail, config.urls);

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
