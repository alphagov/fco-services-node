var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    http = require('http'),
    port = (process.env.PORT || 1337),
    should = require('should');

Browser.dns.localhost('pay-legalisation-post.test.gov.uk');

describe("Pay to legalise a document by post", function(){

  beforeEach(function(done){
    browser = new Browser();
    browser.site = "http://pay-legalisation-post.test.gov.uk:"+port;
    done();
  });

  describe("start", function(){
    it("render the transaction intro page and generate the payment form when 'Calculate total' is clicked", function(done){
      browser.visit("/additional-payments", {}, function(err){

       // should.not.exist(err);

        browser.text("title").should.equal('Make an additional payment for legalisation - GOV.UK');

        browser.text('#content header h1').should.equal('Make an additional payment for legalisation');

        browser.fill('#transaction_cost', '1');
        browser.fill('#transaction_email_address', 'test@mail.com');
        

        browser.pressButton('Continue', function(err){

          //should.not.exist(err);
          browser.text("p.error-message").should.equal('');

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'You will be charged £1.00 as an additional payment for your legalisation application.');

          browser.query("form.smartpay-submit").action.should.match(/https:\/\/test\.barclaycardsmartpay\.com/);
          browser.query("form.smartpay-submit").method.should.equal("post");

          browser.field("input[name='paymentAmount']").should.exist;
          browser.field("input[name='currencyCode']").should.exist;
          browser.field("input[name='shipBeforeDate']").should.exist;
          browser.field("input[name='merchantReference']").should.exist;
          browser.field("input[name='skinCode']").should.exist;
          browser.field("input[name='merchantAccount']").should.exist;
          browser.field("input[name='sessionValidity']").should.exist;
          browser.field("input[name='shopperEmail']").should.exist;
          browser.field("input[name='shopperReference']").should.exist;
          browser.field("input[name='allowedMethods']").should.exist;
          browser.field("input[name='blockedMethods']").should.exist;
          browser.field("input[name='shopperStatement']").should.exist;
          browser.field("input[name='billingAddressType']").should.exist;
          browser.field("input[name='resURL']").should.exist;
          browser.field("input[name='merchantReturnData']").should.exist;

          browser.button("Pay now").should.exist;

          done();
        });
      });
    });
  });
});
