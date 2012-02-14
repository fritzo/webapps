/**
 * LiveCoder.net
 * http://livecoder.net
 * http://github.com/fritzo/livecoder.net
 *
 * Livecoder is toolset to make browser-based javascript live coding easy.
 * It includes a language extension, and a live coding editor.
 *
 * Requires:
 * - a textarea for source editing
 * - a textarea for print/warn/error logging
 * - a button for status indication
 * - a canvas for 2d drawing
 * - jQuery
 * - CodeMirror2 (see compression api http://codemirror.net/doc/compress.html)
 *   - lib/util/simple-hint.js
 *   - lib/util/javascript-hint.js
 *   - lib/util/searchcursor.js
 *   - lib/util/search.js
 *   - lib/util/dialog.js
 *   - lib/util/dialog.css
 *   - lib/util/simple-hint.css
 *   - lib/codemirror.js
 *   - mode/javascript/javascript.js (modified for livecoder)
 *
 * Provides:
 * - an object 'live'
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

var live = (function(){

  var runPollMs = 250;
  var runLoopMs = 1;

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
      extraKeys: {
        'Ctrl-Space': function (cm) {
          CodeMirror.simpleHint(cm, CodeMirror.javascriptHint);
        }
      }
    });

    // this is required for full screen
    var scroller = _codemirror.getScrollerElement();
    scroller.style.height = '100%';
    scroller.style.width = '100%';

    _codemirror.setValue(args.initSource || live.logo);

    _$status.css('background-color', 'green');

    _initGraphics(args.canvas2d);

    _startCompiling();
    _startAlways();
  };

  live.logo = [
      "// Hello World",
      "// i am live code",
      "// try changing me",
      "",
      "context.font = 'bold 80px Courier';",
      "context.fillStyle = '#55aa55';",
      "context.textAlign = 'center';",
      "",
      "run.hello = function () {",
      "",
      "  var x = 1/8 * mouseX + 3/8 * innerWidth;",
      "  var y = 1/8 * mouseY + 3/8 * innerHeight;",
      "",
      "  x += Math.sin(Date.now() / 500) * 10;",
      "  y += Math.cos(Date.now() / 500) * 10;",
      "",
      "  context.clearRect(0, y-80, innerWidth, 160);",
      "  context.fillText('Hello World!', x, y);",
      "};",
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
  var _startAlways;

  (function(){

    var compiling = false;
    var vars = {};
    var run = {};

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
        // alternatively, use jQuery.globalEval(...)
        compiled = globalEval(
            '"use strict";\n' +
            '(function(' +
                  'vars, run, clear, setTimeout,' +
                  'help, print, error, context' +
                '){\n' +
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
        setTimeout(_compileSource, 0);
      }

      _success();

      try {
        compiled(
            vars, run, _clear, _setTimeout,
            _help, _print, _error, _context2d);
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
      for (var key in vars) {
        delete vars[key];
      }
      for (var key in run) {
        delete run[key];
      }
    };

    var runTask = function () {
      if ($.isEmptyObject(run)) {
        setTimeout(runTask, runPollMs);
      } else {
        for (var key in run) {
          try {
            run[key]();
          }
          catch (err) {
            _error(err);
          }
        }
        setTimeout(runTask, runLoopMs);
      }
    };

    _startAlways = function () {
      _startAlways = function () {};
      runTask();
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

  //--------------------------------------------------------------------------
  // Help

  var _dir = function (o) {
    if (o instanceof Array ||
        o instanceof Uint8Array) {
      return '[]';
    }
    o = o || window;
    var a = [], i = 0;
    for (a[i++] in o);
    return a;
  };

  var _help = function (o) {
    o = o || _help;
    _print(('help' in o ? o.help + '\n\n' : '')
        + _dir(o) + '\n\n'
        + o.toString());
  };
  _help.help = 'try help(someFunction), or see the help window';

  //--------------------------------------------------------------------------
  // Using external scripts

  // XXX TODO this is not working yet

  var _using;

  (function(){

    var cached = {};

    _using = function (url) {

      if (url in cached) return;

      // see http://stackoverflow.com/questions/2723140
      // XXX ff does not support extended regexp: "invalid reg. exp. flag x"
      //assert(/^(http|https|ftp):\/\/[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/ix.test(url),
      //  'invalid url: ' + url);

      assert(/\.js$/.test(url), 'url extension is not .js: ' + url);

      $.ajax({ url:url, dataType:'script', cache:true })
        .done(function (script, textStatus) {
              cached[url] = true;
              _print(textStatus);
            })
        .fail(function(jqxhr, settings, exception) {
              cached[url] = false;
              _print('Ajax error: ' + exception);
            });
    };

  })();

  //----------------------------------------------------------------------------
  // Graphics

  var _context2d;
  window.mouseX = 0;
  window.mouseY = 0;

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

