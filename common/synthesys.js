/**
 * Basic additive audio synthesis.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

/** @constructor */
var Synthesizer = function (wavEncoder) {

  this.wavEncoder = wavEncoder;
  var numSamples = this.numSamples = wavEncoder.numSamples;
  this.sampleRateHz = wavEncoder.sampleRateHz;

  var whiteNoise1 = this.whiteNoise = this.whiteNoise1 = new Array(numSamples);
  var whiteNoise2 = this.whiteNoise2 = new Array(numSamples);
  var random = Math.random;
  var whiteNoise = function () {
    return 2 * (random() + random() + random()) - 3; // approximately white
  };
  for (var t = 0; t < numSamples; ++t) {
    whiteNoise1[t] = whiteNoise();
    whiteNoise2[t] = whiteNoise();
  }
};

Synthesizer.prototype = {
  noiseBand: function (freqHz, relBandwidth, samples) {
    assert(freqHz > 0, 'bad freqHz: ' + freqHz);
    assert(relBandwidth > 0, 'bad relBandwidth: ' + relBandwidth);
    assertLength(samples, this.numSamples, 'samples');

    var omega = 2 * Math.PI * freqHz / this.sampleRateHz;
    var cosOmega = Math.cos(omega);
    var sinOmega = Math.sin(omega);
    var decay = Math.exp(-freqHz / (this.sampleRateHz * relBandwidth));
    var transReal = decay * cosOmega;
    var transImag = decay * sinOmega;
    var normalize = 1 - decay; // yielding unit variance

    var xRandom = this.whiteNoise1;
    var yRandom = this.whiteNoise2;
    var x = 0;
    var y = 0;

    TODO('set samples[0]');
    for (var t = 1, T = numSamples; t < T; ++t) {
      var x0 = x;
      var y0 = y;
      x = transReal * x0 - transImag * y0 + xRandom[t];
      y = transReal * y0 + transImag * x0 + yRandom[t];
      samples[t] = normalize * x;
    }
  }
};

//test('Synthesizer.whiteNoise (statistical)',
(
function () {
  var numSamples = 1e4;
  var wavEncoder = new WavEncoder(numSamples);
  var synthesizer = new Synthesizer(wavEncoder);

  var sum_x = 0;
  var sum_xx = 0;
  var whiteNoise = synthesizer.whiteNoise;
  for (var t = 0; t < numSamples; ++t) {
    var x = whiteNoise[t];
    sum_x += x;
    sum_xx += x * x;
  }
  var mean = sum_x / numSamples;
  var variance = sum_xx / numSamples - mean * mean;
  var tol = 5 / Math.sqrt(numSamples);
  assert(-tol < mean && mean < tol, 'white noise mean is nonzero: ' + mean);
  assert(1 - tol < variance && variance < 1 + tol,
    'white noise variance is not unity: ' + variance);
}
)();
//);

