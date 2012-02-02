/**
 * The Rational Drums
 * http://fritzo.org/drums
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

importScripts('../common/safety.js');
importScripts('../common/notesting.js');
importScripts('../common/rational.js');
importScripts('../common/ratgrid.js');
importScripts('../common/massvector.js');

//------------------------------------------------------------------------------
// Commands

var init = function (data) {
  var profileStart = Date.now();

  self.acuity = data['acuity'];
  self.driftRate = data['driftRate'];

  self.grids = data['gridArgs'].map(function(a){
        return new RatGrid(new Rational(a[0], a[1]), new Rational(a[2],a[3]));
      });

  self.amps = new MassVector(data['amps']);
  assertEqual(self.amps.likes.length, self.grids.length,
      'amps vector has wrong size:');

  var I = self.grids.length
  var energyMatrix = self.energyMatrix = new Array(I);
  for (var i = 0; i < I; ++i) {
    var row = energyMatrix[i] = new Array(I);
    for (var j = 0; j < I; ++j) {
      row[j] = RatGrid.distance(self.grids[i], self.grids[j]);
    }
  }

  self.profileCount = 0;
  self.profileElapsedMs = 0;

  self.initialized = true;
  log('initialized in ' + ((Date.now() - profileStart) / 1000) + ' sec');
};

var getEnergy = function (mass) {
  var energyMatrix = self.energyMatrix;
  var freqEnergy = energyMatrix[0];
  var energyScale = 1 / mass.total() / self.acuity;
  var energy = [];
  for (var i = 0, I = mass.likes.length; i < I; ++i) {
    energy[i] = energyScale * mass.dot(energyMatrix[i]);
  }
  return energy;
};

var update = function (data) {
  assert(self.initialized, 'worker has not been initialized');

  var dt = data['dt'];
  assert(0 <= dt, 'bad timestep: ' + dt);

  var damps = data['damps'];
  assertEqual(damps.length, self.amps.likes.length,
      'damps vector has wrong size:');

  var acuity = self.acuity;
  var driftRate = self.driftRate;
  var grids = self.grids;
  var amps = self.amps;
  var likes = self.amps.likes;

  for (var i = 0, I = likes.length; i < I; ++i) {
    likes[i] += damps[i];
  }

  var energy = getEnergy(self.amps);
  var prior = MassVector.boltzmann(energy, self.acuity);
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

