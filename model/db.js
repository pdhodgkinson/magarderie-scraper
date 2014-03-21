'use strict';
var mongoose = require('mongoose'),
    Q = require('q'),
    config = require('../config').database;

/**
 * The deferred object that will wait for the DB connection to be open
 *
 * @type {Q.deferred}
 */
var ready = Q.defer();

// Create the database connection
mongoose.connect(config.connectionString);

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function () {
    console.log('Mongoose default connection open to ' + config.connectionString);
});

// If the connection throws an error
mongoose.connection.on('error', function (err) {
    console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
    console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function () {
    mongoose.connection.close(function () {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});

//The models
var Garderie = require('./garderie');

/**
 * Resolve the ready deferred once the connection is open and ready
 */
mongoose.connection.once('open', function () {
    ready.resolve();
});

module.exports = {
    /**
     * Fetch a garderie by id
     * @param {number} id the garderie id
     * @param callback Callback to trigger with the garderie data
     */
    findGarderieById: function (id, callback) {
        Garderie.findById(id).exec(callback);
    },
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
    saveGarderie: function (id, href, title, distance, type,
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
    },
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
    updateGarderie: function (garderie, href, title, distance, type, contactName,
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
    },
    /**
     * Function to wait on until the DB connection is ready
     *
     * @returns {Q.promise} the promise will resolve when the DB connection is open and ready
     */
    ready: function () {
        return ready.promise;
    },
    /**
     * Close the DB connection
     *
     * @returns {*|null|Connection}
     */
    close: function () {
        console.log('Closing connection');
        return mongoose.connection.close();
    }
};

