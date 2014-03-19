var _ = require('lodash');
var Deps = require('./bootstrapping');

var Computation = function (f, parent) {
  if (! Deps.isConstructingComputation())
    throw new Error(
      "Computation constructor is private; use Deps.autorun");
  Deps.setConstructingComputation(false);
  var self = this;
  self.stopped = false;
  self.invalidated = false;
  self.firstRun = true;
  self._id = Deps.getNextId();
  self._onInvalidateCallbacks = [];
  // the plan is at some point to use the parent relation
  // to constrain the order that computations are processed
  self._parent = parent;
  self._func = f;
  self._recomputing = false;

  var errored = true;
  try {
    self._compute();
    errored = false;
  } finally {
    self.firstRun = false;
    if (errored)
      self.stop();
  }
};
_.extend(Computation.prototype, {

  onInvalidate: function (f) {
    var self = this;

    if (typeof f !== 'function')
      throw new Error("onInvalidate requires a function");

    var g = function () {
      Deps.nonreactive(function () {
        f(self);
      });
    };

    if (self.invalidated)
      g();
    else
      self._onInvalidateCallbacks.push(g);
  },

  invalidate: function () {
    var self = this;
    if (! self.invalidated) {
      // if we're currently in _recompute(), don't enqueue
      // ourselves, since we'll rerun immediately anyway.
      if (! self._recomputing && ! self.stopped) {
        Deps.requireFlush();
        Deps.pendingComputations.push(this);
      }

      self.invalidated = true;

      // callbacks can't add callbacks, because
      // self.invalidated === true.
      for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++)
        f(); // already bound with self as argument
      self._onInvalidateCallbacks = [];
    }
  },

  stop: function () {
    if (! this.stopped) {
      this.stopped = true;
      this.invalidate();
    }
  },

  _compute: function () {
    var self = this;
    self.invalidated = false;

    var previous = Deps.currentComputation;
    Deps.setCurrentComputation(self);
    var previousInCompute = Deps.inCompute;
    Deps.inCompute = true;
    try {
      self._func(self);
    } finally {
      Deps.setCurrentComputation(previous);
      Deps.inCompute = false;
    }
  },

  _recompute: function () {
    var self = this;

    self._recomputing = true;
    while (self.invalidated && ! self.stopped) {
      try {
        self._compute();
      } catch (e) {
        _debugFunc()("Exception from Deps recompute:", e.stack || e.message);
      }
    }
    self._recomputing = false;
  }
});

exports = module.exports = Computation;