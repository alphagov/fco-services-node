var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
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

       // testing re-direct

        browser.text("title").should.equal('Get your document legalised - GOV.UK');

        done();

      });
    });
  });
});
