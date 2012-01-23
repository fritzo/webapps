/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

var config = {
  radius: 10,
  tempoHz: 1,

  innerRadius: 0.9,
  circleRadiusScale: 0.2,

  none: undefined
}

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

  paper.path(['M',(width-1)/2,height/2, 'L',(width-1)/2,height].join(' '))
    .attr({stroke:'#777', 'stroke-width':1});
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

$(document).ready(function(){

  if (window.location.hash && window.location.hash.slice(1) === 'test') {
    test.runAll();
  }

  var ball = RatGrid.ball(config.radius);
  var period = RatGrid.commonPeriod(ball);
  log('common period = ' + period);

  plotTrajectories(ball);

  //----------------------------------------------------------------------------
  // phase plotter

  var phasePlotter = new PhasePlotter(ball);

  window.phasePlotter = phasePlotter; // DEBUG

  var tempo = config.tempoHz / 1000;

  var running = false;
  var updateTask = undefined;
  var lastTime = undefined;
  var elapsedTime = 0;
  var update = function () {
    if (!running) return;

    var now = Date.now();
    elapsedTime = (elapsedTime + (now - lastTime)) % (period / tempo);
    lastTime = now;

    phasePlotter.plot(elapsedTime * tempo);
    setTimeout(update, 0);
  };

  var startUpdating = function () {
    running = true;
    lastTime = Date.now();
    update();
    log('starting animation');
  };
  var stopUpdating = function () {
    running = false;
    log('stopping animation');
  };
  var toggleUpdating = function () {
    running ? stopUpdating() : startUpdating();
  };

  $('#phasesPlot').click(toggleUpdating);

  startUpdating();
});

