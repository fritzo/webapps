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

  player: {

    // We split the frequency spectrum into high (pitch) + low (tempo)
    //
    //    |<---- tempo --->| |<------------ Pitch ------------>|
    //   8sec      1     8Hz 11Hz           261Hz           6.28kHz
    //                       C/24             C              24 C

    pitchRadius: Math.sqrt(24*24 + 1*1 + 1e-4), // barely including 1/24
    tempoRadius: Math.sqrt(8*8 + 1*1 + 1e-4),   // barely including 1/8 t + 0/1

    pitchHz: 261.625565, // middle C
    tempoHz: 1, // TODO allow real-time tempo control

    pitchAcuity: 3,
    tempoAcuity: 2.5,
    sharpness: 8,

    attackSec: 0.1,
    sustainSec: 1.0,
    grooveSec: 30.0,

    updateRateHz: 100,

    none: undefined
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
// Player

/** @constructor */
var Player = function () {

  assert(config.player.attackSec > 1 / config.player.updateRateHz,
      'player attackSec is too slow for updateRateHz:'+
      '\n   attackSec = ' + config.player.attackSec +
      '\n   updateRateHz = ' + config.player.updateRateHz);

  this.pitchAcuity = config.player.pitchAcuity;
  this.tempoAcuity = config.player.tempoAcuity;
  this.sharpness = config.player.sharpness;
  this.attackSec = config.player.attackSec;
  this.sustainSec = config.player.sustainSec;
  this.grooveSec = config.player.grooveSec;

  var freqs = this.freqs = Rational.ball(config.player.pitchRadius);
  var grids = this.grids = RatGrid.ball(config.player.tempoRadius);
  log('using ' + freqs.length + ' freqs x ' + grids.length + ' grids');

  this.pitchHz = config.player.pitchHz;
  this.tempoHz = config.player.tempoHz;
  this.minDelay = 1000 / config.player.updateRateHz;

  var fCenter = (freqs.length - 1) / 2;
  var gDownBeat = 0;
  assert(grids[0].freq.numer === 1
      && grids[0].freq.denom === 1
      && grids[0].base.numer === 0,
      'downbeat was not in expected position');
  var fgInitial = grids.length * fCenter + gDownBeat;
  this.amps = MassVector.degenerate(fgInitial, freqs.length * grids.length);

  this.damps = MassVector.zero(this.amps.likes.length);
};

Player.prototype = {

  getFreqs: function () { return this.freqs; },
  getGrids: function () { return this.grids; },
  getPitchHz: function () { return this.pitchHz; },
  getTempoHz: function () { return this.tempoHz; },
  getAmps: function () { return this.amps.likes; },

  // TODO attach this to a keyboard
  addAmp: function (timeMs) {

    var time = timeMs / (1000 * this.tempoHz);
    var grids = this.grids;
    var damps = this.damps;
    var likes = damps.likes;

    // TODO switch to using attackSec instead of sharpness.
    //   This requires a bayesian prior that integrates over cos^p(theta)
    //   or whatever beat function is used.
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

    var player = this;
    var amps = this.amps.likes;
    var damps = this.damps.likes;
    var minDelay = this.minDelay;

    var playerworker = new Worker('playerworker.js');
    var update = function () {
      if (running) {
        var time = Date.now();
        var timestepSec = (time - lastTime) / 1000;
        lastTime = Date.now();
        playerworker.postMessage({
              'cmd': 'update',
              'data': {
                'timestepSec': timestepSec,
                'damps': player.damps.likes
              }
            });
        for (var i = 0, I = damps.length; i < I; ++i) {
          damps[i] = 0;
        }
      }
    };
    playerworker.addEventListener('message', function (e) {
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
              log('Player Worker: ' + data['data']);
              break;

            case 'error':
              throw new WorkerException('Player ' + data['data']);
          }
        }, false);
    playerworker.postMessage({
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
          playerworker.postMessage({'cmd':'profile'});
        });
  }
};

//------------------------------------------------------------------------------
// Plotting

var canvas;
var context;
var initPlotting = function () {
  if (canvas !== undefined) return;

  canvas = $('<canvas>').css({
        'position':'fixed',
        'width': '100%',
        'height': '100%',
        'left': '0%',
        'top': '0%'
      }).appendTo(document.body)[0];

  context = canvas.getContext('2d');

  $(window).resize(function(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }).resize();
};

/** @constructor */
var Plotter = function (grids, tempoHz, amps) {

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

Plotter.prototype = {

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
    var plotter = this;
    var frameCount = 1;

    plotter.plot(0);

    clock.continuouslyDo(function(timeMs){
          plotter.plot(timeMs * tempoKhz);
          frameCount += 1;
        }, 1000 / config.plot.framerateHz);
    clock.onStop(function(timeMs){
          var framerate = frameCount * 1000 / timeMs;
          log('plotting framerate = ' + framerate.toFixed(1) + ' Hz');
        });
    $(window).on('resize.plotter', function () {
          plotter.plot(clock.now() * tempoKhz);
          if (clock.running) frameCount += 1;
        });
  }
};

//------------------------------------------------------------------------------
// Audio

/** @constructor */
var Synthesizer = function (freqs, grids, pitchHz, tempoHz, amps) {

  assertLength(amps, freqs.length * grids.length, 'amps');

  this.freqs = freqs;
  this.grids = grids;
  this.pitchHz = pitchHz;
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
        'pitchHz': this.pitchHz,
        'tempoHz': this.tempoHz,
        'freqs': freqs.map(function(f){ return f.toNumber(); }),
        'gridFreqs': grids.map(function(g){ return g.freq.toNumber(); }),
        'gridBases': grids.map(function(g){ return g.base.toNumber(); }),
        'cyclesPerBeat': this.cyclesPerBeat,
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

var main = function () {

  var player = new Player();
  var pitchHz = player.getPitchHz();
  var tempoHz = player.getTempoHz();
  var freqs = player.getFreqs();
  var grids = player.getGrids();
  var amps = player.getAmps();

  var plotter = new Plotter(grids, tempoHz, amps);
  var synthesizer = new Synthesizer(freqs, grids, pitchHz, tempoHz, amps);

  var clock = new Clock();
  player.start(clock);
  plotter.start(clock);
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
              player.addAmp(timeMs);
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

