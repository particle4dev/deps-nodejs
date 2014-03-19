var _ = require('lodash');
var Deps = require('./bootstrapping');

var Dependency = function () {
  this._dependentsById = {};
};

_.extend(Dependency.prototype, {

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

exports = module.exports = Dependency;