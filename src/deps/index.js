var _ = require('lodash');

Deps = {};

Deps.active = false;

Deps.currentComputation = null;

var setCurrentComputation = function (c) {
  Deps.currentComputation = c;
  Deps.active = !! c;
};

var _debugFunc = function () {
  return  console.log;
};

var nextId = 1;
// computations whose callbacks we should call at flush time
var pendingComputations = [];
// `true` if a Deps.flush is scheduled, or if we are in Deps.flush now
var willFlush = false;
// `true` if we are in Deps.flush now
var inFlush = false;
// `true` if we are computing a computation now, either first time
// or recompute.  This matches Deps.active unless we are inside
// Deps.nonreactive, which nullfies currentComputation even though
// an enclosing computation may still be running.
var inCompute = false;

var afterFlushCallbacks = [];

var requireFlush = function () {
  if (! willFlush) {
    setTimeout(Deps.flush, 0);
    willFlush = true;
  }
};

var constructingComputation = false;

Deps.Computation = function (f, parent) {
  if (! constructingComputation)
    throw new Error(
      "Deps.Computation constructor is private; use Deps.autorun");
  constructingComputation = false;

  var self = this;

  self.stopped = false;

  self.invalidated = false;

  self.firstRun = true;

  self._id = nextId++;
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

_.extend(Deps.Computation.prototype, {

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
        requireFlush();
        pendingComputations.push(this);
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
    setCurrentComputation(self);
    var previousInCompute = inCompute;
    inCompute = true;
    try {
      self._func(self);
    } finally {
      setCurrentComputation(previous);
      inCompute = false;
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

Deps.Dependency = function () {
  this._dependentsById = {};
};

_.extend(Deps.Dependency.prototype, {

  depend: function (computation) {
    if (! computation) {
      if (! Deps.active)
        return false;

      computation = Deps.currentComputation;
    }
    var self = this;
    var id = computation._id;
    if (! (id in self._dependentsById)) {
      self._dependentsById[id] = computation;
      computation.onInvalidate(function () {
        delete self._dependentsById[id];
      });
      return true;
    }
    return false;
  },

  changed: function () {
    var self = this;
    for (var id in self._dependentsById)
      self._dependentsById[id].invalidate();
  },

  hasDependents: function () {
    var self = this;
    for(var id in self._dependentsById)
      return true;
    return false;
  }
});

_.extend(Deps, {
  flush: function () {
    if (inFlush)
      throw new Error("Can't call Deps.flush while flushing");

    if (inCompute)
      throw new Error("Can't flush inside Deps.autorun");

    inFlush = true;
    willFlush = true;

    while (pendingComputations.length ||
           afterFlushCallbacks.length) {

      // recompute all pending computations
      var comps = pendingComputations;
      pendingComputations = [];

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

    constructingComputation = true;
    var c = new Deps.Computation(f, Deps.currentComputation);

    if (Deps.active)
      Deps.onInvalidate(function () {
        c.stop();
      });

    return c;
  },

  nonreactive: function (f) {
    var previous = Deps.currentComputation;
    setCurrentComputation(null);
    try {
      return f();
    } finally {
      setCurrentComputation(previous);
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