/**
 * Active unit testing.
 * (see notesting.js for inactive testing)
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var testing = false;

/** @const */
var test = function (title, callback) {
  callback = callback || function(){ globalEval(title); };
  callback.title = title;
  test._all.push(callback);
};
test._all = [];
test.runAll = function () {

  // TODO remove dependency on jQuery
  $('<style type=text/css>#testLog p{margin: 0px;}</style>').appendTo('head');
  var $log = $(document.createElement('div'))
    .attr('id', 'testLog')
    .css({
          position: 'absolute',
          width: '80%',
          left: '10%',
          color: 'black',
          'background-color': 'white',
          border: 'solid 8px white',
          'border-radius': '16px',
          opacity: '0.9',
          'font-size': '10pt',
          'font-family': 'Courier,Courier New,Nimbus Mono L,fixed,monospace',
          'z-index': '99'
        })
    .appendTo('body');

  var oldLog = log;
  log = function (message) {
    $(document.createElement('pre')).text(message).appendTo($log);
    oldLog(message);
  };

  log('[ Running ' + test._all.length + ' unit tests ]');
  testing = true;

  var failCount = 0;
  for (var i = 0; i < test._all.length; ++i) {
    var callback = test._all[i];
    try {
      callback();
    }
    catch (err) {
      log('FAILED ' + callback.title + '\n  ' + err);
      failCount += 1;
    }
  }

  if (failCount) {
    log('[ failed ' + failCount + ' tests ]');
    $log.css({
          'background-color': '#ffaaaa',
          'border-color': '#ffaaaa'
        });
  } else {
    log('[ passed all tests :) ]');
    $log.css({
          'background-color': '#aaffaa',
          'border-color': '#aaffaa'
        });
  }
};

