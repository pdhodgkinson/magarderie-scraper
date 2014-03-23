'use strict';
var Q = require('q'),
    check = require('check-types'),
    requests = require('./requests'),
    parsers = require('./parsers'),
    db = require('./model/db'),
    mail = require('./mail'),
    queryConfig = require('./config').query,
    logger = require('./logger');

var queryParams = [
        requests.QueryParams.NumberOfSpaces(queryConfig.numberOfSpaces),
        requests.QueryParams.Type.All,
        requests.QueryParams.PostalCode(queryConfig.postalCode),
        requests.QueryParams.MaxPrice(queryConfig.maxPrice),
        requests.QueryParams.AgeInMonths(queryConfig.ageInMonths)
    ],
    requester = new requests.Requester(queryParams),
    detailsPageDefers = [];

/**
 * Fetch an individual garderie details page, parse it, save or update it in
 * the database if necessary
 *
 * @param {GarderieSummary} garderie the summary object retrieve from an index page
 * @returns {adapter.deferred.promise|*|promise|Q.promise} resolved when the details
 *  page for given garderie has been fetched and parsed. Returns undefined if there
 *  are not changes to what exists in the DB; Returns the new {GarderieDetails} if
 *  it is a new entry or has changes since it was last persisted to the DB
 */
var getDetailsPage = function (garderie) {
    var deferred = Q.defer();
    //async call to fetch details page and parse it
    requester.fetchDetailsPage(garderie, function (garderie, body) {
        var detailedGarderie = parsers.DetailsPageParser(body);
        //get existing db entry
        db.findGarderieById(garderie.id, function (err, result) {
            if (err) {
                logger.error(err);
            }
            if (result === null) {
                logger.info('No result found for: [' + garderie.id +
                    ']. Saving new entry.');
                db.saveGarderie(garderie.id, garderie.href, garderie.title,
                    garderie.distance, detailedGarderie.type,
                    detailedGarderie.contactName, detailedGarderie.email,
                    detailedGarderie.phone, detailedGarderie.address,
                    detailedGarderie.lastUpdate,
                    detailedGarderie.placeInfo, function (err, garderie) {
                        if (err) {
                            logger.error(err);
                            deferred.reject(err);
                        } else {
                            deferred.resolve(garderie);
                        }
                    });
            } else if (result.lastUpdate === null ||
                new Date(detailedGarderie.lastUpdate).getTime() !==
                    result.lastUpdate.getTime()) {
                logger.info('Changes to existing result found for: [' +
                    garderie.id + ']. Updating entry.');
                db.updateGarderie(result, garderie.href, garderie.title,
                    garderie.distance, detailedGarderie.type,
                    detailedGarderie.contactName, detailedGarderie.email,
                    detailedGarderie.phone, detailedGarderie.address,
                    detailedGarderie.lastUpdate,
                    detailedGarderie.placeInfo, function (err, garderie) {
                        if (err) {
                            logger.error(err);
                            deferred.reject(err);
                        } else {
                            deferred.resolve(garderie);
                        }
                    });

            } else {
                logger.info('No update to: [' + garderie.id +
                    ']. Not overwriting');
                deferred.resolve();
            }
        });

    });
    return deferred.promise;
};

/**
 * Fetch a magarderie search index page, based on given page number (to scroll through result
 * sets) and pre-defined query parameters
 * @param pageNum
 * @returns {adapter.deferred.promise|*|promise|Q.promise} resolved when index page has been
 *  fetched and parsed. Return value indicates if there are more pertinent results based on
 *  query parameters and available pages remaining
 */
var getIndexPage = function (pageNum) {
    var getIndexPage = Q.defer(),
        cb = function (err, response, body) {
            var results = parsers.IndexPageParser(body),
                withinDistanceFilter = function (index, garderie) {
                    return garderie.distance <= queryConfig.maxDistanceInKM;
                },
                garderiesInRange = results.garderies.filter(withinDistanceFilter),
                outOfRange = (results.garderies.length !== garderiesInRange.length),
                fetchNext;

            //fetch details
            garderiesInRange.each(function (i, garderie) {
                detailsPageDefers.push(getDetailsPage(garderie));
            });

            fetchNext = (results.hasMore === true && outOfRange === false);
            getIndexPage.resolve(fetchNext);
        };

    requester.fetchIndexPage(pageNum, cb);
    return getIndexPage.promise;
};

/**
 * Fetches and parses all applicable index pages
 * @returns {adapter.deferred.promise|*|promise|Q.promise} Resolves when there are no more pages
 * to be fetched within the given criteria
 */
var fetchAllGarderies = function () {
    var fetchAllGarderies = Q.defer(),
        doFetchPage = function (pageNum) {
            getIndexPage(pageNum).done(function (fetchNext) {
                if (fetchNext === true) {
                    doFetchPage(pageNum + 1);
                } else {
                    fetchAllGarderies.resolve([]);
                }
            });
        };
    doFetchPage(1);

    return fetchAllGarderies.promise;
};

/**
 * Mails the results of the page fetching in an email
 * @param results the array of results from parsing the set of detail pages
 * @returns {boolean}
 */
var mailResults = function (results) {
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
    logger.log('Here are results: ');
    logger.log(results);
    //mail them
    if (results.length > 0) {
        mail.sendMail(results);
    }
    return true;
};

/**
 * Main flow control
 *  1. Wait for DB connection to be open
 *  2. Fetch all the pertinent details pages, parse them, and save them to the DB if necessary
 *  3. Mail the results out via the mailer
 *  4. Close DB connections
 *  5. Done!
 */
db.ready()
    .then(fetchAllGarderies)
    .then(function () {
        return Q.all(detailsPageDefers);
    })
    .then(mailResults)
    .then(db.close)
    .done();
