var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    SmartPay = require('smartpay'),
    http = require('http'),
    port = (process.env.PORT || 1337),
    should = require('should');

Browser.dns.localhost('pay-legalisation-drop-off.test.gov.uk');

describe("Pay to legalise documents using the premium service", function(){

  beforeEach(function(done){
    browser = new Browser();
    browser.site = "http://pay-legalisation-drop-off.test.gov.uk:"+port;
    done();
  });

  describe("start", function(){
    it("render the transaction intro page and generate the payment form when 'Calculate total' is clicked", function(done){
      browser.visit("/start", {}, function(err){

       // should.not.exist(err);

        browser.text("title").should.equal('Pay to legalise documents using the premium service - GOV.UK');

        browser.text('#content header h1').should.equal('Pay to legalise documents using the premium service');
        browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);
        browser.fill('#transaction_dc', '3');
        browser.fill('#transaction_email_address', 'test@mail.com');
        

        browser.pressButton('Calculate total', function(err){

         //should.not.exist(err);

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'It costs £225 for 3 documents.');

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

          browser.button("Pay").should.exist;

          done();
        });
      });
    });
  });
});
