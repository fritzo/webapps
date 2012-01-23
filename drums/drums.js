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

  sampleRateHz: 22050,

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

    for (var i = 0, I = ball.length; i < I; ++i) {
      var grid = ball[i];
      var radius = radii[i] * minth;
      var phase = grid.phaseAtTime(time) % 1;

      var r = rPos[i];
      var a = 2 * Math.PI * phase;
      var x = (r * Math.sin(a) + 1) / 2 * minth + x0;
      var y = (r * Math.cos(a) + 1) / 2 * minth + y0;

      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fillStyle = colors[i];
      context.fill();
    }
  }
};

//------------------------------------------------------------------------------
// Audio

/** @constructor */
var Synthesizer = function (ball, tempoHz) {

  var periodSec = 1 / tempoHz;
  var sampleRateHz = config.sampleRateHz;
  var numSamples = Math.round(sampleRateHz * periodSec);

  this.ball = ball;
  this.tempoHz = tempoHz;
  this.tempo = tempoHz / sampleRateHz;
  this.encoder = new WavEncoder(numSamples, {sampleRateHz:sampleRateHz});
  this.samples = new Array(numSamples);

  // TODO start & initialize synth worker
};

Synthesizer.prototype = {
  envelope: function (phase) {
    return Math.max(1 - 8 * phase, 0);
  },
  synthesize: function (cycle, amps) {
    assertEqual(amps.length, this.ball.length,
        'amplitude vector has wrong size');

    var ball = this.ball;
    var encoder = this.encoder;
    var envelope = this.envelope;
    var samples = this.samples;
    var tempo = this.tempo;

    var T = encoder.numSamples;
    var I = ball.length;

    // TODO sort & clip ball WRT amp

    for (var t = 0; t < T; ++t) {
      samples[t] = 0;
    }

    for (var i = 0; i < I; ++i) {
      var amp = amps[i];
      if (!(amp > 0)) continue;

      var grid = ball[i];
      var phase = grid.phaseAtTime(cycle);
      var dphase = grid.freq.toNumber() * tempo;

      for (var t = 0; t < T; ++t, phase += dphase) {
        var env = envelope(phase % 1);
        if (!(env > 0)) continue;
        samples[t] += amp * env;
      }
    }
 
    var random = Math.random;
    for (var t = 0; t < T; ++t) {
      samples[t] *= (2 * random() - 1);
    }

    return encoder.encode(samples);
  },
};

//------------------------------------------------------------------------------
// Main

$(document).ready(function(){

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

  var amps = new MassVector(ball.map(function(grid){ return 1/grid.norm(); }));
  amps.normalize();

  var synthesizer = new Synthesizer(ball, config.tempoHz);
  var audio = new Audio(synthesizer.synthesize(0, amps.likes));
  clock.discretelyDo(function(cycle){
        audio.play(); // TODO move to message event lister
        audio = new Audio(synthesizer.synthesize(cycle+1, amps.likes));
      }, 1 / tempoKhz);

  $('#phasesPlot').click(function(){ clock.toggleRunning(); });
  $('canvas').click(function(){ clock.toggleRunning(); });
});

