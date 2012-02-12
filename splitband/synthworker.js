/**
 * Spliband
 * http://fritzo.org/splitband
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

importScripts('../common/safety.js');
importScripts('../common/wavencoder.js');

//------------------------------------------------------------------------------
// Data

var envelopeStride = 16;

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
var E;
var F;
var G;
var FG;

var bestIndices;
var envelopes;
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
  E = Math.ceil(T / envelopeStride);
  F = freqs.length;
  G = gridFreqs.length;
  FG = F * G;

  assert(numVoices < FG, 'too many voices: ' + numVoices);

  bestIndices = new Array(FG);
  envelopes = new Array(F);
  for (var f = 0; f < F; ++f) {
    envelopes[f] = new Array(E);
  }
  wavEncoder = new WavEncoder(T);
  samples = new Array(T);

  initialized = true;
  log('initialized in ' + ((Date.now() - profileStart) / 1000) + ' sec');
};

var synthesize = function (data) {
  assert(initialized, 'worker has not been initialized');

  var t,e,f,g,fg;

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

  for (fg = 0; fg < FG; ++fg) {
    bestIndices[fg] = fg;
  }
  bestIndices.sort(function(lhs,rhs){ return amps[rhs] - amps[lhs]; });
  assert(amps[bestIndices[0]] > amps[bestIndices[bestIndices.length-1]],
      'bestIndices is out of order');
  var ampThresh = Math.max(
      amps[bestIndices[numVoices]],
      amps[bestIndices[0]] / 10000);

  // Version 1. simple
  /*
  for (t = 0; t < T; ++t) {
    samples[t] = 0;
  }

  for (g = 0; g < G; ++g) {
    var gridFreq = gridFreqs[g];
    var gridBase = gridBases[g];
    var phase0 = (gridFreq * tactus + gridBase) % 1;
    var dphase = gridFreq * tempo;

    for (f = 0; f < F; ++f) {

      var amp = amps[G * f + g];
      if (amp < ampThresh) continue;

      var freq = freqs[f];
      var scaledAmp = sqrt(amp) * scaledGain / freq;

      var phase = phase0;
      for (t = 0; t < T; ++t) {
        samples[t] += scaledAmp * pow(sustain, phase) * sin(freq * t);
        phase = (phase + dphase) % 1;
      }
    }
  }
  */

  // Version 2. low-resolution envelopes + all-frequencies synthesis
  for (f = 0; f < F; ++f) {
    var envelope = envelopes[f];
    for (e = 0; e <= E; ++e) {
      envelope[e] = 0;
    }
  }

  for (g = 0; g < G; ++g) {
    var gridFreq = gridFreqs[g];
    var gridBase = gridBases[g];
    var phase0 = (gridFreq * tactus + gridBase) % 1;
    var dphase = gridFreq * tempo * envelopeStride;

    for (f = 0; f < F; ++f) {

      var amp = amps[G * f + g];
      if (amp < ampThresh) continue;

      var envelope = envelopes[f];
      var scaledAmp = sqrt(amp) * scaledGain / freqs[f];

      var phase = phase0;
      for (e = 0; e <= E; ++e) {
        envelope[e] += scaledAmp * pow(sustain, phase);
        phase = (phase + dphase) % 1;
      }
    }
  }

  for (t = 0; t < E * envelopeStride; ++t) {
    samples[t] = 0;
  }

  var envelope;
  var envelope0;
  var denvelope;
  var angle;
  for (f = 0; f < F; ++f) {
    var freq = freqs[f];
    envelope = envelopes[f];
    envelope1 = envelope[0];
    for (e = 0; e < E; ++e) {
      envelope0 = envelope[e];
      denvelope = (envelope[e+1] - envelope0) / envelopeStride;
      t = e * envelopeStride;
      angle = freq * t;

      samples[t +  0] += sin(angle) * envelope0;
      samples[t +  1] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  2] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  3] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  4] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  5] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  6] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  7] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  8] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t +  9] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t + 10] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t + 11] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t + 12] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t + 13] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t + 14] += sin(angle += freq) * (envelope0 += denvelope);
      samples[t + 15] += sin(angle += freq) * (envelope0 += denvelope);
    }
  }
  samples.length = T;

  // window & soft clip
  var windowRate = 100;
  for (t = 0; t < T; ++t) {
    var s = (t + 0.5) / T;
    var x = samples[t];
    samples[t] = x / (1 + x * x + windowRate / (t+1) + windowRate / (T-t));
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

