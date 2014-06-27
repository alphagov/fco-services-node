var EPDQ = require('epdq'),
    Transaction = require('./../models/transaction'),
    TransactionService = require('./../lib/transaction_service');

var journeyDescription = function (res, step) {
  return res.locals.transaction.slug + ':' + step;
};

/**
 * Cache control middleware filter.
 */
var setExpiry = function (req, res, next) {
  res.setHeader('Cache-Control', 'max-age=1800, public');
  next();
};

var setXFrameOptionsDeny = function (req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

/**
 * EPDQ transaction actions.
 *
 */
module.exports = {
  middleware : {
    setExpiry : setExpiry,
    setXFrameOptionsDeny : setXFrameOptionsDeny,
    findTransaction : TransactionService.findTransaction
  },
  defaultMiddlewares : [ TransactionService.findTransaction, setXFrameOptionsDeny ],
  middlewares : [ setExpiry, TransactionService.findTransaction, setXFrameOptionsDeny ],

  rootRedirect : function (req, res) {
    res.redirect(req.url + 'start');
  },

  /**
   * GET /start
   */
  start : function (req, res) {
    res.render('start', {
      country : (req.query['country'] || ''),
      postalCountry : (req.query['postal_country'] || ''),
      transaction : res.locals.transaction,
      journeyDescription : journeyDescription(res, 'start')
    });
  },

  /**
   * POST /confirm
   */
  confirm : function (req, res) {
    try {
      var transactionService = new TransactionService(res.locals.transaction),
          calculation = transactionService.calculateTotal(req.body['transaction']),
          epdqRequest = transactionService.buildEpdqRequest(req, calculation.totalCost);

      res.render('confirm', {
        calculation: calculation,
        epdqRequest: epdqRequest,
        transaction: res.locals.transaction,
        journeyDescription: journeyDescription(res, 'confirm')
      });
    } catch (err) {
      res.render('start', {
        country : req.body['transaction']['country'],
        postalCountry : req.body['transaction']['postal_country'],
        errors: err.message,
        journeyDescription: journeyDescription(res, 'invalid_form')
      });
    }
  },

  /**
   * GET /done
   */
  done : function (req, res) {
    try {
      var epdqResponse = new EPDQ.Response(req.query, res.locals.transaction.account, Transaction.PARAMPLUS_KEYS);

      if (epdqResponse.isValidShasign()) {
        res.render('done', { epdqResponse: epdqResponse, journeyDescription: journeyDescription(res, 'done') });
      } else {
        throw new Error('Invalid SHASIGN');
      }
    } catch (e) {
      res.render('payment_error', { journeyDescription: journeyDescription(res, 'payment_error') });
    }
  }
};
