
var config = {
  harmony: {
    //maxRadius: 11.44, // 63 keys
    //maxRadius: 13, // 77 keys
    //maxRadius: 14.25, // 99 keys
    maxRadius: 16.45, // 127 keys
    priorSec: 8.0,
    priorRadius: 3,
    priorWidthOctaves: 4.0,
    sustainSec: 1.0,
    attackSec: 0.1,
    backgroundGain: 0.3,
    updateHz: 60
  },

  synth: {
    sampleRateHz: 22050,
    centerFreqHz: 261.625565, // middle C
    windowSec: 0.2,
    onsetGain: 2.0,
    sustainGain: 0.3,
    numVoices: 24
  },

  keyboard: {
    updateHz: 30
  },

  test: {
    interactive: false
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
  if (!(actual instanceof String) || !(expected instanceof String)) {
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

var verifyBrowser = function () {
  var missing = [];
  if (!Modernizr.canvas) missing.push('canvas element');
  if (!Modernizr.audio) missing.push('audio element');
  if (!Modernizr.webworkers) missing.push('web workers');

  if (missing.length) {
    var message = 'The Rational Keyboard ' +
        'needs some features not available in your browser: ' +
        missing.join(', ') + '.';
    $(document.body).empty().html(message).attr('class', 'warning');

    return false;
  } else {
    return true;
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

test('Rational.ball of size 88', function(){
  var target = 63; // needs to be odd; 88 is even
  var f = function(r) { return Rational.ball(r).length; }

  var r0, r1;
  for (r0 = 3; f(r0) >= target; --r0);
  for (r1 = 3; f(r1) <= target; ++r1);

  var r;
  while (true) {
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

//----------------------------------------------------------------------------
// Probability vectors

var Lmf = function (initProbs) {
  if (initProbs instanceof Array) {
    this.likes = initProbs.slice();
  } else {
    this.likes = [];
  }
};

Lmf.prototype = {

  total: function () {
    var likes = this.likes;
    var result = 0;
    for (var i = 0, I = likes.length; i < I; ++i) {
      result += likes[i];
    }
    return result;
  },

  normalize: function () {
    var total = this.total();
    assert(0 < total, 'cannont normalize Lmf with zero mass');
    var scale = 1.0 / total;
    var likes = this.likes;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] *= scale;
    }
  },

  scale: function (s) {
    var likes = this.likes;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] *= s;
    }
  },

  dot: function (values) {
    var likes = this.likes;
    //assert(values.length === likes.length, 'mismatched length in Lmf.dot');
    var result = 0;
    for (var i = 0, I = likes.length; i < I; ++i) {
      result += likes[i] * values[i];
    }
    return result;
  },

  shiftTowardsLmf: function (other, rate) {
    var likes0 = this.likes;
    var likes1 = other.likes;
    assert(likes0.length === likes1.length,
        'mismatched lengths in Lmf.shiftTowardsLmf');
    assert(0 <= rate && rate <= 1,
        'bad rate in Lmf.shiftTowardsLmf: ' + rate);

    var w0 = 1 - rate;
    var w1 = rate;
    for (var i = 0, I = likes0.length; i < I; ++i) {
      likes0[i] = w0 * likes0[i] + w1 * likes1[i];
    }
  },

  shiftTowardsPoint: function (index, rate) {
    var likes = this.likes;
    assert(0 <= index && index < likes.length,
        'bad index in Lmf.shiftTowardsPoint: ' + index);
    assert(0 <= rate && rate <= 1,
        'bad rate in Lmf.shiftTowardsPoint: ' + rate);

    var w0 = 1 - rate;
    var w1 = rate;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] *= w0;
    }
    likes[index] += w1;
  }
};

Lmf.zero = function (N) {
  assert(0 < N, 'bad length in Lmf.zero: ' + N);
  var result = new Lmf();
  var likes = result.likes;
  for (var i = 0; i < N; ++i) {
    likes[i] = 0;
  }
  return result;
};

Lmf.degenerate = function (n, N) {
  assert(0 <= n && n < N, 'bad indices in Lmf.denerate: ' + n + ', ' + N);
  var result = new Lmf();
  var likes = result.likes;
  for (var i = 0; i < N; ++i) {
    likes[i] = 0;
  }
  likes[n] = 1;
  return result;
};

Lmf.multiply = function (lhs, rhs) {
  assert(lhs.length === rhs.length,
      'length mismatch in Lmf.multiply');

  var result = new Lmf();
  x = lhs.likes;
  y = rhs.likes;
  var xy = result.likes;
  for (var i = 0, I = x.length; i < I; ++i) {
    xy[i] = x[i] * y[i];
  }
  return result;
};

Lmf.boltzmann = function (energy, temperature) {
  if (temperature === undefined) temperature = 1;
  assert(0 < temperature, 'temperature is not positive: ' + temperature);
  var result = new Lmf();
  var likes = result.likes;
  for (var i = 0, I = energy.length; i < I; ++i) {
    likes[i] = Math.exp(-energy[i] / temperature);
  }
  result.normalize();
  return result;
};

test('Lmf.normalize', function(){
  var pmf = new Lmf();
  for (var i = 0; i < 3; ++i) {
    pmf.likes[i] = i;
  }
  pmf.normalize();
  assertEqual(pmf.likes, [0,1/3,2/3]);
});

test('assertEqual(Lmf.zero(3).likes, [0,0,0])');
test('assertEqual(Lmf.degenerate(1,4).likes, [0,1,0,0])');
test('Lmf.multiply', function(){
  var x = new Lmf([0,1,2,3]);
  var y = new Lmf([3,2,1,0]);
  assertEqual(Lmf.multiply(x,y).likes, [0,2,2,0]);
});

test('new Lmf(init)', function(){
  var init = [1,2,3];
  var pmf = new Lmf(init);
  pmf.normalize();
  assertEqual(init, [1,2,3], 'init was changed');
  assertEqual(pmf.likes, [1/6,2/6,3/6], 'likes is invalid');
});

test('Lmf.shiftTowardsLmf', function(){
  var p0 = new Lmf([0,0,1]);
  var p1 = new Lmf([0,1/2,1/2]);
  var rate = 1/3;
  p0.shiftTowardsLmf(p1, rate);
  assertEqual(p0.likes, [0, 1/6, 5/6]);delaySec: 0.05
});

test('Lmf.shiftTowardsPoint', function(){
  var p0 = new Lmf([0,0,1]);
  var rate = 1/4;
  p0.shiftTowardsPoint(1, rate);
  assertEqual(p0.likes, [0, 1/4, 3/4]);
});

//------------------------------------------------------------------------------
// Harmony

var Harmony = function (radius) {
  this.priorRateKhz = 1e-3 / config.harmony.priorSec;
  this.sustainRateKhz = 1e-3 / config.harmony.sustainSec;
  this.attackKhz = 1e-3 / config.harmony.attackSec;
  this.backgroundGain = config.harmony.backgroundGain;
  this.priorRadius = config.harmony.priorRadius;
  this.logFreqVariance =
    Math.pow(config.harmony.priorWidthOctaves * Math.log(2), 2);
  this.delayMs = 1000 / config.harmony.updateHz;

  // TODO dynamically add & remove points based on prior
  this.points = Rational.ball(radius);
  this.length = this.points.length;

  var energyMatrix = this.energyMatrix = [];
  for (var i = 0; i < this.length; ++i) {
    var row = energyMatrix[i] = [];
    for (var j = 0; j < this.length; ++j) {
      row[j] = Rational.dist(this.points[i], this.points[j]);
    }
  }
  
  var freqEnergy = this.freqEnergy = [];
  for (var i = 0; i < this.length; ++i) {
    var logFreq = Math.log(this.points[i].toNumber());
    freqEnergy[i] = 0.5 * logFreq * logFreq / this.logFreqVariance;
  }

  assert(this.length % 2, 'harmony does not have an odd number of points');
  this.mass = Lmf.degenerate((this.length - 1) / 2, this.length);
  this.dmass = Lmf.zero(this.length);
  this.prior = Lmf.boltzmann(this.getEnergy(this.mass));

  this.running = false;
};

Harmony.prototype = {
  start: function () {
    if (this.running) return;
    //log('starting Harmony');
    this.running = true;
    this.lastTime = Date.now();
    this.updateDiffusion();
  },
  stop: function () {
    //log('stopping Harmony');
    this.running = false;
  },
  updateDiffusion: function () {
    var now = Date.now();
    assert(this.lastTime <= now, 'Harmony.lastTime is in future');
    var dt = now - this.lastTime;
    this.lastTime = now;

    var priorRate = 1 - Math.exp(-dt * this.priorRateKhz);
    var newPrior = Lmf.boltzmann(this.getEnergy(this.mass));
    this.prior.shiftTowardsLmf(newPrior, priorRate);

    var sustainRate = 1 - Math.exp(-dt * this.sustainRateKhz);
    newPrior.scale(this.backgroundGain);
    this.mass.shiftTowardsLmf(newPrior, sustainRate);

    var attackDecay = Math.exp(-dt * this.attackKhz);
    var attackRate = 1 / attackDecay - 1;
    var likes = this.mass.likes;
    var dlikes = this.dmass.likes;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] += attackRate * (dlikes[i] *= attackDecay);
    }

    if (this.running) {
      var harmony = this;
      setTimeout(function(){ harmony.updateDiffusion(); }, this.delayMs);
    }
  },

  updateAddMass: function (index) {
    this.dmass.likes[index] += 1;
  },

  getEnergy: function (mass) {
    var energyMatrix = this.energyMatrix;
    var freqEnergy = this.freqEnergy;
    var radiusScale = 1 / mass.total() / this.priorRadius;
    var energy = [];
    for (var i = 0, I = this.length; i < I; ++i) {
      energy[i] = radiusScale * mass.dot(energyMatrix[i]) + freqEnergy[i];
    }
    return energy;
  }
};

test('Harmony.getEnergy', function(){
  var harmony = new Harmony(8);
  for (var i = 0; i < harmony.length; ++i) {
    harmony.mass.likes[i] = i;
  }
  harmony.mass.normalize();

  var energy = harmony.getEnergy(harmony.mass);
  assertEqual(energy.length, harmony.length, 'energy has wrong size');
  for (var i = 0; i < energy.length; ++i) {
    assert(-1/0 < energy[i], 'bad energy: ' + energy[i]);
    assert(energy[i] < 1/0, 'bad energy: ' + energy[i]);
  }
});

test('Harmony.updateDiffusion', function(){
  var harmony = new Harmony(8);
  var likes = harmony.mass.likes;
  assert(likes.length === harmony.length,
      'harmony.likes has wrong length before update');

  harmony.lastTime = Date.now() - 500;
  harmony.updateDiffusion();

  var likes = harmony.mass.likes;
  assert(likes.length === harmony.length,
      'harmony.likes has wrong length after update');
  for (var i = 0; i < likes.length; ++i) {
    assert(likes[i] > 0, 'likes is not positive: ' + JSON.stringify(likes));
  }
});

//------------------------------------------------------------------------------
// Synthesis

var Synthesizer = function (harmony) {
  var windowMs = 1000 * config.synth.windowSec;

  this.harmony = harmony;
  this.delayMs = windowMs / 2;
  this.windowSamples = Math.floor(
      config.synth.windowSec * config.synth.sampleRateHz);
  this.sustainGain = config.synth.sustainGain;
  this.onsetGain = config.synth.onsetGain;
  this.numVoices = Math.min(harmony.length, config.synth.numVoices);

  var centerFreq = this.centerFreq =
    2 * Math.PI * config.synth.centerFreqHz / config.synth.sampleRateHz;
  var freqs = this.freqs = harmony.points.map(function(q){
        return centerFreq * q.toNumber();
      });
  var onsets = this.onsets = [];
  for (var i = 0; i < freqs.length; ++i) {
    onsets[i] = this.synthesizeOnset(freqs[i]);
  }

  this.running = false;
  this.targetTime = Date.now();
};

Synthesizer.prototype = {
  start: function () {
    if (this.running) return;
    //log('starting Synthesizer');
    this.running = true;

    this.worker = new Worker('synthworker.js');
    var synth = this;
    this.worker.addEventListener('message', function (e) {
          var data = e.data;
          switch (data.type) {
            case 'wave':
              synth.play(data.data);
              break;

            case 'log':
              log(data.data);
              break;

            case 'error':
              log('Worker Error: ' + data.data);
              break;
          }
        }, false);
    this.worker.postMessage({
      cmd: 'init',
      data: {
          gain: this.sustainGain,
          freqs: this.freqs,
          numVoices: this.numVoices,
          windowSamples: this.windowSamples
        }
      });

    this.targetTime = Date.now();
    this.update();
  },
  stop: function () {
    //log('stopping Synthesizer');
    this.running = false;

    this.worker.terminate();
  },

  update: function () {
    var mass = this.harmony.mass.likes;
    this.worker.postMessage({cmd:'synthesize', data:mass});
  },
  play: function (uri) {
    var audio = new Audio(uri);

    var now = Date.now();
    var delay = this.targetTime - now;
    this.targetTime = Math.max(now, this.targetTime + this.delayMs);

    if (this.running) {
      var synth = this;
      setTimeout(function () { audio.play(); synth.update(); }, delay);
    }
  },

  synthesizeOnset: function (freq) {
    var T = 2 * this.windowSamples;
    var amp = this.onsetGain * Math.sqrt(this.centerFreq / freq) / T;
    var samples = [];
    for (var t = 0; t < T; ++t) {
      var tone = amp * (T - t) * Math.sin(freq * t);
      tone /= Math.sqrt(1 + tone * tone); // clip
      samples[t] = Math.round(255/2 * (tone + 1)); // quantize
    }

    var wave = new RIFFWAVE(samples);
    return wave.dataURI;
  },
  playOnset: function (index) {
    (new Audio(this.onsets[index])).play();
  }
};

test('web worker echo', function(){
  var message = {a:0, b:[0,1,2], c:'asdf', d:{}}; // just some JSON
  var received = false;
  var error = null;

  var worker = new Worker('testworker.js');
  worker.addEventListener('message', function (e) {
    received = true;
    try {
      assert(e.data, 'echoed message has no data');
      assertEqual(e.data, message, 'echoed data does not match');
    }
    catch (err) {
      error = err;
    }
  }, false);

  worker.postMessage(message);

  console.log('deferring decision on web worker test...');
  setTimeout(function () {
    try {
      assert(received, 'no message was received from web worker');
      assert(error === null, error);
      console.log('PASSED web worker test');
    }
    catch (err) {
      console.log('FAILED web worker test: ' + err);
    }
    worker.terminate();
  }, 1000);
});

if(0) // TODO
test('Synthesizer.worker', function(){
  var harmony = new Harmony(3);
  var synthesizer = new Synthesizer(harmony);
  harmony.start();
  synthesizer.start();

  // TODO test web worker here

  synthesizer.stop();
  harmony.stop();
});

//------------------------------------------------------------------------------
// Visualization

var Keyboard = function (harmony, synthesizer) {
  this.harmony = harmony;
  this.synthesizer = synthesizer;
  this.delayMs = 1000 / config.keyboard.updateHz;

  this.canvas = document.getElementById('canvas');
  this.context = this.canvas.getContext('2d');

  this.running = false;
  this.geometry = undefined;
};

Keyboard.prototype = {
  start: function () {
    if (this.running) return;
    //log('starting Keyboard');
    this.running = true;

    this.update();

    var keyboard = this;
    $(this.canvas).on('click.keyboard', function (e) {
          keyboard.click(
            e.pageX / window.innerWidth,
            e.pageY / window.innerHeight);
        });
  },
  stop: function () {
    //log('stopping Keyboard');
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
    var Y = Math.floor(2 + Math.sqrt(window.innerHeight));
    var keyExponent = 6;

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = Lmf.boltzmann(energy);
    probs.scale((1 - 1 / keyExponent) / Math.max.apply(Math, probs.likes));
    probs = this.probs = probs.likes;

    // vertical bands of varying width
    var geometryYX = [];
    for (var y = 0; y < Y; ++y) {
      var y01 = (y + 0.5) / Y;
      var width = new Lmf();
      for (var x = 0; x < X; ++x) {
        var p = probs[x];
        //width.likes[x] = Math.pow(p, 1 - 0.8 * y/(Y-1));
        width.likes[x] = Math.pow(p, keyExponent * (1 - y01))
                       * Math.pow(1-p, keyExponent * y01);
      }
      width.normalize();

      var geom = geometryYX[y] = [0];
      for (var x = 0; x < X; ++x) {
        geom[x+1] = geom[x] + width.likes[x];
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

    var colorParam = this.harmony.prior.likes;
    var colorScale = 1 / Math.max.apply(Math, colorParam);
    var activeParam = this.harmony.dmass.likes;
    var color = this.color = [];
    var active = this.active = [];
    for (var x = 0; x < X; ++x) {
      color[x] = Math.sqrt(colorScale * colorParam[x]);
      active[x] = 1 - Math.exp(-activeParam[x]);
    }
  },

  draw: function () {
    var geom = this.geometry;
    var color = this.color;
    var points = this.harmony.points;
    var context = this.context;

    var X = geom.length - 1;
    var Y = geom[0].length;
    var W = window.innerWidth - 1;
    var H = window.innerHeight - 1;

    context.fillStyle = 'rgb(0,0,0)';
    context.clearRect(0, 0, W+1, H+1);

    for (var x = 0; x < X; ++x) {
      var r = Math.round(255 * Math.min(1, color[x] + this.active[x]));
      var g = Math.round(255 * Math.max(0, color[x] - this.active[x]));
      if (r < 2) continue;
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + g + ')';

      var lhs = geom[x];
      var rhs = geom[x+1];
      //if (rhs[Y-1] - lhs[Y-1] < 2 / W) continue;
      context.beginPath();
      context.moveTo(W * lhs[Y-1], 0);
      for (y = Y-2; y >= 0; --y) {
        context.lineTo(W * lhs[y], H * (1 - y / (Y - 1)));
      }
      //context.bezierCurveTo(
      //    W * lhs[0], H * (1 + 1/3 / (Y - 1)),
      //    W * rhs[0], H * (1 + 1/3 / (Y - 1)),
      //    W * rhs[1], H * (1 - 1 / (Y - 1)));
      for (y = 0; y < Y; ++y) {
        context.lineTo(W * rhs[y], H * (1 - y / (Y - 1)));
      }
      context.closePath();
      context.fill();
    }

    var textThresh = 1/4;
    context.font = '10pt Helvetica';
    context.textAlign = 'center';
    for (var x = 0; x < X; ++x) {
      var c = color[x];
      if (c > textThresh) {
        var opacity = Math.sqrt((c - textThresh) / (1 - textThresh));
        context.fillStyle = 'rgba(0,0,0,' + opacity + ')';

        var p = this.probs[x];
        var py = (1-p) * (Y-1);
        var y0 = Math.floor(py);
        var y1 = 1 + y0;
        var w0 = y1 - py;
        var w1 = py - y0;
        var lhs = (w0 * geom[x][y0] + w1 * geom[x][y1]);
        var rhs = (w0 * geom[x+1][y0] + w1 * geom[x+1][y1]);
        var posX = W * (lhs + rhs) / 2;
        var posY = H * p + 8;

        var point = points[x];
        context.fillText(point.numer, posX, posY - 8);
        context.fillText('\u2013', posX, posY - 1); // 2014,2015 are wider
        context.fillText(point.denom, posX, posY + 8);
      }
    }
  },

  click: function (x01, y01) {
    var geom = this.geometry;
    var X = geom.length - 1;
    var Y = geom[0].length;

    var y = (1 - y01) * (Y - 1);
    var y0 = Math.max(0, Math.min(Y - 2, Math.floor(y)));
    var y1 = y0 + 1;
    assert(y1 < Y);
    var w0 = y1 - y;
    var w1 = y - y0;

    for (var x = 0; x < X; ++x) {
      if (x01 <= w0 * geom[x+1][y0] + w1 * geom[x+1][y1]) {
        this.harmony.updateAddMass(x);
        this.synthesizer.playOnset(x);
        break;
      }
    }
  }
};

test('Keyboard.updateGeometry', function(){

  var harmony = new Harmony(4);
  for (var x = 0; x < harmony.length; ++x) {
    harmony.mass.likes[x] = 0.01 + x;
  }

  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony, synthesizer);

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
      assert(geom[x][y] <= geom[x+1][y],
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
    harmony.mass.likes[i] = i;
  }

  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony, synthesizer);

  keyboard.update();
  
  if(config.test.interactive) {
    assert(confirm('does this look like a keyboard?'),
        'keyboard is not drawn correctly');
  }
});

//------------------------------------------------------------------------------
// Main

test('main', function(){
  var harmony = new Harmony(8);
  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony, synthesizer);

  harmony.start();
  synthesizer.start();
  keyboard.start();

  if(config.test.interactive) {
    assert(confirm('do you hear a tone?'),
        'synthesizer did not make a tone');
    assert(confirm('do you see a keyboard?'),
        'keyboard was not drawn correctly');
  }

  keyboard.stop();
  synthesizer.stop();
  harmony.stop();
});

$(document).ready(function(){

  if (!verifyBrowser()) return;

  var canvas = document.getElementById('canvas');
  $(window).resize(function(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }).resize();

  if (window.location.hash && window.location.hash.substr(1) === 'test') {
    document.title = 'The Rational Keyboard - Unit Test';
    test.runAll();
    return;
  }

  var harmony = new Harmony(config.harmony.maxRadius);
  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony, synthesizer);

  log('using ' + harmony.length + ' keys');

  var running = false;
  var toggleRunning = function () {
    if (running) {
      document.title = 'The Rational Keyboard (paused)';
      synthesizer.stop();
      keyboard.stop();
      harmony.stop();
      running = false;
    } else {
      document.title = 'The Rational Keyboard';
      harmony.start();
      keyboard.start();
      synthesizer.start();
      running = true;
    }
  };

  $(document).on('keyup', function (e) {
        switch (e.which) {
          case 27:
            toggleRunning();
            break;
            }
      });

  toggleRunning();
});

