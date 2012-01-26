/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

importScripts('../common/workerlogger.js');
importScripts('../common/safety.js');
importScripts('../common/notesting.js');
importScripts('../common/rational.js');
importScripts('../common/ratgrid.js');
importScripts('../common/massvector.js');

//------------------------------------------------------------------------------
// Commands

var init = function (data) {

  self.temperature = data['temperature'];
  self.driftRate = data['driftRate'];

  self.grids = data['gridArgs'].map(function(a){
        return new RatGrid(new Rational(a[0], a[1]), new Rational(a[2],a[3]));
      });

  self.amps = new MassVector(data['amps']);
  assertEqual(self.amps.likes.length, self.grids.length,
      'amps vector has wrong size:');

  // TODO initialize energy matrix

  // DEBUG self.prior should be recomputed each update, as below
  var initEnergy = self.grids.map(function(g){ return g.norm(); });
  self.prior = MassVector.boltzmann(initEnergy, self.temperature);

  self.profileCount = 0;
  self.profileElapsedMs = 0;

  self.initialized = true;
};

var update = function (data) {
  assert(self.initialized, 'worker has not been initialized');

  var dt = data['dt'];
  assert(0 <= dt, 'bad timestep: ' + dt);

  var damps = data['damps'];
  assertEqual(damps.length, self.amps.likes.length,
      'damps vector has wrong size:');

  var temperature = self.temperature;
  var driftRate = self.driftRate;
  var grids = self.grids;
  var amps = self.amps;
  var likes = self.amps.likes;

  for (var i = 0, I = likes.length; i < I; ++i) {
    likes[i] += damps[i];
  }

  // TODO compute boltzmann distrubution WRT energy matrix
  var prior = self.prior; // DEBUG, should be WRT energy matrix
  var drift = 1 - Math.exp(-dt / driftRate);
  amps.shiftTowards(prior, drift);

  return amps.likes;
};

//------------------------------------------------------------------------------
// Main message handler

self.addEventListener('message', function (e) {
  try {
    var data = e['data'];
    switch (data['cmd']) {

      case 'init':
        init(data['data']);
        break;

      case 'update':
        var profileStartTime = Date.now();
        var amps = update(data['data']);
        self.profileCount += 1;
        self.profileElapsedMs += Date.now() - profileStartTime;
        self.postMessage({'type':'update', 'data':amps});
        break;

      case 'profile':
        var meanTime = self.profileElapsedMs / self.profileCount / 1000;
        log('mean update time = ' + meanTime.toFixed(3));
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    self.postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

