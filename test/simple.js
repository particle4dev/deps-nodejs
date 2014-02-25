var expect = require('chai').expect;
var _ = require('lodash');
var Deps = require('../index');

var NumberModel = function(n){
    this._value = _.isNumber(n) ? n : 0;
    this._deps = new Deps.Dependency();

    this.get = function(){
        this._deps.depend();
        return this._value;
    };
    this.set = function(v){
        this._value = v;
        this._deps.changed();
    };
};

suite("simple example", function() { 

    test("with number", function(done) {
        var A = new NumberModel();
        var B = 0;
        Deps.autorun(function(c){
            B = 5 + A.get();
            expect(B).to.equal(A.get() + 5);
            done();
        });
        A.set(5);
    });

});