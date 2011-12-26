
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
var assert1 = assert;
//var assert1 = function () {};

function log1 (message) {
  console.log(message);
};

//------------------------------------------------------------------------------
// Rational numbers (more precisely, extended nonnegative rational pairs)

var gcd = function (a,b)
{
  assert1(~isNaN(a), 'gcd arg 1 is not a number: ' + a);
  assert1(~isNaN(b), 'gcd arg 2 is not a number: ' + b);
  assert1(Math.floor(a) === a);
  assert1(Math.floor(b) === b);

  if (b > a) { var temp = a; a = b; b = temp; }

  while (true) {
    if (b === 0) return a;
    a %= b;
    if (a === 0) return b;
    b %= a;
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

Rational.distSquared = function (lhs, rhs) {
  return Rational.div(lhs, rhs).normSquared();
};
Rational.dist = function (lhs, rhs) {
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
  return result;
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

Pmf.prototype.mean = function (values) {
  assert(values.length === this.length, 'mismatched length in Pmf.mean');
  var result = 0;
  for (var i = 0, I = this.length; i < I; ++i) {
    result += this[i] * values[i];
  }
  return result;
};

Pmf.degenerate = function (n, N) {
  assert(0 <= n && n < N, 'bad indices in Pmf.denerate: ' + n + ', ' + N);
  var result = new Pmf();
  for (var i = 0; i < N; ++i) {
    result[i] = 0;
  }
  result[n] = 1;
  return result;
};

Pmf.shiftTowardsPmf = function (p0, p1, rate) {
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

Pmf.shiftTowardsPoint = function (p0, i1, rate) {
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

var Harmony = function (radius, timescaleSec, temperature, delaySec) {
  timescaleSec = timescaleSec || 2.0;
  temperature = temperature || 1.0;
  delaySec = delaySec || 0.05;

  this.timescaleMs = timescaleSec * 1000;
  this.temperature = temperature;
  this.delayMs = delaySec * 1000;

  log1('building ' + radius + '-ball of points');
  this.points = Rational.ball(radius);
  this.length = this.points.length;

  var energyMatrix = this.energyMatrix = [];
  for (var i = 0; i < this.length; ++i) {
    var row = energyMatrix[i] = [];
    for (var j = 0; j < this.length; ++j) {
      row[j] = Rational.dist(this.points[i], this.points[j]);
    }
  }

  this.mass = Pmf.degenerate((this.length - 1) / 2, this.length);

  this.running = false;
};

Harmony.prototype = {
  start: function () {
    if (this.running) return;
    this.running = true;
    this.lastTime = Date.now();
    this.updateDiffusion();
  },
  stop: function () {
    this.running = false;
  },
  updateDiffusion: function () {
    if (~this.running) return;

    var now = Date.now();
    var diffusionRate = 1 - exp((this.lastTime - now) / this.timeScaleMs);
    this.LastTime = now;

    var prior = Pmf.gibbs(this.getEnergy(), this.temperature);
    this.mass = Pmf.shiftTowardsPmf(this.mass, prior, diffusionRate);

    var harmony = this;
    setTimeout(function(){ harmony.updateDiffusion(); }, this.delayMs);
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

var Synthesizer = function (harmony, windowSec, centerFreqHz, sampleRateHz) {
  windowSec = windowSec || 0.4;
  centerFreqHz = centerFreqHz || 440.0;
  sampleRateHz = sampleRateHz || 22050;

  this.harmony = harmony;
  this.windowMs = windowSec / 1000;
  this.delayMs = this.windowMs / 2;
  this.sampleRateHz = sampleRateHz;
  this.windowSamples = Math.floor(windowSec * sampleRateHz);

  this.freqs = harmony.points.map(function(q){
        return 2 * Math.PI * centerFreqHz / sampleRateHz * q.toNumber();
      });

  this.running = false;
  this.targetTime = Date.now();
};

Synthesizer.prototype = {
  start: function () {
    if (this.running) return;
    this.running = true;
    this.targetTime = Date.now();
    this.update();
  },
  stop: function () {
    this.running = false;
  },
  update: function () {
    if (~this.running) return;

    var audio = this.synthesize(); // expensive

    var now = Date.now();
    var delay = this.targetTime - now;
    this.targetTime += this.delayMs;

    var synth = this;
    setTimeout(function () { audio.play(); synth.update(); }, delay);
  },

  synthesize: function () {

    var freqs = this.freqs;
    var mass = this.harmony.mass;
    var F = freqs.length;
    var samples = [];
    for (var t = 0, T = this.windowSamples; t < T; ++t) {
      var env = 4 / (T*T) * t * (T - t);
      var chord = 0;
      for (var f = 0; f < F; ++f) {
        chord += Math.sqrt(mass[f]) * Math.sin(freqs[f] * t);
      }
      samples[t] = Math.round(255/2 * (chord * env + 1));
    }

    var wave = new RIFFWAVE(samples);
    return new Audio(wave.dataURI);
  }
};

//------------------------------------------------------------------------------
// Visualization

var Keyboard = function (harmony, canvas, updateHz) {
  updateHz = updateHz || 60;

  this.harmony = harmony;
  this.canvas = canvas;
  this.context = canvas.getContext('2d');
  this.delayMs = 1000 / updateHz;

  this.running = false;
  this.geometry = undefined;
};

Keyboard.prototype = {
  start: function () {
    if (this.running) return;
    this.running = true;

    this.update();

    var harmony = this.harmony;
    $(this.canvas).on('click', function(){
          var key = TODO('determine key from click position');
          harmony.updateEvent(key);
        });
  },
  stop: function () {
    this.running = false;
    $(this.canvas).off('click');
  },
  update: function () {
    if (~this.running) return;

    this.updateGeometry();
    this.draw();

    var keyboard = this;
    setTimeout(function(){ keyboard.update(); }, this.delayMs);
  },

  updateGeometry: function () {
    var X = this.harmony.length;
    var Y = Math.floor(1 + Math.sqrt(window.innerHeight));

    var energy = this.harmony.getEnergy();
    var mass = this.harmony.mass.slice();

    // vertical bands with height-varying temperature
    var geometryYX = [];
    for (var y = 0; y < Y; ++y) {
      var temperature = (y + 0.5) / (Y - y - 0.5);
      var width = Pmf.gibbs(energy, temperature);

      var geom = geometryYX[y] = [0];
      for (var x = 0; x < X; ++x) {
        geom[x+1] = geom[x] + width[x];
      }
      geom[X] = 1;
    }

    // transpose
    var geometryXY = this.geometry = [];
    for (var x = 0; x < X; ++x) {
      var geom = geometryXY[x] = [];
      for (var y = 0; y < Y; ++y) {
        geom[y] = geometryYX[y][x];
      }
    }

    var color = this.color = [];
    var colorScale = 1.0 / Math.max(mass);
    var colorPow = 1.0 / mass.perplexity();
    for (var x = 0; x < X; ++x) {
      color[x] = Math.pow(colorScale * mass[x], colorPow);
    }
  },

  draw: function () {
    var geom = this.geometry;
    var context = this.context;

    var X = geom.length - 1;
    var Y = geom[0].length;
    var W = window.innerWidth - 1;
    var H = window.innerHeight - 1;

    for (var x = 0; x < X; ++x) {
      var c = this.color[x];
      context.fillStyle = 'rgb(' + c + ',' + c + ',' + c + ')';

      var lhs = geom[x];
      var rhs = geom[x+1];
      context.beginPath();
      context.moveTo(W * lhs[0], 0);
      for (y = 1; y < Y; ++y) {
        context.lineTo(W * lhs[y], H / Y * y);
      }
      for (y = Y-1; y >= 0; --y) {
        context.lineTo(W * rhs[y], H / Y * y);
      }
      context.closePath();
      context.fill();
    }
  },
};

//------------------------------------------------------------------------------
// Main

$(document).ready(function(){

  var RADIUS = 8; // maybe get from hash value

  log1('building harmony');
  var harmony = new Harmony(RADIUS);
  log1('built harmony with ' + harmony.length + ' points');

  var synthesizer = new Synthesizer(harmony);

  var canvas = document.getElementById('canvas');
  var keyboard = new Keyboard(harmony, canvas);

  keyboard.start();
  synthesizer.start();
  harmony.start();
});

