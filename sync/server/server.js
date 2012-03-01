
// inspiration:
// http://code.google.com/p/google-mobwrite/
// https://github.com/sugyan/live-coder

// see http://nodejs.org/docs/latest/api/index.html

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
console.log('NODE_ENV = ' + process.env.NODE_ENV);

var NODESTER_PORT = 15019;
process.env.NODE_PORT = process.env.NODE_PORT || NODESTER_PORT;
console.log('NODE_PORT = ' + process.env.NODE_PORT);

// see http://nodejs.org/docs/latest/api/assert.html
//require('assert');

var assert = function (condition, message) {
  if (!condition) throw message;
};

//------------------------------------------------------------------------------
// socket.io
// see https://github.com/LearnBoost/socket.io

var channel = (function(){
  var http = require('http');
  var url = require('url');
  var fs = require('fs');
  var server = http.createServer(function (req, res) {
    if (url.parse(req.url).pathname === '/client.js') {
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      fs.createReadStream('server/client.js').pipe(res);
    } else {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.write('404 Not Found\n' + req.url);
      res.end();
    }
  }).listen(process.env.NODE_PORT);

  var io = require('socket.io').listen(server);
  io.configure(function () {
    io.enable('browser client minification');
  });
  io.configure('development', function () {
    io.set('origins', 'localhost:*');
    //io.set('authorization', function (hs, cb) {
    //  console.log('DEBUG ' + hs.headers.origin);
    //  cb(null, true);
    //});
  });
  io.configure('production', function () {
    io.set('origins', 'livecoder.net:80');
    io.set('log level', 1);
    io.enable('browser client gzip', 'true');
    io.enable('browser client etag');
    io.set('transports', [
      'websocket',
      'flashsocket',
      'htmlfile',
      'xhr-polling',
      'jsonp-polling'
    ]);
  });

  return function (name) {
    return io.of(name);
  };

})();

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

(function(){

  var code = channel('/code');

  var currentText = '';
  var history = [];
  var times = [];

  var updateHistory = function (patchStack, time) {
    var newText = patchMaster.applyPatchStack(currentText, patchStack);
    var diff = patchMaster.getDiff(currentText, newText);

    //console.log('DEBUG text = ' + newText);

    currentText = newText;
    history.push(diff);
    times.push(time);

    var clients = code.clients();
    for (var i = 0; i < clients.length; ++i) {
      clients[i].get('pushHistory', function(err,val){ val(); });
    }
  };

  var newClientId = 0;
  code.on('connection', function (socket) {
    console.log('connected to client ' + (newClientId++)
      + ' (' + code.clients().length + ' clients connected)');

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
        try {
          cb.apply(this, arguments);
        }
        catch (err) {
          console.log('Error: ' + err);
          socket.emit('error', err);
          socket.disconnect();
        }
      });
    };

    var pushHistory = function () {
      if (serverVersion === history.length) return;
      var diffStack = history.slice(serverVersion);
      console.log('STATS diffStack.length = ' + diffStack.length);
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
      socket.set('pushHistory', pushHistory);
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
      console.log('STATS patchStack.length = ' + data.patchStack.length);
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
  });

})();

//------------------------------------------------------------------------------
// Chat

(function(){

  var chat = channel('/chat');

  var users = {};
  chat.on('connection', function (socket) {

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

    var user = undefined;
    socket.on('login', function (name) {
      if (user !== undefined) return;
      if (name in users) {
        socket.emit('loginRetry', 'try another nickname');
        return;
      }
      if (name.length > 64) {
        socket.emit('loginRetry', 'enter a shorter nickname');
        return;
      }

      user = name;
      var others = []
      for (var i in users) others.push(i);
      others = others.sort().join();
      users[user] = socket;
      socket.emit('loginDone', user);
      socket.emit('message', 'joining ' + (others || '(nobody yet)'));
      socket.broadcast.emit('message', user + ' has joined');
      socket.on('message', function (text) {
        socket.broadcast.emit('message', user + ': ' + text);
      });
    });

    socket_on('disconnect', function () {
      socket.broadcast.emit('message', user + ' has left');
      delete users[user];
    });
    socket_on('reconnecting', function () {
    });
    socket_on('reconnect', function () {
    });
    socket_on('error', function (e) {
      console.log('error: ' + e);
    });
  });

})();

//------------------------------------------------------------------------------
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

