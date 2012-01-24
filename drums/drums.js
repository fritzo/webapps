/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

var config = {
  radius: 8,
  tempoHz: 1,

  innerRadius: 0.9,
  circleRadiusScale: 0.2,

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

var PhasePlotter = function (ball) {

  this.ball = ball;

  var freqs = ball.map(function(grid){
        return grid.freq.toNumber();
      });
  var minFreq = Math.min.apply(Math, freqs);
  var rPos = this.rPos = freqs.map(function(freq){
        return config.innerRadius * minFreq / freq;
      });
  var radii = this.radii = [];

  var norms = this.norms = [];
  var colors = this.colors = [];

  var radiusScale = this.radiusScale;

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];

    var norm = norms[i] = grid.norm();

    radii[i] = rPos[i] * radiusScale / norm;

    var phase = grid.phaseAtTime(0);
    var angle = 2 * Math.PI * phase;
    var R = Math.round(127.5 * (1 + Math.cos(angle)));
    var G = Math.round(127.5 * (1 + Math.cos(angle + 4/3 * Math.PI)));
    var B = Math.round(127.5 * (1 + Math.cos(angle - 4/3 * Math.PI)));
    colors[i] = ['rgba(',R,',',G,',',B,',0.5)'].join('');
  }
};

PhasePlotter.prototype = {

  radiusScale: config.circleRadiusScale,

  //realToUnit: function (x) {
  //  return Math.atan(Math.log(x)) / Math.PI + 0.5;
  //},

  plot: function (time) {

    time = time || 0;

    assert(time >= 0, 'time is before zero: ' + time);

    var width = canvas.width;
    var height = canvas.height;
    var minth = Math.min(width, height);
    var x0 = (width - minth) / 2;
    var y0 = (height - minth) / 2;

    var ball = this.ball;
    var rPos = this.rPos;
    var radii = this.radii
    var colors = this.colors;

    context.clearRect(0, 0, width, height);

    context.beginPath();
    context.moveTo(width/2, height/2);
    context.lineTo(width/2, height);
    context.strokeStyle = '#777';
    context.stroke();

    var twoPi = 2 * Math.PI;

    for (var i = 0, I = ball.length; i < I; ++i) {
      var grid = ball[i];
      var radius = radii[i] * minth;
      var phase = grid.phaseAtTime(time) % 1;

      var r = rPos[i];
      var a = twoPi * phase;
      var x = (r * Math.sin(a) + 1) / 2 * minth + x0;
      var y = (r * Math.cos(a) + 1) / 2 * minth + y0;

      context.beginPath();
      context.arc(x, y, radius, 0, twoPi, false);
      context.fillStyle = colors[i];
      context.fill();
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
        'bases': ball.map(function(grid){ return grid.base.toNumber(); })
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
      });
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

