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
var attackSec;
var sustainSec;
var grooveSec;

var freqs;
var grids;

var F;
var G;
var FG;

var freqEnergyMatrix;
var gridEnergyMatrix;

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
  assertEqual(amps.likes.length, FG, 'amps vector has wrong size:');

  freqEnergyMatrix = new Array(F);
  for (var f1 = 0; f1 < F; ++f1) {
    var row = freqEnergyMatrix[f1] = new Array(F);
    for (var f2 = 0; f2 < F; ++f2) {
      row[f2] = Rational.dist(freqs[f1], freqs[f2]);
    }
  }

  gridEnergyMatrix = new Array(G);
  for (var g1 = 0; g1 < G; ++g1) {
    var row = gridEnergyMatrix[g1] = new Array(G);
    for (var g2 = 0; g2 < G; ++g2) {
      row[g2] = RatGrid.dist(grids[g1], grids[g2]);
    }
  }

  initialized = true;
  log('initialized in ' + ((Date.now() - profileStart) / 1000) + ' sec');
};

var getEnergy = function (mass) {

  // Let m(f,g) be mass and E(m) be energy.
  // Since E(m) is quadratic in m, we assume WLOG 1 = |m| = sum f,g. m(f,g).
  //
  // For motivation consider first a simpler system where pitch tempo decouple
  //
  //   m_pitch(f) = sum g. m(f,g)
  //   E_pitch(m_pitch) = sum f,f'. d_pitch(f,f') m_pitch(f) m_pitch(f')
  //   
  //   m_tempo(g) = sum f. m(f,g)
  //   E_tempo(m_tempo) = sum g,g'. d_tempo(g,g') m_tempo(g) m_tempo(g')
  //
  //   E(m) = E_pitch(sum g. m(-,g)) + E_tempo(sum f. m(f,-))
  //
  // We can now couple the system while retaining O(F^2 G + F G^2) complexity
  // by defining a joint distance function
  //
  //   d((f,g),(f',g')) = d_pitch(f,f') + d_tempo(g,g')
  //
  // yielding coupled energy
  //
  //   E(m) = sum f,g. sum f',g'. d((f,g),(f',g')) m(f,g) m(f',g')
  //
  //        = sum f,g. sum f',g'. (d_pitch(f,f')+d_tempo(g,g')) m(f,g) m(f',g')
  //
  //        = sum f,g. sum f',g'. d_pitch(f,f') m(f,g) m(f',g')
  //        + sum f,g. sum f',g'. d_tempo(g,g') m(f,g) m(f',g')
  //
  //        = sum f,f'. d_pitch(f,f') (sum g. m(f,g)) (sum g. m(f',g))
  //        + sum g,g'. d_tempo(g,g') (sum f. m(f,g)) (sum f. m(f,g'))
  //
  //        = E
  //
  //
  //            sum f'. mass(f',g) E_pitch(f,f')
  //   E(f,g) = --------------------------------
  //                  sum f'. mass(f',g)
  //
  //            sum g'. mass(f,g') E_tempo(g,g')
  //          + --------------------------------
  //                  sum g'. mass(f,g')
  //
  // which has complexity O(F^2 G + F G^2)

  // TODO cache data structures to reduce gc load

  assertEqual(mass.length, FG, 'mass vector has wrong size:');

  var total = 0;
  for (var fg = 0; fg < FG; ++fg) {
    total += mass[fg];
  }

  var massFG = new Array(F);
  for (var f = 0; f < F; ++f) {
    var row = massFG[f] = new Array(G);
    for (var g = 0; g < G; ++g) {
      row[g] = mass[G * f + g];
    }
  }

  var massGF = new Array(G);
  for (var g = 0; g < G; ++g) {
    var row = massGF[g] = new Array(F);
    for (var f = 0; f < F; ++f) {
      row[f] = mass[G * f + g];
    }
  }

  var energy = new Array(FG);

  var pitchScale = 1 / (total * pitchAcuity);
  for (var g = 0; g < G; ++g) {
    var Eg = Epitch[g] = new Array(F);
    var Mg = massGF[g];

    for (var f1 = 0; f1 < F; ++f1) {
      var massRow = massFG[f1];
      var energyRow = pitchEnergyMatrix[f1];

      var sum = 0;
      for (var f2 = 0; f2 < F; ++f2) {
        sum += massRow[f2] * energyRow[f2];
      }

      energy[G * f1 + g] = pitchScale * sum;
    }
  }

  var tempoScale = 1 / (total * tempoAcuity);
  TODO();

  var energyScale = 1 / mass.total();
  var energy = [];
  for (var i = 0, I = mass.likes.length; i < I; ++i) {
    energy[i] = energyScale * mass.dot(energyMatrix[i]);
  }
  return energy;
};

var update = function (data) {
  assert(initialized, 'worker has not been initialized');

  var timestepSec = data['timestepSec'];
  assert(0 <= timestepSec, 'bad timestep: ' + timestepSec);

  var likes = amps.likes;

  var damps = data['damps'];
  assertEqual(damps.length, FG, 'damps vector has wrong size:');

  for (var fg = 0; fg < FG; ++fg) {
    likes[fg] += damps[fg];
  }

  var energy = getEnergy(amps);
  var prior = MassVector.boltzmann(energy);
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

