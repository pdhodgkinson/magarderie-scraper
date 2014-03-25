'use strict';
var mongoose = require('mongoose'),
    Q = require('q');

var DB = function (config, logger) {
    /**
     * The deferred object that will wait for the DB connection to be open
     *
     * @type {Q.deferred}
     */
    var ready = Q.defer(),
        Garderie = require('./garderie');
        

    // Create the database connection
    mongoose.connect(config.connectionString);

    // Connection Events
    // When successfully connected
    mongoose.connection.on('connected', function () {
        logger.info('Mongoose default connection open to ' + config.connectionString);
    });

    // If the connection throws an error
    mongoose.connection.on('error', function (err) {
        logger.info('Mongoose default connection error: ' + err);
    });

    // When the connection is disconnected
    mongoose.connection.on('disconnected', function () {
        logger.info('Mongoose default connection disconnected');
    });

    /**
     * Resolve the ready deferred once the connection is open and ready
     */
    mongoose.connection.once('open', function () {
        ready.resolve();
    });

    // If the Node process ends, close the Mongoose connection
    process.on('SIGINT', function () {
        mongoose.connection.close(function () {
            logger.info('Mongoose default connection disconnected through app termination');
            process.exit(0);
        });
    });


    /**
     * Fetch a garderie by id
     * @param {number} id the garderie id
     * @param callback Callback to trigger with the garderie data
     */
    this.findGarderieById = function (id, callback) {
        Garderie.findById(id).exec(callback);
    };
    
    /**
     * Save a new garderie object
     * @param {number} id
     * @param {String} href
     * @param {String} title
     * @param {number} distance
     * @param {String} type
     * @param {String} contactName
     * @param {String} email
     * @param {String} phone
     * @param {String} address
     * @param {String} lastUpdate
     * @param {Object[]} places
     * @param callback Callback to trigger with the save result
     */
    this.saveGarderie = function (id, href, title, distance, type,
                            contactName, email, phone, address, lastUpdate, places,
                            callback) {
        var garderie = new Garderie({
            _id: id,
            href: href,
            title: title,
            distance: distance,
            type: type,
            contactName: contactName,
            email: email,
            phone: phone,
            address: address,
            lastUpdate: lastUpdate,
            places: places,
            dateUpdated: Date.now()
        });
        garderie.save(callback);
    };
    
    /**
     * Update an exisitng garderie with new data
     *
     * @param garderie The garderie to update
     * @param {String} href
     * @param {String} title
     * @param {number} distance
     * @param {String} type
     * @param {String} contactName
     * @param {String} email
     * @param {String} phone
     * @param {String} address
     * @param {String} lastUpdate
     * @param {Object[]} places
     * @param callback Callback to trigger with the update result
     */
    this.updateGarderie = function (garderie, href, title, distance, type, contactName,
                              email, phone, address, lastUpdate, places, callback) {
        garderie.href = href;
        garderie.title = title;
        garderie.distance = distance;
        garderie.type = type;
        garderie.contactName = contactName;
        garderie.email = email;
        garderie.phone = phone;
        garderie.address = address;
        garderie.lastUpdate = lastUpdate;
        garderie.places = places;
        garderie.dateUpdated = Date.now();
        garderie.markModified('array');
        garderie.save(callback);
    };
    
    /**
     * Function to wait on until the DB connection is ready
     *
     * @returns {Q.promise} the promise will resolve when the DB connection is open and ready
     */
    this.ready = function () {
        return ready.promise;
    };
    
    /**
     * Close the DB connection
     *
     * @returns {*|null|Connection}
     */
    this.close = function () {
        logger.info('Closing connection');
        return mongoose.connection.close();
    };
};

module.exports = DB;

