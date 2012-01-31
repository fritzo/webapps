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
var cyclesPerTactus;
var numVoices;
var tempo;
var omega;

var T;
var F;
var G;
var FG;

var bestIndices;
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
  cyclesPerTactus = data['cyclesPerTactus'];
  numVoices = data['numVoices'];
  gain = data['gain'];

  assert(tempoHz > 0, 'bad tempoHz : ' + tempoHz);
  assert(pitchHz > 0, 'bad pitchHz : ' + pitchHz);
  assert(cyclesPerTactus > 0, 'bad cyclesPerTactus: ' + cyclesPerTactus);
  assert(0 < numVoices, 'bad numVoices: ' + numVoices);
  assert(gain > 0, 'bad gain: ' + gain);

  tempo = tempoHz / WavEncoder.defaults.sampleRateHz;
  omega = 2 * Math.PI * pitchHz / WavEncoder.defaults.sampleRateHz;

  freqs = data['freqs'].map(function(f){ return omega * f; });
  gridFreqs = data['gridFreqs'];
  gridBases = data['gridBases'];

  assertEqual(gridFreqs.length, gridBases.length,
      'gridFreqs size is not same as gridBases');

  T = Math.round(1 / (tempo * cyclesPerTactus));
  F = freqs.length;
  G = gridFreqs.length;
  FG = F * G;

  assert(numVoices < FG, 'too many voices: ' + numVoices);

  bestIndices = new Array(FG);
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
  assert(cycle % 1 === 0, 'bad cycle number: ' + cycle);
  var tactus = cycle / cyclesPerTactus;

  var scaledGain = gain * freqs[0];
  var sustain = Math.exp(-sharpness);
  var sqrt = Math.sqrt;
  var max = Math.max;
  var sin = Math.sin;
  var pow = Math.pow;

  for (var fg = 0; fg < FG; ++fg) {
    bestIndices[fg] = fg;
  }
  bestIndices.sort(function(lhs,rhs){ return amps[rhs] - amps[lhs]; });
  assert(amps[bestIndices[0]] > amps[bestIndices[bestIndices.length-1]],
      'bestIndices is out of order');
  var ampThresh = Math.max(
      amps[bestIndices[numVoices]],
      amps[bestIndices[0]] / 10000);

  for (var t = 0; t < T; ++t) {
    samples[t] = 0;
  }

  var components = 0;
  for (var g = 0; g < G; ++g) {
    var gridFreq = gridFreqs[g];
    var gridBase = gridBases[g];
    var phase = (gridFreq * tactus + gridBase) % 1;
    var dphase = gridFreq * tempo;

    for (var f = 0; f < F; ++f) {

      var amp = amps[G * f + g];
      if (amp < ampThresh) continue;
      ++components;

      var freq = freqs[f];
      var scaledAmp = sqrt(amp) * scaledGain / freq;

      for (var t = 0; t < T; ++t) {
        samples[t] += scaledAmp * pow(sustain, phase) * sin(freq * t);
        phase = (phase + dphase) % 1;
      }
    }
  }
  //log('DEBUG synthesized ' + components + ' components');

  // TODO slightly window the sample to avoid clicks

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

