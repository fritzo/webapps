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
  radius: 12,
  tempoHz: 1,

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

var plotTrajectories = function (ball) {

  var width = canvas.width;
  var height = canvas.height;

  var drawLine = function (x0, y0, x1, y1, opacity) {
    context.beginPath();
    context.moveTo(x0 * width, (1 - y0) * height);
    context.lineTo(x1 * width, (1 - y1) * height);
    context.strokeStyle = 'rgba(255,255,255,' + opacity + ')';
    context.stroke();
  };

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];

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
//   | |||| ||| | | |||| || ||   |  harmony on bottom
//   put a keyboard underneath  /
//
var PhasePlotter = function (ball, tempoHz, amps) {

  this.ball = ball;
  this.tempoHz = tempoHz;
  this.amps = amps;

  var freqs = this.freqs = ball.map(function(g){ return g.freq.toNumber(); });
  var bases = this.bases = ball.map(function(g){ return g.base.toNumber(); });

  var minFreq = Math.min.apply(Math, freqs);
  var radiusScale = this.radiusScale;

  var radii = this.radii = [];
  var xPos = this.xPos = [];
  var yPos = this.yPos = [];

  var twoPi = 2 * Math.PI;
  var realToUnit = this.realToUnit;

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];
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
    clock.onPause(function(timeMs){
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
var Synthesizer = function (ball, tempoHz, amps) {

  assertEqual(amps.length, ball.length, 'amplitude vector has wrong size');

  this.ball = ball;
  this.tempoHz = tempoHz;
  this.amps = amps;
  this.cyclesPerBeat = config.synth.cyclesPerBeat;

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
            log('Synth Worker Error: ' + data['data']);
            break;
        }
      }, false);
  this.synthworker.postMessage({
    'cmd': 'init',
    'data': {
        'tempoHz': tempoHz,
        'cyclesPerBeat': this.cyclesPerBeat,
        'freqs': ball.map(function(grid){ return grid.freq.toNumber(); }),
        'bases': ball.map(function(grid){ return grid.base.toNumber(); }),
        'gain': config.synth.gain
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
    clock.onPause(function(time){
          var meanTime = synth.profileElapsedMs
                       / synth.profileCount
                       / 1000;
          var speed = 1 / synthRateHz / meanTime;
          log( 'mean synth time = ' + meanTime.toFixed(3)
             + ' sec = ' + speed.toFixed(2) + 'x realtime');
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

    initPlotting();

    var ball = RatGrid.ball(config.radius);
    plotTrajectories(ball);

    return;
  }

  initPlotting();

  var ball = RatGrid.ball(config.radius);
  var period = RatGrid.commonPeriod(ball);
  log('using ' + ball.length + ' beat positions with common period ' + period);

  var clock = new Clock();

  var amps = new MassVector(ball.map(function(grid){ return 1/grid.norm(); }));
  amps.normalize();
  // TODO evolve these in time

  var phasePlotter = new PhasePlotter(ball, config.tempoHz, amps.likes);
  var synthesizer = new Synthesizer(ball, config.tempoHz, amps.likes);

  phasePlotter.start(clock);
  synthesizer.start(clock);

  var toggleRunning = function () { clock.toggleRunning(); };
  $('#phasesPlot').click(toggleRunning);
  $('canvas').click(toggleRunning);
});

