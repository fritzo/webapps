/**
 * livecoder
 *
 * Livecoder is toolset to make browser-based javascript live coding easy.
 * It includes a language extension, a live coding editor, a task scheduler,
 * and a few math/graphics/audio tools for live coding of art.
 *
 * Requires:
 * - jQuery
 * - CodeMirror2
 * - a textarea for source editing
 * - a textarea for error logging
 * - a butten for status indication
 * - a canvas for 2d drawing
 *
 * Provides:
 * - an object 'livecoder'
 * - a mess of global variables useful for live coding
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

//------------------------------------------------------------------------------
// Live module

var live = (function(){

  var live = {};

  var _$log;
  var _$status;
  var _codemirror;

  live.init = function (args) {

    _$log = args.$log;
    _$status = args.$status;

    _codemirror = CodeMirror.fromTextArea(args.$source[0], {
      undoDepth: 512,
      onFocus: args.onFocus,
      onChange: _compileSource,
      theme: 'live',
      lineNumbers: false,
      matchBrackets: true,
      workTime: 10, // very short
      workDelay: 300, // default
      pollinterval: 300, // long
      // TODO get hinting working
      //extraKeys: {
      //  'Ctrl-N': CodeMirror.javascriptHint,
      //  'Ctrl-P': CodeMirror.javascriptHint,
      //}
      none: undefined
    });

    // this is required for full screen
    var scroller = _codemirror.getScrollerElement();
    scroller.style.height = '100%';
    scroller.style.width = '100%';

    _codemirror.setValue(args.initSource || live.logo);

    _$status.css('background-color', 'green');
    //css('color', '#aaffaa') // TODO XXX;

    _initGraphics(args.canvas2d);

    _startCompiling();
  };

  live.logo = [
      "// Hello World",
      "// i am live code",
      "// try changing me",
      "",
      "context.font = 'bold 64pt Courier';",
      "context.fillStyle = '#55aa55';",
      "context.textAlign = 'center';",
      "",
      "live.hello = function () {",
      "  context.clearRect(0, 0, innerWidth, innerHeight);",
      "  context.fillText(",
      "      'Hello World!',",
      "      1/8 * mouseX + 3/8 * innerWidth,",
      "      1/8 * mouseY + 3/8 * innerHeight);",
      "",
      "  setTimeout(live.hello, 0); // to stop, comment out",
      "};",
      "",
      "once live.hello(); // to start, erase the 'n'",
      ""
  ].join('\n');

  var _print = function (message) {
    _$log.val('> ' + message).css('color', '#aaaaff').show();
  };
  var _success = function () {
    _$log.val('').hide();
    _$status.css('background-color', 'green');
  };
  var _warn = function (message) {
    _$log.val(String(message)).css('color', '#ffff00').show();
    _$status.css('background-color', 'orange');
  };
  var _error = function (message) {
    _$log.val(String(message)).css('color', '#ff7777').show();
    _$status.css('background-color', 'red');
  };

  var _clear = function () {
    _clearAllTimeouts();
    _clearWorkspace();
    _context2d.clearRect(0, 0, innerWidth, innerHeight);
  };

  live.setSource = function (val) {
    _clear();
    _codemirror.setValue(val);
    _startCompiling();
  };
  live.getSource = function (val) {
    return _codemirror.getValue();
  };

  //----------------------------------------------------------------------------
  // Evaluation

  var _compileSource;
  var _startCompiling;
  var _toggleCompiling;
  var _clearWorkspace;

  (function(){

    var compiling = false;
    var workspace = {};

    var compileHandlers = [];
    live.oncompile = function (handler) {
      compileHandlers.push(handler);
    };

    _compileSource = function () {
      if (!compiling) {
        _warn('hit escape to compile');
        return;
      }

      var source = _codemirror.getValue();
      var compiled;
      try {
        compiled = globalEval(
            '"use strict";\n' +
            '(function(live,clear,print,error,setTimeout,context){\n' +
                source
                  .replace(/\bonce\b/g, 'if(1)')
                  .replace(/\bnonce\b/g, 'if(0)') +
            '\n/**/})');
      } catch (err) {
        _warn(err);
        return;
      }

      if (source.match(/\bonce\b/)) {
        var cursor = _codemirror.getSearchCursor(/\bonce\b/g);
        do {
          cursor.replace('nonce');
        } while (cursor.findNext());
      }

      _success();

      try {
        compiled(workspace, _clear, _print, _error, _setTimeout, _context2d);
      } catch (err) {
        _error(err);
        return;
      }

      for (var i = 0; i < compileHandlers.length; ++i) {
        compileHandlers[i]();
      }
    };

    _stopCompiling = function () {
      compiling = false;
      _warn('hit escape to compile');
    };

    _startCompiling = function () {
      compiling = true;
      _success();
      _compileSource();
      _codemirror.focus();
    };

    _toggleCompiling = function () {
      compiling ? _stopCompiling() : _startCompiling();
    };

    _clearWorkspace = function () {
      for (var key in workspace) {
        delete workspace[key];
      }
    };

  })();

  //----------------------------------------------------------------------------
  // Scheduling: safe, clearable

  var _setTimeout;
  var _clearAllTimeouts;

  (function(){

    var taskCount = 0;
    var tasks = {};

    _setTimeout = function (action, delay) {

      var id = taskCount++;
      var safeAction = function () {
        try {
          action();
        } catch (err) {
          _error(err);
        }
        delete tasks[id];
      };

      tasks[id] = setTimeout(safeAction, delay);
    };

    _clearAllTimeouts = function () {
      for (var i in tasks) {
        clearTimeout(tasks[i]);
        delete tasks[i];
      }
    };

  })();

  //----------------------------------------------------------------------------
  // Graphics

  var _context2d;

  var _initGraphics = function (canvas2d) {

    try {
      _context2d = canvas2d.getContext('2d');
      assert(_context2d, 'failed to get 2d canvas context');

      $(window).resize(function(){
            _context2d.canvas.width = innerWidth;
            _context2d.canvas.height = innerHeight;
          }).resize();
    }
    catch (err) {
      error(err);
      log(err);
      _context2d = undefined;
    }

    $(document).mousemove(function(e){
          window.mouseX = e.pageX;
          window.mouseY = e.pageY;
        });
  };

  //----------------------------------------------------------------------------
  // Module interface

  return {

    init: live.init,

    setSource: live.setSource,
    getSource: live.getSource,

    toggleCompiling: _toggleCompiling,
    oncompile: live.oncompile,

    none: undefined,
  };
})();

//------------------------------------------------------------------------------
// Glogal utilities

var dir = function (o) {
  o = o || window;
  var a = [], i = 0;
  for (a[i++] in o);
  return a;
};

var help = function (o) {
  o = o || help;
  print((help in o ? o.help + '\n\n' : '')
      + dir(o) + '\n\n'
      + o.toString());
};

//------------------------------------------------------------------------------
// Global tools for livecoding

// Time - units are milliseconds and kHz
// once{...} evaluates once, then decays to the inert nonce{...}
// var live = {}; // a place store variables while live coding
// var print = function (message) = {/* logs normal message */}
// var error = function (message) = {/* log error message */}

// Graphics
var mouseX = 0; // mouse coords in pixels
var mouseY = 0;

//------------------------------------------------------------------------------
// Audio (mono 16bit 22050 Hz -- hey, it's just a browser)

var sampleRate = WavEncoder.defaults.sampleRateHz / 1000; // in kHz
var middleC = 0.261625565; // in kHz

var play = function (uri, volume) {
  var audio = new Audio(uri);
  if (volume !== undefined) audio.volume = volume;
  audio.play();
};

var tone = function (args) {

  var duration = args.duration;
  var frequency = args.frequency;
  var gain = args.gain || 1;
  assert(duration > 0, 'bad args.duration: ' + duration);
  assert(frequency > 0, 'bad args.frequency: ' + duration);

  var numSamples = Math.floor(duration * sampleRate);
  var samples = new Array(numSamples);

  gain *= 1 / numSamples;
  var omega = 2 * Math.PI * frequency / sampleRate;
  var sin = Math.sin;
  var sqrt = Math.sqrt;

  for (var t = 0; t < numSamples; ++t) {
    samples[t] = sin(omega * t) * (numSamples - t) * gain;
  }

  return WavEncoder.encode(samples);
};

var noise = function (args) {

  var duration = args.duration;
  var gain = args.gain || 1;
  assert(duration > 0, 'bad args.duration: ' + duration);

  var numSamples = Math.floor(duration * sampleRate);
  var samples = new Array(numSamples);

  var sqrt = Math.sqrt;
  var random = Math.random;

  if (bandwidth in args) { // band-limited noise

    var bandwidth = args.bandwidth;
    var frequency = args.frequency;
    assert(frequency > 0, 'bad args.frequency: ' + frequency);

    var numSamples = floor(duration * sampleRate);
    var omega = 2 * Math.PI * frequency / sampleRate;
    var cosOmega = cos(omega);
    var sinOmega = sin(omega);
    var decay = exp(-bandwidth * frequency / sampleRate);
    var transReal = decay * cosOmega;
    var transImag = decay * sinOmega;
    var normalize = 1 - decay;
    gain *= normalize / numSamples;

    var random = Math.random;
    var randomStd = function () {
      return 2 * (random() + random() + random()) - 3;
    };

    var x = 0;
    var y = 0;
    var samples = [];
    for (var t = 0; t < numSamples; ++t) {
      var x0 = x;
      var y0 = y;
      x = transReal * x0 - transImag * y0 + randomStd();
      y = transReal * y0 + transImag * x0 + randomStd();
      samples[t] = x * gain * (numSamples - t);
    }

  } else { // broadband noise

    gain *= 1 / numSamples;
    for (var t = 0; t < numSamples; ++t) {
      samples[t] = (2 * random() - 1) * (numSamples - t) * gain;
    }
  }

  return WavEncoder.encode(samples);
};

