/**
 * Rational grids.
 * For symbolic simulation of Arnold tongue scenarios.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

//------------------------------------------------------------------------------
// Trajectories in rational grids

/**
 * @constructor
 * @param {Rational}
 * @param {Rational}
 */
var RatGrid = function (freq, base) {
  if (testing) {
    assert(freq.numer > 0 && freq.denom > 0, 'invalid freq: ' + freq);
    assert(base.denom > 0, 'invalid base: ' + base);
  }

  this.freq = freq;
  this.base = base.numer < base.denom
            ? base
            : new Rational(base.numer % base.denom, base.denom);

  if (testing) {
    var base = this.base;
    assert(0 <= base.numer && base.numer < base.denom,
        'bad RatGrid.base: ' + base);
  }
};

RatGrid.prototype = {

  /** @returns {string} */
  toString: function () {
    return this.freq + ' t + ' + this.base;
  },

  /**
   * @param {number}
   * @returns {number}
   */
  phaseAtTime: function (time) {
    return this.freq.toNumber() * time + this.base.toNumber();
  },

  /** @returns {number} */
  norm: function () {
    var freq = this.freq;
    var base = this.base;

    var result = freq.norm();
    // offset is really base % (1 / freq.denom)
    var offset = (freq.denom * base.numer) % base.denom;
    if (offset !== 0) {
      result *= base.denom / Math.min(offset, base.denom - offset);
    }

    return result;
  },

  /** @returns {number} */
  period: function () {
    return this.freq.denom;
  }
};

/**
 * @const
 * @type {RatGrid}
 */
RatGrid.UNIT = new RatGrid(Rational.ONE, Rational.ZERO);

/**
 * @param {RatGrid}
 * @param {RatGrid}
 * @returns {boolean}
 */
RatGrid.equal = function (lhs, rhs) {
  return ( Rational.cmp(lhs.freq, rhs.freq) === 0 &&
           Rational.cmp(lhs.base, rhs.base) === 0 );
};

/**
 * valid rules:
 * (1) shift t on both sides
 * (2) scale t on both sides
 * (3) add an integer to either side
 *
 * freq t + base : freq' t + base'
 *        freq t : freq' t + base' - base
 *             t : freq'/freq t + (base' - base) / freq
 *
 * @param {RatGrid}
 * @param {RatGrid}
 * @returns {RatGrid}
 */
RatGrid.relative = function (lhs, rhs) {

  var lf = lhs.freq;
  var lb = lhs.base;
  var rf = rhs.freq;
  var rb = rhs.base;

  if (Rational.cmp(lb, rb) < 0) {
    lb = new Rational(lb.numer + lb.denom, lb.denom);
  }

  var freq = Rational.div(lf, rf);
  var base = Rational.div(new Rational.sub(lb, rb), rf);
  return new RatGrid(freq,base);
};

/**
 * Examples:
 *
 *   0,1-/--/--/--/-1,1
 *    | /  /  /  /  /|
 *    |/  /  /  /  / |
 *    /  /  /  /  /  /   |t, 5/2 t| = sqrt(29)
 *    | /  /  /  /  /|
 *    |/  /  /  /  / |
 *   0,0-/--/--/--/-1,0
 *
 *   0,1--/--/--/--/1,1
 *    /  /  /  /  /  /
 *    | /  /  /  /  /|
 *    |/  /  /  /  / |  |t, 5/2 t + 1/3| = 3 sqrt(29)
 *    /  /  /  /  /  /
 *    | /  /  /  /  /|
 *   0,0--/--/--/--/1,0
 *
 * @param {RatGrid}
 * @param {RatGrid}
 * @returns {number}
 */
RatGrid.distance = function (lhs, rhs) {
  return RatGrid.relative(lhs, rhs).norm();
};

/**
 * see notes/ideas/music (2012:01:26-29) (N1.Q1.N1) for derivation
 *
 * @param {RatGrid}
 * @param {number}
 * @param {RatGrid}
 * @param {number}
 * @returns {number}
 */
RatGrid.interference = function (grid1, grid2, sharpness1, sharpness2) {

  sharpness2 = sharpness2 || sharpness1;
  assert(sharpness1 > 0, 'bad sharpness1: ' + sharpness1);
  assert(sharpness2 > 0, 'bad sharpness2: ' + sharpness2);

  var normalForm = RatGrid.relative(grid1, grid2);

  var freq = normalForm.freq;
  var base = normalForm.base;

  var m = freq.denom;
  var n = freq.numer;
  var bm = base.toNumber() * m % 1;
  var s1 = sharpness1;
  var s2 = sharpness2;

  var exp = Math.exp;

  var decreasing = exp(-s1 / m * bm) / (1 - exp(-s1 / m));
  var increasing = exp(-s2 / n * (1 - bm)) / (1 - exp(-s2 / n));

  return (decreasing + increasing) / (m / s1 + n / s2) ;
};

/**
 * @param {number}
 * @returns {RatGrid[]}
 */
RatGrid.ball = function (radius) {

  var result = [];

  // initialize with unshifted grids
  var rates = Rational.ball(radius);
  var I = rates.length;
  for (var i = 0; i < I; ++i) {
    result.push(new RatGrid(rates[i], Rational.ZERO));
  }

  // add shifted grids for every pair of unshifted grid
  for (var i1 = 0; i1 < I; ++i1) {
    var rate1 = rates[i1];
    var baseHashSet = {};

    for (var i2 = 0; i2 < I; ++i2) {
      var rate2 = rates[i2];
      var relRate = Rational.div(rate1, rate2);
      var baseDenom = relRate.denom;

      for (var baseNumer = 1; baseNumer < baseDenom; ++baseNumer) {
        var base = new Rational(baseNumer, baseDenom);
        var baseHash = base.toString();
        if (baseHash in baseHashSet) continue;

        var a = new RatGrid(rate1, base);
        if (a.norm() > radius) continue;

        baseHashSet[baseHash] = undefined;
        result.push(a);
      }
    }
  }

  result.sort(function(lhs,rhs){
        return lhs.norm() - rhs.norm();
      });
  assert(result[0].freq.numer === 1
      && result[0].freq.denom === 1
      && result[0].base.numer === 0,
      'ball is out of order; expected 1/1 at head, actual: ' + result[0]);

  return result;
};

/**
 * @param {RatGrid[]}
 * @returns {number}
 */
RatGrid.commonPeriod = function (grids) {
  if (grids.length === 0) return 0;
  var result = grids[0].period();
  for (var i = 1, I = grids.length; i < I; ++i) {
    result = lcm(result, grids[i].period());
  }
  return result;
};

test('RatGrid(5/2, 0).norm()', function(){
  var grid = new RatGrid(new Rational(5,2), Rational.ZERO);
  assertNear(grid.norm(), Math.sqrt(29),
      'bad grid.norm\n    grid = ' + grid);
});

test('RatGrid(5/2, 1/15).norm()', function(){
  var grid = new RatGrid(new Rational(5,2), new Rational(1,3));
  assertNear(grid.norm(), Math.sqrt(29) * 3,
      'bad grid.norm\n    grid = ' + grid);
});

test('RatGrid.distance symmetry', function(){

  var vars = [
      new RatGrid(new Rational(1,1), new Rational(0,1)),
      new RatGrid(new Rational(2,3), new Rational(5,7)),
      new RatGrid(new Rational(11,13), new Rational(17,19)),
      new RatGrid(new Rational(23,29), new Rational(31,37)),
      new RatGrid(new Rational(41,43), new Rational(47,53)),
      new RatGrid(new Rational(59,61), new Rational(67,71))];

  for (var i = 0; i < vars.length; ++i) {
    var u = vars[i];
    for (var j = 0; j < vars.length; ++j) {
      var v = vars[j];

      assertEqual(RatGrid.distance(u,v), RatGrid.distance(v,u),
          'distance is asymmetric');
    }
  }
});

test('RatGrid.ball', function () {

  var radius = 9;
  var rationalBall = Rational.ball(radius);
  var ratgridBall = RatGrid.ball(radius);
  log('Rational.ball('+radius+').length = '+rationalBall.length);
  log('RatGrid.ball('+radius+').length = '+ratgridBall.length);

  assert(rationalBall.length < ratgridBall.length,
      'RatGrid.ball is not larger than Rational.ball');

  var I = ratgridBall.length;
  for (var i1 = 0; i1 < I; ++i1) {
    var r1 = ratgridBall[i1];
    var norm1 = r1.norm();
    assert(norm1 <= radius, 'norm exceeds radius: |' + r1 + '| = ' + norm1);

    for (var i2 = 0; i2 < i1; ++i2) {
      var r2 = ratgridBall[i2];
      assert(!RatGrid.equal(r1, r2), 'repeated entry: ' + r1);
    }
  }

  var commonPeriod = RatGrid.commonPeriod(ratgridBall);
  log('common period = ' + commonPeriod);
  for (var i = 0; i < I; ++i) {
    var grid = ratgridBall[i];
    var period = grid.period();
    assert(commonPeriod % period === 0,
        'common period fails for grid ' + grid + ' with period ' + period);
  }
});

test('RatGrid trajectory plot', function ($log) {

  var grids = RatGrid.ball(10);

  var canvas = $('<canvas>')[0];
  var context = canvas.getContext('2d');

  var width = canvas.width = 512;
  var height = canvas.height = 512;

  context.fillStyle = 'white';
  context.fillRect(0,0,width,height);

  var drawLine = function (x0, y0, x1, y1, opacity) {
    context.beginPath();
    context.moveTo(x0 * width, (1 - y0) * height);
    context.lineTo(x1 * width, (1 - y1) * height);
    context.strokeStyle = 'rgba(0,0,0,' + opacity + ')';
    context.stroke();
  };

  for (var i = 0, I = grids.length; i < I; ++i) {
    var grid = grids[i];

    var norm = grid.norm();
    var opacity = Math.pow(1 / norm, 1);

    var freq = grid.freq;
    var base = grid.base;

    var x0 = 0;
    var y0 = base.toNumber();
    var x1 = 1;
    var y1 = y0 + freq.toNumber();

    while (y1 > 0) {
      drawLine(x0, y0, x1, y1, opacity);
      y0 -= 1;
      y1 -= 1;
    }
  }

  $('<p>')
      .css('text-align', 'center')
      .append($('<h2>').text('Trajectories should have Z2 x Z2 symmetry:'))
      .append(canvas)
      .appendTo($log);
});

test('RatGrid interference plot', function ($log) {

  var numSamples = 10000;
  var maxTime = 1000;

  var monteCarlo = function (grid1, grid2, sharpness1, sharpness2) {

    var envelope = function (grid, sharpness) {

      var freq = grid.freq.toNumber();
      var base = grid.base.toNumber();
      var exp = Math.exp;
      var scale = sharpness / (1 - exp(-sharpness));

      return function (t) {
        var phase = (freq * t + base) % 1;
        return scale * exp(-sharpness * phase);
      };
    };

    var env1 = envelope(grid1, sharpness1);
    var env2 = envelope(grid2, sharpness2);

    var sum = 0;
    for (var n = 0; n < numSamples; ++n) {
      var t = Math.random() * maxTime;
      sum += env1(t) * env2(t);
    }
    return sum / numSamples;
  };

  var sharpness0 = 2;
  var sharpness1 = 12;

  var grid0 = new RatGrid(Rational.ONE, Rational.ZERO);

  var N = 100;
  var X = [];
  var Ypredicted = [];
  var Yobserved = [];

  for (var n = 0; n < N; ++n) {
    var grid1 = new RatGrid(new Rational(2,3), new Rational(n,N));

    X[n] = grid1.base.toNumber();
    Ypredicted[n] = RatGrid.interference(grid0, grid1, sharpness0, sharpness1);
    Yobserved[n] = monteCarlo(grid0, grid1, sharpness0, sharpness1);
  }

  var canvas = $('<canvas>')[0];
  var context = canvas.getContext('2d');

  var width = canvas.width = 512;
  var height = canvas.height = 256;

  context.fillStyle = 'white';
  context.fillRect(0,0,width,height);

  var heightScale = 2;
  var getX = function (x) { return x * width; }
  var getY = function (y) { return (1 - y / heightScale) * height; }

  context.strokeStyle = 'gray';
  context.beginPath();
  context.moveTo(getX(0), getY(1));
  context.lineTo(getX(1), getY(1));
  context.stroke();

  context.fillStyle = 'gray';
  context.font = '10pt Helvetica';
  context.fillText('1', getX(0), getY(1.05));
  context.fillText('0', getX(0), getY(0.05));

  context.strokeStyle = 'red';
  var radius = 0.5 * width / N;
  var twoPi = 2 * Math.PI;
  for (var n = 1; n < N; ++n) {
    context.beginPath();
    context.arc(getX(X[n]), getY(Yobserved[n]), radius, twoPi, false);
    context.stroke();
  }
  context.fillStyle = 'red';
  context.fillText('observed', getX(0.5), getY(0.45));

  context.strokeStyle = 'black';
  context.beginPath();
  context.moveTo(getX(X[0]), getY(Ypredicted[0]));
  for (var n = 1; n < N; ++n) {
    context.lineTo(getX(X[n]), getY(Ypredicted[n]));
  }
  context.stroke();
  context.fillStyle = 'black';
  context.fillText('predicted', getX(0.5), getY(0.55));

  $('<p>')
      .css('text-align', 'center')
      .append($('<h2>').text('Interference of 2t/3 t + b for varying b'))
      .append(canvas)
      .appendTo($log);

  var allowedStdDevs = 10;
  var meanSquaredError = 0;
  for (var n = 0; n < N; ++n) {
    meanSquaredError += Math.pow(Ypredicted[n] - Yobserved[n], 2);
  }
  meanSquaredError /= N;
  var rmsError = Math.sqrt(meanSquaredError);
  log('interference rms error = ' + rmsError);
  assert(meanSquaredError < allowedStdDevs * allowedStdDevs / numSamples,
      'interference error was large: ' +
      '\n    expected < ' + (allowedStdDevs / Math.sqrt(numSamples)) +
      '\n    actual ' + rmsError);
});

