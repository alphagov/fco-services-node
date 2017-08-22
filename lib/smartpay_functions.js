var crypto = require('crypto');
var config = require('./../config/smart_pay.js').config;

module.exports = {

    generateHmac: function generateHmac(hmacKey,params) {

        if (typeof hmacKey === 'undefined' || hmacKey.length < 1) {
            throw new Error("hmacKey is missing or empty");
        }

        var orderedData = {};

        Object.keys(params).sort().forEach(function(key) {
            orderedData[key] = params[key];
        });


        var keys = [],
            values = [];

        for (var key in orderedData) {
            keys.push(key);
            values.push(orderedData[key].toString().replace(/:/g,'\\:'));
        }

        var signingString = keys.concat(values).join(":");

        var decodeHexString = function (hexString) {
            return hexString.replace(/([0-9A-Fa-f]{2})/g, function () {
                return String.fromCharCode(parseInt(arguments[1], 16))
            })
        };

        var hash = crypto.createHmac('sha256', decodeHexString(hmacKey)).update(signingString, 'utf-8').digest('base64');

        return hash;
    },

    testMode: function testMode () {

        return config.testMode;

    },

    requestUrl: function requestUrl () {

        //var testURL = 'https://ca-test.barclaycardsmartpay.com/ca/ca/skin/checkhmac.shtml';
        var testURL = 'https://test.barclaycardsmartpay.com/hpp/select.shtml';
        var liveURL = 'https://live.barclaycardsmartpay.com/hpp/select.shtml';

        return this.testMode ? testURL : liveURL;

    },

    getVerifiedStatus: function getVerifiedStatus (merchantSig, hmac) {
        if (merchantSig === hmac) return true;
    }

};