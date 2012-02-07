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

  tempoRadius: Math.sqrt(12*12 + 1*1 + 1e-4), // barely including 1/12 t + 0/1

  none: undefined
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

  initRandom: function (gridProbs) {
    // TODO start at steady-state distribution
    this.gain = Math.random();
    this.grid = gridProbs.sample();
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
// Model

var Model = function (clock) {

  this.clock = clock;

  var grids = this.grids = RatGrid.ball(config.tempoRadius);
  this.commonPeriod = RatGrid.commonPeriod(grids);
  log('using ' + grids.length + ' grids with common period '
      + this.commonPeriod);

  this.voices = [];
  for (var i = 0; i < config.numVoices; ++i) {
    this.voices[i] = new Voice(clock);
  }

  var model = this;
  clock.continuouslyDo(function (timeMs, dtimeMs) {
        model.advance(dtimeMs);
      });
};

Model.prototype = {

  advance: function (dtimeMs) {
    assert(dtimeMs >= 0, 'bad dtimeMs: ' + dtimeMs);
    if (dtimeMs === 0) return;

    var voices = this.voices;
    for (var i = 0, I = voices.length; i < I; ++i) {
      voices[i].advance(dtimeMs);
    }
    TODO();
  },
  },

  none: undefined
};

$(function(){

  var clock = new Clock();
  $(window).keyup(function(e){ if (e.which === 27) clock.toggleRunning(); });

  clock.continuouslyDo(function(timeMs, dtimeMs){
    TODO('update');
  });

  clock.start();
});

