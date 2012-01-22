/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

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
          stroke: 'rgba(0,0,0,' + opacity + ')',
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

  var norms = this.norms = [];
  var circles = this.circles = [];

  var paper = this.paper = cachedPaper($('#phasesPlot'), width, height);

  paper.path(['M',0,height/2, 'L',width,height/2].join(' ')).attr({
        stroke: 'red'
      });

  var radiusScale = this.radiusScale;

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];

    var norm = norms[i] = grid.norm();

    var radius = radiusScale / norm;
    var r = radius * Math.min(width, height);

    var phase = grid.phaseAtTime(0);
    var angle = 2 * Math.PI * phase;
    var R = 127 * (1 + Math.cos(angle));
    var G = 127 * (1 + Math.cos(angle + 4/3 * Math.PI));
    var B = 127 * (1 + Math.cos(angle - 4/3 * Math.PI));

    circles[i] = paper.circle(0,0,r).attr({
          stroke: 'none',
          fill: ['rgba(',R,',',G,',',B,',0.333)'].join(''),
          title: '|' + grid + '| = ' + norm
        });
    //if (y < r) paper.circle(x, y + height, r).attr(attr);
    //if (height - r < y) paper.circle(x, y - height, r).attr(attr);
  }
};

PhasePlotter.prototype = {

  radiusScale: 0.05,

  realToUnit: function (x) {
    return Math.atan(Math.log(x)) / Math.PI + 0.5;
  },

  plot: function (time) {

    time = time || 0;

    assert(time >= 0, 'time is before zero: ' + time);

    var ball = this.ball;
    var width = this.width;
    var height = this.height;
    var realToUnit = this.realToUnit;
    var paper = this.paper;
    var circles = this.circles;

    for (var i = 0, I = ball.length; i < I; ++i) {
      var grid = ball[i];
      var circle = circles[i];

      var phase = (grid.phaseAtTime(time) + 0.5) % 1; // zero phase is at center

      var freq = grid.freq.toNumber();
      var freq01 = realToUnit(freq);

      var x = freq01 * width;
      var y = phase * height;

      circle.attr({cx: x, cy: y});
    }
  }
};

$(document).ready(function(){

  if (window.location.hash && window.location.hash.slice(1) === 'test') {
    test.runAll();
  }

  var radius = 10;

  var ball = RatGrid.ball(radius);
  var period = RatGrid.commonPeriod(ball);
  log('common period = ' + period);

  plotTrajectories(ball);

  //----------------------------------------------------------------------------
  // phase plotter

  var phasePlotter = new PhasePlotter(ball);

  window.phasePlotter = phasePlotter; // DEBUG

  var updateTask = undefined;
  var lastTime = undefined;
  var elapsedTime = 0;
  var update = function () {
    var now = Date.now();
    elapsedTime = (elapsedTime + (now - lastTime)) % (1000 * period);
    lastTime = now;

    phasePlotter.plot(elapsedTime / 1000);
    updateTask = setTimeout(update, 0);
  };

  var startUpdating = function () {
    lastTime = Date.now();
    update();
    log('starting animation');
  };
  var stopUpdating = function () {
    clearTimeout(updateTask);
    updateTask = undefined;
    log('stopping animation');
  };
  var toggleUpdating = function () {
    updateTask === undefined ? startUpdating() : stopUpdating();
  };

  $('#phasesPlot').click(toggleUpdating);

  startUpdating();
});

