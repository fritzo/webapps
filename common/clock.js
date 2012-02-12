/**
 * A pausable clock to schedule continuous & discrete callbacks.
 *
 * All time units are in milliseconds.
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

  this.startTasks = [];
  this.runningTasks = [];
  this.stopTasks = [];
};

Clock.prototype = {
  start: function () {
    if (this.running) return;
    this.running = true;

    var elapsedTime = this.pauseTime ? this.beginTime - this.pauseTime : 0;
    this.beginTime = Date.now() + elapsedTime;

    for (var i = 0; i < this.startTasks.length; ++i) {
      this.startTasks[i](elapsedTime);
    }

    for (var i = 0; i < this.runningTasks.length; ++i) {
      var task = this.runningTasks[i];
      setTimeout(task, task.nextTime ? task.nextTime - this.pauseTime : 0);
    }
  },
  stop: function () {
    if (!this.running) return;
    this.running = false;

    this.pauseTime = Date.now();
    var elapsedTime = this.pauseTime - this.beginTime;

    for (var i = 0; i < this.runningTasks.length; ++i) {
      var task = this.runningTasks[i];
      if (task.scheduled) {
        clearTimeout(task.scheduled);
        task.scheduled = undefined;
      }
    }

    for (var i = 0; i < this.stopTasks.length; ++i) {
      this.stopTasks[i](elapsedTime);
    }
  },
  toggleRunning: function () {
    this.running ? this.stop() : this.start();
  },

  now: function () {
    return (this.running ? Date.now() : this.pauseTime) - this.beginTime;
  },

  /** 
   * behavior: callback(elapsedTime, timestep) no more often than minDelay.
   * @param {function} callback
   * @param {number} period
   */
  continuouslyDo: function (callback, minDelay) {
    minDelay = minDelay || 0;

    var lastTime = 0;
    var clock = this;
    var task = function () {
      if (clock.running) {
        var time = Date.now() - clock.beginTime;
        var dtime = time - lastTime;
        lastTime = time;
        callback(time, dtime);
        task.scheduled = setTimeout(task, minDelay);
      } else {
        task.scheduled = undefined;
      }
    };
    task.scheduled = undefined;
    this.runningTasks.push(task);
  },

  /** 
   * behavior: callback(cycle number) once per cycle.
   * @param {function} callback
   * @param {number} period
   * @param {function} [ondropped=warning]
   */
  discretelyDo: function (callback, period, ondropped) {
    assert(period > 0, 'bad period: ' + period);
    ondropped = ondropped || function (cycle) {
        log('WARNING: dropped cycle ' + cycle);
    };

    var lastCycle = undefined;
    var clock = this;
    var task = function () {
      if (clock.running) {
        var cycle = Math.round((Date.now() - clock.beginTime) / period);
        if (lastCycle !== undefined) {
          for (var i = 1 + lastCycle; i < cycle; ++i) {
            ondropped(i);
          }
        }
        lastCycle = cycle;
        callback(cycle);
        var nextTime = task.nextTime = clock.beginTime + period * (cycle + 1);
        task.scheduled = setTimeout(task, nextTime - Date.now());
      } else {
        task.scheduled = undefined;
      }
    };
    task.scheduled = undefined;
    this.runningTasks.push(task);
  },

  /** behavior: callback(elapsedTime) each time clock is started */
  onStart: function (callback) { this.startTasks.push(callback); },

  /** behavior: callback(elapsedTime) each time clock is stopped */
  onStop: function (callback) { this.stopTasks.push(callback); },

  none: undefined
};

