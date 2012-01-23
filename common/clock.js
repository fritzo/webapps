/**
 * A pausable clock to schedule continuous & discrete callbacks
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

//------------------------------------------------------------------------------
// Clock

/** @constructor */
var Clock = function () {
  this.running = false;
  this.beginTime = undefined;
  this.pauseTime = undefined;
  this.tasks = [];
};

Clock.prototype = {
  start: function () {
    if (this.running) return;
    this.running = true;

    if (this.pauseTime) {
      this.beginTime += Date.now() - this.pauseTime;
    } else {
      this.beginTime = Date.now();
    }

    for (var i = 0; i < this.tasks.length; ++i) {
      this.tasks[i]();
    }
  },
  stop: function () {
    if (!this.running) return;
    this.running = false;

    this.pauseTime = Date.now();

    for (var i = 0; i < this.tasks.length; ++i) {
      var task = this.tasks[i];
      if (task.scheduled) {
        clearTimeout(task.scheduled);
        task.scheduled = undefined;
      }
    }
  },
  toggleRunning: function () {
    this.running ? this.stop() : this.start();
  },

  /** 
   * behavior: callback(time) no more often than minDelay.
   */
  continuouslyDo: function (callback, minDelay) {
    minDelay = minDelay || 0;

    var clock = this;
    var task = function () {
      if (clock.running) {
        callback(Date.now() - clock.beginTime); // typuically { draw frame; }
        task.scheduled = setTimeout(task, minDelay);
      } else {
        task.scheduled = undefined;
      }
    };
    task.scheduled = undefined;
    this.tasks.push(task);
  },

  /** 
   * behavior: callback(cycle number) once per cycle, ignoring dropped cycles.
   */
  discretelyDo: function (callback, period) {
    assert(period > 0, 'bad period: ' + period);

    var clock = this;
    var task = function () {
      if (clock.running) {
        var cycle = Math.round((Date.now() - clock.beginTime) / period);
        callback(cycle); // typically { play sound; synthesize next sound; }
        var nextTime = clock.beginTime + period * (cycle + 1);
        task.scheduled = setTimeout(task, nextTime - Date.now());
      } else {
        task.scheduled = undefined;
      }
    };
    task.scheduled = undefined;
    this.tasks.push(task);
  }
};

