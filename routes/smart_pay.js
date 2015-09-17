var SmartPay = require('smartpay'),
	auth = require('basic-auth'),
	TransactionService = require('./../lib/transaction_service');
var journeyDescription = function (res, step) {
	return res.locals.transaction.slug + ':' + step;
};
var capitalise = function (word) {
	return word.toUpperCase();
};
var config = require('./../config/smart_pay.js').config;
/**
 * Cache control middleware filter.
 */
var setExpiry = function (req, res, next) {
	res.setHeader('Cache-Control', 'max-age=1800, public');
	next();
};
/**
 * changed to smart_pay transaction actions
 *
 */
module.exports = {
	middleware: {
		setExpiry: setExpiry,
		findTransaction: TransactionService.findTransaction
	},
	middlewares: [setExpiry, TransactionService.findTransaction],
	rootRedirect: function (req, res) {
		res.redirect(req.url + 'start');
	},
	/**
	 * GET /start
	 */
	start: function (req, res) {
		res.render('start', {
			country: (req.query['country'] || ''),
			postalCountry: (req.query['postal_country'] || ''),
			transaction: res.locals.transaction,
			journeyDescription: journeyDescription(res, 'start')
		});
	},
	/**
	 * POST /confirm
	 */
	/**
 * @param req
 
 */
	confirm: function (req, res) {
		try {
			var transactionService = new TransactionService(res.locals.transaction);
			var calculation = transactionService.calculateTotal(req.body['transaction']);
			var validatedEmail = transactionService.validateEmail(req.body['transaction']);
			var requestParameters = transactionService.buildParameterList(req, calculation.totalCost, validatedEmail, function (merchantReturnData) {
				transactionService.getNextPaymentNumber(res.locals.transaction.slug, function (number) {
					number = number + 1;
					requestParameters.merchantReference = requestParameters.merchantReference + '-' + number;
					requestParameters.merchantReturnData = merchantReturnData;
					var smartPayRequest = transactionService.buildSmartPayRequest(req, requestParameters);
					delete requestParameters['allowed_methods'];
					delete requestParameters['blocked_methods'];
					SmartPay.testMode = config.testMode;
					var encryptedMerchantReturnData = transactionService.encrypt(requestParameters.merchantReturnData);
					var collection = db.collection(config.dbCollection);
					var document = {
						'_id': requestParameters.merchantReference,
						'service': res.locals.transaction.slug,
						'merchantReturnData': encryptedMerchantReturnData,
						'binRange': 1234,
						'authorised': 0,
						'captured': 0,
						'cancelled': 0,
						'refunded': 0,
						'authorisationEmail': 0,
						'captureEmail': 0,
						'cancellationEmail': 0,
						'refundEmail': 0,
						'dateAdded': new Date()
					};
					collection.insert(document, {
						w: 1
					}, function (err) {
						if (err) {
							return console.dir(err);
						}
						console.log('Inserted reference ' + requestParameters.merchantReference + ' into database successfully');
						res.render('confirm', {
							calculation: calculation,
							requestParameters: requestParameters,
							smartPayRequest: smartPayRequest,
							transaction: res.locals.transaction,
							journeyDescription: journeyDescription(res, 'confirm')
						});
					});
				});
			});
		} catch (err) {
			res.render('start', {
				country: req.body['transaction']['country'],
				postalCountry: req.body['transaction']['postal_country'],
				errors: err.message,
				journeyDescription: journeyDescription(res, 'invalid_form')
			});
		}
	},
	/**
	 * GET /done
	 */
	done: function (req, res) {
		try {
			var responseParameters = req.query;
			var transactionService = new TransactionService(res.locals.transaction);
			var smartPayResponse = transactionService.buildSmartPayResponse(req, responseParameters);
			if (smartPayResponse.verified()) {
				var extractedParameters = transactionService.extractParameterList(req, responseParameters, function (merchantReturnDataDecoded) {
					extractedParameters.merchantReturnData = merchantReturnDataDecoded;
					var merchantReturnDataJson = JSON.parse(extractedParameters.merchantReturnData);
					var date = transactionService.getDate();
					if (extractedParameters.authResult !== 'AUTHORISED') {
						res.render('payment_error', {
							journeyDescription: journeyDescription(res, 'payment_error')
						});
					} else {
						console.log('Reached the done page for ' + extractedParameters.merchantReference);
						var premiumService = '';
						if (res.locals.transaction.slug === 'pay-legalisation-drop-off') {
							premiumService = 'pay-legalisation-premium-service';
						}
						res.render('done', {
							smartPayResponse: smartPayResponse,
							extractedParameters: extractedParameters,
							merchantReturnDataJson: merchantReturnDataJson,
							transaction: res.locals.transaction,
							premiumService: premiumService,
							date: date,
							journeyDescription: journeyDescription(res, 'done')
						});
					}
				});
			} else {
				throw new Error('Invalid merchant signature');
			}
		} catch (e) {
			res.render('payment_error', {
				journeyDescription: journeyDescription(res, 'payment_error')
			});
		}
	},
	/**
	 * GET /notification
	 */
	notification: function (req, res) {
		/*jshint maxcomplexity:24 */
		/*jshint maxstatements:100*/
		/*jshint maxdepth:5*/
		try {
			var credentials = auth(req);
			if (!credentials || credentials.name !== config.basicAuthUsername || credentials.pass !== config.basicAuthPassword || res.locals.transaction.slug !== config.notificationSlug) {
				console.log('A failed attempt has been made to access the notification service');
				res.write('[accepted]');
				res.end();
			} else {
				var transactionService = new TransactionService(res.locals.transaction);
				var date = transactionService.getDate();
				var body = req.body.notificationItems[0].NotificationRequestItem;
				var event = body.eventCode;
				var success = body.success;
				var merchantAccountCode = body.merchantAccountCode;
				var merchantAccountType = capitalise(merchantAccountCode.slice(-4));
				var merchantReference = body.merchantReference;
				var paymentMethod = body.paymentMethod;
				var pspReference = body.pspReference;
				var transactionSlug = merchantReference.split('-');
				var lastFourDigitsOfCard = '';
				var shopperEmail = '';
				var collection = db.collection(config.dbCollection);
				var emailSubject = '';
				var slug = '';
				var value = body.amount.value / 100;
				var currency = '';
				var emailTemplate = '';
				var emailType = '';
				var dataDecodedJson = '';
				if (transactionSlug[0] === 'PAYFOREIGNMARRIAGECERTIFICATES') {
					slug = 'pay-foreign-marriage-certificates';
				} else if (transactionSlug[0] === 'PAYLEGALISATIONPREMIUMSERVICE') {
					slug = 'pay-legalisation-premium-service';
				} else if (transactionSlug[0] === 'PAYLEGALISATIONPOST') {
					slug = 'pay-legalisation-post';
				} else if (transactionSlug[0] === 'PAYREGISTERBIRTHABROAD') {
					slug = 'pay-register-birth-abroad';
				} else if (transactionSlug[0] === 'PAYREGISTERDEATHABROAD') {
					slug = 'pay-register-death-abroad';
				} else {
					slug = transactionSlug[0];
				}
				console.log('Processing a new notification request for ' + merchantReference);
				console.log(merchantReference + ' is of type ' + event + ' for service ' + slug);
				if (event === 'AUTHORISATION' && success === 'true' && slug !== '') {
					lastFourDigitsOfCard = body.additionalData.cardSummary;
					if (merchantAccountType === 'MOTO') {
						console.log(merchantReference + ' is a MOTO payment (over the counter) and has been processed by ' + merchantAccountCode);
						emailType = 'capture';
						emailTemplate = 'generic' + '-' + emailType;
						emailSubject = 'Receipt for ' + slug + ' from the Foreign Office';
						shopperEmail = body.additionalData.shopperEmail;
						currency = body.amount.currency;
						collection = db.collection(config.emailCollection);
						collection.findOne({
							'_id': merchantAccountCode
						}, function (err, document) {
							if (err) {
								return console.dir(err);
							}
							var fcoOfficeEmailAddress = document.emailAddress;
							dataDecodedJson = JSON.parse('{"e":"' + fcoOfficeEmailAddress + '","pa":"' + value + '"}');
							console.log('Sending email to ' + fcoOfficeEmailAddress);
							transactionService.sendEmail(value, merchantReference, paymentMethod, dataDecodedJson, emailTemplate, date, emailSubject, lastFourDigitsOfCard, emailType, pspReference, currency, slug);
						});
						if (typeof shopperEmail !== 'undefined') {
							dataDecodedJson = JSON.parse('{"e":"' + shopperEmail + '","pa":"' + value + '"}');
							console.log('Sending email to customer');
							transactionService.sendEmail(value, merchantReference, paymentMethod, dataDecodedJson, emailTemplate, date, emailSubject, lastFourDigitsOfCard, emailType, pspReference, currency, slug);
						}
					} else {
						emailType = 'authorisation';
						emailTemplate = slug + '-' + emailType;
						collection.update({
							'_id': merchantReference
						}, {
							$set: {
								'authorised': 1,
								'binRange': lastFourDigitsOfCard
							}
						}, {
							w: 1
						}, function (err) {
							if (err) {
								return console.dir(err);
							}
						});
						collection.findOne({
							'_id': merchantReference
						}, function (err, document) {
							if (err) {
								return console.dir(err);
							}
							if (document === undefined || document === null) {
								console.log('Nothing returned from database for ' + merchantReference);
							} else {
								var decryptedMerchantReturnData = transactionService.decrypt(document.merchantReturnData);
								lastFourDigitsOfCard = document.binRange;
								transactionService.inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
									dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
									emailSubject = 'Order for ' + slug + ' from the Foreign Office';
									console.log('Sending email to customer');
									transactionService.sendEmail(value, merchantReference, paymentMethod, dataDecodedJson, emailTemplate, date, emailSubject, lastFourDigitsOfCard, emailType, pspReference);
								});
							}
						});
					}
				}
				if (event === 'CAPTURE' && success === 'true' && slug !== '') {
					if (merchantAccountType !== 'MOTO') {
						console.log('Processing CAPTURE notification for ' + merchantReference);
						emailType = 'capture';
						emailTemplate = slug + '-' + emailType;
						collection.update({
							'_id': merchantReference
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
							'_id': merchantReference
						}, function (err, document) {
							if (err) {
								return console.dir(err);
							}
							if (document === undefined || document === null) {
								console.log('Nothing returned from database for ' + merchantReference);
							} else {
								var decryptedMerchantReturnData = transactionService.decrypt(document.merchantReturnData);
								lastFourDigitsOfCard = document.binRange;
								transactionService.inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
									dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
									emailSubject = 'Receipt for ' + slug + ' from the Foreign Office';
									console.log('Sending email to customer');
									transactionService.sendEmail(value, merchantReference, paymentMethod, dataDecodedJson, emailTemplate, date, emailSubject, lastFourDigitsOfCard, emailType, pspReference);
								});
							}
						});
					}
				}
				if (event === 'REFUND' && success === 'true' && slug !== '') {
					console.log('Processing REFUND notification for ' + merchantReference);
					if (merchantAccountType !== 'MOTO') {
						emailType = 'refund';
						emailTemplate = slug + '-' + emailType;
						collection.update({
							'_id': merchantReference
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
							'_id': merchantReference
						}, function (err, document) {
							if (err) {
								return console.dir(err);
							}
							if (document === undefined || document === null) {
								console.log('Nothing returned from database for ' + merchantReference);
							} else {
								var decryptedMerchantReturnData = transactionService.decrypt(document.merchantReturnData);
								lastFourDigitsOfCard = document.binRange;
								transactionService.inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
									dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
									emailSubject = 'Refund for ' + slug + ' from the Foreign Office';
									console.log('Sending email to customer');
									transactionService.sendEmail(value, merchantReference, paymentMethod, dataDecodedJson, emailTemplate, date, emailSubject, lastFourDigitsOfCard, emailType, pspReference);
								});
							}
						});
					}
				}
				if (event === 'CANCELLATION' && success === 'true' && slug !== '') {
					if (merchantAccountType !== 'MOTO') {
						console.log('Processing CANCELLATION notification for ' + merchantReference);
						emailType = 'cancellation';
						emailTemplate = slug + '-' + emailType;
						collection.update({
							'_id': merchantReference
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
							'_id': merchantReference
						}, function (err, document) {
							if (err) {
								return console.dir(err);
							}
							if (document === undefined || document === null) {
								console.log('Nothing returned from database for ' + merchantReference);
							} else {
								var decryptedMerchantReturnData = transactionService.decrypt(document.merchantReturnData);
								lastFourDigitsOfCard = document.binRange;
								transactionService.inflateAndDecode(decryptedMerchantReturnData, function (merchantReturnDataDecoded) {
									dataDecodedJson = JSON.parse(merchantReturnDataDecoded);
									emailSubject = 'Cancellation for ' + slug + ' from the Foreign Office';
									console.log('Sending email to customer');
									transactionService.sendEmail(value, merchantReference, paymentMethod, dataDecodedJson, emailTemplate, date, emailSubject, lastFourDigitsOfCard, emailType, pspReference);
								});
							}
						});
					}
				}
				if (success === 'false') {
					console.log('Notification has not succeeded for ' + merchantReference);
				}
				/*Accept payment anyway even if there was an issue*/
				res.write('[accepted]');
				res.end();
			}
		} catch (err) {
			res.write('[accepted]');
			res.end();
			return console.dir(err);
		}
	}
};