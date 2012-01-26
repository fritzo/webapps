/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

importScripts('../common/workerlogger.js');
importScripts('../common/safety.js');
importScripts('../common/wavencoder.js');

//------------------------------------------------------------------------------
// Commands

var init = function (data) {

  var tempoHz = data['tempoHz'];
  var middleCHz = 261.625565; // middle C
  self.cyclesPerBeat = data['cyclesPerBeat'];
  self.tempo = tempoHz / WavEncoder.defaults.sampleRateHz;
  self.omega = 2 * Math.PI * middleCHz / tempoHz;
  self.freqs = data['freqs'];
  self.bases = data['bases'];
  self.gain = data['gain'];

  assert(self.tempo > 0, 'bad tempo : ' + self.tempo);
  assertEqual(freqs.length, bases.length, 'freqs size is not same as bases');

  self.T = Math.round(1 / self.tempo / self.cyclesPerBeat);
  self.F = self.freqs.length;
  self.wavEncoder = new WavEncoder(self.T);
  self.samples = new Array(self.T);

  self.profileCount = 0;
  self.profileElapsedMs = 0;

  self.initialized = true;
};

var synthesize = function (data) {
  assert(self.initialized, 'worker has not been initialized');

  var amps = data['amps'];
  assertEqual(amps.length, self.F, 'amps has wrong length');

  var cycle = data['cycle'];
  assertEqual(cycle, Math.round(cycle), 'bad cycle number: ' + cycle);
  var beat = cycle / self.cyclesPerBeat;

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
    var amp = Math.sqrt(amps[f]) * self.gain;
    if (!(amp > 0)) continue;

    var freq = freqs[f];
    var base = bases[f];

    var phase = (freq * beat + base) % 1;
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
        self.profileCount += 1;
        self.profileElapsedMs += Date.now() - profileStartTime;
        self.postMessage({'type':'wave', 'data':uri});
        break;

      case 'profile':
        var meanTime = self.profileElapsedMs / self.profileCount / 1000;
        log('mean synthesis time = ' + meanTime.toFixed(3));
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    self.postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

