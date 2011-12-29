
importScripts('riffwave.js');

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

var log = function (message) {
  self.postMessage({type:'log', data:message});
};

//------------------------------------------------------------------------------
// Commands

var init = function (data) {
  self.gain = data.gain;
  self.freqs = data.freqs;
  self.F = self.freqs.length;
  self.T = data.windowSamples;

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
  var normalizeEnvelope = 4 / ((T+1) * (T+1));
  var gain = self.gain * normalizeEnvelope * Math.sqrt(freqs[0]);
  for (var f = 0; f < F; ++f) {
    amps[f] = gain * Math.sqrt(mass[f] / freqs[f]);
  }

  var G = 0;
  var ampsG = [];
  var freqsG = [];
  var ampThresh = 1e-2 * Math.max.apply(Math, amps);
  for (var f = 0; f < F; ++f) {
    var amp = amps[f];
    if (amp > ampThresh) {
      ampsG[G] = amp;
      freqsG[G] = freqs[f];
      ++G;
    }
  }
  //log('using top ' + G + ' frequencies');

  var samples = [];
  for (var t = 0; t < T; ++t) {
    var chord = 0;
    for (var g = 0; g < G; ++g) {
      chord += ampsG[g] * Math.sin(freqsG[g] * t);
    }
    chord *= (t + 1) * (T - t); // envelope
    chord /= Math.sqrt(1 + chord * chord); // clip
    samples[t] = Math.round(255/2 * (chord + 1)); // quantize
  }

  var wave = new RIFFWAVE(samples);
  self.postMessage({type:'wave', data:wave.dataURI});
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
});

