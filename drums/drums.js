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
    innerRadius: 0.9,
    circleRadiusScale: 0.2
  },

  synth: {
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

// TODO swap position,color indicating current,initial phase
var PhasePlotter = function (ball) {

  this.ball = ball;

  var freqs = this.freqs = ball.map(function(g){ return g.freq.toNumber(); });
  var bases = this.bases = ball.map(function(g){ return g.base.toNumber(); });

  var minFreq = Math.min.apply(Math, freqs);
  var innerRadius = config.plot.innerRadius;
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
    //var rPos = config.plot.innerRadius * Math.sqrt(minFreq / freq);
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

    var ball = this.ball;
    var freqs = this.freqs;
    var bases = this.bases;
    var xPos = this.xPos;
    var yPos = this.yPos;
    var radii = this.radii
    var colors = this.colors;

    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(255,255,255,0.333)';
    context.strokeStyle = 'rgba(255,255,255,0.333)';

    var cos = Math.cos;
    var exp = Math.exp;
    var pow = Math.pow;
    var sqrt = Math.sqrt;
    var round = Math.round;
    var twoPi = 2 * Math.PI;
    var twoThirdsPi = 2/3 * Math.PI;

    for (var i = 0, I = freqs.length; i < I; ++i) {

      var freq = freqs[i];
      var phase = (freq * time + bases[i]) % 1;

      //var angle = twoPi * phase;
      //var r = round(127.5 * (1 + cos(angle)));
      //var g = round(127.5 * (1 + cos(angle - twoThirdsPi)));
      //var b = round(127.5 * (1 + cos(angle + twoThirdsPi)));
      //var color = ['rgba(',r,',',g,',',b,',0.8)'].join('');
      //context.fillStyle = color;

      var opacity = 1 - phase / freq;
      var color = ['rgba(255,255,255,',opacity,')'].join('');
      context.fillStyle = color;

      var x = xPos[i] * minth + x0;
      var y = yPos[i] * minth + y0;
      var radius = radii[i] * minth * exp(-phase);

      context.beginPath();
      context.arc(x, y, radius, 0, twoPi, false);
      context.fill();
      context.stroke();
    }
  }
};

//------------------------------------------------------------------------------
// Audio

/** @constructor */
var Synthesizer = function (ball, tempoHz) {

  this.ball = ball;
  this.tempoHz = tempoHz;

  this.callback = undefined;

  this.profileCount = 0;
  this.profileElapsed = 0;

  var synth = this;
  this.synthworker = new Worker('synthworker.js');
  this.synthworker.addEventListener('message', function (e) {
        var data = e['data'];
        switch (data['type']) {
          case 'wave':
            assert(synth.callback, 'Synthesizer has no callback');
            synth.callback(data['data']);
            synth.callback = undefined;

            synth.profileCount += 1;
            synth.profileElapsed += data['profileElapsed'];
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
        'freqs': ball.map(function(grid){ return grid.freq.toNumber(); }),
        'bases': ball.map(function(grid){ return grid.base.toNumber(); }),
        'gain': config.synth.gain
      }
    });
};

Synthesizer.prototype = {
  synthesize: function (cycle, amps, callback) {
    assertEqual(amps.length, this.ball.length,
        'amplitude vector has wrong size');

    this.synthworker.postMessage({
          'cmd': 'synthesize',
          'data': {
            'amps': amps,
            'cycle': cycle
          }
        });

    assert(this.callback === undefined, 'Synthesizer has multiple callbacks');
    this.callback = callback;
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
  log('common period = ' + period);

  var tempoKhz = config.tempoHz / 1000;
  var clock = new Clock();

  var amps = new MassVector(ball.map(function(grid){ return 1/grid.norm(); }));
  amps.normalize();

  var phasePlotter = new PhasePlotter(ball);
  phasePlotter.plot(0);
  var frameCount = 1;
  clock.continuouslyDo(function(time){
        phasePlotter.plot(time * tempoKhz);
        frameCount += 1;
      }, 1000 / config.plot.framerateHz);
  clock.onPause(function(time){
        log('plotting framerate = ' + (frameCount * 1000 / time) + ' Hz');
      });
  $(window).on('resize.phasePlotter', function () {
        phasePlotter.plot(clock.now() * tempoKhz);
        if (clock.running) frameCount += 1;
      });

  var synthesizer = new Synthesizer(ball, config.tempoHz);
  var audio = undefined;
  var playing = undefined;
  var synthReady = true;
  var enqueue = function (uri) {
        audio = new Audio(uri);
        synthReady = true;
      };
  clock.onPause(function(time){
        var meanTime = synthesizer.profileElapsed
                     / synthesizer.profileCount
                     / 1000;
        log('mean synth time = ' + meanTime + ' sec');
      });
  clock.discretelyDo(function(cycle){
        audio.play();
        playing = audio;
        if (synthReady) {
          synthReady = false;
          synthesizer.synthesize(cycle+1, amps.likes, enqueue);
        }
      }, 1 / tempoKhz);
  var toggleRunning = function () {
    // pause-unpause behavior differ in chrome vs firefox
    //if (clock.running && playing) playing.pause();
    //if (!clock.running && playing) playing.play();
    clock.toggleRunning();
  };
  synthesizer.synthesize(0, amps.likes, function (uri) {
        enqueue(uri);

        $('#phasesPlot').click(toggleRunning);
        $('canvas').click(toggleRunning);

        var initElapsed = (Date.now() - initStartTime) / 1000;
        log('initialized in ' + initElapsed + ' sec');
      });
});

