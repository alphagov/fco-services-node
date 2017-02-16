var config = require('./../config/smart_pay.js').config;
var fs = require('fs');

var Transaction = function (opts) {
  var _self = this,
      attrs = ['slug', 'title', 'document_cost', 'document_types',
               'postage_cost', 'postage_options', 'registration', 'registration_cost',
               'account', 'allow_zero_document_count', 'tracking_site_id', 'test_tracking_site_id'];

  this.config = config;
  attrs.forEach(function (attr) {
    _self[attr] = opts[attr];
  });
};

Transaction.PARAMPLUS_KEYS = ['dc', 'p', 'po', 'rc', 'cost'];

Transaction.email_address = ['email_address'];


Transaction.find = function (id) {
  var transaction;
  if (transaction = Transaction.transactions()[id]) {
    transaction['slug'] = id;
    return new Transaction(transaction);
  } else {
    throw new Error('Transaction not found');
  }
};

Transaction._transactions = null;

Transaction.transactions = function () {
  if (Transaction._transactions === null) {
    var jsonFile = __dirname + '/../lib/transactions.json',
        data = fs.readFileSync(jsonFile, { encoding: 'utf8' });

    Transaction._transactions = JSON.parse(data);
  }
  return Transaction._transactions;
};

Transaction.prototype.trackingSiteId = function () {
  return this.config.testMode ? this.test_tracking_site_id : this.tracking_site_id;
};

module.exports = Transaction;
