var check = require('check-types'),
    Q = require('q'),
    requests = require('./requests'),
    parsers = require('./parsers');

var Fetcher = function (queryConfig, db, logger) {
    'use strict';
    var queryParams = [],
        requester = new requests.Requester(queryParams);

    /**
     * The deferred promise will resolve when the index pages have all been fetched and parsed
     * @type {Q.promise}
     */
    this.indexPageDefers = null;

    /**
     * The array of promises for each detailed page that is to be fetched. Once they are all
     * resolved, then all details pages should be fetched, parsed, and returned as a result array
     * @type {Array}
     */
    this.detailsPageDefers = [];

    //Check for the presense of input query parameters
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
     * Allows a calling program to wait for all the details pages to be fetched
     * 
     * @returns {Q.promise} Promise that will resolve with an array of result details from 
     * all fetched pages when complete
     */
    this.waitForDetailsPagesToBeFetched = function () {
        logger.debug('Waiting on %d details page defers', this.detailsPageDefers.length);
        return Q.all(this.detailsPageDefers);
    };

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
        var deferred = Q.defer(),
            fetchDetailsCallback = function (garderie, body) {
                var detailedGarderie = parsers.DetailsPageParser(body);
                //get existing db entry
                db.findGarderieById(garderie.id, function (err, result) {
                    if (err) {
                        logger.error(err);
                    }
                    if (result === null) {
                        logger.debug('No result found for: [' + garderie.id +
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
                        logger.debug('Changes to existing result found for: [' +
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
                        logger.debug('No update to: [' + garderie.id +
                            ']. Not overwriting');
                        deferred.resolve();
                    }
                }.bind(this));
            }.bind(this);
        
        //async call to fetch details page and parse it
        requester.fetchDetailsPage(garderie, fetchDetailsCallback);
           
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
            callback = function (err, response, body) {
                var results = parsers.IndexPageParser(body),
                    withinDistanceFilter = function (index, garderie) {
                        return garderie.distance <= queryConfig.maxDistanceInKM;
                    },
                    garderiesInRange = results.garderies.filter(withinDistanceFilter),
                    outOfRange = (results.garderies.length !== garderiesInRange.length),
                    fetchNext,
                    doDeferredDetailsPage = function (index, garderie) {
                        this.detailsPageDefers.push(this.getDetailsPage(garderie));
                    }.bind(this);
                
                //fetch details
                garderiesInRange.each(doDeferredDetailsPage);

                fetchNext = (results.hasMore === true && outOfRange === false);
                getIndexPage.resolve(fetchNext);
            }.bind(this);

        requester.fetchIndexPage(pageNum, callback);
        return getIndexPage.promise;
    };

    /**
     * Recursively fetches the number of index pages required until fetchNext is returned false.
     * Resolves the indexPageDefers when complete
     * @param pageNum
     */
    this.fetchIndexPagesRecursive = function (pageNum) {
        logger.debug('Entering fetchIndexPagesRecursive with pageNum: [%s]', pageNum);
        var callback = function (fetchNext) {
            logger.debug('In fetchIndexPagesRecursive.callback with fetchNext: [%s]' +
                ', pageNum: [%s]', fetchNext, pageNum);
            if (fetchNext === true) {
                this.fetchIndexPagesRecursive(pageNum + 1);
            } else {
                this.indexPageDefers.resolve();
            }
        }.bind(this);
        this.getIndexPage(pageNum).done(callback);
    };

    /**
     * Fetches and parses all applicable index pages and the detail pages from the index pages
     * @returns {adapter.deferred.promise|*|promise|Q.promise} Resolves when there are no more pages
     * to be fetched within the given criteria. Returns the parsed details pages.
     */
    this.fetchAllGarderies = function () {
        //Initialize the defers
        this.indexPageDefers = Q.defer();
        this.detailsPageDefers = [];
        
        //Do the recursive function call to get all applicable index pages, starting from 1 
        this.fetchIndexPagesRecursive(1);
        
        return this.indexPageDefers.promise //wait for all the index pages to be parsed
            .then(this.waitForDetailsPagesToBeFetched.bind(this)); //then wait for all the details 
                                                                   //pages to be finished
    };

};

module.exports = Fetcher;