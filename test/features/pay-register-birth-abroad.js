var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    http = require('http'),
    port = (process.env.PORT || 1337),
    should = require('should');

Browser.dns.localhost('pay-register-birth-abroad.test.gov.uk');

describe("Pay to register a birth abroad", function(){

  beforeEach(function(done){
    browser = new Browser();
    browser.site = "http://pay-register-birth-abroad.test.gov.uk:"+port;
    done();
  });

  describe("start", function(){
    it("render the transaction intro page and generate the payment form when 'Calculate total' is clicked", function(done){
      browser.visit("/start", {}, function(err){

       // should.not.exist(err);

        browser.text("title").should.equal('Payment to register a birth abroad - GOV.UK');

        browser.text('#content header h1').should.equal('Payment to register a birth abroad');
        browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);
        
        browser.select('#transaction_rc','2');
        browser.select('#transaction_dc', '0');
        browser.choose('#transaction_postage_option_uk');
        browser.fill('#transaction_email_address', 'test@mail.com');
        
        browser.pressButton('Calculate total', function(err){

          //should.not.exist(err);

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'The cost for 2 registrations and 0 certificates plus UK address or British Forces Post Office postage is £305.50.');

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
    describe("start with birth country parameter", function(){
      it("renders the transaction intro page and generates the payment form", function(done){
        browser.visit("/start?country=spain", {}, function(err){

        //should.not.exist(err);

        browser.query("#transaction_country").value.should.equal("spain");

        browser.text("title").should.equal('Payment to register a birth abroad - GOV.UK');
        browser.text('.options-list li:first-child').should.match(/^UK address or British Forces Post Office - £5\.50$/);
        browser.text('.options-list li:nth-child(2)').should.match(/^Europe .*? £14\.50$/);
        browser.text('.options-list li:nth-child(3)').should.equal('Rest of the world - £25');
        browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);

        browser.text('#content header h1').should.equal('Payment to register a birth abroad');
        browser.select('#transaction_rc','2');
        browser.select('#transaction_dc', '2');
        browser.choose('#transaction_postage_option_europe');
        browser.fill('#transaction_email_address', 'test@mail.com');

        browser.pressButton('Calculate total', function(err){

          //should.not.exist(err);

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'The cost for 2 registrations and 2 certificates plus Europe (excluding Albania, Armenia, Azerbaijan, Belarus, Bosnia and Herzegovina, Georgia, Liechtenstein, Macedonia, Moldova, Montenegro, Russia, Serbia, Turkey and Ukraine) postage is £414.50.');

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
});
