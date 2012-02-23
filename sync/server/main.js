
process.env.NODE_ENV = 'development';

var io = require('socket.io').listen(8080);
var crypto = require('crypto');
var dmp = require('diff_match_patch');

var getHash = function (text) {
  return crypto.createHash('sha1').update(text).digest('hex');
};

io.configure(function () {
  io.set('browser client minification', 'true');
});

io.configure('development', function () {
});

io.configure('production', function () {
  io.set('browser client gzip', 'true');
});

io.sockets.on('connection', function (socket) {
  console.log('connection');

  socket.on('message', function (msg) {
    console.log('message: ' + msg);
    socket.emit('message', msg);
    socket.emit('message', ' -> ' + getHash(msg));
  });

  socket.on('disconnect', function () {
    console.log('disconnect');
  });
});

