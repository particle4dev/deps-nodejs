var _ = require('lodash');
var Deps = require('./bootstrapping');
Deps.Computation = require('./computation');
Deps.Dependency = require('./dependency');

var _debugFunc = function () {
  return  console.log;
};

// `true` if we are in Deps.flush now
var inFlush = false;

var afterFlushCallbacks = [];

_.extend(Deps, {
  flush: function () {
    if (inFlush)
      throw new Error("Can't call Deps.flush while flushing");

    if (Deps.inCompute)
      throw new Error("Can't flush inside Deps.autorun");

    inFlush = true;
    willFlush = true;

    while (Deps.pendingComputations.length ||
           afterFlushCallbacks.length) {

      // recompute all pending computations
      var comps = Deps.pendingComputations;
      Deps.pendingComputations = [];

      for (var i = 0, comp; comp = comps[i]; i++)
        comp._recompute();

      if (afterFlushCallbacks.length) {
        // call one afterFlush callback, which may
        // invalidate more computations
        var func = afterFlushCallbacks.shift();
        try {
          func();
        } catch (e) {
          _debugFunc()("Exception from Deps afterFlush function:",
                       e.stack || e.message);
        }
      }
    }

    inFlush = false;
    willFlush = false;
  },

  autorun: function (f) {
    if (typeof f !== 'function')
      throw new Error('Deps.autorun requires a function argument');

    Deps.setConstructingComputation(true);

    var c = new Deps.Computation(f, Deps.currentComputation);

    if (Deps.active)
      Deps.onInvalidate(function () {
        c.stop();
      });

    return c;
  },

  nonreactive: function (f) {
    var previous = Deps.currentComputation;
    Deps.setCurrentComputation(null);
    try {
      return f();
    } finally {
      Deps.setCurrentComputation(previous);
    }
  },

  _makeNonreactive: function (f) {
    if (f.$isNonreactive) // avoid multiple layers of wrapping.
      return f;
    var nonreactiveVersion = function (/*arguments*/) {
      var self = this;
      var args = _.toArray(arguments);
      var ret;
      Deps.nonreactive(function () {
        ret = f.apply(self, args);
      });
      return ret;
    };
    nonreactiveVersion.$isNonreactive = true;
    return nonreactiveVersion;
  },

  onInvalidate: function (f) {
    if (! Deps.active)
      throw new Error("Deps.onInvalidate requires a currentComputation");

    Deps.currentComputation.onInvalidate(f);
  },

  afterFlush: function (f) {
    afterFlushCallbacks.push(f);
    requireFlush();
  }
});

exports = module.exports = Deps;