
if(1){(function(){ // MODULE

var MAX_CODE_SIZE = 8192;

var assert = function (condition, message) {
  if (!condition) throw message;
};

//------------------------------------------------------------------------------
// Patch Master
// see http://code.google.com/p/google-diff-match-patch/wiki/API

// server/main.js has canonical version
// client/sync.js has slave version
var patchMaster = (function(){

  if (this.diff_match_patch === undefined) {
    this.diff_match_patch = require('diff_match_patch').diff_match_patch;
  }
  var dmp = new diff_match_patch();

  var every = function (arg) {
    for (var i = 0; i < arg.length; ++i) {
      if (!arg[i]) return false;
    }
    return true;
  };

  var compressDiffs = function (diffs) {
    for (var i = 0; i < diffs.length; ++i) {
      var diff = diffs[i];
      if (diff[0] <= 0) {
        diff[1] = diff[1].length;
      }
    }
  };

  var expandDiffs = function (baseText, diffs) {
    var currPos = 0;
    for (var i = 0; i < diffs.length; ++i) {
      var diff = diffs[i];
      if (diff[0] <= 0) {
        var prevPos = currPos;
        currPos += diff[1];
        diff[1] = baseText.slice(prevPos, currPos);
      }
    }
  };

  return {

    getDiff: function (baseText, newText) {
      var diffs = dmp.diff_main(baseText, newText);
      dmp.diff_cleanupEfficiency(diffs); // optional
      compressDiffs(diffs);
      return diffs;
    },

    getPatch: function (baseText, newText) {
      var diffs = dmp.diff_main(baseText, newText);
      dmp.diff_cleanupEfficiency(diffs); // optional
      return dmp.patch_make(baseText, diffs);
    },

    applyDiffStack: function (baseText, diffStack) {
      for (var i = 0; i < diffStack.length; ++i) {
        var diffs = diffStack[i];
        expandDiffs(baseText, diffs);
        var patches = dmp.patch_make(baseText, diffs);
        var pair = dmp.patch_apply(patches, baseText);
        baseText = pair[0];
        if (!every(pair[1])) {
          console.log('WARNING applyDiffStack failed on step ' + i);
        }
      }
      return baseText;
    },

    applyPatchStack: function (baseText, patchStack) {
      for (var i = 0; i < patchStack.length; ++i) {
        var pair = dmp.patch_apply(patchStack[i], baseText);
        baseText = pair[0];
        if (!every(pair[1])) {
          console.log('WARNING applyPatchStack failed on step ' + i);
        }
      }
      return baseText
    }
  };
})();

//------------------------------------------------------------------------------
// Synchronization

this.syncCoder = function (args) {

  var config = {
    updateDelayMs: 5000,
    slowPollMs: 5000,
    reloadPageMs: 10000
  };

  var serverUrl = args.serverUrl;
  var getSource = args.getSource;
  var setSource = args.setSource;
  var getCursor = args.getCursor;
  var setCursor = args.setCursor;
  var onchange = args.onchange;

  setSource('// connecting to server...');

  var clientVersion = undefined;
  var clientText = undefined;
  var patchStack = [];
  var serverVersion = undefined;
  var serverText = undefined;

  var socket;
  var socket_emit = function (name) {
    console.log('code emitting ' + name);
    //if (arguments.length > 1) {
    //  console.log('  args = ' + JSON.stringify(arguments[1]));
    //}
    socket.emit.apply(socket, arguments);
  };
  var socket_on = function (name, cb) {
    socket.on(name, function(){
      console.log('code handling ' + name);
      //if (arguments.length > 0) {
      //  console.log('  args = ' + JSON.stringify(arguments[0]));
      //}
      cb.apply(this, arguments);
    });
  };

  var checkForLocalChanges = function () {
    var newText = getSource();
    assert(newText.length <= MAX_CODE_SIZE,
        'code is too big: length = ' + newText.length);
    if (newText !== clientText) {
      patchStack.push(patchMaster.getPatch(clientText, newText));
      clientVersion += 1;
      clientText = newText;
    } else {
      if (Date.now() < checkForLocalChanges.nextPush) return;
    }
    checkForLocalChanges.nextPush = Date.now() + config.updateDelayMs;
    pushPatches();
  };
  checkForLocalChanges.nextPush = config.updateDelayMs;

  var pushPatches = function () {
    if (patchStack.length) {
      socket_emit('patchStack', {
        patchStack: patchStack,
        clientVersion: clientVersion
      });
    }
  };

  console.log('connecting to server');
  socket = io.connect(serverUrl + '/code');
  socket_on('connect', function () {
    setSource(getSource() + '\n// connected.\n// updating...');
  });

  var slowPoll = function () {
    if (slowPoll.cb) slowPoll.cb();
    slowPoll.task = setTimeout(slowPoll, config.slowPollMs);
  };
  slowPoll.task = setTimeout(slowPoll, config.slowPollMs);

  var initClient = function () {
    socket_emit('initClient');
    setSource(getSource() + '\n// trying again...');
  };
  slowPoll.cb = initClient;

  socket_on('initClient', function (data) {
    slowPoll.cb = pushPatches;
    socket.on('initClient');

    serverVersion = data.version;
    serverText = data.text;
    clientVersion = 0;
    clientText = data.text;

    setSource(clientText);
    onchange(checkForLocalChanges);

    socket_on('diffStack', function (data) {

      var serverBaseVersion = data.serverVersion - data.diffStack.length;
      assert(serverBaseVersion <= serverVersion &&
                                  serverVersion <= data.serverVersion,
          'bad serverVersion: ' + serverVersion);
      var diffStack = data.diffStack.slice(serverVersion - serverBaseVersion);

      var clientBaseVersion = clientVersion - patchStack.length;
      assert(clientBaseVersion <= data.clientVersion &&
                                  data.clientVersion <= clientVersion,
          'bad clientVersion: ' + data.clientVersion);
      patchStack = patchStack.slice(data.clientVersion - clientBaseVersion);

      if (serverVersion === data.serverVersion) return;
      //console.log('DEBUG updating serverVersion '
      //  + serverVersion + ' -> ' + data.serverVersion);
      serverVersion = data.serverVersion;
      socket_emit('serverVersion', serverVersion); // confirm
      serverText = patchMaster.applyDiffStack(serverText, diffStack);

      // setting client text first prevents patching & double counting
      clientText = patchMaster.applyPatchStack(serverText, patchStack);
      if (getCursor && setCursor) {
        var oldSource = getSource();
        var oldCursor = getCursor && getCursor();
      }
      setSource(clientText);

      if (oldCursor) {
        var start = oldCursor[0];
        var end = oldCursor[1];
        assert(0 <= start && start <= end && end <= oldSource.length,
            'bad cursor: [' + start + ', ' + end + ']');

        var diff = patchMaster.getDiff(oldSource, clientText);
        var oldPos = 0;
        var newPos = 0;
        for (var i = 0, moveStart = true, moveEnd = true; moveEnd; ++i) {
          var part = diff[i];
          var parity = part[0];
          var length = part[1];
          if (length.length) length = length.length;

          if (parity <= 0) { // deletion or equal
            if (moveStart && oldPos <= start && start <= oldPos + length) {
              start += newPos - oldPos;
              moveStart = false;
            }
            if (moveEnd && oldPos <= end && end <= oldPos + length) {
              end += newPos - oldPos;
              moveEnd = false;
            }
            oldPos += length;
          }

          if (parity >= 0) { // insertion or equal
            newPos += length;
          }
        }

        setCursor([start, end]);
      }

      //console.log('DEBUG text = ' + clientText);
    });
  });

  // TODO deal with dropped connections, eg initClient
  socket_on('disconnect', function () {
    window.location.reload(); // HACK TODO do this more gracefully
  });
  socket_on('reconnecting', function () {
  });
  socket_on('reconnect', function () {
  });
  socket_on('error', function (e) {
    console.log('error: ' + e);
  });

  return {
    close: function () {
      socket.disconnect();

      slowPoll.cb = undefined;
      clearTimeout(slowPoll.task);

      clientText = '';
      setSource = function () {};
      getSource = function () { return clientText; };
    }
  };
};

this.syncCoder.MAX_CODE_SIZE = MAX_CODE_SIZE;

//----------------------------------------------------------------------------
// Chat

this.syncChatter = function (args) {

  var serverUrl = args.serverUrl
  var $write = args.$write.removeAttr('readonly');
  var $read = args.$read.attr('readonly', true);
  var onlogin = args.onlogin || function(){};

  var socket = io.connect(serverUrl + '/chat');
  var socket_emit = function (name) {
    console.log('chat emitting ' + name);
    //if (arguments.length > 1) {
    //  console.log('  args = ' + JSON.stringify(arguments[1]));
    //}
    socket.emit.apply(socket, arguments);
  };
  var socket_on = function (name, cb) {
    socket.on(name, function(){
      console.log('chat handling ' + name);
      //if (arguments.length > 0) {
      //  console.log('  args = ' + JSON.stringify(arguments[0]));
      //}
      cb.apply(this, arguments);
    });
  };

  var show = function (text) {
    $read.val($read.val() + '\n- ' + text);
  };
  var submit = function (text) {
    // do nothing until connected
  };
  $write.on('keydown', function (e) {
    var ENTER = 13;
    if (e.which === ENTER) {
      submit($write.val());
      $write.val('');
      e.preventDefault();
    }
  });

  $read.val('connecting...');
  $write.val('');
  socket_on('connect', function () {
    $read.val('enter a nickname');
    $write.focus();

    submit = function (text) {
      text = $.trim(text);
      text = text.replace(/\s*\n\s*/g,'\n');
      if (text.length > 32) {
        $read.val('enter a shorter nickname');
        $write.focus();
      } else if (text.length === 0) {
        $read.val('enter a longer nickname');
        $write.focus();
      } else {
        socket_emit('login', text);
        $read.val('logging in...');
      }
    };
  });

  socket_on('loginRetry', function (text) {
    $read.val(text);
  });

  socket_on('loginDone', function (name) {
    $read.val('- logged in as ' + name);
    submit = function (text) {
      text = $.trim(text);
      text = text.replace(/\s*\n\s*/g,'\n');
      if (text.length === 0) return;
      socket_emit('message', text);
      show(name + ': ' + text);
    };
    socket_on('message', show);
    onlogin(name);
  });

  // TODO deal with dropped connections
  socket_on('disconnect', function () {
    window.location.reload(); // HACK TODO do this more gracefully
  });
  socket_on('reconnecting', function () {
  });
  socket_on('reconnect', function () {
  });
  socket_on('error', function (e) {
    console.log('error: ' + e);
  });

  return {
    close: function () {
      socket.disconnect();

      $read.val('');
      $write.val('');
      onlogin = function () {};
    }
  };
};

})();} // MODULE

