var crypto = require('crypto'),
	SmartPay = require('smartpay'),
	Transaction = require('./../models/transaction'),
	TransactionCalculator = require('./transaction_calculator'),
	zlib = require('zlib'),
	nodemailer = require('nodemailer'),
	smtpTransport = require('nodemailer-smtp-transport'),
	templatesDir = './templates',
	emailTemplates = require('email-templates'),
	numeral = require('numeral'),
	pluralize = require('pluralize'),
	config = require('./../config/smart_pay.js').config;
var TransactionService = function (transaction) {
	this.transaction = transaction;
};
var transactionDoneUrl = function (req) {
	return req.protocol + '://' + req.host + '/done';
};
var paramplusValue = function (params_values) {
	var vals = [];
	Transaction.PARAMPLUS_KEYS.forEach(function (key) {
		if (typeof params_values['transaction'][key] !== 'undefined') {
			vals.push('"' + key + '"' + ':' + '"' + params_values['transaction'][key] + '"');
		}
	});
	return vals.join(',');
};
TransactionService.prototype.validateEmail = function (params_values) {
	var shopper_email = '';
	var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
	Transaction.email_address.forEach(function (key) {
		if (typeof params_values[key] !== 'undefined' && params_values[key] !== '' && re.test(params_values[key])) {
			shopper_email = params_values[key];
		} else {
			throw new Error('A valid email address is required');
		}
	});
	return shopper_email;
};
TransactionService.prototype.compressAndEncode = function (extraParams, callback) {
	zlib.deflate(extraParams, function (err, buffer) {
		if (!err) {
			var merchantReturnData = buffer.toString('base64');
			callback(merchantReturnData);
		}
	});
};
var inflateAndDecode = function (extraParams, callback) {
	var buffer = new Buffer(extraParams, 'base64');
	zlib.unzip(buffer, function (err, buffer) {
		if (!err) {
			var merchantReturnDataDecoded = buffer.toString();
			callback(merchantReturnDataDecoded);
		}
	});
};
/**
 * Middleware filter to find a transaction based on the subdomain
 */
TransactionService.findTransaction = function (req, res, next) {
	try {
		var name = null;
		if (req.subdomains.length > 1) {
			name = req.subdomains[1];
		}
		res.locals.transaction = Transaction.find(name);
		res.locals.pageTitle = res.locals.transaction.title;
	} catch (err) {
		res.status(404);
		res.locals.pageTitle = 'Page not found 404';
		res.locals.journeyDescription = 'page_not_found_404';
		res.render('404');
		return;
	}
	next();
};
TransactionService.prototype.buildParameterList = function (req, totalCost, email, callback) {
	var params = {
		paymentAmount: '',
		currencyCode: 'GBP',
		shipBeforeDate: '',
		merchantReference: '',
		skinCode: '',
		merchantAccount: '',
		sessionValidity: '',
		shopperEmail: '',
		shopperReference: '',
		allowedMethods: '',
		blockedMethods: '',
		shopperStatement: '',
		billingAddressType: '',
		resURL: '',
		merchantReturnData: ''
	};
	var date = new Date();
	date.setDate(date.getDate() + 1);
	date = date.toISOString().substr(0, 19);
	params.paymentAmount = Math.round(totalCost * 100);
	var service = capitalise(this.transaction.slug);
	service = service.replace(/-/g, '');
	/*Renaming the drop off service to the premium service*/
	if (service === 'PAYLEGALISATIONDROPOFF') {
		service = 'PAYLEGALISATIONPREMIUMSERVICE';
	}
	params.merchantReference = service + '-' + 'UK' + '-' + 'ECOMM' + '-' + this.getDateAndTime();
	params.merchantAccount = config.accounts[this.transaction.account].pspId;
	params.skinCode = config.accounts[this.transaction.account].skinCode;
	params.resURL = transactionDoneUrl(req);
	params.sessionValidity = date + 'Z';
	this.compressAndEncode('{' + paramplusValue(req.body) +
		',"' + 'e' + '"' + ':' + '"' + email + '"' +
		',"' + 'pa' + '"' + ':' + '"' + totalCost + '"' + '}', callback);
	return params;
};
TransactionService.prototype.buildSmartPayRequest = function (req, requestParameters) {
	return new SmartPay.Request(config.accounts[this.transaction.account].sharedKey, requestParameters);
};
TransactionService.prototype.calculateTotal = function (values) {
	return new TransactionCalculator(this.transaction).calculate(values);
};
TransactionService.prototype.extractParameterList = function (req, responseParameters, callback) {
	var params = responseParameters;
	params.merchantReturnData = inflateAndDecode(params.merchantReturnData, callback);
	return params;
};
TransactionService.prototype.buildSmartPayResponse = function (req, responseParameters) {
	return new SmartPay.Response(config.accounts[this.transaction.account].sharedKey, responseParameters);
};
TransactionService.prototype.getNextPaymentNumber = function (slug, callback) {
	var collection = db.collection(config.dbCollection);
	var date = new Date();
	date.setHours(0, 0, 0, 0);
	collection.count({
		'service': slug,
		'dateAdded': {
			'$gte': date
		}
	}, function (err, number) {
		callback(number);
	});
};
TransactionService.prototype.getDate = function () {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth() + 1; //January is 0!
	var yyyy = today.getFullYear();
	if (dd < 10) {
		dd = '0' + dd;
	}
	if (mm < 10) {
		mm = '0' + mm;
	}
	today = dd + '/' + mm + '/' + yyyy;
	return today;
};
TransactionService.prototype.getDateAndTime = function () {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth() + 1;
	var yyyy = today.getFullYear();
	if (dd < 10) {
		dd = ['0', dd].join('');
	}
	if (mm < 10) {
		mm = ['0', mm].join('');
	}
	today = [yyyy, mm, dd].join('');
	return today;
};
TransactionService.prototype.encrypt = function (text) {
	var cipher = crypto.createCipher('aes-256-cbc', config.dbEncryptionPassword);
	var crypted = cipher.update(text, 'utf8', 'hex');
	crypted += cipher.final('hex');
	return crypted;
};
var decrypt = function (text) {
	var decipher = crypto.createDecipher('aes-256-cbc', config.dbEncryptionPassword);
	var dec = decipher.update(text, 'hex', 'utf8');
	dec += decipher.final('utf8');
	return dec;
};
TransactionService.prototype.getServiceFromPaymentReference = function (firstPartOfReference) {
	var slug = '';
	var account = '';
	if (firstPartOfReference === 'PAYFOREIGNMARRIAGECERTIFICATES') {
			slug = 'pay-foreign-marriage-certificates';
			account = 'birth-death-marriage';
	} else if (firstPartOfReference === 'PAYLEGALISATIONPREMIUMSERVICE') {
			slug = 'pay-legalisation-premium-service';
			account = 'legalisation-drop-off';
	} else if (firstPartOfReference === 'PAYLEGALISATIONPOST') {
			slug = 'pay-legalisation-post';
			account = 'legalisation-post';
	} else if (firstPartOfReference === 'PAYREGISTERBIRTHABROAD') {
			slug = 'pay-register-birth-abroad';
			account = 'birth-death-marriage';
	} else if (firstPartOfReference === 'PAYREGISTERDEATHABROAD') {
			slug = 'pay-register-death-abroad';
			account = 'birth-death-marriage';
	} else if (firstPartOfReference === 'ETD') {
			slug = 'emergency-travel-document';
	} else {
			slug = firstPartOfReference;
	}
	return [slug, account];
};
TransactionService.prototype.processAuthorisationPayment = function (emailContents, body, merchantAccountCode, collection) {
	console.log('Processing AUTHORISATION notification for ' + emailContents.merchantReference);
	emailContents.lastFourDigitsOfCard = body.additionalData.cardSummary;
	emailContents.emailType = 'authorisation';
	emailContents.emailTemplate = emailContents.slug + '-' + emailContents.emailType;
	collection.update({
			'_id': emailContents.merchantReference
	}, {
			$set: {
					'authorised': 1,
					'binRange': emailContents.lastFourDigitsOfCard
			}
	}, {
			w: 1
	}, function (err) {
			if (err) {
					return console.dir(err);
			}
	});
	collection.findOne({
			'_id': emailContents.merchantReference
	}, function (err, document) {
			if (err) {
					return console.dir(err);
			}
			if (document === undefined || document === null) {
					console.log('Nothing returned from database for ' + emailContents.merchantReference);
			} else {
					var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
					inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
							emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
							emailContents.emailSubject = 'Order for ' + emailContents.slug + ' from the Foreign Office';
							console.log('Sending email to customer');
							sendEmail(emailContents);
					});
			}
	});
};
TransactionService.prototype.processMOTOPayment = function (emailContents, body, merchantAccountCode) {
	console.log(emailContents.merchantReference + ' is a MOTO payment (over the counter) and has been processed by ' + merchantAccountCode);
	var collection = db.collection(config.emailCollection);
	emailContents.emailType = 'capture';
	emailContents.emailTemplate = 'generic' + '-' + emailContents.emailType;
	emailContents.emailSubject = 'Receipt for ' + emailContents.slug + ' from the Foreign Office';
	var shopperEmail = body.additionalData.shopperEmail;
	emailContents.currency = body.amount.currency;
	collection.findOne({
			'_id': merchantAccountCode
	}, function (err, document) {
			if (err) {
					return console.dir(err);
			}
			if (document === undefined || document === null) {
					console.log('There has been a problem finding the office email address for ' + merchantAccountCode);
			} else {
				var fcoOfficeEmailAddress = document.emailAddress;
				emailContents.dataDecodedJson = JSON.parse('{"e":"' + fcoOfficeEmailAddress + '","pa":"' + emailContents.value + '"}');
				console.log('Sending email to ' + fcoOfficeEmailAddress);
				sendEmail(emailContents);
		}
	});
	if (typeof shopperEmail !== 'undefined') {
			emailContents.dataDecodedJson = JSON.parse('{"e":"' + shopperEmail + '","pa":"' + emailContents.value + '"}');
			console.log('Sending email to customer');
			sendEmail(emailContents);
	}
};
TransactionService.prototype.processCapturePayment = function (emailContents, body, merchantAccountCode, collection, account) {
	console.log('Processing CAPTURE notification for ' + emailContents.merchantReference);
	if (emailContents.slug === 'emergency-travel-document') {
			emailContents.emailType = 'capture';
			emailContents.emailTemplate = 'generic' + '-' + emailContents.emailType;
			emailContents.emailSubject = 'Receipt for ' + emailContents.slug + ' from the Foreign Office';
			var shopperEmail = body.additionalData.shopperEmail;
			emailContents.currency = body.amount.currency;
			if (typeof shopperEmail !== 'undefined') {
				emailContents.dataDecodedJson = JSON.parse('{"e":"' + shopperEmail + '","pa":"' + emailContents.value + '"}');
				console.log('Sending email to customer');
				sendEmail(emailContents);
			}
	} else {
			emailContents.emailType = 'capture';
			emailContents.emailTemplate = emailContents.slug + '-' + emailContents.emailType;
			collection.update({
					'_id': emailContents.merchantReference
			}, {
					$set: {
							'captured': 1
					}
			}, {
					w: 1
			}, function (err) {
					if (err) {
							return console.dir(err);
					}
			});
			collection.findOne({
					'_id': emailContents.merchantReference
			}, function (err, document) {
					if (err) {
							return console.dir(err);
					}
					if (document === undefined || document === null) {
							console.log('Nothing returned from database for ' + emailContents.merchantReference);
					} else {
							if (config.accounts[account].sendAllEmails) {
									var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
									emailContents.lastFourDigitsOfCard = document.binRange;
									inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
											emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
											emailContents.emailSubject = 'Receipt for ' + emailContents.slug + ' from the Foreign Office';
											console.log('Sending email to customer');
											sendEmail(emailContents);
									});
							}
					}
			});
	}
};
TransactionService.prototype.processRefundPayment = function (emailContents, body, merchantAccountCode, collection, account) {
	console.log('Processing REFUND notification for ' + emailContents.merchantReference);
			emailContents.emailType = 'refund';
			emailContents.emailTemplate = emailContents.slug + '-' + emailContents.emailType;
			collection.update({
					'_id': emailContents.merchantReference
			}, {
					$set: {
							'refunded': 1
					}
			}, {
					w: 1
			}, function (err) {
					if (err) {
							return console.dir(err);
					}
			});
			collection.findOne({
					'_id': emailContents.merchantReference
			}, function (err, document) {
					if (err) {
							return console.dir(err);
					}
					if (document === undefined || document === null) {
							console.log('Nothing returned from database for ' + emailContents.merchantReference);
					} else {
							if (config.accounts[account].sendAllEmails) {
									var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
									emailContents.lastFourDigitsOfCard = document.binRange;
									inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
											emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
											emailContents.emailSubject = 'Refund for ' + emailContents.slug + ' from the Foreign Office';
											console.log('Sending email to customer');
											sendEmail(emailContents);
									});
							}
					}
			});
};
TransactionService.prototype.processCancellationPayment = function (emailContents, body, merchantAccountCode, collection, account) {
	console.log('Processing CANCELLATION notification for ' + emailContents.merchantReference);
	emailContents.emailType = 'cancellation';
	emailContents.emailTemplate = emailContents.slug + '-' + emailContents.emailType;
	collection.update({
			'_id': emailContents.merchantReference
	}, {
			$set: {
					'cancelled': 1
			}
	}, {
			w: 1
	}, function (err) {
			if (err) {
					return console.dir(err);
			}
	});
	collection.findOne({
			'_id': emailContents.merchantReference
	}, function (err, document) {
			if (err) {
					return console.dir(err);
			}
			if (document === undefined || document === null) {
					console.log('Nothing returned from database for ' + emailContents.merchantReference);
			} else {
					if (config.accounts[account].sendAllEmails) {
							var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
							emailContents.lastFourDigitsOfCard = document.binRange;
							inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
									emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
									emailContents.emailSubject = 'Cancellation for ' + emailContents.slug + ' from the Foreign Office';
									console.log('Sending email to customer');
									sendEmail(emailContents);
							});
					}
			}
	});
};
var sendEmail = function (emailContents) {
	if (typeof emailContents.lastFourDigitsOfCard === 'undefined') {
		emailContents.lastFourDigitsOfCardlastFourDigitsOfCard = 'XXXX';
	}
	if (typeof emailContents.currency === 'undefined') {
		emailContents.currency = 'GBP';
	}
	emailTemplates(templatesDir, function (err, template) {
		/*jshint maxcomplexity:24 */
		if (err) {
			console.dir(err);
		} else {
			var transporter = nodemailer.createTransport(smtpTransport({
				host: 'localhost',
				port: 25
			}));
			var locals = {};
			if (emailContents.emailTemplate === 'pay-foreign-marriage-certificates-authorisation' ||
				emailContents.emailTemplate === 'pay-foreign-marriage-certificates-capture' ||
				emailContents.emailTemplate === 'pay-foreign-marriage-certificates-refund' ||
				emailContents.emailTemplate === 'pay-foreign-marriage-certificates-cancellation') {
				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: 'pay-foreign-marriage-certificates',
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
					p: emailContents.dataDecodedJson.p,
					registrationsAndCertificates: registrationsAndCertificates(emailContents.dataDecodedJson),
					lastFourDigits: emailContents.lastFourDigitsOfCard
				};
			} else if (emailContents.emailTemplate === 'pay-legalisation-premium-service-authorisation' ||
				emailContents.emailTemplate === 'pay-legalisation-premium-service-capture' ||
				emailContents.emailTemplate === 'pay-legalisation-premium-service-refund' ||
				emailContents.emailTemplate === 'pay-legalisation-premium-service-cancellation') {
				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: 'pay-legalisation-premium-service',
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
					documents: pluralise('documents', documentCount(emailContents.dataDecodedJson)),
					lastFourDigits: emailContents.lastFourDigitsOfCard
				};
			} else if (emailContents.emailTemplate === 'pay-legalisation-post-authorisation' ||
				emailContents.emailTemplate === 'pay-legalisation-post-capture' ||
				emailContents.emailTemplate === 'pay-legalisation-post-refund' ||
				emailContents.emailTemplate === 'pay-legalisation-post-cancellation') {
				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: 'pay-legalisation-post',
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
					postage: capitalise(emailContents.dataDecodedJson.po),
					documents: pluralise('documents', documentCount(emailContents.dataDecodedJson)),
					lastFourDigits: emailContents.lastFourDigitsOfCard
				};
			} else if (emailContents.emailTemplate === 'pay-register-birth-abroad-authorisation' ||
				emailContents.emailTemplate === 'pay-register-birth-abroad-capture' ||
				emailContents.emailTemplate === 'pay-register-birth-abroad-refund' ||
				emailContents.emailTemplate === 'pay-register-birth-abroad-cancellation') {
				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: 'pay-register-birth-abroad',
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
					birthRegistrations: pluralise('birth registration', registrationCount(emailContents.dataDecodedJson)),
					certificates: pluralise('certificate', documentCount(emailContents.dataDecodedJson)),
					postage: capitalise(emailContents.dataDecodedJson.po),
					lastFourDigits: emailContents.lastFourDigitsOfCard
				};
			} else if (emailContents.emailTemplate === 'pay-register-death-abroad-authorisation' ||
				emailContents.emailTemplate === 'pay-register-death-abroad-capture' ||
				emailContents.emailTemplate === 'pay-register-death-abroad-refund' ||
				emailContents.emailTemplate === 'pay-register-death-abroad-cancellation') {
				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: 'pay-register-death-abroad',
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
					certificates: pluralise('certificate', documentCount(emailContents.dataDecodedJson)),
					deathRegistrations: pluralise('death registration', registrationCount(emailContents.dataDecodedJson)),
					postage: capitalise(emailContents.dataDecodedJson.po),
					lastFourDigits: emailContents.lastFourDigitsOfCard
				};
			} else {
				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: emailContents.emailTemplate,
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
					lastFourDigits: emailContents.lastFourDigitsOfCard,
					currency: emailContents.currency
				};
			}
			template(emailContents.emailTemplate, locals, function (err, html) {
				if (err) {
					console.dir(err);
				} else {
					transporter.sendMail({
						from: config.emailFromAddress,
						to: emailContents.dataDecodedJson.e,
						subject: emailContents.emailSubject,
						html: html,
						attachments: [{
							filename: 'govuk.PNG',
							content: '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',
							encoding: 'base64',
							cid: 'govuk'
						}],
						generateTextFromHTML: true,
					}, function (err) {
						if (err) {
							console.dir(err);
						} else {
							var collection = db.collection(config.dbCollection);
							if (emailContents.emailType === 'authorisation') {
								console.log('AUTHORISATION email sent for payment ' + emailContents.merchantReference);
								collection.update({
									'_id': emailContents.merchantReference
								}, {
									$set: {
										'authorisationEmail': 1
									}
								}, {
									w: 1
								}, function (err) {
									if (err) {
										return console.dir(err);
									}
								});
							} else if (emailContents.emailType === 'capture') {
								console.log('CAPTURE email sent for payment ' + emailContents.merchantReference);
								if (emailContents.slug !== 'generic-capture') {
									collection.update({
										'_id': emailContents.merchantReference
									}, {
										$set: {
											'captureEmail': 1
										}
									}, {
										w: 1
									}, function (err) {
										if (err) {
											return console.dir(err);
										}
									});
								}
							} else if (emailContents.emailType === 'cancellation') {
								console.log('CANCELLATION email sent for payment ' + emailContents.merchantReference);
								collection.update({
									'_id': emailContents.merchantReference
								}, {
									$set: {
										'cancellationEmail': 1
									}
								}, {
									w: 1
								}, function (err) {
									if (err) {
										return console.dir(err);
									}
								});
							} else if (emailContents.emailType === 'refund') {
								console.log('REFUND email sent for payment ' + emailContents.merchantReference);
								if (emailContents.slug !== 'generic-refund') {
									collection.update({
										'_id': emailContents.merchantReference
									}, {
										$set: {
											'refundEmail': 1
										}
									}, {
										w: 1
									}, function (err) {
										if (err) {
											return console.dir(err);
										}
									});
								}
							}
						}
					});
				}
			});
		}
	});
};
var pluralise = function (word, count) {
	return pluralize(word, count, true);
};
var capitalise = function (word) {
	return word.toUpperCase();
};
var formatMoney = function (num) {
	if (num % 1 === 0) {
		return num;
	} else {
		return numeral(num).format('0,0.00');
	}
};
var documentCount = function (params) {
	return (parseInt(params['dc'], 10) || 0);
};
var registrationCount = function (params) {
	return (parseInt(params['rc'], 10) || 0);
};
var registrationsAndCertificates = function (params) {
	var phrases = [],
		regCount = registrationCount(params),
		docCount = documentCount(params);
	if (regCount > 0) {
		phrases.push(pluralise('registration', regCount));
	}
	if (docCount > 0) {
		phrases.push(pluralise('certificate', docCount));
	}
	return phrases.join(' and ');
};
module.exports = TransactionService;
