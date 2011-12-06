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

// Time - units are milliseconds and kHz
// once{...} evaluates once, then decays to the inert nonce{...}
var now;//() time of event evaluation
var after;//(duration, action); schedule an event

// Python
var print;
var dir;//(object) lists properties of an object

// Graphics
var windowW = 0, windowH = 0; // window inner width,height in pixels
var mouseX = 0, mouseY = 0;   // mouse coords in pixels
var clear2d;                  // clears drawing context
var draw2d;                   // a 2d canvas context

// Audio
var sampleRate = 22.05; // in kHz
var quantize8 = function (x) { return round(255/2 * (x+1)); };
var quantize16 = function (x) { return round(65535/2 * (x+1)); };
var play;//(seq:Uint8Array) plays an audio sequence (mono 8bit 22050Hz)
var tone;//(freqHz, durationSec) returns a sequence for a single tone
var noise;

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

//--------

var dir = function (o) {
  var a = [], i = 0;
  for (a[i++] in o);
  return a;
};

//------------------------------------------------------------------------------
// Live module

window.livecoder = (function(){

  var live = {};

  live.logo = [
    "// try changing this",
    "",
    "clear2d();",
    "var d = draw2d;",
    "",
    "d.font = 'bold 64pt Courier';",
    "d.fillStyle = '#55aa55';",
    "d.textAlign = 'center';",
    "d.fillText(",
    "    'Hello World!',",
    "    1/8 * mouseX + 3/8 * windowW,",
    "    1/8 * mouseY + 3/8 * windowH);",
    ""
  ].join('\n');

  print = function (message) {
    live.$log.val(String(message || '')).css('color', '#aaaaff');
  };
  live.log = function (message) {
    live.$log.val(String(message || '')).css('color', '#aaaaff');
    live.$source.css('color', '#aaffaa');
  };
  live.warn = function (message) {
    live.$log.val(String(message || '')).css('color', '#ffff00');
    live.$source.css('color', '#dddddd');
  };
  live.error = function (message) {
    live.$log.val(String(message || '')).css('color', '#ff7777');
    live.$source.css('color', '#dddddd');
  };

  live.setSource = function (val) {
    live.$source.val(val);

    for (var key in live.workspace) {
      delete live.workspace[key];
    }
    clear2d();

    live.compiling = false;
    live.toggleCompiling();
    live.$source.change();
  };
  live.getSource = function (val) {
    return live.$source.val();
  };

  live.init = function ($source, $log, initSource) {

    live.$log = $log;
    live.$source = $source;

    $source
        .val(initSource || live.logo)
        .css('color', '#aaffaa')
        .on('keyup', live.compileIfChanged)
        .on('click', live.compileSource)
        .on('change', live.compileSource);

    live.initGraphics();

    live.compiling = false;
    live.toggleCompiling();
    live.scheduler();
  };

  //----------------------------------------------------------------------------
  // Shadow

  live.updateShadow = undefined;

  live.initShadow = function ($shadow) {

    live.updateShadow = function () {
      $shadow.val(live.$source.val().replace(/./g, '\u2588'));
    };

    live.$source
        .on('keyup', live.updateShadow)
        .on('click', live.updateShadow)
        .on('change', live.updateShadow)
        .change();
  };

  //----------------------------------------------------------------------------
  // Task Scheduling

  live.time = Date.now();
  now = function() { return live.time; };

  after = function (delay, action) {

    if (!(delay >= 0)) {
      live.error('ignoring task scheduled after ' + delay);
      return;
    }
    var actionTime = live.time + delay;

    var safeAction = function () {
      try {
        live.time = actionTime; // Date.now() would cause drift
        action();
      } catch (err) {
        live.error(err);
      }
    };
      
    setTimeout(safeAction, delay + live.time - Date.now());
  };

  live.scheduler = function () {
    /*
    var tasks = live.taskList;
    if (tasks.length == 0) return;

    // TODO update tasks

    setTimeout(live.scheduler, 1);
    */
  };

  /* another attempt
  live.scheduler = (function () {

      var Task = function () {
      };

      var tasks = [];

      // interface
      return {
        after = after,

        none:null,
        };
  })();
  */

  //----------------------------------------------------------------------------
  // Evaluation

  live.compiling = false;
  live.workspace = {};
  live.taskList = [];

  live.compileHandlers = [];
  live.oncompile = function (handler) {
    live.compileHandlers.push(handler);
  };

  live.compileSource = function () {
    if (!live.compiling) {
      live.warn('hit escape to compile');
      return;
    }

    live.source = live.$source.val();

    try {
      live.compiled = globalEval(
          '"use strict";\n' +
          //'with(Math);\n' +
          '(function(live){\n' +
              live.source
                .replace(/\bonce\b/g, 'if(1)')
                .replace(/\bnonce\b/g, 'if(0)')
                .replace(/\bfun\b/g, 'function') +
          '\n/**/})');
    } catch (err) {
      live.warn(err);
      return;
    }

    if (live.source.match(/\bonce\b/)) {
      var pos = live.$source.caret() + 1;
      live.$source.val(live.source.replace(/\bonce\b/g, 'nonce')).caret(pos);
    }

    live.log();

    try {
      live.time = Date.now();
      live.compiled(live.workspace, function(){ return live.time; });
    } catch (err) {
      live.error(err);
      return;
    }

    for (var i = 0; i < live.compileHandlers.length; ++i) {
      live.compileHandlers[i]();
    }
  };

  live.compileIfChanged = function (keyup) {
    if (!live.compiling) {
      live.warn('hit escape to compile');
      return;
    }

    var $source = live.$source;
    var delay = false;

    // see eg
    // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    switch (keyup.which) {

      // ignore control keys
      case 16: case 17: case 18: case 19: case 20: case 27: case 33:
      case 34: case 35: case 36: case 37: case 38: case 39: case 40:
        return;

      // be careful with comment markers // by delaying compile
      case 191: // slash
        delay = true;
        break;
      case 8: // backspace
        delay = ($source.val().charAt($source.caret()-1) === '/')
        break
      case 46: // delete
        delay = ($source.val().charAt($source.caret()) === '/')
        break

      // TODO insert matching delimiters (),{},[],',"
      // TODO allow block indent and outdent
    }

    if (delay) setTimeout(live.compileSource, 200);
    else live.compileSource();
  };

  live.toggleCompiling = function () {

    if (live.compiling) {
      live.compiling = false;
      live.warn('hit escape to compile');
    }
    else {
      live.compiling = true;
      live.log();
      live.$source.change();
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
      live.error(err);
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
    initShadow: live.initShadow,

    setSource: live.setSource,
    getSource: live.getSource,

    toggleCompiling: live.toggleCompiling,
    oncompile: live.oncompile,

    none: undefined,
  };
})();

