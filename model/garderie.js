var mongoose = require('mongoose');
var garderieSchema = new mongoose.Schema({
        _id: Number,
        href: String,
        title: String,
        distance: Number,
        type: String,
        contactName: String,
        email: String,
        phone: String,
        address: String,
        lastUpdate: Date,
        places: [{ numPlaces: Number, ageGroup: String,
            availableDate: String, pricePerDay: Number}],
        dateUpdated: Date
    });

module.exports = mongoose.model('Garderie', garderieSchema);