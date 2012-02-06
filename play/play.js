/**
 * Spliband
 * http://fritzo.org/play
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var config = {

  model: {

    //pitchRadius: Math.sqrt(24*24 + 1*1 + 1e-4), // barely including 1/24
    pitchRadius: Math.sqrt(16*16 + 1*1 + 1e-4), // barely including 1/16
    tempoRadius: Math.sqrt(8*8 + 1*1 + 1e-4),   // barely including 1/8 t + 0/1

    pitchHz: 261.625565, // middle C
    tempoHz: 1, // TODO allow real-time tempo control
    grooveSec: 10.0,

    //pitchAcuity: 3,
    pitchAcuity: 0.01, // DEBUG
    tempoAcuity: 2.5,
    sharpness: 8,

    framerateHz: 100,

    none: undefined
  },

  plotter: {
    framerateHz: 60,
    circleRadiusScale: 0.1
  },

  keyboard: {
    framerateHz: 60,
    keyThresh: 1e-4,
    cornerRadius: 1/3
  },

  synth: {
    cyclesPerTactus: 4,
    numVoices: 1024,
    gain: 4.0
  },

  none: undefined
};

//------------------------------------------------------------------------------
// Model

/** @constructor */
var Model = function () {

  this.pitchAcuity = config.model.pitchAcuity;
  this.tempoAcuity = config.model.tempoAcuity;
  this.sharpness = config.model.sharpness;

  var freqs = this.freqs = Rational.ball(config.model.pitchRadius);
  var grids = this.grids = RatGrid.ball(config.model.tempoRadius);
  log('using ' + freqs.length + ' freqs x ' + grids.length + ' grids');

  this.pitchHz = config.model.pitchHz;
  this.tempoHz = config.model.tempoHz;
  this.commonPeriod = RatGrid.commonPeriod(grids);
  log('  with common period = ' + this.commonPeriod);

  var fCenter = (freqs.length - 1) / 2;
  var gDownBeat = 0;
  assert(grids[0].freq.numer === 1
      && grids[0].freq.denom === 1
      && grids[0].base.numer === 0,
      'downbeat was not in expected position');
  var fgInitial = grids.length * fCenter + gDownBeat;
  this.amps = MassVector.degenerate(fgInitial, freqs.length * grids.length);

  this.prior = new MassVector(this.amps);
};

Model.prototype = {

  // TODO generalize to variable tempo:
  //   subtract lastTime, add lastCycle, and update at tempo changes
  convertMsToTactus: function (clockTimeMs) {
    assert(clockTimeMs >= 0,
        'expected nonnegative clock time, actual: ' +clockTimeMs);
    return (this.tempoHz * clockTimeMs / 1000) % this.commonPeriod;
  },

  getEnvelopeAtTactus: function (tactus) {
    assert(tactus >= 0, 'bad tactus: ' + tactus);
    var grids = this.grids;
    var G = grids.length;
    var envelope = new Array(G);
    var sharpness = this.sharpness;
    var sustain = Math.exp(-sharpness);
    var scale = 0.5 * sharpness / (1 - sustain);
    var pow = Math.pow;
    for (var g = 0; g < G; ++g) {
      var phase = grids[g].phaseAtTime(tactus) % 1; // slow
      envelope[g] = scale * pow(sustain, phase) * pow(sustain, 1 - phase);
    }
    return envelope;
  },

  getCartoonEnvelopeAtTactus: function (tactus) {
    assert(tactus >= 0, 'bad tactus: ' + tactus);
    var grids = this.grids;
    var G = grids.length;
    var envelope = new Array(G);
    for (var g = 0; g < G; ++g) {
      var phase = grids[g].phaseAtTime(tactus) % 1; // slow
      envelope[g] = 1 / (1 + 4 * phase * (1 - phase)); // in [1/2,1]
    }
    return envelope;
  },

  getFreqAmps: function (envelope) {
    var F = this.freqs.length;
    var G = this.grids.length;
    var result = new MassVector(F);
    var resultLikes = result.likes;
    var ampsLikes = this.amps.likes;
    if (envelope) {
      assertLength(envelope, G, 'envelope');
      for (var f = 0; f < F; ++f) {
        var sum = 0;
        for (var g = 0; g < G; ++g) {
          sum += envelope[g] * ampsLikes[G * f + g];
        }
        resultLikes[f] = sum;
      }
    } else {
      for (var f = 0; f < F; ++f) {
        var sum = 0;
        for (var g = 0; g < G; ++g) {
          sum += ampsLikes[G * f + g];
        }
        resultLikes[f] = sum;
      }
    }
    return result;
  },

  getFreqPrior: function (envelope) {
    var F = this.freqs.length;
    var G = this.grids.length;
    var result = new MassVector(F);
    var resultLikes = result.likes;
    var priorLikes = this.prior.likes;
    if (envelope) {
      assertLength(envelope, G, 'envelope');
      for (var f = 0; f < F; ++f) {
        var sum = 0;
        for (var g = 0; g < G; ++g) {
          sum += envelope[g] * priorLikes[G * f + g];
        }
        resultLikes[f] = sum;
      }
    } else {
      for (var f = 0; f < F; ++f) {
        var sum = 0;
        for (var g = 0; g < G; ++g) {
          sum += priorLikes[G * f + g];
        }
        resultLikes[f] = sum;
      }
    }
    return result;
  },

  getGridAmps: function () {
    var F = this.freqs.length;
    var G = this.grids.length;
    var result = new MassVector(G);
    var resultLikes = result.likes;
    var ampsLikes = this.amps.likes;
    for (var g = 0; g < G; ++g) {
      var sum = 0;
      for (var f = 0; f < F; ++f) {
        sum += ampsLikes[G * f + g];
      }
      resultLikes[g] = sum;
    }
    return result;
  },

  getGridPrior: function () {
    var F = this.freqs.length;
    var G = this.grids.length;
    var result = new MassVector(G);
    var resultLikes = result.likes;
    var priorLikes = this.prior.likes;
    for (var g = 0; g < G; ++g) {
      var sum = 0;
      for (var f = 0; f < F; ++f) {
        sum += priorLikes[G * f + g];
      }
      resultLikes[g] = sum;
    }
    return result;
  },

  addAmpAtTime: function (timeMs, gain) {

    assert(timeMs >= 0, 'bad timeMs: ' + timeMs);

    var tactus = this.convertMsToTactus(timeMs);
    log('DEBUG phase = ' + (this.grids[0].phaseAtTime(tactus) % 1));

    var grids = this.grids;
    var prior = this.prior.likes;
    var F = this.freqs.length;
    var G = this.grids.length;
    var FG = F * G;

    var sustain = Math.exp(-this.sharpness);
    var pow = Math.pow;

    var damps = new Array(FG);
    var total = 0;
    for (var g = 0; g < G; ++g) {
      var phase = grids[g].phaseAtTime(tactus) % 1;
      var like = pow(sustain, phase) + pow(sustain, 1 - phase);
      for (var f = 0; f < F; ++f) {
        var fg = G * f + g;
        total += damps[fg] = prior[fg] * like;
      }
    }
    var scale = (gain || 1) / total;

    var likes = this.amps.likes;
    for (var fg = 0; fg < FG; ++fg) {
      likes[fg] += scale * damps[fg];
    }
  },

  addAmpAtTimeFreq: function (timeMs, freqIndex, gain) {

    assert(timeMs >= 0, 'bad timeMs: ' + timeMs);
    assert(0 <= freqIndex && freqIndex < this.freqs.length,
        'bad freq index: ' + freqIndex);

    var tactus = this.convertMsToTactus(timeMs);
    log('DEBUG phase = ' + (this.grids[0].phaseAtTime(tactus) % 1));

    var grids = this.grids;
    var prior = this.prior.likes;
    var F = this.freqs.length;
    var G = this.grids.length;
    var FG = F * G;

    var sustain = Math.exp(-this.sharpness);
    var pow = Math.pow;

    var damps = new Array(G);
    var total = 0;
    for (var g = 0; g < G; ++g) {
      var phase = grids[g].phaseAtTime(tactus) % 1;
      var like = pow(sustain, phase) + pow(sustain, 1 - phase);
      var fg = G * freqIndex + g;
      total += damps[g] = prior[fg] * like;
    }
    var scale = (gain || 1) / total;

    var likes = this.amps.likes;
    for (var g = 0; g < G; ++g) {
      var fg = G * freqIndex + g;
      likes[fg] += scale * damps[g];
    }
  },

  addAmpAtGrid: function (gridIndex, gain) {

    assert(0 <= gridIndex && gridIndex < this.grids.length,
        'bad grid index: ' + gridIndex);

    var prior = this.prior.likes;
    var F = this.freqs.length;
    var G = this.grids.length;
    var FG = F * G;

    var damps = new Array(F);
    var total = 0;
    for (var f = 0; f < F; ++f) {
      var fg = G * f + gridIndex;
      total += damps[f] = prior[fg];
    }
    var scale = (gain || 1) / total;

    var likes = this.amps.likes;
    for (var f = 0; f < F; ++f) {
      var fg = G * f + gridIndex;
      likes[fg] += scale * damps[f];
    }
  },

  updateAmps: function () {
  },

  start: function (clock) {

    this.clock = clock;

    var model = this;
    var grooveMs = config.model.grooveSec * 1000;
    var profileFrameCount = 0;

    // TODO update to allow very short modelworker cycles
    var modelworker = new Worker('modelworker.js');
    var updatePrior = function () {
      modelworker.postMessage({'cmd':'update', 'data':model.amps.likes});
    };
    modelworker.addEventListener('message', function (e) {
          var data = e['data'];
          switch (data['type']) {
            case 'update':
              var newPrior = data['data'];
              assertLength(newPrior, model.prior.likes.length, 'updated prior');
              model.prior.likes = newPrior;
              if (clock.running) updatePrior();
              break;

            case 'log':
              log('Model Worker: ' + data['data']);
              break;

            case 'error':
              throw new WorkerException('Model ' + data['data']);
          }
        }, false);
    modelworker.postMessage({
      'cmd': 'init',
      'data': {
          'pitchAcuity': this.pitchAcuity,
          'tempoAcuity': this.tempoAcuity,
          'sharpness': this.sharpness,
          'freqArgs': this.freqs.map(function(f){ return [f.numer, f.denom]; }),
          'gridArgs': this.grids.map(function(g){
                return [g.freq.numer, g.freq.denom, g.base.numer, g.base.denom];
              })
        }
      });

    clock.onStart(function (timeMs) {
          model.lastUpdateMs = timeMs;
          updatePrior();
        });
    clock.continuouslyDo(function (timeMs) {
          var timestepMs = timeMs - model.lastUpdateMs;
          model.lastUpdateMs = timeMs;
          var rate = 1 - Math.exp(-timestepMs / grooveMs);
          model.amps.shiftTowards(model.prior, rate);
          profileFrameCount += 1;
        }, 1000 / config.model.framerateHz);
    clock.onStop(function (timeMs) {
          var framerate = profileFrameCount * 1000 / timeMs;
          log('model framerate = ' + framerate.toFixed(1) + ' Hz');
          modelworker.postMessage({'cmd':'profile'});
        });
  },
};

//------------------------------------------------------------------------------
// Synthesis

/** @constructor */
var Synthesizer = function (model) {

  this.amps = model.amps.likes;

  this.cyclesPerTactus = config.synth.cyclesPerTactus;
  this.periodMs = 1000 / (model.tempoHz * this.cyclesPerTactus);
  assert(this.periodMs > 0, 'bad period: ' + this.periodMs);
  this.numVoices = config.synth.numVoices;
  this.gain = config.synth.gain;

  this.audio = undefined;
  this.profileCount = 0;
  this.profileElapsedMs = 0;

  var synth = this;
  this.synthworker = new Worker('synthworker.js');
  this.synthworker.addEventListener('message', function (e) {
        var data = e['data'];
        switch (data['type']) {
          case 'wave':
            synth.audio = new Audio(data['data']);
            synth.profileCount += 1;
            synth.profileElapsedMs += data['profileElapsedMs'];
            if (synth.readyCallback) {
              synth.readyCallback();
              synth.readyCallback = undefined;
            }
            break;

          case 'log':
            log('Synth Worker: ' + data['data']);
            break;

          case 'error':
            throw new WorkerException('Synth ' + data['data']);
        }
      }, false);
  this.synthworker.postMessage({
    'cmd': 'init',
    'data': {
        'pitchHz': model.pitchHz,
        'tempoHz': model.tempoHz,
        'sharpness': model.sharpness,
        'freqs': model.freqs.map(function(f){ return f.toNumber(); }),
        'gridFreqs': model.grids.map(function(g){ return g.freq.toNumber(); }),
        'gridBases': model.grids.map(function(g){ return g.base.toNumber(); }),
        'cyclesPerTactus': this.cyclesPerTactus,
        'numVoices': this.numVoices,
        'gain': this.gain
      }
    });
};

Synthesizer.prototype = {

  synthesize: function (cycle) {
    this.synthworker.postMessage({
          'cmd': 'synthesize',
          'data': {
            'amps': this.amps,
            'cycle': cycle
          }
        });
  },

  playOnset: function (freqIndex, gain) {
    log('TODO implement Synthesizer.playOnset('+freqIndex+','+gain+')');
  },

  ready: function (callback) {
    if (this.readyCallback === undefined) {
      this.readyCallback = callback;
    } else {
      var oldCallback = this.readyCallback;
      this.readyCallback = function () { oldCallback(); callback(); };
    }
  },

  start: function (clock) {

    // TODO XXX FIXME the clock seems to drift and lose alignment
    var synth = this;
    clock.onStop(function(){
          synth.synthworker.postMessage({'cmd':'profile'})
        });
    clock.discretelyDo(function (cycle) {
          if (synth.audio) {
            synth.audio.play();          // play current cycle
            synth.audio = undefined;
            synth.synthesize(cycle + 1); // start synthesizing next cycle
          } else {
            log('WARNING dropped audio cycle ' + cycle);
          }
        }, this.periodMs);

    this.synthesize(0, this.amps);
  }
};

//------------------------------------------------------------------------------
// Plotter

/** @constructor */
var Plotter = function (model) {

  this.model = model;

  var grids = model.grids;
  var freqs = this.freqs = grids.map(function(g){ return g.freq.toNumber(); });
  var bases = this.bases = grids.map(function(g){ return g.base.toNumber(); });

  var xPos = this.xPos = [];
  var yPos = this.yPos = [];
  var radii = this.radii = [];

  var minFreq = freqs.min();
  var maxFreq = freqs.max();
  var baseShift = 0.5 * minFreq;
  var freqShift = 0.5 / maxFreq;

  for (var i = 0, I = grids.length; i < I; ++i) {
    var freq = freqs[i];
    var base = bases[i];

    yPos[i] = (1 - base - baseShift - freqShift * freq) % 1;
    xPos[i] = Math.log(freq);
    radii[i] = 0;
  }
  var xPosMin = xPos.min();
  var xPosMax = xPos.max();
  var xScale = (1 - minFreq) / (xPosMax - xPosMin);
  var xShift = 0.5 * minFreq - xScale * xPosMin;
  for (var i = 0, I = grids.length; i < I; ++i) {
    xPos[i] = xShift + xScale * xPos[i];
  }

  Plotter.initCanvas();
};

Plotter.prototype = {

  updateGeometry: function (tactus) {

    tactus = tactus || 0;
    assert(tactus >= 0, 'tactus is before zero: ' + tactus);

    var envelope = this.model.getCartoonEnvelopeAtTactus(tactus);
    var amps = this.amps = this.model.getGridAmps().likes;
    var prior = this.prior = this.model.getGridPrior().likes;
    var ampsScale = 1 / amps.max();
    var priorScale = 1 / prior.max();
    for (var i = 0, I = amps.length; i < I; ++i) {
      amps[i] *= ampsScale;
      prior[i] *= priorScale;
    }

    var radii = this.radii;

    var radiusScale = config.plotter.circleRadiusScale;
    var sqrt = Math.sqrt;

    for (var i = 0, I = radii.length; i < I; ++i) {
      radii[i] = radiusScale * sqrt(prior[i]) * envelope[i];
    }

    this.sorted = prior.argsort();
    this.sorted.reverse();
  },

  draw: function () {

    var context = Plotter.context;
    var width = Plotter.canvas.width;
    var height = Plotter.canvas.height;
    var minth = Math.min(width, height);

    var amps = this.amps;
    var xPos = this.xPos;
    var yPos = this.yPos;
    var radii = this.radii;

    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,0.333)';

    var round = Math.round;
    var twoPi = 2 * Math.PI;

    var sorted = this.sorted;
    for (var s = 0, S = sorted.length; s < S; ++s) {
      var i = sorted[s];

      var lum = round(255 * amps[i]);
      context.fillStyle = 'rgb('+lum+','+lum+','+lum+')';

      var x = xPos[i] * width;
      var y = yPos[i] * height;
      var radius = radii[i] * minth;

      context.beginPath();
      context.arc(x, y, radius, 0, twoPi, false);
      context.fill();
      context.stroke();
    }
  },

  click: function (x01, y01) {
    var radii = this.radii;
    var xPos = this.xPos;
    var yPos = this.yPos;

    var bestDistance = 1/0;
    var bestIndex = undefined;
    for (var i = 0, I = radii.length; i < I; ++i) {

      var dx = xPos[i] - x01;
      var dy = yPos[i] - y01;
      var r = radii[i] + 1e-4;
      var distance = (dx * dx + dy * dy) / (r * r);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    log('DEBUG best index = ' + bestIndex);

    this.model.addAmpAtGrid(bestIndex);
  },

  start: function (clock) {

    this.clock = clock;

    this.updateGeometry(0);
    this.draw();
    var profileFrameCount = 1;

    var plotter = this;
    var model = this.model;
    var canvas = Plotter.canvas;

    clock.continuouslyDo(function (timeMs) {
          var tactus = model.convertMsToTactus(timeMs);
          plotter.updateGeometry(tactus);
          plotter.draw();
          profileFrameCount += 1;
        }, 1000 / config.plotter.framerateHz);
    clock.onStop(function (timeMs) {
          var framerate = profileFrameCount * 1000 / timeMs;
          log('plotter framerate = ' + framerate.toFixed(1) + ' Hz');
        });

    $(window).resize(function () {
          var timeMs = clock.now();
          var tactus = model.convertMsToTactus(timeMs);
          plotter.draw();
        });

    $(canvas).on('mouseup', function (e) {
          if (clock.running) {
            plotter.click(
                e.pageX / innerWidth,
                e.pageY / innerHeight);
          }
        });
  }
};

Plotter.initCanvas = function () {

  if (Plotter.canvas !== undefined) return;

  var canvas = Plotter.canvas = $('#canvas')[0];

  $(window).resize(function(){
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }).resize();

  Plotter.context = canvas.getContext('2d');
};

//------------------------------------------------------------------------------
// Main

var main = function () {

  var model = new Model();
  var synthesizer = new Synthesizer(model);
  var plotter = new Plotter(model);

  var clock = new Clock();
  model.start(clock);
  plotter.start(clock);
  synthesizer.start(clock);

  var toggleRunning = function () { clock.toggleRunning(); };

  $(window).on('keydown', function (e) {
        switch (e.which) {
          case 27: // escape
            toggleRunning();
            e.preventDefault();
            break;

          case 32: // spacebar
            if (clock.running) {
              var timeMs = Date.now() - clock.beginTime;
              model.addAmpAtTime(timeMs);
            }
            e.preventDefault();
            break;
        }
      });

  synthesizer.ready(toggleRunning);
};

$(function(){

  if (window.location.hash && window.location.hash.slice(1) === 'test') {

    document.title = 'Whence Music - Unit Test';
    test.runAll(function(){
          //window.location.hash = '';
          //document.title = 'Whence Music';
          main();
        });

  } else {

    main ();
  }
});

