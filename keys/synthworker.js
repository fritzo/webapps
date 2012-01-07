
importScripts('wavencoder.js');

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

//------------------------------------------------------------------------------
// Commands

var init = function (data) {
  self.gain = data.gain;
  self.freqs = data.freqs;
  self.centerFreq = self.freqs[(self.freqs.length - 1) / 2];
  self.numVoices = data.numVoices;
  self.F = self.freqs.length;
  self.T = data.windowSamples;
  self.wavEncoder = new WavEncoder(data.windowSamples);

  self.initialized = true;
};

var synthesize = function (mass) {
  assert(self.initialized, 'worker has not been initialized');
  assert(mass.length === self.freqs.length,
      'mass,freqs have different length');

  var freqs = self.freqs;
  var F = self.F;
  var T = self.T;

  var amps = [];
  var best = [];
  var normalizeEnvelope = 4 / ((T+1) * (T+1));
  var gain = self.gain * normalizeEnvelope * Math.sqrt(self.centerFreq);
  for (var f = 0; f < F; ++f) {
    amps[f] = gain * Math.sqrt(mass[f]);
    best[f] = f;
  }
  best.sort(function(i,j){ return amps[j] - amps[i]; });

  var G = self.numVoices;
  var bestAmps = [];
  var bestFreqs = [];
  for (var g = 0; g < G; ++g) {
    var f = best[g];
    bestAmps[g] = amps[f] / Math.sqrt(freqs[f]);
    bestFreqs[g] = freqs[f];
  }

  var samples = [];
  for (var t = 0; t < T; ++t) {
    var chord = 0;
    for (var g = 0; g < G; ++g) {
      chord += bestAmps[g] * Math.sin(bestFreqs[g] * t);
    }
    chord *= (t + 1) * (T - t); // envelope
    chord /= Math.sqrt(1 + chord * chord); // clip
    samples[t] = chord;
  }

  var uri = self.wavEncoder.encode(samples);
  self.postMessage({type:'wave', data:uri});
};

//------------------------------------------------------------------------------
// Main message handler

self.addEventListener('message', function (e) {
  try {
    var data = e.data;
    switch (data.cmd) {

      case 'init':
        init(data.data);
        break;

      case 'synthesize':
        synthesize(data.data);
        break;

      default:
        throw 'unknown command: ' + e.data.cmd;
    }
  }
  catch (err) {
    self.postMessage({type:'error', data:err.toString()});
  }
}, false);

