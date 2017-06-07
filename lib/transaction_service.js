var crypto = require('crypto'),
	SmartPay = require('smartpay'),
	Transaction = require('./../models/transaction'),
	TransactionCalculator = require('./transaction_calculator'),
	zlib = require('zlib'),
	nodemailer = require('nodemailer'),
	smtpTransport = require('nodemailer-smtp-transport'),
	templatesDir = './templates',
	emailTemplates = require('email-templates'),
    moment = require('moment'),
	numeral = require('numeral'),
	pluralize = require('pluralize'),
	config = require('./../config/smart_pay.js').config;

moment.locale('en-gb');

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
	var re = /^([a-zA-Z0-9_\!\\\$\&\*\-\=\^\`\|\~\#\%\'\"\+\/\?\_\{\}\.\@\s])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/i;
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
TransactionService.prototype.formatPaymentMethod = function (paymentMethod) {
	if (paymentMethod === 'mc'){
		return 'mastercard';
	}else{
		return paymentMethod;
	}
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
	var today = moment().format('L');
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
		slug = 'emergency travel document';
	} else {
		slug = firstPartOfReference;
	}
	return [slug, account];
};
TransactionService.prototype.processAuthorisationPayment = function (emailContents, body, merchantAccountCode, collection) {
	console.log('Processing AUTHORISATION notification for ' + emailContents.merchantReference);
	if (emailContents.slug === 'emergency travel document') {
		var encryptedEmail = this.encrypt(body.additionalData.shopperEmail);
		var document = {
			'_id': emailContents.merchantReference,
			'merchantReturnData': encryptedEmail,
			'binRange': body.additionalData.cardSummary,
			'pspReference': body.pspReference,
			'dateAdded': new Date()
		};
		collection.insert(document, {
			w: 1
		}, function (err) {
			if (err) {
				return console.dir(err);
			}
			console.log('Inserted reference ' + emailContents.merchantReference + ' into database successfully');
			var etdCollection = db.collection(config.etdCollection);
			etdCollection.findOne({
				'_id': {
					$regex: new RegExp(merchantAccountCode, 'i')
				}
			}, function (err, etdDocument) {
				if (err) {
					return console.dir(err);
				}
				if (etdDocument === undefined || etdDocument === null) {
					console.log('There has been a problem finding the ETD office email address for ' + merchantAccountCode);
				} else {
					var fcoOfficeEmailAddress = etdDocument.emailAddress;
					collection.update({
						'_id': emailContents.merchantReference
					}, {
						$set: {
							'fcoOfficeEmailAddress': fcoOfficeEmailAddress
						}
					}, {
						w: 1
					}, function (err) {
						if (err) {
							return console.dir(err);
						}
					});
				}
			});
		});
	} else {
		emailContents.lastFourDigitsOfCard = body.additionalData.cardSummary;
		emailContents.emailType = 'authorisation';
		emailContents.emailTemplate = emailContents.slug + '-' + emailContents.emailType;
		collection.update({
			'_id': emailContents.merchantReference
		}, {
			$set: {
				'authorised': 1,
				'pspReference': emailContents.pspReference,
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
			'_id': {
				$regex: new RegExp(emailContents.merchantReference, 'i')
			}
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
					sendEmail(emailContents, function () {
						if (emailContents.emailTemplate === 'pay-legalisation-post-authorisation'){
                            emailContents.dataDecodedJson = JSON.parse('{"e":"' + config.legalisationOfficeEmailAddress + '","pa":"' + emailContents.value + '"}');
                            console.log('Sending email to office');
                            sendEmail(emailContents, function () {})
						}
					});
				});
			}
		});
	}
};
TransactionService.prototype.processMOTOPayment = function (emailContents, body, merchantAccountCode) {
	console.log(emailContents.merchantReference + ' is a MOTO payment (over the counter) and has been processed by ' + merchantAccountCode);
	var collection = db.collection(config.emailCollection);
	emailContents.lastFourDigitsOfCard = body.additionalData.cardSummary;
	emailContents.emailType = 'capture';
	emailContents.emailTemplate = 'generic' + '-' + emailContents.emailType;
	emailContents.emailSubject = 'Receipt for ' + emailContents.slug + ' from the Foreign Office';
	var shopperEmail = body.additionalData.shopperEmail;
	emailContents.currency = body.amount.currency;
	collection.findOne({
		'_id': {
			$regex: new RegExp(merchantAccountCode, 'i')
		}
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
			sendEmail(emailContents, function () {
				if (typeof shopperEmail !== 'undefined') {
					emailContents.dataDecodedJson = JSON.parse('{"e":"' + shopperEmail + '","pa":"' + emailContents.value + '"}');
					console.log('Sending email to customer');
					sendEmail(emailContents, function () {});
				}
			});
		}
	});
};
TransactionService.prototype.processCapturePayment = function (emailContents, body, merchantAccountCode, collection, account) {
	console.log('Processing CAPTURE notification for ' + emailContents.merchantReference);
	if (emailContents.slug === 'emergency travel document') {
		collection.findOne({
			'_id': {
				$regex: new RegExp(emailContents.merchantReference, 'i')
			}
		}, function (err, document) {
			if (err) {
				return console.dir(err);
			}
			if (document === undefined || document === null) {
				console.log('Nothing returned from database for ' + emailContents.merchantReference);
			} else {
				var shopperEmail = decrypt(document.merchantReturnData);
				var fcoOfficeEmailAddress = document.fcoOfficeEmailAddress;
				emailContents.lastFourDigitsOfCard = document.binRange;
                emailContents.pspReference = document.pspReference;
				emailContents.emailType = 'capture';
				emailContents.emailTemplate = 'generic' + '-' + emailContents.emailType;
				emailContents.emailSubject = 'Receipt for ' + emailContents.slug + ' from the Foreign Office';
				emailContents.currency = body.amount.currency;
				if (typeof shopperEmail !== 'undefined') {
					emailContents.dataDecodedJson = JSON.parse('{"e":"' + shopperEmail + '","pa":"' + emailContents.value + '"}');
					console.log('Sending email to customer');
					sendEmail(emailContents, function () {
						if (typeof fcoOfficeEmailAddress !== 'undefined') {
							emailContents.dataDecodedJson = JSON.parse('{"e":"' + fcoOfficeEmailAddress + '","pa":"' + emailContents.value + '"}');
							console.log('Sending email to ' + fcoOfficeEmailAddress);
							sendEmail(emailContents, function () {
							});
						}
					});
				}
			}
		});
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
			'_id': {
				$regex: new RegExp(emailContents.merchantReference, 'i')
			}
		}, function (err, document) {
			if (err) {
				return console.dir(err);
			}
			if (document === undefined || document === null) {
				console.log('Nothing returned from database for ' + emailContents.merchantReference);
			} else {
				if (config.accounts[account].sendAllEmails === 'true') {
					var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
					emailContents.lastFourDigitsOfCard = document.binRange;
                    emailContents.pspReference = document.pspReference;
					inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
						emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
						emailContents.emailSubject = 'Receipt for ' + emailContents.slug + ' from the Foreign Office';
						console.log('Sending email to customer');
						sendEmail(emailContents, function () {});
					});
				} else {
                    console.log(emailContents.merchantReference + " - Capture emails are currently disabled")
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
		'_id': {
			$regex: new RegExp(emailContents.merchantReference, 'i')
		}
	}, function (err, document) {
		if (err) {
			return console.dir(err);
		}
		if (document === undefined || document === null) {
			console.log('Nothing returned from database for ' + emailContents.merchantReference);
		} else {
            if (config.accounts[account].sendAllEmails === 'true') {
				var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
				emailContents.lastFourDigitsOfCard = document.binRange;
                emailContents.pspReference = document.pspReference;
				inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
					emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
					emailContents.emailSubject = 'Refund for ' + emailContents.slug + ' from the Foreign Office';
					console.log('Sending email to customer');
					sendEmail(emailContents, function () {});
				});
			} else {
            	console.log(emailContents.merchantReference + " - Refund emails are currently disabled")
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
		'_id': {
			$regex: new RegExp(emailContents.merchantReference, 'i')
		}
	}, function (err, document) {
		if (err) {
			return console.dir(err);
		}
		if (document === undefined || document === null) {
			console.log('Nothing returned from database for ' + emailContents.merchantReference);
		} else {
            if (config.accounts[account].sendAllEmails === 'true') {
				var decryptedMerchantReturnData = decrypt(document.merchantReturnData);
				emailContents.lastFourDigitsOfCard = document.binRange;
                emailContents.pspReference = document.pspReference;
				inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
					emailContents.dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
					emailContents.emailSubject = 'Cancellation for ' + emailContents.slug + ' from the Foreign Office';
					console.log('Sending email to customer');
					sendEmail(emailContents, function () {});
				});
			} else {
                console.log(emailContents.merchantReference + " - Cancellation emails are currently disabled")
            }
		}
	});
};
var sendEmail = function (emailContents, callback) {
	if (typeof emailContents.lastFourDigitsOfCard === 'undefined') {
		emailContents.lastFourDigitsOfCard = 'XXXX';
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

				if (emailContents.emailSubject.indexOf("Order") >= 0){
                    emailContents.emailSubject = 'Order for your additional payment for legalisation';
				}

				if(emailContents.emailSubject.indexOf("Receipt") >= 0){
                    emailContents.emailSubject = 'Receipt for your additional payment for legalisation';
				}

				if(emailContents.emailSubject.indexOf("Refund") >= 0){
                    emailContents.emailSubject = 'Refund of your additional payment for legalisation';
                }

                if(emailContents.emailSubject.indexOf("Cancellation") >= 0){
                    emailContents.emailSubject = 'Cancellation of your additional payment for legalisation';
                }

				locals = {
					date: emailContents.date,
					merchantReference: emailContents.merchantReference,
					pspReference: emailContents.pspReference,
					slug: 'Additional payments for legalisation',
					pa: formatMoney(emailContents.value),
					paymentMethod: emailContents.paymentMethod,
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
					slug: emailContents.slug,
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
						},{
							filename: 'fco.PNG',
							content: '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',
							encoding: 'base64',
							cid: 'fco'
						}],
						generateTextFromHTML: true,
					}, function (err) {
						if (err) {
							console.dir(err);
						} else {
							var collection = db.collection(config.dbCollection);
							if (emailContents.emailType === 'authorisation') {
								console.log('AUTHORISATION email sent to ' + emailContents.dataDecodedJson.e + ' for payment ' + emailContents.merchantReference);
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
								console.log('CAPTURE email sent to ' + emailContents.dataDecodedJson.e + ' for payment ' + emailContents.merchantReference);
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
								console.log('CANCELLATION email sent to ' + emailContents.dataDecodedJson.e + ' for payment ' + emailContents.merchantReference);
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
								console.log('REFUND email sent to ' + emailContents.dataDecodedJson.e + ' for payment ' + emailContents.merchantReference);
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
							callback();
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