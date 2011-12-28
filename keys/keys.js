
var config = {
  harmony: {
    radius: 12,
    timescaleSec: 2.0,
    temperature: 1.0,
    updateHz: 60
  },

  synth: {
    sampleRateHz: 22050,
    centerFreqHz: 440.0,
    windowSec: 0.5
  },

  keyboard: {
    updateHz: 30
  }
};

//------------------------------------------------------------------------------
// Global safety & testing

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

var assertEval = function (message) {
  assert(eval(message), message);
};
var assertEqual = function (actual, expected, message) {
  if (~(actual instanceof String) || ~(expected instanceof String)) {
    actual = JSON.stringify(actual);
    expected = JSON.stringify(expected);
  }
  assert(actual === expected,
    (message || '') + 
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
    return -result;
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
  assertEqual(init, [1,2,3], 'init was changed');
  assertEqual(pmf.probs, [1/6,2/6,3/6], 'probs is invalid');
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

var Harmony = function (radius) {

  //log('Building harmony of radius ' + radius);

  this.timescaleMs = 1000 * config.harmony.timescaleSec;
  this.temperature = config.harmony.temperature;
  this.delayMs = 1000 / config.harmony.updateHz;

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
    assert(this.lastTime <= now, 'Harmony.lastTime is in future');
    var diffusionRate = 1 - Math.exp((this.lastTime - now) / this.timescaleMs);
    this.lastTime = now;

    var prior = Pmf.gibbs(this.getEnergy(), this.temperature);
    this.mass.shiftTowardsPmf(prior, diffusionRate);
    this.mass.normalize(); // to compensate for numerical drift

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
    assert(perplexity > 1, 'perplexity not greater than 1: ' + perplexity);
    var rate = 1 / (1 + perplexity);
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

test('Harmony.getEnergy', function(){
  var harmony = new Harmony(8);
  for (var i = 0; i < harmony.length; ++i) {
    harmony.mass.probs[i] = i;
  }
  harmony.mass.normalize();

  var energy = harmony.getEnergy();
  assertEqual(energy.length, harmony.length, 'energy has wrong size');
  for (var i = 0; i < energy.length; ++i) {
    assert(-1/0 < energy[i], 'bad energy: ' + energy[i]);
    assert(energy[i] < 1/0, 'bad energy: ' + energy[i]);
  }
});

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

var Synthesizer = function (harmony) {
  var windowMs = config.synth.windowSec / 1000;

  this.harmony = harmony;
  this.delayMs = windowMs / 2;
  this.windowSamples = Math.floor(
      config.synth.windowSec * config.synth.sampleRateHz);

  var freqScale =
      2 * Math.PI * config.synth.centerFreqHz / config.synth.sampleRateHz;
  this.freqs = harmony.points.map(function(q){
        return freqScale * q.toNumber();
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

    var T = this.windowSamples;
    var normalizeEnvelope = Math.pow(2 / (T+1), 4);
    var amp = this.harmony.mass.probs.map(function(p){
      return normalizeEnvelope * Math.sqrt(p);
    });
    log('DEBUG ' + JSON.stringify(amp));

    var freqs = this.freqs;
    var F = freqs.length;
    var samples = [];
    for (var t = 0; t < T; ++t) {
      var chord = 0;
      for (var f = 0; f < F; ++f) {
        chord += amp[f] * Math.sin(freqs[f] * t);
      }
      var env = (t + 1) * (T - t);
      chord *= env * env; // envelope
      chord /= Math.sqrt(1 + chord * chord); // clip
      samples[t] = Math.round(255/2 * (chord + 1)); // quantize
    }

    var wave = new RIFFWAVE(samples);
    return new Audio(wave.dataURI);
  }
};

//------------------------------------------------------------------------------
// Visualization

var Keyboard = function (harmony) {
  this.harmony = harmony;
  this.delayMs = 1000 / config.keyboard.updateHz;

  this.canvas = document.getElementById('canvas');
  this.context = canvas.getContext('2d');

  this.running = false;
  this.geometry = undefined;
};

Keyboard.prototype = {
  start: function () {
    if (this.running) return;
    log('starting Keyboard');
    this.running = true;

    this.update();

    var keyboard = this;
    $(this.canvas).on('click.keyboard', function (event) {
          keyboard.click(
            event.pageX / window.innerWidth,
            1 - event.pageY / window.innerHeight);
        });
  },
  stop: function () {
    log('stopping Keyboard');
    this.running = false;
    $(this.canvas).off('click.keyboard');
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
      var temperature = (y + 1) / (Y - y);
      var width = Pmf.gibbs(energy, temperature).probs;

      var geom = geometryYX[y] = [0];
      for (var x = 0; x < X; ++x) {
        geom[x+1] = geom[x] + width[x];
      }
      geom[X] = 1;
    }

    // transpose
    var geometryXY = this.geometry = [];
    for (var x = 0; x <= X; ++x) {
      var geom = geometryXY[x] = [];
      for (var y = 0; y < Y; ++y) {
        geom[y] = geometryYX[y][x];
      }
    }

    // accumulate statistics for color
    var massLog = 0;
    var meanLog = 0;
    var varLog = 0;
    for (var i = 0, I = mass.probs.length; i < I; ++i) {
      var p = mass.probs[i];
      if (p > 0) {
        var l = Math.log(p);
        massLog += p;
        meanLog += p * l;
        varLog += p * l * l;
      }
    }
    meanLog /= massLog;
    varLog /= massLog;
    varLog -= meanLog * meanLog;

    var colorShift = -meanLog;
    var colorScale = 1 / Math.sqrt(varLog);
    var color = this.color = [];
    for (var x = 0; x < X; ++x) {
      var prob = mass.probs[x];
      var colorStd = colorScale * (colorShift + Math.log(prob));
      color[x] = Math.atan(colorStd);
    }

    var colorShift = -Math.min.apply(Math, color);
    var colorScale = 1 / (Math.max.apply(Math, color) + colorShift);
    for (var x = 0; x < X; ++x) {
      color[x] = colorScale * (colorShift + color[x]);
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
      var c = Math.round(255 * this.color[x]);
      context.fillStyle = 'rgb(' + c + ',' + c + ',' + c + ')';

      var lhs = geom[x];
      var rhs = geom[x+1];
      context.beginPath();
      context.moveTo(W * lhs[0], H);
      for (y = 1; y < Y; ++y) {
        context.lineTo(W * lhs[y], H * (1 - y / (Y - 1)));
      }
      for (y = Y-1; y >= 0; --y) {
        context.lineTo(W * rhs[y], H * (1 - y / (Y - 1)));
      }
      context.closePath();
      context.fill();
    }
  },

  click: function (x01, y01) {
    var geom = this.geometry;
    var X = geom.length - 1;
    var Y = geom[0].length;

    var y = y01 * (Y - 1);
    var y0 = Math.max(0, Math.min(Y - 2, Math.floor(y)));
    var y1 = y0 + 1;
    assert(y1 < Y);
    var w0 = y1 - y;
    var w1 = y - y0;

    for (var x = 0; x < X; ++x) {
      if (x01 <= w0 * geom[x+1][y0] + w1 * geom[x+1][y1]) {
        this.harmony.updateAddMass(x);
        break;
      }
    }
  }
};

test('Keyboard.updateGeometry', function(){

  var harmony = new Harmony(4);
  for (var x = 0; x < harmony.length; ++x) {
    harmony.mass.probs[x] = 0.01 + x;
  }
  harmony.mass.normalize();

  var keyboard = new Keyboard(harmony);

  keyboard.updateGeometry();

  var geom = keyboard.geometry;
  var X = geom.length - 1;
  var Y = geom[0].length;
  assertEqual(X, harmony.length, 'geometry X != harmony.length');
  assert(Y > 0, 'geometry Y is not positive: ' << Y);

  for (var x = 0; x <= X; ++x) {
    for (var y = 0; y < Y; ++y) {
      assert(0 <= geom[x][y] && geom[x][y] <= 1,
          'bad geom['+x+']['+y+'] = ' + geom[x][y]);
    }
  }

  for (var y = 0; y < Y; ++y) {
    assert(geom[0][y] === 0, 'geometry left is not 0: ' + geom[0][y]);
    assert(geom[X][y] === 1, 'geometry right is not 1: ' + geom[X][y]);
    for (var x = 0; x < X; ++x) {
      assert(geom[x][y] < geom[x+1][y],
          'geometry is not monotonic: ' + geom[x][y] + ' -> ' + geom[x+1][y]);
    }
  }

  var color = keyboard.color;
  assertEqual(color.length, X, 'Keyboard.color has wrong length');
  
  for (var x = 0; x < X; ++x) {
    assert(0 <= color[x] && color[x] <= 1,
        'bad color['+x+'] = ' + color[x]);
  }
});

test('Keyboard.draw', function(){

  var harmony = new Harmony(4);
  for (var i = 0; i < harmony.length; ++i) {
    harmony.mass.probs[i] = i;
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

  var canvas = document.getElementById('canvas');
  $(window).resize(function(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }).resize();

  if (window.location.hash && window.location.hash.substr(1) === 'test') {
    document.title = 'Keys - Unit Test';
    test.runAll();
    return;
  }

  var harmony = new Harmony(config.harmony.radius);
  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony);

  document.title = harmony.length + ' Keys';

  harmony.start();
  keyboard.start();
  synthesizer.start();
});

