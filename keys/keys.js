
function TodoException (message) {
  this.message = message || '(unfinished code)';
};
TodoException.prototype.toString = function () {
  return 'TODO: ' + this.message;
};
function TODO (message) {
  throw new TodoException(message);
};

function AssertException (message) {
  this.message = message || '(unspecified)';
};
AssertException.prototype.toString = function () {
  return 'Assertion Failed: ' + this.message;
};
function assert (condition, message) {
  if (!condition) {
    throw new AssertException(message);
  }
};

//------------------------------------------------------------------------------
// Rational numbers (more precisely, extended nonnegative rational pairs)

var gcd = function (a,b)
{
  if (b > a) { var temp = a; a = b; b = temp; }

  while (true) {
    a %= b;
    if (a === 0) return b;
    b %= a;
    if (b === 0) return a;
  }
};

var Rational = function (m,n) {
  var g = gcd(m,n);
  this.numer = m / g;
  this.denom = n / g;
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
  },
  validate: function () {
    assert(this.numer % 1 === 0, 'bad Rational.numer: ' + this.numer);
    assert(this.denom % 1 === 0, 'bad Rational.denom: ' + this.denom);
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

Rational.distSquared (lhs, rhs) {
  return Rational.div(lhs, rhs).normSquared();
};
Rational.dist (lhs, rhs) {
  return Rational.div(lhs, rhs).norm();
};

Rational.ball = function (radius) {
  var result = [];
  for (var i = 0; i <= radius; ++i) {
    for (var j = 0; j*j + i*i <= radius*radius; ++j) {
      if (gcd(i,j) == 1) {
        result.push(new Rational(i,j));
      }
    }
  }
  result.sort(Rational.cmp);
};

//----------------------------------------------------------------------------
// Probability vectors

var Pmf = function () {
};

Pmf.prototype = new Array();

Pmf.prototype.clone = function () {
  var result = new Pmf();
  result = this.slice(); // XXX does this work?
};

Pmf.prototype.total = function () {
  var result = 0;
  for (var i = 0, I = this.length; i < I; ++i) {
    result += this[i];
  }
  return result;
};

Pmf.prototype.normalize = function () {
  var scale = 1.0 / this.total;
  for (var i = 0, I = this.length; i < I; ++i) {
    this[i] *= scale;
  }
};

Pmf.prototype.entropy = function () {
  var result = 0;
  for (var i = 0, I = this.length; i < I; ++i) {
    var p = this[i];
    if (p > 0) {
      result += p * Math.log(p);
    }
  }
  return result;
};

Pmf.prototype.perplexity = function () {
  return Math.exp(this.entropy());
};

Pmf.prototype.mean (values) = function {
  assert(values.length === this.length, 'mismatched length in Pmf.mean');
  var result = 0;
  for (var i = 0, I = this.length; i < I; ++i) {
    result += this[i] * values[i];
  }
  return result;
};

Pmf.degenerate (n, N) {
  assert(0 <= n && n < N, 'bad indices in Pmf.denerate: ' + n + ', ' + N);
  var result = new Pmf();
  for (var i = 0; i < N; ++i) {
    result[i] = 0;
  }
  result[n] = 1;
};

Pmf.shiftTowardsPmf (p0, p1, rate) {
  assert(0 <= rate && rate <= 1, 'bad rate in Pmf.shiftTowardsPmf: ' + rate);
  assert(p0.length == p1.length, 'mismatched lengths in Pmf.shiftTowardsPmf');

  var w0 = 1 - rate;
  var w1 = rate;
  var result = new Pmf();
  for (var i = 0, I = p0.length; i < I; ++i) {
    result[i] = w0 * p0[i] + w1 * p1[i];
  }
  return result;
};

Pmf.shiftTowardsPoint (p0, i1, rate) {
  assert(0 <= rate && rate <= 1, 'bad rate in Pmf.shiftTowardsPoint: ' + rate);

  var w0 = 1 - rate;
  var w1 = rate;
  var result = new Pmf();
  for (var i = 0, I = p0.length; i < I; ++i) {
    result[i] = w0 * p0[i];
  }
  result[i1] += w1;
  return result;
};

Pmf.gibbs = function (energy, temperature) {
  var result = new Pmf();
  for (var i = 0, I = energy.length; i < I; ++i) {
    result[i] = Math.exp(-energy[i] / temperature);
  }
  result.normalize();
  return result;
};

//------------------------------------------------------------------------------
// Harmony

var Harmony = function (radius, timescaleSec, temperature) {
  timescaleSec = timescaleSec || 2.0;
  temperature = temperature || 1.0;

  this.points = Rational.ball(radius);
  this.length = this.points.length;

  var energyMatrix = this.energyMatrix = [];
  for (var i = 0; i < this.length; ++i) {
    var row = energyMatrix[i] = [];
    for (var j = 0; j < this.length; ++j) {
      row[j] = Rational.dist(this.points[i], this.points[j]);
    }
  }

  this.timescaleSec = timescaleSec;
  this.temperature = temperature;

  this.mass = Pmf.degenerate((this.length - 1) / 2, this.length);
};

Harmony.prototype = {
  updateDiffusion: function () {
    var prior = Pmf.gibbs(this.getEnergy(), this.temperature);
    var rate = TODO('determine update rate and decay rate');
    this.mass = Pmf.shiftTowardsPmf(this.mass, prior, rate);
  },
  updateEvent: function (key) {
    assert(0 <= key && key < this.length, 'bad event key: ' + key);

    var rate = 1.0 / this.mass.perplexity();
    this.mass = Pmf.shiftTowardsPoint(this.mass, key, rate);
  },
  getEnergy: function () {
    var energy = [];
    var mass = this.mass;
    var energyMatrix = this.energyMatrix;
    for (var i = 0, I = this.length; i < I; ++i) {
      energy[i] = mass.mean(energyMatrix[i]);
    }
    return energy;
  }
};

//------------------------------------------------------------------------------
// Synthesis

var Synthesizer = function (harmony, windowSec, sampleRateHz) {
  windowSec = windowSec || 0.4;
  sampleRateHz = sampleRateHz || 44100;

  this.harmony = harmony;
  this.windowMs = windowSec / 1000;
  this.delayMs = this.windowMs / 2;
  this.sampleRateHz = sampleRateHz;
  this.windowSamples = Math.floor(windowSec * sampleRateHz);

  this.running = false;
  this.targetTime = Date.now();
};

Synthesizer.prototype = {
  start: function () {
    if (~this.running) {
      this.running = true;
      this.targetTime = Date.now();
      update();
    }
  },
  stop: function () {
    this.running = false;
  },
  update: function () {

    var audio = this.synthesize(); // expensive

    var now = Date.now();
    var playDelay = this.targetTime - now;
    this.targetTime += this.delayMs;
    var updateDelay = TODO('determine Synthesizer.update delay');

    setTimeout(function(){ audio.play() }, playDelay);
    setTimeout(function(){ this.update(); }, updateDelay);
  },
  synthesize: function () {
    TODO('synthesize Hann window of constantly weighted sinusoids');

    //return new Audio(...);
  }
};

//------------------------------------------------------------------------------
// Visualization

var Keyboard = function (harmony, canvas, updateHz) {
  updateHz = updateHz || 60;

  this.harmony = harmony;
  this.canvas = canvas;
  this.context = canvas.getContext('2d');
  this.updateDelay = 1000 / updateHz;
};

Keyboard.prototype = {
  update: function () {
    TODO('update keyboard visualization');
    TODO('cache geometry for onclick event handling');
  },
  start: function () {
    TODO('start update loop');

    var harmony = this.harmony;
    $(this.canvas).onclick(function(){
          var key = TODO('determine key from click position');
          harmony.updateEvent(key);
        });
  }
};

//------------------------------------------------------------------------------
// Main

$(document).ready(function(){

  var RADIUS = 8; // maybe get from hash value

  var harmony = new Harmony(RADIUS);

  var synthesizer = new Synthesizer(harmony);

  var canvas = document.getgetElementById('canvas');
  var keyboard = new Keyboard(harmony, canvas);

  keyboard.start();
  synthesizer.start();
  harmony.start();
});

