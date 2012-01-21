/*
 * Symbolic simulation of arnold tongues.
 *
 * Copyright (c) 2012, Fritz Obermeyer
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
var Rational = function (m,n) {
  if (testing) {
    assert(0 <= m && m % 1 == 0, 'invalid numer: ' + m);
    assert(0 <= n && n % 1 == 0, 'invalid denom: ' + n);
    assert(m || n, '0/0 is not a Rational');
  }

  var g = gcd(m,n);
  this.numer = m / g;
  this.denom = n / g;

  if (testing) {
    assert(this.numer % 1 === 0, 'bad Rational.numer: ' + this.numer);
    assert(this.denom % 1 === 0, 'bad Rational.denom: ' + this.denom);
  }
};

Rational.prototype = {

  /** @returns {string} */
  toString: function () {
    return this.numer + '/' + this.denom;
  },

  /** @returns {number} */
  toNumber: function () {
    return this.numer / this.denom;
  },

  /** @returns {number} */
  normSquared: function () {
    return this.numer * this.numer + this.denom * this.denom;
  },

  /** @returns {number} */
  norm: function () {
    return Math.sqrt(this.numer * this.numer + this.denom * this.denom);
  },

  /** @returns {boolean} */
  isNormal: function () {
    return this.numer !== 0 && this.denom !== 0;
  }
};

/** 
 * @const
 * @type {Rational}
 */
Rational.ZERO = new Rational(0,1);

/** 
 * @const
 * @type {Rational}
 */
Rational.INF = new Rational(1,0);

/** 
 * @const
 * @type {Rational}
 */
Rational.ONE = new Rational(1,1);

/**
 * @param {Rational}
 * @param {Rational}
 * @returns {Rational}
 */
Rational.mul = function (lhs, rhs) {
  return new Rational(lhs.numer * rhs.numer, lhs.denom * rhs.denom);
};

/**
 * @param {Rational}
 * @param {Rational}
 * @returns {Rational}
 */
Rational.div = function (lhs, rhs) {
  return new Rational(lhs.numer * rhs.denom, lhs.denom * rhs.numer);
};

/**
 * @param {Rational}
 * @param {Rational}
 * @returns {Rational}
 */
Rational.add = function (lhs, rhs) {
  return new Rational(
      lhs.numer * rhs.denom + lhs.denom * rhs.numer,
      lhs.denom * rhs.denom);
};

/**
 * @param {Rational}
 * @param {Rational}
 * @returns {number}
 */
Rational.cmp = function (lhs, rhs) {
  return lhs.numer * rhs.denom - rhs.numer * lhs.denom;
};

/**
 * @param {Rational}
 * @param {Rational}
 * @returns {number}
 */
Rational.distSquared = function (lhs, rhs) {
  return Rational.div(lhs, rhs).normSquared();
};

/**
 * @param {Rational}
 * @param {Rational}
 * @returns {number}
 */
Rational.dist = function (lhs, rhs) {
  return Rational.div(lhs, rhs).norm();
};

/**
 * @param {number}
 * @returns {Rational[]}
 */
Rational.ball = function (radius) {
  var result = [];
  for (var i = 1; i <= radius; ++i) {
    for (var j = 1; j*j + i*i <= radius*radius; ++j) {
      if (gcd(i,j) === 1) {
        result.push(new Rational(i,j));
      }
    }
  }
  result.sort(Rational.cmp);
  return result;
};

test('Rational.ball', function(){
  var actual = Rational.ball(4).map(function(q){ return q.toNumber(); });
  var expected = [1/3, 1/2, 2/3, 1/1, 3/2, 2/1, 3/1];
  assertEqual(actual, expected);
});

test('Rational.ball of size 88', function(){
  var target = 191; // needs to be odd; 88 is even
  var f = function (r) { return Rational.ball(r).length; }

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
  log('Rational.ball(' + r + ').length = ' + target);
});

//------------------------------------------------------------------------------
// Rational grids

/**
 * @constructor
 * @param {Rational}
 * @param {Rational}
 */
var Raffine = function (r,q) {
  if (testing) {
    assert(r.numer > 0 && r.denom > 0, 'invalid step: ' + r);
    assert(q.denom > 0, 'invalid base: ' + q);
  }

  this.base = q.numer < q.denom ? q : new Rational(q.numer % q.denom, q.denom);
  this.step = r;

  if (testing) {
    var base = this.base.toNumber();
    assert(0 <= base && base < 1, 'bad Raffine.base: ' + this.base);
  }
};

Raffine.prototype = {

  /** @returns {string} */
  toString: function () {
    return this.step + ' * (' + this.base + ' + t)';
  },

  /** @returns {number} */
  norm: function () {
    var result = this.step.norm();
    var base = this.base.toNumber();
    if (base !== 0) {
      result /= Math.min(base, 1 - base);
    }
    return result;
  }
};

/**
 * @const
 * @type {Raffine}
 */
Raffine.UNIT = new Raffine(Rational.ONE, Rational.ZERO);

/**
 * @param {Raffine}
 * @param {Raffine}
 * @returns {boolean}
 */
Raffine.equal = function (lhs, rhs) {
  return ( Rational.cmp(lhs.step, rhs.step) === 0 &&
           Rational.cmp(lhs.base, rhs.base) === 0 );
};

/**
 * mul(r * (q + t), r' * (q' + t))
 *     = r * (q + (r' * (q' + t)))
 *     = (r * r') * ((q/r' + q') + t)
 *
 * @param {Raffine}
 * @param {Raffine}
 * @returns {Raffine}
 */
Raffine.mul = function (lhs, rhs) {
  var step = Rational.mul(lhs.step, rhs.step);
  var base = Rational.add(Rational.div(lhs.base, rhs.step), rhs.base);
  return new Raffine(step, base);
};

/**
 * @param {Raffine}
 * @param {Raffine}
 * @returns {Raffine}
 */
Raffine.div = function (lhs, rhs) {
  var step = Rational.div(lhs.step, rhs.step);
  var rhs_base = rhs.base;
  var neg_base = new Rational(rhs_base.denom - rhs_base.numer, rhs_base.denom);
  var base = Rational.mul(Rational.add(lhs.base, neg_base), rhs.step);
  return new Raffine(step, base);
};

/**
 * @param {number}
 * @returns {Raffine[]}
 */
Raffine.ball = function (radius) {

  var result = [];

  // initialize with unshifted grids
  var rates = Rational.ball(radius);
  var I = rates.length;
  for (var i = 0; i < I; ++i) {
    result.push(new Raffine(rates[i], Rational.ZERO));
  }

  // add shifted grids for every pair of unshifted grid
  for (var i1 = 0; i1 < I; ++i1) {
    var rate1 = rates[i1];
    var baseHashSet = {};

    for (var i2 = 0; i2 < I; ++i2) {
      var rate2 = rates[i2];
      var relRate = Rational.div(rate2, rate1);
      var baseDenom = relRate.denom;

      for (var baseNumer = 1; baseNumer < baseDenom; ++baseNumer) {
        var base = new Rational(baseNumer, baseDenom);
        var baseHash = base.toString();
        if (baseHash in baseHashSet) continue;

        var r = new Raffine(rate1, base);
        if (r.norm() > radius) continue;

        baseHashSet[baseHash] = undefined;
        result.push(r);
      }
    }
  }

  return result;
};

test('Raffine.mul, Raffine.div', function(){
  var x = new Raffine(new Rational(2,3), new Rational(5,7));
  var y = new Raffine(new Rational(11,13), new Rational(17,19));
  //var z = new Raffine(new Rational(23,29), new Rational(31,37));

  var unit_x = Raffine.mul(Raffine.UNIT, x);
  assertEqual(x, unit_x, 'left-unit fails');

  var x_unit = Raffine.mul(x, Raffine.UNIT);
  assertEqual(x, x_unit, 'right-unit fails');

  var xy = Raffine.mul(x,y);
  var xyy = Raffine.div(xy,y);
  assertEqual(x, xyy, 'division fails');
});

test('Raffine.ball', function(){
  var radius = 12;
  var rationalBall = Rational.ball(radius);
  var raffineBall = Raffine.ball(radius);
  log('Rational.ball('+radius+').length = '+rationalBall.length);
  log('Raffine.ball('+radius+').length = '+raffineBall.length);

  assert(rationalBall.length < raffineBall.length,
      'Raffine.ball is not larger than Rational.ball');

  var I = raffineBall.length;
  for (var i1 = 0; i1 < I; ++i1) {
    var r1 = raffineBall[i1];
    var norm1 = r1.norm();
    assert(norm1 <= radius, 'norm exceeds radius: |' + r1 + '| = ' + norm1);

    for (var i2 = 0; i2 < i1; ++i2) {
      var r2 = raffineBall[i2];
      assert(!Raffine.equal(r1, r2), 'repeated entry: ' + r1);
    }
  }
});

