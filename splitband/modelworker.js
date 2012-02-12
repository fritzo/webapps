/**
 * Spliband
 * http://fritzo.org/splitband
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
// Data

var freqs;
var grids;

var F;
var G;
var FG;

var energy;
var massF;
var massG;
var massFG;
var interMassFG;
var pitchEnergyF;
var tempoEnergyG;
var pitchEnergyFG;

var distanceFF;
var distanceGG;
var interferenceGG;

var profileCount = 0;
var profileElapsedMs = 0;
var initialized = false;

//------------------------------------------------------------------------------
// Methods

var init = function (data) {
  var profileStart = Date.now();

  var pitchAcuity = data['pitchAcuity'];
  var tempoAcuity = data['tempoAcuity'];
  var sharpness = data['sharpness'];

  freqs = data['freqArgs'].map(function(a){
        return new Rational(a[0],a[1]);
      });
  grids = data['gridArgs'].map(function(a){
        return new RatGrid(new Rational(a[0], a[1]), new Rational(a[2],a[3]));
      });

  F = freqs.length;
  G = grids.length;
  FG = F * G;

  energy = new Array(FG);
  massF = new Array(F);
  massG = new Array(G);
  massFG = new Array(F);
  interMassFG = new Array(F);
  pitchEnergyF = new Array(F);
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
      distanceRow[f2] = Rational.dissonance(freqs[f1], freqs[f2]) / pitchAcuity;
    }
  }
  interferenceGG = new Array(G);
  distanceGG = new Array(G);
  for (var g1 = 0; g1 < G; ++g1) {
    var distanceRow = distanceGG[g1] = new Array(G);
    var interRow = interferenceGG[g1] = new Array(G);
    for (var g2 = 0; g2 < G; ++g2) {
      distanceRow[g2] = RatGrid.dissonance(grids[g1], grids[g2]) / tempoAcuity;
      interRow[g2] = RatGrid.interference2(grids[g1], grids[g2], sharpness);
    }
  }

  initialized = true;
  log('initialized in ' + ((Date.now() - profileStart) / 1000) + ' sec');
};

// Version 1. Any two voices have compatible rhythm and pitch.
//
// E(f,g) = sum g'. distance(g,g'). sum f. mass(f,g')
//        + sum f'. distance(f,f'). sum g'. inter(g,g') mass(f,g')
var computeEnergy1 = function (mass) {

  assertLength(mass, FG, 'mass');

  var f,f1,f2,g,g1,g2,fg;

  // normalize mass;
  // marginalize sum f. mass(f,g);
  // marginalize sum g. mass(f,g)
  var total = 0;
  for (fg = 0; fg < FG; ++fg) {
    total += mass[fg];
  }
  assert(total > 0.5, 'unexpectedly low mass: ' + total);
  var normalize = 1 / total;
  for (g = 0; g < G; ++g) {
    massG[g] = 0;
  }
  for (f = 0; f < F; ++f) {
    var massRow = massFG[f];
    var sum = 0;
    for (g = 0; g < G; ++g) {
      var term = massRow[g] = normalize * mass[G * f + g];
      massG[g] += term;
      sum += term;
    }
    massF[f] = term;
  }

  // E_tempo(g) = sum g'. distance(g,g'). sum f. mass(f,g')
  for (g1 = 0; g1 < G; ++g1) {
    var distanceRow = distanceGG[g1];
    var sum = 0;
    for (g2 = 0; g2 < G; ++g2) {
      sum += massG[g2] * distanceRow[g2];
    }
    tempoEnergyG[g1] = sum;
  }

  // E_pitch(f,g) = sum f'. distance(f,f'). interMass(f',g)
  for (f1 = 0; f1 < F; ++f1) {
    var distanceRow = distanceFF[f1];
    var sum = 0;
    for (f2 = 0; f2 < F; ++f2) {
      sum += massF[f2] * distanceRow[f2];
    }
    pitchEnergyF[f1] = sum;
  }

  // E(f,g) = E_tempo(g) + E_pitch(f)
  for (f = 0; f < F; ++f) {
    var pitchEnergy = pitchEnergyF[f];
    for (g = 0; g < G; ++g) {
      energy[G * f + g] = tempoEnergyG[g] + pitchEnergy;
    }
  }

  return energy;
};

// Version 2. Any two voices have compatible rhythm, and
//   any two simultaneously occuring voices have compatible pitch.
//
// E(f,g) = sum g'. distance(g,g'). sum f. mass(f,g')
//        + sum f'. distance(f,f'). sum g'. inter(g,g') mass(f,g')
var computeEnergy2 = function (mass) {

  assertLength(mass, FG, 'mass');

  var f,f1,f2,g,g1,g2,fg;

  // normalize mass;
  // marginalize sum f. mass(f,g)
  var total = 0;
  for (fg = 0; fg < FG; ++fg) {
    total += mass[fg];
  }
  assert(total > 0.5, 'unexpectedly low mass: ' + total);
  var normalize = 1 / total;
  for (g = 0; g < G; ++g) {
    massG[g] = 0;
  }
  for (f = 0; f < F; ++f) {
    var massRow = massFG[f];
    for (g = 0; g < G; ++g) {
      massG[g] += massRow[g] = normalize * mass[G * f + g];
    }
  }

  // E_tempo(g) = sum g'. distance(g,g'). sum f. mass(f,g')
  for (g1 = 0; g1 < G; ++g1) {
    var distanceRow = distanceGG[g1];
    var sum = 0;
    for (g2 = 0; g2 < G; ++g2) {
      sum += massG[g2] * distanceRow[g2];
    }
    tempoEnergyG[g1] = sum;
  }

  // interMass(f,g) = sum g'. inter(g,g') mass(f,g')
  for (f = 0; f < F; ++f) {
    var massRow = massFG[f];
    var interMassRow = interMassFG[f];
    for (g1 = 0; g1 < G; ++g1) {
      var interRow = interferenceGG[g1];
      var sum = 0;
      for (g2 = 0; g2 < G; ++g2) {
        sum += interRow[g2] * massRow[g2];
      }
      interMassRow[g1] = sum;
    }
  }

  // E_pitch(f,g) = sum f'. distance(f,f'). interMass(f',g)
  for (f1 = 0; f1 < F; ++f1) {
    var energyRow = pitchEnergyFG[f1];
    var distanceRow = distanceFF[f1];
    for (g = 0; g < G; ++g) {
      energyRow[g] = 0;
    }
    for (f2 = 0; f2 < F; ++f2) {
      var distance = distanceRow[f2];
      var massRow = massFG[f2];
      for (g = 0; g < G; ++g) {
        energyRow[g] += distance * massRow[g];
      }
    }
  }

  // make columns of pitchEnergyFG zero-mean WRT their boltzmann distribution
  var exp = Math.exp;
  for (g = 0; g < G; ++g) {
    var sum_z = 0;
    var sum_ze = 0;
    for (f = 0; f < F; ++f) {
      var e = pitchEnergyFG[f][g];
      var z = exp(-e);
      sum_z += z;
      sum_ze += z * e;
    }
    var de = -sum_ze / sum_z;
    for (f = 0; f < F; ++f) {
      pitchEnergyFG[f][g] += de;
    }
  }

  // E(f,g) = E_tempo(g) + E_pitch(f,g)
  for (f = 0; f < F; ++f) {
    var pitchRow = pitchEnergyFG[f];
    for (g = 0; g < G; ++g) {
      energy[G * f + g] = tempoEnergyG[g] + pitchRow[g];
    }
  }

  return energy;
};

var computePrior = function (amps) {
  var energy = computeEnergy1(amps);
  var temperature = 1; // pitchAcuity,tempoAcuity already control temperature
  return MassVector.boltzmann(energy, temperature);
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
        assert(initialized, 'worker has not been initialized');
        var profileStartTime = Date.now();

        var amps = data['data'];
        assertLength(amps, FG, 'amps');
        var prior = computePrior(amps);

        profileCount += 1;
        profileElapsedMs += Date.now() - profileStartTime;
        postMessage({'type':'update', 'data':prior.likes});
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

