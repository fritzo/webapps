/*
  The Rational Keybard: version (2012-01-07)
  http://fritzo.org/keys
  
  Copyright (c) 2012, Fritz Obermeyer
  Licensed under the MIT license:
  http://www.opensource.org/licenses/mit-license.php
*/

//------------------------------------------------------------------------------
// Global safety

var AssertException = function (message) {
  this.message = message || '(unspecified)';
};
AssertException.prototype.toString = function () {
  return 'Assertion Failed: ' + this.message;
};
var assert = function (condition, message) {
  if (!condition) {
    throw new AssertException(message);
  }
};
var assertEqual = function (actual, expected, message) {
  if (!(actual instanceof String) || !(expected instanceof String)) {
    actual = JSON.stringify(actual);
    expected = JSON.stringify(expected);
  }
  assert(actual === expected,
    (message || '') + 
    '\n    actual = ' + actual +
    '\n    expected = ' + expected);
};

var log = function (message) {
  self.postMessage({type:'log', data:message});
};

