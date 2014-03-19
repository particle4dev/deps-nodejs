var _ = require('lodash');
Deps = {};

var constructingComputation = false;
Deps.isConstructingComputation = function(){

};
Deps.isConstructingComputation = function(){
  return constructingComputation;
};
Deps.setConstructingComputation = function(bool){
  constructingComputation = !!bool;
};

var nextId = 1;
Deps.getNextId = function(){
  return nextId++;
};

Deps.active = false;
Deps.currentComputation = null;
Deps.setCurrentComputation = function (c) {
  Deps.currentComputation = c;
  Deps.active = !! c;
};

// `true` if we are computing a computation now, either first time
// or recompute.  This matches Deps.active unless we are inside
// Deps.nonreactive, which nullfies currentComputation even though
// an enclosing computation may still be running.
Deps.inCompute = false;

// `true` if a Deps.flush is scheduled, or if we are in Deps.flush now
var willFlush = false;
Deps.requireFlush = function () {
  if (! willFlush) {
    setTimeout(Deps.flush, 0);
    willFlush = true;
  }
};

// computations whose callbacks we should call at flush time
Deps.pendingComputations = [];

exports = module.exports = Deps;