
var assert = function (condition, message) {
  if (!condition) throw message;
};

// server/main.js has canonical version
// client/sync.js has slave version
var Differ = function () {

  //var diff_match_patch = require('diff_match_patch').diff_match_patch;
  var dmp = new diff_match_patch();

  var diff_apply = function (baseText, newText1, diffs2) {
    var patches2 = dmp.patch_make(baseText, diffs2);
    var pair = dmp.patch_apply(patches, newText1);
    var levenshtein = 0;
    var succeeded = pair[1];
    assert.equal(succeeded.length, diffs.length);
    for (var i = 0; i < diffs.length; ++i) {
      if (!succeeded[i]) {
        levenshtein += dmp.diff_levenshtein(diffs[i]);
      }
    }
    pair[1] = levenshtein;
    return pair;
  };

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
      var pair = diff_apply(baseText, baseText, diffStack[i]);
      var baseText = pair[0];
      var levenshtein = pair[1];
      if (levenshtein !== 0) {
        console.log('fast forward failed, levenshtein = ' + levenshtein);
      }
    }
    return baseText;
  };

  this.applyPatchStack = function (baseText, patchStack) {
    for (var i = 0; i < patchStack.length; ++i) {
      var pair = dmp.patch_apply(patchStack[i], baseText);
      baseText = pair[0];
      var succeeded = pair[1];
      if (!succeeded.every()) {
        console.log('applyPatchStack patch failed');
      }
    }
    return baseText
  };

  this.threeWayMerge = function (baseText, newText1, diffs2) {

    var pair = diff_apply(baseText, newText1, diffs2);
    var merged21 = pair[0];
    var levenshtein21 = pair[1];
    if (levenshtein21 === 0) return merged21;
    console.log('merge failed on first try, levenshtein = ' + levenshtein21);

    var newText2 = dmp.patch_apply(patches2, newText1)[0];
    var diffs1 = dmp.diff_main(baseText, newText1);
    var pair = diff_apply(baseText, newText2, diffs1);
    var merged12 = pair[0];
    var levenshtein12 = pair[1];
    if (levenshtein12 === 0) return merged12;
    console.log('merge failed on second try, levenshtein = ' + levenshtein21);

    return levenshtein12 <= levenshtein21 ? merged12 : merged21;
  };
};

$(function(){

  var $editor = $('#editor');
  $editor.attr('disabled', true).text('connecting to server...');

  var differ = new Differ();

  var clientVersion = undefined;
  var clientText = undefined;
  var patchStack = [];
  var serverVersion = undefined;
  var serverText = undefined;

  var socket;
  var socket_emit = function (name) {
    console.log('emitting ' + name);
    socket.emit.apply(socket, arguments);
  };
  var socket_on = function (name, cb) {
    socket.on(name, function(){
      console.log('handling ' + name);
      cb.apply(this, arguments);
    });
  };

  var updatePatches = function () {
    var newText = $editor.val();
    if (newText !== clientText) {
      patchStack.push(differ.getPatch(clientText, newText));
      clientVersion += 1;
      clientText = newText;
    }
    pushPatches();
  };

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
    $editor.text($editor.text() + ' connected.\nupdating...');
  });

  var slowPoll = function () {
    if (slowPoll.cb) slowPoll.cb();
    slowPoll.task = setTimeout(slowPoll.task, 5000);
  };
  slowPoll.task = setTimeout(slowPoll, 5000);

  var initClient = function () {
    socket_emit('initClient');
    $editor.text($editor.text() + '\ntrying again...');
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

    socket_on('diffStack', function (data) {

      var serverBaseVersion = data.serverVersion - data.diffStack.length;
      assert(serverBaseVersion <= serverVersion &&
                                  serverVersion <= data.serverVersion,
          'bad serverVersion: ' + serverVersion);
      var diffStack = data.diffStack.slice(serverVersion - serverBaseVersion);

      var clientBaseVersion = clientVersion - patchStack.length;
      assert(clientBaseVersion <= data.clientVersion &&
                                  data.clientVersion <= clientVersion,
          'bad server.clientVersion: ' + data.clientVersion);
      patchStack = patchStack.slice(data.clientVersion - clientBaseVersion);

      serverVersion = data.serverVersion;
      serverText = differ.fastForward(serverText, diffStack);
      socket_emit('serverVersion', serverVersion); // confirm

      $editor
        .off('change') // avoid double-counting
        .text(differ.applyPatchStack(serverText, patchStack))
        .on('change', updatePatches);
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

