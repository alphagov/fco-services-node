var app = require('./../../app'),
    browser,
    Browser = require('zombie'),
    SmartPay = require('smartpay'),
    port = (process.env.PORT || 1337),
    should = require('should');

Browser.dns.localhost('pay-foreign-marriage-certificates.test.gov.uk');

describe("Email validation fail", function() {

    beforeEach(function(done) {
        browser = new Browser();
        browser.site = "http://pay-foreign-marriage-certificates.test.gov.uk:" + port;
        done();
    });

    describe("start", function() {
        it("render the transaction intro page but not proceed after invalid email is entered", function(done) {

            browser.visit("/start", {}, function(err) {

                browser.text("title").should.equal('Payment for certificates to get married abroad - GOV.UK');

                browser.text('.options-list li:first-child').should.equal('Certificate of no impediment');
                browser.text('.options-list li:last-child').should.equal('Nulla Osta');
                browser.text('.inner label[for="transaction_dc"]').should.match(/How many do you need\? Each certificate costs £65\./);
                browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);

                browser.choose('#transaction_document_type_certificate-of-no-impediment');
                browser.select('#transaction_dc', '2');
                browser.select('#transaction_postage', 'Yes');
                browser.fill('#transaction_email_address', 'test±@mail.com');

                browser.pressButton('Calculate total', function(err) {


                    browser.text('#content .article-container .inner p:first-child').should.equal(
                        'A valid email address is required');

                    browser.button("Calculate total").should.exist;

                    done();
                });
            });
        });
    });
});

describe("Email validation success", function() {

    beforeEach(function(done) {
        browser = new Browser();
        browser.site = "http://pay-foreign-marriage-certificates.test.gov.uk:" + port;
        done();
    });

    describe("start", function() {
        it("render the transaction intro page but not proceed after invalid email is entered", function(done) {

            browser.visit("/start", {}, function(err) {

                browser.text("title").should.equal('Payment for certificates to get married abroad - GOV.UK');

                browser.text('.options-list li:first-child').should.equal('Certificate of no impediment');
                browser.text('.options-list li:last-child').should.equal('Nulla Osta');
                browser.text('.inner label[for="transaction_dc"]').should.match(/How many do you need\? Each certificate costs £65\./);
                browser.text('.inner label[for="transaction_email_address"]').should.match(/Please enter your email address/);

                browser.choose('#transaction_document_type_certificate-of-no-impediment');
                browser.select('#transaction_dc', '2');
                browser.select('#transaction_postage', 'Yes');
                browser.fill('#transaction_email_address', 'test !\\$&*-=^`|~#%\'+/?_{}.@fco.gov.uk');

                browser.pressButton('Calculate total', function(err) {


                    browser.text('#content .article-container .inner p:first-child').should.equal(
                        'The cost of 2 certificates of no impediment plus postage is £140.');

                    browser.button("Pay").should.exist;

                    done();
                });
            });
        });
    });
});