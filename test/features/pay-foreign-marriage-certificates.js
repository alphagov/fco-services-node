var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    SmartPay = require('smartpay'),
    port = (process.env.PORT || 1337),
    should = require('should');

Browser.dns.localhost('pay-foreign-marriage-certificates.test.gov.uk');

describe("Payment for certificates to get married abroad", function(){

  beforeEach(function(done){
    browser = new Browser();
    browser.site = "http://pay-foreign-marriage-certificates.test.gov.uk:"+port;
    done();
  });

  describe("start", function(){
    it("render the transaction intro page and generate the payment form when 'Calculate total' is clicked", function(done){
      browser.visit("/start", {}, function(err){

        //should.not.exist(err);

        browser.text("title").should.equal('Payment for certificates to get married abroad - GOV.UK');

       browser.text('.options-list li:first-child').should.equal('Certificate of no impediment');
       browser.text('.options-list li:last-child').should.equal('Nulla Osta');
        browser.text('.inner label[for="transaction_dc"]').should.match(/How many do you need\? Each certificate costs £65\./);
        browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);

        browser.choose('#transaction_document_type_certificate-of-no-impediment');
        browser.select('#transaction_dc', '2');
        browser.select('#transaction_postage', 'Yes');
        browser.fill('#transaction_email_address', 'test@mail.com');

        browser.pressButton('Calculate total', function(err){

          //should.not.exist(err);

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'The cost of 2 certificates of no impediment plus postage is £140.');

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
