
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

//------------------------------------------------------------------------------
// Commands

var init = function (data) {
  self.freqs = data.freqs;
  self.F = self.freqs.length;
  self.T = data.windowSamples;

  self.initialized = true;
};

var synthesize = function (probs) {
  assert(self.initialized, 'worker has not been initialized');
  var freqs = self.freqs;
  var F = self.F;
  var T = self.T;

  var normalizeEnvelope = 4 / ((T+1) * (T+1));
  assert(probs.length === F, 'probs,freqs have different length');

  var amp = [];
  for (var f = 0; f < F; ++f) {
    amp[f] = normalizeEnvelope * Math.sqrt(probs[f])
           * Math.sqrt(freqs[0] / freqs[f]);
  }

  var samples = [];
  for (var t = 0; t < T; ++t) {
    var chord = 0;
    for (var f = 0; f < F; ++f) {
      chord += amp[f] * Math.sin(freqs[f] * t);
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

