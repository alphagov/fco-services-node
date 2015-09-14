var pluralize = require('pluralize');

/*
 * Based on https://github.com/alphagov/fco-services/blob/master/lib/transaction_calculator.rb
 */
var TransactionCalculator = function (transaction) {
  this.transaction = transaction;
  this.itemList = {};
  this.totalCost = 0;
  this.postageOption = null;
  this.postageOptionLabel = null;
  this.documentCount = 0;
  this.postage = 0;
  this.documentType = null;
  this.registrationCount = 0;
};

var pluraliseLabel = function (quantity, label) {
  if (quantity === 1) return label;

  var certificateRe = new RegExp('^([cC])ertificate', 'i');

  if (certificateRe.test(label)) {
    return label.replace(certificateRe, '$1ertificates');
  } else {
    return pluralize(label, quantity);
  }
};

TransactionCalculator.prototype._calculatePostage = function () {
  if (typeof this.transaction['postage_options'] !== 'undefined') {
    var postageMethod,
        self = this;

    if (this.postageOption !== null) {
      this.transaction['postage_options'].forEach(function (option) {
        if (option.key === self.postageOption) {
          postageMethod = option;
          return;
        }
      });
    }
    if (typeof postageMethod === 'undefined') {
      throw new Error('Invalid postage option');
    }
    this.totalCost += (postageMethod.cost || 0);
    this.itemList.postage = ' plus ' + postageMethod.label + ' postage';
  } else if (this.postage) {
    this.totalCost += this.transaction['postage_cost'];
    this.itemList.postage = ' plus postage';
  }
};

TransactionCalculator.prototype._calculateRegistrations = function () {
  if (this.transaction.registration) {
    if (this.registrationCount < 1) {
      throw new Error('Invalid registration count');
    }
    this.totalCost += (this.transaction['registration_cost'] * this.registrationCount);

    this.itemList['registration'] = this.registrationCount + ' ' +
      pluraliseLabel(this.registrationCount, this.transaction['registration_type'] + ' registration') + ' and ';

    this.itemList['document'] = this.documentCount + ' ' +
      pluraliseLabel(this.documentCount, this.transaction['registration_type'] + ' certificate');
  }
};

TransactionCalculator.prototype._calculateDocuments = function () {
  var documentTypeLabel;
  if (typeof this.transaction['document_types'] !== 'undefined') {

    if (this.documentType !== null) {
      documentTypeLabel = this.transaction['document_types'][this.documentType];
    }
    if (typeof documentTypeLabel === 'undefined') {
      throw new Error('Invalid document type');
    }

  } else if (typeof this.transaction['document_type'] !== 'undefined') {
    documentTypeLabel = this.transaction['document_type'];
  }

  this.itemList['document'] = this.documentCount + ' ' + pluraliseLabel(this.documentCount, (documentTypeLabel || 'document'));
};

TransactionCalculator.prototype.calculate = function (values) {

  this.documentCount = parseInt(values['dc']) || 0;
  if (!(this.documentCount > 0 ||
      (this.transaction['allow_zero_document_count'] && this.documentCount === 0))) {
    throw new Error('Invalid document count');
  }
 
  this.postage = (values['p'] === 'yes' || typeof values['po'] !== 'undefined');
  this.documentType = values['document_type'];
  this.postageOption = values['po'];
  this.registrationCount = parseInt(values['rc'] || 0);

  this.totalCost = (this.transaction['document_cost'] * this.documentCount);

  this._calculatePostage();
  this._calculateRegistrations();
  this._calculateDocuments();

  return this;
};

TransactionCalculator.prototype.formattedItemList = function () {
  return (this.itemList['registration'] || '') +
         (this.itemList['document'] || '') +
         (this.itemList['postage'] || '');
  
};

module.exports = TransactionCalculator;
