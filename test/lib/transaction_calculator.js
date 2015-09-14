var should = require('should'),
    TransactionCalculator = require('./../../lib/transaction_calculator'),
    transaction,
    calculator;

describe("TransactionCalculator", function(){
  describe("given a transaction without document types or registration costs", function(){
    beforeEach(function(){
      transaction = {
        'document_cost' : 20,
        'postage_cost' : 5,
        'registration' : false
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("calculates the cost of a single document", function(){
      calculator.calculate({'dc': 1}).totalCost.should.equal(20);
    });

    it("calculates the cost of multiple documents", function(){
      calculator.calculate({'dc': 3}).totalCost.should.equal(60);
    });

    it("calculates the cost with postage", function(){
      calculator.calculate({'dc': 3, 'p': 'yes'}).totalCost.should.equal(65);
    });

    it("builds and item list for a single document", function(){
      calculator.calculate({'dc': 1}).formattedItemList().should.equal("1 document");
    });

    it("builds and item list for multiple documents", function(){
      calculator.calculate({'dc': 5}).formattedItemList().should.equal("5 documents");
    });

    it("builds and item list for multiple documents plus postage", function(){
      calculator.calculate({'dc': 5, 'p': 'yes'}).formattedItemList().should.equal("5 documents plus postage");
    });

    it("raises an error if the document count is not a number", function(){
      (function(){
        calculator.calculate({'dc': 'lotz'});
      }).should.throw("Invalid document count");
    });
  });
  describe("given a transaction which allows zero documents", function(){
    beforeEach(function(){
      transaction = {
        'document_cost': 20,
        'allow_zero_document_count': true,
        'postage_cost': 5,
        'registration': false
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("calculates the cost for multiple documents", function(){
      calculator.calculate({'dc': 3}).totalCost.should.equal(60);
    });

    it("calculates the cost for zero documents", function(){
      calculator.calculate({'dc': 0}).totalCost.should.equal(0);
    });

    it("calculates the cost for zero documents including postage", function(){
      calculator.calculate({'dc': 0, 'p': 'yes'}).totalCost.should.equal(5);
    });
  });
  describe("given a transaction with registration and uk postage costs", function(){
    beforeEach(function(){
      transaction = {
        'document_cost': 65,
        'registration_cost': 75,
        'allow_zero_document_count': true,
        'registration': true,
        'postage_options': [
          {"key": "uk", "cost": 4.5},
          {"key": "europe", "cost": 12.5}
        ]
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("calculates the cost with multiple registrations plus postage", function(){
      calculator.calculate({'rc': 2, 'po': 'uk'}).totalCost.should.equal(154.5);
    });
  });
  describe("given a transaction with registration and european postage costs", function(){
    beforeEach(function(){
      transaction = {
        'document_cost': 65,
        'registration_cost': 105,
        'allow_zero_document_count': true,
        'registration': 'birth',
        'postage_options': [
          {"key": "uk", "cost": 4.5},
          {"key": "europe", "cost": 12.5}
        ]
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("calculates the cost with multiple registrations plus postage", function(){
      calculator.calculate({'rc': 2, 'p': 'yes', 'po': 'europe'}).totalCost.should.equal(222.5);
    });
    describe("given a transaction with registration and worldwide postage costs", function(){
    beforeEach(function(){
      transaction = {
        'document_cost': 65,
        'registration_cost': 105,
        'allow_zero_document_count': true,
        'registration': 'birth',
        'postage_options': [
          { "key": "rest-of-world", "cost": 22 }
        ]
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("calculates the cost with multiple registrations plus postage", function(){
      calculator.calculate({'rc': 2, 'p': 'yes', 'po': 'rest-of-world'}).totalCost.should.equal(232);
    });
  });
});
  describe("given a transaction which allows zero documents", function(){
    beforeEach(function(){
      transaction = {
        'document_cost': 20,
        'postage_cost': 5,
        'registration': false,
        'document_types' : {
          "certificate-of-biscuit-quality": "Certificate of biscuit quality",
          "tea-assurance-document": "Tea assurance document"
        }
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("raises and exception if no document type is specified", function(){
      (function(){
        calculator.calculate({'dc': 1})
      }).should.throw("Invalid document type");
    });

    it("builds an item list for a single document", function(){
      calculator.calculate({
        'dc': 1, 'document_type': 'tea-assurance-document'
      }).formattedItemList().should.equal("1 Tea assurance document");
    });

    it("builds an item list for multiple documents", function(){
      calculator.calculate({
        'dc': 2, 'document_type': 'tea-assurance-document'
      }).formattedItemList().should.equal("2 Tea assurance documents");
    });

    it("builds an item list for multiple documents with postage", function(){
      calculator.calculate({
        'dc': 2, 'document_type': 'tea-assurance-document', 'p': 'yes'
      }).formattedItemList().should.equal("2 Tea assurance documents plus postage");
    });

    it("builds an item list for a single certificate", function(){
      calculator.calculate({
        'dc': 1, 'document_type': 'certificate-of-biscuit-quality'
      }).formattedItemList().should.equal("1 Certificate of biscuit quality");
    });

    it("builds an item list for multiple certificates", function(){
      calculator.calculate({
        'dc': 2, 'document_type': 'certificate-of-biscuit-quality'
      }).formattedItemList().should.equal("2 Certificates of biscuit quality");
    });
  });
  describe("given a transaction with postage options", function(){
    beforeEach(function(){
      transaction = {
        'document_cost': 20,
        'postage_options': [
          {
            "key": "horse-and-cart",
            "label": "Horse and cart",
            "cost" : 10
          },
          {
            "key": "iron-horse",
            "label" : "Iron horse",
            "cost" : 20
          },
          {
            "key": "flying-machine",
            "label" : "Flying machine",
            "cost" : 35
          }
        ]
      };
      calculator = new TransactionCalculator(transaction);
    });

    it("calculates the cost of postage", function(){
      calculator.calculate({
        'dc': 1, 'po': 'iron-horse'
      }).totalCost.should.equal(40);
    });

    it("calculates the cost of postage and documents", function(){
      calculator.calculate({
        'dc': 3, 'po': 'flying-machine'
      }).totalCost.should.equal(95);
    });

    it("builds an item list including postage type", function(){
      calculator.calculate({
        'dc': 1, 'po': 'horse-and-cart'
      }).formattedItemList().should.equal("1 document plus Horse and cart postage");
    });

    it("builds an item list of multiple documents including the postage type", function(){
      calculator.calculate({
        'dc': 3, 'po': 'flying-machine'
      }).formattedItemList().should.equal("3 documents plus Flying machine postage");
    });

    it("raises an error if no postage option set", function(){
      (function(){
        calculator.calculate({ 'dc': 1});
      }).should.throw("Invalid postage option");
    });

    it("raises an error if the postage option doesn't exist", function(){
      (function(){
        calculator.calculate({ 'dc': 1, 'po': 'mailman'});
      }).should.throw("Invalid postage option");
    });

    it("raises an error if document count is zero", function(){
      (function(){
        calculator.calculate({ 'dc': 0, 'po': 'flying-machine'});
      }).should.throw("Invalid document count");
    });
  });

  describe("given a transaction without postage", function(){
    beforeEach(function(){
      transaction = {
        'document_cost' : 20,
        'postage_cost' : false
      };
      calculator = new TransactionCalculator(transaction);
    });
    it("calculates the document cost", function(){
      calculator.calculate({'dc': 3}).totalCost.should.equal(60);
    });

    it("builds an item list which doesn't include postage", function(){
      calculator.calculate({'dc': 3}).formattedItemList().should.equal("3 documents");
    });
  });
});
