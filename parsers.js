/**
 * Created by phodgkinson on 2014-03-19.
 */
'use strict';
var cheerio = require('cheerio');

/**
 * Create a Garderie Summary object
 *
 * @param {number} id the id of the garderie
 * @param {String} href the relative url of the garderie's details page
 * @param {String} title the name of the garderie
 * @param {number} distance the distance (in KM) to the garderie
 * @constructor
 */
var GarderieSummary = function (id, href, title, distance) {
        this.id = id;
        this.href = href;
        this.title = title;
        this.distance = distance;
    },
    /**
     * Creates an Index Page result object
     *
     * @param {GarderieSummary[]} garderies the set of garderie summaries
     * @param {boolean} hasMore true if there is another page of results after this one
     * @constructor
     */
    IndexPageParserResult = function (garderies, hasMore) {
        this.garderies = garderies;
        this.hasMore = hasMore;
    },
    /**
     * Creates a Garderie Details object
     * @param {String} type the type of the garderie
     * @param {String} contactName the garderie contact name
     * @param {String} email the garderie contact email
     * @param {String} phone the garderie phone number
     * @param {String} address the garderie
     * @param {String} lastUpdate the last updated date of the garderie's information
     * @param {{numPlaces: number, ageGroup: string, availableDate: string,
     *  pricePerDay: number}[]} placeInfo an array of free places in the garderie
     * @constructor
     */
    GarderieDetails = function (type, contactName, email, phone,
                                address, lastUpdate, placeInfo) {
        this.type = type;
        this.contactName = contactName;
        this.email = email;
        this.phone = phone;
        this.address = address;
        this.lastUpdate = lastUpdate;
        this.placeInfo = placeInfo;
    },

    /**
     * Parses the HTML of an index page
     *
     * @returns {IndexPageParserResult} The set of GarderieSummary objects from this page, plus an
     * indication whether there or more pages to could be fetched after this one
     */
    IndexPageParser = (function () {
        var HAS_MORE_TEXT = ' Suiv.>>';

        return function (html) {
            var $ = cheerio.load(html),
                $rows = $('.TextResult').parent(),
                hasMore = $('td.Text span').last().text() === HAS_MORE_TEXT,
                garderies = $rows.map(function () {
                    var $this = $(this),
                        $info = $this.find('.TextResult'),
                        $linkAndTitle = $info.find('a.LinkResult'),
                        href = $linkAndTitle.attr('href'),
                        hrefSplit = href.split('/'),
                        page = hrefSplit[hrefSplit.length - 1],
                        title = $linkAndTitle.text(),
                        id = page.split('-')[0],
                        distance = parseFloat($this.children().last().text().split(' ')[0]);

                    return new GarderieSummary(id, href, title, distance);
                });

            return new IndexPageParserResult(garderies, hasMore);
        };

    }()),
    /**
     * Parses the HTML of a details page
     *
     * @returns {GarderieDetails} The GarderieDetails for the given page
     */
    DetailsPageParser = (function () {
        return function (html) {
            var $ = cheerio.load(html),
                $titleTables = $('h1').closest('table').closest('tr').find('table'),
                $titleTable = $($titleTables[0]),
                $contactNode = $($titleTables[1]).find('td').first(),
                $addressNameNode = $($contactNode.children()[0]),
                $address = $addressNameNode.find('.Text'),
                $jsEmail = $($contactNode.children()[1]).find('a').attr('onclick'),
                emailGroups = /;(.*)/.exec($jsEmail),
                $bottomAreaSelector = $('h3.HeaderBlue'),
                $places = $($bottomAreaSelector[0]).closest('table')
                    .parent().find('.Text').slice(4),
                type = $titleTable.find('.TextBoldGreenSmall').text(),
                contactName = $addressNameNode.find('.Contact').text(),
                phone = $($contactNode.children()[2]).find('.Text').text().split(':')[1].trim(),
                lastUpdate = $($bottomAreaSelector[1]).closest('table')
                    .parent().find('b').text().trim(),
                address = '',
                email = '',
                placeInfo = [],
                i,
            /*jshint unused:false, camelcase: false */
                sm_wrap = function (n, k, s) {
                    var d = '',
                        i;
                    for (i = 0; i < s.length; i += 1) {
                        d += String.fromCharCode(k.charCodeAt(i) ^ s.charCodeAt(i));
                    }
                    return d;
                },
            /*jshint unused:true, camelcase: true */
            /*jshint evil:true */
                evalEmail = function (script) {
                    return eval(script);
                };
            /*jshint unused:false */

            // concat address
            $address.each(function () {
                if (address !== '') {
                    address += ('\n');
                }
                address += ($(this).text());
            });

            // parse email
            if (emailGroups !== null && emailGroups.length > 1) {
                email = evalEmail.call({}, emailGroups[1]);
            }

            // parse places
            for (i = 0; i < $places.length; i += 4) {
                placeInfo.push({
                    'numPlaces': parseInt(/\d+/.exec($($places[i]).text().trim())[0], 10),
                    'ageGroup': $($places[i + 1]).text().trim(),
                    'availableDate': $($places[i + 2]).text().trim(),
                    'pricePerDay': parseFloat(/\d+\.?\d*/.exec($($places[i + 3]).text().trim())[0])
                });
            }

            return new GarderieDetails(type, contactName, email, phone,
                address, lastUpdate, placeInfo);
        };
    }());

module.exports.IndexPageParser = IndexPageParser;
module.exports.DetailsPageParser = DetailsPageParser;