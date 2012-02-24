
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
  var times = [];
  var historyObservers = {};

  var updateHistory = function (patchStack, time) {
    var newText = differ.applyPatchStack(currentText, patchStack);
    var diff = differ.getDiff(currentText, newText);

    //console.log('DEBUG text = ' + newText);

    currentText = newText;
    history.push(diff);
    times.push(time);

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
        serverVersion: history.length,
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
      //console.log('DEBUG updating serverVersion '
      //  + serverVersion + ' -> ' + version);
      serverVersion = version;
    });

    socket_on('patchStack', function (data) {
      var time = Date.now();

      var clientBase = data.clientVersion - data.patchStack.length;
      assert(clientBase <= clientVersion &&
                           clientVersion <= data.clientVersion,
          'bad clientVersion: ' + clientVersion);
      var patchStack = data.patchStack.slice(clientVersion - clientBase);
      //console.log('DEBUG updating clientVersion '
      //  + clientVersion + ' -> ' + data.clientVersion);
      clientVersion = data.clientVersion;

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

var clientId = 0;
io.sockets.on('connection', function (socket) {
  console.log('connected to client ' + (clientId++)
    + ' (' + io.sockets.clients().length + ' clients connected)');
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

