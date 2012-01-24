/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

importScripts('../common/workerlogger.js');
importScripts('../common/safety.js');
importScripts('../common/wavencoder.js');

var random = Math.random;

//------------------------------------------------------------------------------
// Commands

var init = function (data) {

  var tempoHz = data['tempoHz'];
  var middleCHz = 261.625565; // middle C

  self.tempo = tempoHz / WavEncoder.defaults.sampleRateHz;
  self.omega = 2 * Math.PI * middleCHz / tempoHz;
  self.freqs = data['freqs'];
  self.bases = data['bases'];

  assert(tempo > 0, 'bad tempo : ' + tempo);
  assertEqual(freqs.length, bases.length, 'freqs size is not same as bases');

  self.T = Math.round(1 / tempo);
  self.F = self.freqs.length;
  self.wavEncoder = new WavEncoder(self.T);
  self.samples = new Array(self.T);

  self.initialized = true;
};

var envelope = function (phase) {
  return Math.max(0, 1 - 12 * phase);
};

var synthesize = function (data) {
  assert(self.initialized, 'worker has not been initialized');

  var amps = data['amps'];
  assertEqual(amps.length, self.F, 'amps has wrong length');

  var cycle = data['cycle'];
  assertEqual(cycle, Math.round(cycle), 'bad cycle number: ' + cycle);

  var tempo = self.tempo;
  var omega = self.omega;
  var freqs = self.freqs;
  var bases = self.bases;
  var F = self.F;
  var T = self.T;
  var wavEncoder = self.wavEncoder;
  var samples = self.samples;

  var max = Math.max;
  var sin = Math.sin;

  // TODO sort & clip ball WRT amp

  for (var t = 0; t < T; ++t) {
    samples[t] = 0;
  }

  for (var f = 0; f < F; ++f) {
    var amp = Math.sqrt(amps[f]);
    if (!(amp > 0)) continue;

    var freq = freqs[f];
    var base = bases[f];

    var phase = (freq * cycle + base) % 1;
    var dphase = freq * tempo;

    for (var t = 0; t < T; ++t) {
      var envelope = max(0, 1 - 7 * phase);
      if (envelope > 0) {
        samples[t] += amp * envelope * sin(omega * phase);
      }
      phase = (phase + dphase) % 1;
    }
  }

  return self.wavEncoder.encode(samples);
};

//------------------------------------------------------------------------------
// Main message handler

self.addEventListener('message', function (e) {
  try {
    var data = e['data'];
    switch (data['cmd']) {

      case 'init':
        init(data['data']);
        break;

      case 'synthesize':
        var profileStartTime = Date.now();
        var uri = synthesize(data['data']);
        var profileElapsed = Date.now() - profileStartTime;
        self.postMessage({
              'type': 'wave',
              'data': uri,
              'profileElapsed': profileElapsed
            });
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    self.postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

