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
      "var d = draw2d();",
      "d.font = 'bold 64pt Courier';",
      "d.fillStyle = '#55aa55';",
      "d.textAlign = 'center';",
      "",
      "live.hello = function () {",
      "  draw2d().fillText(",
      "      'Hello World!',",
      "      1/8 * mouseX + 3/8 * windowW,",
      "      1/8 * mouseY + 3/8 * windowH);",
      "",
      "  after(0, live.hello); // to stop, comment out",
      "};",
      "",
      "once live.hello(); // to start, erase the 'n'",
      "nonce clear();      // to stop, erase the 'n'",
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
    _after.clear();
    _sync.clear();
    _clearWorkspace();
    _draw2d();
  };

  live.setSource = function (val) {
    _clear();
    _codemirror.setValue(val);

    _startCompiling();
    _codemirror.focus();
  };
  live.getSource = function (val) {
    return _codemirror.getValue();
  };

  //----------------------------------------------------------------------------
  // Evaluation

  var _evalTime = Date.now();

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
            //'with(Math);\n' +
            '(function(live){\n' +
                source
                  .replace(/\bonce\b/g, 'if(1)')
                  .replace(/\bnonce\b/g, 'if(0)')
                  .replace(/\bfun\b/g, 'function') +
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
        _evalTime = Date.now();
        compiled(workspace);
      } catch (err) {
        _error(err);
        return;
      }

      for (var i = 0; i < compileHandlers.length; ++i) {
        compileHandlers[i]();
      }
    };

    /* OBSOLETE
    var _compileIfChanged;
    _compileIfChanged = function (keyup) {
      if (!compiling) {
        _warn('hit escape to compile');
        return;
      }

      var delay = false;

      // see eg
      // http://www.cambiaresearch.com/articles/15
      switch (keyup.which) {

        // ignore control keys
        case 16: case 17: case 18: case 19: case 20: case 27: case 33:
        case 34: case 35: case 36: case 37: case 38: case 39: case 40:
          return;

        // TODO adapt this cleverness to codemirror
        // be careful with comment markers // by delaying compile
        case 191: // slash
          delay = true;
          break;
        case 8: // backspace
          delay = (_$source.val().charAt(_$source.caret()-1) === '/')
          break
        case 46: // delete
          delay = (_$source.val().charAt(_$source.caret()) === '/')
          break
      }

      if (delay) setTimeout(_compileSource, 200);
      else _compileSource();
    };
    */

    _toggleCompiling = function () {

      if (compiling) {
        compiling = false;
        _warn('hit escape to compile');
      }
      else {
        compiling = true;
        _success();
        _compileSource();
        _codemirror.focus();
      }
    };

    _startCompiling = function () {
      compiling = false;
      _toggleCompiling();
    };

    _clearWorkspace = function () {
      for (var key in workspace) {
        delete workspace[key];
      }
    };

  })();

  //----------------------------------------------------------------------------
  //
  //  TODO reimplement schedulers, as in common/clock
  //    * schedule.continuouslyDo()
  //    * schedule.discretelyDo()
  //    * schedule.coupledDo()
  //    * add keyboard pause button to clock
  //
  //  TODO add rational.js and ratgrid.js
  //
  //----------------------------------------------------------------------------

  //----------------------------------------------------------------------------
  // Scheduling drift-free tasks

  var _after;
  (function(){

    var taskCount = 0;
    var tasks = {};

    _after = function (delay, action) {

      if (!(delay >= 0)) {
        _error('ignoring task scheduled after ' + delay);
        return;
      }
      var id = taskCount++;
      var actionTime = _evalTime + delay;

      var safeAction = function () {
        try {
          _evalTime = actionTime; // Date.now() would cause drift
          action();
        } catch (err) {
          _error(err);
        }
        delete tasks[id];
      };

      tasks[id] = setTimeout(safeAction, delay + _evalTime - Date.now());
    };

    _after.clear = function () {
      for (var i in tasks) {
        clearTimeout(tasks[i]);
        delete tasks[i];
      }
    };

  })();

  //----------------------------------------------------------------------------
  // Scheduling coupled tasks

  var _sync;
  (function(){

    //------------------------------------
    // Math

    var sin = Math.sin;
    var cos = Math.cos;
    var pi = Math.PI;
    var sqrt = Math.sqrt;
    var max = Math.max;
    var min = Math.min;

    //------------------------------------
    // Complex numbers

    var Complex = function (x,y) { this.x = x; this.y = y; };

    Complex.prototype = {
      scale : function (t) { return new Complex(t*this.x, t*this.y); },
      iadd : function (other) { this.x += other.x; this.y += other.y; }
    };

    // cross(u,v) = dot(i u, v)
    Complex.dot = function(u,v) { return u.x*v.x + u.y*v.y; };
    Complex.cross = function(u,v) { return u.x*v.y - u.y*v.x; };

    //------------------------------------
    // Voting

    var Poll = function (mass, force) {
      if (mass === undefined) {
        this.mass = 0;
        this.mass2 = 0;
        this.force = new Complex(2,2);
      } else {
        this.mass = mass;
        this.mass2 = mass * mass;
        this.force = force;
      }
    };

    Poll.prototype = {

      iadd : function (other) {
        this.mass += other.mass;
        this.mass2 += other.mass2;
        this.force.iadd(other.force);
      },

      mean : function () {
        var minMass = 0.01; // hand-tuned
        var M = max(minMass, this.mass);
        var M2 = max(minMass*minMass, this.mass2);
        var BesselsCorrection = max(0, 1 - M2 / (M*M));
        return this.force.scale(BesselsCorrection / M);
      }
    };

    //------------------------------------
    // Coupled tasks
    //
    // TODO replace this Synchronized::Phasor with Synchronized::Geometric
    //   * this at least has a debuggable energy minimization interpretation
    //   * it also allows syncopation of two beats separated by pi
    //   * and the energy interpreatation can fit into larger energy
    //     minimization frameworks.
    //   (see kazoo/src/synchronization.h "struct Geometric"

    var taskCount = 0;
    var tasks = {};

    var Task = function (params, action) {

      var mass = params.mass || 1.0;
      var acuity = params.acuity || 3.0; // hand-tuned
      var offset = params.syncopate || 0.0;

      assert(0 < params.delay, 'invalid delay: ' + params.delay);
      assert(0 < mass, 'invalid mass: ' + mass);
      assert(0 < acuity, 'invalid acuity: ' + acuity);

      this.time = _evalTime;
      this.action = action;
      this.freq = 1 / params.delay;
      this.mass = mass;
      this.acuity = acuity;
      this.offset = offset;
      this.phase = 0;

      // let f(theta) = max(0, cos(theta) - cos(a))
      // we compute mean and variance of f
      var a = pi / acuity;
      var sin_a = sin(a), cos_a = cos(a);
      var Ef = (sin_a - a*cos_a) / pi;
      var Ef2 = (a - 3*sin_a*cos_a + 2*a*cos_a*cos_a) / (2*pi);
      var Vf = Ef2 - Ef*Ef;

      this.beatFloor = cos_a;
      this.beatScale = sqrt(2.0 / Vf); // the 2.0 is hand-tuned

      var a = 2*pi*this.phase;
      this.beat = this.beatScale * max(0, cos(a) - this.beatFloor);

      tasks[this._id = taskCount++] = this;
      //log('created task ' + taskCount);
    };

    Task.prototype = {

      poll : function () {
        var m = this.mass;
        var mb = m * this.beat;
        var a = 2 * pi * (this.phase + this.offset);
        var f = new Complex(mb * cos(a), mb * sin(a));
        return new Poll(m, f);
      },

      update : function (force) {

        var dt = bound(1, 1000, _evalTime - this.time);
        this.time = _evalTime;

        var a = 2 * pi * (this.phase + this.offset); // XXX is this right?
        var z = new Complex(cos(a), sin(a));
        var bend = this.beat * Complex.cross(z, force);

        var minDphase = 0.1; // hand-tuned
        var dphase = this.freq * max(minDphase, 1 + bend) * dt;
        var phase = this.phase += dphase;

        if (phase < 1) {
          a = 2 * pi * phase;
          this.beat = this.beatScale * max(0, cos(a) - this.beatFloor);
        } else {
          delete tasks[this._id];
          try { this.action(); }
          catch (err) { _error(err); }
        }
      }
    };

    var updateTasks = function () {
      if (!$.isEmptyObject(tasks)) {

        var poll = new Poll();
        for (var i in tasks) {
          poll.iadd(tasks[i].poll());
        }
        var force = poll.mean();

        _evalTime = Date.now();
        for (var i in tasks) {
          tasks[i].update(force);
        }
      }

      setTimeout(updateTasks, 1);
    };

    var initUpdating = function () {
      initUpdating = undefined;
      updateTasks();
    };

    _sync = function (params, action) {
      new Task(params, action);
      if (initUpdating) initUpdating();
    };

    _sync.clear = function () {
      for (var i in tasks) {
        delete tasks[i];
      }
    };

  })();

  //----------------------------------------------------------------------------
  // Graphics

  var _context2d;

  var _draw2d = function () {
    var d = _context2d;
    d.clearRect(0, 0, d.canvas.width, d.canvas.height);
    return d;
  };

  var _initGraphics = function (canvas2d) {

    try {
      _context2d = canvas2d.getContext('2d');
      assert(_context2d, 'failed to get 2d canvas context');

      $(window).resize(function(){
            windowW = _context2d.canvas.width = window.innerWidth;
            windowH = _context2d.canvas.height = window.innerHeight;
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
    initShadow: live.initShadow,
    clear: _clear,

    setSource: live.setSource,
    getSource: live.getSource,

    print: _print,
    error: _error,

    toggleCompiling: _toggleCompiling,
    oncompile: live.oncompile,
    clear: _clear,

    now: function () { return _evalTime; },

    // TODO these should have keyword syntax like
    // after({delay:0.5, action:myFunction});
    // sync({delay:1.0, syncopate:0.5, action:myFunction})
    after: _after,
    sync: _sync,

    draw2d: _draw2d,

    none: undefined,
  };
})();

//------------------------------------------------------------------------------
// Glogal utilities

var print = live.print;
var error = live.error;

var clear = live.clear;

var now = live.now;
var after = live.after;
var sync = live.sync;

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

var draw2d = live.draw2d;

//------------------------------------------------------------------------------
// Global tools for livecoding

// Time - units are milliseconds and kHz
// once{...} evaluates once, then decays to the inert nonce{...}
// var live; // a place store variables while live coding
var now;//() time of event evaluation (a little before Date.now())
var after;//(delay, action); schedule an event
var sync;//({delay,syncopate=0,mass=1,acuity=3}, action)
         //  schedule a coupled event

// Utility
var print;//(message) logs normal message
var error;//(message) logs error message
var help;//(object) gets help about object
var dir;//(object) lists properties of an object
var clear;//() clears workspace and canvas

// Graphics
var windowW = 0, windowH = 0; // window inner width,height in pixels
var mouseX = 0, mouseY = 0;   // mouse coords in pixels
var draw2d;                   // clears & returns the 2d canvas context

// Audio
var sampleRate = 22.05; // in kHz
var middleC = 0.261625565; // in kHz
var play;//(seq:Uint8Array) plays an audio sequence (mono 8bit 22050Hz)
var tone;//(freqkHz, durationMs) returns a sequence for a single tone
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
var acos  = Math.acos;     var inf     = 1 / 0;
var atan  = Math.atan;     var nan     = 0 / 0;
var atan2 = Math.atan2;    
var max   = Math.max;      var floor   = Math.floor;
var min   = Math.min;      var ceil    = Math.ceil; 
var abs   = Math.abs;      var round   = Math.round;

var bound  = function (lb,ub,x) { return max(lb,min(ub,x)) };
var sin2pi = function (t) { return sin(2*pi*t) };
var cos2pi = function (t) { return cos(2*pi*t) };
var tan2pi = function (t) { return tan(2*pi*t) };

var random = Math.random;
var randomStd = function () {
  return 2 * (random() + random() + random()) - 3;
};

//------------------------------------------------------------------------------
// Audio (mono 16bit 22050 Hz -- hey, it's just a browser)

tone = function (frequency, duration, gain) {
  if (gain === undefined) gain = 1;
  var data = []; // just an array
  for (var i = 0, I = duration * sampleRate; i < I; ++i) {
    var env = (I - i) / I;
    var a = 2 * pi * frequency / sampleRate * i;
    data[i] = sin(a) * gain * env;
  }
  return WavEncoder.encode(data);
};

noise = function (duration, gain) {
  if (gain === undefined) gain = 1;
  var data = []; // just an array
  for (var i = 0, I = duration * sampleRate; i < I; ++i) {
    var env = (I - i) / I;
    data[i] = (2 * random() - 1) * gain * env;
  }
  return WavEncoder.encode(data);
};

noise.band = function (param) {
  assert('frequency' in param, 'param.frequency is undefined');
  assert('bandwidth' in param, 'param.bandwidth is undefined');
  assert('duration' in param, 'param.duration is undefined');
  assert('gain' in param, 'param.gain is undefined');

  var frequency = param.frequency;
  var bandwidth = param.bandwidth;
  var duration = param.duration;
  var gain = param.gain;

  var numSamples = floor(duration * sampleRate);
  var omega = 2 * pi * frequency / sampleRate;
  var cosOmega = cos(omega);
  var sinOmega = sin(omega);
  var decay = exp(-bandwidth * frequency / sampleRate);
  var transReal = decay * cosOmega;
  var transImag = decay * sinOmega;
  var normalize = 1 - decay;
  gain *= normalize / numSamples;

  var clip = function (x) {
    var scaled = gain * x / bandwidth;
    return scaled / sqrt(1 + scaled * scaled);
  };

  var x = 0;
  var y = 0;
  var samples = [];
  for (var t = 0; t < numSamples; ++t) {
    var x0 = x;
    var y0 = y;
    x = transReal * x0 - transImag * y0 + randomStd();
    y = transReal * y0 + transImag * x0 + randomStd();
    var s = x * gain * (numSamples - t);
    samples[t] = s / sqrt(1 + s * s); // soft clip to [-1,1]
  }
  return WavEncoder.encode(samples);
};

play = function (sound, volume) {
  var audio = new Audio(sound);
  if (volume !== undefined) audio.volume = volume;
  audio.play();
};

