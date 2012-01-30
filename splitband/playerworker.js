/**
 * Spliband
 * http://fritzo.org/splitband
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
// Data

var pitchAcuity;
var tempoAcuity;
var sharpness;
var attackSec;
var sustainSec;
var grooveSec;

var freqs;
var grids;

var F;
var G;
var FG;

var energy;
var massG;
var massFG;
var interMassFG;
var tempoEnergyG;
var pitchEnergyFG;

var distanceFF;
var distanceGG;
var interferenceGG;

var amps;
//var ampsFG;
//var ampsGF;

var profileCount = 0;
var profileElapsedMs = 0;
var initialized = false;

//------------------------------------------------------------------------------
// Methods

var init = function (data) {
  var profileStart = Date.now();

  pitchAcuity = data['pitchAcuity'];
  tempoAcuity = data['tempoAcuity'];
  sharpness = data['sharpness'];
  attackSec = data['attackSec'];
  sustainSec = data['sustainSec'];
  grooveSec = data['grooveSec'];

  freqs = data['freqArgs'].map(function(a){
        return new Rational(a[0],a[1]);
      });
  grids = data['gridArgs'].map(function(a){
        return new RatGrid(new Rational(a[0], a[1]), new Rational(a[2],a[3]));
      });

  F = freqs.length;
  G = grids.length;
  FG = F * G;

  amps = new MassVector(data['amps']);
  assertLength(amps.likes, FG, 'amps');

  energy = new Array(FG);
  massG = new Array(G);
  massFG = new Array(F);
  interMassFG = new Array(F);
  tempoEnergyG = new Array(G);
  pitchEnergyFG = new Array(F);
  for (var f = 0; f < F; ++f) {
    massFG[f] = new Array(G);
    interMassFG[f] = new Array(G);
    pitchEnergyFG[f] = new Array(G);
  }

  distanceFF = new Array(F);
  for (var f1 = 0; f1 < F; ++f1) {
    var distanceRow = distanceFF[f1] = new Array(F);
    for (var f2 = 0; f2 < F; ++f2) {
      distanceRow[f2] = Rational.distance(freqs[f1], freqs[f2]) / pitchAcuity;
    }
  }
  interferenceGG = new Array(G);
  distanceGG = new Array(G);
  for (var g1 = 0; g1 < G; ++g1) {
    var distanceRow = distanceGG[g1] = new Array(G);
    var interRow = interferenceGG[g1] = new Array(G);
    for (var g2 = 0; g2 < G; ++g2) {
      distanceRow[g2] = RatGrid.distance(grids[g1], grids[g2]) / tempoAcuity;
      interRow[g2] = RatGrid.interference(grids[g1], grids[g2], sharpness);
    }
  }

  initialized = true;
  log('initialized in ' + ((Date.now() - profileStart) / 1000) + ' sec');
};

var getEnergy = function (mass) {

  assertLength(mass, FG, 'mass');

  // mass vector --> normalized mass matrix,
  //                 normalized projected mass vector
  var total = 0;
  for (var fg = 0; fg < FG; ++fg) {
    total += mass[fg];
  }
  assert(total > 0.5, 'unexpectedly low mass: ' + total);
  var normalize = 1 / total;
  for (var g = 0; g < G; ++g) {
    massG[g] = 0;
  }
  for (var f = 0; f < F; ++f) {
    var massRow = massFG[f];
    for (var g = 0; g < G; ++g) {
      massG[g] += massRow[g] = normalize * mass[G * f + g];
    }
  }

  // E_tempo(g) = sum g'. (sum f. mass(f,g')) distance(g,g')
  for (var g1 = 0; g1 < G; ++g1) {
    var distanceRow = distanceGG[g1];
    var sum = 0;
    for (var g2 = 0; g2 < G; ++g2) {
      sum += massG[g2] * distanceRow[g2];
    }
    tempoEnergyG[g1] = sum;
  }

  // interMass(f,g) = sum g'. inter(g,g') mass(f,g')
  for (var f = 0; f < F; ++f) {
    var massRow = massFG[f];
    var interMassRow = interMassFG[f];
    for (var g1 = 0; g1 < G; ++g1) {
      var interRow = interferenceGG[g1];
      var sum = 0;
      for (var g2 = 0; g2 < G; ++g2) {
        sum += interRow[g2] * massRow[g2];
      }
      interMassRow[g1] = sum;
    }
  }

  // E_pitch(f,g) = sum f'. distance(f,f'). interMass(f',g)
  for (var f1 = 0; f1 < F; ++f1) {
    var energyRow = pitchEnergyFG[f1];
    var distanceRow = distanceFF[f1];
    for (var g = 0; g < G; ++g) {
      energyRow[g] = 0;
    }
    for (var f2 = 0; f2 < F; ++f2) {
      var distance = distanceRow[f2];
      var massRow = massFG[f2];
      for (var g = 0; g < G; ++g) {
        energyRow[g] += distance * massRow[g];
      }
    }
  }

  // E(f,g) = E_tempo(g) + E_pitch(f,g)
  for (var f = 0; f < F; ++f) {
    var pitchRow = pitchEnergyFG[f];
    for (var g = 0; g < G; ++g) {
      energy[G * f + g] = tempoEnergyG[g] + pitchRow[g];
    }
  }

  return energy;
};

var update = function (data) {
  assert(initialized, 'worker has not been initialized');

  var timestepSec = data['timestepSec'];
  assert(0 <= timestepSec, 'bad timestep: ' + timestepSec);

  var likes = amps.likes;

  var damps = data['damps'];
  assertLength(damps, FG, 'damps');

  for (var fg = 0; fg < FG; ++fg) {
    likes[fg] += damps[fg];
  }

  var energy = getEnergy(amps.likes);
  var temperature = 1; // pitchAcuity,tempoAcuity already control temperature
  var prior = MassVector.boltzmann(energy, temperature);
  var drift = 1 - Math.exp(-timestepSec / grooveSec);
  amps.shiftTowards(prior, drift);

  return amps.likes;
};

//------------------------------------------------------------------------------
// Message handler

addEventListener('message', function (e) {
  try {
    var data = e['data'];
    switch (data['cmd']) {

      case 'init':
        init(data['data']);
        break;

      case 'update':
        var profileStartTime = Date.now();
        var amps = update(data['data']);
        profileCount += 1;
        profileElapsedMs += Date.now() - profileStartTime;
        postMessage({'type':'update', 'data':amps});
        break;

      case 'profile':
        var meanTime = profileElapsedMs / profileCount / 1000;
        log('mean update time = ' + meanTime.toFixed(3));
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

