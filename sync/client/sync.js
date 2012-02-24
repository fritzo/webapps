
var assert = function (condition, message) {
  if (!condition) throw message;
};

var every = function (arg) {
  for (var i = 0; i < arg.length; ++i) {
    if (!arg[i]) return false;
  }
  return true;
};

// server/main.js has canonical version
// client/sync.js has slave version
var Differ = function () {

  //var diff_match_patch = require('diff_match_patch').diff_match_patch;
  var dmp = new diff_match_patch();

  this.getDiff = function (baseText, newText) {
    var diffs = dmp.diff_main(baseText, newText);
    dmp.diff_cleanupEfficiency(diffs); // optional
    return diffs;
  };

  this.getPatch = function (baseText, newText) {
    var diffs = dmp.diff_main(baseText, newText);
    dmp.diff_cleanupEfficiency(diffs); // optional
    return dmp.patch_make(baseText, diffs);
  };

  this.fastForward = function (baseText, diffStack) {
    for (var i = 0; i < diffStack.length; ++i) {
      var patches = dmp.patch_make(baseText, diffStack[i]);
      var pair = dmp.patch_apply(patches, baseText);
      baseText = pair[0];
      if (!every(pair[1])) {
        console.log('fastForward failed on step ' + i);
      }
    }
    return baseText;
  };

  this.applyPatchStack = function (baseText, patchStack) {
    for (var i = 0; i < patchStack.length; ++i) {
      var pair = dmp.patch_apply(patchStack[i], baseText);
      baseText = pair[0];
      if (!every(pair[1])) {
        console.log('applyPatchStack failed on step ' + i);
      }
    }
    return baseText
  };
};

$(function(){

  var $editor = $('#editor');
  $editor.attr('disabled', true).val('connecting to server...');

  if (window.io === undefined) {
    $editor.val('server is down...');
    setTimeout(function(){ window.location.reload() }, 60000);
    return;
  }

  var differ = new Differ();

  var clientVersion = undefined;
  var clientText = undefined;
  var patchStack = [];
  var serverVersion = undefined;
  var serverText = undefined;

  var socket;
  var socket_emit = function (name) {
    console.log('emitting ' + name);
    //if (arguments.length > 1) {
    //  console.log('  args = ' + JSON.stringify(arguments[1]));
    //}
    socket.emit.apply(socket, arguments);
  };
  var socket_on = function (name, cb) {
    socket.on(name, function(){
      console.log('handling ' + name);
      //if (arguments.length > 0) {
      //  console.log('  args = ' + JSON.stringify(arguments[0]));
      //}
      cb.apply(this, arguments);
    });
  };

  var updatePatches = function () {
    var newText = $editor.val();
    if (newText !== clientText) {
      patchStack.push(differ.getPatch(clientText, newText));
      clientVersion += 1;
      clientText = newText;
    } else {
      if (Date.now() - updatePatches.lastPush < 5000) return;
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
  socket = io.connect('http://localhost:8080');
  socket_on('connect', function () {
    $editor.val($editor.val() + ' connected.\nupdating...');
  });

  var slowPoll = function () {
    if (slowPoll.cb) slowPoll.cb();
    slowPoll.task = setTimeout(slowPoll.task, 5000);
  };
  slowPoll.task = setTimeout(slowPoll, 5000);

  var initClient = function () {
    socket_emit('initClient');
    $editor.val($editor.val() + '\ntrying again...');
  };
  slowPoll.cb = initClient;

  socket_on('initClient', function (data) {
    slowPoll.cb = pushPatches;
    socket.on('initClient');

    serverVersion = data.version;
    serverText = data.text;
    clientVersion = 0;
    clientText = data.text;

    $editor.val(clientText).removeAttr('disabled');
    $editor.on('change', updatePatches);
    $editor.on('keyup', updatePatches);
    $editor.on('click', updatePatches);

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

      socket_emit('serverVersion', serverVersion); // confirm
      if (serverVersion === data.serverVersion) return;
      //console.log('DEBUG updating serverVersion '
      //  + serverVersion + ' -> ' + data.serverVersion);
      serverVersion = data.serverVersion;
      serverText = differ.fastForward(serverText, diffStack);

      clientText = differ.applyPatchStack(serverText, patchStack);
      $editor // avoid double-counting
        .off('change')
        .off('keyup')
        .off('click')
        .val(clientText)
        .on('change', updatePatches)
        .on('keyup', updatePatches)
        .on('click', updatePatches);

      //console.log('DEBUG text = ' + clientText);
    });
  });

  // TODO deal with dropped connections, eg initClient
  socket_on('disconnect', function () {
  });
  socket_on('reconnecting', function () {
  });
  socket_on('reconnect', function () {
  });
  socket_on('error', function (e) {
    console.log('error: ' + e);
  });

});

