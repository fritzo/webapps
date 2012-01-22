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
  } else {
    paper.clear();
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
        'M', Math.round(x0 * width), Math.round((1 - y0) * height),
        'L', Math.round(x1 * width), Math.round((1 - y1) * height)
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

    var x0 = base.toNumber();
    var y0 = 0;
    var x1 = x0 + freq.inv().toNumber();
    var y1 = 1;

    drawLine(x0, y0, x1, y1, attr);

    if (base.toNumber() < 1 / grid.freq.numer) {
      var N = freq.numer;
      for (var n = -1; x1 + n/N > 0; --n) {
        drawLine(x0 + n/N, y0, x1 + n/N, y1, attr);
      }
    }
  }
};

var plotPhases = function (ball, time, width, height, time) {

  time = time || 0;
  width = width || 640;
  height = height || width;

  assert(time >= 0, 'time is before zero: ' + time);

  var paper = cachedPaper($('#phasesPlot'), width, height);

  paper.path(['M',0,height/2, 'L',width,height/2].join(' ')).attr({
        stroke: 'red'
      });

  var realToUnit = function (x) {
    return Math.atan(Math.log(x)) / Math.PI + 0.5;
  };

  var radiusScale = 0.05;

  for (var i = 0, I = ball.length; i < I; ++i) {
    var grid = ball[i];

    var norm = grid.norm();
    var radius = radiusScale / norm;

    var phase = (grid.phaseAtTime(time) + 0.5) % 1; // zero phase is at center

    var freq = grid.freq.toNumber();
    var freq01 = realToUnit(freq);

    var r = radius * Math.min(width, height);
    var x = freq01 * width;
    var y = phase * height;

    var attr = {
          'stroke-width': 0,
          stroke: null,
          fill: 'rgba(0,0,0,0.333)',
          title: '|' + grid + '| = ' + norm
        };

    paper.circle(x, y, r).attr(attr);
    if (y < r) paper.circle(x, y + height, r).attr(attr);
    if (height - r < y) paper.circle(x, y - height, r).attr(attr);
  }
};

$(document).ready(function(){

  if (window.location.hash && window.location.hash.slice(1) === 'test') {
    test.runAll();
  }

  var radius = 10;

  var ball = RatGrid.ball(radius);

  plotTrajectories(ball);
  plotPhases(ball);
});

