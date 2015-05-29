var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    EPDQ = require('epdq'),
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
      browser.visit("/start", {}, function(err){

        should.not.exist(err);

        browser.text("title").should.equal('Pay to legalise documents by post - GOV.UK');

        browser.text('#content header h1').should.equal('Pay to legalise documents by post');

        browser.text('.options-list li:first-child').should.equal('Prepaid envelope that you provide (to the UK only) - £0');
        browser.text('.options-list li:nth-child(3)').should.match(/^Tracked courier service to Europe .*? £14\.50$/);
        browser.text('.options-list li:nth-child(4)').should.equal('Tracked courier service to the rest of the world - £25');

        browser.fill('#transaction_document_count', '1');
        browser.choose('#transaction_postage_option_uk');

        browser.pressButton('Calculate total', function(err){

          should.not.exist(err);
          browser.text("p.error-message").should.equal('');

          browser.text('#content .article-container .inner p:first-child').should.equal(
            'It costs £35.50 for 1 document plus Tracked courier service to the UK or British Forces Post Office including Isle of Man and Channel Islands postage.');

          browser.query("form.epdq-submit").action.should.match(/https:\/\/mdepayments\.epdq\.co\.uk/);
          browser.query("form.epdq-submit").method.should.equal("post");

          browser.field("input[name='ORDERID']").should.exist;
          browser.field("input[name='PSPID']").should.exist;
          browser.field("input[name='SHASIGN']").should.exist;
          browser.field("input[name='AMOUNT']").should.exist;
          browser.field("input[name='CURRENCY']").should.exist;
          browser.field("input[name='LANGUAGE']").should.exist;
          browser.field("input[name='ACCEPTURL']").should.exist;

          browser.button("Pay").should.exist;

          done();
        });
      });
    });
  });
  describe("/done", function(){
    it("should show the completed transaction", function(done){
      browser.visit("/done?orderID=test&currency=GBP&amount=45&PM=CreditCard&ACCEPTANCE=test123&STATUS=5&CARDNO=XXXXXXXXXXXX1111&CN=MR%20MICKEY%20MOUSE&TRXDATE=03%2F11%2F13&PAYID=12345678&NCERROR=0&BRAND=VISA&SHASIGN=6ACE8B0C8E0B427137F6D7FF86272AA570255003&document_count=3&registration_count=4&postage=yes",
        {}, function(err){
          should.not.exist(err);
          var doneText = browser.text('.article-container .inner');
          doneText.should.match(/Your payment of £45 has been received by the Legalisation Office/);
          doneText.should.match(/Your payment number is 12345678/);
          done();
      });
    });
  });
});
