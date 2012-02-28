
(function(){ // MODULE

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

  return {

    getDiff: function (baseText, newText) {
      var diffs = dmp.diff_main(baseText, newText);
      dmp.diff_cleanupEfficiency(diffs); // optional
      return diffs;
    },

    getPatch: function (baseText, newText) {
      var diffs = dmp.diff_main(baseText, newText);
      dmp.diff_cleanupEfficiency(diffs); // optional
      return dmp.patch_make(baseText, diffs);
    },

    applyDiffStack: function (baseText, diffStack) {
      for (var i = 0; i < diffStack.length; ++i) {
        var patches = dmp.patch_make(baseText, diffStack[i]);
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

this.syncTextarea = function (args) {

  var config = {
    updateDelayMs: 5000,
    slowPollMs: 5000,
    reloadPageMs: 10000
  };

  var setSource = args.setSource;
  var getSource = args.getSource;
  var onchange = args.onchange;
  var serverUrl = args.serverUrl || 'http://localhost:8080'

  setSource('connecting to server...');

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

  var updatePatches = function () {
    var newText = getSource();
    if (newText !== clientText) {
      patchStack.push(patchMaster.getPatch(clientText, newText));
      clientVersion += 1;
      clientText = newText;
    } else {
      if (Date.now() - updatePatches.lastPush < config.updateDelayMs) return;
    }
    updatePatches.lastPush = Date.now();
    pushPatches();
  };
  updatePatches.lastPush = 0;

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
    setSource(getSource() + '// connected.\n// updating...');
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
    onchange(updatePatches);

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
      setSource(clientText);

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
};

//----------------------------------------------------------------------------
// Chat

this.syncChatter = function (args) {

  var $write = args.$write.removeAttr('readonly');
  var $read = args.$read.attr('readonly', true);
  var serverUrl = args.serverUrl || 'http://localhost:8080'

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
    $read.val($read.val() + '\n\n' + text);
  };
  var submit = function (text) {};
  $write.on('keyup', function (e) {
    var ENTER = 13;
    if (e.which === ENTER) {
      submit($.trim($write.val()));
      $write.val('');
      e.preventDefault();
    }
  });

  socket_on('connect', function () {
    $read.val('enter nickname');
    $write.val('');

    submit = function (text) {
      if (text.length > 64) {
        $read.val('enter a shorter nickname');
      } else if (text.length === 0) {
        $read.val('enter a longer nickname');
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
    $read.val('logged in as ' + name);
    submit = function (text) {
      if (text.length === 0) return;
      socket_emit('message', text);
      show(name + ': ' + text);
    };
    socket_on('message', show);
  });
};

})(); // MODULE

