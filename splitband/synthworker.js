/**
 * Spliband
 * http://fritzo.org/splitband
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
// Data

var tempoHz;
var pitchHz;
var sharpness;

var freqs;
var gridFreqs;
var gridBases;
var gain;
var cyclesPerBeat;
var tempo;
var omega;

var T;
var F;
var G;
var FG;

var wavEncoder;
var samples;

var profileCount = 0;
var profileElapsedMs = 0;
var initialized = false;
  
//------------------------------------------------------------------------------
// Methods

var init = function (data) {
  var profileStart = Date.now();

  tempoHz = data['tempoHz'];
  pitchHz = data['pitchHz'];
  sharpness = data['sharpness'];
  cyclesPerBeat = data['cyclesPerBeat'];
  gain = data['gain'];

  assert(tempoHz > 0, 'bad tempoHz : ' + tempoHz);
  assert(pitchHz > 0, 'bad pitchHz : ' + pitchHz);
  assert(cyclesPerBeat > 0, 'bad cyclesPerBeat: ' + cyclesPerBeat);
  assert(gain > 0, 'bad gain: ' + gain);

  tempo = tempoHz / WavEncoder.defaults.sampleRateHz;
  omega = 2 * Math.PI * pitchHz / WavEncoder.defaults.sampleRateHz;

  freqs = data['freqs'];
  gridFreqs = data['gridFreqs'];
  gridBases = data['gridBases'];

  assertEqual(gridFreqs.length, gridBases.length,
      'gridFreqs size is not same as gridBases');

  T = Math.round(1 / (tempo * cyclesPerBeat));
  F = freqs.length;
  G = gridFreqs.length;
  FG = F * G;

  wavEncoder = new WavEncoder(T);
  samples = new Array(T);

  initialized = true;
  log('initialized in ' + ((Date.now() - profileStart) / 1000) + ' sec');
};

var synthesize = function (data) {
  assert(initialized, 'worker has not been initialized');

  var amps = data['amps'];
  assertEqual(amps.length, FG, 'amps has wrong length');

  var cycle = data['cycle'];
  assertEqual(cycle, Math.round(cycle), 'bad cycle number: ' + cycle);
  var beat = cycle / cyclesPerBeat;

  var sustain = Math.exp(-sharpness);
  var sqrt = Math.sqrt;
  var max = Math.max;
  var sin = Math.sin;
  var pow = Math.pow;

  // TODO sort & clip ball WRT amp

  for (var t = 0; t < T; ++t) {
    samples[t] = 0;
  }

  for (var g = 0; g < G; ++g) {
    var gridFreq = gridFreqs[f];
    var gridBase = gridBases[f];
    var phase = (gridFreq * beat + gridBase) % 1;
    var dphase = gridFreq * tempo;

    for (var f = 0; f < F; ++f) {
      var fg = G * f + g;

      var amp = sqrt(amps[fg]) * gain;
      if (!(amp > 0)) continue; // TODO set a threshold

      var freq = omega * freqs[f];

      for (var t = 0; t < T; ++t) {
        var envelope = pow(sustain, phase);
        if (envelope > 0) {
          samples[t] += amp * envelope * sin(omega * t);
        }
        phase = (phase + dphase) % 1;
      }
    }
  }

  return wavEncoder.encode(samples);
};

//------------------------------------------------------------------------------
// Message handler

addEventListener('message', function (e) {
  try {
    var data = e['data'];
    switch (data['cmd']) {

      case 'init':
        init(data['data']);
        break;

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

