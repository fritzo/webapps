
var globalEval = eval;

var TodoException = function (message) {
  this.message = message || '(unfinished code)';
};
TodoException.prototype.toString = function () {
  return 'TODO: ' + this.message;
};
var TODO = function (message) {
  throw new TodoException(message);
};

var AssertException = function (message) {
  this.message = message || '(unspecified)';
};
AssertException.prototype.toString = function () {
  return 'Assertion Failed: ' + this.message;
};
var assert = function (condition, message) {
  if (!condition) {
    throw new AssertException(message);
  }
};

var assertEqual = function (actual, expected) {
  if (~(actual instanceof String) || ~(expected instanceof String)) {
    actual = JSON.stringify(actual);
    expected = JSON.stringify(expected);
  }
  assert(actual === expected,
    '\n    actual = ' + actual +
    '\n    expected = ' + expected);
};

var log;
if (window.console && window.console.log) {
  log = function (message) { console.log(message); };
} else {
  log = function (message) {}; // ignore
}

var test = function (title, callback) {
  callback = callback || function(){ globalEval(title); };
  callback.title = title;
  test._all.push(callback);
};
test._all = [];
test.runAll = function () {
  log('[ Running ' + test._all.length + ' unit tests ]');

  var failCount = 0;
  for (var i = 0; i < test._all.length; ++i) {
    var callback = test._all[i];
    try {
      callback();
    }
    catch (err) {
      log('FAILED ' + callback.title + '\n  ' + err);
      failCount += 1;
    }
  }

  if (failCount) {
    log('[ failed ' + failCount + ' tests ]');
  } else {
    log('[ passed all tests :) ]');
  }
};

//------------------------------------------------------------------------------
// Rational numbers (more precisely, extended nonnegative rational pairs)

var gcd = function (a,b)
{
  assert(a >= 0, 'gcd arg 1 is not positive: ' + a);
  assert(b >= 0, 'gcd arg 2 is not positive: ' + b);
  assert(a % 1 === 0, 'gcd arg 1 is not an integer: ' + a);
  assert(b % 1 === 0, 'gcd arg 2 is not an integer: ' + b);

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

var Rational = function (m,n) {
  assert(0 <= m && m % 1 == 0, 'invalid numer: ' + m);
  assert(0 <= n && n % 1 == 0, 'invalid denom: ' + n);
  //assert(m || n, '0/0 is not a Rational');

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

//----------------------------------------------------------------------------
// Probability vectors

var Pmf = function (initProbs) {
  if (initProbs instanceof Array) {
    this.probs = initProbs.slice();
  } else {
    this.probs = [];
  }
};

Pmf.prototype = {

  size: function () {
    return this.probs.length;
  },

  total: function () {
    var probs = this.probs;
    var result = 0;
    for (var i = 0, I = probs.length; i < I; ++i) {
      result += probs[i];
    }
    return result;
  },

  normalize: function () {
    var total = this.total();
    assert(0 < total, 'cannont normalize Pmf with zero mass');
    var scale = 1.0 / total;
    var probs = this.probs;
    for (var i = 0, I = probs.length; i < I; ++i) {
      probs[i] *= scale;
    }
  },

  entropy: function () {
    var probs = this.probs;
    var result = 0;
    for (var i = 0, I = probs.length; i < I; ++i) {
      var p = probs[i];
      if (p > 0) {
        result += p * Math.log(p);
      }
    }
    return result;
  },

  perplexity: function () {
    return Math.exp(this.entropy());
  },

  mean: function (values) {
    var probs = this.probs;
    assert(values.length === probs.length, 'mismatched length in Pmf.mean');
    var result = 0;
    for (var i = 0, I = probs.length; i < I; ++i) {
      result += probs[i] * values[i];
    }
    return result;
  },

  shiftTowardsPmf: function (other, rate) {
    var probs0 = this.probs;
    var probs1 = other.probs;
    assert(probs0.length === probs1.length,
        'mismatched lengths in Pmf.shiftTowardsPmf');
    assert(0 <= rate && rate <= 1,
        'bad rate in Pmf.shiftTowardsPmf: ' + rate);

    var w0 = 1 - rate;
    var w1 = rate;
    for (var i = 0, I = probs0.length; i < I; ++i) {
      probs0[i] = w0 * probs0[i] + w1 * probs1[i];
    }
  },

  shiftTowardsPoint: function (index, rate) {
    var probs = this.probs;
    assert(0 <= index && index < probs.length,
        'bad index in Pmf.shiftTowardsPoint: ' + index);
    assert(0 <= rate && rate <= 1,
        'bad rate in Pmf.shiftTowardsPoint: ' + rate);

    var w0 = 1 - rate;
    var w1 = rate;
    for (var i = 0, I = probs.length; i < I; ++i) {
      probs[i] *= w0;
    }
    probs[index] += w1;
  }
};

Pmf.degenerate = function (n, N) {
  assert(0 <= n && n < N, 'bad indices in Pmf.denerate: ' + n + ', ' + N);
  var result = new Pmf();
  var probs = result.probs;
  for (var i = 0; i < N; ++i) {
    probs[i] = 0;
  }
  probs[n] = 1;
  return result;
};

Pmf.gibbs = function (energy, temperature) {
  assert(0 < temperature, 'temperature is not positive: ' + temperature);
  var result = new Pmf();
  var probs = result.probs;
  for (var i = 0, I = energy.length; i < I; ++i) {
    probs[i] = Math.exp(-energy[i] / temperature);
  }
  result.normalize();
  return result;
};

test('Pmf.normalize', function(){
  var pmf = new Pmf();
  for (var i = 0; i < 3; ++i) {
    pmf.probs[i] = i;
  }
  pmf.normalize();
  assertEqual(pmf.probs, [0,1/3,2/3]);
});

test('assertEqual(Pmf.degenerate(1,4).probs, [0,1,0,0])');

test('new Pmf(init)', function(){
  var init = [1,2,3];
  var pmf = new Pmf(init);
  pmf.normalize();
  assertEqual(init, [1,2,3]);
  assertEqual(pmf.probs, [1/6,2/6,3/6]);
});

test('Pmf.shiftTowardsPmf', function(){
  var p0 = new Pmf([0,0,1]);
  var p1 = new Pmf([0,1/2,1/2]);
  var rate = 1/3;
  p0.shiftTowardsPmf(p1, rate);
  assertEqual(p0.probs, [0, 1/6, 5/6]);
});

test('Pmf.shiftTowardsPoint', function(){
  var p0 = new Pmf([0,0,1]);
  var rate = 1/4;
  p0.shiftTowardsPoint(1, rate);
  assertEqual(p0.probs, [0, 1/4, 3/4]);
});

//------------------------------------------------------------------------------
// Harmony

var Harmony = function (radius, timescaleSec, temperature, delaySec) {
  timescaleSec = timescaleSec || 2.0;
  temperature = temperature || 1.0;
  delaySec = delaySec || 0.05;

  //log('Building harmony of radius ' + radius);

  this.timescaleMs = timescaleSec * 1000;
  this.temperature = temperature;
  this.delayMs = delaySec * 1000;

  this.points = Rational.ball(radius);
  this.length = this.points.length;
  //log('  harmony has ' + this.length + ' points');

  var energyMatrix = this.energyMatrix = [];
  for (var i = 0; i < this.length; ++i) {
    var row = energyMatrix[i] = [];
    for (var j = 0; j < this.length; ++j) {
      row[j] = Rational.dist(this.points[i], this.points[j]);
    }
  }

  assert(this.length % 2, 'harmony does not have an odd number of points');
  this.mass = Pmf.degenerate((this.length - 1) / 2, this.length);

  this.running = false;
};

Harmony.prototype = {
  start: function () {
    if (this.running) return;
    log('starting Harmony');
    this.running = true;
    this.lastTime = Date.now();
    this.updateDiffusion();
  },
  stop: function () {
    log('stopping Harmony');
    this.running = false;
  },
  updateDiffusion: function () {
    var now = Date.now();
    assert(this.lastTime < now, 'Harmony.lastTime is in future');
    var diffusionRate = 1 - Math.exp((this.lastTime - now) / this.timescaleMs);
    this.lastTime = now;

    var prior = Pmf.gibbs(this.getEnergy(), this.temperature);
    this.mass.shiftTowardsPmf(prior, diffusionRate);

    if (this.running) {
      var harmony = this;
      setTimeout(function(){ harmony.updateDiffusion(); }, this.delayMs);
    }
  },

  // TODO switch from discrete events to continuous mass attack
  //   to avoid discontinuous behavior WRT touch event reordering
  updateAddMass: function (index) {
    assert(0 <= index && index < this.length, 'bad event index: ' + index);

    var perplexity = this.mass.perplexity();
    assert(perplexity > 0, 'nonpositive perplexity: ' + perplexity);
    var rate = 1.0 / perplexity;
    this.mass.shiftTowardsPoint(index, rate);
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

test('Harmony.updateDiffusion', function(){
  var harmony = new Harmony(8);
  var probs = harmony.mass.probs;
  assert(probs.length === harmony.length,
      'harmony.probs has wrong length before update');

  harmony.lastTime = Date.now() - 500;
  harmony.updateDiffusion();

  var probs = harmony.mass.probs;
  assert(probs.length === harmony.length,
      'harmony.probs has wrong length after update');
  for (var i = 0; i < probs.length; ++i) {
    assert(probs[i] > 0, 'probs is not positive: ' + JSON.stringify(probs));
  }
});

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
    log('starting Synthesizer');
    this.running = true;
    this.targetTime = Date.now();
    this.update();
  },
  stop: function () {
    log('stopping Synthesizer');
    this.running = false;
  },
  update: function () {
    var audio = this.synthesize(); // expensive

    var now = Date.now();
    var delay = this.targetTime - now;
    this.targetTime += this.delayMs;

    if (this.running) {
      var synth = this;
      setTimeout(function () { audio.play(); synth.update(); }, delay);
    }
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

var Keyboard = function (harmony, updateHz) {
  updateHz = updateHz || 60;

  var canvas = document.getElementById('canvas');

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
    log('starting Keyboard');
    this.running = true;

    this.update();

    var harmony = this.harmony;
    $(this.canvas).on('click', function(){
          var key = TODO('determine key from click position');
          harmony.updateAddMass(key);
        });
  },
  stop: function () {
    log('stopping Keyboard');
    this.running = false;
    $(this.canvas).off('click');
  },
  update: function () {
    this.updateGeometry();
    this.draw();

    if (this.running) {
      var keyboard = this;
      setTimeout(function(){ keyboard.update(); }, this.delayMs);
    }
  },

  updateGeometry: function () {
    var X = this.harmony.length;
    var Y = Math.floor(1 + Math.sqrt(window.innerHeight));

    var energy = this.harmony.getEnergy();
    var mass = this.harmony.mass;

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
    var colorScale = 1.0 / Math.max(mass.probs);
    var colorPow = 1.0 / mass.perplexity();
    for (var x = 0; x < X; ++x) {
      color[x] = Math.pow(colorScale * mass.probs[x], colorPow);
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

test('Keyboard.draw', function(){

  var harmony = new Harmony(4);
  for (var i = 0; i < harmony.length; ++i) {
    harmony.mass[i] = i;
  }
  harmony.mass.normalize();

  var keyboard = new Keyboard(harmony);

  keyboard.update();
  
  if(0)
  assert(confirm('does this look like a keyboard?'),
    'keyboard is not drawn correctly');
});

//------------------------------------------------------------------------------
// Main

$(document).ready(function(){

  if (window.location.hash && window.location.hash.substr(1) === 'test') {
    test.runAll();
    return;
  }

  var harmony = new Harmony(8);
  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony);

  keyboard.start();
  synthesizer.start();
  harmony.start();
});

