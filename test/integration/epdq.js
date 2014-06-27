var app = require('./../../app'),
    EPDQ = require('epdq'),
    request = require('supertest'),
    Response = require('express').response,
    should = require('should'),
    sinon = require('sinon'),
    Transaction = require('./../../models/transaction');

describe("additional epdq config", function(){
  it("should be required by the epdq routes module", function(done){
    EPDQ.config.should.exist;
    EPDQ.config.shaIn.should.equal('00000000000000000000000000000000000000000');
    EPDQ.config.shaOut.should.equal('00000000000000000000000000000000000000000');
    EPDQ.config.pspId.should.equal('pspid');
    EPDQ.config.shaType.should.equal('sha1');
    EPDQ.config.accounts.should.exist;
    EPDQ.config.accounts['legalisation-post'].should.exist;
    EPDQ.config.accounts['legalisation-drop-off'].should.exist;
    EPDQ.config.accounts['birth-death-marriage'].should.exist;
    EPDQ.config.accounts['birth-death-marriage'].pspId.should.equal('pspid');
    EPDQ.config.accounts['birth-death-marriage'].shaIn.should.equal('00000000000000000000000000000000000000000');
    EPDQ.config.accounts['birth-death-marriage'].shaOut.should.equal('00000000000000000000000000000000000000000');
    done();
  });
});

describe("epdq routes", function(){
  beforeEach(function(done){
    sinon.spy(Response, 'render');
    done();
  });
  afterEach(function(done){
    Response.render.restore();
    done();
  });
  describe("start", function(){
    it("should find the appropriate transaction", function(done){

      request(app)
        .get('/start')
        .set('host','pay-register-death-abroad.service.gov.uk')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);

          var renderArgs = Response.render.getCall(0).args;
          renderArgs[0].should.equal('start');
          renderArgs[1].journeyDescription.should.equal('pay-register-death-abroad:start');

          res.text.should.match(/Payment to register a death abroad/)

          done();
        });
    });
    it("should find the appropriate transaction from a preview subdomain structure", function(done){
      request(app)
        .get('/start')
        .set('host','www.preview.pay-register-death-abroad.service.gov.uk')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);

          var renderArgs = Response.render.getCall(0).args;
          renderArgs[0].should.equal('start');
          renderArgs[1].journeyDescription.should.equal('pay-register-death-abroad:start');

          res.text.should.match(/Payment to register a death abroad/)

          done();
        });
    });
    it("should set the correct expiry and x-frame-options headers", function(done){
      request(app)
        .get('/start')
        .set('host','pay-register-death-abroad.service.gov.uk')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.headers['cache-control'].should.equal('max-age=1800, public');
          res.headers['x-frame-options'].should.equal('DENY');
          done();
        });
    });
    it("should return a 404 if the subdomain does not match a transaction", function(done){
      request(app)
        .get('/start')
        .set('host','pay-register-a-dog-abroad.service.gov.uk')
        .expect(404)
        .end(function(err, res){
          should.not.exist(err);
          done();
        });
    });
  });
  describe("GET /confirm", function(){
    it("should redirect to /start", function(){
      request(app)
        .get('/confirm')
        .expect(302)
        .end(function(err, res){
          should.not.exist(err);
          res.headers['location'].should.equal('/start');
        });
    });
  });

  describe("POST /confirm", function(){
    describe("given a zero document count", function(){
      it("should assign an error", function(done){

        request(app)
          .post('/confirm')
          .set('host','pay-foreign-marriage-certificates.service.gov.uk')
          .send({ 'transaction' : { 'document_count' : '0', 'postage' : 'yes' } })
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);

            var renderArgs = Response.render.lastCall.args;
            renderArgs[1].errors.should.equal('Invalid document count');
            renderArgs[1].journeyDescription.should.equal('pay-foreign-marriage-certificates:invalid_form');

            done();
          });

      });
    });

    describe("given an invalid document type", function(){
      it("should render the start template and assign an error", function(done){

        request(app)
          .post('/confirm')
          .set('host','pay-foreign-marriage-certificates.service.gov.uk')
          .send({ 'transaction' : { 'document_count' : '5', 'postage' : 'yes', 'document_type' : 'nya' } })
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);

            var renderArgs = Response.render.lastCall.args;
            renderArgs[1].errors.should.equal('Invalid document type');
            renderArgs[1].journeyDescription.should.equal('pay-foreign-marriage-certificates:invalid_form');

            done();
          });

      });
    });
  });

  describe("with custom account info", function(){
    beforeEach(function(done){
      EPDQ.config.accounts['birth-death-marriage'] = {
        pspId : '5up3r53cr3t',
        shaType : 'sha1',
        shaIn : 'F4CC376CD7A834D997B91598FA747825A238BE0A'
      };
      done();
    });
    describe("POST /confirm", function(done){
      it("should use the post body to build an EPDQ.Request", function(done){

        request(app)
          .post('/confirm')
          .set('host','pay-foreign-marriage-certificates.service.gov.uk')
          .send({ 'transaction' : { 'document_count' : '5', 'postage' : 'yes', 'document_type' : 'nulla-osta' } })
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            var renderArgs = Response.render.lastCall.args,
                transaction = renderArgs[1].transaction,
                epdqRequest = renderArgs[1].epdqRequest,
                formAttrs = epdqRequest.formAttributes();
            transaction.slug.should.equal('pay-foreign-marriage-certificates');
            transaction.title.should.equal('Payment for certificates to get married abroad');
            transaction.document_cost.should.equal(65);
            transaction.postage_cost.should.equal(10);
            transaction.registration.should.equal(false);
            transaction.account.should.equal('birth-death-marriage');

            formAttrs['ACCEPTURL'].should.equal('http://pay-foreign-marriage-certificates.service.gov.uk/done');
            formAttrs['AMOUNT'].should.equal('33500'); // Math.round((65 * 5) + 10) * 100) = 33500
            formAttrs['CURRENCY'].should.equal('GBP');
            formAttrs['LANGUAGE'].should.equal('en_GB');
            formAttrs['PSPID'].should.equal('5up3r53cr3t');

            renderArgs[1].journeyDescription.should.equal('pay-foreign-marriage-certificates:confirm');
            done();
          });
      });
    });

    describe("with registration count", function(done){
      it("should create an EPDQ Request with the correct amount", function(done){

        request(app)
          .post('/confirm')
          .set('host','pay-register-birth-abroad.service.gov.uk')
          .send({ 'transaction' : {
            'registration_count' : '5',
            'document_count' : '5',
            'postage_option' : 'uk'
          } })
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);

            var renderArgs = Response.render.lastCall.args,
                epdqRequest = renderArgs[1].epdqRequest,
                transaction = renderArgs[1].transaction,
                formAttrs = epdqRequest.formAttributes();

            res.headers['x-frame-options'].should.equal('DENY');

            transaction.slug.should.equal('pay-register-birth-abroad');
            transaction.title.should.equal('Payment to register a birth abroad');
            transaction.document_cost.should.equal(65);
            transaction.registration.should.equal(true);
            transaction.account.should.equal('birth-death-marriage');

            formAttrs['ACCEPTURL'].should.equal('http://pay-register-birth-abroad.service.gov.uk/done');
            formAttrs['AMOUNT'].should.equal('85450');
            formAttrs['CURRENCY'].should.equal('GBP');
            formAttrs['LANGUAGE'].should.equal('en_GB');
            formAttrs['PSPID'].should.equal('5up3r53cr3t');

            renderArgs[1].journeyDescription.should.equal('pay-register-birth-abroad:confirm');
            done();
          });
      });
    });
  });

  describe("done pages", function(){
    it("returns 404 status if subdomain doesn't match a transaction", function(done){
      request(app)
        .get('/done')
        .set('host','pay-bear-tax.service.gov.uk')
        .expect(404)
        .end(function(err, res){
          should.not.exist(err);
          done();
        });
    });
    describe("for a standard transaction", function(){
      before(function(done){
        EPDQ.config.accounts = { 'birth-death-marriage' : {
          shaOut : '00000000000000000000000000000000000000000',
          shaType : 'sha1'
        } };

        done();
      });
      describe("given valid params", function(){
        it("should render the done template", function(done){
          request(app)
            .get('/done')
            .query({
              "orderID" : "test",
              "currency" : "GBP",
              "amount" : 45,
              "PM" : "CreditCard",
              "ACCEPTANCE" : "test123",
              "STATUS" : 5,
              "CARDNO" : "XXXXXXXXXXXX1111",
              "CN" : "MR MICKEY MOUSE",
              "TRXDATE" : "03/11/13",
              "PAYID" : 12345678,
              "NCERROR" : 0,
              "BRAND" : "VISA",
              "SHASIGN" : "6ACE8B0C8E0B427137F6D7FF86272AA570255003",
              "document_count" : "3",
              "registration_count" : "4",
              "postage" : "yes"
            })
            .set('host','pay-register-death-abroad.service.gov.uk')
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              var renderArgs = Response.render.lastCall.args,
                  epdqResponse = renderArgs[1].epdqResponse,
                  epdqParams = epdqResponse.parameters(),
                  journeyDescription = renderArgs[1].journeyDescription,
                  transaction = renderArgs[1]._locals.transaction;

              res.headers['x-frame-options'].should.equal('DENY');

              transaction.title.should.equal("Payment to register a death abroad");
              transaction.slug.should.equal("pay-register-death-abroad");
              epdqParams['payid'].should.equal('12345678');
              epdqParams['orderid'].should.equal('test');
              epdqParams['document_count'].should.equal('3');
              epdqParams['registration_count'].should.equal('4');
              epdqParams['postage'].should.equal('yes');
              journeyDescription.should.equal('pay-register-death-abroad:done');
              res.text.should.match(/You have paid for 4 death registrations and 3 certificates, plus postage/);

              done();
            });
        });
      });
      describe("given invalid parameters", function(){
        it("should render the error template", function(done){
          request(app)
            .get('/done')
            .query({
              "orderID" : "test",
              "currency" : "GBP",
              "amount" : 45,
              "PM" : "CreditCard",
              "ACCEPTANCE" : "test123",
              "STATUS" : 5,
              "CARDNO" : "XXXXXXXXXXXX1111",
              "CN" : "MR MICKEY MOUSE",
              "TRXDATE" : "03/11/13",
              "PAYID" : 12345678,
              "NCERROR" : 0,
              "BRAND" : "VISA",
              "SHASIGN" : "something which is not correct",
              "document_count" : "3",
              "postage" : "yes"
            })
            .set('host','pay-register-death-abroad.service.gov.uk')
            .expect(200)
            .end(function(err, res){
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
