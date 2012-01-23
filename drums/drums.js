/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

var config = {
  radius: 12,
  tempoHz: 1,

  innerRadius: 0.9,
  circleRadiusScale: 0.2,

  none: undefined
};

if (window.Raphael) { //--------------------------------------------------------
log('using raphael.js for polotting');

//------------------------------------------------------------------------------
// Plotting
var cachedPaper = function ($container, width, height) {

  var paper = $container.data('paper');

  if (paper === undefined) {
    $container.css({width: width, height: height});
    paper = new Raphael($container[0], width, height);
    $container.data('paper', paper);
  }

  if (paper.width !== width || paper.height !== height) {
    paper.setSize(width, height);
  }

  return paper;
};

var plotTrajectories = function (ball, width, height) {

  width = width || 640;
  height = height || width;

  var paper = cachedPaper($('#trajectoriesPlot'), width, height);

  var drawLine = function (x0, y0, x1, y1, attr) {
    var path = paper.path([
        'M', x0 * width, (1 - y0) * height,
        'L', x1 * width, (1 - y1) * height
        ].join(' '));
    path.attr(attr);
  };

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];

    var norm = grid.norm();
    var opacity = Math.pow(1 / norm, 1);
    var attr = {
          stroke: 'rgba(255,255,255,' + opacity + ')',
          'stroke-width': 2,
          title: '|' + grid + '| = ' + norm
        };

    var freq = grid.freq;
    var base = grid.base;

    var x0 = 0;
    var y0 = base.toNumber();
    var x1 = 1;
    var y1 = y0 + freq.toNumber();

    while (y1 > 0) {
      drawLine(x0, y0, x1, y1, attr);
      y0 -= 1;
      y1 -= 1;
    }
  }
};

//------------------------------------------------------------------------------
// Phase plotter

/** @constructor */
var PhasePlotter = function (ball, width, height) {

  this.ball = ball;
  this.width = width = width || 640;
  this.height = height = height || width;

  var freqs = ball.map(function(grid){
        return grid.freq.toNumber();
      });
  var minFreq = Math.min.apply(Math, freqs);
  var rPos = this.rPos = freqs.map(function(freq){
        return config.innerRadius * minFreq / freq;
      });

  var norms = this.norms = [];
  var circles = this.circles = [];

  var paper = this.paper = cachedPaper($('#phasesPlot'), width, height);

  paper.path(['M',(width-1)/2,height/2, 'L',(width-1)/2,height].join(' '))
    .attr({stroke:'#777', 'stroke-width':1});

  var radiusScale = this.radiusScale;

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];

    var norm = norms[i] = grid.norm();

    var radius = rPos[i] * radiusScale / norm * Math.min(width, height);

    var phase = grid.phaseAtTime(0);
    var angle = 2 * Math.PI * phase;
    var R = 127 * (1 + Math.cos(angle));
    var G = 127 * (1 + Math.cos(angle + 4/3 * Math.PI));
    var B = 127 * (1 + Math.cos(angle - 4/3 * Math.PI));

    circles[i] = paper.circle(0,0,radius).attr({
          stroke: 'none',
          fill: ['rgba(',R,',',G,',',B,',0.5)'].join(''),
          title: '|' + grid + '| = ' + norm
        });
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

    var ball = this.ball;
    var width = this.width;
    var height = this.height;
    var rPos = this.rPos;
    var paper = this.paper;
    var circles = this.circles;

    for (var i = 0, I = ball.length; i < I; ++i) {
      var grid = ball[i];
      var circle = circles[i];

      var phase = grid.phaseAtTime(time) % 1;

      var r = rPos[i];
      var a = 2 * Math.PI * phase;
      var x = (r * Math.sin(a) + 1) / 2 * width;
      var y = (r * Math.cos(a) + 1) / 2 * height;

      circle.attr({cx: x, cy: y});
    }
  }
};

} else { //---------------------------------------------------------------------
log('using HTML5 canvas for plotting');

var PhasePlotter = function (ball, width, height) {

  this.ball = ball;
  this.width = width = width || 640;
  this.height = height = height || width;

  var canvas = document.getElementById('canvas');
  canvas.width = width;
  canvas.height = height;
  var context = this.context = canvas.getContext('2d');

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

    radii[i] = rPos[i] * radiusScale / norm * Math.min(width, height);

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

    var ball = this.ball;
    var context = this.context;
    var width = this.width;
    var height = this.height;
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
      var radius = radii[i];
      var phase = grid.phaseAtTime(time) % 1;

      var r = rPos[i];
      var a = 2 * Math.PI * phase;
      var x = (r * Math.sin(a) + 1) / 2 * width;
      var y = (r * Math.cos(a) + 1) / 2 * height;

      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fillStyle = colors[i];
      context.fill();
    }
  }
};

} // Raphael -------------------------------------------------------------------

//------------------------------------------------------------------------------
// Audio

/** @constructor */
var Synthesizer = function (ball) {
  TODO();
};

Synthesizer.prototype = {
  synthesize: function (cycle) {
    if (!this.running) return;
    if (this.audio !== undefined) this.audio.play();

    TODO('do work here');

    var synth = this;
    setTimeout(function(){ synth.update(); }, TODO());
  },
};

//------------------------------------------------------------------------------
// Main

$(document).ready(function(){

  if (window.location.hash && window.location.hash.slice(1) === 'test') {
    test.runAll();
  }

  var ball = RatGrid.ball(config.radius);
  var period = RatGrid.commonPeriod(ball);
  log('common period = ' + period);

  // plotTrajectories(ball);

  var tempo = config.tempoHz / 1000;
  var clock = new Clock();

  var phasePlotter = new PhasePlotter(ball);
  phasePlotter.plot(0);
  var frameCount = 1;
  clock.continuouslyDo(function(time){
    phasePlotter.plot(time * tempo);
    frameCount += 1;
  });
  clock.onPause(function(time){
    log('plotting framerate = ' + (frameCount * 1000 / time) + ' Hz');
  });

  /* TODO
  var synthesizer = new Synthesizer(ball);
  var audio = synthesizer.synthesize(0);
  clock.discretelyDo(function(cycle){
    if (audio !== undefined) audio.play();
    audio = synthesizer.synthesize(cycle+1);
  }, 1 / tempo);
  */

  $('#phasesPlot').click(function(){ clock.toggleRunning(); });
  $('canvas').click(function(){ clock.toggleRunning(); });
});

