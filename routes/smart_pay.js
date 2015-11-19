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
				var transactionService = new TransactionService(res.locals.transaction),
					body = req.body.notificationItems[0].NotificationRequestItem,
					collection = db.collection(config.dbCollection),
					event = body.eventCode,
					success = body.success,
					merchantAccountCode = body.merchantAccountCode,
					merchantAccountType = capitalise(merchantAccountCode.slice(-4)),
					account = '';
				var emailContents = {
					value: body.amount.value / 100,
					merchantReference: body.merchantReference,
					paymentMethod: body.paymentMethod,
					dataDecodedJson: '',
					emailTemplate: '',
					date: transactionService.getDate(),
					emailSubject: '',
					lastFourDigitsOfCard: '',
					emailType: '',
					pspReference: body.pspReference,
					currency: '',
					slug: ''
				};
				var transactionSlug = emailContents.merchantReference.split('-');
				var serviceAndAccounts = transactionService.getServiceFromPaymentReference(transactionSlug[0]);
				emailContents.slug = serviceAndAccounts[0];
				account = serviceAndAccounts[1];
				console.log('Processing a new notification request for ' + emailContents.merchantReference);
				console.log(emailContents.merchantReference + ' is of type ' + event + ' for service ' + emailContents.slug);
				if (event === 'AUTHORISATION' && success === 'true' && emailContents.slug !== '') {
					if (merchantAccountType === 'MOTO') {
						transactionService.processMOTOPayment(emailContents, body, merchantAccountCode);
					} else {
						transactionService.processAuthorisationPayment(emailContents, body, merchantAccountCode, collection);
					}
				}
				if (event === 'CAPTURE' && success === 'true' && emailContents.slug !== '') {
					if (merchantAccountType !== 'MOTO') {
						transactionService.processCapturePayment(emailContents, body, merchantAccountCode, collection, account);
					}
				}
				if (event === 'REFUND' && success === 'true' && emailContents.slug !== '') {
					if (merchantAccountType !== 'MOTO') {
						transactionService.processRefundPayment(emailContents, body, merchantAccountCode, collection, account);
					}
				}
				if (event === 'CANCELLATION' && success === 'true' && emailContents.slug !== '') {
					if (merchantAccountType !== 'MOTO') {
						transactionService.processCancellationPayment(emailContents, body, merchantAccountCode, collection, account);
					}
				}
				if (success === 'false') {
					console.log('Notification has not succeeded for ' + emailContents.merchantReference);
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