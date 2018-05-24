/*
 * Require and export siblings.
 */
exports.healthcheck = require('./healthcheck').healthcheck;
exports.cookies = require('./cookies').cookies;
exports.privacyPolicy = require('./privacyPolicy').privacyPolicy;
exports.smart_pay = require('./smart_pay');
exports.errors = require('./errors');

// Provide request headers for secure connections which are omitted
// on the azure platform.
// See http://stackoverflow.com/questions/15084511/how-to-detect-https-redirection-on-azure-websites
exports.azureSecureMiddleware = function (req, res, next) {
  if (req.headers['x-arr-ssl'] && !req.headers['x-forwarded-proto']) {
    req.headers['x-forwarded-proto'] = 'https';
  }
  return next();
};

exports.currentService = function (req, res, next) {

        var service = '';

        switch (req.subdomains[1]) {
            case 'pay-register-birth-abroad':

                service = 'Payment to register a birth abroad';
                break;

            case 'pay-register-death-abroad':

                service = 'Payment to register a death abroad';
                break;

            case 'pay-foreign-marriage-certificates':

                service = 'Payment for certificates to get married abroad';
                break;

            case 'pay-legalisation-post':

                service = 'Get a document legalised';
                break;

            case 'pay-legalisation-drop-off':

                service = 'Get a document legalised';
                break;

            default:

                service = '';
        }

        global.currentService = service;

    return next();

};
