var app = require('./../../app'),
    fs = require('fs'),
    should = require('should'),
    sinon = require('sinon'),
    Transaction = require('./../../models/transaction');

describe("Transaction", function(){
  describe("find", function(){
    it("should return the configured transaction if it exists ", function(){
      var trans = Transaction.find('pay-register-death-abroad');
      trans.slug.should.equal('pay-register-death-abroad');
      trans.title.should.equal('Payment to register a death abroad');
      trans.document_cost.should.equal(65);
      trans.postage_options.length.should.equal(3);
      trans.postage_options[0].key.should.equal('uk');
      trans.postage_options[0].cost.should.equal(5.5);
      trans.postage_options[1].key.should.equal('europe');
      trans.postage_options[1].cost.should.equal(14.5);
      trans.postage_options[2].key.should.equal('rest-of-world');
      trans.postage_options[2].cost.should.equal(25);
      trans.registration.should.be.ok;
      trans.account.should.equal('birth-death-marriage');
    });
    it("should only load the transactions data once",function(){
      var spy = sinon.spy(fs, 'readFileSync');
      Transaction._transactions = null;
      Transaction.transactions();
      Transaction.transactions();
      spy.calledOnce.should.be.ok;
    });
  });
});
