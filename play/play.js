/**
 * Whence Music?
 * http://whencemusic.net
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var config = {
  numVoices: 7,

  none: undefined
};

Math.randomStd = function () {
  var random = Math.random;
  return 2 * (random() + random() + random()) - 3;
};

//------------------------------------------------------------------------------
// Voices

var Voice = function (clock) {

  this.clock = clock;
  this.audio = new Audio();
  this.scheduled = undefined;

  initRandom();

  var voice = this;
  this.worker = new Worker('synthworker.js');
  this.worker.addEventListener('message', function (e) {
    var data = e['data'];
    switch (data['type']) {
      case 'update':
        var uri = data['data'];
        voice.audio.src = uri;
        voice.audio.load();
        voice.audio.play();
        // TODO switch to timeout version
        //if (clock.running) ...
        //setTimeout(function(){ voice.audio.play(); }, ???);
        break;

      case 'log':
        log('Synth Worker: ' + data['data']);
        break;

      case 'error':
        throw new WorkerException('Synth ' + data['data']);
    }
  });
};

Voice.prototype = {

  initRandom: function () {

    this.gain = Math.random();
    this.offset = Math.random();
    this.logTempo = Math.randomStd();
    this.logPitch = Math.randomStd();
    this.logRelBandwidth = Math.randomStd();
  },

  advance: function (dtimeMs) {
    assert(dtimeMs >= 0, 'bad dtimeMs: ' + dtimeMs);
    if (dtimeMs === 0) return;

    TODO();
  },

  none: undefined
};

//------------------------------------------------------------------------------
// Population

var Population = function (clock) {

  this.clock = clock;

  this.voices = [];
  for (var i = 0; i < config.numVoices; ++i) {
    this.voices[i] = new Voice(clock);
  }

  var population = this;
  clock.continuouslyDo(function (timeMs, dtimeMs) {
        population.advance(dtimeMs);
      });
};

Population.prototype = {

  advance: function (dtimeMs) {
    assert(dtimeMs >= 0, 'bad dtimeMs: ' + dtimeMs);
    if (dtimeMs === 0) return;

    var voices = this.voices;
    for (var i = 0, I = voices.length; i < I; ++i) {
      voices[i].advance(dtimeMs);
    }
    TODO();
  },

  none: undefined
};

//----------------------------------------------------------------------------
// Main

var clock;
var population;

var main = function () {

  clock = new Clock();
  population = new Population(clock); 

  $(window).on('keydown', function (e) {
        switch (e.which) {
          case 27: // escape
            clock.toggleRunning();
            break;
        }
      });

  clock.start();
};

$(function(){
  if (window.location.hash && window.location.hash.slice(1) === 'test') {
    document.title = document.title + ' (Unit Test)';
    test.runAll(main);
  } else {
    main();
  }
});

