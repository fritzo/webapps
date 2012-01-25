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
 * @returns {number}
 */
RatGrid.dist = function (lhs, rhs) {

  var cmp = Rational.cmp(lhs.base, rhs.base);
  if (cmp === 0) {
    return Rational.dist(lhs.freq, rhs.freq);
  } else if (cmp < 0) {
    var temp = lhs;
    lhs = rhs;
    rhs = temp;
  }

  var lf = lhs.freq;
  var lb = lhs.base;
  var rf = rhs.freq;
  var rb = rhs.base;

  var freq = Rational.div(lf, rf);
  var base = Rational.div(new Rational.sub(lb, rb), rf);
  var normalForm = new RatGrid(freq,base);
  return normalForm.norm();
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

test('RatGrid.dist symmetry', function(){

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

      assertEqual(RatGrid.dist(u,v), RatGrid.dist(v,u),
          'distance is asymmetric');
    }
  }
});

test('RatGrid.ball', function(){

  var radius = 4;
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

