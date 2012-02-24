
// inspiration:
// http://code.google.com/p/google-mobwrite/
// https://github.com/sugyan/live-coder

// see http://nodejs.org/docs/latest/api/index.html

process.env.NODE_ENV = 'development';

// see http://nodejs.org/docs/latest/api/assert.html
//require('assert');

var assert = function (condition, message) {
  if (!condition) throw message;
};

var every = function (arg) {
  for (var i = 0; i < arg.length; ++i) {
    if (!arg[i]) return false;
  }
  return true;
};

//------------------------------------------------------------------------------
// societ.io
// see https://github.com/LearnBoost/socket.io

var io = require('socket.io').listen(8080);
io.configure(function () {
  io.set('browser client minification', 'true');
});
io.configure('development', function () {
});
io.configure('production', function () {
  io.set('browser client gzip', 'true');
});

//------------------------------------------------------------------------------
// mongodb via mongoose
// see http://mongoosejs.com/

/* TODO

(function(){

  var mongoose = require('mongoose').Mongoose;
  var db = mongoose.connect('mongodb://localhost/sync');
  console.log('db collections: ' + b.getCollectionNames());

  var Frame = new (mongoose.Schema)({
    history: mongoose.Schema.ObjectId,
    index: {type:Number, index:true },
    time: Date,
    diffs: [String]
  });

  var History = new (mongoose.Schema)({
    name: { type:String, index: { unique:true } },
    frameCount: Number
  });


  var model = mongoose.model('History', History);

})(); 

*/

//------------------------------------------------------------------------------
// Differ
// see http://code.google.com/p/google-diff-match-patch/wiki/API

// server/main.js has canonical version
// client/sync.js has slave version
var Differ = function () {

  var diff_match_patch = require('diff_match_patch').diff_match_patch;
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
      if (!every(succeeded)) {
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

//------------------------------------------------------------------------------
// see http://nodejs.org/docs/v0.3.1/api/crypto.html#hash.update

/*
var crypto = require('crypto');
var getHash = function (text) {
  return crypto.createHash('sha1').update(text).digest('hex');
};
*/

var syncToSocket = (function(){

  var differ = new Differ();

  /*
  var History = function () {
    this._text = '';
    this._frames = [];
  };

  History.prototype = {

    getLength: function () {
      return this._frames.length - 1;
    },

    getFrame: function (index) {
      assert(0 <= index && index < this._frames.length,
        'frame index out of bounds: ' + index);
      return this._frames[index];
    },

    addFrame: function (newText, time) {
      time = time || Date.now();
      if (newText === this._text) return;

      var diffs = differ.getDiff(this._text, newText);

      var index = this._frames.length;
      this._text = newText;
      this._frames[index] = {
        index: index,
        time: time,
        diffs: diffs,
        text: text // TODO OPTIMIZE clean out text when done
      };

      io.sockets.emit('pushDiff', {index:index, diffs:diffs});
    }
  };

  var history = new History();
  */

  var currentText = '';
  var history = [];
  var historyObservers = {};

  var updateHistory = function (patchStack, time) {
    var newText = differ.applyPatchStack(currentText, patchStack);
    var diff = differ.getDiff(currentText, newText);

    currentText = newText;
    history.push({time:time, diff:diff});

    for (var key in historyObservers) {
      historyObservers[key]();
    }
  };

  var newSocketId = 0;
  return function (socket) {

    var id = newSocketId++;
    var serverVersion = history.length;
    var serverText = currentText;
    var clientVersion = 0;
    var clientText = currentText;

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

    var pushHistory = function () {
      if (serverVersion === history.length) return;
      var diffStack = history.slice(serverVersion);
      socket_emit('diffStack', {
        serverVersion: serverVersion,
        clientVersion: clientVersion,
        diffStack: diffStack
      });
    };

    var initClient = function () {
      socket_emit('initClient', {
        version: serverVersion,
        text: serverText
      });
      historyObservers[id] = pushHistory;
    };
    initClient();
    socket_on('initClient', initClient);

    socket_on('serverVersion', function (version) {
      assert(serverVersion <= version, 'bad version: ' + version);
      serverVersion = version;
    });

    socket_on('patchStack', function (data) {
      var time = Date.now();

      var clientBase = data.clientVersion - data.patchStack.length;
      assert(clientBase <= clientVersion &&
                           clientVersion <= data.clientVersion,
          'bad clientVersion: ' + clientVersion);
      var patchStack = data.patchStack.slice(clientVersion - clientBase);

      updateHistory(patchStack, time);
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
  };
})();

io.sockets.on('connection', function (socket) {
  console.log('connected to client');
  syncToSocket(socket);
});

// clean exit

var cleanExit = function () {
  console.log('restarting server');
};

process.once('SIGUSR2', function () {
  cleanExit();
  process.kill(process.pid, 'SIGUSR2'); 
});
/*
process.on('exit', cleanExit);
*/

