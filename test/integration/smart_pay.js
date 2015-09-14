var app = require('./../../app'),
	SmartPay = require('smartpay'),
	request = require('supertest'),
	Response = require('express').response,
	should = require('should'),
	sinon = require('sinon'),
	Transaction = require('./../../models/transaction'),
	transactionService = require('./../../lib/transaction_service'),
	Index = require('./../routes/index'),
	config = require('./../../config/smart_pay.js').config;
describe("additional smartpay config", function () {
	it("should be required by the smartpay routes module", function (done) {
		config.should.exist;
		config.dbEncryptionPassword.should.exist;
		config.dbEncryptionPassword.should.not.be.null;
		config.dbConnectionString.should.exist;
		config.dbConnectionString.should.not.be.null;
		config.pspId.should.exist;
		config.pspId.should.not.be.null;
		config.testMode.should.exist;
		config.testMode.should.not.be.null;
		config.notificationSlug.should.exist;
		config.notificationSlug.should.not.be.null;
		config.accounts.should.exist;
		config.accounts['legalisation-post'].should.exist;
		config.accounts['legalisation-post'].should.not.be.null;
		config.accounts['legalisation-drop-off'].should.exist;
		config.accounts['legalisation-drop-off'].should.not.be.null;
		config.accounts['birth-death-marriage'].should.exist;
		config.accounts['birth-death-marriage'].should.not.be.null;
		done();
	});
});
describe("smart_pay routes", function () {
	beforeEach(function (done) {
		sinon.spy(Response, 'render');
		done();
	});
	afterEach(function (done) {
		Response.render.restore();
		done();
	});
	describe("start", function () {
		it("should find the appropriate transaction", function (done) {
			request(app)
				.get('/start')
				.set('host', 'pay-register-death-abroad.service.gov.uk')
				.expect(200)
				.end(function (err, res) {
					should.not.exist(err);
					var renderArgs = Response.render.getCall(0).args;
					renderArgs[0].should.equal('start');
					renderArgs[1].journeyDescription.should.equal('pay-register-death-abroad:start');
					res.text.should.match(/Payment to register a death abroad/)
					done();
				});
		});
		it("should find the appropriate transaction from a preview subdomain structure", function (done) {
			request(app)
				.get('/start')
				.set('host', 'www.preview.pay-register-death-abroad.service.gov.uk')
				.expect(200)
				.end(function (err, res) {
					should.not.exist(err);
					var renderArgs = Response.render.getCall(0).args;
					renderArgs[0].should.equal('start');
					renderArgs[1].journeyDescription.should.equal('pay-register-death-abroad:start');
					res.text.should.match(/Payment to register a death abroad/)
					done();
				});
		});
		it("should set strict-transport-security and x-frame-options headers", function (done) {
			request(app)
				.get('/start')
				.set('x-forwarded-proto', 'https')
				.set('host', 'pay-register-death-abroad.service.gov.uk')
				.expect(200)
				.end(function (err, res) {
					should.not.exist(err);
					res.headers['x-frame-options'].should.equal('DENY');
					res.headers['strict-transport-security'].should.equal('max-age=31536; includeSubdomains');
					done();
				});
		});;
		it("should set the correct expiry headers", function (done) {
			request(app)
				.get('/start')
				.set('host', 'pay-register-death-abroad.service.gov.uk')
				.expect(200)
				.end(function (err, res) {
					should.not.exist(err);
					res.headers['cache-control'].should.equal('max-age=1800, public');
					done();
				});
		});
		it("should return a 404 if the subdomain does not match a transaction", function (done) {
			request(app)
				.get('/start')
				.set('host', 'pay-register-a-dog-abroad.service.gov.uk')
				.expect(404)
				.end(function (err, res) {
					should.not.exist(err);
					done();
				});
		});
	});
	describe("GET /confirm", function () {
		it("should redirect to /start", function () {
			request(app)
				.get('/confirm')
				.expect(302)
				.end(function (err, res) {
					should.not.exist(err);
					res.headers['location'].should.equal('/start');
				});
		});
	});
	describe("POST /confirm", function () {
		describe("given a zero document count", function () {
			it("should assign an error", function (done) {
				request(app)
					.post('/confirm')
					.set('host', 'pay-foreign-marriage-certificates.service.gov.uk')
					.send({
						'transaction': {
							'dc': '0',
							'p': 'yes'
						}
					})
					.expect(200)
					.end(function (err, res) {
						should.not.exist(err);
						res.headers['x-frame-options'].should.equal('DENY');
						var renderArgs = Response.render.lastCall.args;
						renderArgs[1].errors.should.equal('Invalid document count');
						renderArgs[1].journeyDescription.should.equal('pay-foreign-marriage-certificates:invalid_form');
						done();
					});
			});
		});
		describe("given an invalid document type", function () {
			it("should render the start template and assign an error", function (done) {
				request(app)
					.post('/confirm')
					.set('host', 'pay-foreign-marriage-certificates.service.gov.uk')
					.send({
						'transaction': {
							'dc': '5',
							'p': 'yes',
							'document_type': 'nya'
						}
					})
					.expect(200)
					.end(function (err, res) {
						should.not.exist(err);
						var renderArgs = Response.render.lastCall.args;
						renderArgs[1].errors.should.equal('Invalid document type');
						renderArgs[1].journeyDescription.should.equal('pay-foreign-marriage-certificates:invalid_form');
						done();
					});
			});
		});
	});
	describe("done pages", function () {
		it("returns 404 status if subdomain doesn't match a transaction", function (done) {
			request(app)
				.get('/done')
				.set('host', 'pay-bear-tax.service.gov.uk')
				.expect(404)
				.end(function (err, res) {
					should.not.exist(err);
					done();
				});
		});
		describe("for a standard transaction", function () {
			before(function (done) {
				config.accounts = {
					'birth-death-marriage': {
						//shaOut : '00000000000000000000000000000000000000000',
						// shaType : 'sha1'
					}
				};
				done();
			});
			describe("given invalid parameters", function () {
				it("should render the error template", function (done) {
					request(app)
						.get('/done')
						.query({
							"merchantReference": "test",
							"skinCode": "K88KxJVv",
							"shopperLocale": 'en_GB',
							"paymentMethod": "mc",
							"authResult": 'AUTHORISED',
							"pspReference": '12345678',
							"merchantSig": "something which is not correct",
							"dc": "3",
							"p": "yes"
						})
						.set('host', 'pay-register-death-abroad.service.gov.uk')
						.expect(200)
						.end(function (err, res) {
							should.not.exist(err);
							var renderArgs = Response.render.lastCall.args,
								journeyDescription = renderArgs[1].journeyDescription;
							journeyDescription.should.equal('pay-register-death-abroad:payment_error');
							done();
						});
				});
			});
		});
	});
});