/*
 * livecoder: version (2011-12-05)
 * http://livecoder.net
 *
 * Livecoder is tool to make browser-based javascript live coding easy.
 * It includes a language extension, a live coding editor, a task scheduler,
 * and a few math/graphics/audio tools for live coding of art.
 *
 * Requires:
 * - jquery.js
 * - jquery.caret.js
 * - a textarea for source editing
 * - a textarea for error logging
 *
 * Provides:
 * - an obect 'livecoder'
 * - a mess of global variables useful for live coding
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

//------------------------------------------------------------------------------
// Global safety

var globalEval = eval;
'use strict';

function AssertException (message) {
  this.message = message;
}
AssertException.prototype.toString = function () {
  return 'Assertion Failed: ' + this.message;
}
function assert (condition, message) {
  if (!condition) {
    throw new AssertException(message);
  }
}

//------------------------------------------------------------------------------
// Global tools for livecoding

// Time
// once{...} evaluates once, then decays to the inert nonce{...}
var time = 0;     // in milliseconds, this is reset every call
var dtime = 1;    // timestep in milliseconds, bounded to [1,1000]
var schedule;//(callback(dtime), periodMs, cancelIfLateByMs=inf) recurses in time

// Graphics
var windowW = 0, windowH = 0; // window inner width,height in pixels
var mouseX = 0, mouseY = 0;   // mouse coords in pixels
var clear2d;                  // clears drawing context
var draw2d;                   // a 2d canvas context

// Audio
var sampleRate = 22050;
var play;//(seq:Uint8Array) plays an audio sequence (mono 8bit 22050Hz)
var tone;//(freqHz, durationSec) returns a sequence for a single tone
var noise;

// all the short variables
var a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z;
var A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z;

// math functions & constants
var pow   = Math.pow;      var e       = Math.E;
var sqrt  = Math.sqrt;     var pi      = Math.PI;
var exp   = Math.exp;      var sqrt2   = Math.SQRT2;
var log   = Math.log;      var sqrt1_2 = Math.SQRT1_2;
var sin   = Math.sin;      var ln2     = Math.LN2;
var cos   = Math.cos;      var ln10    = Math.LN10;
var tan   = Math.tan;      var log2e   = Math.LOG2E;
var asin  = Math.asin;     var log10e  = Math.LOG10E;
var acos  = Math.acos;
var atan  = Math.atan;     var floor   = Math.floor;
var atan2 = Math.atan2;    var ceil    = Math.ceil; 
var max   = Math.max;      var round   = Math.round;
var min   = Math.min;
var abs   = Math.abs;      var rand    = Math.random;

var inf = 1 / 0;
var sin2pi = function (t) { return sin(2*pi*t) };
var cos2pi = function (t) { return cos(2*pi*t) };
var tan2pi = function (t) { return tan(2*pi*t) };
var bound  = function (lb,ub,x) { return max(lb,min(ub,x)) };

//------------------------------------------------------------------------------
// Live module

window.livecoder = (function(){

  var live = {};

  live.logo = [
    "# try changing this",
    "",
    "clear2d();",
    "var d = draw2d;",
    "",
    "d.font = 'bold 64pt Courier';",
    "d.fillStyle = 'rgb(95,191,95)';",
    "d.textAlign = 'center';",
    "d.fillText(",
    "    'Hello World!',",
    "    1/8 * mouseX + 3/8 * windowW,",
    "    1/8 * mouseY + 3/8 * windowH);",
    ""
  ].join('\n');

  live.log = function (message) {
    live.$log.val(String(message || ''));
  };

  live.setSource = function (val) {
    live.$source.val(val);
  };
  live.getSource = function (val) {
    return live.$source.val();
  };

  live.reset = undefined; // defined below

  live.init = function ($source, $log, initSource) {

    live.$log = $log;
    live.$source = $source;

    live.setSource(initSource || live.logo);

    live.initGraphics();

    live.toggleCompiling();
    live.toggleRunning();
  };

  //----------------------------------------------------------------------------
  // Evaluation

  live.compiling = false;
  live.running = false;
  live.compiledCode = '';
  live.lastGoodCode = '';
  live.taskList = [];

  live.reset = function () {
    live.lastGoodCode = '';
    clear2d();
  };

  live.compileSource = function () {
    if (!live.compiling) return;

    try {
      var source = live.getSource();

      live.compiledCode = source
            .replace(/\bonce\b/g, 'if(1)')
            .replace(/\bnonce\b/g, 'if(0)')
            .replace(/\bfun\b/g, 'function')
            .replace(/#/g, '//');
      // TODO compile fully to code here

      if (source.match(/\bonce\b/)) {
        var pos = live.$source.caret();
        live.setSource(source.replace(/\bonce\b/g, 'nonce'));
        live.$source.caret(pos);
      }
    }
    catch (err) {
      live.log('');
    }
  };

  live.runSource = function () {
    if (!live.running) return;

    live.log('');

    var oldTime = window.time;
    window.time = Number(Date.now());
    window.dtime = bound(1, 1000, time - oldTime);

    try {
      if (!live.compiling) throw 'hit escape to compile';

      globalEval(live.compiledCode);

      $('#source').css('color', '#aaffaa');

      live.lastGoodCode = live.compiledCode;
    }
    catch (err) {
      $('#source').css('color', '#dddddd');
      live.log(err);

      try {
        globalEval(live.lastGoodCode);
      }
      catch (err) {
        live.log(err);
      }
    }

    live.updateTasks();

    setTimeout(live.runSource, 1);
  };

  live.updateTasks = function () {
    
  };

  live.compileIfChanged = function (keyup) {
    // see eg
    // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    switch (keyup.which) {

      // ignore control keys
      case 16: case 17: case 18: case 19: case 20: case 27: case 33:
      case 34: case 35: case 36: case 37: case 38: case 39: case 40:
        break;

      default:
        live.compileSource();
    }
  };

  live.toggleCompiling = function () {

    if (live.compiling) {
      live.compiling = false;
      $('#source').off('keyup').off('click').off('change');
    }
    else {
      live.compiling = true;
      $('#source')
          .on('keyup', live.compileIfChanged)
          .on('click', live.compileSource)
          .on('change', live.compileSource)
          .trigger('change');
    }
  };

  live.toggleRunning = function () {

    if (live.running) {
      live.running = false;
      live.pauseTime = Date.now();
    }
    else {
      live.running = true;
      if (live.pauseTime) {
        time += Date.now() - live.pauseTime;
      }
      live.runSource();
    }
  };

  //----------------------------------------------------------------------------
  // Graphics

  window.clear2d = function (keep) {
    var d = draw2d;
    d.clearRect(0, 0, d.canvas.width, d.canvas.height);
  };

  live.resize = function () {
    windowW = draw2d.canvas.width = window.innerWidth;
    windowH = draw2d.canvas.height = window.innerHeight;
  };

  live.initGraphics = function () {

    try {
      draw2d = document.getElementById('canvas2d').getContext('2d');
      assert(draw2d, 'failed to get 2d canvas context');
    }
    catch (err) {
      live.log(err);
      draw2d = undefined;
    }

    $(window).resize(live.resize).resize();
    $(document).mousemove(function(e){
          window.mouseX = e.pageX;
          window.mouseY = e.pageY;
        });
  };

  //----------------------------------------------------------------------------
  // Audio (mono 8bit 22050 Hz -- hey, it's just a browser)
  // see http://davidflanagan.com/Talks/jsconf11/BytesAndBlobs.html

  // typed arrays are not universally supported

  try {

    if (!window.BlobBuilder && window.WebKitBlobBuilder) {
      window.BlobBuilder = window.WebKitBlobBuilder;
    }
    if (!window.URL && window.webkitURL) {
      window.URL = window.webkitURL;
    }

    live.riffHeader = new Uint8Array([
          0x52,0x49,0x46,0x46, // "RIFF"
          0, 0, 0, 0,          // total file size = FILLME
          0x57,0x41,0x56,0x45, // "WAVE"
          0x66,0x6d,0x74,0x20, // "fmt "
          16,0,0,0,            // size of the following
          1, 0,                // PCM format
          1, 0,                // channels = 1 (mono)
          22,56,0,0,           // sample rate = 22050 Hz
          22,56,0,0,           // byte rate = one byte per sample 
          1, 0,                // byte alignment = 1
          8, 0,                // bits per sample = 8
          0x64,0x61,0x74,0x61, // "data"
          0, 0, 0, 0           // data size in bytes = FILLME
        ]).buffer;  // Note: we just want the ArrayBuffer

    live.makeWav = function (samples) {

      // overwrite the header each time we make a wav
      var dv = new DataView(live.riffHeader);
      dv.setInt32(4, 36 + samples.length, true);
      dv.setInt32(40, samples.length, true);

      var bb = new BlobBuilder();
      bb.append(live.riffHeader);
      bb.append(samples.buffer);
      return bb.getBlob("audio/wav");
    };

    window.tone = function (frequency, duration) {

      var samplespercycle = 22050 / frequency;
      var samples = new Uint8Array(22050 * duration);

      var phase = 0, dphase = 2 * pi / samplespercycle;
      for(var i = 0, I = samples.length, phase = 0; i < I; ++i) {
        samples[i] = round(255 * 0.49 * (1 + sin(phase)));
        phase += dphase;
      }

      return samples;
    };

    window.play = function (samples) {

      var blob = live.makeWav(samples);
      var url = URL.createObjectURL(blob);
      var player = new Audio(url);
      player.play();
      player.addEventListener("ended", function () {
            URL.revokeObjectURL(url);
          }, false);
    }
  }
  catch (err) {
    alert(err);
  }

  //----------------------------------------------------------------------------
  // Module interface

  return {

    init: live.init,
    reset: live.reset,

    log: live.log,

    setSource: live.setSource,
    getSource: live.getSource,

    toggleCompiling: live.toggleCompiling,
    toggleRunning: live.toggleCompilling,

    none: undefined,
  };
})();

