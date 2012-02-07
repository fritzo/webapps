/**
 * Whence Music?
 * http://whencemusic.net
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

importScripts('../common/safety.js');
importScripts('../common/wavencoder.js');

var whiteNoise1 = [];
var whiteNoise2 = [];
var whiteNoise = function () {
  var random = Math.random;
  return 2 * (random() + random() + random()) - 3;
};

var sampleRateKhz = 1000 * WavEncoder.defaults.sampleRateHz;
var samples = [];
  
//------------------------------------------------------------------------------
// Methods

var synthesize = function (data) {
  assert(initialized, 'worker has not been initialized');

  var gain = data['gain'];
  var durationMs = data['durationMs'];
  var freqKhz = data['freqKhz'];
  var relBandwidth = data['relBandwidth'];

  var numSamples = Math.floor(durationMs * sampleRateKhz);

  // generate & cache white noise as needed
  for (var i = whiteNoise1.length; i < numSamples; ++i) {
    whiteNoise1[i] = whiteNoise();
    whiteNoise2[i] = whiteNoise();
  }

  var omega = 2 * Math.PI * freqKhz / sampleRateKhz;
  var cosOmega = Math.cos(omega);
  var sinOmega = Math.sin(omega);
  var decay = Math.exp(-freqKhz / (sampleRateKhz * relBandwidth));
  var transReal = decay * cosOmega;
  var transImag = decay * sinOmega;
  var normalize = 1 - decay; // yielding unit variance
  gain *= normalize / numSamples;

  var sqrt = Math.sqrt;
  var xRandom = this.whiteNoise1;
  var yRandom = this.whiteNoise2;

  samples.length = numSamples;
  var x = 0;
  var y = 0;
  for (var t = 0, T = numSamples; t < T; ++t) {
    var x0 = x;
    var y0 = y;
    x = transReal * x0 - transImag * y0 + whiteNoise1[t];
    y = transReal * y0 + transImag * x0 + whiteNoise2[t];
    var s = x * gain * (T - t);
    samples[t] = s / sqrt(1 + s * s); // soft clip to [-1,1]
  }

  return WavEncoder.encode(samples);
};

//------------------------------------------------------------------------------
// Message handler

addEventListener('message', function (e) {
  try {
    var data = e['data'];
    switch (data['cmd']) {

      case 'synthesize':
        var profileStartTime = Date.now();
        var uri = synthesize(data['data']);
        profileCount += 1;
        profileElapsedMs += Date.now() - profileStartTime;
        postMessage({'type':'wave', 'data':uri});
        break;

      case 'profile':
        var meanTime = profileElapsedMs / (profileCount * 1000);
        log('mean synthesis time = ' + meanTime.toFixed(3));
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

