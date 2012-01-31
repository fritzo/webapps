/**
 * Array tools.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

//------------------------------------------------------------------------------
// Array tools

Array.prototype.min = function () {
  var result = 1/0;
  var i = this.length;
  while (i--) {
    var value = this[i];
    if (value < result) result = value;
  }
  return result;
};

test('Array.min', function () {
  assertEqual([0,1,2].min(), 0);
  assertEqual([3,2,1,0].min(), 0);
});

Array.prototype.max = function () {
  var result = -1/0;
  var i = this.length;
  while (i--) {
    var value = this[i];
    if (value > result) result = value;
  }
  return result;
};

test('Array.max', function () {
  assertEqual([0,1,2].max(), 2);
  assertEqual([3,2,1,0].max(), 3);
});

Array.prototype.argmin = function () {
  var minValue = 1/0;
  var result = undefined;
  var i = this.length;
  while (i--) {
    var value = this[i];
    if (value < minValue) {
      minValue = value;
      result = i;
    }
  }
  return result;
};

test('Array.argmin', function () {
  assertEqual([0,1,2].argmin(), 0);
  assertEqual([3,2,1,0].argmin(), 3);
});

Array.prototype.argmax = function () {
  var maxValue = -1/0;
  var result = undefined;
  var i = this.length;
  while (i--) {
    var value = this[i];
    if (value > maxValue) {
      maxValue = value;
      result = i;
    }
  }
  return result;
};

test('Array.argmax', function () {
  assertEqual([0,1,2].argmax(), 2);
  assertEqual([3,2,1,0].argmax(), 0);
});

Array.prototype.argsort = function () {
  var i = this.length;
  var result = new Array(i);
  while (i--) {
    result[i] = i;
  }
  var values = this;
  result.sort(function (lhs,rhs) { return values[lhs] - values[rhs]; });
  return result;
}

test('Array.argsort', function () {
  assertEqual([0,1,2].argsort(), [0,1,2]);
  assertEqual([3,2,1,0].argsort(), [3,2,1,0]);
});

