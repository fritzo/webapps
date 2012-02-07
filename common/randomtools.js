/**
 * Random sampling functions.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

Math.randomStd = function () {
  var random = Math.random;
  return 2 * (random() + random() + random()) - 3;
};

test('Math.randomStd (statistical)', function () {
  var numSamples = 1e4;

  var sum_x = 0;
  var sum_xx = 0;
  for (var t = 0; t < numSamples; ++t) {
    var x = Math.randomStd();
    sum_x += x;
    sum_xx += x * x;
  }
  var mean = sum_x / numSamples;
  var variance = sum_xx / numSamples - mean * mean;
  var tol = 5 / Math.sqrt(numSamples);
  assert(-tol < mean && mean < tol, 'white noise mean is nonzero: ' + mean);
  assert(1 - tol < variance && variance < 1 + tol,
    'white noise variance is not unity: ' + variance);
});



