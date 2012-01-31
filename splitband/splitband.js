/**
 * Spliband
 * http://fritzo.org/splitband
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var config = {

  model: {

    // We split the frequency spectrum into high (pitch) + low (tempo)
    //
    //    |<---- tempo --->| |<------------ Pitch ------------>|
    //   8sec      1     8Hz 11Hz           261Hz           6.28kHz
    //                       C/24             C              24 C

    pitchRadius: Math.sqrt(24*24 + 1*1 + 1e-4), // barely including 1/24
    tempoRadius: Math.sqrt(8*8 + 1*1 + 1e-4),   // barely including 1/8 t + 0/1

    pitchHz: 261.625565, // middle C
    tempoHz: 1, // TODO allow real-time tempo control
    grooveSec: 10.0,

    pitchAcuity: 3,
    tempoAcuity: 2.5,
    sharpness: 8,

    updateRateHz: 100,

    none: undefined
  },

  phasePlot: {
    framerateHz: 100,
    circleRadiusScale: 0.2,
    baseShift: 0.08
  },

  keyboard: {
    updateHz: 30,
    keyThresh: 1e-4,
    cornerRadius: 1/3
  },

  synth: {
    cyclesPerBeat: 4,
    numVoices: 64,
    gain: 1.0
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
  this.grooveSec = config.model.grooveSec;
  this.minDelay = 1000 / config.model.updateRateHz;

  var fCenter = (freqs.length - 1) / 2;
  var gDownBeat = 0;
  assert(grids[0].freq.numer === 1
      && grids[0].freq.denom === 1
      && grids[0].base.numer === 0,
      'downbeat was not in expected position');
  var fgInitial = grids.length * fCenter + gDownBeat;
  this.amps = MassVector.degenerate(fgInitial, freqs.length * grids.length);

  this.prior = new MassVector(this.amps);
  this.damps = MassVector.zero(this.amps.likes.length);
  this.tempDamps = MassVector.zero(this.amps.likes.length);
};

Model.prototype = {

  getFreqAmps: function () {
    var F = this.freqs.length;
    var G = this.grids.length;
    var result = new MassVector(F);
    var ampsLikes = this.amps.likes;
    var resultLikes = result.likes;
    for (var f = 0; f < F; ++f) {
      var sum = 0;
      for (var g = 0; g < G; ++g) {
        sum += ampsLikes[G * f + g];
      }
      resultLikes[f] = sum;
    }
    return result;
  },

  getFreqPrior: function () {
    var F = this.freqs.length;
    var G = this.grids.length;
    var result = new MassVector(F);
    var priorLikes = this.prior.likes;
    var resultLikes = result.likes;
    for (var f = 0; f < F; ++f) {
      var sum = 0;
      for (var g = 0; g < G; ++g) {
        sum += priorLikes[G * f + g];
      }
      resultLikes[f] = sum;
    }
    return result;
  },

  addAmpAtTime: function (timeMs) {

    assert(timeMs >= 0, 'bad timeMs: ' + timeMs);
    var time = timeMs / (1000 * this.tempoHz);
    var grids = this.grids;
    var prior = this.prior;
    var F = this.freqs.length;
    var G = this.grids.length;

    var sustain = Math.exp(-this.sharpness);
    var pow = Math.pow;

    log('DEBUG phase = ' + (grids[0].phaseAtTime(time) % 1));

    var likes = this.tempDamps.likes;
    for (var g = 0; g < G; ++g) {
      var phase = grids[g].phaseAtTime(time) % 1;
      var like = pow(sustain, phase) + pow(sustain, 1 - phase);
      for (var f = 0; f < F; ++f) {
        var fg = G * f + g;
        likes[fg] = prior[fg] * like;
      }
    }
    this.tempDamps.normalize();

    this.damps.iadd(this.tempDamps);
  },

  addAmpAtTimeFreq: function (timeMs, freqIndex) {
    TODO();
  },

  addAmpAtTimeGrid: function (timeMs, gridIndex) {
    TODO();
  },

  start: function (clock) {

    var running = false;
    var lastTime = undefined;

    var model = this;
    var amps = this.amps.likes;
    var prior = this.prior.likes;
    var damps = this.damps.likes;
    var minDelay = this.minDelay;

    var modelworker = new Worker('modelworker.js');
    var update = function () {
      if (running) {
        var time = Date.now();
        var timestepSec = (time - lastTime) / 1000;
        lastTime = Date.now();
        modelworker.postMessage({
              'cmd': 'update',
              'data': {
                'timestepSec': timestepSec,
                'damps': model.damps.likes
              }
            });
        for (var i = 0, I = damps.length; i < I; ++i) {
          damps[i] = 0;
        }
      }
    };
    modelworker.addEventListener('message', function (e) {
          var data = e['data'];
          switch (data['type']) {
            case 'update':
              newAmps = data['data']['amps'];
              newPrior = data['data']['prior'];
              assertLength(newAmps, amps.length, 'updated amps');
              assertLength(newPrior, prior.length, 'updated prior');
              for (var i = 0, I = amps.length; i < I; ++i) {
                amps[i] = newAmps[i];
                prior[i] = newPrior[i];
              }
              if (running) setTimeout(update(), minDelay);
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
          'grooveSec': this.grooveSec,
          'amps': this.amps.likes,
          'freqArgs': this.freqs.map(function(f){ return [f.numer, f.denom]; }),
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
          modelworker.postMessage({'cmd':'profile'});
        });
  },

  
};

//------------------------------------------------------------------------------
// Phase Plotting

/** @constructor */
var PhasePlotter = function (model) {

  var grids = this.grids = model.grids;
  this.tempoHz = model.tempoHz;
  this.sharpness = model.sharpness;
  this.fullAmps = model.amps.likes;
  this.gridAmps = new Array(grids.length);

  var freqs = this.freqs = grids.map(function(g){ return g.freq.toNumber(); });
  var bases = this.bases = grids.map(function(g){ return g.base.toNumber(); });

  var radii = this.radii = [];
  var xPos = this.xPos = [];
  var yPos = this.yPos = [];

  var minFreq = Math.min.apply(Math, this.freqs);
  var radiusScale = this.radiusScale;
  var baseShift = this.baseShift;

  var twoPi = 2 * Math.PI;
  var realToUnit = function (x) {
    return Math.atan(Math.log(x)) / Math.PI + 0.5;
  };

  for (var i = 0, I = this.grids.length; i < I; ++i) {
    var grid = grids[i];
    var freq = freqs[i];
    var base = bases[i];

    var norm = grid.norm();

    yPos[i] = 1 - realToUnit(freq);
    xPos[i] = (1 - base + baseShift) % 1;
    radii[i] = radiusScale / norm;
  }

  PhasePlotter.initCanvas();
};

PhasePlotter.prototype = {

  radiusScale: config.phasePlot.circleRadiusScale,
  baseShift: config.phasePlot.baseShift,

  projectAmps: function () {
    var fullAmps = this.fullAmps;
    var gridAmps = this.gridAmps;
    for (var fg = 0, FG = fullAmps.length, G = gridAmps.length; fg < FG; ++fg) {
      gridAmps[fg % G] = fullAmps[fg];
    }
  },

  plot: function (time) {

    time = time || 0;

    assert(time >= 0, 'time is before zero: ' + time);

    var context = PhasePlotter.context;
    var width = PhasePlotter.canvas.width;
    var height = PhasePlotter.canvas.height;
    var minth = Math.min(width, height);
    var x0 = width / 2;
    var y0 = height / 2;

    var gridAmps = this.gridAmps;
    var ampScale = 1 / Math.max.apply(Math, gridAmps);
    var freqs = this.freqs;
    var bases = this.bases;
    var xPos = this.xPos;
    var yPos = this.yPos;
    var radii = this.radii;

    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,0.15)';

    var exp = Math.exp;
    var cos = Math.cos;
    var pow = Math.pow;
    var twoPi = 2 * Math.PI;
    var round = Math.round;

    for (var i = 0, I = freqs.length; i < I; ++i) {

      var freq = freqs[i];
      var phase = (freq * time + bases[i]) % 1;
      var pulsate = 1 / (1 + 4 * phase * (1 - phase)); // in [1/2,1]

      var rgb = round(255 * ampScale * gridAmps[i]);
      context.fillStyle = 'rgb('+rgb+','+rgb+','+rgb+')';

      var x = xPos[i] * width;
      var y = yPos[i] * height;
      var radius = radii[i] * minth * pulsate;

      context.beginPath();
      context.arc(x, y, radius, 0, twoPi, false);
      context.fill();
      context.stroke();
    }
  },

  start: function (clock, tempoKhz) {

    var tempoKhz = this.tempoHz / 1000;
    var phasePlotter = this;
    var profileFrameCount = 1;

    phasePlotter.plot(0);

    // TODO reimplement for variable tempo
    clock.continuouslyDo(function(timeMs){
          phasePlotter.projectAmps();
          phasePlotter.plot(timeMs * tempoKhz);
          profileFrameCount += 1;
        }, 1000 / config.phasePlot.framerateHz);
    clock.onStop(function(timeMs){
          var framerate = profileFrameCount * 1000 / timeMs;
          log('plotting framerate = ' + framerate.toFixed(1) + ' Hz');
        });
    $(window).on('resize.phasePlotter', function () {
          phasePlotter.plot(clock.now() * tempoKhz);
          if (clock.running) profileFrameCount += 1;
        });
  }
};

PhasePlotter.initCanvas = function () {

  if (PhasePlotter.canvas !== undefined) return;

  var canvas = PhasePlotter.canvas = $('<canvas>').css({
        'position': 'fixed',
        'width': '100%',
        'height': '50%',
        'left': '0%',
        'top': '0%'
      }).appendTo(document.body)[0];

  $(window).resize(function(){
        canvas.width = innerWidth;
        canvas.height = innerHeight / 2;
      }).resize();

  PhasePlotter.context = canvas.getContext('2d');
};

//------------------------------------------------------------------------------
// Keyboard

/** @constructor */
var Keyboard = function (model, synthesizer) {

  var mockSynthesizer = {playOnset : function(){}};

  this.model = model;
  this.synthesizer = synthesizer || mockSynthesizer;
  this.delayMs = 1000 / config.keyboard.updateHz;

  Keyboard.initCanvas();

  this.running = false;
};

Keyboard.prototype = {

  start: function (clock) {

    this.clock = clock;
    TODO('update to use a clock');

    if (this.running) return;
    this.running = true;

    this.profileTime = Date.now();
    this.profileCount = 0;

    this.updateTask = undefined;
    this.update();

    var keyboard = this;
    $(window).off('resize.keyboard').on('resize.keyboard', function () {
          keyboard.updateGeometry(); // used by .draw() and .click()
          keyboard.draw();
        });

    var $canvas = $(Keyboard.canvas);

    var move = function (e) {
      keyboard.swipeX1 = e.pageX / innerWidth;
      keyboard.swipeY1 = e.pageY / innerHeight;
    };

    $canvas.on('mousedown.keyboard', function (e) {
          keyboard._swiped = false;
          keyboard.swipeX0 = keyboard.swipeX1 = e.pageX / innerWidth;
          keyboard.swipeY0 = keyboard.swipeY1 = e.pageY / innerHeight;
          $canvas.off('mousemove.keyboard').on('mousemove.keyboard', move);
          e.preventDefault(); // avoid selecting buttons
        });
    $canvas.on('mouseover.keyboard', function (e) {
          if (e.which) {
            keyboard._swiped = false;
            keyboard.swipeX0 = keyboard.swipeX1 = e.pageX / innerWidth;
            keyboard.swipeY0 = keyboard.swipeY1 = e.pageY / innerHeight;
            $canvas.off('mousemove.keyboard').on('mousemove.keyboard', move);
          }
          e.preventDefault(); // avoid selecting buttons
        });
    $canvas.on('mouseup.keyboard', function (e) {
          $canvas.off('mousemove.keyboard');
          if (!keyboard._swiped) {
            keyboard.click(
                e.pageX / innerWidth,
                e.pageY / innerHeight);
          }
          keyboard._swiped = true;
          e.preventDefault(); // avoid selecting buttons
        });
    $canvas.on('mouseout.keyboard', function (e) {
          $canvas.off('mousemove.keyboard');
          e.preventDefault(); // avoid selecting buttons
        });
  },

  stop: function () {
    this.running = false;
    if (this.updateTask !== undefined) {
      clearTimeout(this.updateTask);
      this.updateTask = undefined;
    }

    if (!testing) {
      var profileRate =
        this.profileCount * 1e3 / (Date.now() - this.profileTime);
      log('Keyboard update rate = ' + profileRate + ' Hz');
    }

    var $canvas = $(Keyboard.canvas);
    $canvas.off('mousedown.keyboard');
    $canvas.off('mousemove.keyboard');
    $canvas.on('mouseup.keyboard');
    $canvas.off('mouseout.keyboard');
  },

  update: function () {
    this.updateSwipe();
    this.updateGeometry();
    this.draw();

    if (this.running) {
      var keyboard = this;
      this.updateTask = setTimeout(function(){
            keyboard.updateTask = undefined;
            keyboard.update();
          }, this.delayMs);
    }

    this.profileCount += 1;
  },

  onclick: function (index) {
    var gain = config.synth.clickGain;
    this.synthesizer.playOnset(index, gain);
    this.model.addAmpAtTimeFreq(this.clock.now(), index, gain);
  },
  onswipe: function (indices) {
    this._swiped = true;
    var gain = config.synth.swipeGain;
    for (var i = 0, I = indices.length; i < I; ++i) {
      var index = indices[i];
      this.synthesizer.playOnset(index, gain); // works poorly in firefox
      this.model.addAmpAtTimeFreq(this.clock.now(), index, gain);
    }
  },

  updateGeometry: function () {
    var keyThresh = config.keyboard.keyThresh;

    var X = this.model.freqs.length;
    var Y = Math.floor(2 + Math.sqrt(innerHeight + innerWidth));

    var probs = this.model.getFreqPrior();
    var keys = probs.truncate(keyThresh);
    var K = keys.length;
    if (testing) {
      assert(probs.likes.length === keys.length, 'probs,keys length mismatch');
      for (var k = 0; k < K; ++k) {
        assert(0 <= probs.likes[k],
            'bad prob: probs.likes[' + k + '] = ' + probs.likes[k]);
      }
    }

    var ypos = probs.likes.map(function(p){
          return Math.log(p + keyThresh);
        });
    var ymin = Math.log(keyThresh);
    var ymax = Math.max.apply(Math, ypos); // TODO use soft max
    ypos = ypos.map(function(y){ return (y - ymin) / (ymax - ymin); });
    if (testing) {
      for (var k = 0; k < K; ++k) {
        assert(0 <= ypos[k] && ypos[k] <= 1,
            'bad y position: ypos[' + k + '] = ' + ypos[k]);
      }
    }

    var radii = ypos.map(function(y){ return 1 - Math.pow(1 - y, 3); });

    // Pass 1: hard constrain to left
    var xposLeft = [];
    var xmaxLeft = 0;
    for (var k = 0; k < K; ++k) {
      var r = radii[k];
      var x = r;
      var y = ypos[k];

      for (var k2 = 0; k2 < k; ++k2) {
        var r2 = radii[k2];
        var x2 = xposLeft[k2];
        var y2 = ypos[k2];

        //var padding = y2 < y ? r2 + r * Math.pow(y2 / y, 2)
        //                     : r2 * Math.pow(y / y2, 2) + r;
        var padding = (r2 + r) * Math.pow(2 / (y2 / y + y / y2), 8);
        x = Math.max(x, x2 + padding);
      }

      xposLeft[k] = x;
      xmaxLeft = Math.max(xmaxLeft, x + r);
    }

    // Pass 2: hard constrain to right
    var xposRight = [];
    var xmaxRight = 0;
    for (var k = K-1; k >= 0; --k) {
      var r = radii[k];
      var x = r;
      var y = ypos[k];

      for (var k2 = K-1; k2 > k; --k2) {
        var r2 = radii[k2];
        var x2 = xposRight[k2];
        var y2 = ypos[k2];

        //var padding = y2 < y ? r2 + r * Math.pow(y2 / y, 2)
        //                     : r2 * Math.pow(y / y2, 2) + r;
        var padding = (r2 + r) * Math.pow(2 / (y2 / y + y / y2), 8);
        x = Math.max(x, x2 + padding);
      }

      xposRight[k] = x;
      xmaxRight = Math.max(xmaxRight, x + r);
    }

    // Fuse passes 1 & 2
    var xpos = xposLeft;
    var radiusScale = 0.5 / xmaxLeft + 0.5 / xmaxRight;
    for (var k = 0; k < K; ++k) {
      radii[k] = radii[k] * radiusScale;
      xpos[k] = 0.5 * (1 + xposLeft[k] / xmaxLeft - xposRight[k] / xmaxRight);
    }
    if (testing) {
      for (var k = 0; k < K; ++k) {
        assert(0 <= xpos[k] && xpos[k] <= 1,
            'bad x position: xpos[' + k + '] = ' + xpos[k]);
        assert(0 <= radii[k] && radii[k] <= 1,
            'bad radius: radii[' + k + '] = ' + radii[k]);
      }
    }

    var depthSorted = [];
    for (var k = 0; k < K; ++k) {
      depthSorted[k] = k;
    }
    depthSorted.sort(function(k1,k2){ return ypos[k2] - ypos[k1]; });

    this.keys = keys;
    this.depthSorted = depthSorted;
    this.radii = radii;
    this.xpos = xpos;
    this.ypos = ypos;

    var colorParam = this.model.getFreqPrior().likes;
    var colorScale = 1 / Math.max.apply(Math, colorParam);
    var activeParam = this.model.getFreqAmps().likes;
    var color = this.color = [];
    var active = this.active = [];
    for (var k = 0; k < K; ++k) {
      var i = keys[k];
      color[k] = Math.sqrt(colorScale * colorParam[i]);
      active[k] = 1 - Math.exp(-activeParam[i]);
    }
  },

  draw: function () {
    var keys = this.keys;
    var depthSorted = this.depthSorted;
    var radii = this.radii;
    var xpos = this.xpos;
    var ypos = this.ypos;

    var color = this.color;
    var active = this.active;

    var points = this.model.freqs;
    var context = Keyboard.context;
    var probs = this.probs;
    var keys = this.keys;

    var K = keys.length;
    var W = window.innerWidth;
    var H = window.innerHeight;
    var R = config.keyboard.cornerRadius;

    context.clearRect(0, 0, W, H);
    var fracBars = this.fracBars;
    context.font = '10pt Helvetica';
    context.textAlign = 'center';
    context.strokeStyle = 'rgba(0,0,0,0.25)';

    for (var d = 0; d < K; ++d) {
      var k = depthSorted[d];

      var r = Math.round(255 * Math.min(1, color[k] + active[k]));
      var g = Math.round(255 * Math.max(0, color[k] - active[k]));
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + g + ')';
      var Wx = W * xpos[k];
      var Hy = H * ypos[k];
      var Wr = W * radii[k];

      // piano key = box + cap + outline

      context.fillRect(Wx - Wr, 0, Wr + Wr, Hy - Wr * R);

      context.beginPath();
      context.moveTo(Wx - Wr, Hy - Wr * R - 2);
      context.lineTo(Wx - Wr, Hy - Wr * R);
      context.quadraticCurveTo(Wx - Wr, Hy, Wx - Wr * (1-R), Hy);
      context.lineTo(Wx + Wr * (1-R), Hy);
      context.quadraticCurveTo(Wx + Wr, Hy, Wx + Wr, Hy - Wr * R);
      context.lineTo(Wx + Wr, Hy - Wr * R - 2);
      context.fill();

      context.beginPath();
      context.moveTo(Wx - Wr, 0);
      context.lineTo(Wx - Wr, Hy - Wr * R);
      context.quadraticCurveTo(Wx - Wr, Hy, Wx - Wr * (1-R), Hy);
      context.lineTo(Wx + Wr * (1-R), Hy);
      context.quadraticCurveTo(Wx + Wr, Hy, Wx + Wr, Hy - Wr * R);
      context.lineTo(Wx + Wr, 0);
      context.stroke();

      if (Wr < 6) continue;
      Hy -= 2/3 * (Wr - 6);
      var point = points[keys[k]];
      var bar = fracBars[(point.numer > 9) + (point.denom > 9)];
      context.fillStyle = 'rgb(0,0,0)';
      context.fillText(point.numer, Wx, Hy - 16);
      context.fillText(bar, Wx, Hy - 10);
      context.fillText(point.denom, Wx, Hy - 2);
    }
  },

  click: function (x01, y01) {
    var keys = this.keys;
    var depthSorted = this.depthSorted;
    var radii = this.radii;
    var xpos = this.xpos;
    var ypos = this.ypos;

    for (var d = depthSorted.length - 1; d >= 0; --d) {
      var k = depthSorted[d];

      if (y01 <= ypos[k]) {
        var r = Math.abs(x01 - xpos[k]);
        if (r <= radii[k]) {
          this.onclick(keys[k]);
          break;
        }
      }
    }
  },

  updateSwipe: function () {
    var x0 = this.swipeX0;
    var y0 = this.swipeY0;
    var x1 = this.swipeX1;
    var y1 = this.swipeY1;
    this.swipeX0 = x1;
    this.swipeY0 = y1;

    // TODO compute old,new vectors using old,new geometry (not new,new)
    if (x0 === x1) return; // only works for new,new geometry

    var keys = this.keys;
    var ypos = this.ypos;
    var xpos = this.xpos
    var radii = this.radii;
    var dir = x0 < x1 ? -1 : 1;

    var indices = [];
    for (var k = 0, K = keys.length; k < K; ++k) {
      var y = ypos[k];
      if ((y0 > y) || (y1 > y)) continue; // approximate

      var x = xpos[k] + dir * radii[k];
      if ((x0 - x) * (x - x1) > 0) {
        indices.push(keys[k]);
      }
    }

    if (indices.length > 0) {
      this.onswipe(indices);
    }
  },

  fracBars: '\u2013\u2014\u2015' // narrow, medium, wide
};

Keyboard.canvas = undefined;
Keyboard.context = undefined;

test('Keyboard.update', function(){
  var model = new Harmony(4);
  model.start();
  model.stop();

  var keyboard = new Keyboard(model);
  keyboard.update();
});

test('Keyboard.click', function(){
  var model = new Harmony(4);
  var keyboard = new Keyboard(model);

  model.start();
  keyboard.start();
  keyboard.stop();
  model.stop();

  for (var i = 0; i < 10; ++i) {
    keyboard.click(Math.random(), Math.random());
    model.updateDiffusion();
    keyboard.update();
  }
});

test('Keyboard.swipe', function(){
  var model = new Harmony(4);
  var keyboard = new Keyboard(model);

  model.start();
  keyboard.start();
  keyboard.stop();
  model.stop();

  keyboard._swiped = false;
  keyboard.swipeX0 = keyboard.swipeX1 = Math.random();
  keyboard.swipeY0 = keyboard.swipeY1 = Math.random();

  for (var i = 0; i < 10; ++i) {
    keyboard._swiped = false;
    keyboard.swipeX1 = Math.random();
    keyboard.swipeY1 = Math.random();

    model.updateDiffusion();
    keyboard.update();
  }
});

Keyboard.initCanvas = function () {

  if (Keyboard.canvas !== undefined) return;

  var canvas = Keyboard.canvas = $('<canvas>').css({
        'position': 'fixed',
        'width': '100%',
        'height': '50%',
        'left': '0%',
        'top': '50%'
      }).appendTo(document.body)[0];

  $(window).resize(function(){
        canvas.width = innerWidth;
        canvas.height = innerHeight / 2;
      }).resize();

  Keyboard.context = canvas.getContext('2d');
};

//------------------------------------------------------------------------------
// Synthesis

/** @constructor */
var Synthesizer = function (model) {

  this.freqs = model.freqs;
  this.grids = model.grids;
  this.pitchHz = model.pitchHz;
  this.tempoHz = model.tempoHz;
  this.sharpness = model.sharpness;
  this.amps = model.amps.likes;

  this.cyclesPerBeat = config.synth.cyclesPerBeat;
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
        'pitchHz': this.pitchHz,
        'tempoHz': this.tempoHz,
        'sharpness': this.sharpness,
        'freqs': this.freqs.map(function(f){ return f.toNumber(); }),
        'gridFreqs': this.grids.map(function(g){ return g.freq.toNumber(); }),
        'gridBases': this.grids.map(function(g){ return g.base.toNumber(); }),
        'cyclesPerBeat': this.cyclesPerBeat,
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

  start: function (clock) {

    var synthRateHz = this.tempoHz * this.cyclesPerBeat;
    var periodMs = 1000 / synthRateHz;

    // TODO XXX FIXME the clock seems to drift and lose alignment
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

var main = function () {

  var model = new Model();
  var synthesizer = new Synthesizer(model);
  var phasePlotter = new PhasePlotter(model);
  //var keyboard = new Keyboard(model, synthesizer); // TODO

  var clock = new Clock();
  model.start(clock);
  //keyboard.start(clock); // TODO
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
              model.addAmpAtTime(timeMs);
            }
            e.preventDefault();
            break;
        }
      });

  // TODO synthesizer.ready(toggleRunning());
  //   or put up a titlepage banner or something
};

$(function(){

  if (window.location.hash && window.location.hash.slice(1) === 'test') {

    document.title = 'Splitband - Unit Test';
    test.runAll(function(){
          window.location.hash = '';
          document.title = 'Splitband';
          main();
        });

  } else {

    main ();
  }
});

