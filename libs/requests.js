'use strict';
var check = require('check-types'),
    request = require('request'),
    urls = require('./../config').urls;

/**
 * A Query parameter to pass into URL requests.
 *
 * @param name the name of the parameter
 * @param value the value of the parameter
 * @constructor
 */
var QueryParam = function (name, value) {
    this.name = name;
    this.value = value;
};

/**
 * Construct a garderie type query parameter
 *
 * @param {String} value the garderie type
 * @returns {QueryParam} the Type query parameter
 */
var type = function (value) {
    return new QueryParam('SType', value);
};
type.All = type('12345');

/**
 * Construct a garderie postal code query parameter
 *
 * @param {String} value the postal code
 * @returns {QueryParam} the Postal Code query parameter
 */
var postalCode = function (value) {
    return new QueryParam('SPostal', value);
};

/**
 * Construct a garderie child age in months query parameter
 *
 * @param {number} value the child's age in months
 * @returns {QueryParam} the Age-in-Months query parameter
 */
var ageInMonths = function (value) {
    check.verify.number(value, 'Age in Months should be a number');
    return new QueryParam('SAge', value);
};

/**
 * Construct a garderie max price query parameter
 *
 * @param {number} value the max price in dollars
 * @returns {QueryParam} the Max Price query parameter
 */
var maxPrice = function (value) {
    check.verify.number(value, 'Max Price should be a number');
    return new QueryParam('SMaxPrice', value);
};

/**
 * Construct a garderie number of spaces query parameter
 *
 * @param {number} value the number of spaces required
 * @returns {QueryParam} the number of spaces query parameter
 */
var numberOfSpaces = function (value) {
    check.verify.number(value, 'Number of spaces should be a number');
    return new QueryParam('SNumber', value);
};

/**
 * Construct a garderie page number query parameter
 *
 * @param {number} value the index page number to fetch
 * @returns {QueryParam} the page number query parameter
 */
var pageNumber = function (value) {
    check.verify.number(value, 'Number of spaces should be a number');
    return new QueryParam('SPag', value);
};

/**
 * Construct a garderie output format query parameter.
 * This should always be list for this application to work
 *
 * @param {String} value the output format to request
 * @returns {QueryParam} the output format query parameter
 */
var outputFormat = function (value) {
    return new QueryParam('SOut', value);
};
outputFormat.List = outputFormat('list');

/**
 * The set of Query parameter factory functions that can be passed into the requester.
 *
 * @type {{NumberOfSpaces: numberOfSpaces, PageNumber: pageNumber,
 *  Type: type, PostalCode: postalCode, AgeInMonths: ageInMonths, MaxPrice: maxPrice}}
 */
var QueryParams = {
    'NumberOfSpaces': numberOfSpaces,
    'PageNumber': pageNumber,
    'Type': type,
    'PostalCode': postalCode,
    'AgeInMonths': ageInMonths,
    'MaxPrice': maxPrice
};

/**
 * The main interface into making requests to the magarderie.com site.
 * Uses the 'requests' library to make outgoing calls.
 *
 * @param {QueryParam[]} queryParams an array of constant query params to associated with the
 *  index requests
 * @constructor
 */
var MagarderieRequester = function (queryParams) {
    this.queryParams = check.array(queryParams) ? queryParams : [];
    this.queryParams.push(outputFormat.List);

    var self = this,
        /**
         * Converts QueryParam objects into a map suitable for use with the request library.
         * Takes the initial this.queryParams passed into requester plus any additional one-time
         * query params
         * @param {QueryParam[]} additionalQueryParams
         * @returns {{}} query param name:value map
         */
        generateQueryParams = function (additionalQueryParams) {
            additionalQueryParams = check.array(additionalQueryParams) ? additionalQueryParams : [];
            var returnObj = {},
                i,
                queryParam;
            for (i = 0; i < self.queryParams.length; i += 1) {
                queryParam = self.queryParams[i];
                returnObj[queryParam.name] = queryParam.value;
            }
            for (i = 0; i < additionalQueryParams.length; i += 1) {
                queryParam = additionalQueryParams[i];
                returnObj[queryParam.name] = queryParam.value;
            }
            return returnObj;
        },
        /**
         * Builds the required options to pass into the request library
         * @param pageNum the index page number to be fetched
         * @returns {{url: (exports.urls.indexUrl|*), qs: {}}}
         */
        buildIndexOptions = function (pageNum) {
            pageNum = check.positiveNumber(pageNum) ? pageNum : 1;
            var additionalQueryParams = [];
            if (pageNum > 1) {
                additionalQueryParams.push(pageNumber(pageNum));
            }

            return {
                url: urls.indexUrl,
                qs: generateQueryParams(additionalQueryParams)
            };
        },
        /**
         * Builds the required options to pass into the request library
         *
         * @param garderie the garderie object, which has a relative href link
         * @returns {{url: *}} the details page url to fetch
         */
        buildDetailsOptions = function (garderie) {
            return {
                url: urls.baseUrl + garderie.href
            };
        };

    /**
     * Fetches the given index page by page number
     *
     * @param pageNum the page number to fetch
     * @param callback the callback function to call that contains the response
     * @returns {*|exports} the request object, which may allow for piping or other manipulation
     */
    this.fetchIndexPage = function (pageNum, callback) {
        var options = buildIndexOptions(pageNum);
        return request(options, callback);
    };

    /**
     * Fetches a given garderie's detail page
     *
     * @param garderie the garderie for which to fetch the detail page
     * @param callback the callback function to call that contains the response
     * @returns {*|exports} the request object, which may allow for piping or other manipulations
     */
    this.fetchDetailsPage = function (garderie, callback) {
        var options = buildDetailsOptions(garderie);
        return request(options, function (err, response, body) {
            callback(garderie, body);
        });
    };

};

module.exports.Requester = MagarderieRequester;
module.exports.QueryParams = QueryParams;