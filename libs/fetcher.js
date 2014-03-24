var check = require('check-types'),
    Q = require('q'),
    requests = require('./requests'),
    parsers = require('./parsers'),
    db = require('./model/db'),
    logger = require('./logger');

var Fetcher = function (queryConfig) {
    'use strict';
    var queryParams = [],
        requester = new requests.Requester(queryParams);
    this.detailsPageDefers = [];

    if (check.number(queryConfig.numberOfSpaces)) {
        queryParams.push(requests.QueryParams.NumberOfSpaces(queryConfig.numberOfSpaces));
    }
    if (check.unemptyString(queryConfig.postalCode)) {
        queryParams.push(requests.QueryParams.PostalCode(queryConfig.postalCode));
    }
    if (check.number(queryConfig.maxPrice)) {
        queryParams.push(requests.QueryParams.MaxPrice(queryConfig.maxPrice));
    }
    if (check.number(queryConfig.ageInMonths)) {
        queryParams.push(requests.QueryParams.AgeInMonths(queryConfig.ageInMonths));
    }
    queryParams.push(requests.QueryParams.Type.All);


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
    this.getDetailsPage = function (garderie) {
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
    this.getIndexPage = function (pageNum) {
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
                    this.detailsPageDefers.push(this.getDetailsPage(garderie));
                });

                fetchNext = (results.hasMore === true && outOfRange === false);
                getIndexPage.resolve(fetchNext);
            };

        requester.fetchIndexPage(pageNum, cb.bind(this));
        return getIndexPage.promise;
    };

    /**
     * Fetches and parses all applicable index pages
     * @returns {adapter.deferred.promise|*|promise|Q.promise} Resolves when there are no more pages
     * to be fetched within the given criteria
     */
    this.fetchAllGarderies = function () {
        var fetchAllGarderies = Q.defer(),
            doFetchPage = function (pageNum) {
                this.getIndexPage(pageNum).done(function (fetchNext) {
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

};

module.exports = Fetcher;