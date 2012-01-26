/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var config = {

  rhythm: {
    radius: 12,
    tempoHz: 1, // TODO allow real-time tempo control
    acuity: 2.5,
    driftRate: 1/4,
    sharpness: 4,
    updateRateHz: 50
  },

  plot: {
    framerateHz: 100,
    circleRadiusScale: 0.2
  },

  synth: {
    cyclesPerBeat: 4,
    gain: 1.0
  },

  none: undefined
};

//------------------------------------------------------------------------------
// Rhythm

/** @constructor */
var Rhythm = function () {

  this.acuity = config.rhythm.acuity;
  this.driftRate = config.rhythm.driftRate;
  this.sharpness = config.rhythm.sharpness;

  var grids = this.grids = RatGrid.ball(config.rhythm.radius);
  var period = RatGrid.commonPeriod(grids);
  log('using ' + grids.length + ' grids with common period ' + period);

  this.tempoHz = config.rhythm.tempoHz;
  this.minDelay = 1000 / config.rhythm.updateRateHz;

  assert(grids[0].freq.numer === 1
      && grids[0].freq.denom === 1
      && grids[0].base.numer === 0,
      'downbeat was not in expected position');
  this.amps = MassVector.degenerate(0, grids.length);

  this.damps = MassVector.zero(this.amps.likes.length);
};

Rhythm.prototype = {

  getGrids: function () { return this.grids; },
  getTempoHz: function () { return this.tempoHz; },
  getAmps: function () { return this.amps.likes; },

  addAmp: function (timeMs) {

    var time = timeMs / (1000 * this.tempoHz);
    var grids = this.grids;
    var damps = this.damps;
    var likes = damps.likes;
    var sharpness = this.sharpness;

    log('DEBUG phase = ' + (grids[0].phaseAtTime(time) % 1));

    for (var i = 0, I = likes.length; i < I; ++i) {
      var phase = grids[i].phaseAtTime(time);
      likes[i] = Math.pow(1 + Math.cos(2 * Math.PI * phase), sharpness);
    }
    damps.normalize();
  },

  start: function (clock) {

    var running = false;
    var lastTime = undefined;

    var rhythm = this;
    var amps = this.amps.likes;
    var damps = this.damps.likes;
    var minDelay = this.minDelay;

    var rhythmworker = new Worker('rhythmworker.js');
    var update = function () {
      if (running) {
        var time = Date.now();
        var dt = (time - lastTime) / 1000;
        lastTime = Date.now();
        rhythmworker.postMessage({
              'cmd': 'update',
              'data': {
                'dt': dt,
                'damps': rhythm.damps.likes
              }
            });
        for (var i = 0, I = damps.length; i < I; ++i) {
          damps[i] = 0;
        }
      }
    };
    rhythmworker.addEventListener('message', function (e) {
          var data = e['data'];
          switch (data['type']) {
            case 'update':
              newAmps = data['data'];
              for (var i = 0, I = amps.length; i < I; ++i) {
                amps[i] = newAmps[i];
              }
              if (running) setTimeout(update(), minDelay);
              break;

            case 'log':
              log('Rhythm Worker: ' + data['data']);
              break;

            case 'error':
              throw new WorkerException('Rhythm ' + data['data']);
          }
        }, false);
    rhythmworker.postMessage({
      'cmd': 'init',
      'data': {
          'acuity': this.acuity,
          'driftRate': this.driftRate,
          'amps': this.amps.likes,
          'gridArgs': this.grids.map(function(g){
                return [g.freq.numer, g.freq.denom, g.base.numer, g.base.denom];
              })
        }
      });

    clock.onStart(function(){
          running = true;
          lastTime = Date.now();
          update();
        });
    clock.onStop(function(){
          running = false;
          rhythmworker.postMessage({'cmd':'profile'});
        });
  }
};

//------------------------------------------------------------------------------
// Plotting

var canvas;
var context;
var initPlotting = function () {
  if (canvas !== undefined) return;

  canvas = document.getElementById('canvas');
  $(window).resize(function(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }).resize();

  context = canvas.getContext('2d');
};

var plotTrajectories = function (grids) {

  initPlotting();

  var width = canvas.width;
  var height = canvas.height;

  var drawLine = function (x0, y0, x1, y1, opacity) {
    context.beginPath();
    context.moveTo(x0 * width, (1 - y0) * height);
    context.lineTo(x1 * width, (1 - y1) * height);
    context.strokeStyle = 'rgba(255,255,255,' + opacity + ')';
    context.stroke();
  };

  for (var i = 0, I = grids.length; i < I; ++i) {
    var grid = grids[i];

    var norm = grid.norm();
    var opacity = Math.pow(1 / norm, 1);

    var freq = grid.freq;
    var base = grid.base;

    var x0 = 0;
    var y0 = base.toNumber();
    var x1 = 1;
    var y1 = y0 + freq.toNumber();

    while (y1 > 0) {
      drawLine(x0, y0, x1, y1, opacity);
      y0 -= 1;
      y1 -= 1;
    }
  }
};

// TODO switch from polar to cylindrical coordinates cut at the downbeat,
// visualizing the downbeat on either side:
//  
//   0    11 1 2 1 3 2 34    1
//   -    -- - - - - - --    -
//   1    54 3 5 2 5 3 45    1
//
//   o         . o .         o  \   <- higher tempo
//   )     o O o o o O o     (   |  rhythm on top
//   > . .Oo O O O O O oO. . <   |
//   o....oO.O.o.O.o.O.Oo....o   |  <- lower tempo
//                               |
//   | |||| ||| | | |||| || ||   |  rhythm on bottom
//   put a keyboard underneath  /
//

/** @constructor */
var PhasePlotter = function (grids, tempoHz, amps) {

  initPlotting();

  this.grids = grids;
  this.tempoHz = tempoHz;
  this.amps = amps;

  var freqs = this.freqs = grids.map(function(g){ return g.freq.toNumber(); });
  var bases = this.bases = grids.map(function(g){ return g.base.toNumber(); });

  var minFreq = Math.min.apply(Math, freqs);
  var radiusScale = this.radiusScale;

  var radii = this.radii = [];
  var xPos = this.xPos = [];
  var yPos = this.yPos = [];

  var twoPi = 2 * Math.PI;
  var realToUnit = this.realToUnit;

  for (var i = 0, I = grids.length; i < I; ++i) {
    var grid = grids[i];
    var freq = freqs[i];
    var base = bases[i];

    var norm = grid.norm();

    var rPos = 1 - realToUnit(freq);
    xPos[i] = (rPos * Math.sin(twoPi * base) + 1) / 2;
    yPos[i] = (rPos * Math.cos(twoPi * base) + 1) / 2;
    radii[i] = rPos * radiusScale / norm;
  }
};

PhasePlotter.prototype = {

  radiusScale: config.plot.circleRadiusScale,

  realToUnit: function (x) {
    return Math.atan(Math.log(x)) / Math.PI + 0.5;
  },

  plot: function (time) {

    time = time || 0;

    assert(time >= 0, 'time is before zero: ' + time);

    var width = canvas.width;
    var height = canvas.height;
    var minth = Math.min(width, height);
    var x0 = (width - minth) / 2;
    var y0 = (height - minth) / 2;

    var amps = this.amps;
    var ampScale = 1 / Math.max.apply(Math, amps);
    var freqs = this.freqs;
    var bases = this.bases;
    var xPos = this.xPos;
    var yPos = this.yPos;
    var radii = this.radii;

    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,0.333)';

    var exp = Math.exp;
    var twoPi = 2 * Math.PI;

    for (var i = 0, I = freqs.length; i < I; ++i) {

      var freq = freqs[i];
      var phase = (freq * time + bases[i]) % 1;

      var opacity = ampScale * amps[i] * exp(-phase / freq);
      context.fillStyle = 'rgba(255,255,255,' + opacity + ')';

      var x = xPos[i] * minth + x0;
      var y = yPos[i] * minth + y0;
      var radius = radii[i] * minth * exp(-phase);

      context.beginPath();
      context.arc(x, y, radius, 0, twoPi, false);
      context.fill();
      context.stroke();
    }
  },

  start: function (clock, tempoKhz) {

    var tempoKhz = this.tempoHz / 1000;
    var phasePlotter = this;
    var frameCount = 1;

    phasePlotter.plot(0);

    clock.continuouslyDo(function(timeMs){
          phasePlotter.plot(timeMs * tempoKhz);
          frameCount += 1;
        }, 1000 / config.plot.framerateHz);
    clock.onStop(function(timeMs){
          var framerate = frameCount * 1000 / timeMs;
          log('plotting framerate = ' + framerate.toFixed(1) + ' Hz');
        });
    $(window).on('resize.phasePlotter', function () {
          phasePlotter.plot(clock.now() * tempoKhz);
          if (clock.running) frameCount += 1;
        });
  }
};

//------------------------------------------------------------------------------
// Audio

/** @constructor */
var Synthesizer = function (grids, tempoHz, amps) {

  assertEqual(amps.length, grids.length, 'amplitude vector has wrong size');

  this.grids = grids;
  this.tempoHz = tempoHz;
  this.amps = amps;
  this.cyclesPerBeat = config.synth.cyclesPerBeat;
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
        'tempoHz': this.tempoHz,
        'cyclesPerBeat': this.cyclesPerBeat,
        'freqs': grids.map(function(grid){ return grid.freq.toNumber(); }),
        'bases': grids.map(function(grid){ return grid.base.toNumber(); }),
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

  start: function (clock) {

    var synthRateHz = this.tempoHz * this.cyclesPerBeat;
    var periodMs = 1000 / synthRateHz;

    var synth = this;
    clock.onStop(function(time){
          synth.synthworker.postMessage({'cmd':'profile'})
        });
    clock.discretelyDo(function(cycle){
          if (synth.audio) {
            synth.audio.play();          // play current cycle
            synth.audio = undefined;
            synth.synthesize(cycle + 1); // start synthesizing next cycle
          } else {
            log('WARNING dropped audio cycle ' + cycle);
          }
        }, periodMs);

    this.synthesize(0, this.amps);
  }
};

//------------------------------------------------------------------------------
// Main

$(document).ready(function(){
  var initStartTime = Date.now();

  if (window.location.hash && window.location.hash.slice(1) === 'test') {
    test.runAll();

    var grids = RatGrid.ball(config.rhythm.radius);
    plotTrajectories(grids);

    return;
  }

  var rhythm = new Rhythm();
  var grids = rhythm.getGrids();
  var tempoHz = rhythm.getTempoHz();
  var amps = rhythm.getAmps();

  var phasePlotter = new PhasePlotter(grids, tempoHz, amps);
  var synthesizer = new Synthesizer(grids, tempoHz, amps);

  var clock = new Clock();
  rhythm.start(clock);
  phasePlotter.start(clock);
  synthesizer.start(clock);

  var toggleRunning = function () { clock.toggleRunning(); };
  $('#phasesPlot').click(toggleRunning);
  $('canvas').click(toggleRunning);

  $(window).on('keydown', function (e) {
        switch (e.which) {
          case 27: // escape
            toggleRunning();
            e.preventDefault();
            break;

          case 32: // spacebar
            if (clock.running) {
              var timeMs = Date.now() - clock.beginTime;
              rhythm.addAmp(timeMs);
            }
            e.preventDefault();
            break;
        }
      });
});

