/*
 * Symbolic simulation of arnold tongues.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 */

/**
 * @param {number}
 * @param {number}
 * @returns {number}
 */
var gcd = function (a,b)
{
  if (testing) {
    assert(a >= 0, 'gcd arg 1 is not positive: ' + a);
    assert(b >= 0, 'gcd arg 2 is not positive: ' + b);
    assert(a % 1 === 0, 'gcd arg 1 is not an integer: ' + a);
    assert(b % 1 === 0, 'gcd arg 2 is not an integer: ' + b);
  }

  if (b > a) { var temp = a; a = b; b = temp; }
  if (b === 0) return 1;

  while (true) {
    a %= b;
    if (a === 0) return b;
    b %= a;
    if (b === 0) return a;
  }
};
test('assert(gcd(0,0) === 1)');
test('assert(gcd(1,1) === 1)');
test('assert(gcd(1,2) === 1)');
test('assert(gcd(2,2) === 2)');
test('assert(gcd(4,6) === 2)');
test('assert(gcd(0,7) === 1)');

//------------------------------------------------------------------------------
// Rational numbers (more precisely, extended nonnegative rational pairs)

/**
 * @constructor
 * @param {number}
 * @param {number}
 */
var Ratio = function (m,n) {
  if (testing) {
    assert(0 <= m && m % 1 == 0, 'invalid numer: ' + m);
    assert(0 <= n && n % 1 == 0, 'invalid denom: ' + n);
    assert(m || n, '0/0 is not a Ratio');
  }

  /**
   * @const
   * @type {number}
   */
  var g = gcd(m,n);
  /**
   * @const
   * @type {number}
   */
  this.numer = m / g;
  /**
   * @const
   * @type {number}
   */
  this.denom = n / g;

  if (testing) {
    assert(this.numer % 1 === 0, 'bad Ratio.numer: ' + this.numer);
    assert(this.denom % 1 === 0, 'bad Ratio.denom: ' + this.denom);
  }
};

Ratio.prototype = {

  /** @returns {string} */
  toString: function () {
    return this.numer + '/' + this.denom;
  },

  /** @returns {number} */
  toNumber: function () {
    return this.numer / this.denom;
  },

  /** @returns {Ratio} */
  inv: function () {
    return new Ratio(this.denom, this.numer);
  },

  /** @returns {number} */
  norm: function () {
    return Math.sqrt(this.numer * this.numer + this.denom * this.denom);
  }
};

/** 
 * @const
 * @type {Ratio}
 */
Ratio.ZERO = new Ratio(0,1);

/** 
 * @const
 * @type {Ratio}
 */
Ratio.INF = new Ratio(1,0);

/** 
 * @const
 * @type {Ratio}
 */
Ratio.ONE = new Ratio(1,1);

/**
 * @param {Ratio}
 * @param {Ratio}
 * @returns {Ratio}
 */
Ratio.mul = function (lhs, rhs) {
  return new Ratio(lhs.numer * rhs.numer, lhs.denom * rhs.denom);
};

/**
 * @param {Ratio}
 * @param {Ratio}
 * @returns {Ratio}
 */
Ratio.div = function (lhs, rhs) {
  return new Ratio(lhs.numer * rhs.denom, lhs.denom * rhs.numer);
};

/**
 * @param {Ratio}
 * @param {Ratio}
 * @returns {Ratio}
 */
Ratio.add = function (lhs, rhs) {
  return new Ratio(
      lhs.numer * rhs.denom + lhs.denom * rhs.numer,
      lhs.denom * rhs.denom);
};

/**
 * @param {Ratio}
 * @param {Ratio}
 * @returns {number}
 */
Ratio.cmp = function (lhs, rhs) {
  return lhs.numer * rhs.denom - rhs.numer * lhs.denom;
};

/**
 * @param {Ratio}
 * @param {Ratio}
 * @returns {number}
 */
Ratio.dist = function (lhs, rhs) {
  return Ratio.div(lhs, rhs).norm();
};

/**
 * @param {number}
 * @returns {Ratio[]}
 */
Ratio.ball = function (radius) {
  var result = [];
  for (var i = 1; i <= radius; ++i) {
    for (var j = 1; j*j + i*i <= radius*radius; ++j) {
      if (gcd(i,j) === 1) {
        result.push(new Ratio(i,j));
      }
    }
  }
  result.sort(Ratio.cmp);
  return result;
};

test('Ratio.ball', function(){
  var actual = Ratio.ball(4).map(function(q){ return q.toNumber(); });
  var expected = [1/3, 1/2, 2/3, 1/1, 3/2, 2/1, 3/1];
  assertEqual(actual, expected);
});

test('Ratio.ball of size 88', function(){
  var target = 191; // needs to be odd; 88 is even
  var f = function (r) { return Ratio.ball(r).length; }

  var r0, r1;
  for (r0 = 3; f(r0) >= target; --r0) {}
  for (r1 = 3; f(r1) <= target; ++r1) {}

  var r;
  while (r0 < r1) {
    var r = (r0 + r1) / 2;
    var n = f(r);
    if (r0 === r1) break;
    if (n === target) break;
    if (n < target) r0 = r;
    else r1 = r;
  }

  if (f(Math.round(r)) === target) r = Math.round(r);
  log('Ratio.ball(' + r + ').length = ' + target);
});

//------------------------------------------------------------------------------
// Affine numbers

/**
 * @constructor
 * @param {Ratio}
 * @param {Ratio}
 */
var Affino = function (freq, base) {
  if (testing) {
    assert(freq.numer > 0 && freq.denom > 0, 'invalid freq: ' + freq);
    assert(base.denom > 0, 'invalid base: ' + base);
  }

  this.freq = freq;
  this.base = base.numer < base.denom
              ? base
              : new Ratio(base.numer % base.denom, base.denom);

  if (testing) {
    var base = this.base;
    assert(0 <= base.numer && base.numer < base.denom,
        'bad Affino.base: ' + base);
  }
};

Affino.prototype = {

  /** @returns {string} */
  toString: function () {
    return this.freq + ' (t + ' + this.base + ')';
  },

  /** @returns {Affino} */
  inv: function () {
    var f = this.freq;
    var b = this.base;
    var freq = this.freq.inv();
    var base = new Ratio(
        f.numer * b.denom - f.denom * b.numer,
        f.denom * b.denom);
    return new Affion(freq, base);
  },

  /** @returns {number} */
  norm: function () {
    var freq = this.freq;
    var base = this.base;
    var result = freq.norm();
    var offset = (base.numer / base.denom) % (1 / freq.denom);
    if (offset !== 0) {
      result /= Math.min(offset, 1 - offset);
    }
    return result;
  }
};

/**
 * @const
 * @type {Affino}
 */
Affino.UNIT = new Affino(Ratio.ONE, Ratio.ZERO);

/**
 * @param {Affino}
 * @param {Affino}
 * @returns {boolean}
 */
Affino.equal = function (lhs, rhs) {
  return ( Ratio.cmp(lhs.freq, rhs.freq) === 0 &&
           Ratio.cmp(lhs.base, rhs.base) === 0 );
};

/**
 *
 * @param {Affino}
 * @param {Affino}
 * @returns {Affino}
 */
Affino.div = function (lhs, rhs) {
  var rf = rhs.freq;
  var rb = rhs.base;
  var freq = Ratio.div(lhs.freq, rhs.freq);
  var base = Ratio.add(
      lhs.base,
      new Ratio(
          rf.numer * rb.denom - rf.denom * rb.numer,
          rf.denom * rb.denom));
  return new Affion(freq, base);
};

/**
 *
 * @param {Affino}
 * @param {Affino}
 * @returns {Affino}
 */
Affino.mul = function (lhs, rhs) {
  var freq = Ratio.mul(lhs.freq, rhs.freq);
  var base = Ratio.add(
      lhs.base,
      Ratio.mul(lhs.freq, rhs.base));
  return new Affion(freq, base);
};

/**
 * @param {Affino}
 * @param {Affino}
 * @returns {number}
 */
Affino.dist = function (lhs, rhs) {
  return Affino.div(lhs, rhs).norm();
};

/**
 * @param {number}
 * @returns {Affino[]}
 */
Affino.ball = function (radius) {

  var result = [];

  // initialize with unshifted grids
  var rates = Ratio.ball(radius);
  var I = rates.length;
  for (var i = 0; i < I; ++i) {
    result.push(new Affino(rates[i], Ratio.ZERO));
  }

  // add shifted grids for every pair of unshifted grid
  for (var i1 = 0; i1 < I; ++i1) {
    var rate1 = rates[i1];
    var baseHashSet = {};

    for (var i2 = 0; i2 < I; ++i2) {
      var rate2 = rates[i2];
      var relRate = Ratio.div(rate2, rate1);
      var baseDenom = relRate.denom;

      for (var baseNumer = 1; baseNumer < baseDenom; ++baseNumer) {
        var base = new Ratio(baseNumer, baseDenom);
        var baseHash = base.toString();
        if (baseHash in baseHashSet) continue;

        var a = new Affino(rate1, base);
        if (a.norm() > radius) continue;

        baseHashSet[baseHash] = undefined;
        result.push(a);
      }
    }
  }

  return result;
};

test('Affino', function(){

  var vars = [
      new Affino(new Ratio(2,3), new Ratio(5,7)),
      new Affino(new Ratio(11,13), new Ratio(17,19)),
      new Affino(new Ratio(23,29), new Ratio(31,37)),
      new Affino(new Ratio(41,43), new Ratio(47,53)),
      new Affino(new Ratio(59,61), new Ratio(67,71))];

  for (var i = 0; i < vars.length; ++i) {
    var u = vars[i];

    // Unary

    assertEqual(Affino.div(u,u), Affino.UNIT, 'unit fails');
    assertEqual(u, u.inv().inv(), 'inverse failed');
    assertEqual(u.norm(), u.inv().norm(), 'norm() != inv().norm()');

    var unit_u = Affino.mul(Affino.UNIT, u);
    assertEqual(u, unit_u, 'left-unit fails');

    var u_unit = Affino.mul(u, Affino.UNIT);
    assertEqual(u, u_unit, 'right-unit fails');

    // Binary
    for (var j = 0; j < vars.length; ++j) {
      var v = vars[j];

      var uv = Affino.mul(u,v);
      assertEqual(u, Affino.div(uv,v), 'division fails');

      // Ternary
      for (var k = 0; k < vars.length; ++k) {
        var w = vars[k];

        var vw = Affino.mul(v,w);
        assertEqual(Affino.mul(uv,w), Affino.mul(u,vw),
            'associativity fails');
      }
    }

    // Binary symmetric
    for (var j = 0; j < i; ++j) {
      var v = vars[j];

      assertEqual(Affino.dist(u,v), Affino.dist(v,u),
          'distance is asymmetric');
    }
  }
});

test('Affino.ball', function(){
  var radius = 12;
  var rationalBall = Ratio.ball(radius);
  var raffineBall = Affino.ball(radius);
  log('Ratio.ball('+radius+').length = '+rationalBall.length);
  log('Affino.ball('+radius+').length = '+raffineBall.length);

  assert(rationalBall.length < raffineBall.length,
      'Affino.ball is not larger than Ratio.ball');

  var I = raffineBall.length;
  for (var i1 = 0; i1 < I; ++i1) {
    var r1 = raffineBall[i1];
    var norm1 = r1.norm();
    assert(norm1 <= radius, 'norm exceeds radius: |' + r1 + '| = ' + norm1);

    for (var i2 = 0; i2 < i1; ++i2) {
      var r2 = raffineBall[i2];
      assert(!Affino.equal(r1, r2), 'repeated entry: ' + r1);
    }
  }
});

