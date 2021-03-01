var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    http = require('http'),
    port = (process.env.PORT || 1337),
    should = require('should');

Browser.dns.localhost('pay-register-death-abroad.test.gov.uk');

describe("Pay to register a death abroad", function(){

  beforeEach(function(done){
    browser = new Browser();
    browser.site = "http://pay-register-death-abroad.test.gov.uk:"+port;
    done();
  });

  describe("start", function(){
    it("accepts a country parameter for use in confirmation", function (done) {
      browser.visit("/start?country=usa", {}, function(err){
        //should.not.exist(err);

        browser.query("input#transaction_country").value.should.equal('usa');

        browser.text("title").should.equal('Payment to register a death abroad - GOV.UK');
        browser.text('.options-list li:first-child').should.match(/^UK address or British Forces Post Office - £5/);
        browser.text('.options-list li:nth-child(2)').should.match(/^Europe .*? £15/);
        browser.text('.options-list li:nth-child(3)').should.equal('Rest of the world - £20');
        browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);

        browser.text('#content header h1').should.equal('Payment to register a death abroad');

        browser.select('#transaction_rc','2');
        browser.select('#transaction_dc', '2');
        browser.choose('#transaction_postage_option_rest-of-world');
        browser.fill('#transaction_email_address', 'test@mail.com');

        browser.pressButton('Calculate total', function(err){

          //should.not.exist(err);

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'The cost for 2 registrations and 2 certificates plus Rest of the world postage is £425.');

          done();
        });
      });
    });
    it("renders the transaction intro page and generates the payment form when 'Calculate total' is clicked", function(done){
      browser.visit("/start", { headers: { 'x-arr-ssl' : 'true' } }, function(err){

        //should.not.exist(err);

        browser.text("title").should.equal('Payment to register a death abroad - GOV.UK');

        browser.text('#content header h1').should.equal('Payment to register a death abroad');
        browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);

        browser.select('#transaction_rc','2');
        browser.select('#transaction_dc', '2');
        browser.choose('#transaction_postage_option_uk');
        browser.fill('#transaction_email_address', 'test@mail.com');

        browser.pressButton('Calculate total', function(err){

          //should.not.exist(err);

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'The cost for 2 registrations and 2 certificates plus UK address or British Forces Post Office postage is £405.50.');

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
