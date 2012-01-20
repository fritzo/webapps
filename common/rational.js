/*
 * Symbolic simulation of arnold tongues.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 */

//------------------------------------------------------------------------------
// Rational numbers (more precisely, extended nonnegative rational pairs)

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

/** @constructor */
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
  toNumber: function () {
    return this.numer / this.denom;
  },
  recip: function () {
    return new Rational(this.denom, this.numer);
  },
  normSquared: function () {
    return this.numer * this.numer + this.denom * this.denom;
  },
  norm: function () {
    return Math.sqrt(this.numer * this.numer + this.denom * this.denom);
  },
  isNormal: function () {
    return this.numer !== 0 && this.denom !== 0;
  }
};

Rational.ZERO = new Rational(0,1);
Rational.INF = new Rational(1,0);
Rational.ONE = new Rational(1,1);

Rational.mul = function (lhs, rhs) {
  return new Rational(lhs.numer * rhs.numer, lhs.denom * rhs.denom);
};
Rational.div = function (lhs, rhs) {
  return new Rational(lhs.numer * rhs.denom, lhs.denom * rhs.numer);
};
Rational.add = function (lhs, rhs) {
  return new Rational(
      lhs.numer * rhs.denom + lhs.denom * rhs.numer,
      lhs.denom * rhs.denom);
};

Rational.cmp = function (lhs, rhs) {
  return lhs.numer * rhs.denom - rhs.numer * lhs.denom;
};

Rational.distSquared = function (lhs, rhs) {
  return Rational.div(lhs, rhs).normSquared();
};
Rational.dist = function (lhs, rhs) {
  return Rational.div(lhs, rhs).norm();
};

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
  var f = function(r) { return Rational.ball(r).length; }

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

