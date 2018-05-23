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
