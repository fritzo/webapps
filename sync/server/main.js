// Version 1. http, url, querystring
/*

// TODO move to https server
// see http://nodejs.org/docs/v0.3.7/api/https.html#https.createServer

http.createServer(function (req, res) {
  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end();
    return;
  }

  var body = '';
  req.on('data', function (data) {
    body += data;
  });
  req.on('end', function () {
    var qs = querystring.parse(body);

    console.log(qs);

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(qs);
    res.end();
  });

}).listen(8080);
*/

// Version 2. express.js
/*
var express = require('express');
var io = require('socket.io');
var dmp = require('diff_match_patch');

var app = express.createServer();

app.configure(function(){
  //app.use(express.methodOverride());
  //app.use(app.router);
});

app.get('/', function(req, res){
  res.json('test');
});

app.listen(8080);

console.log('express server started at %s', app.address());

process.once('SIGUSR2', function () {
  console.log('restarting server');
  process.kill(process.pid, 'SIGUSR2'); 
});
*/

// Version 3. socket.io

process.env.NODE_ENV = 'development';

var dmp = require('diff_match_patch');
var io = require('socket.io').listen(8080);

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
    socket.emit('message', 'received ' + msg);
  });

  socket.on('disconnect', function () {
    console.log('disconnect');
  });
});

